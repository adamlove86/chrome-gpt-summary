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

  const transcriptButton = document.querySelector(
    'button[aria-label="Show transcript"], button[aria-label="Open transcript"], button[aria-label*="ranscript" i]'
  );

  if (transcriptButton) {
    transcriptButton.click();
    setTimeout(() => waitForTranscript(metadata, sendResponseCallback), 1200);
  } else {
    console.error("Transcript button not found");
    sendResponseCallback({ action: "transcriptError", error: "Transcript button not found" });
  }
}

// Function to wait for and extract transcript text
function waitForTranscript(metadata, sendResponseCallback) {
  const maxWaitTime = 15000; // Maximum wait time in milliseconds
  const startTime = Date.now();

  function getTranscriptFromItems(transcriptItems) {
    return Array.from(transcriptItems)
      .map(item => {
        const timeElement = item.querySelector('.segment-timestamp, .ytwTranscriptSegmentViewModelTimestamp');
        const textElement = item.querySelector('.segment-text, .yt-core-attributed-string[role="text"], span[role="text"]');
        const time = timeElement ? timeElement.innerText.trim() : '';
        const text = textElement ? textElement.innerText.trim() : '';
        return `${time} ${text}`.trim();
      })
      .filter(line => line.length > 0)
      .join('\n');
  }

  function getModernTranscriptItems() {
    // Preferred: modern transcript panel host
    const modernPanel = document.querySelector(
      'ytd-macro-markers-list-renderer[panel-target-id="PAmodern_transcript_view"], ytd-macro-markers-list-renderer[panel-content-visible]'
    );
    if (modernPanel) {
      const panelItems = modernPanel.querySelectorAll(
        'transcript-segment-view-model, .ytwTranscriptSegmentViewModelHost'
      );
      if (panelItems.length > 0) {
        return panelItems;
      }
    }

    // Newer variants can render timeline transcript without stable panel attrs.
    const timelinePanel = document.querySelector(
      'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-timeline-view-consolidated"]'
    );
    if (timelinePanel) {
      const timelineItems = timelinePanel.querySelectorAll(
        'transcript-segment-view-model, .ytwTranscriptSegmentViewModelHost'
      );
      if (timelineItems.length > 0) {
        return timelineItems;
      }
    }

    // Last-resort modern selector: directly look for transcript segment view models.
    return document.querySelectorAll('transcript-segment-view-model, .ytwTranscriptSegmentViewModelHost');
  }

  const checkTranscript = () => {
    let transcriptItems = [];

    // New YouTube transcript layout
    if (transcriptItems.length === 0) {
      transcriptItems = getModernTranscriptItems();
    }
    // Primary selector used by older YouTube transcript panel
    if (transcriptItems.length === 0) {
      transcriptItems = document.querySelectorAll('ytd-transcript-segment-renderer');
    }
    // Narrow fallback for older segment markup variants
    if (transcriptItems.length === 0) {
      transcriptItems = document.querySelectorAll(
        'ytd-transcript-segment-renderer .segment-text, ytd-transcript-segment-renderer .segment-timestamp'
      );
    }

    if (transcriptItems.length > 0) {
      const transcript = getTranscriptFromItems(transcriptItems);
      if (transcript.trim().length > 0) {
        sendResponseCallback({
          action: "transcriptData",
          transcript: transcript,
          title: metadata.title,
          channel: metadata.channel,
          date: metadata.publishedDate,
          url: metadata.url
        });
        return;
      }
    }

    if (Date.now() - startTime < maxWaitTime) {
      setTimeout(checkTranscript, 500);
    } else {
      console.error("Transcript loading timed out");
      sendResponseCallback({ action: "transcriptError", error: "Transcript loading timed out" });
    }
  };

  checkTranscript();
}

window.summariseExtensionYouTubeHandleMessage = (request, sender, sendResponse) => {
  if (request.action === "extractTranscript") {
    console.log("Received request to extract transcript for summary...");
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
    return true;
  }
  if (request.action === "getTranscriptAndMetadata") {
    console.log("Received request to get transcript and metadata for copying...");
    extractYouTubeData(sendResponse);
    return true;
  }
  return false;
};

if (!window.summariseExtensionYouTubeListenerInstalled) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    return window.summariseExtensionYouTubeHandleMessage(request, sender, sendResponse);
  });
  window.summariseExtensionYouTubeListenerInstalled = true;
  console.log('Installed YouTube transcript message listener');
} else {
  console.log('Reused existing YouTube transcript listener with updated handler');
}
