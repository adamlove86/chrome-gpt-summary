// contentScript.js

// Function to extract content and metadata for copying
function extractContentAndMetadata(sendResponseCallback) {
  try {
    // Clone the document to avoid modifying the original page
    const documentClone = document.cloneNode(true);
    const location = window.location;

    // Use Readability to parse the page
    const reader = new Readability(documentClone);
    const article = reader.parse();

    if (article) {
      const content = article.textContent.trim();
      const title = article.title || document.title;
      let publishedDate = '';

      // Try to extract the published date from meta tags
      const metaTags = document.getElementsByTagName('meta');
      for (let meta of metaTags) {
        if (
          meta.getAttribute('property') === 'article:published_time' ||
          meta.getAttribute('name') === 'pubdate' ||
          meta.getAttribute('name') === 'publishdate' ||
          meta.getAttribute('name') === 'date' ||
          meta.getAttribute('name') === 'DC.date.issued'
        ) {
          publishedDate = meta.getAttribute('content');
          break;
        }
      }

      // If published date not found, try to extract from visible elements
      if (!publishedDate) {
        const dateElements = document.querySelectorAll('time, .date, .published, .entry-date');
        if (dateElements.length > 0) {
          publishedDate = dateElements[0].innerText.trim();
        }
      }

      // Send back all data
      sendResponseCallback({
        action: "contentData",
        content: content,
        title: title,
        publishedDate: publishedDate,
        url: window.location.href
      });
    } else {
      console.error('Readability failed to parse the page.');
      sendResponseCallback({ action: "contentError", error: "Failed to extract article content" });
    }
  } catch (error) {
    console.error('Error during content extraction:', error);
    sendResponseCallback({ action: "contentError", error: error.message });
  }
}

// Function to extract content for summarization
function extractContentForSummarization() {
  try {
    // Clone the document to avoid modifying the original page
    const documentClone = document.cloneNode(true);
    const location = window.location;

    // Use Readability to parse the page
    const reader = new Readability(documentClone);
    const article = reader.parse();

    if (article) {
      const text = article.textContent.trim();
      const title = article.title || document.title;
      let publishedDate = '';

      // Log the extraction length
      chrome.runtime.sendMessage({ action: "log", message: "Content extracted: " + text.length + " characters." });

      // Try to extract the published date from meta tags
      const metaTags = document.getElementsByTagName('meta');
      for (let meta of metaTags) {
        if (
          meta.getAttribute('property') === 'article:published_time' ||
          meta.getAttribute('name') === 'pubdate' ||
          meta.getAttribute('name') === 'publishdate' ||
          meta.getAttribute('name') === 'date' ||
          meta.getAttribute('name') === 'DC.date.issued'
        ) {
          publishedDate = meta.getAttribute('content');
          break;
        }
      }

      // If published date not found, try to extract from visible elements
      if (!publishedDate) {
        const dateElements = document.querySelectorAll('time, .date, .published, .entry-date');
        if (dateElements.length > 0) {
          publishedDate = dateElements[0].innerText.trim();
        }
      }

      chrome.runtime.sendMessage({
        action: "summariseText",
        text: text,
        pageUrl: window.location.href,
        contentType: "text",
        pageTitle: title,
        publishedDate: publishedDate
      });
    } else {
      console.error('Readability failed to parse the page.');
      alert('Failed to extract article content. Please try a different page.');
    }
  } catch (error) {
    console.error('Error during content extraction:', error);
    alert('An error occurred while extracting content.');
  }
}

// Message listener for content extraction requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getContentAndMetadata") {
    console.log("Received request to get content and metadata for copying...");
    extractContentAndMetadata(sendResponse);
    // Indicate that sendResponse will be called asynchronously
    return true;
  } else if (request.action === "extractContentForSummarization") {
    console.log("Received request to extract content for summarization...");
    extractContentForSummarization();
    return false; // No async response needed
  }
});

// Auto-run summarization when script is injected for that purpose
// Check if we should auto-run (this will be set by the popup when injecting for summarization)
if (window.location.search.includes('autoRun=true') || document.currentScript?.dataset?.autoRun === 'true') {
  extractContentForSummarization();
}
