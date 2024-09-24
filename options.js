// options.js

document.addEventListener('DOMContentLoaded', () => {
   chrome.storage.sync.get(["apiKey", "youtubePrompt", "textPrompt", "model", "maxTokens", "temperature", "debug"], (data) => {
     document.getElementById('apiKey').value = data.apiKey || '';
     document.getElementById('youtubePrompt').value = data.youtubePrompt || getDefaultYouTubePrompt();
     document.getElementById('textPrompt').value = data.textPrompt || getDefaultTextPrompt();
     document.getElementById('model').value = data.model || 'gpt-4';
     document.getElementById('maxTokens').value = data.maxTokens || 1000;
     document.getElementById('temperature').value = data.temperature || 0.7;
     document.getElementById('debug').checked = data.debug || false;
   });
 });
 
 document.getElementById('settingsForm').addEventListener('submit', (e) => {
   e.preventDefault();
   const apiKey = document.getElementById('apiKey').value;
   const youtubePrompt = document.getElementById('youtubePrompt').value;
   const textPrompt = document.getElementById('textPrompt').value;
   const model = document.getElementById('model').value;
   const maxTokens = parseInt(document.getElementById('maxTokens').value);
   const temperature = parseFloat(document.getElementById('temperature').value);
   const debug = document.getElementById('debug').checked;
 
   chrome.storage.sync.set({ apiKey, youtubePrompt, textPrompt, model, maxTokens, temperature, debug }, () => {
     alert('Settings saved.');
   });
 });
 
 function getDefaultYouTubePrompt() {
   return `Summarise the following transcript from a YouTube video. Present the summary as a detailed narrative, focusing on accurately capturing the key points and flow of the content. The summary should not exceed 500 words. Include section titles for each major point. Follow these guidelines strictly:
 
 1. **Overview Section**:
    - Begin with a brief summary paragraph covering the main points of the entire video.
    - Use the format: \`0:00:00 - [Video Duration]\` at the beginning of this section.
    - Ensure the overview emphasises the main topic and key findings, avoiding excessive focus on background information.
 
 2. **Detailed Sections**:
    - Limit the number of sections to no more than three key areas.
    - *Start each section with a heading in italic*, summarising that segment.
    - Use approximate time stamps for each section (e.g., \`0:00\`, \`1:30\`), if applicable.
    - Ensure that the sections collectively cover the most critical content without unnecessary detail.
    - Use complete sentences and maintain a clear, narrative flow.
 
 3. **Formatting Guidelines**:
    - Use **bold** to emphasise important terms, concepts, or breakthroughs.
    - Use *italic* to highlight supplementary or nuanced points.
    - Highlight critical points or warnings using <red>...</red>.
    - Highlight key definitions or important concepts using <blue>...</blue>.
    - Highlight positive aspects or benefits using <green>...</green>.
    - Highlight cautionary notes or potential issues using <orange>...</orange>.
 
 4. **Additional Instructions**:
    - Ensure the summary is comprehensive but concise, capturing all essential information without unnecessary detail.
    - Use colours sparingly and ONLY for their designated purposes.
    - Adhere strictly to Markdown syntax for all formatting.
    - Do not omit any important information from the transcript.
    - Ensure that the summary reflects the video's actual content accurately.`;
 }
 
 function getDefaultTextPrompt() {
   return `Summarise the following text in a clear and concise manner, focusing on the most important points. The summary should not exceed 500 words. Include section titles for each major point. Present the summary as a detailed narrative with the following guidelines:
 
 1. **Overview Section**:
    - Begin with a brief summary paragraph covering the main points.
    - Do not include time stamps.
    - Ensure the overview emphasises the main topic and key findings, avoiding excessive focus on background information.
 
 2. **Detailed Sections**:
    - Limit the number of sections to no more than three key areas.
    - *Present each section with a heading in italic*, summarising the key points.
    - Use headings without time stamps.
    - Use complete sentences and maintain a clear, narrative flow.
 
 3. **Formatting Guidelines**:
    - Use **bold** to emphasise important terms, concepts, or breakthroughs.
    - Use *italic* to highlight supplementary or nuanced points.
    - Highlight critical points or warnings using <red>...</red>.
    - Highlight key definitions or important concepts using <blue>...</blue>.
    - Highlight positive aspects or benefits using <green>...</green>.
    - Highlight cautionary notes or potential issues using <orange>...</orange>.
 
 4. **Additional Instructions**:
    - Ensure the summary is comprehensive but concise, capturing all essential information without unnecessary detail.
    - Use colours sparingly and ONLY for their designated purposes.
    - Adhere strictly to Markdown syntax for all formatting.
    - Do not omit any important information from the text.
    - Ensure that the summary accurately reflects the content.`;
 }
 