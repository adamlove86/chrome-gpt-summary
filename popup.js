// popup.js

import { getDefaultYouTubePrompt, getDefaultTextPrompt } from './prompt.js';

document.getElementById('summariseBtn').addEventListener('click', async () => {
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
        console.error('Error injecting scripts:', error);
        alert("Failed to inject scripts.");
      }
    } else if (currentTab && currentTab.id) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ['JSDOMParser.js', 'Readability.js', 'contentScript.js']
        });
      } catch (error) {
        console.error('Error injecting scripts:', error);
        alert("Failed to inject scripts.");
      }
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summariseText") {
    summariseText(request.text, request.pageUrl, request.contentType, request.pageTitle, request.publishedDate, sender.tab.id);
  } else if (request.action === "transcriptExtracted") {
    summariseText(request.text, request.pageUrl, "youtube", request.pageTitle, request.publishedDate, sender.tab.id);
  } else if (request.action === "transcriptError") {
    alert("Error extracting YouTube transcript: " + request.error);
  } else if (request.action === "displayError") {
    displayError(request.error, request.pageUrl);
  }
});

async function getApiKey() {
  // First, try to fetch key.txt from the extension root folder
  try {
    const response = await fetch(chrome.runtime.getURL('key.txt'));
    if (response.ok) {
      const apiKeyFromFile = await response.text();
      return apiKeyFromFile.trim(); // Remove any whitespace
    }
  } catch (e) {
    // Ignore errors, proceed to get API key from storage
  }

  // If key.txt is not found or an error occurs, get the API key from storage
  return new Promise((resolve, reject) => {
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

    if (wordCount < 500) {
      prompt += "\n\nPlease provide a concise, single-paragraph summary.";
    } else {
      prompt += "\n\nPlease provide a detailed summary following the guidelines.";
    }

    // Get the API key
    const apiKey = await getApiKey();

    if (!apiKey) {
      alert("API key is missing. Please enter your API key in the options page.");
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
          // Inject content script to display the summary in a sidebar
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
      if (debug) alert("Error: " + error.message);
      else alert("Failed to summarise the text. Please check your API key and settings.");
    }
  });
}

function displayError(errorMessage, pageUrl) {
  // Inject content script to display the error in a sidebar
  chrome.scripting.executeScript({
    target: { tabId: sender.tab.id },
    files: ['displayError.js']
  });
}
