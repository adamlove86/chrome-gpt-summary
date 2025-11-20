// Cache for loaded prompts
let promptCache = {
  youtube: null,
  text: null,
  preface: null,
  youtubePreface: null
};

// Function to load markdown file content
async function loadMarkdownFile(filename) {
  try {
    const response = await fetch(chrome.runtime.getURL(filename));
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error(`Error loading ${filename}:`, error);
    return null;
  }
}

// Load YouTube prompt from markdown file
async function getDefaultYouTubePrompt() {
  if (promptCache.youtube) {
    return promptCache.youtube;
  }
  
  const content = await loadMarkdownFile('youtube-prompt.md');
  if (content) {
    promptCache.youtube = content.trim();
    return promptCache.youtube;
  }
  
  // Fallback to hardcoded prompt if file loading fails
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

// Load text prompt from markdown file
async function getDefaultTextPrompt() {
  if (promptCache.text) {
    return promptCache.text;
  }
  
  const content = await loadMarkdownFile('text-prompt.md');
  if (content) {
    promptCache.text = content.trim();
    return promptCache.text;
  }
  
  // Fallback to hardcoded prompt if file loading fails
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

Remember: The goal is to create an easily scannable, well-formatted summary that is both informative and pleasant to read.`;
}

// Load preface prompt from markdown file
async function getDefaultPrefacePrompt() {
    if (promptCache.preface) {
        return promptCache.preface;
    }

    const content = await loadMarkdownFile('preface-prompt.md');
    if (content) {
        promptCache.preface = content.trim();
        return promptCache.preface;
    }

    // Fallback to hardcoded prompt if file loading fails
    return "I have questions about this article. Please review the complete text provided below. The full article content is included here, so you don't need to access any external links right now.";
}

// Load YouTube preface prompt from markdown file
async function getDefaultYouTubePrefacePrompt() {
    if (promptCache.youtubePreface) {
        return promptCache.youtubePreface;
    }

    const content = await loadMarkdownFile('youtube-preface-prompt.md');
    if (content) {
        promptCache.youtubePreface = content.trim();
        return promptCache.youtubePreface;
    }

    // Fallback to hardcoded prompt if file loading fails
    return "I have questions about this YouTube video. Please review the text below.";
}

// Export functions to use in other files
export { getDefaultYouTubePrompt, getDefaultTextPrompt, getDefaultPrefacePrompt, getDefaultYouTubePrefacePrompt };
 

 