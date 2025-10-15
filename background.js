// background.js
// IMPORTANT: This file runs as a service worker. It must not reference any DOM objects.

import { getDefaultYouTubePrompt, getDefaultTextPrompt } from './prompt.js';

// Append a message with timestamp to the persistent debug log in local storage
function appendLog(message) {
  // Get local date and time components
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month is 0-indexed
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const milliseconds = now.getMilliseconds().toString().padStart(3, '0');

  // Construct a consistent local timestamp string (YYYY-MM-DD HH:MM:SS.ms)
  const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;

  const logMessage = `${timestamp} - ${message}\n`;
  chrome.storage.local.get(['debugLog'], (result) => {
    let debugLog = result.debugLog || "";
    debugLog += logMessage;
    // Limit log size to prevent excessive storage use (e.g., last ~1000 lines)
    const lines = debugLog.split('\n');
    const maxLogLines = 1000;
    if (lines.length > maxLogLines) {
      debugLog = lines.slice(-maxLogLines).join('\n');
    }
    chrome.storage.local.set({ debugLog });
  });
}

// Instead of clearing the log on startup, add a session marker.
function startNewSession() {
  appendLog("=== New session started ===");
}

chrome.runtime.onInstalled.addListener(() => {
  // Optionally, clear log on install/update.
  // chrome.storage.local.set({ debugLog: "" });
  startNewSession();
  chrome.contextMenus.create({
    id: "summarise",
    title: "Summarise with ChatGPT",
    contexts: ["page", "selection", "link"]
  }, function() {
    if (chrome.runtime.lastError) {
      appendLog("Context menu creation failed: " + chrome.runtime.lastError.message);
      console.error("Context menu creation failed: " + chrome.runtime.lastError.message);
    } else {
      appendLog("Context menu created successfully.");
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  startNewSession();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  appendLog("Context menu clicked. Info: " + JSON.stringify(info));
  if (info.menuItemId === "summarise") {
    try {
      if (info.linkUrl) {
        appendLog("Summarising link: " + info.linkUrl);
        fetchAndSummariseLink(info.linkUrl);
      } else if (info.selectionText && info.selectionText.trim() !== '') {
        appendLog("Summarising selected text. Tab URL: " + tab.url);
        summariseText(info.selectionText, tab.url, "text", tab.title, '', tab.id);
      } else if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
        appendLog("YouTube page detected. Injecting transcript extraction scripts for tab " + tab.id);
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['JSDOMParser.js', 'Readability.js', 'youtubeTranscript.js']
        });
        chrome.tabs.sendMessage(tab.id, { action: "extractTranscript" });
      } else if (tab && tab.id) {
        appendLog("General page detected. Injecting content extraction scripts for tab " + tab.id);
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['JSDOMParser.js', 'Readability.js', 'contentScript.js']
        });
      }
    } catch (error) {
      appendLog("Error executing scripts: " + error.message);
      console.error("Error executing scripts:", error);
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: "displayError", error: error.message });
      }
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summariseText") {
    appendLog("Received summariseText message from tab " + (sender.tab ? sender.tab.id : 'unknown'));
    summariseText(request.text, request.pageUrl, request.contentType, request.pageTitle, request.publishedDate, sender.tab.id);
  } else if (request.action === "transcriptExtracted") {
    appendLog("Received transcriptExtracted message from tab " + (sender.tab ? sender.tab.id : 'unknown'));
    summariseText(request.text, request.pageUrl, "youtube", request.pageTitle, request.publishedDate, sender.tab.id);
  } else if (request.action === "transcriptError") {
    let tabId = sender && sender.tab ? sender.tab.id : null;
    appendLog("Received transcriptError message: " + request.error + " from tab " + tabId);
    displayError(request.error, request.pageUrl, tabId);
  } else if (request.action === "displayError") {
    let tabId = sender && sender.tab ? sender.tab.id : null;
    appendLog("Received displayError message: " + request.error + " from tab " + tabId);
    displayError(request.error, request.pageUrl, tabId);
  } else if (request.action === "downloadLog") {
    appendLog("Download log request received.");
    downloadLogFile().then(() => {
      sendResponse({ status: "done" });
    }).catch((error) => {
      sendResponse({ status: "error", message: error.message });
    });
    return true;
  } else if (request.action === "log") {
    // Log message coming from a content script.
    appendLog(request.message);
  } else if (request.action === "openChatGPTWithText") {
    appendLog("Received openChatGPTWithText message");
    openChatGPTWithText(request.text);
  }
});

