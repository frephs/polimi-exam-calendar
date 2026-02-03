import { Calendar, EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
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

type Language = "en" | "it";

interface CalendarEvent extends EventInput {
  extendedProps?: {
    articleIndex: number;
    result?: number;
    rejectable?: boolean;
    awaitingResults?: boolean;
    isDeadline?: boolean;
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
    noEnrollments: "No exam enrollments found.",
    legend: "Legend:",
    rejectionDeadline: "Rejection deadline",
    publishedResult: "Published result",
    awaitingResults: "Awaiting results",
    enrolled: "Enrolled",
    notEnrolled: "Not enrolled",
    noExamsToDisplay: "No exams to display",
  },
  it: {
    exportButton: "Esporta gli esami a cui sei iscritto come ICS",
    noEnrollments: "Nessuna iscrizione all'esame trovata.",
    legend: "Legenda:",
    rejectionDeadline: "Scadenza rifiuto",
    publishedResult: "Esito pubblicato",
    awaitingResults: "In attesa di esito",
    enrolled: "Iscritto",
    notEnrolled: "Non iscritto",
    noExamsToDisplay: "Nessun esame da visualizzare",
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
        : activeTabIndex === 2
          ? "article.pj-item-card-wide section div.pt-1"
          : "div:not(div:nth-child(1))",
    icons:
      activeTabIndex === 0
        ? "section > div:not(div:nth-child(1)) i"
        : activeTabIndex === 2
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
    icons[index]?.getAttribute("class")?.includes("pmi-line-check-circle") ??
    false;

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
    const dates = Array.from(card.querySelectorAll(selectors.date))
      .map((el) => parseDate(el.textContent?.trim()))
      .filter((date): date is Date => date !== null);

    const icons = Array.from(card.querySelectorAll(selectors.icons));
    const dateElements = Array.from(card.querySelectorAll(selectors.date));
    const mainLink = card.querySelector<HTMLAnchorElement>("a[href]");

    if (title && dates.length > 0) {
      exams.push({
        title,
        articleUrl: mainLink?.href,
        articleIndex: index,
        shots: dates.map((date, i) =>
          parseExamShot(
            date,
            i,
            dateElements,
            icons,
            activeTabIndex,
            awaitingResultsInTab,
            title,
          ),
        ),
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

  return {
    title: displayTitle,
    start: shot.date.toISOString(),
    color,
    allDay: true,
    url: eventUrl,
    extendedProps: {
      articleIndex: exam.articleIndex,
      result: shot.result,
      rejectable: shot.rejectable,
      awaitingResults: shot.awaitingResults,
    },
  };
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
  const customItLocale =
    currentLang === "it"
      ? {
          code: "it",
          week: { dow: 1, doy: 4 },
          buttonText: itLocale.buttonText,
          weekText: itLocale.weekText,
          allDayText: itLocale.allDayText,
          moreLinkText: itLocale.moreLinkText,
          noEventsText: itLocale.noEventsText,
        }
      : undefined;

  const initialDate = exams.length > 0 ? exams[0].shots[0].date : new Date();

  return {
    plugins: [dayGridPlugin, listPlugin],
    initialView: "dayGridMonth",
    initialDate: initialDate,
    locale: customItLocale || currentLang,
    events,
    eventClick: (info: any) => handleEventClick(info, settings),
    views: {
      dayGridMonth: {
        titleFormat: (date: any) => formatMonthTitle(date, currentLang),
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
        noEventsContent: t("noExamsToDisplay"),
      },
    },
    headerToolbar: {
      right: "prev,next today",
      center: "title",
      left: "dayGridMonth,listMonth",
    },
  };
}

function formatMonthTitle(date: any, lang: Language): string {
  const month = date.date.marker.toLocaleDateString(lang, { month: "long" });
  const year = date.date.marker.getFullYear();
  const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
  return `${capitalizedMonth} ${year}`;
}

function handleEventClick(info: any, settings: Settings): void {
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

function addLegend(activeSection: Element, events: CalendarEvent[]): void {
  let legendElement =
    activeSection.querySelector<HTMLElement>("#calendar-legend");

  if (!legendElement) {
    legendElement = document.createElement("div");
    legendElement.id = "calendar-legend";
    legendElement.style.cssText = `
      margin: 10px;
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

  let legendHTML = `<strong style="margin-right: 10px;">${t("legend")}</strong>`;
  uniqueColors.forEach((label, color) => {
    legendHTML += `
      <div style="display: flex; align-items: center; gap: 5px;">
        <div style="width: 16px; height: 16px; background-color: ${color}; border-radius: 2px;"></div>
        <span>${label}</span>
      </div>
    `;
  });

  legendElement.innerHTML = legendHTML;
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

function addExportButton(): void {
  const activeSection = getActiveSection();
  if (!activeSection) return;

  let exportButton =
    activeSection.querySelector<HTMLButtonElement>("#export-ics-button");

  if (!exportButton) {
    exportButton = document.createElement("button");
    exportButton.id = "export-ics-button";
    exportButton.classList.add("p-button", "p-component");
    exportButton.style.margin = "10px";
    exportButton.addEventListener("click", generateICS);
    activeSection.appendChild(exportButton);
  }

  exportButton.textContent = t("exportButton");
}

async function loadSettings(): Promise<Settings> {
  try {
    const result = await browserAPI.storage.sync.get("linkType");
    const linkType =
      (result.linkType as "anxious-display" | "exam-article") || "exam-article";
    return { linkType };
  } catch (error) {
    console.error("Error loading settings, using default:", error);
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
  if (exams.some((exam) => exam.shots.some((shot) => shot.enrolled))) {
    addExportButton();
  }

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
