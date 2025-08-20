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
from flask import Flask, render_template, Response, jsonify, request, send_file
from flask_cors import CORS
import base64
import io
from PIL import Image
import subprocess
import psutil
from datetime import datetime
import uuid
import asyncio
from concurrent.futures import ThreadPoolExecutor

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

# Import Cursor server functionality
try:
    from cursor_server import CursorServerAPI
    cursor_api = CursorServerAPI()
    CURSOR_AVAILABLE = True
    print("✅ Cursor AI integration loaded")
except ImportError as e:
    print(f"⚠️ Cursor AI integration not available: {e}")
    cursor_api = None
    CURSOR_AVAILABLE = False

class MockCamera:
    """Mock camera for development/testing"""
    def __init__(self):
        self.frame = None
        self.width = 640
        self.height = 480
        self.opened = False
        # Camera parameters
        self.exposure = -3.0
        self.brightness = 120
        self.contrast = 60
        self.saturation = 80
        self.gain = 100
        self.white_balance = 4000
        self.auto_exposure = False
        self.auto_white_balance = True
        
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
        
        # Apply brightness and contrast to simulate camera settings
        frame = cv2.convertScaleAbs(frame, alpha=self.contrast/50.0, beta=self.brightness-100)
        
        return frame
    
    def set_parameter(self, parameter, value):
        """Set camera parameter"""
        if parameter == 'exposure':
            self.exposure = max(-7, min(1, float(value)))
        elif parameter == 'brightness':
            self.brightness = max(0, min(255, int(value)))
        elif parameter == 'contrast':
            self.contrast = max(0, min(100, int(value)))
        elif parameter == 'saturation':
            self.saturation = max(0, min(100, int(value)))
        elif parameter == 'gain':
            self.gain = max(0, min(200, int(value)))
        elif parameter == 'whiteBalance':
            self.white_balance = max(2800, min(6500, int(value)))
        elif parameter == 'autoExposure':
            self.auto_exposure = bool(value)
        elif parameter == 'autoWhiteBalance':
            self.auto_white_balance = bool(value)
        
        print(f"📸 Camera parameter set: {parameter} = {value}")
        return True
    
    def get_parameters(self):
        """Get current camera parameters"""
        return {
            'exposure': self.exposure,
            'brightness': self.brightness,
            'contrast': self.contrast,
            'saturation': self.saturation,
            'gain': self.gain,
            'whiteBalance': self.white_balance,
            'autoExposure': self.auto_exposure,
            'autoWhiteBalance': self.auto_white_balance
        }

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

# Try to import enhanced camera controller
try:
    sys.path.append('/home/pi/LAIKA')
    from laika_camera_control_service import LAIKACameraController
    ENHANCED_CAMERA_AVAILABLE = True
except ImportError:
    print("Enhanced camera controller not available, using basic camera")
    ENHANCED_CAMERA_AVAILABLE = False

# Global instances
if ENHANCED_CAMERA_AVAILABLE:
    camera = LAIKACameraController()
elif CAMERA_AVAILABLE:
    camera = Camera()
else:
    camera = MockCamera()

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

