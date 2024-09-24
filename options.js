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
   return `Summarise the following transcript from a YouTube video. Present the summary in a clear and concise manner, adapting the length and detail according to the content. If the transcript is short, provide a single-paragraph summary. For longer transcripts where more detail is needed, follow these guidelines:
 
 1. **Overall Summary**:
    - Begin with a brief paragraph summarising the main points of the entire video.
 
 2. **Section Summaries**:
    - If additional detail is necessary, break the summary into sections.
    - Start each section with a heading that includes the timestamp (e.g., "*Introduction - 0:00*").
    - The sections should be determined based on logical breaks in the content as deemed appropriate.
 
 3. **Formatting Guidelines**:
    - Use **bold** for important terms or concepts.
    - Use *italic* for headings and emphasis.
    - Use appropriate Markdown syntax for formatting.
 
 4. **Additional Instructions**:
    - Decide whether to provide a single-paragraph summary or a multi-paragraph summary based on the length and complexity of the content.
    - Ensure the summary accurately reflects the key points without unnecessary detail.
    - Do not omit any important information from the transcript.
    - Ensure that the summary reflects the video's actual content accurately.`;
 }
 
 function getDefaultTextPrompt() {
   return `Summarise the following text in a clear and concise manner, focusing on the most important points. Adapt the length and detail of the summary based on the length of the text. If the text is short, provide a single-paragraph summary. For longer texts where more detail is needed, follow these guidelines:
 
 1. **Overall Summary**:
    - Begin with a brief paragraph summarising the main points of the entire text.
 
 2. **Section Summaries**:
    - If additional detail is necessary, break the summary into sections.
    - Start each section with a heading summarising that section.
    - The sections should be determined based on logical breaks in the content as deemed appropriate.
 
 3. **Formatting Guidelines**:
    - Use **bold** for important terms or concepts.
    - Use *italic* for headings and emphasis.
    - Use appropriate Markdown syntax for formatting.
 
 4. **Additional Instructions**:
    - Decide whether to provide a single-paragraph summary or a multi-paragraph summary based on the length and complexity of the content.
    - Ensure the summary accurately reflects the key points without unnecessary detail.
    - Do not omit any important information from the text.
    - Ensure that the summary accurately reflects the content.`;
 }
 