async function getApiKey() {
  appendLog("Fetching API key from key.txt or storage.");
  try {
    const response = await fetch(chrome.runtime.getURL('key.txt'));
    if (response.ok) {
      const apiKeyFromFile = await response.text();
      appendLog("API key retrieved from key.txt.");
      return apiKeyFromFile.trim();
    }
  } catch (e) {
    appendLog("Failed to fetch API key from key.txt: " + e.message);
  }
  return new Promise((resolve) => {
    chrome.storage.sync.get(["apiKey"], (data) => {
      const apiKey = data.apiKey || "";
      appendLog(apiKey ? "API key retrieved from storage." : "API key not found in storage.");
      resolve(apiKey);
    });
  });
}

async function summariseText(text, pageUrl, contentType, pageTitle, publishedDate, tabId) {
  appendLog("Starting summarisation for tab " + tabId + ". Content type: " + contentType);
  chrome.storage.sync.get(["youtubePrompt", "textPrompt", "model", "maxTokens", "temperature", "debug"], async (data) => {
    const youtubePrompt = data.youtubePrompt || await getDefaultYouTubePrompt();
    const textPrompt = data.textPrompt || await getDefaultTextPrompt();
    const model = data.model || "gpt-4o-mini";
    const maxTokens = data.maxTokens || 1000;
    const temperature = data.temperature || 0.7;
    const debug = data.debug || false;

    let prompt = contentType === 'youtube' ? youtubePrompt : textPrompt;
    const wordCount = text.trim().split(/\s+/).length;

    if (contentType === 'youtube') {
      prompt += "\n\nPlease provide a detailed summary following the guidelines. Do not include any headers or titles like 'Overall Summary' or 'Summary' in your response.";
    } else {
      prompt += wordCount < 500
        ? "\n\nPlease provide a concise, single-paragraph summary. Do not include any headers or titles like 'Overall Summary' or 'Summary' in your response."
        : "\n\nPlease provide a detailed summary following the guidelines. Do not include any headers or titles like 'Overall Summary' or 'Summary' in your response.";
    }

    const apiKey = await getApiKey();
    if (!apiKey) {
      appendLog("API key missing. Aborting summarisation.");
      alert("API key is missing. Please enter your API key in the options page.");
      return;
    }

    try {
      appendLog("Sending request to OpenAI API.");

      // Build request body for Chat Completions; switch token param for GPT-5 models
      const isGpt5 = typeof model === 'string' && model.toLowerCase().startsWith('gpt-5');
      let usedModel = model;
      let fallbackReason = '';
      const body = {
        model: model,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that creates well-formatted summaries. Always use proper markdown formatting including **bold** for important terms, *italics* for emphasis and headings, and proper line breaks between paragraphs and sections. Ensure your response maintains clear visual structure with proper spacing."
          },
          { role: "user", content: `${prompt}\n\n${text}` }
        ],
        temperature: temperature
      };
      if (isGpt5) {
        // GPT-5 family expects max_completion_tokens
        body.max_completion_tokens = maxTokens;
      } else {
        body.max_tokens = maxTokens;
      }

      let response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      // If GPT-5 call fails due to unsupported model/param, fall back to gpt-4o-mini
      if (!response.ok && isGpt5) {
        const errText = await response.text();
        appendLog("Primary GPT-5 request failed (" + response.status + "): " + errText);
        // Fallback to gpt-4o-mini with max_tokens
        const fallbackModel = 'gpt-4o-mini';
        appendLog("Falling back to " + fallbackModel + ".");
        usedModel = fallbackModel;
        try {
          const errJson = JSON.parse(errText);
          fallbackReason = errJson && errJson.error && errJson.error.message ? errJson.error.message : ("HTTP " + response.status);
        } catch (_) {
          fallbackReason = ("HTTP " + response.status);
        }
        const fallbackBody = {
          model: fallbackModel,
          messages: body.messages,
          max_tokens: maxTokens,
          temperature: temperature
        };
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify(fallbackBody)
        });
      }

      const result = await response.json();
      appendLog("API response: " + JSON.stringify(result));
      if (result.error) {
        throw new Error(result.error.message);
      }
      if (result.choices && result.choices.length > 0) {
        const summary = result.choices[0].message.content.trim();
        appendLog("Summary received from API. Word count: " + wordCount + "; Summary length: " + summary.length);
        chrome.storage.local.set({
          latestSummary: summary,
          summaryPageUrl: pageUrl,
          originalTextLength: wordCount,
          pageTitle: pageTitle,
          publishedDate: publishedDate,
          wordCount: wordCount,
          modelUsed: usedModel,
          fallbackReason: fallbackReason
        }, () => {
          appendLog("Summary stored. Injecting displaySummary.js in tab " + tabId);
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['displaySummary.js']
          });
        });
      } else {
        throw new Error("No summary received from API.");
      }
    } catch (error) {
      appendLog("Error summarising text: " + error.message);
      console.error("Error summarising text:", error);
      if (debug) alert("Error: " + error.message);
      else alert("Failed to summarise the text. Please check your API key and settings.");
    }
  });
}

