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
  const text = document.body.innerText;
  chrome.runtime.sendMessage({ action: "summariseText", text: text });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summariseText") {
    summariseText(request.text);
  }
});

function summariseText(text) {
  chrome.storage.sync.get(["apiKey", "prompt", "model", "maxTokens", "temperature", "debug"], async (data) => {
    const apiKey = data.apiKey || "";
    const prompt = data.prompt || "Summarise the following text:";
    const model = data.model || "gpt-4o-mini";
    const maxTokens = data.maxTokens || 1000;
    const temperature = data.temperature || 0.7;
    const debug = data.debug || false;

    if (debug) {
      console.log('Text:', text);
      console.log('Prompt:', prompt);
      console.log('Model:', model);
      console.log('Max Tokens:', maxTokens);
      console.log('Temperature:', temperature);
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['youtubeTranscript.js']
    });
  }
});
