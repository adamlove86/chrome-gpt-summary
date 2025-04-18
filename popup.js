// popup.js
import { getDefaultYouTubePrompt, getDefaultTextPrompt } from './prompt.js';

// Get references to buttons
const summariseBtn = document.getElementById('summariseBtn');
const blockSiteBtn = document.getElementById('blockSiteBtn');
const optionsBtn = document.getElementById('optionsBtn');
const copyTranscriptBtn = document.getElementById('copyTranscriptBtn');
const popupTitle = document.getElementById('popupTitle'); // Get title element

// Function to handle button press visual feedback
function handleButtonPress(buttonId) {
  const button = document.getElementById(buttonId);
  button.classList.add('button-pressed');
  setTimeout(() => {
    button.classList.remove('button-pressed');
  }, 200); // Remove the class after 200ms
}

// --- Initialization on Popup Load ---
function initializePopup() {
  // Check current tab URL for YouTube
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url && currentTab.url.includes('youtube.com/watch')) {
      if (copyTranscriptBtn) {
        copyTranscriptBtn.style.display = 'block'; // Show the button (use block for column layout)
      }
    }
  });

  // Get model name and update title
  chrome.storage.sync.get(["model"], (data) => {
    const model = data.model || "gpt-4o-mini"; // Default model
    if (popupTitle) {
      popupTitle.textContent = `Summarise Text with ${model}`;
    }
  });
}

// Run initialization
initializePopup();

document.getElementById('summariseBtn').addEventListener('click', async () => {
  handleButtonPress('summariseBtn'); // Add visual feedback
  chrome.tabs.query({ active: true, currentWindow: true }, async function(tabs) {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url && currentTab.url.includes('youtube.com/watch')) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ['JSDOMParser.js', 'Readability.js', 'youtubeTranscript.js']
        });
        // Send a message to start transcript extraction
        chrome.tabs.sendMessage(currentTab.id, { action: "extractTranscript" });
      } catch (error) {
        console.error("Error injecting scripts:", error);
      }
    } else if (currentTab && currentTab.id) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ['JSDOMParser.js', 'Readability.js', 'contentScript.js']
        });
      } catch (error) {
        console.error("Error injecting scripts:", error);
      }
    }
  });
});

// Remove the old download log button listener
// document.getElementById('downloadLogBtn').addEventListener('click', () => {
//   handleButtonPress('downloadLogBtn'); // Add visual feedback
//   chrome.runtime.sendMessage({ action: "downloadLog" }, (response) => {
//     if (response.status === "done") {
//       console.log("Log file download initiated.");
//     } else {
//       console.error("Error downloading log file: " + response.message);
//     }
//   });
// });

// Add new block site button listener
document.getElementById('blockSiteBtn').addEventListener('click', () => {
  handleButtonPress('blockSiteBtn');
  chrome.tabs.query({ active: true, currentWindow: true }, async function(tabs) {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url) {
      try {
        const url = new URL(currentTab.url);
        const siteOrigin = url.origin; // e.g., https://www.smh.com.au
        const siteToBlock = prompt(`Add this site to the blocker list?`, siteOrigin);

        if (siteToBlock) { // If the user didn't cancel the prompt
          chrome.storage.sync.get({ blockedSites: [] }, (data) => {
            const blockedSites = data.blockedSites;
            if (!blockedSites.includes(siteToBlock)) {
              blockedSites.push(siteToBlock);
              chrome.storage.sync.set({ blockedSites: blockedSites }, () => {
                console.log(`${siteToBlock} added to blocked sites.`);
                // Optional: Provide feedback to the user, e.g., update popup UI
              });
            } else {
              console.log(`${siteToBlock} is already in the blocked list.`);
              // Optional: Inform the user
            }
          });
        }
      } catch (e) {
        console.error("Could not process URL:", e);
        // Optional: Inform the user about the error
      }
    }
  });
});

// Listener for the new Options button
document.getElementById('optionsBtn').addEventListener('click', () => {
  handleButtonPress('optionsBtn'); // Add visual feedback
  chrome.runtime.openOptionsPage();
});

