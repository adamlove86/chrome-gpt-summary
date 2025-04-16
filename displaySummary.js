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
        const htmlSummary = convertMarkdownToHtml(summary);
        summaryContainer.innerHTML = htmlSummary;
        sidebar.appendChild(summaryContainer); // Now append summary container
        logEvent("Summary content added. Length: " + summary.length);

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
  function convertMarkdownToHtml(markdown) { /* ... (same as before) ... */
     if (!markdown) return '';
     markdown = markdown.replace(/^### \*(.*)\*/gim, '<h3 style="font-size: 1.1em; font-style: italic; margin-top: 1em; margin-bottom: 0.5em; color: #444;">$1</h3>');
     markdown = markdown.replace(/^## \*(.*)\*/gim, '<h2 style="font-size: 1.2em; font-weight: bold; margin-top: 1.2em; margin-bottom: 0.6em; color: #333;">$1</h2>');
     markdown = markdown.replace(/^# \*(.*)\*/gim, '<h1 style="font-size: 1.4em; font-weight: bold; margin-top: 1.4em; margin-bottom: 0.7em; color: #222;">$1</h1>');
     markdown = markdown.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #34495e;">$1</strong>');
     markdown = markdown.replace(/\*(.*?)\*/g, '<em>$1</em>');
     markdown = markdown.replace(/<red>(.*?)<\/red>/g, '<span style="color:#e74c3c; font-weight: bold;">$1</span>');
     markdown = markdown.replace(/<blue>(.*?)<\/blue>/g, '<span style="color:#3498db; font-weight: bold;">$1</span>');
     markdown = markdown.replace(/<green>(.*?)<\/green>/g, '<span style="color:#2ecc71; font-weight: bold;">$1</span>');
     markdown = markdown.replace(/<orange>(.*?)<\/orange>/g, '<span style="color:#f39c12; font-weight: bold;">$1</span>');
     markdown = markdown.replace(/\n---\n/g, '<hr style="border: none; border-top: 1px solid #ccc; margin: 1.5em 0;">');
     const lines = markdown.split('\n');
     let html = '';
     let inParagraph = false;
     lines.forEach((line) => {
         const trimmedLine = line.trim();
         if (trimmedLine === '') {
             if (inParagraph) { html += '</p>'; inParagraph = false; }
         } else if (trimmedLine.startsWith('<h') || trimmedLine.startsWith('<hr') || trimmedLine.startsWith('<p>') || trimmedLine.startsWith('</p>') || trimmedLine.startsWith('<div') || trimmedLine.startsWith('</div>')) {
             if (inParagraph) { html += '</p>'; inParagraph = false; }
             html += line + '\n';
         } else {
             if (!inParagraph) { html += '<p style="font-size: 1em; margin-bottom: 0.8em;">'; inParagraph = true; }
             html += line + ' ';
         }
     });
     if (inParagraph) { html += '</p>'; }
     return html.replace(/<\/p>\s*<p/g, '</p><p').trim();
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
    logEvent(`splitIntoChunks called with text length: ${text ? text.length : 0}`);
    if (!text) return [];
    // Split logic (same as before)
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim() !== '');
    let chunks = [];
    const MAX_CHUNK_LENGTH = 300;
    paragraphs.forEach(para => {
      const sentences = para.match(/[^.!?…]+[.!?…]*(?=\s+|\r?\n|$)/g);
      if (sentences) {
        sentences.forEach(sentence => { /* ... (same sub-splitting) ... */
            let currentSentence = sentence.trim();
            while (currentSentence.length > MAX_CHUNK_LENGTH) {
                let splitPos = currentSentence.lastIndexOf(' ', MAX_CHUNK_LENGTH);
                if (splitPos === -1) splitPos = MAX_CHUNK_LENGTH;
                chunks.push(currentSentence.substring(0, splitPos));
                currentSentence = currentSentence.substring(splitPos).trim();
            }
            if (currentSentence.length > 0) chunks.push(currentSentence);
        });
      } else if (para) { /* ... (same paragraph sub-splitting) ... */
        let currentPara = para.trim();
         while (currentPara.length > MAX_CHUNK_LENGTH) {
            let splitPos = currentPara.lastIndexOf(' ', MAX_CHUNK_LENGTH);
            if (splitPos === -1) splitPos = MAX_CHUNK_LENGTH;
            chunks.push(currentPara.substring(0, splitPos));
            currentPara = currentPara.substring(splitPos).trim();
        }
        if (currentPara.length > 0) chunks.push(currentPara);
      }
    });
    chunks = chunks.filter(chunk => chunk.length > 0);
    logEvent(`Split text into ${chunks.length} chunks.`);
    return chunks.length > 0 ? chunks : (text ? [text] : []);
  }

  function speakChunk() {
    logEvent(`speakChunk: Index=${currentChunkIndex}, Chunks=${currentChunks.length}, Paused=${isPaused}, SpeakingPending=${isSpeakingOrPending}`);
    if (currentChunkIndex >= currentChunks.length) {
      logEvent("speakChunk: All chunks processed."); resetTTSState(); return;
    }
    if (isPaused || !isSpeakingOrPending) {
      logEvent(`speakChunk: Bailing out - Paused=${isPaused}, SpeakingPending=${isSpeakingOrPending}`);
      if (!isSpeakingOrPending) resetTTSState(); return;
    }
    // Add more checks for robustness
    if (!speechSynthesis) {
      logEvent("speakChunk: speechSynthesis API not available!");
      resetTTSState(); return;
    }

    const textChunk = currentChunks[currentChunkIndex];
    if (!textChunk || textChunk.trim().length === 0) {
      logEvent(`speakChunk: Skipping empty chunk at index ${currentChunkIndex}.`);
      currentChunkIndex++;
      setTimeout(speakChunk, 50); return;
    }

    utterance = new SpeechSynthesisUtterance(textChunk);

    // Voice selection
    try { 
      availableVoices = speechSynthesis.getVoices(); 
    } catch (e) { 
      logEvent("Error refreshing voices."); 
      availableVoices = []; 
    }
    const chosenVoiceName = voiceDropdown ? voiceDropdown.value : null;
    const selectedVoice = chosenVoiceName ? availableVoices.find(v => v.name === chosenVoiceName) : null;
    if (selectedVoice) { 
      utterance.voice = selectedVoice; 
    } else { 
      logEvent(`Voice "${chosenVoiceName || 'none'}" invalid, using default.`); 
    }
    utterance.rate = speedSlider ? (parseFloat(speedSlider.value) / 100) : 1.0;
    utterance.pitch = 1.0; 
    utterance.volume = 1.0;

    // Event Handlers
    utterance.onerror = (event) => {
      console.error("SpeechSynthesisUtterance.onerror Event:", event);
      const errorType = event.error || "unknown error";
      console.error(`TTS Error Details: Type='${errorType}', Chunk Index='${currentChunkIndex}', Voice='${utterance.voice ? utterance.voice.name : 'default'}', Lang='${utterance.lang || 'N/A'}', Text='${textChunk.substring(0, 100)}...'`);
      logEvent(`TTS error on chunk ${currentChunkIndex + 1}: ${errorType}. Voice: ${utterance.voice ? utterance.voice.name : 'default'}`);
      let userMessage = `Text-to-speech failed: ${errorType}.`;
      if (errorType === 'network') userMessage += ' Check internet connection.';
      if (errorType === 'synthesis-failed') userMessage += ' Try a different voice.';
      if (errorType === 'audio-busy') userMessage += ' Audio device might be busy.';
      resetTTSState(); 
      alert(userMessage);
    };

    utterance.onend = () => {
      logEvent(`Chunk ${currentChunkIndex + 1} ended.`);
      lastSpokenChunkIndex = currentChunkIndex;
      utterance = null;
      
      if (isSpeakingOrPending && !isPaused) {
        if (currentChunkIndex < currentChunks.length - 1) {
          currentChunkIndex++;
          logEvent("onend: Scheduling next speakChunk.");
          // Add a small delay to ensure the previous utterance is fully cleared
          setTimeout(() => {
            if (isSpeakingOrPending && !isPaused) {
              speakChunk();
            }
          }, 100);
        } else {
          logEvent("onend: Last chunk finished.");
          resetTTSState();
        }
      } else {
        logEvent(`onend: Not proceeding: speakingOrPending=${isSpeakingOrPending}, isPaused=${isPaused}`);
      }
    };

    utterance.onstart = () => {
      logEvent(`TTS starting chunk ${currentChunkIndex + 1}/${currentChunks.length}`);
      lastSpokenChunkIndex = currentChunkIndex;
    };

    // Speak
    try {
      logEvent(`Calling speak() for chunk ${currentChunkIndex + 1}: "${textChunk.substring(0, 50)}..."`);
      speechSynthesis.speak(utterance);
      logEvent(`speak() called for chunk ${currentChunkIndex + 1}. Pending=${speechSynthesis.pending}, Speaking=${speechSynthesis.speaking}`);
    } catch (error) {
      console.error("Error calling speechSynthesis.speak:", error);
      logEvent(`Error calling speak for chunk ${currentChunkIndex + 1}: ${error.message}`);
      resetTTSState();
      alert("An error occurred starting text-to-speech.");
    }
  }

  function resetTTSState() { /* ... (same as before, ensure cancel is called cautiously) ... */
    logEvent("Resetting TTS State...");
    currentChunks = [];
    currentChunkIndex = 0;
    isPaused = false;
    isSpeakingOrPending = false;
    lastSpokenChunkIndex = -1;
    utterance = null;
     // Only cancel if the engine *thinks* it's doing something.
     if (speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending || speechSynthesis.paused)) {
         try {
             logEvent("Issuing cancel in resetTTSState.");
             speechSynthesis.cancel();
         } catch(e) { logEvent("Minor error during cancel in resetTTSState."); }
     }
     logEvent("TTS state reset complete.");
  }

  // --- Button Handlers ---

  function handlePlay() {
    if (!ttsInitialized) { logEvent("Play clicked: TTS not init."); alert("TTS not ready."); return; }
    logEvent(">>> Play button clicked <<<");
    handleStop(); // Stop robustly first
    setTimeout(startPlayback, 200); // Increased delay after stop
  }

  function startPlayback() {
      logEvent("startPlayback initiated.");
      resetTTSState(); // Ensure clean state AGAIN after timeout

      const rawText = getTextToRead(); // Get text *after* ensuring state is clean
      if (!rawText || rawText === 'No summary available.' || rawText === 'Summary container not found.') {
          logEvent(`startPlayback: No valid text found: "${rawText}"`); alert("No summary text to read."); return;
      }

      currentChunks = splitIntoChunks(rawText);
      if (!currentChunks || currentChunks.length === 0) {
          logEvent("startPlayback: No chunks created."); alert("Could not process text for reading."); return;
      }

      isPaused = false;
      isSpeakingOrPending = true; // Mark active
      currentChunkIndex = 0;
      lastSpokenChunkIndex = -1; // Reset tracking
      logEvent("startPlayback: Starting TTS...");
      speakChunk(); // Start the first chunk
  }

  function handlePause() { /* ... (same as before) ... */
    logEvent(">>> Pause button clicked <<<");
    if (isSpeakingOrPending && !isPaused && speechSynthesis.speaking) {
      isPaused = true;
      speechSynthesis.pause();
      logEvent("TTS pause requested.");
    } else { logEvent(`Pause ignored: SpeakingPending=${isSpeakingOrPending}, Paused=${isPaused}, Speaking=${speechSynthesis.speaking}`); }
   }
  function handleResume() { /* ... (same as before) ... */
    logEvent(">>> Resume button clicked <<<");
    if (isSpeakingOrPending && isPaused && speechSynthesis.paused) {
      isPaused = false;
      speechSynthesis.resume();
      logEvent("TTS resume requested.");
      if (!speechSynthesis.speaking && !utterance && currentChunkIndex < currentChunks.length) {
        logEvent("Manually starting next chunk after resume.");
        setTimeout(speakChunk, 100);
      }
    } else { logEvent(`Resume ignored: SpeakingPending=${isSpeakingOrPending}, Paused=${isPaused}, SpeakingPaused=${speechSynthesis.paused}`); }
   }
  function handleStop() { /* ... (same robust stop logic) ... */
    logEvent(">>> Stop button clicked <<<");
    isSpeakingOrPending = false; // Mark inactive immediately
    isPaused = false;
    try {
        if (speechSynthesis) {
            logEvent("Calling speechSynthesis.cancel()...");
            speechSynthesis.cancel();
        }
    } catch (e) { logEvent("Minor error during cancel in handleStop.")}
    resetTTSState(); // Reset variables immediately after requesting cancel
   }
   function handleCloseTTS() { /* ... (same as before) ... */
        logEvent(">>> Close TTS button clicked <<<");
        handleStop();
        if(ttsContainer) ttsContainer.style.display = 'none';
        if (openTTSButton) openTTSButton.style.display = 'block';
    }
   function handleCloseSidebar() { /* ... (same as before) ... */
        logEvent(">>> Close Sidebar button clicked <<<");
        handleStop();
        if(sidebar) sidebar.remove();
   }

  // Final log
  logEvent("displaySummary.js execution completed.");

})(); // End of IIFE