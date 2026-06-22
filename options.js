// options.js

import { getDefaultYouTubePrompt, getDefaultTextPrompt, getDefaultPrefacePrompt, getDefaultYouTubePrefacePrompt } from './prompt.js';
import { DEFAULT_MODEL, MODEL_OPTIONS, PRICING_AS_OF, formatTokenPrice, getModelConfig } from './modelConfig.js';

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
const modelDetails = document.getElementById('modelDetails');
const maxTokensInput = document.getElementById('maxTokens');
const temperatureInput = document.getElementById('temperature');
const debugCheckbox = document.getElementById('debug');
const youtubePromptTextarea = document.getElementById('youtubePrompt');
const textPromptTextarea = document.getElementById('textPrompt');
const prefacePromptTextarea = document.getElementById('prefacePrompt');
const youtubePrefacePromptTextarea = document.getElementById('youtubePrefacePrompt');
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
    model: DEFAULT_MODEL,
    maxTokens: 1000,
    temperature: 0.7,
    debug: false,
    youtubePrompt: '',
    textPrompt: '',
    prefacePrompt: '',
    youtubePrefacePrompt: '',
    defaultVoice: '', // Will be populated by populateVoiceList
    speechSpeed: 100,
    blockedSites: [],
    logLineLimit: 30 // Keep the new log line limit setting
  }, async (data) => {
    document.getElementById('apiKey').value = data.apiKey || "";
    populateModelSelect(data.model || DEFAULT_MODEL);
    document.getElementById('maxTokens').value = data.maxTokens ?? 1000;
    document.getElementById('temperature').value = data.temperature ?? 0.7;
    document.getElementById('debug').checked = data.debug || false;
    
    // Load prompts from markdown files if not set in storage
    const youtubePrompt = data.youtubePrompt || await getDefaultYouTubePrompt();
    const textPrompt = data.textPrompt || await getDefaultTextPrompt();
    const prefacePrompt = data.prefacePrompt || await getDefaultPrefacePrompt();
    const youtubePrefacePrompt = data.youtubePrefacePrompt || await getDefaultYouTubePrefacePrompt();
    
    document.getElementById('youtubePrompt').value = youtubePrompt;
    document.getElementById('textPrompt').value = textPrompt;
    document.getElementById('prefacePrompt').value = prefacePrompt;
    document.getElementById('youtubePrefacePrompt').value = youtubePrefacePrompt;
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
  const parsedTemperature = parseFloat(document.getElementById('temperature').value);
  const temperature = Number.isNaN(parsedTemperature) ? 0.7 : parsedTemperature;
  const debug = document.getElementById('debug').checked;
  const youtubePrompt = document.getElementById('youtubePrompt').value;
  const textPrompt = document.getElementById('textPrompt').value;
  const prefacePrompt = document.getElementById('prefacePrompt').value;
  const youtubePrefacePrompt = document.getElementById('youtubePrefacePrompt').value;
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
    prefacePrompt: prefacePrompt,
    youtubePrefacePrompt: youtubePrefacePrompt,
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

  // Clear existing
  selectEl.innerHTML = '';

  // Add known models
  MODEL_OPTIONS.forEach((model) => {
    const opt = document.createElement('option');
    opt.value = model.id;
    opt.textContent = `${model.name} — ${formatTokenPrice(model.inputPrice)} in / ${formatTokenPrice(model.outputPrice)} out`;
    selectEl.appendChild(opt);
  });

  // If a stored/custom model isn't in the list, add it so it remains selectable
  if (selectedModel && !MODEL_OPTIONS.some((model) => model.id === selectedModel)) {
    const customOpt = document.createElement('option');
    customOpt.value = selectedModel;
    customOpt.textContent = `${selectedModel} (custom)`;
    selectEl.appendChild(customOpt);
  }

  selectEl.value = selectedModel || DEFAULT_MODEL;
  updateModelDetails();
}

function updateModelDetails() {
  const selectedModel = getModelConfig(modelInput.value);
  const temperature = document.getElementById('temperature');
  const temperatureHelp = document.getElementById('temperatureHelp');

  if (!selectedModel) {
    modelDetails.innerHTML = '<strong>Custom model</strong><span>Pricing and parameter support are not known to the extension.</span>';
    temperature.disabled = false;
    temperatureHelp.textContent = 'Used only when the selected model supports custom temperature.';
    return;
  }

  modelDetails.innerHTML = `
    <div class="model-details-heading">
      <strong>${selectedModel.name}</strong>
      <span class="model-badge">${selectedModel.badge}</span>
    </div>
    <span>${selectedModel.description}</span>
    <span><strong>Standard text pricing:</strong> ${formatTokenPrice(selectedModel.inputPrice)} input · ${formatTokenPrice(selectedModel.outputPrice)} output</span>
    <span class="pricing-date">Checked ${PRICING_AS_OF}. OpenAI may change pricing.</span>
  `;
  temperature.disabled = !selectedModel.supportsTemperature;
  temperatureHelp.textContent = selectedModel.supportsTemperature
    ? 'Controls variation for this model.'
    : 'Not sent for this GPT-5 model, avoiding the parameter error that caused the old fallback.';
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
modelInput.addEventListener('change', updateModelDetails);
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
