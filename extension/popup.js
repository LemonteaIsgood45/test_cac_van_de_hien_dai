const SERVER_URL = 'http://localhost:5000';
let streamInterval = null;
let videoStream = null;

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggleSwitch');
  const calibrateBtn = document.getElementById('calibrate');

  // Restore saved toggle state
  chrome.storage.local.get('trackingEnabled', (result) => {
    const state = result.trackingEnabled ?? false;
    toggle.checked = state;
    console.log('Restored toggle state:', state);
    
    // If tracking is enabled on startup, initialize webcam
    if (state) {
      startWebcamTracking();
    }
  });

  toggle.addEventListener('change', async (e) => {
    const isOn = e.target.checked;

    // Save to chrome.storage.local and then send request
    chrome.storage.local.set({ trackingEnabled: isOn }, async () => {
      try {
        await fetch(`${SERVER_URL}/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tracking: isOn,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height
          })
        });
        console.log('Tracking toggled:', isOn);

        // Send message to background to start or stop tracking
        chrome.runtime.sendMessage({
          type: isOn ? 'start-tracking' : 'stop-tracking'
        });
        console.log('Message sent to background:', isOn ? 'start-tracking' : 'stop-tracking');

        // Start or stop webcam tracking based on toggle state
        if (isOn) {
          startWebcamTracking();
        } else {
          stopWebcamTracking();
        }

      } catch (err) {
        console.error('Error toggling tracking:', err);
      }
    });
  });

  calibrateBtn.addEventListener('click', async () => {
    try {
      await fetch(`${SERVER_URL}/calibrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: true })
      });
      console.log('Calibration request sent');
    } catch (err) {
      console.error('Error sending calibration:', err);
    }
  });
});

// Function to start webcam tracking
function startWebcamTracking() {
  const video = document.getElementById("video");
  if (!video) {
    console.error("Video element not found");
    return;
  }
  
  navigator.mediaDevices.getUserMedia({ video: true })
    .then((stream) => {
      videoStream = stream;
      video.srcObject = stream;
      
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Clear any existing interval before creating a new one
      if (streamInterval) {
        clearInterval(streamInterval);
      }

      streamInterval = setInterval(() => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          const formData = new FormData();
          formData.append("frame", blob, "frame.jpg");
          fetch("http://localhost:5000/upload", {
            method: "POST",
            body: formData
          });
        }, "image/jpeg");
      }, 1000 / 30);  // 30 FPS
      
      console.log('Webcam tracking started');
    })
    .catch((err) => console.error("Webcam error:", err.name, err.message));
}

// Function to stop webcam tracking
function stopWebcamTracking() {
  if (streamInterval) {
    clearInterval(streamInterval);
    streamInterval = null;
    console.log('Webcam tracking interval stopped');
  }
  
  if (videoStream) {
    videoStream.getTracks().forEach(track => {
      track.stop();
    });
    videoStream = null;
    
    // Clear video source
    const video = document.getElementById("video");
    if (video) {
      video.srcObject = null;
    }
    
    console.log('Webcam stream stopped');
  }
}