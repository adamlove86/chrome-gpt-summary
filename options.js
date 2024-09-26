// options.js

import { getDefaultYouTubePrompt, getDefaultTextPrompt } from './prompt.js';

document.addEventListener('DOMContentLoaded', () => {
   chrome.storage.sync.get(["apiKey", "youtubePrompt", "textPrompt", "model", "maxTokens", "temperature", "debug"], (data) => {
     document.getElementById('apiKey').value = data.apiKey || '';
     document.getElementById('youtubePrompt').value = data.youtubePrompt || getDefaultYouTubePrompt();
     document.getElementById('textPrompt').value = data.textPrompt || getDefaultTextPrompt();
     document.getElementById('model').value = data.model || 'gpt-4o-mini';
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
