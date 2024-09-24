// youtubeTranscript.js

function extractYouTubeData() {
  const title = document.title.replace(' - YouTube', '').trim();
  const publishedDateElement = document.querySelector('#info-strings yt-formatted-string');
  const publishedDate = publishedDateElement ? publishedDateElement.innerText.trim() : '';

  extractYouTubeTranscript(title, publishedDate);
}

function extractYouTubeTranscript(title, publishedDate) {
  const transcriptButton = document.querySelector('button[aria-label="Show transcript"], button[aria-label="Open transcript"]');

  if (transcriptButton) {
    transcriptButton.click();
    waitForTranscript(title, publishedDate);
  } else {
    chrome.runtime.sendMessage({ action: "transcriptError", error: "Transcript button not found" });
  }
}

function waitForTranscript(title, publishedDate) {
  const maxWaitTime = 15000; // Maximum wait time in milliseconds
  const startTime = Date.now();

  const checkTranscript = () => {
    const transcriptItems = document.querySelectorAll('ytd-transcript-segment-renderer');

    if (transcriptItems.length > 0) {
      const transcript = Array.from(transcriptItems)
        .map(item => {
          const timeElement = item.querySelector('.segment-timestamp');
          const textElement = item.querySelector('.segment-text');

          const time = timeElement ? timeElement.innerText.trim() : '';
          const text = textElement ? textElement.innerText.trim() : '';

          return `${time} ${text}`;
        })
        .join('\n');

      chrome.runtime.sendMessage({
        action: "transcriptExtracted",
        text: transcript,
        pageUrl: window.location.href,
        pageTitle: title,
        publishedDate: publishedDate
      });
    } else if (Date.now() - startTime < maxWaitTime) {
      setTimeout(checkTranscript, 500);
    } else {
      chrome.runtime.sendMessage({ action: "transcriptError", error: "Transcript loading timed out" });
    }
  };

  checkTranscript();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractTranscript") {
    extractYouTubeData();
  }
});
