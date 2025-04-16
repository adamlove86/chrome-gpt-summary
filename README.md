# Summarise with GPT-4o-mini Chrome Extension

A Chrome extension that summarises web pages, selected text, and YouTube transcripts using the OpenAI API (defaulting to GPT-4o-mini). It also includes a simple site blocker feature. This plugin is designed to help you quickly generate concise or detailed summaries directly in your browser.

![Extension Popup](summarise.png)

## Features

- **Web Page Summarization:** Automatically extracts the main content of a web page using Mozilla's Readability library and sends it for summarization.
- **YouTube Transcript Summarization:** Extracts available transcripts from YouTube videos and summarizes them.
- **Selected Text Summarization:** Summarize only the text you highlight on a page.
- **Configurable Summarization:**
  - Choose the OpenAI model (e.g., `gpt-4o-mini`, `gpt-4`, etc.).
  - Set maximum tokens for the summary.
  - Adjust the creativity/randomness using the temperature setting.
  - Define custom system prompts for both general text and YouTube transcript summarization.
- **Context Menu Integration:** Access summarization options by right-clicking on a page, selected text, or a link (link summarization currently not implemented).
- **Site Blocker:** Maintain a list of website origins (e.g., `https://www.example.com`) to block. When visiting a blocked site, the extension attempts to stop the page load. Add sites to the blocklist via the popup or options page.
- **API Key Management:** Securely store your OpenAI API key in Chrome's sync storage or load it locally from a `key.txt` file (useful for development, ignored by `.gitignore`).
- **Debug Logging:** Maintains a detailed log of actions in local storage, which can be downloaded from the options page for troubleshooting.
- **Summary Display:** Shows summaries in a clean overlay on the current page, including metadata like original word count and estimated read time (metadata not explicitly confirmed in code, but implied by display script).

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

1.  **Summarize Current Page:**
    - Navigate to the web page or YouTube video you want to summarize.
    - Click the extension icon in your toolbar.
    - Click the **Summarise Page** button in the popup.
    - _Alternatively:_ Right-click anywhere on the page (not on a link or selected text) and choose "Summarise with ChatGPT" from the context menu.
2.  **Summarize Selected Text:**
    - Highlight the text you want to summarize on any web page.
    - Right-click on the selected text.
    - Choose "Summarise with ChatGPT" from the context menu.
3.  **Block Current Site:**
    - Navigate to the site you want to block.
    - Click the extension icon.
    - Click the **Block Current Site** button. Confirm the site origin in the prompt.
4.  **View/Download Debug Logs:**
    - Go to the **Options** page.
    - Click the **Download Debug Log** button.

## Development Notes

- The extension uses a background service worker (`background.js`) for handling API calls, context menus, and message passing.
- Content scripts (`contentScript.js`, `youtubeTranscript.js`, `content_blocker.js`) are injected into pages to extract text, handle transcripts, and block sites.
- `Readability.js` is used for extracting the main article content from web pages.
- Summaries and errors are displayed using dynamically injected scripts (`displaySummary.js`, `displayError.js`).
- Settings are stored using `chrome.storage.sync` (for settings) and `chrome.storage.local` (for logs and latest summary data).

## Licence

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

_Previous versions may have been under GPL-3.0, but the current license file is MIT._

## Contributing

Contributions, issues, and feature requests are welcome. Feel free to fork the repository and submit pull requests.

## Disclaimer

This extension uses the OpenAI API and requires a valid API key. Usage costs may apply based on OpenAI's pricing. The site blocking feature attempts to stop page loading but may not be effective against all techniques used by websites.
