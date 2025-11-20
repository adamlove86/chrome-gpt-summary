// popup.js
import { getDefaultYouTubePrompt, getDefaultTextPrompt } from './prompt.js';

// Get references to buttons
const summariseBtn = document.getElementById('summariseBtn');
const blockSiteBtn = document.getElementById('blockSiteBtn');
const optionsBtn = document.getElementById('optionsBtn');
const copyTranscriptBtn = document.getElementById('copyTranscriptBtn');
const readContentBtn = document.getElementById('readContentBtn');
const copyContentBtn = document.getElementById('copyContentBtn');
const sendToChatGPTBtn = document.getElementById('sendToChatGPTBtn');
const factCheckBtn = document.getElementById('factCheckBtn');
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
      if (sendToChatGPTBtn) {
        sendToChatGPTBtn.style.display = 'block'; // Show for YouTube videos
      }
      if (factCheckBtn) {
        factCheckBtn.style.display = 'block'; // Show for YouTube videos
      }
    } else if (currentTab && currentTab.url && !currentTab.url.startsWith('chrome://') && !currentTab.url.startsWith('chrome-extension://')) {
      // Show copy content button for non-YouTube pages (excluding chrome internal pages)
      if (copyContentBtn) {
        copyContentBtn.style.display = 'block'; // Show the button (use block for column layout)
      }
      if (readContentBtn) {
        readContentBtn.style.display = 'block'; // Show for article pages
      }
      if (sendToChatGPTBtn) {
        sendToChatGPTBtn.style.display = 'block'; // Show for articles
      }
      if (factCheckBtn) {
        factCheckBtn.style.display = 'block'; // Show for articles
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

// Prevent multiple simultaneous summarization requests
let isSummarizing = false;

document.getElementById('summariseBtn').addEventListener('click', async () => {
  // Prevent multiple clicks
  if (isSummarizing) {
    console.log('Summarization already in progress, ignoring click');
    return;
  }
  
  isSummarizing = true;
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
        // Send a message to start content extraction for summarization
        chrome.tabs.sendMessage(currentTab.id, { action: "extractContentForSummarization" });
      } catch (error) {
        console.error("Error injecting scripts:", error);
      }
    }
    
    // Reset the flag after a short delay to allow for the summarization process to start
    setTimeout(() => {
      isSummarizing = false;
    }, 2000); // 2 second delay to prevent rapid successive clicks
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

// Listener for the Read Article button (opens sidebar TTS reader for full article content)
if (readContentBtn) {
  readContentBtn.addEventListener('click', async () => {
    handleButtonPress('readContentBtn');
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const currentTab = tabs[0];
      if (currentTab && currentTab.id) {
        try {
          // Ensure necessary scripts are injected
          await chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            files: ['JSDOMParser.js', 'Readability.js', 'contentScript.js']
          });

          // Request content and metadata from content script
          chrome.tabs.sendMessage(
            currentTab.id,
            { action: "getContentAndMetadata" },
            (response) => {
              if (chrome.runtime.lastError) {
                console.error("Error sending message:", chrome.runtime.lastError.message);
                readContentBtn.textContent = 'Error!';
                setTimeout(() => (readContentBtn.textContent = '🔊 Read Article'), 2000);
                return;
              }

              if (response && response.action === "contentData") {
                const { content, title, publishedDate, url } = response;
                if (content) {
                  const wordCount = content.trim().split(/\s+/).length;

                  // Store full-article data and mark sidebar mode as article
                  chrome.storage.local.set(
                    {
                      latestFullContent: content,
                      fullContentPageUrl: url,
                      fullContentPageTitle: title,
                      fullContentPublishedDate: publishedDate,
                      fullContentWordCount: wordCount,
                      summaryType: 'article'
                    },
                    () => {
                      // Inject the same sidebar/tts reader used for summaries
                      chrome.scripting.executeScript({
                        target: { tabId: currentTab.id },
                        files: ['displaySummary.js']
                      });
                      readContentBtn.textContent = 'Opening...';
                      setTimeout(() => (readContentBtn.textContent = '🔊 Read Article'), 2000);
                    }
                  );
                } else {
                  console.error('No content received from content script.');
                  readContentBtn.textContent = 'No Content!';
                  setTimeout(() => (readContentBtn.textContent = '🔊 Read Article'), 2000);
                }
              } else if (response && response.action === "contentError") {
                console.error("Error fetching content:", response.error);
                readContentBtn.textContent = 'Error!';
                setTimeout(() => (readContentBtn.textContent = '🔊 Read Article'), 2000);
              } else {
                console.error('Unexpected response from content script:', response);
                readContentBtn.textContent = 'Error!';
                setTimeout(() => (readContentBtn.textContent = '🔊 Read Article'), 2000);
              }
            }
          );
        } catch (error) {
          console.error("Error during article read process:", error);
          readContentBtn.textContent = 'Error!';
          setTimeout(() => (readContentBtn.textContent = '🔊 Read Article'), 2000);
        }
      }
    });
  });
}

