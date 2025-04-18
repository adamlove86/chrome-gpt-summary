// youtubeTranscript.js

// Function to extract metadata and then initiate transcript extraction
function extractYouTubeData(sendResponseCallback) {
  // Extract metadata
  const titleElement = document.querySelector('h1.ytd-watch-metadata');
  const title = titleElement ? titleElement.innerText.trim() : document.title.replace(' - YouTube', '').trim();

  const channelElement = document.querySelector('#channel-name #text a');
  const channel = channelElement ? channelElement.innerText.trim() : 'N/A';

  const publishedDateElement = document.querySelector('#info-strings yt-formatted-string');
  const publishedDate = publishedDateElement ? publishedDateElement.innerText.trim() : 'N/A';

  const url = window.location.href;

  const metadata = { title, channel, publishedDate, url };

  // Find and click the transcript button
  const transcriptButton = document.querySelector('button[aria-label="Show transcript"], button[aria-label="Open transcript"]');

  if (transcriptButton) {
    transcriptButton.click();
    waitForTranscript(metadata, sendResponseCallback); // Pass metadata and callback
  } else {
    console.error("Transcript button not found");
    sendResponseCallback({ action: "transcriptError", error: "Transcript button not found" });
  }
}

// Function to wait for and extract transcript text
function waitForTranscript(metadata, sendResponseCallback) {
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

      // Send back all data
      sendResponseCallback({
        action: "transcriptData", // Use a consistent action name
        transcript: transcript,
        title: metadata.title,
        channel: metadata.channel,
        date: metadata.publishedDate,
        url: metadata.url
      });

    } else if (Date.now() - startTime < maxWaitTime) {
      setTimeout(checkTranscript, 500);
    } else {
      console.error("Transcript loading timed out");
      sendResponseCallback({ action: "transcriptError", error: "Transcript loading timed out" });
    }
  };

  checkTranscript();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractTranscript") {
    console.log("Received request to extract transcript for summary...");
    // For summarization, send back data compatible with summariseText
    extractYouTubeData(response => {
      if (response.action === "transcriptData") {
        chrome.runtime.sendMessage({
          action: "transcriptExtracted",
          text: response.transcript,
          pageUrl: response.url,
          pageTitle: response.title,
          publishedDate: response.date
        });
      } else {
        chrome.runtime.sendMessage(response); // Forward the error
      }
    });
    // Indicate that sendResponse will be called asynchronously (although we don't use it directly here)
    return true;
  } else if (request.action === "getTranscriptAndMetadata") {
    console.log("Received request to get transcript and metadata for copying...");
    // For copying, send back the full data package
    extractYouTubeData(sendResponse); // Pass sendResponse directly as the callback
    // Indicate that sendResponse will be called asynchronously
    return true;
  }
});
