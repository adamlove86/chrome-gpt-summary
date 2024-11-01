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
      <p><strong>Original Length:</strong> ${wordCount} words</p>
    `;

    // Convert markdown to HTML
    const htmlSummary = convertMarkdownToHtml(summary);

    document.getElementById('summaryContent').innerHTML = htmlSummary;
    const pageUrlElement = document.getElementById('pageUrl');
    pageUrlElement.href = pageUrl;
    pageUrlElement.textContent = pageUrl;

    // Store the summary text for TTS
    window.summaryText = stripMarkdown(summary);

    // Fetch available voices and populate the dropdown
    populateVoiceList();

    // Set speech speed from storage
    chrome.storage.sync.get(['speechSpeed'], (settings) => {
      const speed = settings.speechSpeed || 100;
      document.getElementById('speechSpeedSlider').value = speed;
      document.getElementById('speechSpeedDisplay').textContent = `${speed}%`;
    });

    // Add event listeners for play and stop buttons
    document.getElementById('playButton').addEventListener('click', () => {
      speakText(window.summaryText);
    });

    document.getElementById('stopButton').addEventListener('click', () => {
      chrome.tts.stop();
    });

    // Update speech speed display when slider changes
    document.getElementById('speechSpeedSlider').addEventListener('input', (e) => {
      document.getElementById('speechSpeedDisplay').textContent = `${e.target.value}%`;
    });
  });
});

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

function convertMarkdownToHtml(markdown) {
  markdown = markdown.replace(/^### \*(.*)\*/gim, '<h3><em>$1</em></h3>');
  markdown = markdown.replace(/^## \*(.*)\*/gim, '<h2><strong>$1</strong></h2>');
  markdown = markdown.replace(/^# \*(.*)\*/gim, '<h1><strong>$1</strong></h1>');

  markdown = markdown.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  markdown = markdown.replace(/\*(.*?)\*/g, '<em>$1</em>');

  markdown = markdown.replace(/<red>(.*?)<\/red>/g, '<span class="red">$1</span>');
  markdown = markdown.replace(/<blue>(.*?)<\/blue>/g, '<span class="blue">$1</span>');
  markdown = markdown.replace(/<green>(.*?)<\/green>/g, '<span class="green">$1</span>');
  markdown = markdown.replace(/<orange>(.*?)<\/orange>/g, '<span class="orange">$1</span>');

  markdown = markdown.replace(/\n---\n/g, '<hr>');

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

function populateVoiceList() {
  const select = document.getElementById('voiceDropdown');
  chrome.tts.getVoices((voices) => {
    voices.forEach((voice) => {
      const option = document.createElement('option');
      option.value = voice.voiceName;
      option.textContent = `${voice.voiceName} (${voice.lang})`;
      select.appendChild(option);
    });

    // Set default voice from storage
    chrome.storage.sync.get(['defaultVoice'], (settings) => {
      const defaultVoice = settings.defaultVoice || '';
      if (defaultVoice) {
        select.value = defaultVoice;
      }
    });
  });
}

function speakText(text) {
  chrome.storage.sync.get(['defaultVoice', 'speechSpeed'], (settings) => {
    const voiceName = settings.defaultVoice || '';
    const speed = settings.speechSpeed ? settings.speechSpeed / 100 : 1.0;

    chrome.tts.speak(text, {
      voiceName: voiceName,
      rate: speed,
      pitch: 1.0,
      volume: 1.0,
      onEvent: (event) => {
        if (event.type === 'start') {
          console.log('Speech started.');
        } else if (event.type === 'end') {
          console.log('Speech ended.');
        } else if (event.type === 'error') {
          console.error('Error: ' + event.errorMessage);
        }
      }
    });
  });
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1')     // Remove italics
    .replace(/<red>(.*?)<\/red>/g, '$1')
    .replace(/<blue>(.*?)<\/blue>/g, '$1')
    .replace(/<green>(.*?)<\/green>/g, '$1')
    .replace(/<orange>(.*?)<\/orange>/g, '$1')
    .replace(/### \*(.*)\*/g, '$1')
    .replace(/## \*(.*)\*/g, '$1')
    .replace(/# \*(.*)\*/g, '$1')
    .replace(/<hr>/g, '\n---\n');
}
