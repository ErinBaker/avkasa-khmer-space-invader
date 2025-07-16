// Content Script for Khmer Non-Breaking Space Detector & Corrector
// Handles DOM manipulation and space replacement

(function() {
  'use strict';

  console.log('[KhmerSpaceFixer] Content script starting...');

  // Track if we've already initialized to avoid duplicate observers
  if (window.__khmerSpaceFixerInitialized) {
    console.log('[KhmerSpaceFixer] Content script already initialized, skipping...');
    return;
  }
  window.__khmerSpaceFixerInitialized = true;
  console.log('[KhmerSpaceFixer] Content script initialized');

  let totalSpacesFixed = 0;
  let observer = null;

  // Main function to fix non-breaking spaces
  function fixSpaces() {
    console.log('[KhmerSpaceFixer] Starting fixSpaces()');
    let fixCount = 0;
    const processedNodes = new WeakSet();

    if (!document.body) {
      console.log('[KhmerSpaceFixer] No document.body found, skipping');
      return 0;
    }

    // Create tree walker to efficiently traverse text nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip if already processed
          if (processedNodes.has(node)) {
            return NodeFilter.FILTER_REJECT;
          }

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

          // Accept if contains non-breaking space
          if (node.nodeValue && node.nodeValue.includes('\u00A0')) {
            console.log('[KhmerSpaceFixer] Found text node with NBSP:', node.nodeValue.substring(0, 50) + '...');
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
      const originalText = node.nodeValue;
      const fixedText = originalText.replace(/\u00A0/g, '\u0020');
      
      if (originalText !== fixedText) {
        // Count the number of replacements
        const replacements = (originalText.match(/\u00A0/g) || []).length;
        fixCount += replacements;
        
        console.log(`[KhmerSpaceFixer] Fixing ${replacements} NBSPs in text node:`, originalText.substring(0, 50) + '...');
        
        // Update the text content
        node.nodeValue = fixedText;
        
        // Mark as processed
        processedNodes.add(node);
      }
    }

    console.log(`[KhmerSpaceFixer] Processed ${nodeCount} text nodes, fixed ${fixCount} NBSPs`);
    totalSpacesFixed += fixCount;
    return fixCount;
  }

  // Function to handle mutations
  function handleMutations(mutations) {
    console.log('[KhmerSpaceFixer] MutationObserver triggered with', mutations.length, 'mutations');
    let shouldFix = false;

    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        // Check if any added nodes contain text
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE || 
              (node.nodeType === Node.ELEMENT_NODE && node.textContent)) {
            console.log('[KhmerSpaceFixer] Found added node with text content');
            shouldFix = true;
            break;
          }
        }
      } else if (mutation.type === 'characterData') {
        // Text content changed
        console.log('[KhmerSpaceFixer] Character data changed');
        shouldFix = true;
      }

      if (shouldFix) break;
    }

    if (shouldFix) {
      console.log('[KhmerSpaceFixer] Scheduling delayed fix spaces due to mutations');
      // Debounce to avoid excessive processing
      clearTimeout(handleMutations.timeout);
      handleMutations.timeout = setTimeout(() => {
        const count = fixSpaces();
        if (count > 0) {
          console.log('[KhmerSpaceFixer] Notifying service worker of new fixes:', totalSpacesFixed);
          // Notify service worker of new fixes
          chrome.runtime.sendMessage({
            action: 'spacesFixed',
            count: totalSpacesFixed
          }).catch((error) => {
            // Service worker might not be available
            console.log('[KhmerSpaceFixer] Could not send message to service worker:', error);
          });
        }
      }, 100);
    }
  }

  // Initialize MutationObserver for dynamic content
  function initObserver() {
    console.log('[KhmerSpaceFixer] Initializing MutationObserver');
    if (observer) {
      console.log('[KhmerSpaceFixer] Disconnecting existing observer');
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
      console.log('[KhmerSpaceFixer] MutationObserver started');
    } else {
      console.log('[KhmerSpaceFixer] No document.body found, cannot start observer');
    }
  }

  // Listen for messages from service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[KhmerSpaceFixer] Content script received message:', request);
    
    if (request.action === 'fixSpaces') {
      // Reset count if manual fix
      if (request.manual) {
        console.log('[KhmerSpaceFixer] Manual fix - resetting count');
        totalSpacesFixed = 0;
      }

      const count = fixSpaces();
      console.log('[KhmerSpaceFixer] fixSpaces returned:', count, 'total now:', totalSpacesFixed);
      
      // Send count back to service worker
      chrome.runtime.sendMessage({
        action: 'spacesFixed',
        count: totalSpacesFixed
      }).catch((error) => {
        console.log('[KhmerSpaceFixer] Could not send message to service worker:', error);
      });

      sendResponse({ success: true, count: count });
    }
  });

  // Check if extension is enabled before initializing
  console.log('[KhmerSpaceFixer] Checking if extension is enabled...');
  chrome.storage.local.get(['enabled'], (result) => {
    console.log('[KhmerSpaceFixer] Storage result:', result);
    if (result.enabled !== false) { // Default to enabled if not set
      console.log('[KhmerSpaceFixer] Extension is enabled, running initial fix');
      
      // Initial fix when content script loads
      const initialCount = fixSpaces();
      console.log('[KhmerSpaceFixer] Initial fix count:', initialCount);
      
      if (initialCount > 0) {
        console.log('[KhmerSpaceFixer] Notifying service worker of initial fixes');
        // Notify service worker
        chrome.runtime.sendMessage({
          action: 'spacesFixed',
          count: totalSpacesFixed
        }).catch((error) => {
          console.log('[KhmerSpaceFixer] Could not send message to service worker:', error);
        });
      }

      // Start observing for changes
      initObserver();
    } else {
      console.log('[KhmerSpaceFixer] Extension is disabled');
    }
  });

  // Listen for storage changes to enable/disable
  chrome.storage.onChanged.addListener((changes, namespace) => {
    console.log('[KhmerSpaceFixer] Storage changed:', changes, 'namespace:', namespace);
    if (namespace === 'local' && changes.enabled) {
      if (changes.enabled.newValue) {
        console.log('[KhmerSpaceFixer] Extension re-enabled, running fix and starting observer');
        // Re-enable: fix spaces and start observing
        fixSpaces();
        initObserver();
      } else {
        console.log('[KhmerSpaceFixer] Extension disabled, stopping observer');
        // Disable: stop observing
        if (observer) {
          observer.disconnect();
          observer = null;
        }
      }
    }
  });

  // Clean up on unload
  window.addEventListener('unload', () => {
    console.log('[KhmerSpaceFixer] Page unloading, cleaning up');
    if (observer) {
      observer.disconnect();
    }
  });

})();