// popup.ts - Settings popup for the extension

// Chrome/Firefox compatibility: Use chrome API if available, otherwise browser API
const browserAPI = (
  typeof chrome !== "undefined" && chrome.storage ? chrome : browser
) as typeof browser;

interface Settings {
  linkType: "anxious-display" | "exam-article" | "download-ics";
}

// Load saved settings
async function loadSettings(): Promise<Settings> {
  const result = await browserAPI.storage.sync.get("linkType");

  // Return exam-article as default if not set, but don't save it
  // This allows the calendar to work while keeping the notification dot
  return {
    linkType:
      (result.linkType as "anxious-display" | "exam-article" | "download-ics") || "exam-article",
  };
}

// Save settings
async function saveSettings(settings: Settings): Promise<void> {
  await browserAPI.storage.sync.set(settings);
}

const EXAM_PAGE_PATTERN = /onlineservices\.polimi\.it\/iae\/app\//;
const EXAM_PAGE_URL = "https://onlineservices.polimi.it/iae/app/";

// Check if the current tab is on the exam enrollment page
async function isOnExamPage(): Promise<boolean> {
  try {
    const tabs = await browserAPI.tabs.query({
      active: true,
      currentWindow: true,
    });
    const url = tabs[0]?.url || "";
    return EXAM_PAGE_PATTERN.test(url);
  } catch {
    return false;
  }
}

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  const onExamPage = await isOnExamPage();

  const settingsContainer = document.getElementById("settings-container");
  const redirectContainer = document.getElementById("redirect-container");

  if (!onExamPage) {
    // Hide settings, show redirect
    if (settingsContainer) settingsContainer.style.display = "none";
    if (redirectContainer) redirectContainer.style.display = "block";

    const redirectButton = document.getElementById("open-exam-page");
    redirectButton?.addEventListener("click", () => {
      browserAPI.tabs.create({ url: EXAM_PAGE_URL });
      window.close();
    });
    return;
  }

  // On exam page: hide redirect, show settings
  if (redirectContainer) redirectContainer.style.display = "none";

  const settings = await loadSettings();

  // Set the selected radio button
  const radioButton = document.getElementById(
    settings.linkType,
  ) as HTMLInputElement;
  if (radioButton) {
    radioButton.checked = true;
  }

  // Add event listeners to radio buttons
  const radioButtons = document.querySelectorAll('input[name="link-type"]');
  radioButtons.forEach((radio) => {
    radio.addEventListener("change", async (event) => {
      const target = event.target as HTMLInputElement;
      const newSettings: Settings = {
        linkType: target.value as "anxious-display" | "exam-article" | "download-ics",
      };

      await saveSettings(newSettings);

      // Show save status
      const saveStatus = document.getElementById("save-status");
      if (saveStatus) {
        saveStatus.classList.add("success");
        setTimeout(() => {
          saveStatus.classList.remove("success");
        }, 2000);
      }
    });
  });
});
