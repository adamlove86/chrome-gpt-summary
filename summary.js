// summary.js

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['latestSummary', 'summaryPageUrl', 'originalTextLength', 'pageTitle', 'publishedDate', 'wordCount'], (data) => {
    const summary = data.latestSummary || 'No summary available.';
    const pageUrl = data.summaryPageUrl || '#';
    const pageTitle = data.pageTitle || 'Summary';
    const publishedDate = data.publishedDate || 'Unknown';
    const wordCount = data.wordCount || 'Unknown';

    // Set the page title
    document.title = `${pageTitle} - Summary`;

    // Set the summary title
    document.getElementById('summaryTitle').textContent = `${pageTitle} - Summary`;

    // Set the summary info
    const summaryInfoElement = document.getElementById('summaryInfo');
    const siteUrl = new URL(pageUrl).hostname;

    summaryInfoElement.innerHTML = `
      <p><strong>Date Published:</strong> ${publishedDate}</p>
      <p><strong>Site:</strong> ${siteUrl}</p>
      <p><strong>Original Length:</strong> ${wordCount} words</p>
    `;

    // Convert markdown to HTML
    const htmlSummary = convertMarkdownToHtml(summary);

    document.getElementById('summaryContent').innerHTML = htmlSummary;
    const pageUrlElement = document.getElementById('pageUrl');
    pageUrlElement.href = pageUrl;
    pageUrlElement.textContent = pageUrl;
  });
});

function convertMarkdownToHtml(markdown) {
  // Convert headers with italic
  markdown = markdown.replace(/^### \*(.*)\*/gim, '<h3><em>$1</em></h3>');
  markdown = markdown.replace(/^## \*(.*)\*/gim, '<h2><strong>$1</strong></h2>');
  markdown = markdown.replace(/^# \*(.*)\*/gim, '<h1><strong>$1</strong></h1>');

  // Convert bold and italic
  markdown = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  markdown = markdown.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Convert colour syntax
  markdown = markdown.replace(/<red>(.*?)<\/red>/g, '<span class="red">$1</span>');
  markdown = markdown.replace(/<blue>(.*?)<\/blue>/g, '<span class="blue">$1</span>');
  markdown = markdown.replace(/<green>(.*?)<\/green>/g, '<span class="green">$1</span>');
  markdown = markdown.replace(/<orange>(.*?)<\/orange>/g, '<span class="orange">$1</span>');

  // Convert paragraphs and headings
  const lines = markdown.split('\n');
  let html = '';
  lines.forEach(line => {
    if (line.startsWith('<h') || line.startsWith('<p') || line.trim() === '') {
      html += line;
    } else {
      html += `<p>${line}</p>`;
    }
  });

  return html.trim();
}
