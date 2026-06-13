import { Calendar, EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import itLocale from "@fullcalendar/core/locales/it";
import "./styles.css";

// ============================================================================
// Types and Interfaces
// ============================================================================

interface Exam {
  title: string;
  shots: ExamShot[];
  articleUrl?: string;
  articleIndex: number;
}

interface ExamShot {
  date: Date;
  hasTime: boolean;
  room?: string;
  enrolled: boolean;
  awaitingResults: boolean;
  result?: number;
  resultStatus?: string;
  rejectionDeadline?: Date;
  rejectable?: boolean;
}

interface Settings {
  linkType: "anxious-display" | "exam-article" | "download-ics";
}

type Language = "en" | "it";

interface CalendarEvent extends EventInput {
  extendedProps?: {
    articleIndex: number;
    result?: number;
    rejectable?: boolean;
    awaitingResults?: boolean;
    isDeadline?: boolean;
    room?: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const browserAPI = (
  typeof chrome !== "undefined" && chrome.storage ? chrome : browser
) as typeof browser;

const exams: Exam[] = [];

const translations = {
  en: {
    exportButton: "Export exams you registered for as ICS",
    exportAnxiousDisplay: "Export exams you registered for to Anxious Display",
    noEnrollments: "No exam enrollments found.",
    legend: "Legend:",
    rejectionDeadline: "Rejection deadline",
    publishedResult: "Published result",
    awaitingResults: "Awaiting results",
    enrolled: "Enrolled",
    notEnrolled: "Not enrolled",
    noExamsToDisplay: "No exams to display",
    confirmDownloadTitle: "Download Exam Calendar Event",
    confirmDownloadMessage: "Do you want to download the ICS file for this exam?",
  },
  it: {
    exportButton: "Esporta gli esami a cui sei iscritto come ICS",
    exportAnxiousDisplay: "Esporta gli esami a cui sei iscritto in Anxious Display",
    noEnrollments: "Nessuna iscrizione all'esame trovata.",
    legend: "Legenda:",
    rejectionDeadline: "Scadenza rifiuto",
    publishedResult: "Esito pubblicato",
    awaitingResults: "In attesa di esito",
    enrolled: "Iscritto",
    notEnrolled: "Non iscritto",
    noExamsToDisplay: "Nessun esame da visualizzare",
    confirmDownloadTitle: "Scarica Evento Esame",
    confirmDownloadMessage: "Vuoi scaricare il file ICS per questo esame?",
  },
} as const;

const EVENT_COLORS = {
  PUBLISHED: "#9C27B0",
  AWAITING: "#B8860B",
  ENROLLED: "#4CAF50",
  NOT_ENROLLED: "#2196F3",
  DEADLINE: "#D32F2F",
} as const;

let calendar: Calendar | null = null;
let renderTimeout: number | null = null;
const hiddenColors = new Set<string>();

// ============================================================================
// Utility Functions
// ============================================================================

function detectLanguage(): Language {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button.pj-link-button"),
  );

  for (const button of buttons) {
    const text = button.textContent?.trim().toUpperCase();
    if (text === "EN" || text === "IT") {
      return text === "EN" ? "it" : "en";
    }
  }

  const pageText = document.body.textContent || "";
  return pageText.includes("Iscrizioni") || pageText.includes("Appelli")
    ? "it"
    : "en";
}

function t(key: keyof typeof translations.en): string {
  const lang = detectLanguage();
  return translations[lang][key];
}

function parseDate(dateText: string | undefined): Date | null {
  if (!dateText) return null;

  const match = dateText.match(/(\d{1,2})([A-Z]{3})(\d{4})/i);
  if (!match) return null;

  const [_, dayStr, monthStr, yearStr] = match;
  const day = Number(dayStr);
  const year = Number(yearStr);

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

function parseDateWithTime(
  dateText: string | undefined,
  detailText?: string | null,
): { date: Date; hasTime: boolean; room?: string } | null {
  if (!dateText) return null;

  const dateResult = parseDate(dateText);
  if (!dateResult) return null;

  let hasTime = false;
  let room: string | undefined;

  // Use detail text (from .pj-pr-content element) if available, otherwise fall back to date text
  const textForTimeRoom = detailText || dateText;

  // Try to extract time from "Ora: HH:MM" / "Time: HH:MM" or standalone HH:MM
  const timeMatch = textForTimeRoom.match(/(?:Ora|Time)\s*:\s*(\d{1,2}):(\d{2})/i)
    || textForTimeRoom.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[timeMatch.length - 2]);
    const minutes = parseInt(timeMatch[timeMatch.length - 1]);
    dateResult.setHours(hours, minutes, 0, 0);
    hasTime = true;
  }

  // Try to extract room from "Aula: ..." / "Room: ..." / "Classroom: ..."
  const roomMatch = textForTimeRoom.match(/(?:Aula|Room|Classroom)\s*:\s*([\s\S]+)/i);
  if (roomMatch) {
    room = roomMatch[1].trim();
  }

  return { date: dateResult, hasTime, room };
}

function getActiveTabIndex(): number {
  return Array.from(document.querySelectorAll(".p-tabview-nav li")).findIndex(
    (tab) => tab.classList.contains("p-highlight"),
  );
}

function getActiveSection(): Element | null {
  return document.querySelector('.p-tabview-panel:not([aria-hidden="true"])');
}

function getTodayAtMidnight(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

// ============================================================================
// Data Extraction Functions
// ============================================================================

function getQuerySelectors(activeTabIndex: number) {
  return {
    title: activeTabIndex === 0 ? "section div.pj-mb-1" : "div.mb-3",
    date:
      activeTabIndex === 0
        ? "section > div:not(div:nth-child(1))"
        : activeTabIndex === 1 || activeTabIndex === 2
          ? "article.pj-item-card-wide section div.pt-1"
          : "div:not(div:nth-child(1))",
    icons:
      activeTabIndex === 0
        ? "section > div:not(div:nth-child(1)) i"
        : activeTabIndex === 1 || activeTabIndex === 2
          ? "article.pj-item-card-wide section div.pt-1 i"
          : "div:not(div:nth-child(1)) i",
  };
}

function findResultSibling(
  dateElement: HTMLElement,
  activeTabIndex: number,
): Element | null {
  if (activeTabIndex === 2) {
    return dateElement.closest("div.pt-1")?.nextElementSibling || null;
  }

  if (activeTabIndex === 0) {
    const dateInfoDiv = dateElement.querySelector("div.pt-1");
    if (dateInfoDiv) {
      let sibling = dateInfoDiv.nextElementSibling;
      while (sibling && !sibling.classList.contains("ml-4")) {
        sibling = sibling.nextElementSibling;
      }
      return sibling;
    }
    return null;
  }

  let sibling = dateElement.nextElementSibling;
  while (sibling && !sibling.classList.contains("ml-4")) {
    sibling = sibling.nextElementSibling;
  }
  return sibling;
}

function parseResultInfo(resultSibling: Element): {
  result?: number;
  rejectable?: boolean;
  resultStatus?: string;
} {
  let result: number | undefined;
  let rejectable: boolean | undefined;
  let resultStatus: string | undefined;

  const resultElement = resultSibling.querySelector(".pj-big-letters");
  if (resultElement) {
    const resultText = resultElement.textContent?.trim();
    if (resultText && !isNaN(parseInt(resultText))) {
      result = parseInt(resultText);
    }
  }

  const rejectableText = resultSibling.textContent?.toLowerCase() || "";
  if (
    rejectableText.includes("rejectable") ||
    rejectableText.includes("rifiutabile")
  ) {
    rejectable = true;
  }

  const statusDiv = resultSibling.querySelector(".capital-letter");
  if (statusDiv) {
    resultStatus = statusDiv.textContent?.trim();
  }

  return { result, rejectable, resultStatus };
}

function parseRejectionDeadline(
  searchContext: Element | null,
): Date | undefined {
  if (!searchContext) return undefined;

  const rejectionSection = searchContext.querySelector(
    ".col-6.pj-pt-content, .pj-pt-content",
  );
  if (!rejectionSection) return undefined;

  const deadlineText = rejectionSection.textContent;
  const deadlineMatch = deadlineText?.match(
    /(\d{1,2})\s*([A-Z]{3})\s*(\d{4})\s*(\d{2}):(\d{2})/i,
  );
  if (!deadlineMatch) return undefined;

  const [_, day, month, year, hour, minute] = deadlineMatch;
  const parsedDate = parseDate(`${day}${month}${year}`);
  if (!parsedDate) return undefined;

  const deadline = new Date(parsedDate);
  deadline.setHours(parseInt(hour), parseInt(minute));
  return deadline;
}

function parseExamShot(
  date: Date,
  index: number,
  dateElements: Element[],
  icons: Element[],
  activeTabIndex: number,
  awaitingResultsInTab: boolean,
  title: string,
): ExamShot {
  const enrolled =
    activeTabIndex === 1 ||
    (icons[index]?.getAttribute("class")?.includes("pmi-line-check-circle") ??
      false);

  let awaitingResults = awaitingResultsInTab;
  const dateElement = dateElements[index] as HTMLElement;

  // Check chip text for awaiting status in tab0
  if (!awaitingResults && activeTabIndex === 0) {
    const chipText =
      dateElement.querySelector(".p-chip-text")?.textContent?.toLowerCase() ||
      "";
    awaitingResults =
      chipText.includes("in attesa di esito") ||
      chipText.includes("awaiting results");
  }

  let result: number | undefined;
  let resultStatus: string | undefined;
  let rejectable: boolean | undefined;
  let rejectionDeadline: Date | undefined;

  // Find and parse result information
  const resultSibling = findResultSibling(dateElement, activeTabIndex);
  if (resultSibling) {
    const resultInfo = parseResultInfo(resultSibling);
    result = resultInfo.result;
    rejectable = resultInfo.rejectable;
    resultStatus = resultInfo.resultStatus;

    if (result !== undefined) {
      console.log(
        `Found result ${result} for ${title} in tab${activeTabIndex}`,
      );
    }

    // Check if result is published
    const statusText = resultStatus?.toLowerCase() || "";
    if (statusText.includes("pubblicato") || statusText.includes("published")) {
      awaitingResults = false;
    }
  }

  // Special case: result with rejectable in tab0 means it's published
  if (activeTabIndex === 0 && result !== undefined && rejectable) {
    awaitingResults = false;
  }

  // Parse rejection deadline if applicable
  if (activeTabIndex === 2 || (activeTabIndex === 0 && result !== undefined)) {
    let searchContext =
      dateElement.closest("section") || dateElement.parentElement;
    if (activeTabIndex === 2) {
      searchContext = dateElement.closest("article.pj-item-card-wide");
    }
    rejectionDeadline = parseRejectionDeadline(searchContext);
  }

  return {
    date,
    hasTime: false,
    enrolled,
    awaitingResults,
    result,
    resultStatus,
    rejectionDeadline,
    rejectable,
  };
}

function extractExamData(): Exam[] {
  const activeTabIndex = getActiveTabIndex();
  const articles = document.querySelectorAll("article");
  const selectors = getQuerySelectors(activeTabIndex);
  const awaitingResultsInTab = activeTabIndex === 2;

  articles.forEach((card, index) => {
    const title = card.querySelector(selectors.title)?.textContent?.trim();
    const dateTimeResults = Array.from(card.querySelectorAll(selectors.date))
      .map((el) => {
        // Look for the detail element (.pj-pr-content) containing time/room info
        // It may be a sibling or child within the closest .pt-1 container
        const container = el.closest('.pt-1') || el.parentElement;
        const detailEl = container?.querySelector('.pj-pr-content')
          || el.querySelector('.pj-pr-content');
        return parseDateWithTime(
          el.textContent?.trim(),
          detailEl?.textContent?.trim(),
        );
      })
      .filter(
        (result): result is { date: Date; hasTime: boolean; room?: string } =>
          result !== null,
      );

    const icons = Array.from(card.querySelectorAll(selectors.icons));
    const dateElements = Array.from(card.querySelectorAll(selectors.date));
    const mainLink = card.querySelector<HTMLAnchorElement>("a[href]");

    if (title && dateTimeResults.length > 0) {
      exams.push({
        title,
        articleUrl: mainLink?.href,
        articleIndex: index,
        shots: dateTimeResults.map((dt, i) => {
          const shot = parseExamShot(
            dt.date,
            i,
            dateElements,
            icons,
            activeTabIndex,
            awaitingResultsInTab,
            title,
          );
          shot.hasTime = dt.hasTime;
          shot.room = dt.room;
          return shot;
        }),
      });
    }
  });

  return exams;
}

// ============================================================================
// Event Creation Functions
// ============================================================================

function getEventColor(shot: ExamShot): string {
  if (shot.result !== undefined && !shot.awaitingResults) {
    return EVENT_COLORS.PUBLISHED;
  }
  if (shot.awaitingResults) {
    return EVENT_COLORS.AWAITING;
  }
  if (shot.enrolled) {
    return EVENT_COLORS.ENROLLED;
  }
  return EVENT_COLORS.NOT_ENROLLED;
}

function createEventUrl(
  exam: Exam,
  shot: ExamShot,
  settings: Settings,
): string {
  if (settings.linkType === "exam-article") {
    return `#article-${exam.articleIndex}`;
  }

  const url = [
    {
      title: exam.title,
      description: "imported from polimi-exam-calendar",
      date: shot.date.toISOString(),
    },
  ];
  return (
    "https://the-anxious-display.vercel.app/?countdowns=" +
    btoa(JSON.stringify(url))
  );
}

function createMainEvent(
  exam: Exam,
  shot: ExamShot,
  settings: Settings,
): CalendarEvent {
  const eventUrl = createEventUrl(exam, shot, settings);
  const color = getEventColor(shot);

  let displayTitle = exam.title;
  if (shot.result !== undefined) {
    displayTitle += ` - ${shot.result}`;
    if (shot.rejectable) {
      displayTitle += " (Rejectable)";
    }
  }

  const event: CalendarEvent = {
    title: displayTitle,
    start: shot.date.toISOString(),
    color,
    allDay: !shot.hasTime,
    url: eventUrl,
    extendedProps: {
      articleIndex: exam.articleIndex,
      result: shot.result,
      rejectable: shot.rejectable,
      awaitingResults: shot.awaitingResults,
      room: shot.room || "",
    },
  };

  // For timed events, add a 2-hour duration
  if (shot.hasTime) {
    const endTime = new Date(shot.date.getTime() + 7200000);
    event.end = endTime.toISOString();
  }

  return event;
}

function createDeadlineEvent(
  exam: Exam,
  shot: ExamShot,
  eventUrl: string,
): CalendarEvent {
  const endTime = new Date(shot.rejectionDeadline!);
  endTime.setMinutes(endTime.getMinutes() + 15);

  return {
    title: exam.title,
    start: shot.rejectionDeadline!.toISOString(),
    end: endTime.toISOString(),
    color: EVENT_COLORS.DEADLINE,
    allDay: false,
    url: eventUrl,
    extendedProps: {
      articleIndex: exam.articleIndex,
      isDeadline: true,
    },
  };
}

function createCalendarEvents(settings: Settings): CalendarEvent[] {
  const now = getTodayAtMidnight();

  return exams.flatMap((exam) =>
    exam.shots
      .filter((shot) => {
        const isPast = shot.date < now;
        return !isPast || shot.awaitingResults || shot.result !== undefined;
      })
      .flatMap((shot) => {
        const mainEvent = createMainEvent(exam, shot, settings);
        const events: CalendarEvent[] = [mainEvent];

        if (shot.rejectionDeadline && shot.rejectable) {
          const eventUrl = createEventUrl(exam, shot, settings);
          events.push(createDeadlineEvent(exam, shot, eventUrl));
        }

        return events;
      }),
  );
}

// ============================================================================
// Calendar UI Functions
// ============================================================================

function setupCalendarElement(activeSection: Element): HTMLElement {
  let calendarElement = activeSection.querySelector<HTMLElement>("#calendar");

  if (!calendarElement) {
    calendarElement = document.createElement("div");
    calendarElement.id = "calendar";
    activeSection.appendChild(calendarElement);
  } else {
    calendarElement.innerHTML = "";
    activeSection.appendChild(calendarElement);
  }

  return calendarElement;
}

function createCalendarConfig(
  events: CalendarEvent[],
  settings: Settings,
  currentLang: Language,
): any {
  const activeTabIndex = getActiveTabIndex();
  const customItLocale =
    currentLang === "it"
      ? {
          code: "it",
          week: { dow: 1, doy: 4 },
          buttonText: {
            ...itLocale.buttonText,
            timeGridWeek: "Settimana",
          },
          weekText: itLocale.weekText,
          allDayText: itLocale.allDayText,
          moreLinkText: itLocale.moreLinkText,
          noEventsText: itLocale.noEventsText,
        }
      : undefined;

  const initialDate = exams.length > 0 ? exams[0].shots[0].date : new Date();

  return {
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin],
    initialView: "dayGridMonth",
    initialDate: initialDate,
    locale: customItLocale || currentLang,
    height: 580,
    buttonText: {
      timeGridWeek: currentLang === "it" ? "Settimana" : "Week",
    },
    events,
    eventClick: (info: any) => handleEventClick(info, settings),
    eventDidMount: (info: any) => {
      const color = info.event.backgroundColor || info.event.borderColor;
      if (color) {
        info.el.style.setProperty("--fc-event-border-color", color);
        info.el.style.setProperty("--fc-event-bg-color", color);
      }
    },
    eventContent: (arg: any) => {
      const timeText = arg.timeText;
      const title = arg.event.title;
      const rawRoom = arg.event.extendedProps?.room || "";

      // Helper to format/sanitize the room badge text
      const getRoomDisplay = (text: string): string => {
        const val = text.trim();
        const normalized = val.toLowerCase();
        if (
          !normalized ||
          normalized.includes("non ancora disponibili") ||
          normalized.includes("not yet available") ||
          normalized.includes("non disponibile") ||
          normalized.includes("n.d.") ||
          normalized === "nd"
        ) {
          return "";
        }
        if (val.length > 10) {
          return "Info";
        }
        return val;
      };

      const room = getRoomDisplay(rawRoom);

      const container = document.createElement("div");
      container.classList.add("fc-event-custom-container");

      if (timeText) {
        const timeEl = document.createElement("span");
        timeEl.classList.add("fc-event-time");
        timeEl.textContent = timeText;
        container.appendChild(timeEl);
      }

      const titleEl = document.createElement("span");
      titleEl.classList.add("fc-event-title");
      titleEl.textContent = title;
      container.appendChild(titleEl);

      if (room) {
        const roomEl = document.createElement("span");
        roomEl.classList.add("fc-event-room");
        roomEl.textContent = room;
        container.appendChild(roomEl);
      }

      return { domNodes: [container] };
    },
    views: {
      dayGridMonth: {
        titleFormat: (date: any) => formatMonthTitle(date, currentLang),
        dayHeaderFormat: { weekday: "long" },
      },
      timeGridWeek: {
        type: "timeGrid",
        duration: { days: 7 },
        dateAlignment: "day",
        dateIncrement: { days: 1 },
        dayHeaderFormat: { weekday: "short", day: "numeric" },
        slotMinTime: "08:00:00",
        slotMaxTime: "21:00:00",
        allDaySlot: true,
        slotDuration: "01:00:00",
        expandRows: true,
      },
      listMonth: {
        listDayFormat: {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        },
        listDaySideFormat: false,
        noEventsContent: t("noExamsToDisplay"),
      },
    },
    headerToolbar: {
      right: "prev,next today",
      center: "title",
      left: (activeTabIndex === 1 || activeTabIndex === 2) ? "dayGridMonth,timeGridWeek,listMonth" : "dayGridMonth,listMonth",
    },
  };
}

function formatMonthTitle(date: any, lang: Language): string {
  const month = date.date.marker.toLocaleDateString(lang, { month: "long" });
  const year = date.date.marker.getFullYear();
  const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
  return `${capitalizedMonth} ${year}`;
}

function formatIcsDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const mm = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

function formatIcsAllDayDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  return `${y}${m}${d}`;
}

