// background.js

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "summarise",
    title: "Summarise with ChatGPT",
    contexts: ["all"]
  }, function() {
    if (chrome.runtime.lastError) {
      console.error("Context menu creation failed: " + chrome.runtime.lastError.message);
    }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "summarise") {
    try {
      if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
        chrome.tabs.sendMessage(tab.id, { action: "extractTranscript" });
      } else if (tab && tab.id) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: extractTextAndSummarise
        });
      }
    } catch (error) {
      console.error('Error executing script:', error);
    }
  }
});

function extractTextAndSummarise() {
  // Improved text extraction to capture more comprehensive content
  let text = '';
  const elements = document.body.querySelectorAll('*');

  elements.forEach(element => {
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
      if (element.innerText) {
        text += element.innerText + ' ';
      }
    }
  });

  chrome.runtime.sendMessage({ action: "summariseText", text: text.trim() });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summariseText") {
    summariseText(request.text);
  } else if (request.action === "transcriptExtracted") {
    summariseText(request.text);
  }
});

async function summariseText(text) {
  chrome.storage.sync.get(["apiKey", "prompt", "model", "maxTokens", "temperature", "debug"], async (data) => {
    const apiKey = data.apiKey || "";
    const prompt = data.prompt || "Summarise the following text:";
    const model = data.model || "gpt-4o-mini";
    const maxTokens = data.maxTokens || 1000;
    const temperature = data.temperature || 0.7;
    const debug = data.debug || false;

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
      chrome.runtime.sendMessage({ action: "displaySummary", summary: summary });
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['youtubeTranscript.js']
    });
  }
});