// Listener for the Copy Content button
if (copyContentBtn) {
  copyContentBtn.addEventListener('click', async () => {
    handleButtonPress('copyContentBtn');
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const currentTab = tabs[0];
      if (currentTab && currentTab.id) {
        try {
          // Ensure necessary scripts are injected
          await chrome.scripting.executeScript({
            target: { tabId: currentTab.id },
            files: ['JSDOMParser.js', 'Readability.js', 'contentScript.js']
          });
          // Request content and metadata from content script
          chrome.tabs.sendMessage(currentTab.id, { action: "getContentAndMetadata" }, (response) => {
            if (chrome.runtime.lastError) {
              console.error("Error sending message:", chrome.runtime.lastError.message);
              copyContentBtn.textContent = 'Error!';
              setTimeout(() => copyContentBtn.textContent = 'Copy Content', 2000);
              return;
            }
            if (response && response.action === "contentData") {
              const { content, title, publishedDate, url } = response;
              if (content) {
                const wordCount = content.trim().split(/\s+/).length;
                const header = `Title: ${title || 'N/A'}\nPublished: ${publishedDate || 'N/A'}\nURL: ${url || 'N/A'}\nWord Count: ${wordCount}\n\n---\n\n`;
                const textToCopy = header + content;

                navigator.clipboard.writeText(textToCopy).then(() => {
                  console.log('Content and metadata copied to clipboard.');
                  copyContentBtn.textContent = 'Copied!';
                  setTimeout(() => copyContentBtn.textContent = 'Copy Content', 2000);
                }).catch(err => {
                  console.error('Failed to copy content: ', err);
                  copyContentBtn.textContent = 'Copy Failed!';
                  setTimeout(() => copyContentBtn.textContent = 'Copy Content', 2000);
                });
              } else {
                console.error('No content received from content script.');
                copyContentBtn.textContent = 'No Content!';
                setTimeout(() => copyContentBtn.textContent = 'Copy Content', 2000);
              }
            } else if (response && response.action === "contentError") {
                 console.error("Error fetching content:", response.error);
                 copyContentBtn.textContent = 'Error!';
                 setTimeout(() => copyContentBtn.textContent = 'Copy Content', 2000);
            } else {
                console.error('Unexpected response from content script:', response);
                copyContentBtn.textContent = 'Error!';
                setTimeout(() => copyContentBtn.textContent = 'Copy Content', 2000);
            }
          });
        } catch (error) {
          console.error("Error during content copy process:", error);
          copyContentBtn.textContent = 'Error!';
          setTimeout(() => copyContentBtn.textContent = 'Copy Content', 2000);
        }
      }
    });
  });
}

