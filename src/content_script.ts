import { Calendar } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import itLocale from "@fullcalendar/core/locales/it";
import "./styles.css";

// Chrome/Firefox compatibility: Use chrome API if available, otherwise browser API
const browserAPI = (
  typeof chrome !== "undefined" && chrome.storage ? chrome : browser
) as typeof browser;

// Interface to define the structure of Exam objects
interface Exam {
  title: string;
  shots: ExamShot[];
  articleUrl?: string;
  articleIndex: number;
}

interface ExamShot {
  date: Date;
  enrolled: boolean;
}

interface Settings {
  linkType: "anxious-display" | "exam-article";
}

const exams: Exam[] = [];

// Translations
const translations = {
  en: {
    exportButton: "Export exams you registered for as ICS",
    noEnrollments: "No exam enrollments found.",
  },
  it: {
    exportButton: "Esporta gli esami a cui sei iscritto come ICS",
    noEnrollments: "Nessuna iscrizione all'esame trovata.",
  },
};

// Detect current language from the page
function detectLanguage(): "en" | "it" {
  // Find all buttons that might be the language switcher
  const buttons = Array.from(
    document.querySelectorAll("button.pj-link-button"),
  );

  for (const button of buttons) {
    const text = button.textContent?.trim().toUpperCase();
    if (text === "EN" || text === "IT") {
      // Button shows the OTHER language (click to switch to it)
      // So if button says "EN", current language is "IT" and vice versa
      return text === "EN" ? "it" : "en";
    }
  }

  // Fallback: check for Italian text on the page
  const pageText = document.body.textContent || "";
  if (pageText.includes("Iscrizioni") || pageText.includes("Appelli")) {
    return "it";
  }

  return "en";
}

// Get translated text
function t(key: keyof typeof translations.en): string {
  const lang = detectLanguage();
  return translations[lang][key];
}

// Function to extract exam data from the page
function extractExamData(): Exam[] {
  const articles = document.querySelectorAll("article");

  const activeTabIndex = Array.from(
    document.querySelectorAll(".p-tabview-nav li"),
  ).findIndex((tab) => tab.classList.contains("p-highlight"));

  articles.forEach((card, index) => {
    const titleQuerySelector =
      activeTabIndex === 0 ? "section div.pj-mb-1" : "div.mb-3";
    const dateQuerySelector =
      activeTabIndex === 0
        ? "section > div:not(div:nth-child(1))"
        : "div:not(div:nth-child(1))";
    const iconsSelector =
      activeTabIndex === 0
        ? "section > div:not(div:nth-child(1)) i"
        : "div:not(div:nth-child(1)) i";

    const title = card.querySelector(titleQuerySelector)?.textContent?.trim();
    const dates = Array.from(card.querySelectorAll(dateQuerySelector))
      .map((dateElement) => parseDate(dateElement.textContent?.trim()))
      .filter((date) => date !== null);

    const icons = Array.from(card.querySelectorAll(iconsSelector));

    // Just grab the first link in the article
    const mainLink = card.querySelector("a[href]");
    const articleUrl = mainLink
      ? (mainLink as HTMLAnchorElement).href
      : undefined;

    if (title && dates.length) {
      exams.push({
        title,
        articleUrl,
        articleIndex: index,
        shots: dates.map((date, i) => ({
          date,
          enrolled: icons[i]
            ?.getAttribute("class")
            ?.includes("pmi-line-check-circle")
            ? true
            : false,
        })),
      });
    }
  });

  return exams;
}

function parseDate(dateText: string | undefined): Date | null {
  if (!dateText) return null;

  // Match formats like "12GEN2024" or "1FEB2023"
  const match = dateText.match(/(\d{1,2})([A-Z]{3})(\d{4})/i);
  if (!match) return null;

  const [_, dayStr, monthStr, yearStr] = match;
  const day = Number(dayStr);
  const year = Number(yearStr);

  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1)
      .toLocaleString("it-IT", { month: "short" })
      .toUpperCase(),
  );

  const month = months.indexOf(monthStr.toUpperCase());
  if (month === -1) return null;

  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
}

let calendar: Calendar | null = null;

