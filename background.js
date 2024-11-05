// background.js

import { getDefaultYouTubePrompt, getDefaultTextPrompt } from './prompt.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "summarise",
    title: "Summarise with ChatGPT",
    contexts: ["page", "selection", "link"]
  }, function() {
    if (chrome.runtime.lastError) {
      console.error("Context menu creation failed: " + chrome.runtime.lastError.message);
    }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "summarise") {
    try {
      if (info.linkUrl) {
        fetchAndSummariseLink(info.linkUrl);
      } else if (info.selectionText && info.selectionText.trim() !== '') {
        summariseText(info.selectionText, tab.url, "text", tab.title, '', tab.id);
      } else if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
        chrome.tabs.sendMessage(tab.id, { action: "extractTranscript" });
      } else if (tab && tab.id) {
        // Attempt to get the selected text via content script
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: () => window.getSelection().toString()
        }, (injectionResults) => {
          const selectedText = injectionResults[0].result;
          if (selectedText && selectedText.trim() !== '') {
            summariseText(selectedText, tab.url, "text", tab.title, '', tab.id);
          } else {
            // Inject content script to extract page content
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['contentScript.js']
            });
          }
        });
      }
    } catch (error) {
      console.error('Error executing script:', error);
      chrome.tabs.sendMessage(tab.id, { action: "displayError", error: error.message });
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summariseText") {
    summariseText(request.text, request.pageUrl, request.contentType, request.pageTitle, request.publishedDate, sender.tab.id);
  } else if (request.action === "transcriptExtracted") {
    summariseText(request.text, request.pageUrl, "youtube", request.pageTitle, request.publishedDate, sender.tab.id);
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
    } catch (error) {
      console.error("Error summarising text:", error);
      if (debug) alert("Error: " + error.message);
      else alert("Failed to summarise the text. Please check your API key and settings.");
    }
  });
}

function fetchAndSummariseLink(linkUrl) {
  // Implement link summarisation if needed
  // For now, you can alert the user or handle it similarly to summarising text
  alert("Summarising links is not yet implemented.");
}

function displayError(errorMessage, pageUrl) {
  // Inject content script to display the error in a sidebar
  chrome.scripting.executeScript({
    target: { tabId: sender.tab.id },
    files: ['displayError.js']
  });
}