function downloadSingleIcs(event: any): void {
  const title = event.title;
  const start = event.start;
  let end = event.end;
  const allDay = event.allDay;
  const room = event.extendedProps?.room || "";

  if (!end) {
    if (allDay) {
      end = new Date(start.getTime() + 86400000);
    } else {
      end = new Date(start.getTime() + 7200000); // 2 hours
    }
  }

  const dtstamp = formatIcsDate(new Date());
  let dtstartStr = "";
  let dtendStr = "";

  if (allDay) {
    dtstartStr = `DTSTART;VALUE=DATE:${formatIcsAllDayDate(start)}`;
    dtendStr = `DTEND;VALUE=DATE:${formatIcsAllDayDate(end)}`;
  } else {
    dtstartStr = `DTSTART:${formatIcsDate(start)}`;
    dtendStr = `DTEND:${formatIcsDate(end)}`;
  }

  const uid = `polimi-exam-${start.getTime()}-${encodeURIComponent(title)}@polimi.it`;
  const locationLine = room ? `LOCATION:${room}\r\n` : "";

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Polimi Exam Calendar//NONSGML v1.0//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    dtstartStr,
    dtendStr,
    `SUMMARY:${title}`,
    `DESCRIPTION:Polimi Exam calendar entry for ${title}${room ? ' at ' + room : ''}`,
    locationLine.replace(/\r\n$/, ""),
    "END:VEVENT",
    "END:VCALENDAR"
  ].filter(line => line !== "");

  const icsContent = icsLines.join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");
  link.href = url;
  link.download = `${safeTitle}.ics`;
  document.body.appendChild(link);
  link.click();
  
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

