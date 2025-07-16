// Popup script for Khmer Non-Breaking Space Detector & Corrector
// Handles UI interactions and communication with service worker

console.log('[KhmerSpaceFixer] Popup script starting...');

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[KhmerSpaceFixer] Popup DOM loaded');
  
  // Get UI elements
  const enableToggle = document.getElementById('enableToggle');
  const autoRunToggle = document.getElementById('autoRunToggle');
  const injectSpacesToggle = document.getElementById('injectSpacesToggle');
  const fixNowButton = document.getElementById('fixNowButton');
  const statusText = document.getElementById('statusText');
  const statusIndicator = document.getElementById('statusIndicator');
  const spaceCount = document.getElementById('spaceCount');
  
  console.log('[KhmerSpaceFixer] UI elements found:', {
    enableToggle: !!enableToggle,
    autoRunToggle: !!autoRunToggle,
    injectSpacesToggle: !!injectSpacesToggle,
    fixNowButton: !!fixNowButton,
    statusText: !!statusText,
    statusIndicator: !!statusIndicator,
    spaceCount: !!spaceCount
  });

  // Load current settings
  async function loadSettings() {
    console.log('[KhmerSpaceFixer] Loading settings...');
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
        console.log('[KhmerSpaceFixer] Settings response:', response);
        if (response) {
          enableToggle.checked = response.enabled;
          autoRunToggle.checked = response.autoRun;
          injectSpacesToggle.checked = response.injectSpaces;
          updateStatus(response.enabled);
          console.log('[KhmerSpaceFixer] Settings loaded - enabled:', response.enabled, 'autoRun:', response.autoRun, 'injectSpaces:', response.injectSpaces);
          resolve();
        } else {
          console.error('[KhmerSpaceFixer] No response from getSettings');
          resolve();
        }
      });
    });
  }

  // Update status display
  function updateStatus(enabled) {
    console.log('[KhmerSpaceFixer] Updating status, enabled:', enabled);
    if (enabled) {
      statusText.textContent = 'Extension is Active';
      statusIndicator.classList.add('active');
      statusIndicator.classList.remove('inactive');
      fixNowButton.disabled = false;
      autoRunToggle.disabled = false;
      injectSpacesToggle.disabled = false;
    } else {
      statusText.textContent = 'Extension is Inactive';
      statusIndicator.classList.remove('active');
      statusIndicator.classList.add('inactive');
      fixNowButton.disabled = true;
      autoRunToggle.disabled = true;
      injectSpacesToggle.disabled = true;
    }
  }

  // Load space count for current tab
  async function loadSpaceCount() {
    console.log('[KhmerSpaceFixer] Loading space count...');
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSpaceCount' }, (response) => {
        console.log('[KhmerSpaceFixer] Space count response:', response);
        if (response && response.count !== undefined) {
          spaceCount.textContent = `Spaces fixed: ${response.count}`;
          console.log('[KhmerSpaceFixer] Space count updated:', response.count);
        } else {
          console.error('[KhmerSpaceFixer] No valid space count response');
        }
        resolve();
      });
    });
  }

  // Save settings
  async function saveSettings(enabled, autoRun, injectSpaces) {
    console.log('[KhmerSpaceFixer] Saving settings - enabled:', enabled, 'autoRun:', autoRun, 'injectSpaces:', injectSpaces);
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'updateSettings',
        enabled: enabled,
        autoRun: autoRun,
        injectSpaces: injectSpaces
      }, (response) => {
        console.log('[KhmerSpaceFixer] Save settings response:', response);
        resolve();
      });
    });
  }

  // Handle enable toggle change
  enableToggle.addEventListener('change', async () => {
    const enabled = enableToggle.checked;
    const autoRun = autoRunToggle.checked;
    const injectSpaces = injectSpacesToggle.checked;
    
    console.log('[KhmerSpaceFixer] Enable toggle changed:', enabled);
    
    await saveSettings(enabled, autoRun, injectSpaces);
    updateStatus(enabled);
    
    // If enabling and auto-run is on, trigger fix on current tab
    if (enabled && autoRun) {
      console.log('[KhmerSpaceFixer] Triggering manual fix after enable');
      // Small delay to ensure settings are saved
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: 'manualFix' });
      }, 100);
    }
  });

  // Handle auto-run toggle change
  autoRunToggle.addEventListener('change', async () => {
    const enabled = enableToggle.checked;
    const autoRun = autoRunToggle.checked;
    const injectSpaces = injectSpacesToggle.checked;
    
    console.log('[KhmerSpaceFixer] Auto-run toggle changed:', autoRun);
    
    await saveSettings(enabled, autoRun, injectSpaces);
  });

  // Handle inject spaces toggle change
  injectSpacesToggle.addEventListener('change', async () => {
    const enabled = enableToggle.checked;
    const autoRun = autoRunToggle.checked;
    const injectSpaces = injectSpacesToggle.checked;
    
    console.log('[KhmerSpaceFixer] Inject spaces toggle changed:', injectSpaces);
    
    await saveSettings(enabled, autoRun, injectSpaces);
  });

  // Handle fix now button click
  fixNowButton.addEventListener('click', async () => {
    console.log('[KhmerSpaceFixer] Fix now button clicked');
    
    // Disable button temporarily to prevent double-clicks
    fixNowButton.disabled = true;
    fixNowButton.textContent = 'Fixing...';
    
    // Send message to trigger manual fix
    chrome.runtime.sendMessage({ action: 'manualFix' }, async () => {
      console.log('[KhmerSpaceFixer] Manual fix message sent');
      
      // Re-enable button after a short delay
      setTimeout(async () => {
        fixNowButton.disabled = false;
        fixNowButton.innerHTML = '<span class="button-icon">🔧</span>Fix Spaces Now';
        
        // Reload space count after fix
        await loadSpaceCount();
      }, 500);
    });
  });

  // Initial load
  console.log('[KhmerSpaceFixer] Starting initial load...');
  await loadSettings();
  await loadSpaceCount();
  console.log('[KhmerSpaceFixer] Initial load complete');

  // Listen for updates to space count
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[KhmerSpaceFixer] Popup received message:', request);
    if (request.action === 'updateSpaceCount') {
      spaceCount.textContent = `Spaces fixed: ${request.count}`;
      console.log('[KhmerSpaceFixer] Space count updated from message:', request.count);
    }
  });
});