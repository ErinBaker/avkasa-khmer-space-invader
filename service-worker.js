// Service Worker for Avkasa Khmer Zero Space
// Handles background logic, settings management, and communication

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  autoRun: true,
  injectSpaces: true
};

// Initialize extension settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['enabled', 'autoRun', 'injectSpaces'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('[Avkasa Khmer] Storage error during initialization:', chrome.runtime.lastError);
      return;
    }
    
    // Only set defaults for undefined values to avoid overwriting existing settings
    const updates = {};
    if (result.enabled === undefined) updates.enabled = DEFAULT_SETTINGS.enabled;
    if (result.autoRun === undefined) updates.autoRun = DEFAULT_SETTINGS.autoRun;
    if (result.injectSpaces === undefined) updates.injectSpaces = DEFAULT_SETTINGS.injectSpaces;
    
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates, () => {
        if (chrome.runtime.lastError) {
          console.error('[Avkasa Khmer] Failed to set default settings:', chrome.runtime.lastError);
        }
      });
    }
  });
});

// Track space fix counts per tab
const tabSpaceCounts = new Map();

// Listen for tab updates to auto-run space fixing if enabled
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    chrome.storage.local.get(['enabled', 'autoRun', 'injectSpaces'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('[Avkasa Khmer] Storage error during tab update:', chrome.runtime.lastError);
        return;
      }
      
      if (result.enabled && result.autoRun) {
        // Execute content script if not already injected
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content-script.js']
        }).then(() => {
          // Trigger automatic space fixing
          chrome.tabs.sendMessage(tabId, {
            action: 'fixSpaces',
            manual: false
          });
        }).catch(() => {
          // Script may already be injected or tab might not support scripts
        });
      }
    });
  }
});

// Validate message structure and sender
function validateMessage(request, sender) {
  // Check if request is valid object with action
  if (!request || typeof request !== 'object' || typeof request.action !== 'string') {
    return false;
  }
  
  // Validate sender - should be from extension context
  if (!sender || (!sender.tab && !sender.url?.startsWith('chrome-extension://'))) {
    return false;
  }
  
  return true;
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    // Validate message and sender
    if (!validateMessage(request, sender)) {
      console.warn('[Avkasa Khmer] Invalid message received');
      sendResponse({ error: 'Invalid message format' });
      return false;
    }
    
    switch (request.action) {
    case 'updateSettings':
      // Update settings from popup - validate input
      if (typeof request.enabled !== 'boolean' || 
          typeof request.autoRun !== 'boolean' || 
          typeof request.injectSpaces !== 'boolean') {
        sendResponse({ error: 'Invalid settings format' });
        return false;
      }
      
      chrome.storage.local.set({
        enabled: request.enabled,
        autoRun: request.autoRun,
        injectSpaces: request.injectSpaces
      }, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
      return true; // Keep message channel open for async response

    case 'getSettings':
      // Retrieve settings for popup
      chrome.storage.local.get(['enabled', 'autoRun', 'injectSpaces'], (result) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
          return;
        }
        
        const settings = {
          enabled: result.enabled ?? DEFAULT_SETTINGS.enabled,
          autoRun: result.autoRun ?? DEFAULT_SETTINGS.autoRun,
          injectSpaces: result.injectSpaces ?? DEFAULT_SETTINGS.injectSpaces
        };
        sendResponse(settings);
      });
      return true;

    case 'manualFix':
      // Manual fix triggered from popup
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          const tabId = tabs[0].id;
          
          // First try to send message to existing content script
          chrome.tabs.sendMessage(tabId, {
            action: 'fixSpaces',
            manual: true
          }).catch(() => {
            // If content script not loaded, inject it first
            chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['content-script.js']
            }).then(() => {
              // Now send the message
              chrome.tabs.sendMessage(tabId, {
                action: 'fixSpaces',
                manual: true
              });
            }).catch(() => {
              sendResponse({ error: 'Failed to process page' });
            });
          });
        }
      });
      return true;

    case 'spacesFixed':
      // Receive count from content script - validate input
      if (typeof request.count !== 'number' || request.count < 0 || !Number.isInteger(request.count)) {
        sendResponse({ error: 'Invalid count format' });
        return false;
      }
      
      if (sender.tab) {
        tabSpaceCounts.set(sender.tab.id, request.count);
        
        // Update badge to show active indicator
        if (request.count > 0) {
          chrome.action.setBadgeText({
            text: ' ',
            tabId: sender.tab.id
          });
          chrome.action.setBadgeBackgroundColor({
            color: '#00FF00',
            tabId: sender.tab.id
          });
        }
      }
      sendResponse({ received: true });
      return true;

    case 'getSpaceCount':
      // Get space count for current tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          const count = tabSpaceCounts.get(tabs[0].id) || 0;
          sendResponse({ count: count });
        } else {
          sendResponse({ count: 0 });
        }
      });
      return true;
      
    default:
      // Unknown action
      sendResponse({ error: 'Unknown action' });
      return false;
  }
  } catch (error) {
    console.error('[Avkasa Khmer] Error handling message:', error);
    sendResponse({ error: 'Internal error' });
    return false;
  }
});

// Clear count when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabSpaceCounts.delete(tabId);
});

// Clear count when navigating to new page
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0) { // Main frame only
    tabSpaceCounts.delete(details.tabId);
    chrome.action.setBadgeText({
      text: '',
      tabId: details.tabId
    });
  }
});