function showAteneoConfirmDialog(title: string, message: string, onConfirm: () => void): void {
  const backdrop = document.createElement("div");
  backdrop.className = "ateneo-modal-backdrop";

  const container = document.createElement("div");
  container.className = "ateneo-modal-container";

  const headerEl = document.createElement("div");
  headerEl.className = "ateneo-modal-header";
  headerEl.textContent = title;
  container.appendChild(headerEl);

  const bodyEl = document.createElement("div");
  bodyEl.className = "ateneo-modal-body";
  bodyEl.textContent = message;
  container.appendChild(bodyEl);

  const footerEl = document.createElement("div");
  footerEl.className = "ateneo-modal-footer";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "ateneo-btn ateneo-btn-secondary";
  cancelBtn.textContent = detectLanguage() === "it" ? "Annulla" : "Cancel";
  cancelBtn.addEventListener("click", () => {
    backdrop.classList.remove("show");
    setTimeout(() => backdrop.remove(), 250);
  });
  footerEl.appendChild(cancelBtn);

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "ateneo-btn ateneo-btn-primary";
  confirmBtn.textContent = detectLanguage() === "it" ? "Scarica" : "Download";
  confirmBtn.addEventListener("click", () => {
    onConfirm();
    backdrop.classList.remove("show");
    setTimeout(() => backdrop.remove(), 250);
  });
  footerEl.appendChild(confirmBtn);

  container.appendChild(footerEl);
  backdrop.appendChild(container);
  document.body.appendChild(backdrop);

  // Force reflow
  void backdrop.offsetHeight;
  backdrop.classList.add("show");
}

