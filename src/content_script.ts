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
  awaitingResults: boolean;
  result?: number;
  resultStatus?: string;
  rejectionDeadline?: Date;
  rejectable?: boolean;
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
  const activeTabIndex = Array.from(
    document.querySelectorAll(".p-tabview-nav li"),
  ).findIndex((tab) => tab.classList.contains("p-highlight"));

  let articles: NodeListOf<Element>;

  articles = document.querySelectorAll("article");

  articles.forEach((card, index) => {
    const titleQuerySelector =
      activeTabIndex === 0 ? "section div.pj-mb-1" : "div.mb-3";
    const dateQuerySelector =
      activeTabIndex === 0
        ? "section > div:not(div:nth-child(1))"
        : activeTabIndex === 2
          ? "article.pj-item-card-wide section div.pt-1"
          : "div:not(div:nth-child(1))";
    const iconsSelector =
      activeTabIndex === 0
        ? "section > div:not(div:nth-child(1)) i"
        : activeTabIndex === 2
          ? "article.pj-item-card-wide section div.pt-1 i"
          : "div:not(div:nth-child(1)) i";

    const title = card.querySelector(titleQuerySelector)?.textContent?.trim();
    const dates = Array.from(card.querySelectorAll(dateQuerySelector))
      .map((dateElement) => parseDate(dateElement.textContent?.trim()))
      .filter((date) => date !== null);

    const icons = Array.from(card.querySelectorAll(iconsSelector));

    // Check for "awaiting results" status
    // In first tab: check for p-chip-text with "In attesa di esito" or "awaiting results"
    // In third tab (index 2): all exams are awaiting results
    const chipTexts = Array.from(card.querySelectorAll(".p-chip-text"));
    const awaitingResultsInTab = activeTabIndex === 2; // Third tab (esiti/results)

    const dateElements = Array.from(card.querySelectorAll(dateQuerySelector));

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
        shots: dates.map((date, i) => {
          const enrolled = icons[i]
            ?.getAttribute("class")
            ?.includes("pmi-line-check-circle")
            ? true
            : false;

          // Check if this specific shot is awaiting results
          let awaitingResults = awaitingResultsInTab;
          if (!awaitingResults && activeTabIndex === 0 && dateElements[i]) {
            // In first tab, check the chip text associated with this date
            const dateElement = dateElements[i] as HTMLElement;
            const chipText =
              dateElement
                .querySelector(".p-chip-text")
                ?.textContent?.toLowerCase() || "";
            awaitingResults =
              chipText.includes("in attesa di esito") ||
              chipText.includes("awaiting results");
          }

          // Parse result information
          let result: number | undefined;
          let resultStatus: string | undefined;
          let rejectionDeadline: Date | undefined;
          let rejectable: boolean | undefined;

          const dateElement = dateElements[i] as HTMLElement;

          // Look for result score - search in parent context since result grid is a sibling
          // The structure is: date div, then sibling div.ml-4.mt-2 with the grid containing result
          let parentSection =
            dateElement.closest("section") || dateElement.parentElement;

          // In tab2, dateElements are nested deeper
          if (activeTabIndex === 2) {
            parentSection = dateElement.closest("article.pj-item-card-wide");
          }

          if (parentSection) {
            // Find all .pj-big-letters in the parent and try to match with our date
            // For simplicity, look for the next sibling with ml-4 class after the date element
            let nextSibling = dateElement.nextElementSibling;

            // In tab2, the result grid is also a sibling
            if (activeTabIndex === 2) {
              nextSibling =
                dateElement.closest("div.pt-1")?.nextElementSibling || null;
            }

            // In tab0, look for sibling that contains ml-4 class
            if (activeTabIndex === 0) {
              // In tab0, dateElement is div.mt-1, we need to find div.pt-1 inside it first
              const dateInfoDiv = dateElement.querySelector("div.pt-1");
              if (dateInfoDiv) {
                // Now look for sibling with ml-4 class
                let sibling = dateInfoDiv.nextElementSibling;
                while (sibling && !sibling.classList.contains("ml-4")) {
                  sibling = sibling.nextElementSibling;
                }
                nextSibling = sibling;
              }
            } else {
              // For other tabs, keep original logic
              while (nextSibling && !nextSibling.classList.contains("ml-4")) {
                nextSibling = nextSibling.nextElementSibling;
              }
            }

            if (nextSibling) {
              // Look for result score in the grid
              const resultElement =
                nextSibling.querySelector(".pj-big-letters");
              if (resultElement) {
                const resultText = resultElement.textContent?.trim();
                if (resultText && !isNaN(parseInt(resultText))) {
                  result = parseInt(resultText);
                  console.log(
                    `Found result ${result} for ${title} in tab${activeTabIndex}`,
                  );
                }
              }

              // Look for "Rejectable" text (first tab)
              const rejectableText =
                nextSibling.textContent?.toLowerCase() || "";
              if (
                rejectableText.includes("rejectable") ||
                rejectableText.includes("rifiutabile")
              ) {
                rejectable = true;
              }

              // Look for status - PUBBLICATO/PUBLISHED means it's not awaiting anymore
              const statusDiv = nextSibling.querySelector(".capital-letter");
              if (statusDiv) {
                resultStatus = statusDiv.textContent?.trim();
                const statusText = resultStatus?.toLowerCase() || "";
                if (
                  statusText.includes("pubblicato") ||
                  statusText.includes("published")
                ) {
                  // Result is published, not awaiting
                  awaitingResults = false;
                }
              }
            }
          }

          // If we found a result in tab0 and it's rejectable, it's published (not awaiting)
          if (activeTabIndex === 0 && result !== undefined && rejectable) {
            awaitingResults = false;
          }

          // Look for rejection deadline (tab2 or tab0 with results)
          if (
            activeTabIndex === 2 ||
            (activeTabIndex === 0 && result !== undefined)
          ) {
            const dateElem = dateElements[i] as HTMLElement;
            let searchContext =
              dateElem.closest("section") || dateElem.parentElement;

            if (activeTabIndex === 2) {
              searchContext = dateElem.closest("article.pj-item-card-wide");
            }

            const rejectionSection = searchContext?.querySelector(
              ".col-6.pj-pt-content, .pj-pt-content",
            );
            if (rejectionSection) {
              const deadlineText = rejectionSection.textContent;
              const deadlineMatch = deadlineText?.match(
                /(\d{1,2})\s*([A-Z]{3})\s*(\d{4})\s*(\d{2}):(\d{2})/i,
              );
              if (deadlineMatch) {
                const [_, day, month, year, hour, minute] = deadlineMatch;
                const parsedDate = parseDate(`${day}${month}${year}`);
                if (parsedDate) {
                  rejectionDeadline = new Date(parsedDate);
                  rejectionDeadline.setHours(parseInt(hour), parseInt(minute));
                }
              }
            }
          }

          return {
            date,
            enrolled,
            awaitingResults,
            result,
            resultStatus,
            rejectionDeadline,
            rejectable,
          };
        }),
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

  // Build month arrays for both Italian and English
  const italianMonths = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1)
      .toLocaleString("it-IT", { month: "short" })
      .toUpperCase(),
  );
  const englishMonths = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1)
      .toLocaleString("en-US", { month: "short" })
      .toUpperCase(),
  );

  const monthUpper = monthStr.toUpperCase();
  let month = italianMonths.indexOf(monthUpper);
  if (month === -1) {
    month = englishMonths.indexOf(monthUpper);
  }
  if (month === -1) return null;

  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
}

