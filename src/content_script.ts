import { Calendar } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import "./styles.css";

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

// Function to extract exam data from the page
function extractExamData(): Exam[] {
  const articles = document.querySelectorAll("article");

  articles.forEach((card) => {
    const title = card.querySelector("section div.mb-1")?.textContent?.trim();
    const dates = Array.from(
      card.querySelectorAll("section > div:not(div:nth-child(1))")
    )
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
      .toUpperCase()
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
    exam.shots?.some((shot) => shot.enrolled)
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
    '.p-tabview-panel:not([aria-hidden="true"])'
  );

  if (activeSection) {
    let exportButton = activeSection.querySelector("#export-ics-button");
    if (!exportButton) {
      exportButton = document.createElement("button");
      exportButton.id = "export-ics-button";
      exportButton.textContent = "Export exams you registered for as ICS";

      const buttonElement = exportButton as HTMLElement;
      buttonElement.classList.add("p-button", "p-component");
      buttonElement.style.margin = "10px";

      exportButton.addEventListener("click", generateICS);
      activeSection.appendChild(exportButton);
    }
  }
}

// Load settings from storage
async function loadSettings(): Promise<Settings> {
  const result = await browser.storage.sync.get({
    linkType: "exam-article",
  });
  return result as Settings;
}

// Modify the script to continuously attempt rendering until the active tab is found
function attemptRenderCalendar() {
  exams.length = 0;
  extractExamData();
  const activeSection = document.querySelector(
    '.p-tabview-panel:not([aria-hidden="true"])'
  );

  exams.some((exam) => exam.shots.some((shot) => shot.enrolled))
    ? addExportButton()
    : activeSection?.appendChild(
        Object.assign(document.createElement("p"), {
          textContent: "No exam enrollments found.",
        })
      );

  if (activeSection) {
    let calendarElement = activeSection.querySelector("#calendar");
    if (!calendarElement) {
      calendarElement = document.createElement("div");
      calendarElement.id = "calendar";
      activeSection.appendChild(calendarElement);
    } else {
      calendarElement.innerHTML = "";
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
      })
    );

    if (calendar) {
      calendar.destroy(); // Destroy the previous calendar instance
    }

    calendar = new Calendar(calendarElement as HTMLElement, {
      plugins: [dayGridPlugin, listPlugin],
      initialView: "dayGridMonth",
      initialDate: exams.length > 0 ? exams[0].shots[0].date : new Date(),
      events,

      views: {
        dayGridMonth: {
          titleFormat: { year: "numeric", month: "long" },
          dayHeaderFormat: { weekday: "long" },
        },
        listWeek: {
          titleFormat: { year: "numeric", month: "long" },
          dayHeaderFormat: { weekday: "long" },
        },
      },

      headerToolbar: {
        right: "prev,next today",
        center: "title",
        left: "dayGridMonth,listWeek",
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
      attemptRenderCalendar();
    });
  });
}

attemptRenderCalendar();
