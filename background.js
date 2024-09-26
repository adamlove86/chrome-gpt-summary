// background.js

// Import the default prompts from prompts.js
importScripts('prompts.js');

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
        // Summarise the content at the hyperlink
        fetchAndSummariseLink(info.linkUrl);
      } else if (info.selectionText) {
        // Summarise the highlighted text
        summariseText(info.selectionText, tab.url, "text", tab.title, '');
      } else if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
        // Extract YouTube transcript
        chrome.tabs.sendMessage(tab.id, { action: "extractTranscript" });
      } else if (tab && tab.id) {
        // Execute the content script to extract page text
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['contentScript.js']
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
    summariseText(request.text, request.pageUrl, request.contentType, request.pageTitle, request.publishedDate);
  } else if (request.action === "transcriptExtracted") {
    summariseText(request.text, request.pageUrl, "youtube", request.pageTitle, request.publishedDate);
  } else if (request.action === "displayError") {
    displayError(request.error, request.pageUrl);
  }
});

async function summariseText(text, pageUrl, contentType, pageTitle, publishedDate) {
  chrome.storage.sync.get(["apiKey", "youtubePrompt", "textPrompt", "model", "maxTokens", "temperature", "debug"], async (data) => {
    const apiKey = data.apiKey || "";
    const youtubePrompt = data.youtubePrompt || getDefaultYouTubePrompt();
    const textPrompt = data.textPrompt || getDefaultTextPrompt();
    const model = data.model || "gpt-4";
    const maxTokens = data.maxTokens || 1000;
    const temperature = data.temperature || 0.7;
    const debug = data.debug || false;

    // Choose the appropriate prompt
    let prompt = contentType === 'youtube' ? youtubePrompt : textPrompt;

    // Calculate word count based on whitespace splitting for a more accurate word count
    const wordCount = text.trim().split(/\s+/).length;

    // Adjust prompt based on word count
    if (wordCount < 500) {
      prompt += "\n\nPlease provide a concise, single-paragraph summary.";
    } else {
      prompt += "\n\nPlease provide a detailed summary following the guidelines.";
    }

    // Remaining logic for summarisation...
  });
}