let calendar: Calendar | null = null;
let renderTimeout: number | null = null;

// Debounced version of attemptRenderCalendar to prevent excessive re-renders
function debouncedRenderCalendar() {
  if (renderTimeout) {
    clearTimeout(renderTimeout);
  }
  renderTimeout = window.setTimeout(() => {
    attemptRenderCalendar();
    renderTimeout = null;
  }, 150);
}

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

// Add legend below calendar
function addLegend(activeSection: Element, events: any[]) {
  let legendElement = activeSection.querySelector("#calendar-legend");

  if (!legendElement) {
    legendElement = document.createElement("div");
    legendElement.id = "calendar-legend";
    (legendElement as HTMLElement).style.cssText = `
      margin: 10px 10px 10px 10px;
      padding: 10px;
      border: 1px solid var(--bg-secondary-dark, #ccc);
      border-radius: var(--border-radius, 4px);
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      align-items: center;
      max-width: calc(100% - 20px);
      box-sizing: border-box;
    `;
    activeSection.appendChild(legendElement);
  }

  // Sort events by date to get the display order
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  // Get unique colors in the order they appear in sorted events
  const colorMap = new Map<string, string>();

  sortedEvents.forEach((event) => {
    const color = event.color;
    if (!colorMap.has(color)) {
      let label = "";
      if (color === "#D32F2F") {
        label =
          detectLanguage() === "it" ? "Scadenza rifiuto" : "Rejection deadline";
      } else if (color === "#9C27B0") {
        label =
          detectLanguage() === "it" ? "Esito pubblicato" : "Published result";
      } else if (color === "#B8860B") {
        label =
          detectLanguage() === "it" ? "In attesa di esito" : "Awaiting results";
      } else if (color === "#4CAF50") {
        label = detectLanguage() === "it" ? "Iscritto" : "Enrolled";
      } else if (color === "#2196F3") {
        label = detectLanguage() === "it" ? "Non iscritto" : "Not enrolled";
      }
      colorMap.set(color, label);
    }
  });

  // Build legend HTML
  let legendHTML =
    '<strong style="margin-right: 10px;">' +
    (detectLanguage() === "it" ? "Legenda:" : "Legend:") +
    "</strong>";

  colorMap.forEach((label, color) => {
    legendHTML += `
      <div style="display: flex; align-items: center; gap: 5px;">
        <div style="
          width: 16px;
          height: 16px;
          background-color: ${color};
          border-radius: 2px;
        "></div>
        <span>${label}</span>
      </div>
    `;
  });

  legendElement.innerHTML = legendHTML;
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
  try {
    const result = await browserAPI.storage.sync.get("linkType");

    // Return exam-article as default if not set, but don't save it
    // This allows the calendar to work while keeping the notification dot
    const linkType =
      (result.linkType as "anxious-display" | "exam-article") || "exam-article";

    return { linkType };
  } catch (error) {
    console.error("Error loading settings, using default:", error);
    return { linkType: "exam-article" };
  }
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

    const now = new Date();
    now.setHours(0, 0, 0, 0); // Set to start of today

    const events = exams.flatMap((exam) =>
      exam.shots
        .filter((shot) => {
          // Include future exams, or past exams that have results or are awaiting results
          const isPast = shot.date < now;
          return !isPast || shot.awaitingResults || shot.result !== undefined;
        })
        .flatMap((shot, i) => {
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

          // Determine color:
          // - Purple for published results (has result but not awaiting)
          // - Dark yellow for awaiting results
          // - Green for enrolled (future exams)
          // - Blue for others
          let color = "#2196F3"; // Default blue
          if (shot.result !== undefined && !shot.awaitingResults) {
            color = "#9C27B0"; // Purple for published results
          } else if (shot.awaitingResults) {
            color = "#B8860B"; // Dark goldenrod (awaiting results)
          } else if (shot.enrolled) {
            color = "#4CAF50"; // Green for enrolled
          }

          // Add result to title if available
          let displayTitle = exam.title;
          if (shot.result !== undefined) {
            displayTitle += ` - ${shot.result}`;
            if (shot.rejectable) {
              displayTitle += " (Rejectable)";
            }
          }

          const mainEvent = {
            title: displayTitle,
            start: shot.date.toISOString(),
            color: color,
            allDay: true,
            url: eventUrl,
            extendedProps: {
              articleIndex: exam.articleIndex,
              result: shot.result,
              rejectable: shot.rejectable,
              awaitingResults: shot.awaitingResults,
            } as any,
          };

          // Add rejection deadline event if available (from tab2)
          const eventsToReturn = [mainEvent];
          if (shot.rejectionDeadline && shot.rejectable) {
            const lang = detectLanguage();
            const deadlineTitle = `${exam.title}`;

            // Create end time 15 minutes after start
            const endTime = new Date(shot.rejectionDeadline);
            endTime.setMinutes(endTime.getMinutes() + 15);

            eventsToReturn.push({
              title: deadlineTitle,
              start: shot.rejectionDeadline.toISOString(),
              end: endTime.toISOString(),
              color: "#D32F2F", // Red for deadline
              allDay: false,
              url: eventUrl,
              extendedProps: {
                articleIndex: exam.articleIndex,
                isDeadline: true,
              },
            } as any);
          }

          return eventsToReturn;
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
          listDayFormat: {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          },
          listDaySideFormat: false,
          noEventsContent:
            currentLang === "it"
              ? "Nessun esame da visualizzare"
              : "No exams to display",
        },
      },

      headerToolbar: {
        right: "prev,next today",
        center: "title",
        left: "dayGridMonth,listMonth",
      },
    });
    calendar.render();

    // Add legend below calendar
    addLegend(activeSection, events);

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
        debouncedRenderCalendar();
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
            debouncedRenderCalendar();
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
        debouncedRenderCalendar();
      }
    });

    observer.observe(activeSection, {
      childList: true,
      subtree: true,
    });
  }
}

// Observe URL/navigation changes for SPA navigation
function observeNavigation() {
  // Watch for URL changes (back/forward navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log("URL changed, re-rendering calendar.");
      debouncedRenderCalendar();
    }
  }).observe(document, { subtree: true, childList: true });

  // Also listen for popstate events (browser back/forward)
  window.addEventListener("popstate", () => {
    console.log("Navigation detected (popstate), re-rendering calendar.");
    debouncedRenderCalendar();
  });

  // Listen for pushstate/replacestate
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    console.log("Navigation detected (pushState), re-rendering calendar.");
    debouncedRenderCalendar();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    console.log("Navigation detected (replaceState), re-rendering calendar.");
    debouncedRenderCalendar();
  };
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
observeNavigation();