// Listener for the Copy Transcript button
if (copyTranscriptBtn) {
  copyTranscriptBtn.addEventListener('click', async () => {
    handleButtonPress('copyTranscriptBtn');
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const currentTab = tabs[0];
      if (currentTab && currentTab.id) {
        try {
          // Ensure necessary scripts are injected (might already be done by summarise)
          await chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            files: ['youtubeTranscript.js']
          });
          // Request transcript and metadata from content script
          chrome.tabs.sendMessage(currentTab.id, { action: "getTranscriptAndMetadata" }, (response) => {
            if (chrome.runtime.lastError) {
              console.error("Error sending message:", chrome.runtime.lastError.message);
              copyTranscriptBtn.textContent = 'Error!';
              setTimeout(() => copyTranscriptBtn.textContent = 'Copy Transcript', 2000);
              return;
            }
            if (response && response.action === "transcriptData") {
              const { transcript, title, channel, date, url } = response;
              if (transcript) {
                const wordCount = transcript.trim().split(/\s+/).length;
                const header = `Title: ${title || 'N/A'}\nChannel: ${channel || 'N/A'}\nPublished: ${date || 'N/A'}\nURL: ${url || 'N/A'}\nWord Count: ${wordCount}\n\n---\n\n`;
                const textToCopy = header + transcript;

                navigator.clipboard.writeText(textToCopy).then(() => {
                  console.log('Transcript and metadata copied to clipboard.');
                  copyTranscriptBtn.textContent = 'Copied!';
                  setTimeout(() => copyTranscriptBtn.textContent = 'Copy Transcript', 2000);
                }).catch(err => {
                  console.error('Failed to copy transcript: ', err);
                  copyTranscriptBtn.textContent = 'Copy Failed!';
                  setTimeout(() => copyTranscriptBtn.textContent = 'Copy Transcript', 2000);
                });
              } else {
                console.error('No transcript received from content script.');
                copyTranscriptBtn.textContent = 'No Transcript!';
                setTimeout(() => copyTranscriptBtn.textContent = 'Copy Transcript', 2000);
              }
            } else if (response && response.action === "transcriptError") {
                 console.error("Error fetching transcript:", response.error);
                 copyTranscriptBtn.textContent = 'Error!';
                 setTimeout(() => copyTranscriptBtn.textContent = 'Copy Transcript', 2000);
            } else {
                console.error('Unexpected response from content script:', response);
                copyTranscriptBtn.textContent = 'Error!';
                setTimeout(() => copyTranscriptBtn.textContent = 'Copy Transcript', 2000);
            }
          });
        } catch (error) {
          console.error("Error during transcript copy process:", error);
          copyTranscriptBtn.textContent = 'Error!';
          setTimeout(() => copyTranscriptBtn.textContent = 'Copy Transcript', 2000);
        }
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summariseText") {
    summariseText(request.text, request.pageUrl, request.contentType, request.pageTitle, request.publishedDate, sender.tab.id);
  } else if (request.action === "transcriptExtracted") {
    summariseText(request.text, request.pageUrl, "youtube", request.pageTitle, request.publishedDate, sender.tab.id);
  } else if (request.action === "transcriptError") {
    console.error("Error extracting YouTube transcript: " + request.error);
  } else if (request.action === "displayError") {
    displayError(request.error, request.pageUrl);
  }
});

async function getApiKey() {
  try {
    const response = await fetch(chrome.runtime.getURL('key.txt'));
    if (response.ok) {
      const apiKeyFromFile = await response.text();
      return apiKeyFromFile.trim();
    }
  } catch (e) {
    // Fallback to storage
  }
  return new Promise((resolve) => {
    chrome.storage.sync.get(["apiKey"], (data) => {
      const apiKey = data.apiKey || "";
      resolve(apiKey);
    });
  });
}

async function summariseText(text, pageUrl, contentType, pageTitle, publishedDate, tabId) {
  chrome.storage.sync.get(["youtubePrompt", "textPrompt", "model", "maxTokens", "temperature", "debug"], async (data) => {
    const youtubePrompt = data.youtubePrompt || getDefaultYouTubePrompt();
    const textPrompt = data.textPrompt || getDefaultTextPrompt();
    const model = data.model || "gpt-4o-mini";
    const maxTokens = data.maxTokens || 1000;
    const temperature = data.temperature || 0.7;
    const debug = data.debug || false;

    let prompt = contentType === 'youtube' ? youtubePrompt : textPrompt;
    const wordCount = text.trim().split(/\s+/).length;

    prompt += wordCount < 500
      ? "\n\nPlease provide a concise, single-paragraph summary."
      : "\n\nPlease provide a detailed summary following the guidelines.";

    const apiKey = await getApiKey();
    if (!apiKey) {
      console.error("API key is missing. Please enter your API key in the options page.");
      return;
    }

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { "role": "system", "content": "You are a helpful assistant." },
            { "role": "user", "content": `${prompt}\n\n${text}` }
          ],
          max_tokens: maxTokens,
          temperature: temperature,
        })
      });

      const result = await response.json();

      if (result.choices && result.choices.length > 0) {
        const summary = result.choices[0].message.content.trim();
        chrome.storage.local.set({
          latestSummary: summary,
          summaryPageUrl: pageUrl,
          originalTextLength: wordCount,
          pageTitle: pageTitle,
          publishedDate: publishedDate,
          wordCount: wordCount
        }, () => {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['displaySummary.js']
          });
        });
      } else {
        throw new Error("No summary received from API.");
      }
    } catch (error) {
      console.error("Error summarising text:", error);
      if (debug) console.error("Error: " + error.message);
      else console.error("Failed to summarise the text. Please check your API key and settings.");
    }
  });
}

function displayError(errorMessage, pageUrl) {
  console.error("Error: " + errorMessage);
}