function handleEventClick(info: any, settings: Settings): void {
  if (settings.linkType === "anxious-display") {
    info.jsEvent.preventDefault();
    if (info.event.url) {
      window.open(info.event.url, "_blank", "noopener,noreferrer");
    }
    return;
  }

  if (settings.linkType === "download-ics") {
    info.jsEvent.preventDefault();
    const eventTitle = info.event.title;
    const confirmTitle = t("confirmDownloadTitle");
    const confirmMsg = `${t("confirmDownloadMessage")}\n\n${eventTitle}`;
    showAteneoConfirmDialog(confirmTitle, confirmMsg, () => {
      downloadSingleIcs(info.event);
    });
    return;
  }

  if (settings.linkType !== "exam-article") return;

  info.jsEvent.preventDefault();
  const articleIndex = info.event.extendedProps.articleIndex;
  const articles = document.querySelectorAll("article");
  const targetArticle = articles[articleIndex];

  if (!targetArticle) return;

  targetArticle.scrollIntoView({ behavior: "smooth", block: "center" });

  const originalBg = window.getComputedStyle(targetArticle).backgroundColor;
  targetArticle.style.transition = "background-color 0.3s";
  targetArticle.style.backgroundColor = "rgba(33, 150, 243, 0.1)";

  setTimeout(() => {
    targetArticle.style.backgroundColor = originalBg;
  }, 2000);
}

