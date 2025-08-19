#!/usr/bin/env python3
"""
LAIKA PWA Backend Server
Handles camera streaming and SLAM map data when WiFi is connected
"""

import os
import sys
import json
import time
import threading
import cv2
import numpy as np
from flask import Flask, render_template, Response, jsonify, request
from flask_cors import CORS
import base64
import io
from PIL import Image

# Add vendor paths for camera and SLAM functionality
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'vendor', 'puppypi_ros', 'src', 'puppy_pi_common', 'build', 'lib'))

try:
    from puppy_pi.Camera import Camera
    CAMERA_AVAILABLE = True
except ImportError:
    print("Warning: Camera module not available, using mock camera")
    CAMERA_AVAILABLE = False

# Try to import ROS2 components
try:
    import rclpy
    from rclpy.node import Node
    from sensor_msgs.msg import Image as ROSImage
    from nav_msgs.msg import OccupancyGrid
    from geometry_msgs.msg import PoseStamped
    from cv_bridge import CvBridge
    ROS2_AVAILABLE = True
except ImportError:
    print("Warning: ROS2 not available, using simulation mode")
    ROS2_AVAILABLE = False

app = Flask(__name__)
CORS(app)

class MockCamera:
    """Mock camera for development/testing"""
    def __init__(self):
        self.frame = None
        self.width = 640
        self.height = 480
        self.opened = False
        
    def camera_open(self):
        self.opened = True
        
    def camera_close(self):
        self.opened = False
        
    def get_frame(self):
        if not self.opened:
            return None
            
        # Create a mock frame with some visual elements
        frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        
        # Add some visual elements
        cv2.rectangle(frame, (50, 50), (590, 430), (0, 255, 255), 2)
        cv2.putText(frame, "LAIKA Camera Feed", (150, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
        cv2.putText(frame, f"Time: {time.strftime('%H:%M:%S')}", (150, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        
        # Add a moving object
        t = time.time()
        x = int(320 + 100 * np.sin(t))
        y = int(240 + 50 * np.cos(t))
        cv2.circle(frame, (x, y), 20, (0, 255, 0), -1)
        
        return frame

class SLAMMapManager:
    """Manages SLAM map data and robot pose"""
    def __init__(self):
        self.map_data = None
        self.robot_pose = None
        self.map_resolution = 0.05  # meters per pixel
        self.map_width = 800
        self.map_height = 600
        
    def update_map(self, occupancy_grid):
        """Update map from ROS2 occupancy grid"""
        if ROS2_AVAILABLE and occupancy_grid:
            self.map_data = np.array(occupancy_grid.data).reshape(
                occupancy_grid.info.height, occupancy_grid.info.width
            )
            self.map_resolution = occupancy_grid.info.resolution
            self.map_width = occupancy_grid.info.width
            self.map_height = occupancy_grid.info.height
            
    def update_robot_pose(self, pose):
        """Update robot pose"""
        if ROS2_AVAILABLE and pose:
            self.robot_pose = {
                'x': pose.pose.position.x,
                'y': pose.pose.position.y,
                'theta': pose.pose.orientation.z
            }
            
    def get_map_image(self):
        """Convert map data to image"""
        if self.map_data is None:
            # Create mock map
            map_img = np.ones((self.map_height, self.map_width, 3), dtype=np.uint8) * 128
            # Add some mock obstacles
            cv2.rectangle(map_img, (100, 100), (200, 300), (0, 0, 0), -1)
            cv2.rectangle(map_img, (400, 200), (500, 400), (0, 0, 0), -1)
            cv2.circle(map_img, (600, 150), 50, (0, 0, 0), -1)
            
            # Add robot position
            robot_x, robot_y = 400, 300
            cv2.circle(map_img, (robot_x, robot_y), 10, (0, 255, 0), -1)
            cv2.putText(map_img, "LAIKA", (robot_x-20, robot_y-15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
            
            return map_img
        else:
            # Convert occupancy grid to image
            map_img = np.zeros((self.map_height, self.map_width, 3), dtype=np.uint8)
            
            # Free space (white)
            map_img[self.map_data == 0] = [255, 255, 255]
            # Occupied space (black)
            map_img[self.map_data == 100] = [0, 0, 0]
            # Unknown space (gray)
            map_img[self.map_data == -1] = [128, 128, 128]
            
            # Add robot position if available
            if self.robot_pose:
                robot_x = int(self.robot_pose['x'] / self.map_resolution)
                robot_y = int(self.robot_pose['y'] / self.map_resolution)
                if 0 <= robot_x < self.map_width and 0 <= robot_y < self.map_height:
                    cv2.circle(map_img, (robot_x, robot_y), 5, (0, 255, 0), -1)
                    cv2.putText(map_img, "LAIKA", (robot_x-15, robot_y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.3, (0, 255, 0), 1)
            
            return map_img

class ROS2Node(Node if ROS2_AVAILABLE else object):
    """ROS2 node for camera and SLAM data"""
    def __init__(self):
        if ROS2_AVAILABLE:
            super().__init__('laika_pwa_node')
            
            # Subscribers
            self.camera_sub = self.create_subscription(
                ROSImage, 'camera/image_raw', self.camera_callback, 10
            )
            self.map_sub = self.create_subscription(
                OccupancyGrid, 'map', self.map_callback, 10
            )
            self.pose_sub = self.create_subscription(
                PoseStamped, 'robot_pose', self.pose_callback, 10
            )
            
            self.bridge = CvBridge()
            self.latest_camera_frame = None
            
        else:
            self.latest_camera_frame = None
            
    def camera_callback(self, msg):
        """Handle camera image from ROS2"""
        if ROS2_AVAILABLE:
            try:
                cv_image = self.bridge.imgmsg_to_cv2(msg, "bgr8")
                self.latest_camera_frame = cv_image
            except Exception as e:
                print(f"Error processing camera image: {e}")
                
    def map_callback(self, msg):
        """Handle SLAM map from ROS2"""
        slam_manager.update_map(msg)
        
    def pose_callback(self, msg):
        """Handle robot pose from ROS2"""
        slam_manager.update_robot_pose(msg)

# Global instances
camera = MockCamera() if not CAMERA_AVAILABLE else Camera()
slam_manager = SLAMMapManager()
ros_node = None

def init_ros_node():
    """Initialize ROS2 node"""
    global ros_node
    if ROS2_AVAILABLE:
        try:
            rclpy.init()
            ros_node = ROS2Node()
            # Start ROS2 spinning in background thread
            def spin_ros():
                rclpy.spin(ros_node)
            threading.Thread(target=spin_ros, daemon=True).start()
            print("ROS2 node initialized")
        except Exception as e:
            print(f"Failed to initialize ROS2 node: {e}")
    else:
        ros_node = ROS2Node()
        print("Running in simulation mode")

def generate_camera_frames():
    """Generate camera frames for streaming"""
    while True:
        if CAMERA_AVAILABLE and camera.opened:
            frame = camera.frame
        elif ROS2_AVAILABLE and ros_node and ros_node.latest_camera_frame is not None:
            frame = ros_node.latest_camera_frame
        else:
            frame = camera.get_frame()
            
        if frame is not None:
            # Encode frame to JPEG
            ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            if ret:
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        time.sleep(0.033)  # ~30 FPS

@app.route('/')
def index():
    """Serve the PWA"""
    return render_template('index.html')

@app.route('/api/status')
def get_status():
    """Get system status"""
    return jsonify({
        'camera_available': CAMERA_AVAILABLE,
        'ros2_available': ROS2_AVAILABLE,
        'camera_active': camera.opened if hasattr(camera, 'opened') else False,
        'timestamp': time.time()
    })

@app.route('/api/camera/start')
def start_camera():
    """Start camera"""
    try:
        camera.camera_open()
        return jsonify({'success': True, 'message': 'Camera started'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/camera/stop')
def stop_camera():
    """Stop camera"""
    try:
        camera.camera_close()
        return jsonify({'success': True, 'message': 'Camera stopped'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/camera/stream')
def camera_stream():
    """Camera video stream endpoint"""
    return Response(generate_camera_frames(),
                   mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/slam/map')
def get_slam_map():
    """Get SLAM map as image"""
    try:
        # First try to load the real LAIKA SLAM map
        laika_map_path = '/home/pi/LAIKA/maps/latest_map_pwa.json'
        
        if os.path.exists(laika_map_path):
            with open(laika_map_path, 'r') as f:
                map_data = json.load(f)
            
            # Extract base64 image data
            image_b64 = map_data.get('image_base64', '')
            if image_b64.startswith('data:image/png;base64,'):
                img_base64 = image_b64.split(',')[1]
            else:
                img_base64 = image_b64
            
            return jsonify({
                'success': True,
                'map_data': img_base64,
                'resolution': map_data['metadata'].get('resolution', 0.05),
                'width': map_data['metadata'].get('width', 0),
                'height': map_data['metadata'].get('height', 0),
                'map_name': map_data.get('map_name', 'LAIKA SLAM Map'),
                'timestamp': map_data.get('timestamp', 0)
            })
        
        # Fallback to mock map
        map_img = slam_manager.get_map_image()
        ret, buffer = cv2.imencode('.png', map_img)
        if ret:
            # Convert to base64
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            return jsonify({
                'success': True,
                'map_data': img_base64,
                'resolution': slam_manager.map_resolution,
                'width': slam_manager.map_width,
                'height': slam_manager.map_height,
                'map_name': 'Mock SLAM Map',
                'timestamp': int(time.time())
            })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/slam/pose')
def get_robot_pose():
    """Get robot pose"""
    return jsonify({
        'success': True,
        'pose': slam_manager.robot_pose
    })

@app.route('/api/robot/command', methods=['POST'])
def send_robot_command():
    """Send command to robot"""
    try:
        data = request.get_json()
        command = data.get('command')
        params = data.get('params', {})
        
        # Here you would send the command to the robot
        # For now, just log it
        print(f"Robot command: {command} with params: {params}")
        
        return jsonify({
            'success': True,
            'message': f'Command {command} sent successfully'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    # Initialize ROS2 node
    init_ros_node()
    
    # Start camera
    camera.camera_open()
    
    # Run Flask app
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)


