function extractYouTubeTranscript() {
  const transcriptButton = document.querySelector('button[aria-label="Show transcript"]');
  if (transcriptButton) {
    transcriptButton.click();
    setTimeout(() => {
      const transcriptItems = document.querySelectorAll('yt-formatted-string.ytd-transcript-segment-renderer');
      if (transcriptItems.length > 0) {
        const transcript = Array.from(transcriptItems).map(item => item.textContent.trim()).join(' ');
        chrome.runtime.sendMessage({ action: "transcriptExtracted", transcript: transcript });
      } else {
        chrome.runtime.sendMessage({ action: "transcriptError", error: "Transcript not found" });
      }
    }, 1000);
  } else {
    chrome.runtime.sendMessage({ action: "transcriptError", error: "Transcript button not found" });
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractTranscript") {
    extractYouTubeTranscript();
  }
});