function applyColorFilters(navigate = false): void {
  if (!calendar) return;

  let firstVisibleDate: Date | null = null;

  calendar.getEvents().forEach((event) => {
    const color = event.backgroundColor;
    const hidden = hiddenColors.has(color);
    event.setProp("display", hidden ? "none" : "auto");

    if (!hidden && event.start) {
      const d =
        event.start instanceof Date
          ? event.start
          : new Date(event.start as string);
      if (!firstVisibleDate || d < firstVisibleDate) {
        firstVisibleDate = d;
      }
    }
  });

  if (navigate) {
    if (firstVisibleDate) {
      calendar.gotoDate(firstVisibleDate);
    } else {
      calendar.today();
    }
  }
}

function addLegend(activeSection: Element, events: CalendarEvent[]): void {
  let legendElement =
    activeSection.querySelector<HTMLElement>("#calendar-legend");

  if (!legendElement) {
    legendElement = document.createElement("div");
    legendElement.id = "calendar-legend";
  }

  activeSection.appendChild(legendElement);

  const sortedEvents = [...events].sort((a, b) => {
    const aTime = new Date(a.start as string).getTime();
    const bTime = new Date(b.start as string).getTime();
    return aTime - bTime;
  });

  const colorLabelMap = new Map<string, string>([
    [EVENT_COLORS.DEADLINE, t("rejectionDeadline")],
    [EVENT_COLORS.PUBLISHED, t("publishedResult")],
    [EVENT_COLORS.AWAITING, t("awaitingResults")],
    [EVENT_COLORS.ENROLLED, t("enrolled")],
    [EVENT_COLORS.NOT_ENROLLED, t("notEnrolled")],
  ]);

  const uniqueColors = new Map<string, string>();
  sortedEvents.forEach((event) => {
    const color = event.color as string;
    if (!uniqueColors.has(color) && colorLabelMap.has(color)) {
      uniqueColors.set(color, colorLabelMap.get(color)!);
    }
  });

  legendElement.innerHTML = "";

  const legendLabel = document.createElement("strong");
  legendLabel.style.marginRight = "10px";
  legendLabel.textContent = t("legend");
  legendElement.appendChild(legendLabel);

  uniqueColors.forEach((label, color) => {
    const wrapper = document.createElement("label");
    wrapper.className = "legend-filter-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !hiddenColors.has(color);
    checkbox.className = "legend-filter-checkbox";
    checkbox.style.setProperty("--checkbox-color", color);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        hiddenColors.delete(color);
      } else {
        hiddenColors.add(color);
      }
      applyColorFilters(true);
    });

    const span = document.createElement("span");
    span.textContent = label;

    wrapper.appendChild(checkbox);
    wrapper.appendChild(span);
    legendElement!.appendChild(wrapper);
  });

  // Apply any existing filters to the new calendar instance
  applyColorFilters();
}

