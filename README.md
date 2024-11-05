# Chrome Summariser Plugin

A Chrome extension that summarises web pages and YouTube transcripts using GPT-4o-mini. This plugin is designed to help you quickly generate concise and structured summaries directly in your browser.

## Features
- Summarises Web Pages: Quickly summarise any web page's content.
- YouTube Transcript Summaries: Automatically extracts and summarises YouTube transcripts.
- Customisable: Adjust the prompt, model, tokens, and temperature from the plugin's options page.
- Markdown and Colour Syntax: Summaries include Markdown formatting and colour-coded highlights for better readability.

## Installation

### Step 1: Clone or Download the Repository
1. Clone the repository using Git:
   git clone https://github.com/adamlove86/chrome-gpt-summary.git
2. Alternatively, you can download the repository as a ZIP file and extract it.

### Step 2: Load the Extension in Chrome
1. Open Google Chrome and navigate to chrome://extensions/.
2. Enable Developer mode by toggling the switch in the top-right corner.
3. Click on Load unpacked.
4. Browse to the directory where you cloned or extracted the repository and select the folder.

### Step 3: Set Up Your API Key
1. After loading the extension, click on the extension icon in your browser's toolbar.
2. Go to Options.
3. Enter your OpenAI API key.
4. Adjust other settings like the prompt, model, max tokens, and temperature as needed.
5. Click Save Settings.

### Usage
- Summarise Web Pages: Right-click on any web page and select "Summarise with ChatGPT" from the context menu.
- Summarise YouTube Transcripts: When viewing a YouTube video, the plugin will automatically extract the transcript and provide a summary.
- Summarise Selected Text: Highlight any text on a web page, right-click, and select "Summarise with ChatGPT" to summarise just the selected portion.

### Licence
This project is licensed under the GNU General Public Licence v3.0 (GPL-3.0). You may use, distribute, and modify this code under the terms of the GPL-3.0. Commercial use of this software is not permitted without explicit permission from the author. For more details, see the LICENCE file.

### Contributing
Feel free to fork this repository and submit pull requests. Please ensure your contributions are non-commercial and adhere to the project’s licence.

### Issues
If you encounter any issues or have feature requests, please open an issue on the GitHub repository.

Note: This plugin uses the GPT-4o-mini model from OpenAI, which requires an API key. Make sure to sign up on the OpenAI platform to obtain your key.