def generate_camera_frames(fps=10, quality='medium'):
    """Generate camera frames for streaming with configurable fps and quality"""
    # Set frame delay based on fps
    frame_delay = 1.0 / fps if fps > 0 else 0.1
    
    # Set JPEG quality based on quality parameter
    quality_settings = {
        'low': 50,
        'medium': 70,
        'high': 90
    }
    jpeg_quality = quality_settings.get(quality, 70)
    
    while True:
        frame = None
        
        if ENHANCED_CAMERA_AVAILABLE and hasattr(camera, 'capture_frame'):
            frame = camera.capture_frame()
        elif CAMERA_AVAILABLE and hasattr(camera, 'opened') and camera.opened:
            frame = getattr(camera, 'frame', None)
        elif ROS2_AVAILABLE and ros_node and ros_node.latest_camera_frame is not None:
            frame = ros_node.latest_camera_frame
        elif hasattr(camera, 'get_frame'):
            frame = camera.get_frame()
            
        if frame is not None:
            # Resize frame for lower quality if needed
            if quality == 'low':
                height, width = frame.shape[:2]
                frame = cv2.resize(frame, (width//2, height//2))
            
            # Encode frame to JPEG with specified quality
            ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality])
            if ret:
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        time.sleep(frame_delay)

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
        if ENHANCED_CAMERA_AVAILABLE and hasattr(camera, 'open_camera'):
            success = camera.open_camera()
            if success:
                return jsonify({'success': True, 'message': 'Camera started'})
            else:
                return jsonify({'success': False, 'error': 'Failed to open camera'})
        elif hasattr(camera, 'camera_open'):
            camera.camera_open()
            return jsonify({'success': True, 'message': 'Camera started'})
        else:
            return jsonify({'success': False, 'error': 'Camera control not available'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/camera/stop')
def stop_camera():
    """Stop camera"""
    try:
        if ENHANCED_CAMERA_AVAILABLE and hasattr(camera, 'close_camera'):
            camera.close_camera()
            return jsonify({'success': True, 'message': 'Camera stopped'})
        elif hasattr(camera, 'camera_close'):
            camera.camera_close()
            return jsonify({'success': True, 'message': 'Camera stopped'})
        else:
            return jsonify({'success': False, 'error': 'Camera control not available'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/camera/stream')
def camera_stream():
    """Camera video stream endpoint"""
    # Get fps and quality parameters from query string
    fps = int(request.args.get('fps', 10))  # Default 10 fps
    quality = request.args.get('quality', 'medium')  # Default medium quality
    
    # Limit fps to reasonable range
    fps = max(1, min(fps, 30))
    
    return Response(generate_camera_frames(fps=fps, quality=quality),
                   mimetype='multipart/x-mixed-replace; boundary=frame')

def generate_audio_stream():
    """Generate audio stream using ALSA loopback to avoid interfering with STT"""
    try:
        # Use ALSA to capture audio without interfering with the STT system
        # This uses a non-blocking approach and different device access
        import alsaaudio
        
        # Try to use ALSA PCM capture on a different device or shared access
        # Use 'default' device or 'plughw:2,0' for shared access
        try:
            pcm = alsaaudio.PCM(alsaaudio.PCM_CAPTURE, alsaaudio.PCM_NORMAL, device='plughw:2,0')
        except:
            # Fallback to default device if USB device is busy
            try:
                pcm = alsaaudio.PCM(alsaaudio.PCM_CAPTURE, alsaaudio.PCM_NORMAL, device='default')
            except:
                # Final fallback - create a simulated audio stream
                print("⚠️ No audio device available, using simulated audio")
                while True:
                    # Generate silence for now - this prevents the stream from failing
                    silence = b'\x00' * 2048  # 2048 bytes of silence
                    audio_b64 = base64.b64encode(silence).decode('utf-8')
                    yield f"data: {audio_b64}\n\n"
                    time.sleep(0.02)
        
        # Configure audio parameters
        pcm.setchannels(2)
        pcm.setrate(48000)
        pcm.setformat(alsaaudio.PCM_FORMAT_S16_LE)
        pcm.setperiodsize(1024)
        
        print(f"🎤 ALSA Audio streaming started - Non-blocking mode to avoid STT conflicts")
        
        while True:
            try:
                # Non-blocking read to avoid conflicts
                length, data = pcm.read()
                if length > 0:
                    # Convert to base64 for web streaming
                    audio_b64 = base64.b64encode(data).decode('utf-8')
                    yield f"data: {audio_b64}\n\n"
                else:
                    # No data available, send silence
                    silence = b'\x00' * 2048
                    audio_b64 = base64.b64encode(silence).decode('utf-8')
                    yield f"data: {audio_b64}\n\n"
                
                # Small delay to prevent overwhelming the client
                time.sleep(0.01)
                
            except Exception as e:
                print(f"❌ Audio streaming error: {e}")
                # Send silence on error to keep stream alive
                silence = b'\x00' * 2048
                audio_b64 = base64.b64encode(silence).decode('utf-8')
                yield f"data: {audio_b64}\n\n"
                time.sleep(0.05)
                
    except Exception as e:
        print(f"❌ Failed to initialize audio streaming: {e}")
        # Provide a fallback stream with silence to prevent client errors
        while True:
            silence = b'\x00' * 2048
            audio_b64 = base64.b64encode(silence).decode('utf-8')
            yield f"data: error_silence:{str(e)}\n\n"
            time.sleep(0.05)

@app.route('/api/audio/stream')
def audio_stream():
    """Audio stream endpoint - non-interfering with STT system"""
    return Response(generate_audio_stream(), 
                   mimetype='text/plain',
                   headers={'Cache-Control': 'no-cache',
                           'Connection': 'keep-alive',
                           'Access-Control-Allow-Origin': '*'})

@app.route('/api/camera/parameters', methods=['GET'])
def get_camera_parameters():
    """Get current camera parameters"""
    try:
        if ENHANCED_CAMERA_AVAILABLE and hasattr(camera, 'get_parameters'):
            params = camera.get_parameters()
            # Convert parameter names for frontend compatibility
            if 'white_balance' in params:
                params['whiteBalance'] = params.pop('white_balance')
            if 'auto_exposure' in params:
                params['autoExposure'] = params.pop('auto_exposure')
            if 'auto_white_balance' in params:
                params['autoWhiteBalance'] = params.pop('auto_white_balance')
        elif hasattr(camera, 'get_parameters'):
            params = camera.get_parameters()
        else:
            # Fallback for basic camera
            params = {
                'exposure': -1.0,
                'brightness': 100,
                'contrast': 50,
                'saturation': 50,
                'gain': 50,
                'whiteBalance': 4000,
                'autoExposure': True,
                'autoWhiteBalance': True
            }
        
        return jsonify({'success': True, 'parameters': params})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/camera/parameters', methods=['POST'])
def set_camera_parameter():
    """Set camera parameter"""
    try:
        data = request.get_json()
        parameter = data.get('parameter')
        value = data.get('value')
        
        if not parameter or value is None:
            return jsonify({'success': False, 'error': 'Missing parameter or value'})
        
        # Set parameter on camera
        if ENHANCED_CAMERA_AVAILABLE and hasattr(camera, 'set_parameter'):
            success = camera.set_parameter(parameter, value)
        elif hasattr(camera, 'set_parameter'):
            success = camera.set_parameter(parameter, value)
        else:
            # For basic camera, use OpenCV properties
            success = set_real_camera_parameter(parameter, value)
        
        if success:
            return jsonify({'success': True, 'message': f'{parameter} set to {value}'})
        else:
            return jsonify({'success': False, 'error': 'Failed to set parameter'})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/camera/preset', methods=['POST'])
def apply_camera_preset():
    """Apply camera preset"""
    try:
        data = request.get_json()
        preset = data.get('preset')
        settings = data.get('settings', {})
        
        if not preset:
            return jsonify({'success': False, 'error': 'Missing preset name'})
        
        # Try to apply preset directly if enhanced camera is available
        if ENHANCED_CAMERA_AVAILABLE and hasattr(camera, 'apply_preset'):
            success = camera.apply_preset(preset)
            if success:
                return jsonify({
                    'success': True, 
                    'message': f'Applied preset: {preset}'
                })
        
        # Fallback: Apply all settings in the preset individually
        failed_settings = []
        for param, value in settings.items():
            try:
                if ENHANCED_CAMERA_AVAILABLE and hasattr(camera, 'set_parameter'):
                    camera.set_parameter(param, value)
                elif hasattr(camera, 'set_parameter'):
                    camera.set_parameter(param, value)
                else:
                    set_real_camera_parameter(param, value)
            except Exception as e:
                failed_settings.append(f"{param}: {str(e)}")
        
        if failed_settings:
            return jsonify({
                'success': False, 
                'error': f'Failed to set: {", ".join(failed_settings)}'
            })
        else:
            return jsonify({
                'success': True, 
                'message': f'Applied preset: {preset}'
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/api/camera/presets', methods=['GET'])
def get_camera_presets():
    """Get available camera presets"""
    try:
        if ENHANCED_CAMERA_AVAILABLE and hasattr(camera, 'get_presets'):
            presets = camera.get_presets()
        else:
            # Fallback presets for basic camera
            presets = {
                'daylight': {
                    'name': 'Daylight',
                    'description': 'Optimized for bright outdoor conditions',
                    'parameters': {
                        'exposure': -1.0, 'brightness': 100, 'contrast': 50, 'saturation': 70,
                        'gain': 50, 'whiteBalance': 5500, 'autoExposure': False, 'autoWhiteBalance': True
                    }
                },
                'lowlight': {
                    'name': 'Low Light',
                    'description': 'Enhanced settings for dark environments',
                    'parameters': {
                        'exposure': -3.0, 'brightness': 140, 'contrast': 70, 'saturation': 80,
                        'gain': 150, 'whiteBalance': 3200, 'autoExposure': False, 'autoWhiteBalance': False
                    }
                },
                'indoor': {
                    'name': 'Indoor',
                    'description': 'Balanced settings for indoor use',
                    'parameters': {
                        'exposure': -2.0, 'brightness': 120, 'contrast': 60, 'saturation': 75,
                        'gain': 80, 'whiteBalance': 4000, 'autoExposure': True, 'autoWhiteBalance': True
                    }
                }
            }
        
        return jsonify({'success': True, 'presets': presets})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

def set_real_camera_parameter(parameter, value):
    """Set parameter on real camera using OpenCV"""
    if not CAMERA_AVAILABLE or not hasattr(camera, 'camera'):
        return False
    
    try:
        if parameter == 'exposure':
            camera.camera.set(cv2.CAP_PROP_EXPOSURE, float(value))
        elif parameter == 'brightness':
            camera.camera.set(cv2.CAP_PROP_BRIGHTNESS, int(value))
        elif parameter == 'contrast':
            camera.camera.set(cv2.CAP_PROP_CONTRAST, int(value))
        elif parameter == 'saturation':
            camera.camera.set(cv2.CAP_PROP_SATURATION, int(value))
        elif parameter == 'gain':
            camera.camera.set(cv2.CAP_PROP_GAIN, int(value))
        elif parameter == 'whiteBalance':
            camera.camera.set(cv2.CAP_PROP_WB_TEMPERATURE, int(value))
        elif parameter == 'autoExposure':
            camera.camera.set(cv2.CAP_PROP_AUTO_EXPOSURE, 0.75 if bool(value) else 0.25)
        elif parameter == 'autoWhiteBalance':
            camera.camera.set(cv2.CAP_PROP_AUTO_WB, 1 if bool(value) else 0)
        
        print(f"📸 Real camera parameter set: {parameter} = {value}")
        return True
    except Exception as e:
        print(f"❌ Failed to set camera parameter {parameter}: {e}")
        return False

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

def detect_language_simple(text: str) -> str:
    """Simple language detection based on Cyrillic characters"""
    # Count Cyrillic characters
    cyrillic_count = sum(1 for char in text if '\u0400' <= char <= '\u04FF')
    total_letters = sum(1 for char in text if char.isalpha())
    
    # If more than 30% of letters are Cyrillic, assume Russian
    if total_letters > 0 and (cyrillic_count / total_letters) > 0.3:
        return "ru"
    return "en"

def translate_text_with_openai(text: str, target_language: str) -> str:
    """Translate text using OpenAI if available"""
    try:
        # Try to use OpenAI for translation
        import openai
        import os
        
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            return text  # No translation available
        
        client = openai.OpenAI(api_key=api_key)
        
        if target_language == "ru":
            prompt = f"Translate the following text to Russian. If the input is already in Russian, output it as-is. Only return the translation, no explanations:\n\n{text}"
        else:
            prompt = f"Translate the following text to English. If the input is already in English, output it as-is. Only return the translation, no explanations:\n\n{text}"
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.3
        )
        
        translated = response.choices[0].message.content.strip()
        return translated if translated else text
        
    except Exception as e:
        print(f"Translation error: {e}")
        return text  # Return original text if translation fails

@app.route('/api/tts/speak', methods=['POST'])
def tts_speak():
    """Handle TTS requests using laika_say.py with language detection and translation"""
    try:
        data = request.get_json()
        text = data.get('text', '').strip()
        translate_to = data.get('translate_to', None)  # Optional: 'ru' or 'en'
        
        if not text:
            return jsonify({'success': False, 'error': 'No text provided'})
        
        # Limit text length for safety
        if len(text) > 500:
            return jsonify({'success': False, 'error': 'Text too long (max 500 characters)'})
        
        # Detect input language
        detected_lang = detect_language_simple(text)
        original_text = text
        
        # Translate if requested and different from detected language
        if translate_to and translate_to != detected_lang:
            text = translate_text_with_openai(text, translate_to)
            if text != original_text:
                print(f"Translated from {detected_lang} to {translate_to}: '{original_text}' -> '{text}'")
        
        # Import subprocess to run laika_say.py
        import subprocess
        import os
        
        # Path to laika_say.py
        laika_say_path = '/home/pi/LAIKA/laika_say.py'
        
        if not os.path.exists(laika_say_path):
            return jsonify({'success': False, 'error': 'TTS system not available'})
        
        # Run laika_say.py with the provided text
        # Note: According to memory, we should NOT include the wake word when invoking laika_say.py
        # The script will add "LAIKA, " prefix automatically if needed
        try:
            result = subprocess.run(
                ['python3', laika_say_path, text],
                capture_output=True,
                text=True,
                timeout=30,  # 30 second timeout
                cwd='/home/pi/LAIKA'
            )
            
            if result.returncode == 0:
                response_data = {
                    'success': True, 
                    'message': f'Successfully spoke: "{text}"',
                    'text': text,
                    'detected_language': detected_lang
                }
                
                # Include translation info if translation occurred
                if text != original_text:
                    response_data['original_text'] = original_text
                    response_data['translated'] = True
                    response_data['translation_direction'] = f"{detected_lang} -> {translate_to}"
                
                return jsonify(response_data)
            else:
                error_msg = result.stderr.strip() or result.stdout.strip() or 'Unknown TTS error'
                return jsonify({
                    'success': False, 
                    'error': f'TTS failed: {error_msg}'
                })
                
        except subprocess.TimeoutExpired:
            return jsonify({'success': False, 'error': 'TTS timeout - text may be too long'})
        except Exception as subprocess_error:
            return jsonify({'success': False, 'error': f'TTS execution error: {str(subprocess_error)}'})
            
    except Exception as e:
        return jsonify({'success': False, 'error': f'Server error: {str(e)}'})

@app.route('/api/conversation-data')
def get_conversation_data():
    """Get conversation data for the conversation monitor"""
    try:
        # Try to import and get conversation data from LLM processor
        sys.path.append('/home/pi/LAIKA')
        from laika_llm_processor import get_llm_processor
        
        processor = get_llm_processor()
        data = processor.get_conversation_data_for_pwa()
        
        return jsonify(data)
        
    except ImportError:
        # Fallback: read conversation data directly from file
        try:
            import json
            from pathlib import Path
            
            conversation_file = Path("/tmp/laika_conversations.jsonl")
            conversations = []
            
            if conversation_file.exists():
                with open(conversation_file, 'r') as f:
                    for line in f:
                        try:
                            conversation = json.loads(line.strip())
                            conversations.append(conversation)
                        except json.JSONDecodeError:
                            continue
            
            return jsonify({
                "status": {
                    "stt_running": True,  # Assume running
                    "llm_running": True,
                    "tts_available": True,
                    "timestamp": datetime.now().isoformat() if 'datetime' in globals() else None
                },
                "conversations": conversations[-50:],  # Last 50 conversations
                "total_conversations": len(conversations)
            })
            
        except Exception as e:
            return jsonify({
                "status": {"stt_running": False, "llm_running": False, "tts_available": False},
                "conversations": [],
                "total_conversations": 0,
                "error": str(e)
            })
    
    except Exception as e:
        return jsonify({
            "status": {"stt_running": False, "llm_running": False, "tts_available": False},
            "conversations": [],
            "total_conversations": 0,
            "error": str(e)
        })

@app.route('/api/clear-conversations', methods=['POST'])
def clear_conversations():
    """Clear conversation history"""
    try:
        # Try to use LLM processor to clear
        sys.path.append('/home/pi/LAIKA')
        from laika_llm_processor import get_llm_processor
        
        processor = get_llm_processor()
        processor.clear_conversation_history()
        
        return jsonify({'success': True, 'message': 'Conversation history cleared'})
        
    except ImportError:
        # Fallback: clear file directly
        try:
            from pathlib import Path
            conversation_file = Path("/tmp/laika_conversations.jsonl")
            if conversation_file.exists():
                conversation_file.unlink()
            
            return jsonify({'success': True, 'message': 'Conversation history cleared'})
            
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/conversation')
def conversation_page():
    """Serve the conversation monitoring page"""
    return send_file('conversation.html')

@app.route('/api/pipeline-logs')
def get_pipeline_logs():
    """Get comprehensive pipeline logs from the new logging system"""
    try:
        # Try to import and get pipeline logs
        sys.path.append('/home/pi/LAIKA')
        from laika_pipeline_logger import get_pipeline_logger
        
        logger = get_pipeline_logger()
        
        # Get recent pipeline executions (formatted for chat view)
        recent_executions = logger.get_recent_pipeline_executions(limit=50)
        
        # Format for chat-style display
        chat_messages = []
        for execution in recent_executions:
            data = execution.get('data', {})
            timestamp = execution.get('timestamp', '')
            
            stt_input = data.get('stt_input', '')
            llm_response_raw = data.get('llm_response_raw', '')
            parsed_response = data.get('llm_response_parsed', {})
            tts_output = data.get('tts_output', '')
            success_flags = data.get('success_flags', {})
            context_data = data.get('context_data', {})
            
            # Create user message (STT input)
            if stt_input:
                chat_messages.append({
                    'id': f"{execution.get('transaction_id', '')}_user",
                    'type': 'user',
                    'timestamp': timestamp,
                    'content': stt_input,
                    'meta': {
                        'stt_success': success_flags.get('stt', False),
                        'source': 'STT Pipeline'
                    }
                })
            
            # Create assistant message (LLM response)
            if llm_response_raw:
                assistant_message = {
                    'id': f"{execution.get('transaction_id', '')}_assistant",
                    'type': 'assistant',
                    'timestamp': timestamp,
                    'content': tts_output or parsed_response.get('cleaned_text', llm_response_raw),
                    'raw_content': llm_response_raw,
                    'meta': {
                        'llm_success': success_flags.get('llm', False),
                        'tts_success': success_flags.get('tts', False),
                        'source': 'LLM Pipeline',
                        'parsed_elements': {
                            'actions': parsed_response.get('actions_found', []),
                            'voice_commands': parsed_response.get('voice_commands', []),
                            'sound_effects': parsed_response.get('sound_effects', []),
                            'generic_actions': parsed_response.get('generic_actions', [])
                        },
                        'context_available': bool(context_data),
                        'parse_time_ms': parsed_response.get('parse_time_ms', 0)
                    }
                }
                
                # Add full context if available
                if context_data:
                    assistant_message['context'] = context_data
                
                chat_messages.append(assistant_message)
        
        # Sort by timestamp (newest first for chat display)
        chat_messages.sort(key=lambda x: x['timestamp'], reverse=True)
        
        # Get system status
        summary = logger.get_logs_summary(hours=1)
        
        return jsonify({
            'success': True,
            'messages': chat_messages[:100],  # Limit to 100 most recent
            'status': {
                'stt_running': summary.get('stt_events', 0) > 0,
                'llm_running': summary.get('llm_events', 0) > 0,
                'tts_available': summary.get('tts_events', 0) > 0,
                'timestamp': datetime.now().isoformat() if 'datetime' in globals() else None,
                'pipeline_activity': {
                    'complete_pipelines': summary.get('complete_pipelines', 0),
                    'stt_events': summary.get('stt_events', 0),
                    'llm_events': summary.get('llm_events', 0),
                    'tts_events': summary.get('tts_events', 0),
                    'parser_events': summary.get('parser_events', 0)
                }
            },
            'total_messages': len(chat_messages)
        })
        
    except ImportError:
        # Fallback: return empty chat with status
        return jsonify({
            'success': False,
            'error': 'Pipeline logger not available',
            'messages': [],
            'status': {
                'stt_running': False,
                'llm_running': False,
                'tts_available': False,
                'timestamp': None
            },
            'total_messages': 0
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'messages': [],
            'status': {
                'stt_running': False,
                'llm_running': False,
                'tts_available': False,
                'timestamp': None
            },
            'total_messages': 0
        })

@app.route('/api/processes')
def get_processes():
    """Get system processes like top command"""
    try:
        processes = []
        
        # Get all running processes with their details
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'memory_info', 'create_time', 'status', 'username']):
            try:
                pinfo = proc.info
                
                # Calculate CPU usage (this may take a moment for first call)
                cpu_percent = proc.cpu_percent()
                
                # Get memory info
                memory_info = pinfo.get('memory_info')
                memory_mb = memory_info.rss / 1024 / 1024 if memory_info else 0
                
                # Get process age
                create_time = pinfo.get('create_time', 0)
                if create_time:
                    age_seconds = time.time() - create_time
                    if age_seconds < 60:
                        age = f"{int(age_seconds)}s"
                    elif age_seconds < 3600:
                        age = f"{int(age_seconds/60)}m"
                    elif age_seconds < 86400:
                        age = f"{int(age_seconds/3600)}h"
                    else:
                        age = f"{int(age_seconds/86400)}d"
                else:
                    age = "unknown"
                
                processes.append({
                    'pid': pinfo.get('pid', 0),
                    'name': pinfo.get('name', 'unknown'),
                    'cpu_percent': round(cpu_percent, 1),
                    'memory_percent': round(pinfo.get('memory_percent', 0), 1),
                    'memory_mb': round(memory_mb, 1),
                    'status': pinfo.get('status', 'unknown'),
                    'username': pinfo.get('username', 'unknown'),
                    'age': age
                })
                
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                # Process disappeared or access denied, skip it
                continue
        
        # Sort by CPU usage (descending)
        processes.sort(key=lambda x: x['cpu_percent'], reverse=True)
        
        # Get system stats
        cpu_usage = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        boot_time = psutil.boot_time()
        uptime_seconds = time.time() - boot_time
        
        # Format uptime
        if uptime_seconds < 3600:
            uptime = f"{int(uptime_seconds/60)}m"
        elif uptime_seconds < 86400:
            uptime = f"{int(uptime_seconds/3600)}h {int((uptime_seconds % 3600)/60)}m"
        else:
            days = int(uptime_seconds/86400)
            hours = int((uptime_seconds % 86400)/3600)
            uptime = f"{days}d {hours}h"
        
        # Get load averages (Linux only)
        try:
            load_avg = os.getloadavg()
        except (OSError, AttributeError):
            load_avg = [0, 0, 0]
        
        return jsonify({
            'success': True,
            'processes': processes[:50],  # Return top 50 processes
            'total_processes': len(processes),
            'system_stats': {
                'cpu_percent': round(cpu_usage, 1),
                'memory_percent': round(memory.percent, 1),
                'memory_total_gb': round(memory.total / 1024 / 1024 / 1024, 2),
                'memory_used_gb': round(memory.used / 1024 / 1024 / 1024, 2),
                'memory_free_gb': round(memory.free / 1024 / 1024 / 1024, 2),
                'disk_percent': round(disk.percent, 1),
                'disk_total_gb': round(disk.total / 1024 / 1024 / 1024, 2),
                'disk_used_gb': round(disk.used / 1024 / 1024 / 1024, 2),
                'disk_free_gb': round(disk.free / 1024 / 1024 / 1024, 2),
                'uptime': uptime,
                'load_avg': [round(load, 2) for load in load_avg],
                'timestamp': datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False, 
            'error': str(e),
            'processes': [],
            'system_stats': {}
        })

@app.route('/api/processes/kill', methods=['POST'])
def kill_process():
    """Kill a process by PID"""
    try:
        data = request.get_json()
        pid = data.get('pid')
        
        if not pid:
            return jsonify({'success': False, 'error': 'PID is required'})
        
        # Get process info first
        try:
            proc = psutil.Process(pid)
            process_name = proc.name()
            
            # Safety check - don't kill critical system processes
            critical_processes = ['init', 'kernel', 'systemd', 'ssh', 'NetworkManager']
            if any(critical in process_name.lower() for critical in critical_processes):
                return jsonify({
                    'success': False, 
                    'error': f'Cannot kill critical system process: {process_name}'
                })
            
            # Kill the process
            proc.terminate()
            
            # Wait a bit and check if it's really gone
            time.sleep(0.5)
            if proc.is_running():
                proc.kill()  # Force kill if terminate didn't work
            
            return jsonify({
                'success': True, 
                'message': f'Process {process_name} (PID: {pid}) terminated'
            })
            
        except psutil.NoSuchProcess:
            return jsonify({
                'success': False, 
                'error': f'Process with PID {pid} not found'
            })
        except psutil.AccessDenied:
            return jsonify({
                'success': False, 
                'error': f'Access denied - cannot kill process {pid}'
            })
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

# ================================
# CURSOR AI ENDPOINTS
# ================================

@app.route('/cursor/chat', methods=['POST'])
def cursor_chat():
    """Handle Cursor AI chat messages"""
    if not CURSOR_AVAILABLE or not cursor_api:
        return jsonify({
            'success': False,
            'error': 'Cursor AI not available',
            'message': {
                'id': str(uuid.uuid4()),
                'role': 'assistant',
                'content': 'Cursor AI is not available on this system.',
                'timestamp': datetime.now().isoformat(),
                'metadata': {'error': True}
            }
        }), 503
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'JSON data required'}), 400
            
        session_id = data.get('session_id', str(uuid.uuid4()))
        message = data.get('message', '').strip()
        context = data.get('context')
        
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Use asyncio to run the async method
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                cursor_api.process_chat_message(session_id, message, context)
            )
        finally:
            loop.close()
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'message': {
                'id': str(uuid.uuid4()),
                'role': 'assistant',
                'content': f'Error processing message: {str(e)}',
                'timestamp': datetime.now().isoformat(),
                'metadata': {'error': True}
            }
        }), 500

