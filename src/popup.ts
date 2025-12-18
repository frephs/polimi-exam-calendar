// popup.ts - Settings popup for the extension

interface Settings {
  linkType: "anxious-display" | "exam-article";
}

// Load saved settings
async function loadSettings(): Promise<Settings> {
  const result = await browser.storage.sync.get({
    linkType: "exam-article",
  });
  return result as Settings;
}

// Save settings
async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.sync.set(settings);
}

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  const settings = await loadSettings();

  // Set the selected radio button
  const radioButton = document.getElementById(
    settings.linkType
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
