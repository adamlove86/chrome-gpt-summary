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
      requestAnimationFrame(() => {
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: "log", message: "displaySummary.js: " + message });
        } else {
            // console.log("displaySummary.js (fallback): " + message);
        }
      });
    } catch (e) {
      // console.error("Logging failed:", e);
    }
  }
  logEvent("Injected and running.");

  // --- Global Variables ---
  let sidebar = null;
  let ttsContainer = null;
  let summaryContainer = null;
  let closeButton = null;
  let openTTSButton = null;
  let closeTTSBtn = null;
  let voiceDropdown = null;
  let speedSlider = null;
  let speedDisp = null;
  let playButton = null;
  let pauseButton = null;
  let resumeButton = null;
  let stopButton = null;

  // TTS State
  let availableVoices = [];
  let utterance = null;
  let currentChunks = [];
  let currentChunkIndex = 0;
  let isPaused = false;
  let ttsInitialized = false;
  let isSpeakingOrPending = false;
  let lastSpokenChunkIndex = -1;
  let highlightSpanClass = 'tts-highlight'; // CSS class for highlighting
  let currentHighlightSpan = null; // Reference to the currently highlighted span
  let stopRequested = false; // Flag to differentiate manual stop from premature end
  let prematureStopRetryCount = 0; // Counter for retries on premature stops
  const MAX_PREMATURE_STOP_RETRIES = 3; // Max retries per chunk

  // --- Initial Setup ---
  cleanupExistingSidebar();
  createSidebarUI();
  appendSidebar();
  loadSummaryAndInit();


  // --- Function Definitions ---

  function cleanupExistingSidebar() {
    const existing = document.getElementById('summary-sidebar');
    if (existing) {
      logEvent("Existing sidebar found; removing it.");
      try {
        if (window.speechSynthesis && typeof window.speechSynthesis.cancel === 'function') {
            window.speechSynthesis.cancel();
        }
      } catch (e) { logEvent("Minor error cancelling speech during cleanup."); }
      existing.remove();
    }
  }

  function createSidebarUI() {
      sidebar = document.createElement('div');
      sidebar.id = 'summary-sidebar';
      // Apply styles...
      sidebar.style.position = 'fixed';
      sidebar.style.top = '0';
      sidebar.style.right = '0';
      sidebar.style.width = '400px';
      sidebar.style.height = '100vh';
      sidebar.style.backgroundColor = '#f9f9f9';
      sidebar.style.borderLeft = '1px solid #ccc';
      sidebar.style.zIndex = '2147483647';
      sidebar.style.overflowY = 'auto';
      sidebar.style.boxShadow = '-3px 0 8px rgba(0,0,0,0.15)';
      sidebar.style.padding = '20px';
      sidebar.style.boxSizing = 'border-box';
      sidebar.style.fontFamily = 'Arial, sans-serif';
      sidebar.style.fontSize = '16px';
      sidebar.style.lineHeight = '1.5';
      logEvent("Sidebar element created.");

      // Close Button (Sidebar)
      closeButton = document.createElement('button');
      closeButton.innerText = '✕';
      closeButton.setAttribute('aria-label', 'Close Summary Sidebar');
      // Apply styles...
      closeButton.style.position = 'absolute';
      closeButton.style.top = '10px';
      closeButton.style.right = '10px';
      closeButton.style.padding = '2px 8px';
      closeButton.style.backgroundColor = '#e74c3c';
      closeButton.style.color = '#fff';
      closeButton.style.border = 'none';
      closeButton.style.borderRadius = '50%';
      closeButton.style.cursor = 'pointer';
      closeButton.style.fontSize = '16px';
      closeButton.style.lineHeight = '1';
      closeButton.style.fontWeight = 'bold';
      closeButton.addEventListener('click', handleCloseSidebar);
      sidebar.appendChild(closeButton);

      // Summary Content Container (APPENDED LATER in loadSummaryAndInit)
      summaryContainer = document.createElement('div');
      summaryContainer.id = 'summary-container';
      summaryContainer.style.marginTop = '10px'; // Adjust spacing as needed
  }

  function appendSidebar() {
    requestAnimationFrame(() => {
      if (document.body) {
        document.body.appendChild(sidebar);
        logEvent("Sidebar appended to the document.");
      } else {
        logEvent("Document body not found, cannot append sidebar.");
      }
    });
  }

  function loadSummaryAndInit() {
    chrome.storage.local.get(
      ['latestSummary', 'summaryPageUrl', 'pageTitle', 'publishedDate', 'wordCount'],
      (data) => {
        if (chrome.runtime.lastError) {
             logEvent(`Error retrieving summary data: ${chrome.runtime.lastError.message}`);
             if (summaryContainer) summaryContainer.innerHTML = `<p style="color: red;">Error loading summary data.</p>`;
             // Append summary container if it wasn't already
             if (sidebar && !sidebar.contains(summaryContainer)) {
                 sidebar.appendChild(summaryContainer);
             }
             return;
        }

        logEvent("Retrieved summary data from storage.");
        const summary = data.latestSummary || 'No summary available.';
        const pageUrl = data.summaryPageUrl || '#';
        const pageTitle = data.pageTitle || 'Summary';
        const publishedDate = data.publishedDate || 'Unknown';
        const wordCount = data.wordCount || 'Unknown';

        // Add Title
        const titleElement = document.createElement('h1');
        titleElement.textContent = `${pageTitle} - Summary`;
        // Apply styles...
        titleElement.style.fontSize = '22px';
        titleElement.style.marginBottom = '15px';
        titleElement.style.marginTop = '30px'; // Space below close button
        titleElement.style.color = '#333';
        sidebar.appendChild(titleElement); // Append title

        // Add Info
        const infoElement = document.createElement('div');
        // Apply styles...
        infoElement.style.fontSize = '13px';
        infoElement.style.marginBottom = '20px';
        infoElement.style.color = '#555';
        infoElement.innerHTML = `
          <p style="margin: 5px 0;"><strong>Published:</strong> ${formatDate(publishedDate)}</p>
          <p style="margin: 5px 0;"><strong>Original Length:</strong> ${wordCount} words</p>
          <p style="margin: 5px 0;"><strong>Original Page:</strong> <a href="${pageUrl}" target="_blank" style="color: #007bff; word-break: break-all;">${pageUrl}</a></p>
        `;
        sidebar.appendChild(infoElement); // Append info

        // Add "Open TTS" button
        openTTSButton = document.createElement('button');
        openTTSButton.innerText = '🔊 Read Summary';
        openTTSButton.setAttribute('aria-label', 'Open Text-to-Speech Controls');
        // Apply styles...
        openTTSButton.style.display = 'block';
        openTTSButton.style.marginBottom = '15px';
        openTTSButton.style.padding = '8px 12px';
        openTTSButton.style.cursor = 'pointer';
        openTTSButton.style.backgroundColor = '#3498db';
        openTTSButton.style.color = 'white';
        openTTSButton.style.border = 'none';
        openTTSButton.style.borderRadius = '4px';
        openTTSButton.style.fontSize = '14px';
        openTTSButton.addEventListener('click', () => {
            if(ttsContainer) ttsContainer.style.display = 'block';
            if (openTTSButton) openTTSButton.style.display = 'none';
            logEvent("TTS container displayed.");
        });
        sidebar.appendChild(openTTSButton); // Append button

        // --- Create TTS Controls HERE, BEFORE summary content ---
        createAndAppendTTSControls();

        // --- Append Summary Content AFTER TTS controls ---
        const textForChunks = getTextToReadFromSummary(summary); // Get raw text first
        currentChunks = splitIntoChunks(textForChunks); // Split text into chunks based on the logic
        summaryContainer.innerHTML = convertTextChunksToHtml(currentChunks); // Convert chunks to HTML spans
        sidebar.appendChild(summaryContainer); // Now append summary container
        logEvent("Summary content added with spans. Chunks: " + currentChunks.length);

        // Inject highlight styles
        addHighlightStyles();

        // Initialize TTS Logic
        initializeTTS();
      }
    );
  }

  function createAndAppendTTSControls() {
      ttsContainer = document.createElement('div');
      ttsContainer.id = 'tts-controls';
      ttsContainer.style.display = 'none'; // Initially hidden
      // Apply styles...
      ttsContainer.style.marginTop = '0px'; // No extra margin needed now
      ttsContainer.style.marginBottom = '20px'; // Space before summary
      ttsContainer.style.padding = '15px';
      ttsContainer.style.borderTop = '1px solid #ccc';
      ttsContainer.style.borderBottom = '1px solid #ccc'; // Add bottom border too
      ttsContainer.style.backgroundColor = '#eee';
      ttsContainer.style.borderRadius = '4px';

      const controlStyles = `margin-right: 8px; margin-bottom: 8px; padding: 6px 10px; font-size: 13px; cursor: pointer; border-radius: 3px; border: 1px solid #ccc;`;

      // Close TTS Button
      closeTTSBtn = document.createElement('button');
      closeTTSBtn.innerText = 'Close TTS'; /* ...styles... */ closeTTSBtn.setAttribute('aria-label', 'Close Text-to-Speech Controls'); closeTTSBtn.style.cssText = controlStyles + `float: right; background-color: #f1f1f1;`;
      ttsContainer.appendChild(closeTTSBtn);

      // Voice Dropdown
      const voiceLabel = document.createElement('label');
      voiceLabel.textContent = 'Voice: '; /* ...styles... */ voiceLabel.style.marginRight = '5px'; voiceLabel.style.fontSize = '13px';
      ttsContainer.appendChild(voiceLabel);
      voiceDropdown = document.createElement('select');
      voiceDropdown.id = 'tts-voice-select'; /* ...styles... */ voiceDropdown.style.cssText = controlStyles + `padding: 6px; max-width: 180px; overflow: hidden; text-overflow: ellipsis;`;
      ttsContainer.appendChild(voiceDropdown);

      // Speed Slider
      const speedLabel = document.createElement('label');
      speedLabel.textContent = 'Speed: '; /* ...styles... */ speedLabel.style.marginLeft = '15px'; speedLabel.style.marginRight = '5px'; speedLabel.style.fontSize = '13px';
      ttsContainer.appendChild(speedLabel);
      speedSlider = document.createElement('input');
      speedSlider.type = 'range'; /* ...styles... */ speedSlider.id = 'tts-speed-slider'; speedSlider.min = '50'; speedSlider.max = '200'; speedSlider.value = '100'; speedSlider.style.verticalAlign = 'middle'; speedSlider.style.cursor = 'pointer'; speedSlider.style.maxWidth = '100px';
      ttsContainer.appendChild(speedSlider);
      speedDisp = document.createElement('span');
      speedDisp.textContent = '100%'; /* ...styles... */ speedDisp.id = 'tts-speed-display'; speedDisp.style.marginLeft = '5px'; speedDisp.style.fontSize = '13px'; speedDisp.style.display = 'inline-block'; speedDisp.style.minWidth = '35px';
      ttsContainer.appendChild(speedDisp);

      // Buttons Row
      ttsContainer.appendChild(document.createElement('br'));
      ttsContainer.appendChild(document.createElement('br'));

      playButton = document.createElement('button');
      playButton.textContent = '▶ Play'; /* ...styles... */ playButton.setAttribute('aria-label', 'Play Summary'); playButton.style.cssText = controlStyles + `background-color: #2ecc71; color: white; border-color: #2ecc71;`;
      ttsContainer.appendChild(playButton);
      pauseButton = document.createElement('button');
      pauseButton.textContent = '❚❚ Pause'; /* ...styles... */ pauseButton.setAttribute('aria-label', 'Pause Summary'); pauseButton.style.cssText = controlStyles + `background-color: #f39c12; color: white; border-color: #f39c12;`;
      ttsContainer.appendChild(pauseButton);
      resumeButton = document.createElement('button');
      resumeButton.textContent = '► Resume'; /* ...styles... */ resumeButton.setAttribute('aria-label', 'Resume Summary'); resumeButton.style.cssText = controlStyles + `background-color: #3498db; color: white; border-color: #3498db;`;
      ttsContainer.appendChild(resumeButton);
      stopButton = document.createElement('button');
      stopButton.textContent = '■ Stop'; /* ...styles... */ stopButton.setAttribute('aria-label', 'Stop Summary'); stopButton.style.cssText = controlStyles + `background-color: #e74c3c; color: white; border-color: #e74c3c;`;
      ttsContainer.appendChild(stopButton);

      // *** Insert TTS container BEFORE the summary container ***
      sidebar.appendChild(ttsContainer); // Append to sidebar structure

      logEvent("TTS controls created and appended.");
  }


  // --- Helper Functions (Formatting, Markdown Conversion) ---
  function formatDate(dateStr) { /* ... (same as before) ... */
    if (!dateStr || dateStr === 'Unknown') return 'Unknown';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const opts = { hour: 'numeric', minute: 'numeric', hour12: true, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
      return d.toLocaleString('en-GB', opts);
    } catch (e) {
      logEvent(`Error formatting date "${dateStr}": ${e}`);
      return dateStr;
    }
  }
  function convertMarkdownToHtml(markdown) {
    // Basic Markdown to HTML conversion (same as before)
    // ... (keep existing conversion logic, but we'll replace its usage)
    // THIS FUNCTION IS NO LONGER THE PRIMARY WAY TO RENDER THE SUMMARY for TTS
    // We now use convertTextChunksToHtml for the main summary content.
    // Keep this function in case it's used elsewhere or for non-TTS display.
    logEvent("convertMarkdownToHtml called (potentially legacy usage).");
    let html = markdown
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')       // Italic
        .replace(/`([^`]+)`/gim, '<code>$1</code>')   // Inline code
        .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank">$1</a>') // Links
        .replace(/^\s*[-*+]\s+(.*)/gim, '<li>$1</li>') // List items
        .replace(/<\/li>\s*<li>/gim, '</li><li>')      // Fix list spacing
        .replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>')   // Wrap lists
        .replace(/<\/ul>\s*<ul>/gim, '')               // Merge adjacent lists
        .replace(/\n/g, '<br>');                       // Paragraphs/line breaks

    return html;
  }

  function getTextToReadFromSummary(summaryMarkdown) {
      // Convert markdown to plain text for accurate chunking and speaking.
      // Remove HTML/Markdown formatting that shouldn't be read aloud.
      logEvent("Extracting plain text from summary markdown.");
      let text = summaryMarkdown
          .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '$1') // Keep link text, remove URL
          .replace(/<[^>]*>/g, ' ')                   // Remove HTML tags
          .replace(/[`*#~]+/g, '')                   // Remove markdown symbols
          .replace(/\s{2,}/g, ' ')                    // Collapse multiple spaces
          .trim();
      logEvent(`Extracted text length: ${text.length}`);
      return text;
  }

  function convertTextChunksToHtml(chunks) {
      // Wrap each chunk in a span for highlighting
      logEvent(`Converting ${chunks.length} text chunks to HTML spans.`);
      return chunks.map((chunk, index) =>
          `<span data-chunk-index="${index}" class="tts-chunk">${escapeHtml(chunk)}</span>`
      ).join(' '); // Join chunks with spaces for natural reading flow
  }

  function escapeHtml(unsafe) {
      if (!unsafe) return '';
      return unsafe
           .replace(/&/g, "&amp;")
           .replace(/</g, "&lt;")
           .replace(/>/g, "&gt;")
           .replace(/"/g, "&quot;")
           .replace(/'/g, "&#039;");
   }

  function addHighlightStyles() {
      const styleId = 'tts-highlight-style';
      if (document.getElementById(styleId)) return; // Style already added

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
          .${highlightSpanClass} {
              background-color: #ffd700; /* Yellow highlight */
              color: #000;
              padding: 0.1em 0;
              margin: -0.1em 0;
              border-radius: 3px;
              box-decoration-break: clone; /* Handle line breaks */
              -webkit-box-decoration-break: clone; /* Safari */
          }
      `;
      document.head.appendChild(style);
      logEvent("Highlight styles injected.");
  }

  // --- TTS Logic ---

  function initializeTTS() {
    if (ttsInitialized) return;
    if ('speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined') {
      logEvent("Attempting to initialize TTS...");
      populateVoices(); // Initial population attempt
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = populateVoices;
      } else {
        logEvent("speechSynthesis.onvoiceschanged not supported.");
      }
      // Defer listener setup slightly to ensure UI elements are definitely rendered
      setTimeout(setupTTSListeners, 50);
      ttsInitialized = true;
      logEvent("TTS Initialized flag set.");
    } else {
      logEvent("Speech Synthesis not supported by this browser.");
      if(ttsContainer) ttsContainer.innerHTML = '<p>Text-to-Speech is not supported.</p>';
    }
  }

  function populateVoices() { /* ... (same as before, ensure voiceDropdown check) ... */
      try {
          availableVoices = speechSynthesis.getVoices();
      } catch (e) {
          logEvent(`Error getting voices: ${e}. TTS might be unavailable.`);
          availableVoices = [];
          if(ttsContainer) ttsContainer.innerHTML = '<p>Could not load voices.</p>';
          return;
      }

      if (!voiceDropdown) {
         logEvent("Voice dropdown not ready during populateVoices.");
         return;
      }
      // Rest of the populateVoices logic (same as before) ...
       if (!availableVoices.length && speechSynthesis.onvoiceschanged === undefined) {
           logEvent("No voices available and onvoiceschanged not supported."); return;
       }
       if (!availableVoices.length) {
           logEvent("No voices available yet, waiting for onvoiceschanged."); return;
       }

      const currentVoiceValue = voiceDropdown.value;
      voiceDropdown.innerHTML = '';

      availableVoices.forEach((voice) => { /* ... (same option creation) ... */
          const opt = document.createElement('option');
          opt.value = voice.name;
          opt.textContent = `${voice.name} (${voice.lang})`;
          if (voice.lang.startsWith('en')) {
              voiceDropdown.insertBefore(opt, voiceDropdown.firstChild);
          } else {
              voiceDropdown.appendChild(opt);
          }
       });

      chrome.storage.sync.get(['defaultVoice'], (data) => { /* ... (same voice setting logic) ... */
          const preferredVoice = data.defaultVoice;
          let voiceToSet = '';
          if (currentVoiceValue && availableVoices.some(v => v.name === currentVoiceValue)) {
              voiceToSet = currentVoiceValue;
          } else if (preferredVoice && availableVoices.some(v => v.name === preferredVoice)) {
              voiceToSet = preferredVoice;
          } else if (voiceDropdown.options.length > 0) {
              voiceToSet = voiceDropdown.options[0].value;
          }
          if (voiceToSet) {
              voiceDropdown.value = voiceToSet;
              logEvent(`Set voice dropdown to: ${voiceToSet}`);
          } else { logEvent("Could not set any voice in dropdown."); }
      });
      logEvent(`Voices populated (${availableVoices.length}).`);
  }

  function setupTTSListeners() {
      if (!speedSlider || !voiceDropdown || !playButton || !pauseButton || !resumeButton || !stopButton || !closeTTSBtn) {
          logEvent("TTS listeners setup failed: One or more UI elements not found.");
          // Attempt to find them again? Or disable TTS?
           console.error("TTS UI elements missing:", { speedSlider, voiceDropdown, playButton /* etc */ });
          return; // Don't attach listeners if elements are missing
      }
      logEvent("Setting up TTS listeners...");

      speedSlider.addEventListener('input', (e) => { /* ... (same) ... */
          const newSpeed = e.target.value;
          if(speedDisp) speedDisp.textContent = newSpeed + '%';
          if (utterance && speechSynthesis.speaking) {
              try { utterance.rate = parseFloat(newSpeed) / 100; }
              catch (err) { logEvent("Could not update rate mid-speech.")}
          }
      });
      voiceDropdown.addEventListener('change', (e) => { /* ... (same) ... */
          const selectedVoice = e.target.value;
          chrome.storage.sync.set({ defaultVoice: selectedVoice }, () => {
              logEvent(`Default voice preference saved: ${selectedVoice}`);
          });
      });
      playButton.addEventListener('click', handlePlay);
      pauseButton.addEventListener('click', handlePause);
      resumeButton.addEventListener('click', handleResume);
      stopButton.addEventListener('click', handleStop);
      closeTTSBtn.addEventListener('click', handleCloseTTS);
      logEvent("TTS listeners attached.");
  }

  function getTextToRead() {
    logEvent("getTextToRead called.");
    if (!summaryContainer) {
        logEvent("getTextToRead: summaryContainer is null.");
        return 'Summary container not found.';
    }
    let text = summaryContainer.innerText || summaryContainer.textContent || '';
    logEvent(`getTextToRead: Found text length: ${text.length}. Preview: "${text.substring(0, 50)}..."`);
    if (!text.trim()) {
        logEvent("getTextToRead: Text content is empty.");
        return 'No summary available.';
    }
    return text.trim();
  }

  function splitIntoChunks(text) {
    if (!text) return [];
    logEvent("Splitting text into chunks...");

    // Split primarily by sentences. Also consider line breaks as potential split points.
    // Regex breakdown:
    // Match sentence-ending punctuation (. ! ?) followed by space/newline and uppercase letter OR end of string.
    // OR match double line breaks.
    // Keep the delimiters.
    // const chunks = text.match( /[^\.!\?\n]+[\.!\?\n]+|\n\n+|[^\.!\?\n]+/g );

    // Simpler approach: Split by sentence endings (.!?), then handle potential long chunks without punctuation.
    // Add a space after delimiters to ensure they are treated as separate 'words' if needed,
    // but use lookbehind/lookahead to not capture the space in the split.
    // Also split on double newlines.
    let chunks = text.split(/(?<=[.!?])\s+|\n\s*\n+/).map(s => s.trim()).filter(s => s.length > 0);

    // Further split very long chunks (e.g., > 250 chars) without punctuation
    const MAX_CHUNK_LENGTH = 250; // Adjust as needed
    let finalChunks = [];
    chunks.forEach(chunk => {
        if (chunk.length > MAX_CHUNK_LENGTH) {
            logEvent(`Chunk too long (${chunk.length}), splitting further: "${chunk.substring(0, 50)}..."`);
            // Split by commas or spaces if chunk is too long
            let subChunks = chunk.split(/(?<=,)\s+/); // Split by comma followed by space
            if (subChunks.length === 1 && chunk.length > MAX_CHUNK_LENGTH) { // Still too long, split by space
                subChunks = chunk.match(new RegExp(`.{1,${MAX_CHUNK_LENGTH}}(\\s|$)`, 'g')) || [chunk];
            }
            finalChunks.push(...subChunks.map(sc => sc.trim()).filter(sc => sc.length > 0));
        } else {
            finalChunks.push(chunk);
        }
    });


    // Clean up empty chunks resulted from splitting
    finalChunks = finalChunks.filter(chunk => chunk.length > 0);
    logEvent(`Split text into ${finalChunks.length} chunks.`);
    return finalChunks.length > 0 ? finalChunks : (text ? [text] : []);
  }

  function speakChunk() {
    logEvent(`speakChunk: Index=${currentChunkIndex}, Chunks=${currentChunks.length}, Paused=${isPaused}, SpeakingPending=${isSpeakingOrPending}, StopReq=${stopRequested}`);
    if (stopRequested || currentChunkIndex >= currentChunks.length) {
      logEvent("speakChunk: Stop requested or all chunks processed.");
      resetTTSState(); return;
    }
    // Don't reset if paused, just return
    if (isPaused) { logEvent("speakChunk: Paused, returning."); return; }
    if (!isSpeakingOrPending) { logEvent("speakChunk: Not active, resetting."); resetTTSState(); return; }

    // Add more checks for robustness
    if (!speechSynthesis) {
      logEvent("speakChunk: speechSynthesis API not available!");
      resetTTSState(); return;
    }

    const textChunk = currentChunks[currentChunkIndex];
    if (!textChunk || textChunk.trim().length === 0) {
      logEvent(`speakChunk: Skipping empty chunk at index ${currentChunkIndex}.`);
      currentChunkIndex++;
      setTimeout(speakChunk, 50); // Move to next chunk quickly
      return;
    }

    utterance = new SpeechSynthesisUtterance(textChunk);
    prematureStopRetryCount = 0; // Reset retry count for the new utterance

    // Voice selection (existing logic)
    try {
      availableVoices = speechSynthesis.getVoices();
    } catch (e) {
      logEvent("Error refreshing voices: " + e.message);
      availableVoices = [];
    }
    const chosenVoiceName = voiceDropdown ? voiceDropdown.value : null;
    const selectedVoice = chosenVoiceName ? availableVoices.find(v => v.name === chosenVoiceName) : null;
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      logEvent(`Using voice: ${selectedVoice.name} (Local: ${selectedVoice.localService})`);
    } else {
      logEvent(`Voice "${chosenVoiceName || 'none'}" invalid or not found, using default.`);
       // Attempt to find a default English voice if available
       const defaultEngVoice = availableVoices.find(v => v.lang.startsWith('en') && v.default);
       if (defaultEngVoice) {
           utterance.voice = defaultEngVoice;
           logEvent(`Falling back to default English voice: ${defaultEngVoice.name}`);
       } else {
           // Let the browser pick its absolute default
           logEvent("No specific default English voice found, using browser default.");
       }
    }
    utterance.rate = speedSlider ? (parseFloat(speedSlider.value) / 100) : 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // --- Event Handlers ---
    utterance.onerror = (event) => {
      console.error("SpeechSynthesisUtterance.onerror Event:", event);
      const errorType = event.error || "unknown error";

      // **FIX:** Check if utterance exists before accessing properties
      const voiceName = utterance && utterance.voice ? utterance.voice.name : 'default (or utterance nulled)';
      const lang = utterance ? (utterance.lang || 'N/A') : 'N/A';
      const textSample = textChunk.substring(0, 100);

      console.error(`TTS Error Details: Type='${errorType}', Chunk Index='${currentChunkIndex}', Voice='${voiceName}', Lang='${lang}', Text='${textSample}...'`);
      logEvent(`TTS error on chunk ${currentChunkIndex + 1}: ${errorType}. Voice: ${voiceName}`);

      let userMessage = `Text-to-speech failed: ${errorType}.`;
      if (errorType === 'network') userMessage += ' Check internet connection or try a local voice.';
      if (errorType === 'synthesis-failed') userMessage += ' Synthesis failed. Try a different voice.';
      if (errorType === 'audio-busy') userMessage += ' Audio device might be busy.';
      if (errorType === 'canceled' && !stopRequested) userMessage = 'Playback was interrupted.';
      else if (errorType === 'canceled' && stopRequested) userMessage = null; // Don't show alert if manually stopped


      // Don't reset state or alert if it was a manual cancellation
      if (errorType !== 'canceled' || !stopRequested) {
          resetTTSState();
          if (userMessage) alert(userMessage);
      } else {
          logEvent("Error was 'canceled' likely due to manual stop/pause, suppressing alert.");
          resetTTSState(); // Still reset state cleanly
      }
    };

    utterance.onend = () => {
      logEvent(`Chunk ${currentChunkIndex + 1} ended. StopReq=${stopRequested}, Paused=${isPaused}, SpeakingPending=${isSpeakingOrPending}, FinalChunk=${currentChunkIndex >= currentChunks.length - 1}`);

      utterance = null; // Clear current utterance reference

      // --- Highlighting Logic ---
      // Remove highlight from the ended chunk IF it was the one highlighted
      if (currentHighlightSpan && currentHighlightSpan.dataset.chunkIndex == currentChunkIndex) {
         removeHighlight();
      }

      // --- Premature Stop / Next Chunk Logic ---
      if (stopRequested) {
          logEvent("onend: Stop was requested, resetting state.");
          resetTTSState();
          return;
      }

      if (isPaused) {
          logEvent("onend: Paused state detected, not advancing.");
          // State remains paused, waiting for resume or stop
          return;
      }

      if (isSpeakingOrPending) {
          if (currentChunkIndex < currentChunks.length - 1) {
              // Advance to the next chunk
              currentChunkIndex++;
              logEvent(`onend: Scheduling next speakChunk (${currentChunkIndex + 1}).`);
              prematureStopRetryCount = 0; // Reset retry count as we successfully moved to the next chunk
              // Small delay before speaking next chunk
              setTimeout(() => {
                  // Re-check state before speaking, might have been stopped/paused during timeout
                  if (isSpeakingOrPending && !isPaused && !stopRequested) {
                      speakChunk();
                  } else {
                      logEvent("speakChunk timeout callback: State changed, not speaking next chunk.");
                      if (!isPaused && !stopRequested) resetTTSState(); // Reset if stopped unexpectedly
                  }
              }, 100); // Delay helps prevent issues where cancel/speak overlap
          } else {
              // This was the last chunk
              logEvent("onend: Last chunk finished normally.");
              resetTTSState();
          }
      } else {
         // --- Handle potential premature stop ---
         // If onend fires but we SHOULD have been speaking (and not paused/stopped)
         // and it wasn't the last chunk, it might be the Chrome bug.
         if (!isPaused && !stopRequested && currentChunkIndex < currentChunks.length - 1) {
            logEvent(`onend: Premature stop detected? Retrying chunk ${currentChunkIndex + 1}. Retry count: ${prematureStopRetryCount}`);
            if (prematureStopRetryCount < MAX_PREMATURE_STOP_RETRIES) {
                prematureStopRetryCount++;
                // We don't increment currentChunkIndex here, retry the SAME chunk
                setTimeout(() => {
                    if (!stopRequested && !isPaused) { // Check state again
                       logEvent(`Retrying speakChunk for index ${currentChunkIndex}`);
                       isSpeakingOrPending = true; // Ensure flag is set before retry
                       speakChunk();
                    } else {
                         logEvent("Premature stop retry aborted due to state change.");
                         resetTTSState();
                    }
                }, 250); // Slightly longer delay for retry
            } else {
                logEvent(`Premature stop retry limit reached for chunk ${currentChunkIndex + 1}. Stopping playback.`);
                alert("Playback stopped unexpectedly. Please try playing again.");
                resetTTSState();
            }
         } else {
             // End event fired, but state indicates we shouldn't be speaking (e.g., manual stop completed)
             logEvent(`onend: Playback finished or stopped. speakingOrPending=${isSpeakingOrPending}, isPaused=${isPaused}, stopRequested=${stopRequested}`);
             if (!isPaused && !stopRequested) { // Ensure reset if not paused or intentionally stopped
                resetTTSState();
             }
         }
      }
    };

    utterance.onstart = () => {
      logEvent(`TTS starting chunk ${currentChunkIndex + 1}/${currentChunks.length}`);
      lastSpokenChunkIndex = currentChunkIndex; // Update last known spoken index
      highlightChunk(currentChunkIndex); // Highlight on start
      prematureStopRetryCount = 0; // Reset retry count on successful start
    };

    utterance.onboundary = (event) => {
        if (event.name === 'sentence' || event.name === 'word') {
             logEvent(`Boundary: Type=${event.name}, Index=${currentChunkIndex}, Char=${event.charIndex}`);
             // Highlight the current chunk based on the boundary event
             highlightChunk(currentChunkIndex);
             // We could potentially use charIndex to highlight words within the chunk later
        }
    };

    // --- Speak ---
    try {
      logEvent(`Calling speak() for chunk ${currentChunkIndex + 1}: "${textChunk.substring(0, 50)}..."`);
      speechSynthesis.speak(utterance);
      // Check status immediately after calling speak
      // Note: 'speaking' might be false briefly even if successful, 'pending' is often true
      setTimeout(() => {
           logEvent(`Status after speak() call (pending=${speechSynthesis.pending}, speaking=${speechSynthesis.speaking}, paused=${speechSynthesis.paused})`);
      }, 0);
    } catch (error) {
      console.error("Error calling speechSynthesis.speak:", error);
      logEvent(`Error calling speak for chunk ${currentChunkIndex + 1}: ${error.message}`);
      resetTTSState();
      alert("An error occurred starting text-to-speech.");
    }
  }

  function highlightChunk(index) {
     requestAnimationFrame(() => {
         const targetSpan = summaryContainer ? summaryContainer.querySelector(`span[data-chunk-index="${index}"]`) : null;

         if (targetSpan) {
             // Only update if the target is different from the current highlight
             if (currentHighlightSpan !== targetSpan) {
                 removeHighlight(); // Remove from previous
                 targetSpan.classList.add(highlightSpanClass);
                 currentHighlightSpan = targetSpan;
                 logEvent(`Highlighted chunk ${index}`);

                 // Optional: Scroll the highlighted element into view
                 // Consider adding checks to only scroll if it's outside the viewport
                 // targetSpan.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
             }
         } else {
             logEvent(`Highlight target span not found for index ${index}`);
             removeHighlight(); // Ensure no lingering highlight if target is missing
         }
     });
 }

 function removeHighlight() {
     if (currentHighlightSpan) {
         currentHighlightSpan.classList.remove(highlightSpanClass);
         logEvent(`Removed highlight from chunk ${currentHighlightSpan.dataset.chunkIndex}`);
         currentHighlightSpan = null;
     }
 }

  function resetTTSState() {
    logEvent("Resetting TTS State...");
    isSpeakingOrPending = false; // Explicitly mark as not speaking
    isPaused = false;
    stopRequested = false; // Reset stop request flag
    prematureStopRetryCount = 0; // Reset retry counter
    // We keep currentChunks and currentChunkIndex as they are for potential resume?
    // No, let's reset them for a clean stop/start
    // currentChunks = []; // Keep chunks if we want resume-from-stop later
    currentChunkIndex = 0; // Reset index to start
    // lastSpokenChunkIndex should persist until next play? Or reset? Reset for now.
    lastSpokenChunkIndex = -1;
    utterance = null; // Clear any utterance object

    removeHighlight(); // Remove any active highlight

     // Only cancel if the engine *thinks* it's doing something.
     if (speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending || speechSynthesis.paused)) {
         try {
             logEvent("Issuing cancel in resetTTSState.");
             speechSynthesis.cancel();
         } catch(e) { logEvent("Minor error during cancel in resetTTSState: " + e.message); }
     }
     logEvent("TTS state reset complete.");
  }

  // --- Button Handlers ---

  function handlePlay() {
    if (!ttsInitialized) { logEvent("Play clicked: TTS not init."); alert("TTS not ready."); return; }
    logEvent(">>> Play button clicked <<<");
    stopRequested = false; // Explicitly allow speaking
    isPaused = false;

    // Stop any current playback robustly first
    handleStop(true); // Pass silent=true to avoid duplicate logging/reset

    // Use a timeout to ensure cancel() completes before starting new playback
    setTimeout(() => {
        logEvent("Starting playback after handlePlay timeout.");
        startPlayback(0); // Start from beginning (index 0)
    }, 200); // Delay might need adjustment
  }

  function startPlayback(startIndex = 0) {
      logEvent(`startPlayback initiated from index ${startIndex}.`);
      stopRequested = false; // Ensure stop flag is false
      isPaused = false;

      // Re-fetch/re-split text only if chunks are empty (e.g., first play)
      // Otherwise, assume we're resuming or replaying the existing summary
      if (!currentChunks || currentChunks.length === 0) {
            const summaryTextElement = document.getElementById('summary-container'); // Re-select in case it was modified
            const rawText = summaryTextElement ? summaryTextElement.innerText : ''; // Get current text content
            if (!rawText || rawText.trim().length === 0) {
                 logEvent(`startPlayback: No valid text found in summary container.`); alert("No summary text to read."); return;
            }
             currentChunks = splitIntoChunks(rawText); // Re-split
             summaryContainer.innerHTML = convertTextChunksToHtml(currentChunks); // Re-render with spans
      }


      if (!currentChunks || currentChunks.length === 0) {
          logEvent("startPlayback: No chunks available after setup."); alert("Could not process text for reading."); return;
      }

      // Validate start index
      currentChunkIndex = (startIndex >= 0 && startIndex < currentChunks.length) ? startIndex : 0;
      logEvent(`Validated start index: ${currentChunkIndex}`);

      isSpeakingOrPending = true; // Mark active
      lastSpokenChunkIndex = currentChunkIndex -1; // Set to before start index
      removeHighlight(); // Clear any previous highlight

      logEvent("startPlayback: Starting TTS via speakChunk...");
      speakChunk(); // Start the sequence
  }

  function handlePause() {
    logEvent(">>> Pause button clicked <<<");
    if (isSpeakingOrPending && !isPaused && speechSynthesis.speaking) {
      isPaused = true;
      stopRequested = false; // Pausing is not stopping
      speechSynthesis.pause();
      logEvent("TTS pause requested.");
    } else { logEvent(`Pause ignored: SpeakingPending=${isSpeakingOrPending}, Paused=${isPaused}, Speaking=${speechSynthesis.speaking}`); }
   }

  function handleResume() {
    logEvent(">>> Resume button clicked <<<");
    if (isSpeakingOrPending && isPaused) { // Check our state flags first
      isPaused = false;
      stopRequested = false;
      logEvent("TTS resume requested.");

      if (speechSynthesis.paused) {
          speechSynthesis.resume();
          logEvent("Called speechSynthesis.resume().");
      } else {
          logEvent("Speech synthesis engine wasn't paused, attempting to restart speakChunk.");
          // If the engine somehow lost state, try restarting the chunk sequence
           // Use lastSpokenChunkIndex if valid, otherwise currentChunkIndex
           const resumeIndex = lastSpokenChunkIndex >= 0 ? lastSpokenChunkIndex : currentChunkIndex;
           logEvent(`Restarting speakChunk from index ${resumeIndex} after resume attempt.`);
           // Don't increment index here, just restart the current/last known chunk
           currentChunkIndex = resumeIndex;
           setTimeout(() => {
               if (isSpeakingOrPending && !isPaused && !stopRequested) { // Check state again
                   speakChunk();
               }
           }, 100);
      }
    } else { logEvent(`Resume ignored: SpeakingPending=${isSpeakingOrPending}, Paused=${isPaused}, EnginePaused=${speechSynthesis.paused}`); }
   }

  function handleStop(silent = false) {
    if (!silent) logEvent(">>> Stop button clicked <<<");
    else logEvent("handleStop called silently.");

    stopRequested = true; // Set flag immediately
    isSpeakingOrPending = false; // Mark inactive
    isPaused = false; // Ensure not paused

    // Cancel synthesis
    try {
        if (speechSynthesis) {
            // Check if there's anything to cancel
            if (speechSynthesis.speaking || speechSynthesis.pending || speechSynthesis.paused) {
                 logEvent("Calling speechSynthesis.cancel()...");
                 speechSynthesis.cancel();
                 // Note: cancel() is async, state update happens after this call returns
            } else {
                 logEvent("speechSynthesis is idle, no need to cancel.");
            }
        }
    } catch (e) { logEvent("Minor error during cancel in handleStop: " + e.message)}

    // Reset state variables immediately after requesting cancel
    // utterance will be cleared in onend/onerror triggered by cancel() or here if needed
    utterance = null;
    currentChunkIndex = 0;
    lastSpokenChunkIndex = -1;
    prematureStopRetryCount = 0;
    removeHighlight();

    if (!silent) logEvent("Stop requested, state flags updated.");
    // Don't call resetTTSState() directly here, let the onend/onerror triggered by cancel() handle final cleanup.
    // If cancel() doesn't trigger events reliably, we might need a fallback reset here after a timeout.
  }

   function handleCloseTTS() {
        logEvent(">>> Close TTS button clicked <<<");
        handleStop(); // Stop TTS
        if(ttsContainer) ttsContainer.style.display = 'none';
        if (openTTSButton) openTTSButton.style.display = 'block';
    }

   function handleCloseSidebar() {
        logEvent(">>> Close Sidebar button clicked <<<");
        handleStop(); // Stop TTS
        if(sidebar) sidebar.remove();
        // Remove injected styles
        const styleElement = document.getElementById('tts-highlight-style');
        if (styleElement) styleElement.remove();
   }

  // Final log
  logEvent("displaySummary.js execution completed.");

})(); // End of IIFE