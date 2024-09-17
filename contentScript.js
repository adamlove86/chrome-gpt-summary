// contentScript.js

(function() {
  // Improved text extraction
  let text = '';
  const elements = document.body.querySelectorAll('*');

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
    contentType: "text"
  });
})();
