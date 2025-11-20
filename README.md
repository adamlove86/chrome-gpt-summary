# Summarise with GPT-4o-mini Chrome Extension

A Chrome extension that summarises web pages, selected text, and YouTube transcripts using the OpenAI API (defaulting to GPT-4o-mini). It also includes ChatGPT integration for asking questions and fact-checking, plus a simple site blocker feature. This plugin is designed to help you quickly generate concise or detailed summaries and verify information directly in your browser.

![Extension Popup](summarise.png)

## Features

- **Web Page Summarization:** Automatically extracts the main content of a web page using Mozilla's Readability library and sends it for summarization.
- **YouTube Transcript Summarization:** Extracts available transcripts from YouTube videos and summarizes them.
- **Selected Text Summarization:** Summarize only the text you highlight on a page.
- **ChatGPT Integration:**
  - **Send to ChatGPT:** Opens ChatGPT in a new tab with the article/video content pre-filled, allowing you to ask follow-up questions interactively.
  - **Fact Check:** Automatically sends content to ChatGPT with a specialized prompt to fact-check key claims using credible sources.
  - Both features use intelligent DOM injection with multiple fallback strategies to ensure compatibility with ChatGPT's interface.
- **Copy to Clipboard:**
  - Copy YouTube transcripts with metadata (title, channel, date, word count).
  - Copy article content with metadata (title, published date, URL, word count).
- **Article & Text Reading (Text-to-Speech):**
  - Read full articles aloud in a sidebar with playback controls.
  - Read only highlighted text aloud using the same on-page reader.
- **Context Menu Integration:**
  - Summarise the current page or highlighted text via right-click.
  - Read full articles or selected text aloud via right-click TTS options.
- **Configurable Summarization:**
  - Choose the OpenAI model (e.g., `gpt-4o-mini`, `gpt-4`, etc.).
  - Set maximum tokens for the summary.
  - Adjust the creativity/randomness using the temperature setting.
  - Define custom system prompts for both general text and YouTube transcript summarization.
- **Site Blocker:** Maintain a list of website origins (e.g., `https://www.example.com`) to block. When visiting a blocked site, the extension attempts to stop the page load. Add sites to the blocklist via the popup or options page.
- **API Key Management:** Securely store your OpenAI API key in Chrome's sync storage or load it locally from a `key.txt` file (useful for development, ignored by `.gitignore`).
- **Debug Logging:** Maintains a detailed log of actions in local storage, which can be downloaded from the options page for troubleshooting.
- **Summary Display:** Shows summaries in a clean overlay on the current page, including metadata like original word count and estimated read time.

## Installation

### 1. Obtain the Code

- **Clone:** Use Git to clone the repository:

  ```bash
  git clone https://github.com/adamlove86/chrome-gpt-summary.git
  cd chrome-gpt-summary
  ```

- **Download:** Alternatively, download the repository as a ZIP file from GitHub and extract it to a local folder.

### 2. Load the Extension in Chrome/Edge

1.  Open your Chrome or Edge browser.
2.  Navigate to the extensions page:
    - Chrome: `chrome://extensions/`
    - Edge: `edge://extensions/`
3.  Enable **Developer mode** using the toggle switch (usually in the top-right corner).
4.  Click the **Load unpacked** button.
5.  Browse to the directory where you cloned or extracted the repository (the folder containing `manifest.json`) and select it.

### 3. Configure the Extension

1.  Click the extension's icon (puzzle piece icon) in your browser toolbar and find the "Summarise with GPT-4o-mini" icon. You might need to pin it for easy access.
2.  Click the extension icon to open the popup.
3.  Go to **Options**.
4.  **API Key:**
    - Enter your OpenAI API key in the designated field. You need an account with OpenAI to get a key.
    - _Alternatively (for development):_ Create a file named `key.txt` in the extension's root directory and paste your API key into it. The extension will prioritize the key from `key.txt` if it exists. **Note:** `key.txt` is included in `.gitignore` and should not be committed.
5.  **Settings:** Adjust the OpenAI model, max tokens, temperature, and custom prompts as desired.
6.  **Blocked Sites:** Manage your list of blocked website origins here.
7.  Click **Save Settings**.

## Usage

### Basic Summarization

