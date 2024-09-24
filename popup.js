// popup.js

document.getElementById('summariseBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url && currentTab.url.includes('youtube.com/watch')) {
      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        files: ['youtubeTranscript.js'] // Inject content script for YouTube
      }, () => {
        chrome.tabs.sendMessage(currentTab.id, { action: "extractTranscript" });
      });
    } else if (currentTab && currentTab.id) {
      // Inject content script for general text extraction
      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        files: ['contentScript.js']
      });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "displaySummary") {
    // Handle display summary if needed
  } else if (request.action === "transcriptError") {
    alert("Error extracting YouTube transcript: " + request.error);
  } else if (request.action === "displayError") {
    displayError(request.error, request.pageUrl);
  }
});

function displayError(errorMessage, pageUrl) {
  const errorWindow = window.open('', '_blank', 'width=600,height=400');
  errorWindow.document.write(`
    <html>
      <head>
        <title>Error</title>
      </head>
      <body>
        <h1>An error occurred</h1>
        <p>${errorMessage}</p>
        <div class="footer">
          <p>Page URL: <a href="${pageUrl}" target="_blank">${pageUrl}</a></p>
        </div>
      </body>
    </html>
  `);
  errorWindow.document.close();
}
