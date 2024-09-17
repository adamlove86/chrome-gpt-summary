// summary.js

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['latestSummary', 'summaryPageUrl'], (data) => {
      const summary = data.latestSummary || 'No summary available.';
      const pageUrl = data.summaryPageUrl || '#';
  
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
  