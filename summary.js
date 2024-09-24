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

    // Format the published date
    const formattedPublishedDate = formatPublishedDate(publishedDate);

    // Set the summary info
    const summaryInfoElement = document.getElementById('summaryInfo');
    const siteUrl = new URL(pageUrl).hostname;

    summaryInfoElement.innerHTML = `
      <p><strong>Date Published:</strong> ${formattedPublishedDate}</p>
      <p><strong>Site:</strong> ${siteUrl}</p>
      <p><strong>Original Length:</strong> ${wordCount} words</p>  <!-- Correct word count -->
    `;

    // Convert markdown to HTML
    const htmlSummary = convertMarkdownToHtml(summary);

    document.getElementById('summaryContent').innerHTML = htmlSummary;
    const pageUrlElement = document.getElementById('pageUrl');
    pageUrlElement.href = pageUrl;
    pageUrlElement.textContent = pageUrl;
  });
});

function formatPublishedDate(publishedDate) {
  if (!publishedDate || publishedDate === 'Unknown') {
    return 'Unknown';
  }

  let dateObj = new Date(publishedDate);
  if (isNaN(dateObj.getTime())) {
    // Try parsing with Date.parse
    dateObj = new Date(Date.parse(publishedDate));
  }
  if (isNaN(dateObj.getTime())) {
    // Still invalid, return original string
    return publishedDate;
  }

  // Format date as "6:15pm, Sat, 21 Sept 2024"
  const options = {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  };
  return dateObj.toLocaleString('en-US', options);
}

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

  // Add "---" for separation in articles
  markdown = markdown.replace(/\n---\n/g, '<hr>');

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
