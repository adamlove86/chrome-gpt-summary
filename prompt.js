// prompt.js

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
    - Ensure that the summary reflects the video's actual content accurately.
 
 5. **Addressing the Video Title**:
    - If the video's title contains sensational, provocative, or attention-grabbing elements, ensure that the summary explicitly addresses the issues or questions raised by the title in the first sentence of the overall summary.`;
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
    - Ensure that the summary accurately reflects the content.
 
 5. **Addressing the Text's Title**:
    - If the text's title contains sensational, provocative, or attention-grabbing elements, ensure that the summary explicitly addresses the issues or questions raised by the title in the first sentence of the overall summary.`;
 }
 
 // Export functions to use in other files
 export { getDefaultYouTubePrompt, getDefaultTextPrompt };
 