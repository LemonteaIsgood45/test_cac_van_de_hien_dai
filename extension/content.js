// Store original overflow values to restore them later
let originalHtmlOverflow = '';
let originalBodyOverflow = '';

// Function to ensure overflow is visible
function setOverflowVisible() {
  // Store original values first
  originalHtmlOverflow = document.documentElement.style.overflow;
  originalBodyOverflow = document.body.style.overflow;
  
  // Set overflow to visible
  document.documentElement.style.overflow = 'visible';
  document.body.style.overflow = 'visible';
}

// Function to restore original overflow values
function restoreOverflow() {
  document.documentElement.style.overflow = originalHtmlOverflow;
  document.body.style.overflow = originalBodyOverflow;
}

let intervalId = null;
let prevX = 100;
let prevY = 100;
let circle = null;
let calibrationCircle = null;

// Function to create the gaze circle
function createGazeCircle() {
  circle = document.createElement('div');
  circle.id = 'gaze-circle';
  circle.style.width = '40px';
  circle.style.height = '40px';
  circle.style.border = '2px solid red';
  circle.style.borderRadius = '50%';
  circle.style.background = 'transparent';
  circle.style.position = 'fixed';
  circle.style.top = '100px';
  circle.style.left = '100px';
  circle.style.zIndex = '9999';
  circle.style.boxSizing = 'border-box';
  circle.style.transition = 'transform 0.1s ease-out, left 0.1s linear, top 0.1s linear';
  // Make sure circles remain visible even when partially outside viewport
  circle.style.pointerEvents = 'none';  // Don't interfere with page interactions
  circle.style.willChange = 'transform, left, top';  // Optimize for animations
  circle.style.contain = 'layout style';  // Performance optimization
  document.body.appendChild(circle);
  
  return circle;
}

// Function to create the calibration circle
function createCalibrationCircle() {
  calibrationCircle = document.createElement('div');
  calibrationCircle.id = 'calibration-circle';
  calibrationCircle.style.width = '300px';
  calibrationCircle.style.height = '300px';
  calibrationCircle.style.border = '2px dashed blue';
  calibrationCircle.style.borderRadius = '50%';
  calibrationCircle.style.background = 'rgba(100, 100, 255, 0.7)';
  calibrationCircle.style.position = 'fixed';
  calibrationCircle.style.zIndex = '9998';
  calibrationCircle.style.boxSizing = 'border-box';
  // Make sure circles remain visible even when partially outside viewport
  calibrationCircle.style.pointerEvents = 'none';  // Don't interfere with page interactions
  calibrationCircle.style.willChange = 'transform, left, top';  // Optimize for animations
  calibrationCircle.style.contain = 'layout style';  // Performance optimization
  document.body.appendChild(calibrationCircle);
  
  return calibrationCircle;
}

// Remove circles from the DOM
function removeCircles() {
  // Get the container if it exists
  const container = document.getElementById('eye-tracking-container');
  
  if (circle) {
    if (container && circle.parentNode === container) {
      container.removeChild(circle);
    } else if (circle.parentNode === document.body) {
      document.body.removeChild(circle);
    }
    circle = null;
  }
  
  if (calibrationCircle) {
    if (calibrationCircle.fadeTimeout) {
      clearTimeout(calibrationCircle.fadeTimeout);
    }
    
    if (container && calibrationCircle.parentNode === container) {
      container.removeChild(calibrationCircle);
    } else if (calibrationCircle.parentNode === document.body) {
      document.body.removeChild(calibrationCircle);
    }
    calibrationCircle = null;
  }
  
  // Remove the container if it exists
  if (container) {
    document.body.removeChild(container);
  }
}

// Function to update calibration circle position
function updateCalibrationCircle(x, y) {
  if (!calibrationCircle) return;
  
  // Make the calibration circle visible first (in case it was hidden)
  calibrationCircle.style.display = 'block';
  
  const radius = calibrationCircle.offsetWidth / 2;
  calibrationCircle.style.left = `${x - radius}px`;
  calibrationCircle.style.top = `${y - radius}px`;
  
  // Clear any existing timeout
  if (calibrationCircle.fadeTimeout) {
    clearTimeout(calibrationCircle.fadeTimeout);
  }
  
  // Set new timeout to hide the circle after 5 seconds
  calibrationCircle.fadeTimeout = setTimeout(() => {
    if (calibrationCircle) {
      calibrationCircle.style.display = 'none';
    }
  }, 5000); // 5000 milliseconds = 5 seconds
}

// Move the circle with stretch effect
function moveCircle(x, y) {
  if (!circle) return;

  const dx = x - prevX;
  const dy = y - prevY;

  // Set position - ensure circles can go partially offscreen
  const radius = circle.offsetWidth / 2;
  circle.style.left = `${x}px`;
  circle.style.top = `${y}px`;

  // Keep both circles visible regardless of position
  circle.style.visibility = 'visible';
  if (calibrationCircle && calibrationCircle.style.display !== 'none') {
    calibrationCircle.style.visibility = 'visible';
  }

  // Apply stretch effect
  const stretchX = 1 + Math.min(Math.abs(dx) / 30, 0.5);
  const stretchY = 1 + Math.min(Math.abs(dy) / 30, 0.5);
  circle.style.transform = `scale(${stretchX}, ${stretchY})`;

  setTimeout(() => {
    if (circle) {
      circle.style.transform = 'scale(1, 1)';
    }
  }, 100);

  prevX = x;
  prevY = y;
}

// Start polling for gaze data
function startTracking() {
  if (intervalId) return;
  
  // Set overflow to visible when tracking starts
  setOverflowVisible();
  
  // Create circles when tracking starts
  if (!circle) {
    createGazeCircle();
  }
  
  if (!calibrationCircle) {
    createCalibrationCircle();
    // Initially display the calibration circle
    calibrationCircle.style.display = 'block';
  }
  
  // Create a container to hold both circles in the DOM
  // This helps prevent them from being affected by page layout changes
  let container = document.getElementById('eye-tracking-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'eye-tracking-container';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100vw';
    container.style.height = '100vh';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '9997';
    container.style.overflow = 'visible';
    document.body.appendChild(container);
    
    // Move circles to container if they exist
    if (circle && circle.parentNode !== container) {
      document.body.removeChild(circle);
      container.appendChild(circle);
    }
    
    if (calibrationCircle && calibrationCircle.parentNode !== container) {
      document.body.removeChild(calibrationCircle);
      container.appendChild(calibrationCircle);
    }
  }
  
  intervalId = setInterval(() => {
    chrome.runtime.sendMessage({ type: 'fetch-gaze' }, (response) => {
      if (response?.success) {
        const { x, y } = response.data.location;
        const { x: calX, y: calY } = response.data.calibration;
        moveCircle(x, y);
        updateCalibrationCircle(calX, calY);
      }
    });
  }, 40);
}

// Stop polling and remove circles
function stopTracking() {
  clearInterval(intervalId);
  intervalId = null;
  
  // Remove circles when tracking stops
  removeCircles();
  
  // Restore original overflow settings
  restoreOverflow();
}

// Handle messages to control tracking or move manually
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'start-tracking') startTracking();
  if (message.type === 'stop-tracking') stopTracking();
  if (message.type === 'move-circle' && circle) moveCircle(message.x, message.y);
});