// Function to generate an ICS file for enrolled exams
function generateICS() {
  const enrolledExams = exams.filter((exam) =>
    exam.shots?.some((shot) => shot.enrolled),
  );

  let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\n";

  enrolledExams.forEach((exam) => {
    exam.shots
      .filter((shot) => shot.enrolled)
      .forEach((shot) => {
        icsContent += `BEGIN:VEVENT\nSUMMARY:${exam.title}\nDTSTART:${
          shot.date.toISOString().replace(/[-:]/g, "").split(".")[0]
        }Z\nDTEND:${
          new Date(shot.date.getTime() + 3600000)
            .toISOString()
            .replace(/[-:]/g, "")
            .split(".")[0]
        }Z\nEND:VEVENT\n`;
      });
  });

  icsContent += "END:VCALENDAR";

  const blob = new Blob([icsContent], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "registered_exams.ics";
  link.click();

  URL.revokeObjectURL(url);
}

// Add export button to the calendar
function addExportButton() {
  const activeSection = document.querySelector(
    '.p-tabview-panel:not([aria-hidden="true"])',
  );

  if (activeSection) {
    let exportButton = activeSection.querySelector("#export-ics-button");
    if (!exportButton) {
      exportButton = document.createElement("button");
      exportButton.id = "export-ics-button";
      exportButton.textContent = t("exportButton");

      const buttonElement = exportButton as HTMLElement;
      buttonElement.classList.add("p-button", "p-component");
      buttonElement.style.margin = "10px";

      exportButton.addEventListener("click", generateICS);
      activeSection.appendChild(exportButton);
    } else {
      // Update text in case language changed
      exportButton.textContent = t("exportButton");
    }
  }
}

// Load settings from storage
async function loadSettings(): Promise<Settings> {
  const result = await browserAPI.storage.sync.get({
    linkType: "exam-article",
  });
  return result as Settings;
}

// Modify the script to continuously attempt rendering until the active tab is found
async function attemptRenderCalendar() {
  exams.length = 0;
  extractExamData();
  const activeSection = document.querySelector(
    '.p-tabview-panel:not([aria-hidden="true"])',
  );

  exams.some((exam) => exam.shots.some((shot) => shot.enrolled))
    ? addExportButton()
    : null;

  if (exams.length > 0 && activeSection) {
    let calendarElement = activeSection.querySelector("#calendar");
    if (!calendarElement) {
      calendarElement = document.createElement("div");
      calendarElement.id = "calendar";
      // Append to the end to ensure it's always at the bottom
      activeSection.appendChild(calendarElement);
    } else {
      // Move calendar to the end if it exists
      calendarElement.innerHTML = "";
      activeSection.appendChild(calendarElement);
    }

    // Load settings to determine URL type
    const settings = await loadSettings();
    console.log("Current link type setting:", settings.linkType);

    const events = exams.flatMap((exam) =>
      exam.shots.map((shot, i) => {
        let eventUrl: string | undefined;

        if (settings.linkType === "exam-article") {
          // Use a fake URL with article index as a marker
          eventUrl = `#article-${exam.articleIndex}`;
          console.log("Using article scroll to index:", exam.articleIndex);
        } else {
          // Default to anxious display
          let url = Array.from([
            {
              title: exam.title,
              description: "imported from polimi-exam-calendar",
              date: shot.date.toISOString(),
            },
          ]);
          const urlParam = btoa(JSON.stringify(url));
          eventUrl =
            "https://the-anxious-display.vercel.app/?countdowns=" + urlParam;
          console.log("Using anxious display URL");
        }

        return {
          title: exam.title,
          start: shot.date.toISOString(),
          color: shot.enrolled ? "#4CAF50" : "#2196F3",
          allDay: true,
          url: eventUrl,
          extendedProps: {
            articleIndex: exam.articleIndex,
          },
        };
      }),
    );

    if (calendar) {
      calendar.destroy(); // Destroy the previous calendar instance
    }

    const currentLang = detectLanguage();

    // Create custom Italian locale with capitalized months
    const customItLocale =
      currentLang === "it"
        ? {
            code: "it",
            week: {
              dow: 1,
              doy: 4,
            },
            buttonText: itLocale.buttonText,
            weekText: itLocale.weekText,
            allDayText: itLocale.allDayText,
            moreLinkText: itLocale.moreLinkText,
            noEventsText: itLocale.noEventsText,
          }
        : undefined;

    calendar = new Calendar(calendarElement as HTMLElement, {
      plugins: [dayGridPlugin, listPlugin],
      initialView: "dayGridMonth",
      initialDate: exams.length > 0 ? exams[0].shots[0].date : new Date(),
      locale: customItLocale || currentLang,
      events,

      eventClick: function (info) {
        const currentSettings = settings; // Capture settings in closure

        if (currentSettings.linkType === "exam-article") {
          // Prevent default navigation
          info.jsEvent.preventDefault();

          // Get the article index from the event
          const articleIndex = info.event.extendedProps.articleIndex;

          // Find and scroll to the article
          const articles = document.querySelectorAll("article");
          const targetArticle = articles[articleIndex];

          if (targetArticle) {
            // Scroll to the article
            targetArticle.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });

            // Add a temporary highlight effect
            targetArticle.style.transition = "background-color 0.3s";
            const originalBg =
              window.getComputedStyle(targetArticle).backgroundColor;
            targetArticle.style.backgroundColor = "rgba(33, 150, 243, 0.1)";

            setTimeout(() => {
              targetArticle.style.backgroundColor = originalBg;
            }, 2000);
          }
        }
        // For anxious-display, let the default URL navigation happen
      },

      views: {
        dayGridMonth: {
          titleFormat: (date) => {
            const month = date.date.marker.toLocaleDateString(currentLang, {
              month: "long",
            });
            const year = date.date.marker.getFullYear();
            // Capitalize first letter for Italian
            const capitalizedMonth =
              month.charAt(0).toUpperCase() + month.slice(1);
            return `${capitalizedMonth} ${year}`;
          },
          dayHeaderFormat: { weekday: "long" },
        },
        listMonth: {
          titleFormat: (date) => {
            const month = date.date.marker.toLocaleDateString(currentLang, {
              month: "long",
            });
            const year = date.date.marker.getFullYear();
            const capitalizedMonth =
              month.charAt(0).toUpperCase() + month.slice(1);
            return `${capitalizedMonth} ${year}`;
          },
          dayHeaderFormat: { weekday: "long" },
        },
      },

      headerToolbar: {
        right: "prev,next today",
        center: "title",
        left: "dayGridMonth,listMonth",
      },
    });
    calendar.render();

    setupClickListener();
  } else {
    console.log("Active section not found. Retrying in 1 second...");
    setTimeout(attemptRenderCalendar, 1000);
  }
}

