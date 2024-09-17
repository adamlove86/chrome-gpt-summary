// options.js

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(["apiKey", "prompt", "model", "maxTokens", "temperature", "debug"], (data) => {
    document.getElementById('apiKey').value = data.apiKey || '';
    document.getElementById('prompt').value = data.prompt || getDefaultPrompt();
    document.getElementById('model').value = data.model || 'gpt-4o-mini';
    document.getElementById('maxTokens').value = data.maxTokens || 1000;
    document.getElementById('temperature').value = data.temperature || 0.7;
    document.getElementById('debug').checked = data.debug || false;
  });
});

document.getElementById('settingsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const apiKey = document.getElementById('apiKey').value;
  const prompt = document.getElementById('prompt').value;
  const model = document.getElementById('model').value;
  const maxTokens = parseInt(document.getElementById('maxTokens').value);
  const temperature = parseFloat(document.getElementById('temperature').value);
  const debug = document.getElementById('debug').checked;

  chrome.storage.sync.set({ apiKey, prompt, model, maxTokens, temperature, debug }, () => {
    alert('Settings saved.');
  });
});

function getDefaultPrompt() {
  return `Summarize the following transcript from a YouTube video. Present the summary as a detailed narrative, accurately capturing the key points and flow of the content. Follow these guidelines strictly:

1. **Overview Section**:
   - Begin with a brief summary paragraph covering the main points of the entire video.
   - Use the format: \`0:00:00 - [Video Duration]\` at the beginning of this section.
   - Focus on the main topic and key findings, ensuring the overview reflects the video's primary content without overemphasizing background information.

2. **Detailed Sections**:
   - Break down the content into logical sections based on shifts in topics or themes.
   - Use approximate time stamps for each section (e.g., \`0:00\`, \`1:30\`).
   - Start each section with the relevant time stamp followed by a concise summary of that segment.
   - Ensure that the sections collectively cover the entire video content without omissions.
   - Use complete sentences and maintain a clear, narrative flow.

3. **Formatting Guidelines**:
   - Use **bold** to emphasize important terms, concepts, or breakthroughs.
   - Use *italic* to highlight supplementary or nuanced points.
   - Highlight critical points or warnings using \`<red>\`...\`</red>\`.
   - Highlight key definitions or important concepts using \`<blue>\`...\`</blue>\`.
   - Highlight positive aspects or benefits using \`<green>\`...\`</green>\`.
   - Highlight cautionary notes or potential issues using \`<orange>\`...\`</orange>\`.

4. **Additional Instructions**:
   - Ensure the summary is comprehensive but concise, capturing all essential information without unnecessary detail.
   - Use colors sparingly and ONLY for their designated purposes.
   - Adhere strictly to Markdown syntax for all formatting.
   - Do not omit any important information from the transcript.
   - Ensure that the summary accurately reflects the video's content.`;
}
