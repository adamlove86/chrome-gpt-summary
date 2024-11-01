// options.js

import { getDefaultYouTubePrompt, getDefaultTextPrompt } from './prompt.js';

document.addEventListener('DOMContentLoaded', () => {
   chrome.storage.sync.get(["apiKey", "youtubePrompt", "textPrompt", "model", "maxTokens", "temperature", "debug", "defaultVoice", "speechSpeed"], (data) => {
     document.getElementById('apiKey').value = data.apiKey || '';
     document.getElementById('youtubePrompt').value = data.youtubePrompt || getDefaultYouTubePrompt();
     document.getElementById('textPrompt').value = data.textPrompt || getDefaultTextPrompt();
     document.getElementById('model').value = data.model || 'gpt-4o-mini';
     document.getElementById('maxTokens').value = data.maxTokens || 1000;
     document.getElementById('temperature').value = data.temperature || 0.7;
     document.getElementById('debug').checked = data.debug || false;

     // Populate default voice dropdown
     populateVoiceList(data.defaultVoice || '');

     // Set speech speed
     const speed = data.speechSpeed || 100;
     document.getElementById('speechSpeed').value = speed;
     document.getElementById('speechSpeedValue').textContent = `${speed}%`;
   });
});

document.getElementById('speechSpeed').addEventListener('input', (e) => {
    document.getElementById('speechSpeedValue').textContent = `${e.target.value}%`;
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
   const defaultVoice = document.getElementById('defaultVoice').value;
   const speechSpeed = parseInt(document.getElementById('speechSpeed').value);

   chrome.storage.sync.set({ apiKey, youtubePrompt, textPrompt, model, maxTokens, temperature, debug, defaultVoice, speechSpeed }, () => {
     alert('Settings saved.');
   });
});

function populateVoiceList(selectedVoice) {
    const select = document.getElementById('defaultVoice');
    chrome.tts.getVoices((voices) => {
        voices.forEach((voice) => {
            const option = document.createElement('option');
            option.value = voice.voiceName;
            option.textContent = `${voice.voiceName} (${voice.lang})`;
            if (voice.voiceName === selectedVoice) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    });
}
