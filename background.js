// background.js

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
        summariseText(info.selectionText, tab.url, "text");
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
    summariseText(request.text, request.pageUrl, request.contentType);
  } else if (request.action === "transcriptExtracted") {
    summariseText(request.text, request.pageUrl, "youtube");
  } else if (request.action === "displayError") {
    displayError(request.error, request.pageUrl);
  }
});

async function summariseText(text, pageUrl, contentType) {
  chrome.storage.sync.get(["apiKey", "youtubePrompt", "textPrompt", "model", "maxTokens", "temperature", "debug"], async (data) => {
    const apiKey = data.apiKey || "";
    const youtubePrompt = data.youtubePrompt || getDefaultYouTubePrompt();
    const textPrompt = data.textPrompt || getDefaultTextPrompt();
    const model = data.model || "gpt-4";
    const maxTokens = data.maxTokens || 1000;
    const temperature = data.temperature || 0.7;
    const debug = data.debug || false;

    // Choose the appropriate prompt
    const prompt = contentType === 'youtube' ? youtubePrompt : textPrompt;

    if (debug) {
      console.log('Text Length:', text.length);
      console.log('Text:', text);
      console.log('Prompt:', prompt);
      console.log('Model:', model);
      console.log('Max Tokens:', maxTokens);
      console.log('Temperature:', temperature);
    }

    try {
      // Estimate token count and trim text if necessary
      const tokenEstimate = estimateTokens(text);
      const maxInputTokens = 6000; // Adjust based on model's limit and maxTokens

      if (tokenEstimate > maxInputTokens) {
        text = text.substring(0, maxInputTokens * 4); // Trim text to fit within token limit
        if (debug) {
          console.log('Trimmed Text Length:', text.length);
        }
      }

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

      if (debug) {
        console.log('API Response:', result);
      }

      if (result.error) {
        throw new Error(result.error.message);
      }

      const summary = result.choices[0].message.content.trim();

      // Store summary and pageUrl in chrome.storage.local
      chrome.storage.local.set({ latestSummary: summary, summaryPageUrl: pageUrl }, () => {
        // Open summary.html in a new window
        chrome.windows.create({
          url: chrome.runtime.getURL('summary.html'),
          type: 'popup',
          width: 600,
          height: 600
        });
      });

    } catch (error) {
      console.error("Error summarising text:", error);
      if (debug) {
        alert("Error: " + error.message);
      } else {
        alert("Failed to summarise the text. Please check your API key and settings.");
      }
    }
  });
}

function estimateTokens(text) {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

async function fetchAndSummariseLink(linkUrl) {
  try {
    const response = await fetch(linkUrl);

    if (!response.ok) {
      console.error('Network response was not ok', response.statusText);
      alert('Failed to fetch and summarise the link.');
      return;
    }

    const htmlText = await response.text();

    // Remove HTML tags to get plain text
    const pageText = htmlText.replace(/<[^>]*>?/gm, ' ');

    summariseText(pageText, linkUrl, "text");
  } catch (error) {
    console.error('Error fetching link:', error);
    alert('Failed to fetch and summarise the link.');
  }
}

// Default prompts (same as before)

function getDefaultYouTubePrompt() {
  return `Summarise the following transcript from a YouTube video...`; // Your existing prompt
}

function getDefaultTextPrompt() {
  return `Summarise the following text in a clear and concise manner...`; // Your existing prompt
}
