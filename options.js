// options.js

import { getDefaultYouTubePrompt, getDefaultTextPrompt } from './prompt.js';

// --- Global Variables ---
let availableVoices = [];

// Function to handle button press visual feedback
function handleButtonPress(buttonId) {
  const button = document.getElementById(buttonId);
  if (button) {
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
async function loadSettings() {
  chrome.storage.sync.get({
    apiKey: '',
    model: 'gpt-5-mini',
    maxTokens: 1000,
    temperature: 0.7,
    debug: false,
    youtubePrompt: '',
    textPrompt: '',
    defaultVoice: '', // Will be populated by populateVoiceList
    speechSpeed: 100,
    blockedSites: [],
    logLineLimit: 30 // Keep the new log line limit setting
  }, async (data) => {
    document.getElementById('apiKey').value = data.apiKey || "";
    populateModelSelect(data.model || "gpt-5-mini");
    document.getElementById('maxTokens').value = data.maxTokens || 1000;
    document.getElementById('temperature').value = data.temperature || 0.7;
    document.getElementById('debug').checked = data.debug || false;
    
    // Load prompts from markdown files if not set in storage
    const youtubePrompt = data.youtubePrompt || await getDefaultYouTubePrompt();
    const textPrompt = data.textPrompt || await getDefaultTextPrompt();
    
    document.getElementById('youtubePrompt').value = youtubePrompt;
    document.getElementById('textPrompt').value = textPrompt;
    document.getElementById('speechSpeed').value = data.speechSpeed || 100;
    document.getElementById('speechSpeedValue').textContent = `${data.speechSpeed || 100}%`;
    document.getElementById('logLineLimit').value = data.logLineLimit || 30;

    // Populate voices and set default after voices are loaded
    populateVoiceList(data.defaultVoice);

    // Load blocked sites
    loadBlockedSitesList(data.blockedSites);
  });
}

// Save all settings from the form
function saveSettings(event) {
  event.preventDefault();
  handleButtonPress('saveSettingsBtn');

  const apiKey = document.getElementById('apiKey').value;
  const model = document.getElementById('model').value;
  const maxTokens = parseInt(document.getElementById('maxTokens').value, 10) || 1000;
  const temperature = parseFloat(document.getElementById('temperature').value) || 0.7;
  const debug = document.getElementById('debug').checked;
  const youtubePrompt = document.getElementById('youtubePrompt').value;
  const textPrompt = document.getElementById('textPrompt').value;
  const defaultVoice = document.getElementById('defaultVoice').value;
  const speechSpeed = parseInt(document.getElementById('speechSpeed').value, 10) || 100;
  const logLineLimit = parseInt(document.getElementById('logLineLimit').value, 10) || 30; // Keep log line limit

  chrome.storage.sync.set({
    apiKey: apiKey,
    model: model,
    maxTokens: maxTokens,
    temperature: temperature,
    debug: debug,
    youtubePrompt: youtubePrompt,
    textPrompt: textPrompt,
    defaultVoice: defaultVoice,
    speechSpeed: speechSpeed,
    logLineLimit: logLineLimit // Save log line limit
    // Blocked sites are saved separately by addSite/removeSite
  }, () => {
    // Provide feedback
    const saveBtn = document.getElementById('saveSettingsBtn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saved!';
    setTimeout(() => {
      saveBtn.textContent = originalText;
    }, 1500);
  });
}

// Populate model dropdown with a safe list; preserve any custom stored value
function populateModelSelect(selectedModel) {
  const selectEl = modelInput;
  if (!selectEl) return;

  const models = [
    { id: 'gpt-5-mini', label: 'gpt-5-mini (GPT-5 family)' },
    { id: 'gpt-4o-mini', label: 'gpt-4o-mini (fast/cheap)' },
    { id: 'gpt-4o', label: 'gpt-4o' }
  ];

  // Clear existing
  selectEl.innerHTML = '';

  // Add known models
  models.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label;
    selectEl.appendChild(opt);
  });

  // If a stored/custom model isn't in the list, add it so it remains selectable
  if (selectedModel && !models.some(m => m.id === selectedModel)) {
    const customOpt = document.createElement('option');
    customOpt.value = selectedModel;
    customOpt.textContent = `${selectedModel} (custom)`;
    selectEl.appendChild(customOpt);
  }

  selectEl.value = selectedModel || 'gpt-5-mini';
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

// --- NEW: Log Management Functions ---

// Function to clear the debug log
function clearLog() {
    handleButtonPress('clearLogBtn');
    if (confirm("Are you sure you want to clear the entire debug log?")) {
        chrome.storage.local.set({ debugLog: "" }, () => {
            if (chrome.runtime.lastError) {
                console.error("Error clearing log:", chrome.runtime.lastError.message);
                alert("Error clearing log: " + chrome.runtime.lastError.message);
            } else {
                alert("Debug log cleared successfully.");
                // Optionally hide the log viewer if it's open
                document.getElementById('logViewer').style.display = 'none';
            }
        });
    }
}

// Function to view the debug log
function viewLog() {
    handleButtonPress('viewLogBtn');
    chrome.storage.local.get(['debugLog'], function(result) {
        const logViewer = document.getElementById('logViewer');
        const logContent = document.getElementById('logContent');
        const logLineLimit = parseInt(document.getElementById('logLineLimit').value) || 30;
        document.getElementById('logLinesShown').textContent = `Last ${logLineLimit} lines`;

        if (result.debugLog) {
            const lines = result.debugLog.split('\n');
            const lastLines = lines.slice(-logLineLimit).join('\n');
            logContent.textContent = lastLines;
        } else {
            logContent.textContent = 'No logs found.';
        }
        logViewer.style.display = 'block';
    });
}

// Function to close the log viewer
function closeLogViewer() {
    handleButtonPress('closeLogViewerBtn');
    document.getElementById('logViewer').style.display = 'none';
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

// Update speech speed display
document.getElementById('speechSpeed').addEventListener('input', (event) => {
  document.getElementById('speechSpeedValue').textContent = `${event.target.value}%`;
});

// NEW: Add listeners for log buttons
document.getElementById('clearLogBtn').addEventListener('click', clearLog);
document.getElementById('viewLogBtn').addEventListener('click', viewLog);
document.getElementById('closeLogViewerBtn').addEventListener('click', closeLogViewer);
