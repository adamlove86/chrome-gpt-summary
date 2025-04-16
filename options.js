// options.js

import { getDefaultYouTubePrompt, getDefaultTextPrompt } from './prompt.js';

// Function to handle button press visual feedback
function handleButtonPress(buttonId) {
  const button = document.getElementById(buttonId);
  if (button) { // Check if button exists
    button.classList.add('button-pressed');
    setTimeout(() => {
      button.classList.remove('button-pressed');
    }, 200); // Remove the class after 200ms
  }
}

// --- DOM Elements ---
// Settings Form Elements
const settingsForm = document.getElementById('settingsForm');
const apiKeyInput = document.getElementById('apiKey');
const modelInput = document.getElementById('model');
const maxTokensInput = document.getElementById('maxTokens');
const temperatureInput = document.getElementById('temperature');
const debugCheckbox = document.getElementById('debug');
const youtubePromptTextarea = document.getElementById('youtubePrompt');
const textPromptTextarea = document.getElementById('textPrompt');
const defaultVoiceSelect = document.getElementById('defaultVoice');
const speechSpeedRange = document.getElementById('speechSpeed');
const speechSpeedValueSpan = document.getElementById('speechSpeedValue');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

// Blocker Elements
const blockedSitesList = document.getElementById('blockedSitesList');
const newSiteOriginInput = document.getElementById('newSiteOrigin');
const addSiteBtn = document.getElementById('addSiteBtn');

// Debug Elements
const downloadLogBtn = document.getElementById('downloadLogBtn');

// --- Functions ---

// Load all settings from storage
function loadSettings() {
  chrome.storage.sync.get([
    "apiKey", "youtubePrompt", "textPrompt", "model", "maxTokens",
    "temperature", "debug", "defaultVoice", "speechSpeed", "blockedSites"
  ], (data) => {
    // API & Model Config
    apiKeyInput.value = data.apiKey || '';
    modelInput.value = data.model || 'gpt-4o-mini';
    maxTokensInput.value = data.maxTokens || 1000;
    temperatureInput.value = data.temperature || 0.7;
    debugCheckbox.checked = data.debug || false;

    // Prompts
    youtubePromptTextarea.value = data.youtubePrompt || getDefaultYouTubePrompt();
    textPromptTextarea.value = data.textPrompt || getDefaultTextPrompt();

    // Speech Settings
    populateVoiceList(data.defaultVoice || '');
    const speed = data.speechSpeed || 100;
    speechSpeedRange.value = speed;
    speechSpeedValueSpan.textContent = `${speed}%`;

    // Blocker Sites
    loadBlockedSitesList(data.blockedSites || []);
  });
}

// Save all settings from the form
function saveSettings(event) {
  event.preventDefault();
  handleButtonPress('saveSettingsBtn');
  const settingsToSave = {
    apiKey: apiKeyInput.value,
    model: modelInput.value,
    maxTokens: parseInt(maxTokensInput.value, 10),
    temperature: parseFloat(temperatureInput.value),
    debug: debugCheckbox.checked,
    youtubePrompt: youtubePromptTextarea.value,
    textPrompt: textPromptTextarea.value,
    defaultVoice: defaultVoiceSelect.value,
    speechSpeed: parseInt(speechSpeedRange.value, 10)
  };

  chrome.storage.sync.set(settingsToSave, () => {
    alert('Settings saved.');
    // Note: We don't save blockedSites here as it's managed separately
  });
}

// Populate voice dropdown list
function populateVoiceList(selectedVoice) {
    chrome.tts.getVoices((voices) => {
        defaultVoiceSelect.innerHTML = ''; // Clear existing options
        voices.forEach((voice) => {
            const option = document.createElement('option');
            option.value = voice.voiceName;
            option.textContent = `${voice.voiceName} (${voice.lang})`;
            if (voice.voiceName === selectedVoice) {
                option.selected = true;
            }
            defaultVoiceSelect.appendChild(option);
        });
    });
}

// Update speech speed display
function updateSpeechSpeedDisplay() {
    speechSpeedValueSpan.textContent = `${speechSpeedRange.value}%`;
}

// Load and display blocked sites list
function loadBlockedSitesList(sites) {
    blockedSitesList.innerHTML = ''; // Clear current list
    sites.forEach((site, index) => {
      const li = document.createElement('li');
      const siteSpan = document.createElement('span');
      siteSpan.textContent = site;
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        removeBtn.classList.add('button-pressed');
        setTimeout(() => {
          removeBtn.classList.remove('button-pressed');
        }, 200);
        removeSite(index);
      });

      li.appendChild(siteSpan);
      li.appendChild(removeBtn);
      blockedSitesList.appendChild(li);
    });
}

// Remove a site from the list by index
function removeSite(indexToRemove) {
  chrome.storage.sync.get({ blockedSites: [] }, (data) => {
    const sites = data.blockedSites;
    sites.splice(indexToRemove, 1); // Remove the element at the index
    chrome.storage.sync.set({ blockedSites: sites }, () => {
      console.log('Site removed.');
      loadBlockedSitesList(sites); // Refresh the list display
    });
  });
}

// Add a new site to the list
function addSite() {
  handleButtonPress('addSiteBtn');
  const newSite = newSiteOriginInput.value.trim();
  if (!newSite) {
    alert('Please enter a site origin (e.g., https://example.com)');
    return;
  }
  // Basic validation for origin format
  try {
      const url = new URL(newSite);
      if (url.origin !== newSite) {
          alert('Please enter just the origin (e.g., https://example.com), not a full path.');
          return;
      }
  } catch (e) {
      alert('Invalid URL format. Please enter a valid origin (e.g., https://example.com)');
      return;
  }

  chrome.storage.sync.get({ blockedSites: [] }, (data) => {
    const sites = data.blockedSites;
    if (!sites.includes(newSite)) {
      sites.push(newSite);
      chrome.storage.sync.set({ blockedSites: sites }, () => {
        console.log(`${newSite} added.`);
        newSiteOriginInput.value = ''; // Clear input field
        loadBlockedSitesList(sites); // Refresh the list display
      });
    } else {
      alert(`${newSite} is already in the list.`);
    }
  });
}

// Trigger log download
function downloadLog() {
  handleButtonPress('downloadLogBtn');
  console.log('Requesting log download from background script...');
  chrome.runtime.sendMessage({ action: "downloadLog" }, (response) => {
    if (response && response.status === "done") {
      console.log("Log file download initiated by background script.");
      // Provide user feedback if desired
    } else {
      console.error("Error triggering log download: ", response ? response.message : 'No response');
      alert("Failed to download log file. Check the console for errors.");
    }
  });
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', loadSettings); // Load all settings on page load
if (saveSettingsBtn) {
  saveSettingsBtn.addEventListener('click', saveSettings); // Save settings on button click
} else {
  console.error("Save settings button not found!");
}
speechSpeedRange.addEventListener('input', updateSpeechSpeedDisplay); // Update speed display
addSiteBtn.addEventListener('click', addSite); // Add site button
newSiteOriginInput.addEventListener('keypress', (event) => { // Add site on Enter key
  if (event.key === 'Enter') {
    addSite();
  }
});
downloadLogBtn.addEventListener('click', downloadLog); // Download log button
