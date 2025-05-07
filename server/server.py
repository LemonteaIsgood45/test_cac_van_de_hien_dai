import numpy as np
from flask import Flask, request, jsonify
import cv2
from eyeGestures.utils import VideoCapture
from eyeGestures import EyeGestures_v3
import threading
from flask_cors import CORS
import time
from datetime import datetime
import os

gestures = EyeGestures_v3()
cap = VideoCapture(0)

app = Flask(__name__)
CORS(app)

FRAMES_DIR = 'frames'
os.makedirs(FRAMES_DIR, exist_ok=True)

# Calibration setup
x = np.arange(0, 1.1, 0.2)
y = np.arange(0, 1.1, 0.2)

xx, yy = np.meshgrid(x, y)

calibration_map = np.column_stack([xx.ravel(), yy.ravel()])
n_points = min(len(calibration_map),25)
np.random.shuffle(calibration_map)
gestures.uploadCalibrationMap(calibration_map,context="my_context")
gestures.setFixation(1.0)
gestures.calibration_radius = 0.03

iterator = 0
prev_x = 0
prev_y = 0

tracking_enabled = False
calibration_requested = False
screen_width = 1920  # Default values
screen_height = 1080

# Global variables with proper thread synchronization
location = [0, 0] 
calibration_point = [0, 0]
data_lock = threading.Lock()

# Load images
@app.route('/upload', methods=['POST'])
def upload_frame():
    if 'frame' not in request.files:
        return jsonify({"error": "No frame part"}), 400
    
    frame = request.files['frame']
    if frame.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    # Generate a unique filename with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    filename = f"frame_{timestamp}.jpg"
    filepath = os.path.join(FRAMES_DIR, filename)
    
    # Save the frame
    try:
        frame.save(filepath)
        print(f"Saved frame: {filename}")
        return jsonify({"status": "success", "filename": filename}), 200
    except Exception as e:
        print(f"Error saving frame: {str(e)}")
        return jsonify({"error": str(e)}), 500

# TOGGLE TRACKING 
@app.route('/toggle', methods=['POST'])
def toggle_tracking():
    global tracking_enabled, screen_width, screen_height, iterator, prev_x, prev_y
    data = request.get_json()

    tracking_enabled = data.get('tracking', False)
    screen_width = data.get('screenWidth', 1920)
    screen_height = data.get('screenHeight', 1080)
    
    iterator = 0
    prev_x = 0
    prev_y = 0

    print(f"Tracking: {tracking_enabled}, Screen: {screen_width}x{screen_height}")
    return jsonify(success=True)

# REQUEST CALIBRATION
@app.route('/calibrate', methods=['POST'])
def calibrate():
    global calibration_requested
    calibration_requested = True
    print("Calibration requested")
    return jsonify(success=True)

# GAZE DATA ENDPOINT
@app.route('/gaze')
def gaze():
    with data_lock:
        return jsonify({
            "location": {"x": location[0], "y": location[1]},
            "calibration": {"x": calibration_point[0], "y": calibration_point[1]}
        })
          
def tracking_loop():
    global location, calibration_point, iterator, prev_x, prev_y, calibration_requested
    global tracking_enabled, screen_width, screen_height

    while True:
        try:
            if not tracking_enabled:
                time.sleep(0.1)  # Reduced CPU usage during idle
                continue

            ret, frame = cap.read()
            if not ret:
                print("Failed to read frame from camera.")
                time.sleep(0.1)
                continue

            if calibration_requested:
                print("Starting new calibration sequence")
                iterator = 0
                prev_x = 0
                prev_y = 0
                calibration_requested = False
                
            # frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            calibrate = (iterator < n_points)

            event, calibration = gestures.step(
                frame,
                calibrate,
                screen_width,
                screen_height,
                context="my_context"
            )
            
            # Update values with proper thread synchronization
            with data_lock:
                if event:
                    location[0] = event.point[0]
                    location[1] = event.point[1]
                    print(f"Updated gaze location: ({location[0]}, {location[1]})")
                
                if calibrate:
                    # Check if calibration point has changed
                    if calibration.point[0] != prev_x or calibration.point[1] != prev_y:
                        calibration_point[0] = calibration.point[0]
                        calibration_point[1] = calibration.point[1]
                        prev_x = calibration.point[0]
                        prev_y = calibration.point[1]
                        iterator += 1
                        print(f"Calibration point {iterator}/{n_points}: ({calibration_point[0]}, {calibration_point[1]})")
            
            # Add a small sleep to prevent high CPU usage
            time.sleep(0.01)
            
        except Exception as e:
            print(f"Error in tracking loop: {e}")
            time.sleep(0.1)

if __name__ == '__main__':
    # Start tracking thread before Flask app
    tracking_thread = threading.Thread(target=tracking_loop, daemon=True)
    tracking_thread.start()
    print("Tracking thread started")
    
    # Start Flask app
    app.run(host='localhost', port=5000, debug=False, threaded=True)