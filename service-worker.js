// Service Worker for Khmer Non-Breaking Space Detector & Corrector
// Handles background logic, settings management, and communication

console.log('[KhmerSpaceFixer] Service Worker starting...');

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  autoRun: true,
  injectSpaces: true
};

// Initialize extension settings on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('[KhmerSpaceFixer] Extension installed/updated');
  chrome.storage.local.get(['enabled', 'autoRun', 'injectSpaces'], (result) => {
    console.log('[KhmerSpaceFixer] Current settings:', result);
    if (result.enabled === undefined || result.autoRun === undefined || result.injectSpaces === undefined) {
      console.log('[KhmerSpaceFixer] Setting default settings:', DEFAULT_SETTINGS);
      chrome.storage.local.set(DEFAULT_SETTINGS);
    }
  });
});

// Track space fix counts per tab
const tabSpaceCounts = new Map();

// Listen for tab updates to auto-run space fixing if enabled
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log(`[KhmerSpaceFixer] Tab ${tabId} updated:`, changeInfo, 'URL:', tab.url);
  
  if (changeInfo.status === 'complete') {
    console.log(`[KhmerSpaceFixer] Tab ${tabId} finished loading`);
    
    chrome.storage.local.get(['enabled', 'autoRun', 'injectSpaces'], (result) => {
      console.log(`[KhmerSpaceFixer] Settings for tab ${tabId}:`, result);
      
      if (result.enabled && result.autoRun) {
        console.log(`[KhmerSpaceFixer] Auto-running space fix for tab ${tabId}`);
        
        // Execute content script if not already injected
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content-script.js']
        }).then(() => {
          console.log(`[KhmerSpaceFixer] Content script injected for tab ${tabId}`);
          
          // Trigger automatic space fixing
          chrome.tabs.sendMessage(tabId, {
            action: 'fixSpaces',
            manual: false
          });
        }).catch(error => {
          // Script may already be injected or tab might not support scripts
          console.log(`[KhmerSpaceFixer] Script injection skipped for tab ${tabId}:`, error.message);
        });
      } else {
        console.log(`[KhmerSpaceFixer] Not auto-running for tab ${tabId} - enabled: ${result.enabled}, autoRun: ${result.autoRun}`);
      }
    });
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[KhmerSpaceFixer] Service Worker received message:', request, 'from:', sender);
  
  switch (request.action) {
    case 'updateSettings':
      // Update settings from popup
      console.log('[KhmerSpaceFixer] Updating settings:', request);
      chrome.storage.local.set({
        enabled: request.enabled,
        autoRun: request.autoRun,
        injectSpaces: request.injectSpaces
      }, () => {
        console.log('[KhmerSpaceFixer] Settings updated successfully');
        sendResponse({ success: true });
      });
      return true; // Keep message channel open for async response

    case 'getSettings':
      // Retrieve settings for popup
      console.log('[KhmerSpaceFixer] Getting settings for popup');
      chrome.storage.local.get(['enabled', 'autoRun', 'injectSpaces'], (result) => {
        const settings = {
          enabled: result.enabled ?? DEFAULT_SETTINGS.enabled,
          autoRun: result.autoRun ?? DEFAULT_SETTINGS.autoRun,
          injectSpaces: result.injectSpaces ?? DEFAULT_SETTINGS.injectSpaces
        };
        console.log('[KhmerSpaceFixer] Returning settings:', settings);
        sendResponse(settings);
      });
      return true;

    case 'manualFix':
      // Manual fix triggered from popup
      console.log('[KhmerSpaceFixer] Manual fix triggered');
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          const tabId = tabs[0].id;
          console.log(`[KhmerSpaceFixer] Manual fix for tab ${tabId}`);
          
          // First try to send message to existing content script
          chrome.tabs.sendMessage(tabId, {
            action: 'fixSpaces',
            manual: true
          }).catch(() => {
            console.log(`[KhmerSpaceFixer] Content script not found for tab ${tabId}, injecting...`);
            // If content script not loaded, inject it first
            chrome.scripting.executeScript({
              target: { tabId: tabId },
              files: ['content-script.js']
            }).then(() => {
              console.log(`[KhmerSpaceFixer] Content script injected for manual fix, tab ${tabId}`);
              // Now send the message
              chrome.tabs.sendMessage(tabId, {
                action: 'fixSpaces',
                manual: true
              });
            }).catch(error => {
              console.error(`[KhmerSpaceFixer] Failed to inject content script for tab ${tabId}:`, error);
              sendResponse({ error: 'Failed to process page' });
            });
          });
        }
      });
      return true;

    case 'spacesFixed':
      // Receive count from content script
      console.log('[KhmerSpaceFixer] Received spaces fixed count:', request.count, 'from tab:', sender.tab?.id);
      if (sender.tab) {
        tabSpaceCounts.set(sender.tab.id, request.count);
        
        // Update badge to show count (optional visual indicator)
        if (request.count > 0) {
          console.log(`[KhmerSpaceFixer] Setting badge for tab ${sender.tab.id}: ${request.count}`);
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
      console.log('[KhmerSpaceFixer] Getting space count for current tab');
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          const count = tabSpaceCounts.get(tabs[0].id) || 0;
          console.log(`[KhmerSpaceFixer] Returning space count for tab ${tabs[0].id}: ${count}`);
          sendResponse({ count: count });
        } else {
          console.log('[KhmerSpaceFixer] No active tab found, returning 0');
          sendResponse({ count: 0 });
        }
      });
      return true;
      
    default:
      console.warn('[KhmerSpaceFixer] Unknown action:', request.action);
  }
});

// Clear count when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  console.log(`[KhmerSpaceFixer] Tab ${tabId} removed, clearing count`);
  tabSpaceCounts.delete(tabId);
});

// Clear count when navigating to new page
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0) { // Main frame only
    console.log(`[KhmerSpaceFixer] Navigation detected for tab ${details.tabId}, clearing count`);
    tabSpaceCounts.delete(details.tabId);
    chrome.action.setBadgeText({
      text: '',
      tabId: details.tabId
    });
  }
});