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
        chrome.tabs.sendMessage(tab.id, { action: "extractTranscript" });
      } else if (tab && tab.id) {
        // Open summary window immediately
        chrome.tabs.sendMessage(tab.id, { action: "openSummaryWindow", pageUrl: tab.url });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: extractTextAndSummarise
        });
      }
    } catch (error) {
      console.error('Error executing script:', error);
      chrome.tabs.sendMessage(tab.id, { action: "displayError", error: error.message });
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

  chrome.runtime.sendMessage({
    action: "summariseText",
    text: text.trim(),
    pageUrl: window.location.href,
    contentType: "text"
  });
}

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
      chrome.runtime.sendMessage({ action: "displaySummary", summary: summary, pageUrl: pageUrl });
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
    const text = await response.text();

    // Remove HTML tags to get plain text
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const pageText = doc.body.innerText;

    summariseText(pageText, linkUrl, "text");
  } catch (error) {
    console.error('Error fetching link:', error);
    alert('Failed to fetch and summarise the link.');
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com/watch')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['youtubeTranscript.js']
    });
  }
});

// Default prompts

function getDefaultYouTubePrompt() {
  return `Summarise the following transcript from a YouTube video. Present the summary as a detailed narrative, focusing on accurately capturing the key points and flow of the content. Follow these guidelines strictly:

1. **Overview Section**:
   - Begin with a brief summary paragraph covering the main points of the entire video.
   - Use the format: \`0:00:00 - [Video Duration]\` at the beginning of this section.
   - Ensure the overview emphasises the main topic and key findings, avoiding excessive focus on background information.

2. **Detailed Sections**:
   - Break down the content into logical sections based on shifts in topics or themes.
   - *Start each section with a heading in italic*, summarising that segment.
   - Use approximate time stamps for each section (e.g., \`0:00\`, \`1:30\`), if applicable.
   - Ensure that the sections collectively cover the entire video content without omissions.
   - Use complete sentences and maintain a clear, narrative flow.

3. **Formatting Guidelines**:
   - Use **bold** to emphasise important terms, concepts, or breakthroughs.
   - Use *italic* to highlight supplementary or nuanced points.
   - Highlight critical points or warnings using \`<red>\`...\`</red>\`.
   - Highlight key definitions or important concepts using \`<blue>\`...\`</blue>\`.
   - Highlight positive aspects or benefits using \`<green>\`...\`</green>\`.
   - Highlight cautionary notes or potential issues using \`<orange>\`...\`</orange>\`.

4. **Additional Instructions**:
   - Ensure the summary is comprehensive but concise, capturing all essential information without unnecessary detail.
   - Use colours sparingly and ONLY for their designated purposes.
   - Adhere strictly to Markdown syntax for all formatting.
   - Do not omit any important information from the transcript.
   - Ensure that the summary reflects the video's actual content accurately.`;
}

function getDefaultTextPrompt() {
  return `Summarise the following text in a clear and concise manner. Present the summary as a detailed narrative, focusing on accurately capturing the key points and flow of the content. Follow these guidelines strictly:

1. **Overview Section**:
   - Begin with a brief summary paragraph covering the main points.
   - Do not include time stamps.
   - Ensure the overview emphasises the main topic and key findings, avoiding excessive focus on background information.

2. **Detailed Sections**:
   - Break down the content into logical sections based on shifts in topics or themes.
   - *Present each section with a heading in italic*, summarising the key points.
   - Use headings without time stamps.
   - Ensure that the sections collectively cover the entire content without omissions.
   - Use complete sentences and maintain a clear, narrative flow.

3. **Formatting Guidelines**:
   - Use **bold** to emphasise important terms, concepts, or breakthroughs.
   - Use *italic* to highlight supplementary or nuanced points.
   - Highlight critical points or warnings using \`<red>\`...\`</red>\`.
   - Highlight key definitions or important concepts using \`<blue>\`...\`</blue>\`.
   - Highlight positive aspects or benefits using \`<green>\`...\`</green>\`.
   - Highlight cautionary notes or potential issues using \`<orange>\`...\`</orange>\`.

4. **Additional Instructions**:
   - Ensure the summary is comprehensive but concise, capturing all essential information without unnecessary detail.
   - Use colours sparingly and ONLY for their designated purposes.
   - Adhere strictly to Markdown syntax for all formatting.
   - Do not omit any important information from the text.
   - Ensure that the summary accurately reflects the content.`;
}
