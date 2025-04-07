function getDefaultYouTubePrompt() {
   return `Summarise the following YouTube video transcript. Your summary should be structured to give a quick, clear understanding of the video's content and then offer additional detail if needed. Follow these guidelines:
 
 1. **Overall Summary**:
    - Begin with a clear, brief paragraph that captures the main points of the video.
    - Mention the video's title. If the title is sensational, provocative, clickbaity, or does not accurately reflect the content, explicitly address this by summarising both the issues or promises raised by the title and how the actual content compares.
    - Ensure the overall summary provides a complete picture so that a reader can quickly understand what the video is about without needing further details.
 
 2. **Section Summaries**:
    - If the transcript is lengthy or complex, break the summary into multiple sections.
    - Each section should start with an *italicized heading* that includes the relevant timestamp (e.g., *Introduction - 0:00*, *Main Point - 1:30*, etc.).
    - Use these sections to elaborate on key points, ideas, or arguments presented in the transcript.
 
 3. **Formatting Guidelines**:
    - Use **bold** for important terms or concepts.
    - Use *italic* for headings and emphasis.
    - Follow proper Markdown syntax to ensure clarity and readability.
 
 4. **Additional Instructions**:
    - Decide whether a single-paragraph summary or a multi-paragraph (sectioned) summary is most appropriate based on the transcript's length and complexity.
    - Ensure that no essential information is omitted and that the summary accurately reflects the content of the transcript.
    - The structure should be universal so that whether the title is straightforward or sensational, the summary provides an objective, comprehensive understanding of the video's true content.`;
 }
 
 function getDefaultTextPrompt() {
   return `Summarise the following text in a clear and concise manner, focusing on the most important points. Adapt the length and detail of the summary based on the length of the text. Follow these guidelines:
 
 1. **Overall Summary**:
    - Begin with a brief paragraph that captures the main points of the entire text.
    - Mention the text's title. If the title is sensational, provocative, or attention-grabbing — or if it does not accurately reflect the content — explicitly note this in the first sentence. Address both the title’s implications and what the content actually discusses.
 
 2. **Section Summaries**:
    - If additional detail is necessary, break the summary into sections.
    - Start each section with an *italicized heading* that summarises that section (for example, *Introduction*, *Key Argument*, or *Conclusion*).
    - Use these sections to provide deeper detail or to clarify the progression of ideas as needed.
 
 3. **Formatting Guidelines**:
    - Use **bold** for important terms or concepts.
    - Use *italic* for headings and emphasis.
    - Ensure proper Markdown syntax for clarity and readability.
 
 4. **Additional Instructions**:
    - Decide whether a single-paragraph summary or a multi-paragraph (sectioned) summary is most appropriate based on the content’s length and complexity.
    - Ensure the summary accurately reflects the key points without including unnecessary details.
    - Make sure that no important information is omitted from the text.`;
 }
 
 // Export functions to use in other files
 export { getDefaultYouTubePrompt, getDefaultTextPrompt };
 

 