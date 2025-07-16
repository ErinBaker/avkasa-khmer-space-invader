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
    if (result.enabled === undefined || result.autoRun === undefined || result.injectSpaces === undefined) {
      chrome.storage.local.set(DEFAULT_SETTINGS);
    }
  });
});

// Track space fix counts per tab
const tabSpaceCounts = new Map();

// Listen for tab updates to auto-run space fixing if enabled
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    chrome.storage.local.get(['enabled', 'autoRun', 'injectSpaces'], (result) => {
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

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  switch (request.action) {
    case 'updateSettings':
      // Update settings from popup
      chrome.storage.local.set({
        enabled: request.enabled,
        autoRun: request.autoRun,
        injectSpaces: request.injectSpaces
      }, () => {
        sendResponse({ success: true });
      });
      return true; // Keep message channel open for async response

    case 'getSettings':
      // Retrieve settings for popup
      chrome.storage.local.get(['enabled', 'autoRun', 'injectSpaces'], (result) => {
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
      // Receive count from content script
      if (sender.tab) {
        tabSpaceCounts.set(sender.tab.id, request.count);
        
        // Update badge to show count
        if (request.count > 0) {
          chrome.action.setBadgeText({
            text: request.count.toString(),
            tabId: sender.tab.id
          });
          chrome.action.setBadgeBackgroundColor({
            color: '#4CAF50',
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