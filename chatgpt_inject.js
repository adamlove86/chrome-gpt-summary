// chatgpt_inject.js
// This script is injected into the ChatGPT page to fill and submit the prompt

(function() {
  'use strict';
  
  console.log('[ChatGPT Inject] Script started');
  
  // Get the text from the message passed during injection
  const textToSend = document.getElementById('__chatgpt_text_data__')?.textContent;
  if (!textToSend) {
    console.error('[ChatGPT Inject] No text data found');
    return;
  }
  
  console.log('[ChatGPT Inject] Text to send length:', textToSend.length);
  
  // Configuration
  const MAX_RETRIES = 20; // 10 seconds total with 500ms intervals
  const RETRY_INTERVAL = 500;
  let retryCount = 0;
  
  // Multiple selector strategies for different ChatGPT versions
  const TEXTAREA_SELECTORS = [
    '#prompt-textarea',  // ProseMirror editor (current ChatGPT)
    'div[contenteditable="true"]',  // Generic contenteditable
    'textarea[data-id="root"]',
    'textarea[placeholder*="Message"]',
    'textarea[placeholder*="Send a message"]',
    'div[contenteditable="true"][role="textbox"]',
    'textarea.m-0',
    'textarea'
  ];
  
  const BUTTON_SELECTORS = [
    'button[data-testid="send-button"]',  // Current ChatGPT
    'button[aria-label*="Send"]',  // Generic send button
    'button.composer-submit-button',  // Class-based selector
    'button[data-testid="fruitjuice-send-button"]',
    'button svg[data-icon="arrow-up"]',
    'button svg.lucide-arrow-up'
  ];
  
  function findTextarea() {
    for (const selector of TEXTAREA_SELECTORS) {
      const element = document.querySelector(selector);
      if (element) {
        console.log('[ChatGPT Inject] Found textarea with selector:', selector);
        return element;
      }
    }
    return null;
  }
  
  function findSendButton() {
    for (const selector of BUTTON_SELECTORS) {
      const element = document.querySelector(selector);
      if (element) {
        // Check if button is enabled (not disabled)
        const button = element.tagName === 'BUTTON' ? element : element.closest('button');
        if (button && !button.disabled) {
          console.log('[ChatGPT Inject] Found send button with selector:', selector);
          return button;
        }
      }
    }
    return null;
  }
  
  function setTextareaValue(textarea, text) {
    // ChatGPT uses ProseMirror rich text editor
    // The main contenteditable div is #prompt-textarea
    // Inside it is a <p> element that holds the actual content
    
    // Method 1: For ProseMirror (contenteditable div with #prompt-textarea)
    if (textarea.id === 'prompt-textarea' || textarea.getAttribute('contenteditable') === 'true') {
      const p = textarea.querySelector('p');
      if (p) {
        p.textContent = text;
        p.classList.remove('placeholder');
        console.log('[ChatGPT Inject] Text set in ProseMirror paragraph');
      } else {
        // Fallback: set directly on the contenteditable
        textarea.textContent = text;
        textarea.innerText = text;
        console.log('[ChatGPT Inject] Text set directly in contenteditable');
      }
      
      // Dispatch input event
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);
      return;
    }
    
    // Method 2: For regular textarea (fallback)
    if (textarea.tagName === 'TEXTAREA') {
      textarea.value = text;
      
      // For React's internal state
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(textarea, text);
      }
      
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      console.log('[ChatGPT Inject] Text set in textarea');
    }
  }
  
  function attemptFillAndSubmit() {
    const textarea = findTextarea();
    const sendButton = findSendButton();
    
    if (!textarea) {
      retryCount++;
      if (retryCount < MAX_RETRIES) {
        console.log(`[ChatGPT Inject] Textarea not found, retry ${retryCount}/${MAX_RETRIES}`);
        setTimeout(attemptFillAndSubmit, RETRY_INTERVAL);
      } else {
        console.error('[ChatGPT Inject] Failed to find textarea after max retries - copying to clipboard as fallback');
        copyToClipboardFallback();
      }
      return;
    }
    
    // Fill the textarea
    setTextareaValue(textarea, textToSend);
    
    // Focus the textarea to ensure it's active
    textarea.focus();
    
    // Wait a moment for React to update, then try to submit
    setTimeout(() => {
      const button = findSendButton();
      if (button) {
        console.log('[ChatGPT Inject] Clicking send button');
        button.click();
        console.log('[ChatGPT Inject] Message submitted successfully');
      } else {
        console.warn('[ChatGPT Inject] Send button not found or disabled, text filled but not submitted');
        // Text is at least in the box, user can click send manually
      }
    }, 300);
  }
  
  function copyToClipboardFallback() {
    try {
      navigator.clipboard.writeText(textToSend).then(() => {
        console.log('[ChatGPT Inject] Text copied to clipboard as fallback');
        alert('ChatGPT page structure changed. Text copied to clipboard - please paste manually.');
      }).catch(err => {
        console.error('[ChatGPT Inject] Clipboard fallback failed:', err);
      });
    } catch (err) {
      console.error('[ChatGPT Inject] Clipboard API not available:', err);
    }
  }
  
  // Start the process
  attemptFillAndSubmit();
})();

