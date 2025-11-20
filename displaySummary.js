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
            chrome.runtime.sendMessage({ action: "log", message: "displaySummary.js: " + message }, () => {
                 // Add a check for lastError in the callback
                 if (chrome.runtime.lastError) {
                     // console.log(`logEvent failed: ${chrome.runtime.lastError.message}. Original message: ${message}`);
                     // Context was invalidated, do nothing further
                 }
            });
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
  let nextButton = null;
  let prevButton = null;

  // TTS State
  let availableVoices = [];
  let utterance = null;
  let currentChunks = [];
  let currentChunkIndex = 0;
  let isPaused = false;
  let ttsInitialized = false;
  let isSpeakingOrPending = false;
  let pausedChunkIndex = -1; // NEW: Store index on pause
  let lastSpokenChunkIndex = -1;
  let highlightSpanClass = 'tts-highlight'; // CSS class for highlighting
  let currentHighlightSpan = null; // Reference to the currently highlighted span
  let stopRequested = false; // Flag to differentiate manual stop from premature end
  let prematureStopRetryCount = 0; // Counter for retries on premature stops
  const MAX_PREMATURE_STOP_RETRIES = 3; // Max retries per chunk
  let cancelInProgress = false; // Flag to prevent speaking while cancel() is processing

  // Remove styleElement as we link instead
  // let styleElement = null;
  const sidebarStyleId = 'summary-sidebar-styles'; // ID for the link element

  // --- Initial Setup ---
  cleanupExistingSidebar();
  injectStyles(); // Inject styles link first
  createSidebarUI();
  appendSidebar(); // This now also triggers applyTheme
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

    // Remove the injected link element
    const existingLink = document.getElementById(sidebarStyleId);
    if (existingLink) {
        existingLink.remove();
        logEvent("Removed existing sidebar stylesheet link.");
    }
  }

  function injectStyles() {
      if (document.getElementById(sidebarStyleId)) {
          logEvent("Sidebar stylesheet link already present.");
          return;
      }
      const linkElement = document.createElement('link');
      linkElement.id = sidebarStyleId;
      linkElement.rel = 'stylesheet';
      linkElement.type = 'text/css';
      linkElement.href = chrome.runtime.getURL('sidebarStyles.css');

      document.head.appendChild(linkElement);
      logEvent("Sidebar CSS link injected into head: " + linkElement.href);
  }

  function createSidebarUI() {
      sidebar = document.createElement('div');
      sidebar.id = 'summary-sidebar';
      // Styles are applied via linked CSS
      logEvent("Sidebar element created (styles via CSS link).");

      // Close Button (Sidebar)
      closeButton = document.createElement('button');
      closeButton.innerText = '✕';
      closeButton.setAttribute('aria-label', 'Close Summary Sidebar');
      closeButton.id = 'summary-sidebar-close-btn';
      closeButton.addEventListener('click', handleCloseSidebar);
      sidebar.appendChild(closeButton);

      // Summary Content Container
      summaryContainer = document.createElement('div');
      summaryContainer.id = 'summary-container';
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
    const maxRetries = 5;
    let retryCount = 0;

    function tryLoadSummary() {
      chrome.storage.local.get(
        [
          'latestSummary',
          'summaryPageUrl',
          'pageTitle',
          'publishedDate',
          'wordCount',
          'modelUsed',
          'fallbackReason',
          // Full-article / mode-specific keys
          'latestFullContent',
          'fullContentPageUrl',
          'fullContentPageTitle',
          'fullContentPublishedDate',
          'fullContentWordCount',
          'summaryType'
        ],
        (data) => {
          if (chrome.runtime.lastError) {
            logEvent(`Error retrieving summary data: ${chrome.runtime.lastError.message}`);
            handleLoadError();
            return;
          }

          // Determine which mode we are in; default to 'summary' for backwards compatibility
          const mode = data.summaryType === 'article' ? 'article' : 'summary';
          const isArticleMode = mode === 'article';

          // Check if we have valid content for the requested mode
          const hasContent = isArticleMode
            ? !!(data.latestFullContent && data.latestFullContent.trim() !== '')
            : !!(data.latestSummary && data.latestSummary !== 'No summary available.');

          if (!hasContent) {
            if (retryCount < maxRetries) {
              retryCount++;
              logEvent(`No sidebar content available yet, retrying in 1 second (attempt ${retryCount}/${maxRetries})...`);
              setTimeout(tryLoadSummary, 1000);
              return;
            } else {
              logEvent("Max retries reached, showing error state");
              handleLoadError();
              return;
            }
          }

          logEvent(`Retrieved sidebar data from storage. Mode: ${mode}`);

          // Derive values depending on whether we're showing an AI summary or full article text
          const isArticle = isArticleMode;

          const summary = isArticle
            ? (data.latestFullContent || '')
            : (data.latestSummary || '');

          const pageUrl = isArticle
            ? (data.fullContentPageUrl || data.summaryPageUrl || '#')
            : (data.summaryPageUrl || '#');

          const pageTitle = isArticle
            ? (data.fullContentPageTitle || data.pageTitle || 'Article')
            : (data.pageTitle || 'Summary');

          const publishedDate = isArticle
            ? (data.fullContentPublishedDate || data.publishedDate || 'Unknown')
            : (data.publishedDate || 'Unknown');

          const wordCount = isArticle
            ? (data.fullContentWordCount || (summary ? summary.trim().split(/\s+/).length : 'Unknown'))
            : (data.wordCount || 'Unknown');

          const modelUsed = isArticle
            ? 'Full article (no AI model)'
            : (data.modelUsed || 'unknown');

          const fallbackReason = isArticle ? '' : (data.fallbackReason || '');

          // Add Title
          const titleElement = document.createElement('h1');
          const titleSuffix = isArticle ? 'Article Reader' : 'Summary';
          titleElement.textContent = `${pageTitle} - ${titleSuffix}`;
          titleElement.id = 'summary-sidebar-title';
          sidebar.appendChild(titleElement);

          // Add Info
          const infoElement = document.createElement('div');
          infoElement.id = 'summary-sidebar-info';
          infoElement.innerHTML = `
            <p><strong>Published:</strong> ${formatDate(publishedDate)}</p>
            <p><strong>Original Length:</strong> ${wordCount} words</p>
            <p><strong>Mode:</strong> ${isArticle ? 'Article (full text, read-only)' : 'Summary (AI-generated)'}</p>
            ${!isArticle ? `<p><strong>Model:</strong> ${escapeHtml(modelUsed)}${fallbackReason ? ` (fallback)` : ''}</p>` : ''}
            ${!isArticle && fallbackReason ? `<p style="color:#e67e22;"><strong>Note:</strong> Fallback reason: ${escapeHtml(fallbackReason)}</p>` : ''}
            <p><strong>Original Page:</strong> <a href="${pageUrl}" target="_blank">${pageUrl}</a></p>
          `;
          sidebar.appendChild(infoElement);

          // Add "Open TTS" button
          openTTSButton = document.createElement('button');
          openTTSButton.innerText = isArticle ? '🔊 Read Article' : '🔊 Read Summary';
          openTTSButton.setAttribute('aria-label', isArticle ? 'Open Article Text-to-Speech Controls' : 'Open Text-to-Speech Controls');
          openTTSButton.id = 'summary-sidebar-open-tts-btn';
          openTTSButton.addEventListener('click', () => {
              if(ttsContainer) ttsContainer.style.display = 'block';
              if (openTTSButton) openTTSButton.style.display = 'none';
              logEvent("TTS container displayed, attempting to autoplay.");
              if (typeof handlePlay === 'function') {
                  handlePlay();
              } else {
                  logEvent("Error: handlePlay function not found for autoplay.");
              }
          });
          sidebar.appendChild(openTTSButton);

          // Create TTS Controls
          createAndAppendTTSControls();

          // Append Summary Content
          const formattedHtml = convertMarkdownToHtml(summary);
          summaryContainer.innerHTML = formattedHtml;
          sidebar.appendChild(summaryContainer); // Now append summary container
          logEvent("Summary content added with formatted HTML.");

          // Inject highlight styles
          addHighlightStyles();

          // Initialize TTS Logic (uses the original summary text for processing)
          const textForChunks = getTextToReadFromSummary(summary);
          currentChunks = splitIntoChunks(textForChunks);
          logEvent("Prepared TTS chunks from original summary. Chunks: " + currentChunks.length);
          initializeTTS();
        }
      );
    }

    function handleLoadError() {
      if (summaryContainer) {
        summaryContainer.innerHTML = `
          <div style="text-align: center; padding: 20px;">
            <p style="color: #e74c3c; margin-bottom: 15px;">Unable to load summary at this time.</p>
            <p>This could be because:</p>
            <ul style="text-align: left; margin: 10px 0;">
              <li>The summary is still being generated</li>
              <li>There was an error in the summarization process</li>
              <li>The content could not be processed</li>
            </ul>
            <p style="margin-top: 15px;">Please try again in a moment.</p>
          </div>
        `;
      }
      if (sidebar && !sidebar.contains(summaryContainer)) {
        sidebar.appendChild(summaryContainer);
      }
    }

    // Start the loading process
    tryLoadSummary();
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

      // Previous Button
      prevButton = document.createElement('button');
      prevButton.textContent = '<< Prev';
      prevButton.setAttribute('aria-label', 'Previous Sentence');
      prevButton.style.cssText = controlStyles + `background-color: #95a5a6; color: white; border-color: #95a5a6; margin-right: 15px;`; // Add spacing
      ttsContainer.appendChild(prevButton);

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

      // Next Button
      nextButton = document.createElement('button');
      nextButton.textContent = 'Next >>';
      nextButton.setAttribute('aria-label', 'Next Sentence');
      nextButton.style.cssText = controlStyles + `background-color: #95a5a6; color: white; border-color: #95a5a6; margin-left: 15px;`; // Add spacing
      ttsContainer.appendChild(nextButton);

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
    if (!markdown) return '';
    logEvent("Converting markdown to HTML for display...");

    // Basic handling of paragraphs (split by double newline)
    const paragraphs = markdown.split(/\n\s*\n+/);

    const htmlBlocks = paragraphs.map(paragraph => {
        let blockHtml = paragraph.trim();

        // Preserve potential code blocks first
        if (blockHtml.startsWith('```')) {
            const lang = blockHtml.match(/^```(\w*)\n?/)?.[1] || '';
            const code = blockHtml.replace(/^```\w*\n?/, '').replace(/\n```$/, '');
            // Escape the code content
            const escapedCode = escapeHtml(code);
            return `<pre><code${lang ? ` class="language-${lang}"` : ''}>${escapedCode}</code></pre>`;
        }

        // Handle Headings (markdown #)
        blockHtml = blockHtml
            .replace(/^###### (.*$)/gim, '<h6>$1</h6>')
            .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
            .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Handle Lists
        // Unordered
        blockHtml = blockHtml.replace(/^\s*[-*+] (.*$)/gim, '<li>$1</li>');
        // Ordered
        blockHtml = blockHtml.replace(/^\s*\d+\. (.*$)/gim, '<li>$1</li>');
        // Wrap consecutive LIs in UL/OL
        // This requires more complex parsing or multiple passes, simplified for now:
        // Wrap blocks that start with <li> in <ul> or <ol> (basic guess)
        if (blockHtml.startsWith('<li>')) {
            // Basic check for ordered list marker somewhere in the original paragraph
            blockHtml = paragraph.match(/^\s*\d+\./) 
                ? `<ol>${blockHtml}</ol>` 
                : `<ul>${blockHtml}</ul>`;
        }

        // Handle Bold and Italic
        blockHtml = blockHtml
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>') // Bold
            .replace(/\*(.*?)\*/gim, '<em>$1</em>'); // Italic

        // Handle Links
        blockHtml = blockHtml.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank">$1</a>');

        // Handle Inline Code
        blockHtml = blockHtml.replace(/`([^`]+)`/gim, '<code>$1</code>');

        // Handle Horizontal Rules
        blockHtml = blockHtml.replace(/^(\*\*\*+|---|___+)$/gim, '<hr>');

        // Convert remaining line breaks within a block to <br>, unless it's a list, heading, or pre block
        if (!blockHtml.match(/^<(h[1-6]|ul|ol|li|pre|hr)/i)) {
            blockHtml = blockHtml.replace(/\n/gim, '<br>');
            // Wrap in <p> if it doesn't look like an existing block element was created
            if (!blockHtml.match(/^<(h[1-6]|ul|ol|li|pre|hr|br)/i)) {
                 blockHtml = `<p>${blockHtml}</p>`;
            }
        }
        // Ensure list items rendered inside lists don't get wrapped in <p>
        blockHtml = blockHtml.replace(/<p><li>/gim, '<li>').replace(/<\/li><\/p>/gim, '</li>');
        blockHtml = blockHtml.replace(/<li><br>/gim, '<li>').replace(/<br><\/li>/gim, '</li>'); // Clean up breaks around LIs

        return blockHtml;
    });

    let finalHtml = htmlBlocks.join('\n\n'); // Join blocks with double newline for spacing

    // Cleanup potential <p><ul>...</ul></p> or <p><ol>...</ol></p>
    finalHtml = finalHtml.replace(/<p>(<(?:ul|ol)>.*?<\/(?:ul|ol)>)<\/p>/gims, '$1');
    // Cleanup potential <p><pre>...</pre></p>
    finalHtml = finalHtml.replace(/<p>(<pre>.*?<\/pre>)<\/p>/gims, '$1');
    // Cleanup potential empty paragraphs
    finalHtml = finalHtml.replace(/<p>\s*<\/p>/gim, '');

    logEvent("Markdown conversion to HTML complete.");
    return finalHtml;
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

      // *** NEW: Remove "Overall Summary" prefix if present for TTS ***
      const prefixToRemove = "Overall Summary";
      if (text.toLowerCase().startsWith(prefixToRemove.toLowerCase())) {
          text = text.substring(prefixToRemove.length).trim();
          // Also remove any leading colon or similar punctuation that might follow
          text = text.replace(/^[\s:.-]+/, ''); 
          logEvent("Removed 'Overall Summary' prefix for TTS.");
      }

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
              background-color: #ffd700 !important; /* Yellow highlight - use !important to override potential dark mode styles */
              color: #000 !important;
              padding: 0.1em 0;
              margin: -0.1em 0;
              border-radius: 3px;
              box-decoration-break: clone; /* Handle line breaks */
              -webkit-box-decoration-break: clone; /* Safari */
          }

          /* Dark Mode Styles */
          #summary-sidebar.dark-mode {
              background-color: #2e2e2e;
              color: #e0e0e0;
              border-left: 1px solid #555;
          }
          #summary-sidebar.dark-mode h1,
          #summary-sidebar.dark-mode h2,
          #summary-sidebar.dark-mode h3 {
              color: #f5f5f5;
          }
          #summary-sidebar.dark-mode div,
          #summary-sidebar.dark-mode p,
          #summary-sidebar.dark-mode span,
          #summary-sidebar.dark-mode label,
          #summary-sidebar.dark-mode li span {
              color: #e0e0e0;
          }
          #summary-sidebar.dark-mode strong {
              color: #f0f0f0;
          }
          #summary-sidebar.dark-mode a {
              color: #7bb3ff;
          }
          #summary-sidebar.dark-mode a:visited {
              color: #b39ddb; /* Lighter purple for visited links */
          }
          #summary-sidebar.dark-mode button {
              background-color: #555;
              color: #e0e0e0;
              border: 1px solid #777;
          }
          #summary-sidebar.dark-mode button:hover {
               background-color: #666;
          }
          #summary-sidebar.dark-mode #tts-controls {
              background-color: #3a3a3a;
              border-top: 1px solid #555;
              border-bottom: 1px solid #555;
          }
          #summary-sidebar.dark-mode select,
          #summary-sidebar.dark-mode input[type="range"] {
              background-color: #444;
              color: #e0e0e0;
              border: 1px solid #666;
          }
          /* Specific button overrides for dark mode */
          #summary-sidebar.dark-mode button[aria-label="Close Summary Sidebar"] {
             background-color: #7c2c2c; /* Darker Red */
             color: #f0f0f0;
          }
           #summary-sidebar.dark-mode button[aria-label="Open Text-to-Speech Controls"] {
             background-color: #2a68a1; /* Darker Blue */
             color: #f0f0f0;
          }
          #summary-sidebar.dark-mode button[aria-label="Close Text-to-Speech Controls"] {
             background-color: #4f4f4f;
             color: #e0e0e0;
          }
           #summary-sidebar.dark-mode button[aria-label="Play Summary"] {
              background-color: #24804d; /* Darker Green */
              color: #f0f0f0;
              border-color: #24804d;
           }
           #summary-sidebar.dark-mode button[aria-label="Pause Summary"] {
              background-color: #a86c0d; /* Darker Orange */
              color: #f0f0f0;
              border-color: #a86c0d;
           }
           #summary-sidebar.dark-mode button[aria-label="Resume Summary"] {
              background-color: #256a9e; /* Darker Blue */
              color: #f0f0f0;
              border-color: #256a9e;
           }
            #summary-sidebar.dark-mode button[aria-label="Stop Summary"] {
              background-color: #9c3428; /* Darker Red */
              color: #f0f0f0;
              border-color: #9c3428;
           }
           /* Styles for Prev/Next Buttons in Dark Mode */
           #summary-sidebar.dark-mode button[aria-label="Previous Sentence"],
           #summary-sidebar.dark-mode button[aria-label="Next Sentence"] {
               background-color: #6c7a7b; /* Darker Grey */
               color: #e0e0e0;
               border-color: #6c7a7b;
           }
      `;
      document.head.appendChild(style);
      logEvent("Highlight and theme styles injected.");
  }

  // --- Theme Detection --- 
  function isDarkMode() {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          logEvent("Dark mode detected via prefers-color-scheme.");
          return true;
      }
      // Fallback: Check body background color
      try {
          const bodyBgColor = window.getComputedStyle(document.body).backgroundColor;
          const rgb = bodyBgColor.match(/\d+/g);
          if (rgb && rgb.length >= 3) {
              // Simple brightness check (sum of RGB values)
              const brightness = parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2]);
              if (brightness < 382) { // Threshold for darkness (adjust if needed)
                   logEvent(`Dark mode detected via body background color: ${bodyBgColor} (Brightness: ${brightness})`);
                   return true;
              }
          }
      } catch (e) {
          logEvent("Could not determine theme from body background color: " + e.message);
      }
      logEvent("Defaulting to light mode.");
      return false;
  }

  function applyTheme() {
       if (!sidebar) return;
       if (isDarkMode()) {
           sidebar.classList.add('dark-mode');
           logEvent("Applied dark mode class to sidebar.");
       } else {
           sidebar.classList.remove('dark-mode');
           logEvent("Ensured dark mode class is not present on sidebar.");
       }
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
      if (!speedSlider || !voiceDropdown || !playButton || !pauseButton || !resumeButton || !stopButton || !closeTTSBtn || !prevButton || !nextButton) {
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
      prevButton.addEventListener('click', handlePreviousChunk);
      nextButton.addEventListener('click', handleNextChunk);
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
    logEvent(`speakChunk: Index=${currentChunkIndex}, Chunks=${currentChunks.length}, Paused=${isPaused}, SpeakingPending=${isSpeakingOrPending}, StopReq=${stopRequested}, CancelInProgress=${cancelInProgress}`);

    // *** Prevent speaking if a cancel operation is still potentially processing ***
    if (cancelInProgress) {
        logEvent("speakChunk: Bailed out - cancel operation likely in progress.");
        return;
    }

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
      const errorType = event.error || "unknown error";
      const voiceName = utterance && utterance.voice ? utterance.voice.name : 'default (or utterance nulled)';
      const lang = utterance ? (utterance.lang || 'N/A') : 'N/A';
      const textSample = textChunk.substring(0, 100);

      // **Refined Handling for Interruptions**
      if (errorType === 'interrupted') {
        // Log intentional interruptions less severely, avoid console.error
        logEvent(`TTS playback interrupted (likely manual stop). Chunk: ${currentChunkIndex}, Voice: ${voiceName}, Text: "${textSample}..."`);
        // We might still need to reset state if the interruption wasn't handled cleanly by onend
        if (!stopRequested && !isPaused) { 
          // If an interruption happens unexpectedly (not via our stop/pause logic)
          logEvent("Interruption occurred outside of known stop/pause, resetting state.");
          resetTTSState(); 
        }
        cancelInProgress = false; // Assume cancel is done if interrupted
      } else {
        // Log other errors more prominently using console.error
        console.error("SpeechSynthesisUtterance.onerror Event:", event);
        console.error(`TTS Error Details: Type='${errorType}', Chunk Index='${currentChunkIndex}', Voice='${voiceName}', Lang='${lang}', Text='${textSample}...'`);
        logEvent(`TTS error on chunk ${currentChunkIndex + 1}: ${errorType}. Voice: ${voiceName}`);

        let userMessage = `Text-to-speech failed: ${errorType}.`;
        if (errorType === 'network') userMessage += ' Check internet connection or try a local voice.';
        if (errorType === 'synthesis-failed') userMessage += ' Synthesis failed. Try a different voice.';
        if (errorType === 'audio-busy') userMessage += ' Audio device might be busy.';
        // Handle 'canceled' specifically if needed, although 'interrupted' is more common for stops.
        if (errorType === 'canceled' && stopRequested) userMessage = null; // Don't show alert if manually stopped

        // Don't reset state or alert if it was a manual cancellation handled elsewhere
        if ((errorType !== 'canceled' && errorType !== 'interrupted') || !stopRequested) {
            resetTTSState();
            if (userMessage) {
                logEvent(`TTS Playback Issue (Not Alerting User): ${userMessage}`);
            }
        } else {
            logEvent(`Error was '${errorType}' likely due to manual stop/pause, suppressing alert/reset.`);
            cancelInProgress = false; // Cancellation seems complete
        }
      }
    };

    utterance.onend = () => {
      logEvent(`Chunk ${currentChunkIndex + 1} ended. StopReq=${stopRequested}, Paused=${isPaused}, SpeakingPending=${isSpeakingOrPending}, FinalChunk=${currentChunkIndex >= currentChunks.length - 1}, CancelInProgress=${cancelInProgress}`);

      utterance = null; // Clear current utterance reference

      // --- Highlighting Logic ---
      // Remove highlight from the ended chunk IF it was the one highlighted
      if (currentHighlightSpan && currentHighlightSpan.dataset.chunkIndex == currentChunkIndex) {
         removeHighlight();
      }

      // --- Premature Stop / Next Chunk Logic ---
      if (stopRequested) {
          logEvent("onend: Stop was requested, resetting state.");
          cancelInProgress = false; // Cancellation seems complete
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

  // NEW Helper function to handle restarting playback from the highlighted chunk
  function restartPlaybackFromHighlight() {
    logEvent("Executing restartPlaybackFromHighlight...");
    let resumeIndex = -1;

    // Try getting index from the highlighted span
    if (currentHighlightSpan && currentHighlightSpan.dataset.chunkIndex) {
        resumeIndex = parseInt(currentHighlightSpan.dataset.chunkIndex, 10);
        logEvent(`Attempting restart from highlighted chunk index: ${resumeIndex}`);
    } else {
        // Fallback: try restarting from the chunk *after* the last known successful start
        resumeIndex = lastSpokenChunkIndex + 1;
        logEvent(`Highlight span not found, falling back to index after last spoken: ${resumeIndex}`);
    }

    // Validate index
    if (resumeIndex >= 0 && resumeIndex < currentChunks.length) {
        // Stop any residual activity first (belt and suspenders)
        handleStop(true); // Silent stop
        // Use timeout to allow cancel to process before starting again
        setTimeout(() => {
             logEvent(`Restarting playback via startPlayback(${resumeIndex}) after timeout.`);
             startPlayback(resumeIndex);
        }, 150); // Delay to ensure stop/cancel finishes
    } else {
        logEvent(`Invalid resume index calculated: ${resumeIndex}. Cannot restart. Resetting.`);
        resetTTSState(); // Reset fully if we can't determine where to resume
    }
  }

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
    }, 250); // *** Increased delay slightly ***
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
    // Only pause if actively speaking
    if (isSpeakingOrPending && !isPaused && speechSynthesis.speaking) {
      logEvent(`State before pause: isPaused=${isPaused}, isSpeakingOrPending=${isSpeakingOrPending}, synth.speaking=${speechSynthesis.speaking}`);
      // Store the current index BEFORE pausing
      pausedChunkIndex = currentChunkIndex;
      isPaused = true;
      stopRequested = false; // Pausing is not stopping
      // Keep the highlight on the paused chunk
      logEvent(`Storing pausedChunkIndex: ${pausedChunkIndex}. Keeping highlight.`);

      try {
          speechSynthesis.pause();
          logEvent("TTS pause requested.");
      } catch (e) {
          logEvent(`Error calling pause: ${e.message}. Resetting state.`);
          resetTTSState();
      }
    } else { 
        logEvent(`Pause ignored: SpeakingPending=${isSpeakingOrPending}, Paused=${isPaused}, Speaking=${speechSynthesis.speaking}`); 
    }
   }

  function handleResume() {
    logEvent(">>> Resume button clicked <<<");
    logEvent(`State before resume: isPaused=${isPaused}, pausedChunkIndex=${pausedChunkIndex}, isSpeakingOrPending=${isSpeakingOrPending}, synth.paused=${speechSynthesis.paused}`);

    if (isPaused) {
        // We were intentionally paused
        isPaused = false;
        stopRequested = false;
        cancelInProgress = false;
        logEvent("Attempting to resume from paused state...");

        if (speechSynthesis.paused) {
             // Browser thinks it's paused, try resuming natively
             try {
                 speechSynthesis.resume();
                 logEvent("Called speechSynthesis.resume(). State might take time to update.");
                 // We optimistically assume resume worked. If speech doesn't actually start,
                 // subsequent checks or the onend handler with retry might catch it.
                 // OR, we could add a setTimeout check here:
                 // setTimeout(() => {
                 //    if (!speechSynthesis.speaking && isSpeakingOrPending) {
                 //        logEvent("Resume call didn't seem to start speech. Forcing playback from paused index.");
                 //        startPlayback(pausedChunkIndex);
                 //    }
                 // }, 150);
             } catch (e) {
                 logEvent(`Error calling speechSynthesis.resume(): ${e.message} - Forcing playback from paused index.`);
                 // If resume call itself fails, force start from the stored index
                 startPlayback(pausedChunkIndex);
             }
        } else {
            // Browser wasn't paused, even though our flag was set.
            // This indicates an unexpected stop occurred while we thought we were paused,
            // or the pause command didn't register correctly.
            logEvent("Inconsistent state: isPaused flag was true, but browser wasn't paused. Forcing playback from stored paused index.");
            startPlayback(pausedChunkIndex);
        }
        // Reset paused index after attempting resume
        pausedChunkIndex = -1; 

    } else if (isSpeakingOrPending) {
         // Resume clicked while speaking - essentially do nothing?
         logEvent("Resume clicked while already speaking. Ignoring.");
    } else {
        // Resume clicked while completely stopped - treat as Play
        logEvent("Resume clicked when not active. Treating as Play.");
        handlePlay();
    }
}

  function handleStop(silent = false) {
    if (!silent) logEvent(">>> Stop button clicked <<<");
    else logEvent("handleStop called silently.");

    cancelInProgress = true; // *** Set flag immediately ***
    stopRequested = true; // Set flag immediately
    isSpeakingOrPending = false; // Mark inactive
    isPaused = false; // Ensure not paused
    pausedChunkIndex = -1; // Reset paused index on stop

    // --- Aggressive State Reset --- 
    // Reset crucial state immediately, don't wait for async events
    utterance = null; 
    currentChunkIndex = 0;
    lastSpokenChunkIndex = -1;
    prematureStopRetryCount = 0;
    removeHighlight();
    logEvent("Immediate state reset in handleStop (except cancel call).");
    // --- End Aggressive State Reset ---

    // Cancel synthesis
    try {
        if (speechSynthesis) {
            // Check if there's anything to cancel
            if (speechSynthesis.speaking || speechSynthesis.pending || speechSynthesis.paused) {
            logEvent("Calling speechSynthesis.cancel()...");
            speechSynthesis.cancel();
                 // cancel() is async, subsequent onend/onerror with 'canceled' error should fire
                 // but we've already reset most state above.
            } else {
                 logEvent("speechSynthesis is idle, no need to cancel.");
                 cancelInProgress = false; // *** Reset flag if cancel wasn't needed ***
            }
        }
    } catch (e) { logEvent("Minor error during cancel in handleStop: " + e.message)}

    // Reset state variables immediately after requesting cancel
    // utterance will be cleared in onend/onerror triggered by cancel() or here if needed
    // utterance = null; // Moved above
    // currentChunkIndex = 0; // Moved above
    // lastSpokenChunkIndex = -1; // Moved above
    // prematureStopRetryCount = 0; // Moved above
    // removeHighlight(); // Moved above

    if (!silent) logEvent("Stop requested, cancel called if necessary.");
    // We are no longer primarily relying on async events for state reset after stop.
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
        // Remove injected stylesheet link
        const styleLink = document.getElementById(sidebarStyleId); 
        if (styleLink) {
             styleLink.remove();
             logEvent("Removed sidebar stylesheet link from head.");
        }
   }

  // NEW: Handler for Previous Chunk button
  function handlePreviousChunk() {
      logEvent(">>> Previous Chunk button clicked <<<");
      if (currentChunkIndex > 0) {
          const targetIndex = currentChunkIndex - 1;
          logEvent(`Attempting to move to previous chunk: Index ${targetIndex}`);
          handleStop(true); // Stop current speech silently
          setTimeout(() => startPlayback(targetIndex), 150); // Start playback from previous index after delay
      } else {
          logEvent("Already at the first chunk.");
          // Optionally, restart the first chunk?
          // handleStop(true);
          // setTimeout(() => startPlayback(0), 150);
      }
  }

  // NEW: Handler for Next Chunk button
  function handleNextChunk() {
      logEvent(">>> Next Chunk button clicked <<<");
      if (currentChunkIndex < currentChunks.length - 1) {
          const targetIndex = currentChunkIndex + 1;
          logEvent(`Attempting to move to next chunk: Index ${targetIndex}`);
          handleStop(true); // Stop current speech silently
          setTimeout(() => startPlayback(targetIndex), 150); // Start playback from next index after delay
      } else {
          logEvent("Already at the last chunk.");
          // Optionally stop here? Or let it finish if playing?
          handleStop(true); // Stop if user clicks next on last chunk
      }
  }

  // Final log
  logEvent("displaySummary.js execution completed.");

})(); // End of IIFE