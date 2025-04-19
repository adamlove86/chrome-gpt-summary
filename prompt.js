function getDefaultYouTubePrompt() {
  return `Summarise the following transcript from a YouTube video. Present the summary in a clear, well-structured manner with proper formatting and spacing. Your response MUST use the following structure:

1. **Overall Summary** (2-3 paragraphs):
   Write a clear introduction that:
   - Begins with the video's title in quotes
   - If the title is sensational/clickbaity, explicitly contrast the title's implications with the actual content
   - Provide 2-3 well-spaced paragraphs that capture the main points
   - Use proper paragraph breaks for readability

2. **Key Sections** (with timestamps):
   Break down the content into sections, each with:
   - An *italicized heading with timestamp* (e.g., *Introduction - 0:00*)
   - A paragraph explaining that section's key points
   - At least one line break between sections
   
3. **Required Formatting**:
   Your summary MUST include:
   - Multiple paragraphs with proper spacing
   - **Bold** for important concepts and terms
   - *Italic* for section headings and emphasis
   - Line breaks between major sections
   - Bullet points for lists (if applicable)

4. **Length and Structure**:
   - For short videos (< 10 min): At least 2 sections
   - For longer videos: 3-4 sections minimum
   - Each section should be its own paragraph
   - Avoid walls of text - use proper spacing
   - No abbreviations with periods (write "US" not "U.S.")

Remember: The goal is to create an easily scannable, well-formatted summary that is both informative and pleasant to read.`;
}

function getDefaultTextPrompt() {
  return `Summarise the following text in a clear, well-structured manner with proper formatting and spacing. Your response MUST use the following structure:

1. **Overall Summary** (2-3 paragraphs):
   Write a clear introduction that:
   - Begins with the text's title in quotes
   - If the title is sensational, explicitly contrast the title's implications with the actual content
   - Provide 2-3 well-spaced paragraphs that capture the main points
   - Use proper paragraph breaks for readability

2. **Key Sections**:
   Break down the content into logical sections, each with:
   - An *italicized heading* that describes the section
   - A paragraph explaining that section's key points
   - At least one line break between sections
   
3. **Required Formatting**:
   Your summary MUST include:
   - Multiple paragraphs with proper spacing
   - **Bold** for important concepts and terms
   - *Italic* for section headings and emphasis
   - Line breaks between major sections
   - Bullet points for lists (if applicable)

4. **Length and Structure**:
   - For short texts (< 1000 words): At least 2 sections
   - For longer texts: 3-4 sections minimum
   - Each section should be its own paragraph
   - Avoid walls of text - use proper spacing
   - No abbreviations with periods (write "US" not "U.S.")
00000
Remember: The goal is to create an easily scannable, well-formatted summary that is both informative and pleasant to read.`;
}

// Export functions to use in other files
export { getDefaultYouTubePrompt, getDefaultTextPrompt };
 

 