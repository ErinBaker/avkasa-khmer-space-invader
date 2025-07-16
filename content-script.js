// Content Script for Khmer Zero Width Space Detector & Corrector
// Handles DOM manipulation and space replacement

(function() {
  'use strict';

  // Track if we've already initialized to avoid duplicate observers
  if (window.__khmerSpaceFixerInitialized) {
    return;
  }
  window.__khmerSpaceFixerInitialized = true;
  console.log('[Avkasa Khmer] Extension enabled');

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
    if (fixCount > 0) {
      console.log(`[Avkasa Khmer] Spaces ${injectSpaces ? 'injected' : 'removed'} successfully - ${fixCount} changes`);
    }
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

  // Listen for messages from service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fixSpaces') {
      // Reset count if manual fix
      if (request.manual) {
        totalSpacesFixed = 0;
      }

      // Get current settings before processing
      chrome.storage.local.get(['injectSpaces'], (result) => {
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
    }
  });

  // Check if extension is enabled before initializing
  chrome.storage.local.get(['enabled', 'injectSpaces'], (result) => {
    if (result.enabled !== false) { // Default to enabled if not set
      const injectSpaces = result.injectSpaces ?? true;
      
      // Initial fix when content script loads
      const initialCount = fixSpaces(injectSpaces);
      
      // Always notify service worker to update badge
      chrome.runtime.sendMessage({
        action: 'spacesFixed',
        count: totalSpacesFixed
      }).catch(() => {});

      // Start observing for changes
      initObserver();
    }
  });

  // Listen for storage changes to enable/disable
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      // Handle enabled/disabled changes
      if (changes.enabled) {
        if (changes.enabled.newValue) {
          console.log('[Avkasa Khmer] Extension enabled');
          // Re-enable: fix spaces and start observing
          chrome.storage.local.get(['injectSpaces'], (result) => {
            const injectSpaces = result.injectSpaces ?? true;
            fixSpaces(injectSpaces);
          });
          initObserver();
        } else {
          console.log('[Avkasa Khmer] Extension disabled');
          // Disable: stop observing
          if (observer) {
            observer.disconnect();
            observer = null;
          }
        }
      }
      
      // Handle injectSpaces setting changes
      if (changes.injectSpaces) {
        const newSetting = changes.injectSpaces.newValue;
        console.log(`[Avkasa Khmer] Spaces toggle ${newSetting ? 'on' : 'off'}`);
        
        // Check if extension is enabled before reprocessing
        chrome.storage.local.get(['enabled'], (result) => {
          if (result.enabled !== false) {
            // Reset count for new processing
            totalSpacesFixed = 0;
            const count = fixSpaces(newSetting);
            
            // Always notify service worker to update badge
            chrome.runtime.sendMessage({
              action: 'spacesFixed',
              count: totalSpacesFixed
            }).catch(() => {});
          }
        });
      }
    }
  });

  // Clean up on unload
  window.addEventListener('unload', () => {
    if (observer) {
      observer.disconnect();
    }
  });

})();