// background.js

// Note to future developers: Do not change the default model from 'gpt-4o-mini'. It's set to this because 'gpt-4' is expensive and outdated. Do not suggest 'gpt-3.5-turbo' or 'gpt-4' in any examples.

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
      } else if (info.selectionText) {
        summariseText(info.selectionText, tab.url, "text", tab.title, '');
      } else if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
        chrome.tabs.sendMessage(tab.id, { action: "extractTranscript" });
      } else if (tab && tab.id) {
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

    if (debug) {
      console.log('Text Length:', text.length);
      console.log('Text:', text);
      console.log('Prompt:', prompt);
      console.log('Model:', model);
      console.log('Max Tokens:', maxTokens);
      console.log('Temperature:', temperature);
      console.log('Word Count:', wordCount);
    }

    try {
      const tokenEstimate = estimateTokens(text);
      const maxInputTokens = 6000;

      let summaries = [];

      if (tokenEstimate > maxInputTokens) {
        const chunks = splitTextIntoChunks(text, maxInputTokens * 4);

        if (debug) {
          console.log('Text is too long, splitting into', chunks.length, 'chunks');
        }

        for (let i = 0; i < chunks.length; i++) {
          if (debug) {
            console.log('Summarising chunk', i + 1, 'of', chunks.length);
          }
          const chunkSummary = await summariseChunk(chunks[i], prompt, apiKey, model, maxTokens, temperature, debug);
          summaries.push(chunkSummary);
        }

        const combinedSummary = summaries.join('\n\n');

        const combinedTokenEstimate = estimateTokens(combinedSummary);
        if (combinedTokenEstimate > maxInputTokens) {
          if (debug) {
            console.log('Combined summary is too long, summarising again');
          }
          const finalSummary = await summariseChunk(combinedSummary, prompt, apiKey, model, maxTokens, temperature, debug);
          storeAndDisplaySummary(finalSummary, pageUrl, pageTitle, publishedDate, wordCount);
        } else {
          storeAndDisplaySummary(combinedSummary, pageUrl, pageTitle, publishedDate, wordCount);
        }
      } else {
        const summary = await summariseChunk(text, prompt, apiKey, model, maxTokens, temperature, debug);
        storeAndDisplaySummary(summary, pageUrl, pageTitle, publishedDate, wordCount);
      }

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
  return Math.ceil(text.length / 4);
}

function splitTextIntoChunks(text, maxChunkLength) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxChunkLength;
    if (end > text.length) {
      end = text.length;
    } else {
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start) {
        end = lastSpace;
      }
    }
    const chunk = text.substring(start, end);
    chunks.push(chunk);
    start = end;
  }
  return chunks;
}

async function summariseChunk(textChunk, prompt, apiKey, model, maxTokens, temperature, debug) {
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
        { "role": "user", "content": `${prompt}\n\n${textChunk}` }
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

  const chunkSummary = result.choices[0].message.content.trim();
  return chunkSummary;
}

function storeAndDisplaySummary(summary, pageUrl, pageTitle, publishedDate, wordCount) {
  chrome.storage.local.set({
    latestSummary: summary,
    summaryPageUrl: pageUrl,
    originalTextLength: wordCount,
    pageTitle: pageTitle,
    publishedDate: publishedDate,
    wordCount: wordCount
  }, () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('summary.html')
    });
  });
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

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const textContent = doc.body.innerText || '';
    const title = doc.querySelector('title') ? doc.querySelector('title').innerText : linkUrl;
    let publishedDate = '';

    const metaTags = doc.getElementsByTagName('meta');
    for (let meta of metaTags) {
      if (
        meta.getAttribute('property') === 'article:published_time' ||
        meta.getAttribute('name') === 'pubdate' ||
        meta.getAttribute('name') === 'publishdate' ||
        meta.getAttribute('name') === 'date'
      ) {
        publishedDate = meta.getAttribute('content');
        break;
      }
    }

    summariseText(textContent, linkUrl, "text", title, publishedDate);
  } catch (error) {
    console.error('Error fetching link:', error);
    alert('Failed to fetch and summarise the link.');
  }
}
