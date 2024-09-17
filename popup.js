// popup.js

document.getElementById('summariseBtn').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url && currentTab.url.includes('youtube.com/watch')) {
      chrome.tabs.sendMessage(currentTab.id, { action: "extractTranscript" });
    } else if (currentTab && currentTab.id) {
      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: extractTextAndSummarise
      });
    }
  });
});

function extractTextAndSummarise() {
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

  chrome.runtime.sendMessage({ action: "summariseText", text: text.trim(), pageUrl: window.location.href });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "displaySummary") {
    displaySummary(request.summary, request.pageUrl);
  } else if (request.action === "transcriptError") {
    alert("Error extracting YouTube transcript: " + request.error);
  }
});

function displaySummary(summary, pageUrl) {
  const htmlSummary = convertMarkdownToHtml(summary);

  // Open each summary in a new window
  const summaryWindow = window.open('', '_blank', 'width=600,height=600');

  summaryWindow.document.write(`
    <html>
      <head>
        <title>Page Summary</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-height: 500px; overflow-y: auto; }
          h2 { color: #2c3e50; margin-bottom: 20px; }
          ul { padding-left: 20px; list-style-type: none; }
          li { margin-bottom: 10px; }
          li.level-1::before { content: "•"; color: #3498db; display: inline-block; width: 1em; margin-left: -1em; }
          li.level-2::before { content: "◦"; color: #e74c3c; display: inline-block; width: 1em; margin-left: -1em; }
          li.level-3::before { content: "▪"; color: #2ecc71; display: inline-block; width: 1em; margin-left: -1em; }
          .level-2 { margin-left: 20px; }
          .level-3 { margin-left: 40px; }
          strong { color: #34495e; }
          em { font-style: italic; }
          .red { color: #e74c3c; }
          .blue { color: #1e90ff; } /* Brighter blue */
          .green { color: #2ecc71; }
          .orange { color: #f39c12; }
          .footer { margin-top: 20px; font-size: 0.9em; color: #555; }
          .footer a { color: #3498db; text-decoration: none; }
        </style>
      </head>
      <body>
        ${htmlSummary}
        <div class="footer">
          <p>Original page: <a href="${pageUrl}" target="_blank">${pageUrl}</a></p>
        </div>
      </body>
    </html>
  `);
  summaryWindow.document.close();
}

function convertMarkdownToHtml(markdown) {
  // Convert headers
  markdown = markdown.replace(/^## (.*$)/gim, '<h2>$1</h2>');

  // Convert bold and italic
  markdown = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  markdown = markdown.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Convert nested lists
  markdown = markdown.replace(/^(\s*)-\s(.*$)/gim, '<li class="level-1">$2</li>');
  markdown = markdown.replace(/^(\s*)\*\s(.*$)/gim, '<li class="level-2">$2</li>');
  markdown = markdown.replace(/^(\s*)\+\s(.*$)/gim, '<li class="level-3">$2</li>');

  // Wrap lists in <ul> tags
  markdown = markdown.replace(/(<li class="level-\d+">.*<\/li>)/g, '<ul>$1</ul>');

  // Remove extra <ul> tags
  markdown = markdown.replace(/<\/ul>\s*<ul>/g, '');

  // Convert colour syntax
  markdown = markdown.replace(/<red>(.*?)<\/red>/g, '<span class="red">$1</span>');
  markdown = markdown.replace(/<blue>(.*?)<\/blue>/g, '<span class="blue">$1</span>');
  markdown = markdown.replace(/<green>(.*?)<\/green>/g, '<span class="green">$1</span>');
  markdown = markdown.replace(/<orange>(.*?)<\/orange>/g, '<span class="orange">$1</span>');

  // Convert paragraphs
  markdown = markdown.replace(/^\s*(\n)?(.+)/gim, function(m) {
    return (m.trim().length > 0 ? '<p>' + m.trim() + '</p>' : '');
  });

  // Remove extra newlines
  markdown = markdown.replace(/\n\n+/g, '\n\n');

  return markdown.trim();
}