@app.route('/cursor/status', methods=['GET'])
def cursor_status():
    """Get Cursor AI status"""
    if not CURSOR_AVAILABLE or not cursor_api:
        return jsonify({
            'cursor_available': False,
            'error': 'Cursor AI not loaded'
        })
    
    try:
        status = cursor_api.get_status()
        return jsonify(status)
    except Exception as e:
        return jsonify({
            'cursor_available': False,
            'error': str(e)
        }), 500

@app.route('/cursor/session/<session_id>', methods=['GET'])
def cursor_session_info(session_id):
    """Get session information"""
    if not CURSOR_AVAILABLE or not cursor_api:
        return jsonify({'error': 'Cursor AI not available'}), 503
    
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                cursor_api.get_session_info(session_id)
            )
        finally:
            loop.close()
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/cursor/session/<session_id>', methods=['DELETE'])
def cursor_clear_session(session_id):
    """Clear session messages"""
    if not CURSOR_AVAILABLE or not cursor_api:
        return jsonify({'error': 'Cursor AI not available'}), 503
    
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                cursor_api.clear_session(session_id)
            )
        finally:
            loop.close()
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/cursor.html')
def cursor_interface():
    """Serve the Cursor AI interface"""
    try:
        with open('cursor.html', 'r') as f:
            return f.read()
    except FileNotFoundError:
        return "Cursor AI interface not found", 404

if __name__ == '__main__':
    # Initialize ROS2 node
    init_ros_node()
    
    # Start camera
    camera.camera_open()
    
    # Run Flask app
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)


