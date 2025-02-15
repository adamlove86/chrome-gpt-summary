// displayError.js

(function() {
    // Avoid creating multiple error sidebars
    if (document.getElementById('error-sidebar')) {
      return;
    }
  
    // Create error sidebar container
    const errorSidebar = document.createElement('div');
    errorSidebar.id = 'error-sidebar';
    errorSidebar.style.position = 'fixed';
    errorSidebar.style.top = '0';
    errorSidebar.style.right = '0';
    errorSidebar.style.width = '400px';
    errorSidebar.style.height = 'calc(100% - 60px)';
    errorSidebar.style.backgroundColor = '#fff';
    errorSidebar.style.borderLeft = '1px solid #ccc';
    errorSidebar.style.zIndex = '9999';
    errorSidebar.style.overflowY = 'scroll';
    errorSidebar.style.boxShadow = '-2px 0 5px rgba(0,0,0,0.1)';
    errorSidebar.style.padding = '20px';
    errorSidebar.style.fontFamily = 'Arial, sans-serif';
    errorSidebar.style.fontSize = '16px';
  
    // Create a close button for the error sidebar
    const closeButton = document.createElement('button');
    closeButton.innerText = 'Close';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '10px';
    closeButton.style.right = '10px';
    closeButton.style.padding = '5px 10px';
    closeButton.style.backgroundColor = '#e74c3c';
    closeButton.style.color = '#fff';
    closeButton.style.border = 'none';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '14px';
    closeButton.addEventListener('click', () => {
      errorSidebar.remove();
    });
    errorSidebar.appendChild(closeButton);
  
    // Create container for the error message
    const errorMessageContainer = document.createElement('div');
    errorMessageContainer.id = 'error-message-container';
    errorMessageContainer.style.marginTop = '50px';
    errorMessageContainer.innerHTML = `<h2>Error Occurred</h2><p id="error-message">No error message provided.</p>`;
    errorSidebar.appendChild(errorMessageContainer);
  
    // Retrieve error details from local storage and display them
    chrome.storage.local.get(['latestError'], (data) => {
      const errorMessage = data.latestError || 'No error message available.';
      document.getElementById('error-message').textContent = errorMessage;
    });
  
    // Append the error sidebar to the current page
    document.body.appendChild(errorSidebar);
  })();
  