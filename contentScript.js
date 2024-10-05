// contentScript.js

(function() {
  // Improved text extraction
  let text = '';
  const title = document.title;
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

  // Try to get the main content using common selectors
  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '.article__content',
    '.article-content',
    '.main-content',
    '.entry-content',
    '#content',
    '.post-content'
  ];

  let contentElement = null;

  for (let selector of selectors) {
    contentElement = document.querySelector(selector);
    if (contentElement) {
      break;
    }
  }

  if (contentElement) {
    text = contentElement.innerText.trim();
  } else {
    // Fallback to extracting all visible text
    text = '';
    const elements = document.body.querySelectorAll('*');
    elements.forEach(element => {
      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
        if (element.innerText) {
          text += element.innerText + ' ';
        }
      }
    });
    text = text.trim();
  }

  chrome.runtime.sendMessage({
    action: "summariseText",
    text: text,
    pageUrl: window.location.href,
    contentType: "text",
    pageTitle: title,
    publishedDate: publishedDate
  });
})();