// Function to set up tab click listener
function setupClickListener() {
  const tabs = document.querySelectorAll(".p-tabview-nav li");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Delay to allow tab content to load
      setTimeout(() => {
        attemptRenderCalendar();
        console.log("Tab clicked, re-rendering calendar.");
      }, 100);
    });
  });
}

// Set up MutationObserver to detect when active tab changes
function observeTabChanges() {
  const tabPanelContainer = document.querySelector(".p-tabview-panels");

  if (tabPanelContainer) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "aria-hidden"
        ) {
          const target = mutation.target as HTMLElement;
          if (target.getAttribute("aria-hidden") === "false") {
            console.log("Active tab changed, re-rendering calendar.");
            setTimeout(attemptRenderCalendar, 100);
          }
        }
      });
    });

    const panels = tabPanelContainer.querySelectorAll(".p-tabview-panel");
    panels.forEach((panel) => {
      observer.observe(panel, { attributes: true });
    });
  }
}

// Observe language changes and article additions
function observeLanguageChanges() {
  const activeSection = document.querySelector(
    '.p-tabview-panel:not([aria-hidden="true"])',
  );

  if (activeSection) {
    const observer = new MutationObserver((mutations) => {
      // Check if articles were added/removed (language change causes content reload)
      let articlesChanged = false;

      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          // Check if article elements were added or removed
          const addedArticles = Array.from(mutation.addedNodes).some(
            (node) =>
              node.nodeName === "ARTICLE" ||
              (node as Element).querySelector?.("article"),
          );
          const removedArticles = Array.from(mutation.removedNodes).some(
            (node) =>
              node.nodeName === "ARTICLE" ||
              (node as Element).querySelector?.("article"),
          );

          if (addedArticles || removedArticles) {
            articlesChanged = true;
            break;
          }
        }
      }

      if (articlesChanged) {
        console.log(
          "Articles changed (language switch detected), re-rendering calendar.",
        );
        attemptRenderCalendar();
      }
    });

    observer.observe(activeSection, {
      childList: true,
      subtree: true,
    });
  }
}

// Listen for storage changes to reload calendar when settings change
browserAPI.storage.onChanged.addListener(
  (changes: Record<string, any>, areaName: string) => {
    if (areaName === "sync" && changes.linkType) {
      console.log(
        "Settings changed, reloading calendar. New value:",
        changes.linkType.newValue,
      );
      attemptRenderCalendar();
    }
  },
);

attemptRenderCalendar();
setupClickListener();
observeTabChanges();
observeLanguageChanges();
