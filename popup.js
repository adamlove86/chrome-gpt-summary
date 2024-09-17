// popup.js

let summaryWindow;

document.getElementById('summariseBtn').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url && currentTab.url.includes('youtube.com/watch')) {
      chrome.tabs.sendMessage(currentTab.id, { action: "extractTranscript" });
    } else if (currentTab && currentTab.id) {
      // Open summary window immediately
      openSummaryWindow(currentTab.url);
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

  chrome.runtime.sendMessage({ action: "summariseText", text: text.trim(), pageUrl: window.location.href, contentType: "text" });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "displaySummary") {
    displaySummary(request.summary, request.pageUrl);
  } else if (request.action === "transcriptError") {
    alert("Error extracting YouTube transcript: " + request.error);
  } else if (request.action === "openSummaryWindow") {
    openSummaryWindow(request.pageUrl);
  } else if (request.action === "displayError") {
    displayError(request.error, request.pageUrl);
  }
});

function openSummaryWindow(pageUrl) {
  summaryWindow = window.open('', '_blank', 'width=600,height=600');

  summaryWindow.document.write(`
    <html>
      <head>
        <title>Summarising...</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-height: 500px; overflow-y: auto; }
          .footer { margin-top: 20px; font-size: 0.9em; color: #555; }
          .footer a { color: #3498db; text-decoration: none; }
        </style>
      </head>
      <body>
        <p>Loading summary...</p>
        <div class="footer">
          <p>Original page: <a href="${pageUrl}" target="_blank">${pageUrl}</a></p>
        </div>
      </body>
    </html>
  `);
  summaryWindow.document.close();
}

function displaySummary(summary, pageUrl) {
  const htmlSummary = convertMarkdownToHtml(summary);

  // Update the summary window content
  if (summaryWindow && !summaryWindow.closed) {
    summaryWindow.document.body.innerHTML = `
      ${htmlSummary}
      <div class="footer">
        <p>Original page: <a href="${pageUrl}" target="_blank">${pageUrl}</a></p>
      </div>
    `;
  } else {
    // If the window wasn't opened, open it now
    openSummaryWindow(pageUrl);
    summaryWindow.document.body.innerHTML = `
      ${htmlSummary}
      <div class="footer">
        <p>Original page: <a href="${pageUrl}" target="_blank">${pageUrl}</a></p>
      </div>
    `;
  }
}

function displayError(errorMessage, pageUrl) {
  // Open a new window to display the error
  const errorWindow = window.open('', '_blank', 'width=600,height=400');

  errorWindow.document.write(`
    <html>
      <head>
        <title>Error</title>
      </head>
      <body>
        <h1>An error occurred</h1>
        <p>${errorMessage}</p>
        <div class="footer">
          <p>Page URL: <a href="${pageUrl}" target="_blank">${pageUrl}</a></p>
        </div>
      </body>
    </html>
  `);
  errorWindow.document.close();
}

function convertMarkdownToHtml(markdown) {
  // Convert headers with italic
  markdown = markdown.replace(/^### \*(.*)\*/gim, '<h3><em>$1</em></h3>');
  markdown = markdown.replace(/^## \*(.*)\*/gim, '<h2><em>$1</em></h2>');
  markdown = markdown.replace(/^# \*(.*)\*/gim, '<h1><em>$1</em></h1>');

  // Convert bold and italic
  markdown = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  markdown = markdown.replace(/\*(.*?)\*/g, '<em>$1</em>');

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
