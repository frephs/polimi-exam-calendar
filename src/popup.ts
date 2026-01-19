// popup.ts - Settings popup for the extension

// Chrome/Firefox compatibility: Use chrome API if available, otherwise browser API
const browserAPI = (
  typeof chrome !== "undefined" && chrome.storage ? chrome : browser
) as typeof browser;

interface Settings {
  linkType: "anxious-display" | "exam-article";
}

// Load saved settings
async function loadSettings(): Promise<Settings> {
  const result = await browserAPI.storage.sync.get("linkType");

  // Return exam-article as default if not set, but don't save it
  // This allows the calendar to work while keeping the notification dot
  return {
    linkType:
      (result.linkType as "anxious-display" | "exam-article") || "exam-article",
  };
}

// Save settings
async function saveSettings(settings: Settings): Promise<void> {
  await browserAPI.storage.sync.set(settings);
}

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
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
        linkType: target.value as "anxious-display" | "exam-article",
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
