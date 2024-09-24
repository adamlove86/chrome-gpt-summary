// contentScript.js

(function() {
  // Improved text extraction
  let text = '';
  const elements = document.body.querySelectorAll('*');
  const title = document.title;
  let publishedDate = '';

  // Try to extract the published date from meta tags
  const metaTags = document.getElementsByTagName('meta');
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

  // If published date not found, try to extract from visible elements
  if (!publishedDate) {
    const dateElements = document.querySelectorAll('time, .date, .published, .entry-date');
    if (dateElements.length > 0) {
      publishedDate = dateElements[0].innerText.trim();
    }
  }

  elements.forEach(element => {
    const computedStyle = window.getComputedStyle(element);
    if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
      if (element.innerText) {
        text += element.innerText + ' ';
      }
    }
  });

  chrome.runtime.sendMessage({
    action: "summariseText",
    text: text.trim(),
    pageUrl: window.location.href,
    contentType: "text",
    pageTitle: title,
    publishedDate: publishedDate
  });
})();
