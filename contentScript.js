// contentScript.js

(function() {
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
})();
