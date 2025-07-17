// Popup script for Avkasa Khmer Zero Space
// Handles UI interactions and communication with service worker

document.addEventListener('DOMContentLoaded', async () => {
  
  // Get UI elements
  const enableToggle = document.getElementById('enableToggle');
  const autoRunToggle = document.getElementById('autoRunToggle');
  const injectSpacesToggle = document.getElementById('injectSpacesToggle');
  const statusText = document.getElementById('statusText');
  const statusIndicator = document.getElementById('statusIndicator');
  const spaceCount = document.getElementById('spaceCount');
  

  // Load current settings
  async function loadSettings() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
          try {
            if (chrome.runtime.lastError) {
              console.error('[Avkasa Khmer] Error loading settings:', chrome.runtime.lastError);
              resolve();
              return;
            }
            
            if (response && !response.error) {
              enableToggle.checked = response.enabled;
              autoRunToggle.checked = response.autoRun;
              injectSpacesToggle.checked = response.injectSpaces;
              updateStatus(response.enabled);
            } else {
              console.error('[Avkasa Khmer] Invalid settings response:', response);
            }
          } catch (error) {
            console.error('[Avkasa Khmer] Error processing settings response:', error);
          }
          resolve();
        });
      } catch (error) {
        console.error('[Avkasa Khmer] Error sending settings request:', error);
        resolve();
      }
    });
  }

  // Update status display
  function updateStatus(enabled) {
    if (enabled) {
      statusText.textContent = 'Extension is Active';
      statusIndicator.classList.add('active');
      statusIndicator.classList.remove('inactive');
      autoRunToggle.disabled = false;
      injectSpacesToggle.disabled = false;
    } else {
      statusText.textContent = 'Extension is Inactive';
      statusIndicator.classList.remove('active');
      statusIndicator.classList.add('inactive');
      autoRunToggle.disabled = true;
      injectSpacesToggle.disabled = true;
    }
  }

  // Load space count for current tab
  async function loadSpaceCount() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSpaceCount' }, (response) => {
        if (response && response.count !== undefined) {
          spaceCount.textContent = `Spaces fixed: ${response.count}`;
        }
        resolve();
      });
    });
  }

  // Save settings
  async function saveSettings(enabled, autoRun, injectSpaces) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({
          action: 'updateSettings',
          enabled: enabled,
          autoRun: autoRun,
          injectSpaces: injectSpaces
        }, (response) => {
          try {
            if (chrome.runtime.lastError) {
              console.error('[Avkasa Khmer] Error saving settings:', chrome.runtime.lastError);
            } else if (response && response.error) {
              console.error('[Avkasa Khmer] Settings save failed:', response.error);
            }
          } catch (error) {
            console.error('[Avkasa Khmer] Error processing save response:', error);
          }
          resolve();
        });
      } catch (error) {
        console.error('[Avkasa Khmer] Error sending save request:', error);
        resolve();
      }
    });
  }

  // Handle enable toggle change
  enableToggle.addEventListener('change', async () => {
    const enabled = enableToggle.checked;
    const autoRun = autoRunToggle.checked;
    const injectSpaces = injectSpacesToggle.checked;
    
    await saveSettings(enabled, autoRun, injectSpaces);
    updateStatus(enabled);
  });

  // Handle auto-run toggle change
  autoRunToggle.addEventListener('change', async () => {
    const enabled = enableToggle.checked;
    const autoRun = autoRunToggle.checked;
    const injectSpaces = injectSpacesToggle.checked;
    
    await saveSettings(enabled, autoRun, injectSpaces);
  });

  // Handle inject spaces toggle change
  injectSpacesToggle.addEventListener('change', async () => {
    const enabled = enableToggle.checked;
    const autoRun = autoRunToggle.checked;
    const injectSpaces = injectSpacesToggle.checked;
    
    await saveSettings(enabled, autoRun, injectSpaces);
  });


  // Initial load
  await loadSettings();
  await loadSpaceCount();

  // Listen for updates to space count
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'updateSpaceCount') {
      spaceCount.textContent = `Spaces fixed: ${request.count}`;
    }
  });
});