function fetchAndSummariseLink(linkUrl) {
  appendLog("fetchAndSummariseLink not implemented for link: " + linkUrl);
  alert("Summarising links is not yet implemented.");
}

function displayError(errorMessage, pageUrl, tabId) {
  appendLog("Displaying error in tab " + tabId + ": " + errorMessage);
  chrome.storage.local.set({
    latestError: errorMessage,
    errorPageUrl: pageUrl
  }, () => {
    if (tabId) {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['displayError.js']
      });
    } else {
      appendLog("Tab ID not provided. Cannot inject displayError.js.");
      console.error("Tab ID not provided for displayError.");
    }
  });
}

async function downloadLogFile() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['debugLog'], (result) => {
      let logContent = result.debugLog || "No logs available.";
      let blob = new Blob([logContent], { type: "text/plain" });
      const reader = new FileReader();
      reader.onload = function() {
        let dataUrl = reader.result;
        chrome.downloads.download({
          url: dataUrl,
          filename: "debug_log.txt",
          conflictAction: "overwrite",
          saveAs: true
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            appendLog("Error downloading log file: " + chrome.runtime.lastError.message);
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            appendLog("Log file downloaded with ID: " + downloadId);
            resolve(downloadId);
          }
        });
      };
      reader.onerror = function() {
        reject(new Error("Error reading blob as data URL"));
      };
      reader.readAsDataURL(blob);
    });
  });
}

async function openChatGPTWithText(text) {
  appendLog("Opening ChatGPT with text (length: " + text.length + ")");
  
  const chatGPTUrls = [
    'https://chatgpt.com/',
    'https://chat.openai.com/'
  ];
  
  // Try the first URL (chatgpt.com is the newer domain)
  const targetUrl = chatGPTUrls[0];
  
  try {
    // Create a new tab with ChatGPT
    const tab = await chrome.tabs.create({ url: targetUrl, active: true });
    appendLog("Created ChatGPT tab with ID: " + tab.id);
    
    // Wait for the tab to finish loading
    const tabLoadedPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tab load timeout'));
      }, 30000); // 30 second timeout
      
      const listener = (tabId, changeInfo, updatedTab) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve(updatedTab);
        }
      };
      
      chrome.tabs.onUpdated.addListener(listener);
    });
    
    try {
      await tabLoadedPromise;
      appendLog("ChatGPT tab finished loading");
      
      // Wait a bit more for React to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Inject the text as a data element that the injection script can read
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (textData) => {
          const dataElement = document.createElement('div');
          dataElement.id = '__chatgpt_text_data__';
          dataElement.style.display = 'none';
          dataElement.textContent = textData;
          document.body.appendChild(dataElement);
        },
        args: [text]
      });
      
      // Inject the script that will fill and submit
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['chatgpt_inject.js']
      });
      
      appendLog("ChatGPT injection script executed");
      
    } catch (loadError) {
      appendLog("Tab load error or timeout: " + loadError.message);
      // Fallback: copy to clipboard
      await fallbackCopyToClipboard(text, tab.id);
    }
    
  } catch (error) {
    appendLog("Error opening ChatGPT: " + error.message);
    console.error("Error opening ChatGPT:", error);
  }
}

async function fallbackCopyToClipboard(text, tabId) {
  appendLog("Using clipboard fallback");
  try {
    // Try to inject a simple copy script
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (textToCopy) => {
        navigator.clipboard.writeText(textToCopy).then(() => {
          alert('Text copied to clipboard! Please paste it into ChatGPT manually.');
        }).catch(err => {
          console.error('Clipboard copy failed:', err);
          alert('Could not copy to clipboard. Please check browser permissions.');
        });
      },
      args: [text]
    });
    appendLog("Fallback clipboard copy executed");
  } catch (err) {
    appendLog("Fallback clipboard copy failed: " + err.message);
  }
}
