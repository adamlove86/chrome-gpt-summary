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
  return `Summarize the following text, copied from a web page. Present the summary as a concise, nested list of key points, using Markdown formatting for better readability. Follow these guidelines strictly:

1. Use a level 2 heading (##) for the main title "Key Points Summary"
2. Use bold (**text**) for important terms or concepts
3. Use italic (*text*) for emphasis where appropriate
4. Use nested bullet points for listing items, with a maximum of three levels:
   - First level: -
   - Second level: *
   - Third level: +
5. Use color syntax for highlighting, applying colors ONLY as follows:
   - <red>text</red> for warnings or critical points
   - <blue>text</blue> for definitions or key concepts
   - <green>text</green> for positive aspects or benefits
   - <orange>text</orange> for cautionary notes or potential issues

Ensure the summary is concise and well-structured, using colors sparingly and ONLY for their designated purposes. Adhere strictly to Markdown syntax for all formatting.`;
}
