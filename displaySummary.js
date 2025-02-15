// displaySummary.js

(function() {
  // Check if document is available; if not, log and abort.
  if (typeof document === "undefined") {
    console.error("displaySummary.js: document is not defined, aborting execution.");
    return;
  }
  
  // Function to log events from this content script
  function logEvent(message) {
    try {
      chrome.runtime.sendMessage({ action: "log", message: "displaySummary.js: " + message });
    } catch (e) {
      console.error("Logging failed:", e);
    }
  }
  logEvent("Injected and running.");

  // Remove any existing sidebar so we can inject a fresh one
  const existingSidebar = document.getElementById('summary-sidebar');
  if (existingSidebar) {
    logEvent("Existing sidebar found; removing it for new summary.");
    existingSidebar.remove();
  }

  // Create the main sidebar
  const sidebar = document.createElement('div');
  sidebar.id = 'summary-sidebar';
  sidebar.style.position = 'fixed';
  sidebar.style.top = '0';
  sidebar.style.right = '0';
  sidebar.style.width = '400px';
  sidebar.style.height = 'calc(100% - 60px)';
  sidebar.style.backgroundColor = '#fff';
  sidebar.style.borderLeft = '1px solid #ccc';
  sidebar.style.zIndex = '99999'; // Increased z-index for visibility
  sidebar.style.overflowY = 'auto';
  sidebar.style.boxShadow = '-2px 0 5px rgba(0,0,0,0.1)';
  sidebar.style.padding = '20px';
  sidebar.style.fontFamily = 'Arial, sans-serif';
  sidebar.style.fontSize = '16px';
  logEvent("Sidebar element created.");

  // Close button for sidebar
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
  closeButton.style.fontSize = '14px';
  closeButton.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    sidebar.remove();
    logEvent("Sidebar closed by user.");
  });
  sidebar.appendChild(closeButton);
  logEvent("Close button appended.");

  // Create a container for the summary
  const summaryContainer = document.createElement('div');
  summaryContainer.id = 'summary-container';

  // Append the sidebar to the document body
  document.body.appendChild(sidebar);
  logEvent("Sidebar appended to the document.");

  // Retrieve summary data from chrome.storage.local
  chrome.storage.local.get(
    ['latestSummary', 'summaryPageUrl', 'pageTitle', 'publishedDate', 'wordCount'],
    (data) => {
      logEvent("Retrieved summary data from storage.");
      const summary = data.latestSummary || 'No summary available.';
      const pageUrl = data.summaryPageUrl || '#';
      const pageTitle = data.pageTitle || 'Summary';
      const publishedDate = data.publishedDate || 'Unknown';
      const wordCount = data.wordCount || 'Unknown';

      // Title at top
      const titleElement = document.createElement('h1');
      titleElement.textContent = `${pageTitle} - Summary`;
      titleElement.style.fontSize = '24px';
      titleElement.style.marginBottom = '10px';
      sidebar.appendChild(titleElement);

      // Info at top
      const infoElement = document.createElement('p');
      infoElement.innerHTML = `
        <strong>Date Published:</strong> ${formatDate(publishedDate)}<br>
        <strong>Original Length:</strong> ${wordCount} words<br>
        <strong>Original Page:</strong> <a href="${pageUrl}" target="_blank">${pageUrl}</a>
      `;
      infoElement.style.fontSize = '14px';
      infoElement.style.marginBottom = '20px';
      sidebar.appendChild(infoElement);

      // "Open TTS" button
      const openTTSButton = document.createElement('button');
      openTTSButton.innerText = 'Open TTS';
      openTTSButton.style.display = 'block';
      openTTSButton.style.marginBottom = '10px';
      openTTSButton.style.cursor = 'pointer';
      openTTSButton.addEventListener('click', () => {
        ttsContainer.style.display = 'block';
        logEvent("TTS container displayed.");
      });
      sidebar.appendChild(openTTSButton);

      // Convert summary markdown to HTML and add to summaryContainer
      const htmlSummary = convertMarkdownToHtml(summary);
      summaryContainer.innerHTML = htmlSummary;
      sidebar.appendChild(summaryContainer);
      logEvent("Summary content appended to sidebar. Summary length: " + summary.length);
    }
  );

  // Format date function
  function formatDate(dateStr) {
    if (!dateStr || dateStr === 'Unknown') {
      return 'Unknown';
    }
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const opts = { hour: 'numeric', minute: 'numeric', hour12: true, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    return d.toLocaleString('en-GB', opts);
  }

  // Convert markdown to HTML function
  function convertMarkdownToHtml(markdown) {
    markdown = markdown.replace(/^### \*(.*)\*/gim, '<h3 style="font-size: 18px; font-style: italic; margin-bottom: 10px;">$1</h3>');
    markdown = markdown.replace(/^## \*(.*)\*/gim, '<h2 style="font-size: 20px; font-weight: bold; margin-bottom: 10px;">$1</h2>');
    markdown = markdown.replace(/^# \*(.*)\*/gim, '<h1 style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">$1</h1>');
    markdown = markdown.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #34495e;">$1</strong>');
    markdown = markdown.replace(/\*(.*?)\*/g, '<em style="font-style: italic;">$1</em>');
    markdown = markdown.replace(/<red>(.*?)<\/red>/g, '<span style="color:#e74c3c">$1</span>');
    markdown = markdown.replace(/<blue>(.*?)<\/blue>/g, '<span style="color:#1e90ff">$1</span>');
    markdown = markdown.replace(/<green>(.*?)<\/green>/g, '<span style="color:#2ecc71">$1</span>');
    markdown = markdown.replace(/<orange>(.*?)<\/orange>/g, '<span style="color:#f39c12">$1</span>');
    markdown = markdown.replace(/\n---\n/g, '<hr>');
    const lines = markdown.split('\n');
    let html = '';
    lines.forEach((line) => {
      if (line.startsWith('<h') || line.startsWith('<p>') || line.trim() === '') {
        html += line;
      } else {
        html += `<p style="font-size: 16px; margin-bottom: 10px;">${line}</p>`;
      }
    });
    return html.trim();
  }

  // TTS Controls Section
  const ttsContainer = document.createElement('div');
  ttsContainer.id = 'tts-controls';
  ttsContainer.style.display = 'none';
  ttsContainer.style.marginTop = '20px';
  ttsContainer.style.padding = '10px';
  ttsContainer.style.borderTop = '1px solid #ccc';

  const closeTTSBtn = document.createElement('button');
  closeTTSBtn.innerText = 'Close TTS';
  closeTTSBtn.style.marginRight = '10px';
  closeTTSBtn.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    ttsContainer.style.display = 'none';
    logEvent("TTS container closed.");
  });
  ttsContainer.appendChild(closeTTSBtn);

  const voiceLabel = document.createElement('label');
  voiceLabel.textContent = 'Voice: ';
  ttsContainer.appendChild(voiceLabel);

  const voiceDropdown = document.createElement('select');
  ttsContainer.appendChild(voiceDropdown);

  ttsContainer.appendChild(document.createTextNode(' '));

  const speedLabel = document.createElement('label');
  speedLabel.textContent = 'Speed (%): ';
  speedLabel.style.marginLeft = '10px';
  ttsContainer.appendChild(speedLabel);

  const speedSlider = document.createElement('input');
  speedSlider.type = 'range';
  speedSlider.min = '50';
  speedSlider.max = '150';
  speedSlider.value = '100';
  ttsContainer.appendChild(speedSlider);

  const speedDisp = document.createElement('span');
  speedDisp.textContent = '100%';
  speedDisp.style.marginLeft = '5px';
  ttsContainer.appendChild(speedDisp);

  ttsContainer.appendChild(document.createElement('br'));

  const playButton = document.createElement('button');
  playButton.textContent = 'Play';
  playButton.style.marginRight = '5px';
  ttsContainer.appendChild(playButton);

  const pauseButton = document.createElement('button');
  pauseButton.textContent = 'Pause';
  pauseButton.style.marginRight = '5px';
  ttsContainer.appendChild(pauseButton);

  const resumeButton = document.createElement('button');
  resumeButton.textContent = 'Resume';
  resumeButton.style.marginRight = '5px';
  ttsContainer.appendChild(resumeButton);

  const stopButton = document.createElement('button');
  stopButton.textContent = 'Stop';
  stopButton.style.marginRight = '5px';
  ttsContainer.appendChild(stopButton);

  sidebar.appendChild(ttsContainer);
  logEvent("TTS controls appended.");

  let availableVoices = [];
  let utterance = null;

  function populateVoices() {
    availableVoices = speechSynthesis.getVoices();
    voiceDropdown.innerHTML = '';
    availableVoices.forEach((voice) => {
      const opt = document.createElement('option');
      opt.value = voice.name;
      opt.textContent = `${voice.name} (${voice.lang})`;
      voiceDropdown.appendChild(opt);
    });
    chrome.storage.sync.get(['defaultVoice'], (data) => {
      if (data.defaultVoice) {
        voiceDropdown.value = data.defaultVoice;
      }
    });
    logEvent("Voices populated for TTS.");
  }
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoices;
  }
  populateVoices();

  speedSlider.addEventListener('input', (e) => {
    speedDisp.textContent = e.target.value + '%';
  });

  function getTextToRead() {
    const container = document.getElementById('summary-container');
    if (!container) return 'No summary available.';
    let text = container.textContent || 'No summary available.';
    const idx = text.indexOf('Overall Summary');
    if (idx !== -1) {
      text = text.substring(idx);
    }
    return text;
  }

  playButton.addEventListener('click', () => {
    if (speechSynthesis.speaking || speechSynthesis.paused) {
      speechSynthesis.cancel();
    }
    const rawText = getTextToRead().trim();
    if (!rawText) return;
    utterance = new SpeechSynthesisUtterance(rawText);
    const chosenVoice = voiceDropdown.value;
    const matched = availableVoices.find(v => v.name === chosenVoice);
    if (matched) utterance.voice = matched;
    utterance.rate = parseFloat(speedSlider.value) / 100;
    speechSynthesis.speak(utterance);
    logEvent("TTS started.");
  });

  pauseButton.addEventListener('click', () => {
    speechSynthesis.pause();
    logEvent("TTS paused.");
  });

  resumeButton.addEventListener('click', () => {
    speechSynthesis.resume();
    logEvent("TTS resumed.");
  });

  stopButton.addEventListener('click', () => {
    speechSynthesis.cancel();
    logEvent("TTS stopped.");
  });

  logEvent("displaySummary.js execution completed.");
})();