// Listener for the Send to ChatGPT button
if (sendToChatGPTBtn) {
  sendToChatGPTBtn.addEventListener('click', async () => {
    handleButtonPress('sendToChatGPTBtn');

    chrome.storage.sync.get({
        prefacePrompt: "I have questions about this article. Please review the complete text provided below. The full article content is included here, so you don't need to access any external links right now.",
        youtubePrefacePrompt: "I have questions about this YouTube video. Please review the text below."
    }, (settings) => {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            const currentTab = tabs[0];
            if (currentTab && currentTab.id) {
                // Determine if this is YouTube or article page
                const isYouTube = currentTab.url && currentTab.url.includes('youtube.com/watch');

                try {
                    if (isYouTube) {
                        // YouTube: inject and get transcript
                        await chrome.scripting.executeScript({
                            target: { tabId: currentTab.id },
                            files: ['youtubeTranscript.js']
                        });
                        chrome.tabs.sendMessage(currentTab.id, { action: "getTranscriptAndMetadata" }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.error("Error sending message:", chrome.runtime.lastError.message);
                                sendToChatGPTBtn.textContent = 'Error!';
                                setTimeout(() => sendToChatGPTBtn.textContent = '💬 Send to ChatGPT', 2000);
                                return;
                            }
                            if (response && response.action === "transcriptData") {
                                const { transcript, title, channel, date, url } = response;
                                if (transcript) {
                                    const wordCount = transcript.trim().split(/\s+/).length;
                                    const header = `Title: ${title || 'N/A'}\nChannel: ${channel || 'N/A'}\nPublished: ${date || 'N/A'}\nURL: ${url || 'N/A'}\nWord Count: ${wordCount}\n\n---\n\n`;
                                    const fullText = `${settings.youtubePrefacePrompt}\n\n` + header + transcript;

                                    // Send to background to open ChatGPT
                                    chrome.runtime.sendMessage({
                                        action: "openChatGPTWithText",
                                        text: fullText
                                    });
                                    sendToChatGPTBtn.textContent = 'Opening...';
                                    setTimeout(() => sendToChatGPTBtn.textContent = '💬 Send to ChatGPT', 2000);
                                } else {
                                    console.error('No transcript received from content script.');
                                    sendToChatGPTBtn.textContent = 'No Transcript!';
                                    setTimeout(() => sendToChatGPTBtn.textContent = '💬 Send to ChatGPT', 2000);
                                }
                            } else if (response && response.action === "transcriptError") {
                                console.error("Error fetching transcript:", response.error);
                                sendToChatGPTBtn.textContent = 'Error!';
                                setTimeout(() => sendToChatGPTBtn.textContent = '💬 Send to ChatGPT', 2000);
                            } else {
                                console.error('Unexpected response from content script:', response);
                                sendToChatGPTBtn.textContent = 'Error!';
                                setTimeout(() => sendToChatGPTBtn.textContent = '💬 Send to ChatGPT', 2000);
                            }
                        });
                    } else {
                        // Article: inject and get content
                        await chrome.scripting.executeScript({
                            target: { tabId: currentTab.id },
                            files: ['JSDOMParser.js', 'Readability.js', 'contentScript.js']
                        });
                        chrome.tabs.sendMessage(currentTab.id, { action: "getContentAndMetadata" }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.error("Error sending message:", chrome.runtime.lastError.message);
                                sendToChatGPTBtn.textContent = 'Error!';
                                setTimeout(() => sendToChatGPTBtn.textContent = '💬 Send to ChatGPT', 2000);
                                return;
                            }
                            if (response && response.action === "contentData") {
                                const { content, title, publishedDate, url } = response;
                                if (content) {
                                    const wordCount = content.trim().split(/\s+/).length;
                                    const header = `Title: ${title || 'N/A'}\nPublished: ${publishedDate || 'N/A'}\nURL: ${url || 'N/A'}\nWord Count: ${wordCount}\n\n---\n\n`;
                                    const fullText = `${settings.prefacePrompt}\n\n` + header + content;

                                    // Send to background to open ChatGPT
                                    chrome.runtime.sendMessage({
                                        action: "openChatGPTWithText",
                                        text: fullText
                                    });
                                    sendToChatGPTBtn.textContent = 'Opening...';
                                    setTimeout(() => sendToChatGPTBtn.textContent = '💬 Send to ChatGPT', 2000);
                                } else {
                                    console.error('No content received from content script.');
                                    sendToChatGPTBtn.textContent = 'No Content!';
                                    setTimeout(() => sendToChatGPTBtn.textContent = '💬 Send to ChatGPT', 2000);
                                }
                            } else if (response && response.action === "contentError") {
                                console.error("Error fetching content:", response.error);
                                sendToChatGPTBtn.textContent = 'Error!';
                                setTimeout(() => sendToChatGPTBtn.textContent = '💬 Send to ChatGPT', 2000);
                            } else {
                                console.error('Unexpected response from content script:', response);
                                sendToChatGPTBtn.textContent = 'Error!';
                                setTimeout(() => sendToChatGPTBtn.textContent = '💬 Send to ChatGPT', 2000);
                            }
                        });
                    }
                } catch (error) {
                    console.error("Error during ChatGPT send process:", error);
                    sendToChatGPTBtn.textContent = 'Error!';
                    setTimeout(() => sendToChatGPTBtn.textContent = '💬 Send to ChatGPT', 2000);
                }
            }
        });
    });
  });
}

