/**
 * Background Service Worker — Form Copilot
 * 
 * Handles message routing and ensures content script injection.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Form Copilot] Extension installed.");
});
