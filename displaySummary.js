// displaySummary.js

(function() {
    // Check if the sidebar already exists
    if (document.getElementById('summary-sidebar')) {
      return;
    }
  
    // Create the sidebar div
    const sidebar = document.createElement('div');
    sidebar.id = 'summary-sidebar';
    sidebar.style.position = 'fixed';
    sidebar.style.top = '0';
    sidebar.style.right = '0';
    sidebar.style.width = '400px';
    sidebar.style.height = '100%';
    sidebar.style.backgroundColor = '#fff';
    sidebar.style.borderLeft = '1px solid #ccc';
    sidebar.style.zIndex = '9999';
    sidebar.style.overflowY = 'scroll';
    sidebar.style.boxShadow = '-2px 0 5px rgba(0,0,0,0.1)';
    sidebar.style.padding = '20px';
    sidebar.style.fontFamily = 'Arial, sans-serif';
  
    // Create a close button
    const closeButton = document.createElement('button');
    closeButton.innerText = 'Close';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '10px';
    closeButton.style.padding = '5px 10px';
    closeButton.style.backgroundColor = '#e74c3c';
    closeButton.style.color = '#fff';
    closeButton.style.border = 'none';
    closeButton.style.cursor = 'pointer';
    closeButton.addEventListener('click', () => {
      sidebar.parentNode.removeChild(sidebar);
    });
    sidebar.appendChild(closeButton);
  
    // Create a container for the summary
    const summaryContainer = document.createElement('div');
    summaryContainer.id = 'summary-container';
    sidebar.appendChild(summaryContainer);
  
    // Append the sidebar to the body
    document.body.appendChild(sidebar);
  
    // Retrieve the summary from chrome.storage.local
    chrome.storage.local.get(['latestSummary', 'summaryPageUrl', 'originalTextLength', 'pageTitle', 'publishedDate', 'wordCount'], (data) => {
      const summary = data.latestSummary || 'No summary available.';
      const pageUrl = data.summaryPageUrl || '#';
      const pageTitle = data.pageTitle || 'Summary';
      const publishedDate = data.publishedDate || 'Unknown';
      const wordCount = data.wordCount || 'Unknown';
  
      // Set the summary title
      const titleElement = document.createElement('h1');
      titleElement.textContent = `${pageTitle} - Summary`;
      sidebar.appendChild(titleElement);
  
      // Set the summary info
      const summaryInfoElement = document.createElement('p');
      summaryInfoElement.innerHTML = `
        <strong>Date Published:</strong> ${formatPublishedDate(publishedDate)}<br>
        <strong>Original Length:</strong> ${wordCount} words<br>
        <strong>Original Page:</strong> <a href="${pageUrl}" target="_blank">${pageUrl}</a>
      `;
      sidebar.appendChild(summaryInfoElement);
  
      // Convert markdown to HTML
      const htmlSummary = convertMarkdownToHtml(summary);
  
      // Set the summary content
      const summaryContent = document.createElement('div');
      summaryContent.innerHTML = htmlSummary;
      sidebar.appendChild(summaryContent);
    });
  
    // Function to format the published date
    function formatPublishedDate(publishedDate) {
      if (!publishedDate || publishedDate === 'Unknown') {
        return 'Unknown';
      }
  
      let dateObj = new Date(publishedDate);
      if (isNaN(dateObj.getTime())) {
        dateObj = new Date(Date.parse(publishedDate));
      }
      if (isNaN(dateObj.getTime())) {
        return publishedDate;
      }
  
      const options = {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      };
      return dateObj.toLocaleString('en-GB', options);
    }
  
    // Function to convert markdown to HTML
    function convertMarkdownToHtml(markdown) {
      // Replace headings
      markdown = markdown.replace(/^### \*(.*)\*/gim, '<h3><em>$1</em></h3>');
      markdown = markdown.replace(/^## \*(.*)\*/gim, '<h2><strong>$1</strong></h2>');
      markdown = markdown.replace(/^# \*(.*)\*/gim, '<h1><strong>$1</strong></h1>');
  
      // Replace bold and italics
      markdown = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      markdown = markdown.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
      // Replace custom color tags
      markdown = markdown.replace(/<red>(.*?)<\/red>/g, '<span style="color:#e74c3c">$1</span>');
      markdown = markdown.replace(/<blue>(.*?)<\/blue>/g, '<span style="color:#1e90ff">$1</span>');
      markdown = markdown.replace(/<green>(.*?)<\/green>/g, '<span style="color:#2ecc71">$1</span>');
      markdown = markdown.replace(/<orange>(.*?)<\/orange>/g, '<span style="color:#f39c12">$1</span>');
  
      // Replace horizontal rules
      markdown = markdown.replace(/\n---\n/g, '<hr>');
  
      // Wrap paragraphs
      const lines = markdown.split('\n');
      let html = '';
      lines.forEach(line => {
        if (line.startsWith('<h') || line.startsWith('<p>') || line.trim() === '') {
          html += line;
        } else {
          html += `<p>${line}</p>`;
        }
      });
  
      return html.trim();
    }
  })();
  