// Listener for the Fact Check button
if (factCheckBtn) {
  factCheckBtn.addEventListener('click', async () => {
    handleButtonPress('factCheckBtn');
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const currentTab = tabs[0];
      if (currentTab && currentTab.id) {
        // Determine if this is YouTube or article page
        const isYouTube = currentTab.url && currentTab.url.includes('youtube.com/watch');
        
        try {
          if (isYouTube) {
            // YouTube: inject and get transcript
            await chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              files: ['youtubeTranscript.js']
            });
            chrome.tabs.sendMessage(currentTab.id, { action: "getTranscriptAndMetadata" }, (response) => {
              if (chrome.runtime.lastError) {
                console.error("Error sending message:", chrome.runtime.lastError.message);
                factCheckBtn.textContent = 'Error!';
                setTimeout(() => factCheckBtn.textContent = '🔍 Fact Check', 2000);
                return;
              }
              if (response && response.action === "transcriptData") {
                const { transcript, title, channel, date, url } = response;
                if (transcript) {
                  const wordCount = transcript.trim().split(/\s+/).length;
                  const header = `Title: ${title || 'N/A'}\nChannel: ${channel || 'N/A'}\nPublished: ${date || 'N/A'}\nURL: ${url || 'N/A'}\nWord Count: ${wordCount}\n\n---\n\n`;
                  const preface = "Please fact-check the key claims in this YouTube video transcript using credible sources. Focus on verifiable facts, statistics, and significant assertions. Be concise and prioritize the most important claims.\n\n";
                  const fullText = preface + header + transcript;
                  
                  // Send to background to open ChatGPT
                  chrome.runtime.sendMessage({ 
                    action: "openChatGPTWithText", 
                    text: fullText 
                  });
                  factCheckBtn.textContent = 'Opening...';
                  setTimeout(() => factCheckBtn.textContent = '🔍 Fact Check', 2000);
                } else {
                  console.error('No transcript received from content script.');
                  factCheckBtn.textContent = 'No Transcript!';
                  setTimeout(() => factCheckBtn.textContent = '🔍 Fact Check', 2000);
                }
              } else if (response && response.action === "transcriptError") {
                console.error("Error fetching transcript:", response.error);
                factCheckBtn.textContent = 'Error!';
                setTimeout(() => factCheckBtn.textContent = '🔍 Fact Check', 2000);
              } else {
                console.error('Unexpected response from content script:', response);
                factCheckBtn.textContent = 'Error!';
                setTimeout(() => factCheckBtn.textContent = '🔍 Fact Check', 2000);
              }
            });
          } else {
            // Article: inject and get content
            await chrome.scripting.executeScript({
              target: { tabId: currentTab.id },
              files: ['JSDOMParser.js', 'Readability.js', 'contentScript.js']
            });
            chrome.tabs.sendMessage(currentTab.id, { action: "getContentAndMetadata" }, (response) => {
              if (chrome.runtime.lastError) {
                console.error("Error sending message:", chrome.runtime.lastError.message);
                factCheckBtn.textContent = 'Error!';
                setTimeout(() => factCheckBtn.textContent = '🔍 Fact Check', 2000);
                return;
              }
              if (response && response.action === "contentData") {
                const { content, title, publishedDate, url } = response;
                if (content) {
                  const wordCount = content.trim().split(/\s+/).length;
                  const header = `Title: ${title || 'N/A'}\nPublished: ${publishedDate || 'N/A'}\nURL: ${url || 'N/A'}\nWord Count: ${wordCount}\n\n---\n\n`;
                  const preface = "Please fact-check the key claims in this article using credible sources. Focus on verifiable facts, statistics, and significant assertions. Be concise and prioritize the most important claims.\n\n";
                  const fullText = preface + header + content;
                  
                  // Send to background to open ChatGPT
                  chrome.runtime.sendMessage({ 
                    action: "openChatGPTWithText", 
                    text: fullText 
                  });
                  factCheckBtn.textContent = 'Opening...';
                  setTimeout(() => factCheckBtn.textContent = '🔍 Fact Check', 2000);
                } else {
                  console.error('No content received from content script.');
                  factCheckBtn.textContent = 'No Content!';
                  setTimeout(() => factCheckBtn.textContent = '🔍 Fact Check', 2000);
                }
              } else if (response && response.action === "contentError") {
                console.error("Error fetching content:", response.error);
                factCheckBtn.textContent = 'Error!';
                setTimeout(() => factCheckBtn.textContent = '🔍 Fact Check', 2000);
              } else {
                console.error('Unexpected response from content script:', response);
                factCheckBtn.textContent = 'Error!';
                setTimeout(() => factCheckBtn.textContent = '🔍 Fact Check', 2000);
              }
            });
          }
        } catch (error) {
          console.error("Error during fact check process:", error);
          factCheckBtn.textContent = 'Error!';
          setTimeout(() => factCheckBtn.textContent = '🔍 Fact Check', 2000);
        }
      }
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "transcriptError") {
    console.error("Error extracting YouTube transcript: " + request.error);
  } else if (request.action === "displayError") {
    displayError(request.error, request.pageUrl);
  }
});

function displayError(errorMessage, pageUrl) {
  console.error("Error: " + errorMessage);
}