1.  **Summarize Current Page:**
    - Navigate to the web page or YouTube video you want to summarize.
    - Click the extension icon in your toolbar.
    - Click the **📄 Summarise Page** button in the popup.
    - _Alternatively:_ Right-click anywhere on the page (not on a link or selected text) and choose "Summarise with ChatGPT" from the context menu.
2.  **Summarize Selected Text:**
    - Highlight the text you want to summarize on any web page.
    - Right-click on the selected text.
    - Choose "Summarise with ChatGPT" from the context menu.

### Reading Articles and Highlighted Text (TTS)

3.  **Read Full Article Aloud (Popup):**
    - Navigate to an article page (non-YouTube).
    - Click the extension icon.
    - Click **🔊 Read Article** to open the sidebar reader and listen to the full article text.
4.  **Read Full Article Aloud (Right-Click):**
    - On an article page, right-click anywhere on the page (not on a link or selected text).
    - Choose **"🔊 Read Article (TTS)"** from the context menu.
5.  **Read Highlighted Text Aloud (Right-Click):**
    - Highlight any text on a page.
    - Right-click on the selection.
    - Choose **"🔊 Read Selected Text (TTS)"** to open the sidebar reader for just that selection.

### ChatGPT Integration

3.  **Send to ChatGPT (Interactive Questions):**
    - Navigate to an article or YouTube video.
    - Click the extension icon.
    - Click the **💬 Send to ChatGPT** button.
    - ChatGPT will open in a new tab with the content pre-filled and auto-submitted.
    - You can then ask follow-up questions about the content.

4.  **Fact Check Content:**
    - Navigate to an article or YouTube video.
    - Click the extension icon.
    - Click the **🔍 Fact Check** button.
    - ChatGPT will open with a specialized fact-checking prompt, analyzing key claims using credible sources.

### Copy to Clipboard

5.  **Copy Transcript/Content:**
    - For YouTube videos: Click **📋 Copy Transcript** to copy the transcript with metadata.
    - For articles: Click **📋 Copy Content** to copy the article text with metadata.

### Site Blocking

6.  **Block Current Site:**
    - Navigate to the site you want to block.
    - Click the extension icon.
    - Click the **🚫 Block Paywall Site** button. Confirm the site origin in the prompt.

### Debug & Settings

7.  **View/Download Debug Logs:**
    - Go to the **⚙️ Options** page.
    - Click the **Download Debug Log** button or **View Recent Logs**.

## Development Notes

- The extension uses a background service worker (`background.js`) for handling API calls, context menus, and message passing.
- Content scripts (`contentScript.js`, `youtubeTranscript.js`, `content_blocker.js`) are injected into pages to extract text, handle transcripts, and block sites.
- ChatGPT integration (`chatgpt_inject.js`) uses ProseMirror-aware DOM manipulation to auto-fill and submit prompts with multiple selector fallbacks.
- `Readability.js` is used for extracting the main article content from web pages.
- Summaries and errors are displayed using dynamically injected scripts (`displaySummary.js`, `displayError.js`).
- Settings are stored using `chrome.storage.sync` (for settings) and `chrome.storage.local` (for logs and latest summary data).

## Technical Details

### ChatGPT Integration Architecture

The extension can automatically open ChatGPT and submit content by:

1. Opening a new tab to `https://chatgpt.com/`
2. Waiting for page load and React initialization
3. Injecting text into a hidden data element
4. Using `chatgpt_inject.js` to:
   - Find ChatGPT's ProseMirror editor (`#prompt-textarea`)
   - Set text in the internal `<p>` element
   - Dispatch proper input events for React compatibility
   - Click the send button (`data-testid="send-button"`)
5. Falling back to clipboard copy if DOM structure changes or user isn't logged in

The system uses multiple selector strategies and retry logic to maintain compatibility as ChatGPT's interface evolves.

## Licence

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

_Previous versions may have been under GPL-3.0, but the current license file is MIT._

## Contributing

Contributions, issues, and feature requests are welcome. Feel free to fork the repository and submit pull requests.

## Disclaimer

This extension uses the OpenAI API and requires a valid API key. Usage costs may apply based on OpenAI's pricing. The site blocking feature attempts to stop page loading but may not be effective against all techniques used by websites.