// ============================================================================
// Export and Settings Functions
// ============================================================================

function generateICS(): void {
  const enrolledExams = exams.filter((exam) =>
    exam.shots.some((shot) => shot.enrolled),
  );

  let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\n";

  enrolledExams.forEach((exam) => {
    exam.shots
      .filter((shot) => shot.enrolled)
      .forEach((shot) => {
        const start = shot.date
          .toISOString()
          .replace(/[-:]/g, "")
          .split(".")[0];
        const end = new Date(shot.date.getTime() + 3600000)
          .toISOString()
          .replace(/[-:]/g, "")
          .split(".")[0];
        icsContent += `BEGIN:VEVENT\nSUMMARY:${exam.title}\nDTSTART:${start}Z\nDTEND:${end}Z\nEND:VEVENT\n`;
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

function exportToAnxiousDisplay(): void {
  const enrolledExams = exams.filter((exam) =>
    exam.shots.some((shot) => shot.enrolled),
  );

  if (enrolledExams.length === 0) {
    alert(t("noEnrollments"));
    return;
  }

  const countdowns = enrolledExams.flatMap((exam) =>
    exam.shots
      .filter((shot) => shot.enrolled)
      .map((shot) => ({
        title: exam.title,
        description: "imported from polimi-exam-calendar",
        date: shot.date.toISOString(),
      })),
  );

  const url =
    "https://the-anxious-display.vercel.app/?countdowns=" +
    btoa(JSON.stringify(countdowns));
  window.open(url, "_blank", "noopener,noreferrer");
}

function addExportButton(): void {
  const activeSection = getActiveSection();
  if (!activeSection) return;

  // Let's create or find the button container
  let container = activeSection.querySelector<HTMLElement>("#calendar-buttons-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "calendar-buttons-container";
    container.style.cssText = `
      display: flex;
      gap: 15px;
      margin: 20px 10px;
      flex-wrap: wrap;
    `;
    activeSection.appendChild(container);
  }

  // ICS export button
  let exportButton =
    container.querySelector<HTMLButtonElement>("#export-ics-button");

  if (!exportButton) {
    exportButton = document.createElement("button");
    exportButton.id = "export-ics-button";
    exportButton.classList.add("p-button", "p-component");
    exportButton.addEventListener("click", generateICS);
    container.appendChild(exportButton);
  }

  exportButton.textContent = t("exportButton");

  // Anxious Display export button
  let anxiousButton =
    container.querySelector<HTMLButtonElement>("#export-anxious-button");

  if (!anxiousButton) {
    anxiousButton = document.createElement("button");
    anxiousButton.id = "export-anxious-button";
    anxiousButton.classList.add("p-button", "p-component");
    anxiousButton.addEventListener("click", exportToAnxiousDisplay);
    container.appendChild(anxiousButton);
  }

  anxiousButton.textContent = t("exportAnxiousDisplay");

  // Force the container to be at the very bottom of activeSection
  activeSection.appendChild(container);
}

async function loadSettings(): Promise<Settings> {
  try {
    const result = await browserAPI.storage.sync.get("linkType");
    const linkType =
      (result.linkType as "anxious-display" | "exam-article" | "download-ics") || "exam-article";
    return { linkType };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("context invalidated") || msg.includes("Context invalidated")) {
      console.warn("Extension context invalidated (extension reloaded). Using default settings.");
    } else {
      console.error("Error loading settings, using default:", error);
    }
    return { linkType: "exam-article" };
  }
}

// ============================================================================
// Main Render Function
// ============================================================================

async function attemptRenderCalendar(): Promise<void> {
  exams.length = 0;
  extractExamData();

  const activeSection = getActiveSection();

  // Add export button if there are enrolled exams
  if (exams.length === 0 || !activeSection) {
    console.log("Active section not found. Retrying in 1 second...");
    setTimeout(attemptRenderCalendar, 1000);
    return;
  }

  const calendarElement = setupCalendarElement(activeSection);
  const settings = await loadSettings();
  const events = createCalendarEvents(settings);
  const currentLang = detectLanguage();

  if (calendar) {
    calendar.destroy();
  }

  const config = createCalendarConfig(events, settings, currentLang);
  calendar = new Calendar(calendarElement, config);
  calendar.render();

  addLegend(activeSection, events);

  // Add or remove export buttons at the very bottom
  const hasEnrolledExams = exams.some((exam) => exam.shots.some((shot) => shot.enrolled));
  if (hasEnrolledExams) {
    addExportButton();
  } else {
    const container = activeSection.querySelector("#calendar-buttons-container");
    if (container) {
      container.remove();
    }
  }

  setupClickListener();
}

function debouncedRenderCalendar(): void {
  if (renderTimeout) {
    clearTimeout(renderTimeout);
  }
  renderTimeout = window.setTimeout(() => {
    attemptRenderCalendar();
    renderTimeout = null;
  }, 150);
}

// ============================================================================
// Event Listeners and Observers
// ============================================================================

function setupClickListener(): void {
  const tabs = document.querySelectorAll(".p-tabview-nav li");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setTimeout(() => {
        debouncedRenderCalendar();
        console.log("Tab clicked, re-rendering calendar.");
      }, 100);
    });
  });
}

