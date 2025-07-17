// Content Script for Khmer Zero Width Space Detector & Corrector
// Handles DOM manipulation and space replacement

(function() {
  'use strict';

  // Create a unique symbol for initialization tracking to avoid conflicts
  const INIT_SYMBOL = Symbol('avkasa-khmer-initialized');
  
  // Track if we've already initialized to avoid duplicate observers
  if (document.documentElement[INIT_SYMBOL]) {
    return;
  }
  document.documentElement[INIT_SYMBOL] = true;

  let totalSpacesFixed = 0;
  let observer = null;
  let lastProcessingMode = null; // Track last processing mode to enable reversal
  
  // Track modified nodes and their original content for reversibility
  const modifiedNodes = new WeakMap(); // node -> { originalText, modificationType, currentState }

  // Main function to fix zero width spaces
  function fixSpaces(injectSpaces = true) {
    let fixCount = 0;

    if (!document.body) {
      console.log('[Avkasa Khmer] Failed - no document body found');
      return 0;
    }

    // Create tree walker to efficiently traverse ALL text nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip script, style, and code elements
          const parent = node.parentElement;
          if (parent && (
            parent.tagName === 'SCRIPT' ||
            parent.tagName === 'STYLE' ||
            parent.tagName === 'CODE' ||
            parent.tagName === 'PRE' ||
            parent.tagName === 'TEXTAREA' ||
            parent.contentEditable === 'true'
          )) {
            return NodeFilter.FILTER_REJECT;
          }

          // Accept all text nodes with content for potential processing
          if (node.nodeValue && node.nodeValue.trim()) {
            return NodeFilter.FILTER_ACCEPT;
          }

          return NodeFilter.FILTER_REJECT;
        }
      }
    );

    let nodeCount = 0;
    // Process each text node
    let node;
    while (node = walker.nextNode()) {
      nodeCount++;
      const currentText = node.nodeValue;
      let newText = currentText;
      let changesMade = false;
      
      // Check if this node was previously modified
      const nodeData = modifiedNodes.get(node);
      
      if (nodeData) {
        if (injectSpaces && nodeData.currentState === 'removed') {
          // Switch from removed to injected spaces
          newText = nodeData.originalText.replace(/\u200B/g, '\u0020');
          changesMade = true;
          nodeData.currentState = 'injected';
          const replacements = (nodeData.originalText.match(/\u200B/g) || []).length;
          fixCount += replacements;
        } else if (!injectSpaces && nodeData.currentState === 'injected') {
          // Switch from injected spaces to removed
          newText = nodeData.originalText.replace(/\u200B/g, '');
          changesMade = true;
          nodeData.currentState = 'removed';
          const removals = (nodeData.originalText.match(/\u200B/g) || []).length;
          fixCount += removals;
        }
      } else {
        // New node - check for ZWSP
        if (currentText.includes('\u200B')) {
          // Store original text for future toggles
          const originalData = {
            originalText: currentText,
            modificationType: 'zwsp_processing',
            currentState: injectSpaces ? 'injected' : 'removed'
          };
          
          if (injectSpaces) {
            // Replace ZWSP with regular space
            newText = currentText.replace(/\u200B/g, '\u0020');
            const replacements = (currentText.match(/\u200B/g) || []).length;
            fixCount += replacements;
          } else {
            // Remove ZWSP completely
            newText = currentText.replace(/\u200B/g, '');
            const removals = (currentText.match(/\u200B/g) || []).length;
            fixCount += removals;
          }
          
          changesMade = true;
          modifiedNodes.set(node, originalData);
        }
      }
      
      if (changesMade) {
        // Update the text content
        node.nodeValue = newText;
      }
    }
    
    // Update last processing mode for next toggle
    lastProcessingMode = injectSpaces;

    totalSpacesFixed += fixCount;
    return fixCount;
  }

  // Function to handle mutations
  function handleMutations(mutations) {
    let shouldFix = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Check if any added nodes contain text
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE || 
              (node.nodeType === Node.ELEMENT_NODE && node.textContent)) {
            shouldFix = true;
            break;
          }
        }
      } else if (mutation.type === 'characterData') {
        shouldFix = true;
      }

      if (shouldFix) break;
    }

    if (shouldFix) {
      // Debounce to avoid excessive processing
      clearTimeout(handleMutations.timeout);
      handleMutations.timeout = setTimeout(() => {
        // Get current settings before processing
        chrome.storage.local.get(['injectSpaces'], (result) => {
          const injectSpaces = result.injectSpaces ?? true;
          const count = fixSpaces(injectSpaces);
          if (count > 0) {
            // Notify service worker of new fixes
            chrome.runtime.sendMessage({
              action: 'spacesFixed',
              count: totalSpacesFixed
            }).catch(() => {
              // Service worker might not be available
            });
          }
        });
      }, 100);
    }
  }

  // Initialize MutationObserver for dynamic content
  function initObserver() {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver(handleMutations);
    
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        characterDataOldValue: false
      });
    }
  }

  // Validate incoming messages
  function validateMessage(request, sender) {
    // Check if request is valid object with action
    if (!request || typeof request !== 'object' || typeof request.action !== 'string') {
      return false;
    }
    
    // Validate sender - should be from extension
    if (!sender || !sender.id || sender.id !== chrome.runtime.id) {
      return false;
    }
    
    return true;
  }

  // Listen for messages from service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      // Validate message and sender
      if (!validateMessage(request, sender)) {
        console.warn('[Avkasa Khmer] Invalid message received in content script');
        sendResponse({ error: 'Invalid message format' });
        return false;
      }
      
      if (request.action === 'fixSpaces') {
        // Validate manual flag
        if (request.manual !== undefined && typeof request.manual !== 'boolean') {
          sendResponse({ error: 'Invalid manual flag' });
          return false;
        }
        
        // Reset count if manual fix
        if (request.manual) {
          totalSpacesFixed = 0;
        }

        // Get current settings before processing
        chrome.storage.local.get(['injectSpaces'], (result) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
            return;
          }
          
          const injectSpaces = result.injectSpaces ?? true;
          const count = fixSpaces(injectSpaces);
          
          // Send count back to service worker
          chrome.runtime.sendMessage({
            action: 'spacesFixed',
            count: totalSpacesFixed
          }).catch(() => {});

          sendResponse({ success: true, count: count });
        });
        
        return true; // Keep message channel open for async response
      } else {
        sendResponse({ error: 'Unknown action' });
        return false;
      }
    } catch (error) {
      console.error('[Avkasa Khmer] Error handling message in content script:', error);
      sendResponse({ error: 'Internal error' });
      return false;
    }
  });

  // Check if extension is enabled and auto-run is enabled before initializing
  chrome.storage.local.get(['enabled', 'autoRun', 'injectSpaces'], (result) => {
    try {
      if (chrome.runtime.lastError) {
        console.error('[Avkasa Khmer] Storage error during initialization:', chrome.runtime.lastError);
        return;
      }
      
      if (result.enabled !== false) { // Default to enabled if not set
        const autoRun = result.autoRun ?? true; // Default to true if not set
        const injectSpaces = result.injectSpaces ?? true;
        
        // Only run initial fix if auto-run is enabled
        if (autoRun) {
          // Initial fix when content script loads
          const initialCount = fixSpaces(injectSpaces);
          
          // Always notify service worker to update badge
          chrome.runtime.sendMessage({
            action: 'spacesFixed',
            count: totalSpacesFixed
          }).catch((error) => {
            console.warn('[Avkasa Khmer] Failed to notify service worker:', error);
          });

          // Start observing for changes
          initObserver();
        }
      }
    } catch (error) {
      console.error('[Avkasa Khmer] Error during initialization:', error);
    }
  });

  // Listen for storage changes to enable/disable
  chrome.storage.onChanged.addListener((changes, namespace) => {
    try {
      if (namespace === 'local') {
        // Handle enabled/disabled changes
        if (changes.enabled) {
          if (changes.enabled.newValue) {
            // Re-enable: fix spaces and start observing
            chrome.storage.local.get(['injectSpaces'], (result) => {
              try {
                if (chrome.runtime.lastError) {
                  console.error('[Avkasa Khmer] Storage error during re-enable:', chrome.runtime.lastError);
                  return;
                }
                const injectSpaces = result.injectSpaces ?? true;
                fixSpaces(injectSpaces);
              } catch (error) {
                console.error('[Avkasa Khmer] Error during re-enable:', error);
              }
            });
            initObserver();
          } else {
            // Disable: stop observing
            try {
              if (observer) {
                observer.disconnect();
                observer = null;
              }
            } catch (error) {
              console.error('[Avkasa Khmer] Error disabling observer:', error);
            }
          }
        }
        
        // Handle injectSpaces setting changes
        if (changes.injectSpaces) {
          const newSetting = changes.injectSpaces.newValue;
          
          // Check if extension is enabled before reprocessing
          chrome.storage.local.get(['enabled'], (result) => {
            try {
              if (chrome.runtime.lastError) {
                console.error('[Avkasa Khmer] Storage error during toggle:', chrome.runtime.lastError);
                return;
              }
              
              if (result.enabled !== false) {
                // Reset count for new processing
                totalSpacesFixed = 0;
                const count = fixSpaces(newSetting);
                
                // Always notify service worker to update badge
                chrome.runtime.sendMessage({
                  action: 'spacesFixed',
                  count: totalSpacesFixed
                }).catch((error) => {
                  console.warn('[Avkasa Khmer] Failed to notify service worker during toggle:', error);
                });
              }
            } catch (error) {
              console.error('[Avkasa Khmer] Error during toggle processing:', error);
            }
          });
        }
      }
    } catch (error) {
      console.error('[Avkasa Khmer] Error in storage change listener:', error);
    }
  });

  // Clean up on unload
  window.addEventListener('unload', () => {
    if (observer) {
      observer.disconnect();
    }
  });

})();