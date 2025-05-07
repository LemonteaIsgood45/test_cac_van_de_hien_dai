chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'fetch-gaze') {
      fetch('http://localhost:5000/gaze')
        .then(res => res.json())
        .then(data => {
          sendResponse({ success: true, data });
        })
        .catch(err => {
          console.error('Fetch error:', err);
          sendResponse({ success: false });
        });
      return true; // Allow async response
    }
  
    // Forward start/stop-tracking to content script
    if (msg.type === 'start-tracking' || msg.type === 'stop-tracking') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: msg.type });
        }
      });
    }
  });
  