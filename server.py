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

@app.route('/api/camera/parameters', methods=['GET'])
def get_camera_parameters():
    """Get current camera parameters"""
    try:
        if hasattr(camera, 'get_parameters'):
            params = camera.get_parameters()
        else:
            # Fallback for real camera
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
        if hasattr(camera, 'set_parameter'):
            success = camera.set_parameter(parameter, value)
        else:
            # For real camera, use OpenCV properties
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
        
        # Apply all settings in the preset
        failed_settings = []
        for param, value in settings.items():
            try:
                if hasattr(camera, 'set_parameter'):
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

if __name__ == '__main__':
    # Initialize ROS2 node
    init_ros_node()
    
    # Start camera
    camera.camera_open()
    
    # Run Flask app
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)