function observeTabChanges(): void {
  const tabPanelContainer = document.querySelector(".p-tabview-panels");
  if (!tabPanelContainer) return;

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

function observeLanguageChanges(): void {
  const activeSection = getActiveSection();
  if (!activeSection) return;

  const observer = new MutationObserver((mutations) => {
    const articlesChanged = mutations.some((mutation) => {
      if (mutation.type !== "childList") return false;

      const hasArticles = (nodes: NodeList) =>
        Array.from(nodes).some(
          (node) =>
            node.nodeName === "ARTICLE" ||
            (node as Element).querySelector?.("article"),
        );

      return (
        hasArticles(mutation.addedNodes) || hasArticles(mutation.removedNodes)
      );
    });

    if (articlesChanged) {
      console.log(
        "Articles changed (language switch detected), re-rendering calendar.",
      );
      debouncedRenderCalendar();
    }
  });

  observer.observe(activeSection, { childList: true, subtree: true });
}

function observeNavigation(): void {
  let lastUrl = location.href;

  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      console.log("URL changed, re-rendering calendar.");
      debouncedRenderCalendar();
    }
  }).observe(document, { subtree: true, childList: true });

  window.addEventListener("popstate", () => {
    console.log("Navigation detected (popstate), re-rendering calendar.");
    debouncedRenderCalendar();
  });

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

// ============================================================================
// Initialization
// ============================================================================

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
