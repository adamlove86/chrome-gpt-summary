// content_blocker.js

function stopLoadingIfBlocked() {
  chrome.storage.sync.get({ blockedSites: [] }, (data) => {
    const blockedSites = data.blockedSites;
    const currentOrigin = window.location.origin;

    if (blockedSites.includes(currentOrigin)) {
      console.log(`[Popup Blocker] Stopping load for ${currentOrigin} after DOMContentLoaded`);
      window.stop();
    }
  });
}

// Wait for the main HTML document to be ready before potentially stopping loading
if (document.readyState === 'loading') { // Loading hasn't finished yet
  document.addEventListener('DOMContentLoaded', stopLoadingIfBlocked);
} else { // 'DOMContentLoaded' has already fired
  stopLoadingIfBlocked();
} 