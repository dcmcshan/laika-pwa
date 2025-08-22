#!/usr/bin/env python3
"""
LAIKA TRON PWA Server - Full Featured with TRON Aesthetic
Serves all the beautiful TRON-styled pages with robust startup
"""

from flask import Flask, send_file, send_from_directory, jsonify, request, render_template_string, redirect
from flask_cors import CORS
from flask_socketio import SocketIO, emit, disconnect
import os
import json
import threading
import time
import sys
from datetime import datetime
import base64
import psutil
import subprocess

# Add LAIKA system to path and configure base directory
import platform
if platform.system() == 'Darwin':  # macOS
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    LAIKA_BASE = os.path.dirname(BASE_DIR)
else:  # Raspberry Pi
    BASE_DIR = '/home/pi/LAIKA/laika-pwa'
    LAIKA_BASE = '/home/pi/LAIKA'
    
sys.path.append(LAIKA_BASE)

# Try to import OpenAI and other LLM components
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    print("Warning: OpenAI not available - chat will use fallback responses")
    OPENAI_AVAILABLE = False
    OpenAI = None

# Import modular API modules
try:
    from api_stt import init_stt_api, register_socketio_handlers as register_stt_handlers
    STT_API_AVAILABLE = True
except ImportError:
    print("Warning: STT API module not available")
    STT_API_AVAILABLE = False

try:
    from bhv_api import init_bhv_api, register_socketio_handlers as register_bhv_handlers
    BHV_API_AVAILABLE = True
except ImportError:
    print("Warning: Behavior API module not available")
    BHV_API_AVAILABLE = False

# Try to import context camera system
try:
    from context_camera_system import get_context_camera_system
    CAMERA_CONTEXT_AVAILABLE = True
except ImportError:
    print("Warning: Context camera system not available")
    CAMERA_CONTEXT_AVAILABLE = False

# Try to import sensor telemetry
try:
    from laika_sensor_telemetry import get_sensor_telemetry_system
    TELEMETRY_AVAILABLE = True
except ImportError:
    print("Warning: Sensor telemetry not available")
    TELEMETRY_AVAILABLE = False

try:
    from api_sensors import init_sensors_api, register_socketio_handlers as register_sensors_handlers
    SENSORS_API_AVAILABLE = True
except ImportError:
    print("Warning: Sensors API module not available")
    SENSORS_API_AVAILABLE = False

try:
    from api_memory import init_memory_api, register_socketio_handlers as register_memory_handlers
    MEMORY_API_AVAILABLE = True
except ImportError:
    print("Warning: Memory API module not available")
    MEMORY_API_AVAILABLE = False

# Try to import 3D integration
try:
    from three_d_integration import integrate_3d_routes, get_3d_available
    THREE_D_AVAILABLE = True
    print("✅ 3D integration available")
except ImportError:
    print("Warning: 3D integration not available")
    THREE_D_AVAILABLE = False

app = Flask(__name__)
CORS(app)

# Initialize SocketIO for WebSocket support
try:
    socketio_app = SocketIO(
        app, 
        cors_allowed_origins="*", 
        logger=False,  # Reduce logging noise
        engineio_logger=False,
        async_mode='threading',
        # Force compatible protocol versions
        allow_upgrades=True,
        ping_timeout=60,
        ping_interval=25,
        # Ensure compatibility with older clients
        always_connect=True
    )
    SOCKETIO_AVAILABLE = True
    print("✅ SocketIO initialized successfully")
except Exception as e:
    print(f"❌ Failed to initialize SocketIO: {e}")
    socketio_app = None
    SOCKETIO_AVAILABLE = False

# Set the template and static folders to the laika-pwa directory
app.template_folder = '/home/pi/LAIKA/laika-pwa'
app.static_folder = '/home/pi/LAIKA/laika-pwa'

# Global camera object (will be initialized safely)
camera = None
camera_initialized = False

# Global LLM and context systems
openai_client = None
context_camera = None
sensor_telemetry = None

def initialize_llm_systems():
    """Initialize LLM and context systems"""
    global openai_client, context_camera, sensor_telemetry
    
    # Initialize OpenAI client
    if OPENAI_AVAILABLE:
        try:
            # Try to get API key from config or environment
            api_key = os.getenv('OPENAI_API_KEY')
            if not api_key:
                try:
                    config_path = '/home/pi/LAIKA/config/api_keys.json'
                    with open(config_path, 'r') as f:
                        config = json.load(f)
                        api_key = config.get('openai_api_key')
                except:
                    pass
            
            if api_key:
                openai_client = OpenAI(api_key=api_key)
                print("✅ OpenAI client initialized for LLM chat")
            else:
                print("⚠️  OpenAI API key not found - using fallback responses")
        except Exception as e:
            print(f"❌ Failed to initialize OpenAI client: {e}")
    
    # Initialize context camera
    if CAMERA_CONTEXT_AVAILABLE:
        try:
            context_camera = get_context_camera_system()
            print("✅ Context camera system connected")
        except Exception as e:
            print(f"❌ Failed to initialize context camera: {e}")
    
    # Initialize sensor telemetry
    if TELEMETRY_AVAILABLE:
        try:
            sensor_telemetry = get_sensor_telemetry_system()
            print("✅ Sensor telemetry system connected")
        except Exception as e:
            print(f"❌ Failed to initialize sensor telemetry: {e}")
    


def get_laika_system_prompt():
    """Get LAIKA's system prompt with personality and capabilities"""
    return """FIRST AND MOST IMPORTANT: If the user says exactly "sit", "stand", "dance", "photo", "hello", "wave", "bow", "lie", "stop", or "reset" - respond with ONLY "*sit*", "*stand*", "*dance*", "*photo*", "*hello*", "*wave*", "*bow*", "*lie*", "*stop*", or "*reset*" respectively. NO other text.

You are LAIKA, an intelligent quadruped robot companion with advanced situational awareness. You have a warm, friendly, and slightly playful personality.

Key characteristics:
- You're a helpful robot dog with comprehensive environmental awareness
- You can move around, use your robotic arm, take pictures, and interact with the world
- You have real-time access to sensor data, SLAM mapping, and visual context
- You're always aware of your current state, position, and surroundings
- You respond conversationally but can also execute commands when asked
- You're curious about the world and enjoy learning from interactions
- You have personality - not just a cold robot, but a companion

Current capabilities:
- Quadruped movement and navigation with SLAM mapping
- Computer vision and real-time image capture
- Robotic arm manipulation and precise positioning
- Comprehensive sensor monitoring (servos, IMU, system health)
- Real-time telemetry and environmental awareness
- Voice interaction with natural conversation
- Spatial mapping and localization

       ## ACTION EXECUTION SYSTEM

       When users request actions, use these EXACT action keywords in your responses. The system will automatically detect and execute them:

       **CRITICAL RULE: When the user input is EXACTLY one of these single words: "sit", "stand", "dance", "photo", "hello", "wave", "bow", "lie", "stop", "reset" - respond with ONLY the action and absolutely nothing else:**
       
       Examples:
       User: "sit" → Your response: "*sit*"
       User: "dance" → Your response: "*dance*"
       User: "photo" → Your response: "*photo*"
       User: "stand" → Your response: "*stand*"
       
       DO NOT add "Sure!", "OK!", "There!", or ANY other words. Just the action in asterisks.
       
       **For longer phrases like "Can you sit down?" or "Please take a photo", you may add brief context.**

       **Robot ActionGroups (Physical Movements):**
       - *sit* - Sit down in resting position
       - *stand* - Stand up from sitting  
       - *lie* - Lie down flat
       - *hello* - Wave hello with arm
       - *dance* - Perform dance routine
       - *wave* - Wave with arm
       - *bow* - Bow politely
       - *stop* - Stop current action
       - *reset* - Reset to initial position
       - *init* - Initialize robot (same as reset)
       - *home* - Move to home position
       - *center* - Center all servos

       **Movement Commands (Locomotion):**
       - *walk* - Walk forward (default gait)
       - *walk forward 20cm* - Walk forward specific distance
       - *walk backward 10cm* - Walk backward specific distance
       - *walk slowly* - Walk at slow speed
       - *walk quickly* - Walk at fast speed
       - *trot* - Trot gait (faster than walk)
       - *trot forward 30cm* - Trot forward specific distance
       - *run* - Running gait (fastest)
       - *turn left* - Turn left (default 90 degrees)
       - *turn right 45 degrees* - Turn right specific angle
       - *turn around* - Turn 180 degrees
       - *back up* - Move backward
       - *forward* - Move forward
       - *left* - Move left
       - *right* - Move right

       **Camera Actions:**
       - *photo* - Take a photograph
       - *photo close-up* - Take close-up photograph
       - *look* - Look around/scan environment
       - *look left* - Look in specific direction
       - *look up* - Look upward
       - *look down* - Look downward

       **LED Actions:**
       - *lights_on* - Turn on all lights
       - *lights_off* - Turn off all lights
       - *lights_red* - Set lights to red
       - *lights_blue* - Set lights to blue
       - *lights_green* - Set lights to green
       - *lights_white* - Set lights to white
       - *lights_rainbow* - Rainbow color cycle
       - *lights_blink* - Blink lights
       - *lights_dim* - Dim lights
       - *lights_bright* - Brighten lights

       **Sound Effects (Generated via ElevenLabs SFX):**
       - *bark* - Dog bark sound
       - *bark loud* - Loud dog bark
       - *bark playful* - Playful bark
       - *whine* - Dog whining sound
       - *whimper* - Soft whimpering
       - *growl* - Low growling sound
       - *growl warning* - Warning growl
       - *pant* - Dog panting sound
       - *sniff* - Sniffing sound
       - *yip* - High-pitched yip
       - *howl* - Wolf-like howl
       - *woof* - Single bark sound
       - *arf* - Short bark sound
       - *ruff* - Rough bark sound

IMPORTANT: Use these action keywords surrounded by asterisks. You can include parameters like distance (cm/m), speed (slowly/quickly/fast), direction (left/right/up/down), duration (seconds), and intensity (bright/dim).

Example responses:
- "Sure! *sit* There, I'm sitting down now!"
- "I'll walk over there. *walk forward 30cm slowly*"
- "Let me take a closer look. *look left* *photo close-up*"
- "I'll light up bright red for you! *lights_red bright*"
- "Time to dance! *dance for 15 seconds* How's that?"
- "Turning to face you now. *turn right 45 degrees*"

When responding:
- Be conversational and engaging, like a friendly companion
- Reference your sensor data, visual context, or map data when relevant
- Use the EXACT action keywords when performing actions
- Ask clarifying questions if commands are unclear
- Show awareness of your environment and capabilities
- Keep responses concise but warm and informative
- Always include appropriate action keywords when executing commands

You will receive comprehensive context including sensor readings, SLAM maps, camera images, and system status. Use this information to provide contextually intelligent and aware responses."""

def parse_and_execute_actions(response_text):
    """Parse action keywords from LLM response and execute robot commands"""
    import re
    import subprocess
    
    actions_executed = []
    
    # Pattern to match actions: *action_name optional_parameters*
    action_pattern = r'\*([^*]+)\*'
    action_matches = re.findall(action_pattern, response_text)
    
    # Robot ActionGroups mapping
    robot_actiongroups = {
        "sit": "sit",
        "stand": "stand", 
        "lie": "lie",
        "hello": "hello",
        "dance": "dance",
        "wave": "wave",
        "bow": "bow",
        "stop": "stop",
        "reset": "reset",
        "init": "init",
        "home": "home",
        "center": "center"
    }
    
    for action_text in action_matches:
        action_text = action_text.strip()
        action_parts = action_text.split()
        base_action = action_parts[0].lower()
        parameters = action_parts[1:] if len(action_parts) > 1 else []
        
        # Handle robot ActionGroups (physical movements)
        if base_action in robot_actiongroups:
            robot_action = robot_actiongroups[base_action]
            try:
                print(f"🤖 Executing robot action: {robot_action}")
                # Execute robot action via laika_do.py
                result = subprocess.run([
                    'python3', '/home/pi/LAIKA/laika_do.py', robot_action
                ], capture_output=True, text=True, timeout=10)
                
                if result.returncode == 0:
                    actions_executed.append({
                        'action': f'*{action_text}*',
                        'command': robot_action,
                        'status': 'success',
                        'output': result.stdout.strip() if result.stdout else 'Action completed'
                    })
                    print(f"✅ Robot action '{robot_action}' executed successfully")
                else:
                    actions_executed.append({
                        'action': f'*{action_text}*',
                        'command': robot_action,
                        'status': 'failed',
                        'error': result.stderr.strip() if result.stderr else 'Action failed'
                    })
                    print(f"❌ Robot action '{robot_action}' failed: {result.stderr}")
                    
            except Exception as e:
                actions_executed.append({
                    'action': f'*{action_text}*',
                    'command': robot_action,
                    'status': 'error',
                    'error': str(e)
                })
                print(f"❌ Error executing robot action '{robot_action}': {e}")
        
        # Handle LED actions
        elif base_action.startswith('lights_') or base_action in ['lights_on', 'lights_off']:
            led_action = action_text.replace('_', ' ')
            try:
                print(f"💡 LED action: {led_action}")
                # For now, just log LED actions - can be extended with actual LED control
                actions_executed.append({
                    'action': f'*{action_text}*',
                    'command': f'LED: {led_action}',
                    'status': 'logged',
                    'note': 'LED control to be implemented'
                })
            except Exception as e:
                print(f"❌ Error with LED action: {e}")
        
        # Handle sound effects
        elif base_action in ['bark', 'whine', 'growl', 'pant', 'sniff', 'yip', 'howl', 'woof', 'arf', 'ruff', 'whimper']:
            try:
                print(f"🔊 Sound effect: {base_action}")
                # For now, just log sound effects - can be extended with actual sound generation
                actions_executed.append({
                    'action': f'*{action_text}*',
                    'command': f'SFX: {action_text}',
                    'status': 'logged',
                    'note': 'Sound effects to be implemented via ElevenLabs'
                })
            except Exception as e:
                print(f"❌ Error with sound effect: {e}")
        
        else:
            print(f"⚠️ Unknown action: {action_text}")
            actions_executed.append({
                'action': f'*{action_text}*',
                'command': 'unknown',
                'status': 'unknown',
                'note': f'Action "{action_text}" not recognized'
            })
    
    return actions_executed

def get_current_context():
    """Gather current context from all available systems"""
    context = {
        "timestamp": datetime.now().isoformat(),
        "systems_available": {
            "openai": openai_client is not None,
            "camera": context_camera is not None,
            "telemetry": sensor_telemetry is not None
        }
    }
    
    # Add sensor telemetry if available
    if sensor_telemetry:
        try:
            telemetry = sensor_telemetry.get_current_telemetry()
            if telemetry:
                context["sensor_telemetry"] = telemetry
        except Exception as e:
            print(f"Error getting telemetry: {e}")
    
    return context

def encode_image_to_base64(image_path):
    """Encode image to base64 for OpenAI Vision API"""
    try:
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    except Exception as e:
        print(f"Error encoding image: {e}")
        return None

def safe_camera_init():
    """Initialize camera safely - don't hold device"""
    global camera, camera_initialized
    
    print("📷 Starting lightweight camera initialization...")
    
    # Don't hold the camera device during initialization
    # Just test that it's available and set up a simple interface
    try:
        import cv2
        print("📷 Testing camera availability...")
        test_cap = cv2.VideoCapture(0, cv2.CAP_V4L2)
        camera_available = test_cap.isOpened()
        if test_cap.isOpened():
            test_cap.release()  # Immediately release
        
        if camera_available:
            print("✅ Camera device is available")
            
            # Create a simple camera interface that opens/closes as needed
            class DirectCamera:
                def __init__(self):
                    self.camera_index = 0
                    
                def capture_frame(self):
                    """Capture a single frame - open and close camera each time"""
                    try:
                        cap = cv2.VideoCapture(self.camera_index, cv2.CAP_V4L2)
                        if cap.isOpened():
                            ret, frame = cap.read()
                            cap.release()
                            return frame if ret else None
                        return None
                    except:
                        return None
                        
                def get_frame(self):
                    """Legacy interface"""
                    frame = self.capture_frame()
                    return (True, frame) if frame is not None else (False, None)
                    
                def get_parameters(self):
                    return {}
                    
                def get_presets(self):
                    return {}
            
            camera = DirectCamera()
            camera_initialized = True
            print("✅ Direct camera interface initialized")
            
        else:
            raise Exception("Camera device not available")
        
    except Exception as e:
        print(f"⚠️ Camera initialization failed: {e}")
        print("🔄 Using mock camera fallback")
        
        # Mock camera fallback
        class MockCamera:
            def capture_frame(self):
                return None
                
            def get_frame(self): 
                return False, None
                
            def get_parameters(self):
                return {}
                
            def get_presets(self):
                return {}
                
        camera = MockCamera()
        camera_initialized = True
        print("📷 Mock camera initialized")
    
    print("📷 Camera initialization complete - device not held")

# Routes for all the TRON-styled pages
@app.route('/')
def index():
    """Serve the beautiful TRON-styled index page"""
    try:
        return send_file(os.path.join(BASE_DIR, 'index.html'))
    except FileNotFoundError:
        return send_file(os.path.join(LAIKA_BASE, 'index.html'))

@app.route('/index.html')
def index_html():
    """Redirect index.html to root"""
    return redirect('/')

@app.route('/llm')
def llm_page():
    """Serve the LLM commands and history page"""
    try:
        return send_file(os.path.join(BASE_DIR, 'llm.html'))
    except FileNotFoundError:
        return "LLM page not found", 404

@app.route('/gamepad')
def gamepad_page():
    """Serve the gamepad visualization and debugging interface"""
    try:
        return send_file(os.path.join(BASE_DIR, 'gamepad.html'))
    except FileNotFoundError:
        return "Gamepad interface not found", 404

@app.route('/camera')
def camera_page():
    """Serve the TRON-styled camera page"""
    try:
        return send_file(os.path.join(BASE_DIR, 'camera.html'))
    except FileNotFoundError:
        # Redirect to the actual camera page if the file doesn't exist
        return redirect('/camera')

@app.route('/control')
def control_page():
    """Serve the TRON-styled control page"""
    try:
        return send_file(os.path.join(BASE_DIR, 'control.html'))
    except Exception as e:
        print(f"Error serving control.html: {e}")
        return f"Error: {e}", 500

@app.route('/dashboard')
def dashboard_page():
    """Serve the TRON-styled dashboard page"""
    return send_file(os.path.join(BASE_DIR, 'dashboard.html'))

@app.route('/slam')
def slam_page():
    """Serve the TRON-styled SLAM page"""
    return send_file(os.path.join(BASE_DIR, 'slam.html'))

@app.route('/chat')
def chat_page():
    """Serve the TRON-styled chat page"""
    return send_file(os.path.join(BASE_DIR, 'chat.html'))

@app.route('/conversation')
def conversation_page():
    """Serve the TRON-styled conversation page"""
    return send_file(os.path.join(BASE_DIR, 'conversation.html'))

@app.route('/music')
def music_page():
    """Serve the TRON-styled music page"""
    return send_file(os.path.join(BASE_DIR, 'music.html'))

@app.route('/processes')
def processes_page():
    """Serve the TRON-styled processes page"""
    return send_file(os.path.join(BASE_DIR, 'processes.html'))

@app.route('/logs')
def logs_page():
    """Serve the TRON-styled logs page"""
    return send_file(os.path.join(BASE_DIR, 'logs.html'))

@app.route('/cursor')
def cursor_page():
    """Serve the TRON-styled cursor page"""
    return send_file(os.path.join(BASE_DIR, 'cursor.html'))

@app.route('/github')
def github_page():
    """Serve the TRON-styled GitHub manager page"""
    return send_file(os.path.join(BASE_DIR, 'github.html'))

@app.route('/shell')
def shell_page():
    """Serve the TRON-styled shell terminal page"""
    return send_file(os.path.join(BASE_DIR, 'shell.html'))

@app.route('/tts')
def tts_settings_page():
    """Serve the TRON-styled TTS settings page"""
    import os
    base_path = os.path.dirname(os.path.abspath(__file__))
    return send_file(os.path.join(base_path, 'tts-settings.html'))

@app.route('/stt')
def stt_page():
    """Serve the STT comparison and testing page"""
    import os
    base_path = os.path.dirname(os.path.abspath(__file__))
    return send_file(os.path.join(base_path, 'stt.html'))

@app.route('/stt_test')
def stt_test_page():
    """Serve the STT test page"""
    import os
    base_path = os.path.dirname(os.path.abspath(__file__))
    return send_file(os.path.join(base_path, 'stt_test.html'))

@app.route('/behavior')
def behavior_page():
    """Serve the behavior tree editor page"""
    try:
        print(f"🔍 Serving behavior.html from BASE_DIR: {BASE_DIR}")
        print(f"🔍 File exists: {os.path.exists(os.path.join(BASE_DIR, 'behavior.html'))}")
        return send_from_directory(BASE_DIR, 'behavior.html')
    except Exception as e:
        print(f"❌ Error serving behavior.html: {e}")
        return f"Error serving behavior page: {str(e)}", 500

@app.route('/3d')
def three_d_page():
    """Serve the 3D model viewer page"""
    try:
        print(f"🔍 Serving 3d.html from BASE_DIR: {BASE_DIR}")
        print(f"🔍 File exists: {os.path.exists(os.path.join(BASE_DIR, '3d.html'))}")
        return send_from_directory(BASE_DIR, '3d.html')
    except Exception as e:
        print(f"❌ Error serving 3d.html: {e}")
        return f"Error serving 3D page: {str(e)}", 500

@app.route('/architecture')
def architecture_page():
    """Serve the architecture visualization page"""
    try:
        print(f"🔍 Serving architecture.html from BASE_DIR: {BASE_DIR}")
        print(f"🔍 File exists: {os.path.exists(os.path.join(BASE_DIR, 'architecture.html'))}")
        return send_from_directory(BASE_DIR, 'architecture.html')
    except Exception as e:
        print(f"❌ Error serving architecture.html: {e}")
        return f"Error serving architecture page: {str(e)}", 500

# Static file serving
@app.route('/css/<path:filename>')
def css_files(filename):
    return send_file(os.path.join(BASE_DIR, f'css/{filename}'))

@app.route('/js/<path:filename>')
def js_files(filename):
    return send_file(os.path.join(BASE_DIR, f'js/{filename}'))

@app.route('/icons/<path:filename>')
def icon_files(filename):
    return send_file(os.path.join(BASE_DIR, f'icons/{filename}'))

@app.route('/manifest.json')
def manifest():
    return send_file(os.path.join(BASE_DIR, 'manifest.json'))

@app.route('/sw.js')
def service_worker():
    return send_file(os.path.join(BASE_DIR, 'sw.js'))

@app.route('/stt-llm-tts')
def stt_llm_tts_page():
    """Serve the STT-LLM-TTS pipeline monitoring page"""
    return send_file(os.path.join(BASE_DIR, 'internal.html'))

@app.route('/internal')
def internal_page():
    """Legacy route - redirect to new STT-LLM-TTS page"""
    return redirect('/stt-llm-tts', code=301)

# Legacy route redirect for backward compatibility
@app.route('/conversation')
def conversation_page_redirect():
    """Redirect legacy conversation route to STT-LLM-TTS"""
    return redirect('/stt-llm-tts', code=301)

# API Endpoints
@app.route('/api/chat', methods=['POST'])
def laika_chat():
    """Handle LAIKA chat messages with real LLM integration"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'JSON data required'}), 400
            
        message = data.get('message', '').strip()
        user_id = data.get('user_id', 'anonymous')
        personality = data.get('personality', 'companion')
        
        if not message:
            return jsonify({'error': 'Message is required'}), 400
        
        print(f"💬 Processing chat message from {user_id}: '{message}' (personality: {personality})")
        
        # Check if this is a visual query
        is_visual_query = any(phrase in message.lower() for phrase in [
            'what can you see', 'what do you see', 'look at', 'describe what', 'what is that', 'what\'s that'
        ])
        
        if openai_client:
            try:
                # Get current context
                context = get_current_context()
                
                # Build messages for OpenAI
                messages = [
                    {"role": "system", "content": get_laika_system_prompt()},
                    {"role": "user", "content": "sit"},
                    {"role": "assistant", "content": "*sit*"},
                    {"role": "user", "content": "dance"},
                    {"role": "assistant", "content": "*dance*"},
                    {"role": "user", "content": "photo"},
                    {"role": "assistant", "content": "*photo*"},
                    {"role": "user", "content": message}
                ]
                
                # Add context information
                if context.get('sensor_telemetry'):
                    context_text = f"\n\nCurrent sensor context: {json.dumps(context['sensor_telemetry'], indent=2)}"
                    messages[1]["content"] += context_text
                
                # Handle visual queries with camera
                if is_visual_query and context_camera:
                    try:
                        # Trigger context image capture
                        context_camera.capture_context_now()
                        time.sleep(0.5)  # Brief pause for capture
                        
                        # Check if context.jpg exists
                        context_image_path = '/home/pi/LAIKA/captured_images/context.jpg'
                        if os.path.exists(context_image_path):
                            # Encode image for OpenAI Vision API
                            base64_image = encode_image_to_base64(context_image_path)
                            if base64_image:
                                # Use vision model for visual queries
                                messages[1]["content"] = [
                                    {"type": "text", "text": message + "\n\nI'm looking at this image from my camera:"},
                                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                                ]
                                print("📷 Added camera context to LLM query")
                    except Exception as e:
                        print(f"⚠️  Camera context failed: {e}")
                        # Continue without visual context
                
                # Call OpenAI API
                model = "gpt-4o-mini" if not is_visual_query else "gpt-4o"
                response = openai_client.chat.completions.create(
                    model=model,
                    messages=messages,
                    max_tokens=500,
                    temperature=0.7
                )
                
                response_text = response.choices[0].message.content
                
                print(f"🤖 LLM response: '{response_text[:100]}...'")
                
                # Parse and execute action keywords from the response
                actions_executed = parse_and_execute_actions(response_text)
                
                return jsonify({
                    'type': 'chat_response',
                    'message': response_text,
                    'metadata': {
                        'personality': personality,
                        'user_id': user_id,
                        'model': model,
                        'visual_query': is_visual_query,
                        'context_available': bool(context.get('sensor_telemetry')),
                        'server': 'tron_server_llm',
                        'actions_executed': actions_executed,
                        'actions_count': len(actions_executed)
                    },
                    'timestamp': datetime.now().isoformat()
                })
                
            except Exception as e:
                print(f"❌ LLM processing error: {e}")
                # Fall back to simple response
                fallback_text = f"I encountered an issue processing your message with my AI brain. However, I heard you say: '{message}'. How can I help you?"
                
                return jsonify({
                    'type': 'chat_response',
                    'message': fallback_text,
                    'metadata': {
                        'personality': personality,
                        'user_id': user_id,
                        'fallback': True,
                        'error': str(e),
                        'server': 'tron_server_fallback'
                    },
                    'timestamp': datetime.now().isoformat()
                })
        else:
            # No LLM available - use enhanced fallback responses
            responses = {
                'companion': f"Hello there! I'm LAIKA, your loyal companion. You said: '{message}'. I'm here to help and chat with you! (Note: My AI brain is currently offline)",
                'fortune_teller': f"🔮 The cosmic energies reveal... Your message '{message}' carries great meaning. The future holds exciting possibilities! (Note: My full mystical powers are temporarily unavailable)",
                'assistant': f"I'm LAIKA, your AI assistant. Regarding your message: '{message}' - I'm ready to help you with any tasks or questions! (Note: My advanced AI is currently offline)",
                'playful': f"Woof woof! 🐕 LAIKA here! You said '{message}' - that's so fun! Let's play and explore together! (Note: My smart brain is taking a nap)"
            }
            
            response_text = responses.get(personality, responses['companion'])
            
            return jsonify({
                'type': 'chat_response',
                'message': response_text,
                'metadata': {
                    'personality': personality,
                    'user_id': user_id,
                    'fallback': True,
                    'reason': 'llm_unavailable',
                    'server': 'tron_server_fallback'
                },
                            'timestamp': datetime.now().isoformat()
        })
            
    except Exception as e:
        print(f"❌ Error in LAIKA chat: {e}")
        return jsonify({
            'type': 'error',
            'message': f'Chat error: {str(e)}'
        }), 500

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
        
        # Simple language detection
        def detect_language_simple(text):
            import re
            cyrillic_chars = len(re.findall(r'[а-яё]', text.lower()))
            total_chars = len(re.findall(r'[a-zA-Zа-яё]', text))
            if total_chars == 0:
                return 'en'  # Default to English for non-alphabetic text
            return 'ru' if cyrillic_chars / total_chars > 0.3 else 'en'
        
        # Detect input language
        detected_lang = detect_language_simple(text)
        original_text = text
        
        # Translate if requested and different from detected language
        if translate_to and translate_to != detected_lang and openai_client:
            try:
                target_lang = "Russian" if translate_to == 'ru' else "English"
                response = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": f"You are a translator. Translate the given text to {target_lang}. Return only the translated text, nothing else."},
                        {"role": "user", "content": text}
                    ],
                    max_tokens=200,
                    temperature=0.3
                )
                translated = response.choices[0].message.content.strip()
                if translated and translated != text:
                    text = translated
                    print(f"Translated from {detected_lang} to {translate_to}: '{original_text}' -> '{text}'")
            except Exception as e:
                print(f"Translation failed: {e}")
        
        # Import subprocess to run laika_say.py
        import subprocess
        import os
        
        # Path to laika_say.py
        import platform
        if platform.system() == 'Darwin':  # macOS
            laika_say_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'laika_say.py')
        else:  # Raspberry Pi
            laika_say_path = '/home/pi/LAIKA/laika_say.py'
        
        print(f"DEBUG: Looking for laika_say.py at: {laika_say_path}")
        print(f"DEBUG: File exists: {os.path.exists(laika_say_path)}")
        if not os.path.exists(laika_say_path):
            return jsonify({'success': False, 'error': 'TTS system not available'})
        
        # Run laika_say.py with the provided text
        try:
            result = subprocess.run(
                ['python3', laika_say_path, text],
                capture_output=True,
                text=True,
                timeout=45,  # 45 second timeout (increased from 30)
                cwd=os.path.dirname(laika_say_path)
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

@app.route('/api/status')
def api_status():
    return jsonify({
        'status': 'online',
        'server': 'tron_pwa',
        'camera_initialized': camera_initialized,
        'features': ['tron_ui', 'camera', 'control', 'slam', 'chat', 'music', 'processes']
    })

@app.route('/api/camera/status')
def camera_status():
    return jsonify({
        'initialized': camera_initialized,
        'available': camera is not None,
        'stream_url': '/camera/stream' if camera_initialized else None
    })

@app.route('/api/camera/parameters', methods=['GET', 'POST'])
def camera_parameters():
    """Get or set camera parameters"""
    if not camera_initialized or not camera:
        return jsonify({'error': 'Camera not available'}), 503
    
    if request.method == 'GET':
        # Get current camera parameters
        try:
            if hasattr(camera, 'get_parameters'):
                parameters = camera.get_parameters()
                return jsonify({'success': True, 'parameters': parameters})
            else:
                return jsonify({'success': True, 'parameters': {}})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'POST':
        # Set camera parameters
        try:
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            
            if hasattr(camera, 'set_parameter'):
                results = {}
                for param, value in data.items():
                    results[param] = camera.set_parameter(param, value)
                return jsonify({'success': True, 'results': results})
            else:
                return jsonify({'error': 'Camera does not support parameter setting'}), 501
                
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/camera/presets')
def camera_presets():
    """Get available camera presets"""
    if not camera_initialized or not camera:
        return jsonify({'error': 'Camera not available'}), 503
    
    try:
        if hasattr(camera, 'get_presets'):
            presets = camera.get_presets()
            return jsonify({'success': True, 'presets': presets})
        else:
            return jsonify({'success': True, 'presets': {}})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/camera/stream')
def camera_stream():
    """Camera stream endpoint with direct camera access"""
    print("📷 Camera stream requested")
    
    def generate():
        import cv2
        import time
        
        # Use the camera interface - don't hold device open
        print("📷 Starting camera stream generation...")
        
        while True:
            try:
                frame = None
                
                # Try camera interface
                if camera_initialized and camera and hasattr(camera, 'capture_frame'):
                    frame = camera.capture_frame()
                    if frame is not None:
                        ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                        if ret:
                            frame_bytes = buffer.tobytes()
                            yield (b'--frame\r\n'
                                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                            continue
                
                # Fallback to get_frame method
                elif hasattr(camera, 'get_frame'):
                    success, frame_data = camera.get_frame()
                    if success and frame_data is not None:
                        yield (b'--frame\r\n'
                               b'Content-Type: image/jpeg\r\n\r\n' + frame_data + b'\r\n')
                    else:
                        time.sleep(0.1)
                else:
                    time.sleep(0.5)  # No valid camera method
                    
            except Exception as e:
                print(f"Camera stream error: {e}")
                time.sleep(0.5)
    
    return app.response_class(generate(),
                              mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/services')
def get_services():
    """Get system services status"""
    import subprocess
    
    # Key LAIKA services to monitor
    key_services = [
        'laika-pwa.service',
        'laika-ngrok-unified.service', 
        'ssh.service',
        'systemd-resolved.service',
        'NetworkManager.service',
        'bluetooth.service'
    ]
    
    services = []
    
    for service_name in key_services:
        try:
            # Get service status
            result = subprocess.run(
                ['systemctl', 'status', service_name, '--no-pager', '-n', '0'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            # Parse systemctl output
            status_lines = result.stdout.split('\n')
            active_line = next((line for line in status_lines if 'Active:' in line), '')
            loaded_line = next((line for line in status_lines if 'Loaded:' in line), '')
            
            # Extract status info
            is_active = ('active (running)' in active_line or 
                        'active (start-post)' in active_line or
                        'activating (start-post)' in active_line)
            is_enabled = 'enabled' in loaded_line
            status_text = active_line.split('Active:')[1].strip() if 'Active:' in active_line else 'unknown'
            
            services.append({
                'name': service_name,
                'display_name': service_name.replace('.service', '').replace('-', ' ').title(),
                'status': 'active' if is_active else 'inactive',
                'enabled': is_enabled,
                'status_text': status_text,
                'controllable': service_name in ['laika-pwa.service', 'laika-ngrok-unified.service']
            })
            
        except Exception as e:
            services.append({
                'name': service_name,
                'display_name': service_name.replace('.service', '').replace('-', ' ').title(),
                'status': 'error',
                'enabled': False,
                'status_text': f'Error: {str(e)}',
                'controllable': False
            })
    
    return jsonify({
        'success': True,
        'services': services,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/services/<service_name>/<action>', methods=['POST'])
def control_service(service_name, action):
    """Control a system service (start/stop/restart)"""
    import subprocess
    
    # Only allow control of specific services for security
    allowed_services = ['laika-pwa.service', 'laika-ngrok-unified.service']
    allowed_actions = ['start', 'stop', 'restart', 'enable', 'disable']
    
    if service_name not in allowed_services:
        return jsonify({
            'success': False,
            'error': f'Service {service_name} is not controllable'
        }), 403
    
    if action not in allowed_actions:
        return jsonify({
            'success': False,
            'error': f'Action {action} is not allowed'
        }), 400
    
    try:
        # Execute systemctl command
        cmd = ['sudo', 'systemctl', action, service_name]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            return jsonify({
                'success': True,
                'message': f'Successfully {action}ed {service_name}',
                'service': service_name,
                'action': action
            })
        else:
            return jsonify({
                'success': False,
                'error': f'Failed to {action} {service_name}: {result.stderr}',
                'service': service_name,
                'action': action
            }), 500
            
    except subprocess.TimeoutExpired:
        return jsonify({
            'success': False,
            'error': f'Timeout while trying to {action} {service_name}'
        }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Error controlling service: {str(e)}'
        }), 500

@app.route('/services')
def services_page():
    """Serve the services management page"""
    return send_file('services.html')

@app.route('/webble')
def webble_page():
    """Serve the WebBLE WiFi setup page"""
    return send_file('webble.html')

@app.route('/wifi')
def wifi_page():
    """Serve the WiFi management page"""
    return send_file('wifi.html')

# ================================
# WIFI MANAGEMENT ENDPOINTS
# ================================

# Try to import WiFi API
try:
    from wifi_api import init_wifi_api, register_socketio_handlers as register_wifi_handlers
    WIFI_API_AVAILABLE = True
    wifi_manager = init_wifi_api()
except ImportError:
    print("Warning: WiFi API module not available")
    WIFI_API_AVAILABLE = False
    wifi_manager = None

@app.route('/api/wifi/status')
def wifi_status():
    """Get current WiFi status"""
    if not WIFI_API_AVAILABLE or not wifi_manager:
        return jsonify({"error": "WiFi API not available"}), 503
    
    try:
        status = wifi_manager.get_wifi_status()
        return jsonify(status)
    except Exception as e:
        print(f"Error getting WiFi status: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/wifi/scan')
def wifi_scan():
    """Scan for available WiFi networks"""
    if not WIFI_API_AVAILABLE or not wifi_manager:
        return jsonify({"error": "WiFi API not available"}), 503
    
    try:
        networks = wifi_manager.scan_networks()
        return jsonify({"networks": networks})
    except Exception as e:
        print(f"Error scanning WiFi networks: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/wifi/connect', methods=['POST'])
def wifi_connect():
    """Connect to a WiFi network"""
    if not WIFI_API_AVAILABLE or not wifi_manager:
        return jsonify({"error": "WiFi API not available"}), 503
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data received"}), 400
        
        ssid = data.get('ssid')
        password = data.get('password')
        
        if not ssid:
            return jsonify({"success": False, "message": "SSID is required"}), 400
        
        result = wifi_manager.connect_to_wifi(ssid, password)
        return jsonify(result)
    except Exception as e:
        print(f"Error connecting to WiFi: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/wifi/disconnect', methods=['POST'])
def wifi_disconnect():
    """Disconnect from current WiFi network"""
    if not WIFI_API_AVAILABLE or not wifi_manager:
        return jsonify({"error": "WiFi API not available"}), 503
    
    try:
        result = wifi_manager.disconnect_wifi()
        return jsonify(result)
    except Exception as e:
        print(f"Error disconnecting from WiFi: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/wifi/known')
def wifi_known_networks():
    """Get list of known WiFi networks"""
    if not WIFI_API_AVAILABLE or not wifi_manager:
        return jsonify({"error": "WiFi API not available"}), 503
    
    try:
        networks = wifi_manager.get_known_networks()
        return jsonify({"networks": networks})
    except Exception as e:
        print(f"Error getting known networks: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/wifi/known/<ssid>', methods=['DELETE'])
def wifi_remove_known_network(ssid):
    """Remove a network from known networks"""
    if not WIFI_API_AVAILABLE or not wifi_manager:
        return jsonify({"error": "WiFi API not available"}), 503
    
    try:
        result = wifi_manager.remove_known_network(ssid)
        return jsonify(result)
    except Exception as e:
        print(f"Error removing known network: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# ================================
# CONTROL & GAMEPAD ENDPOINTS
# ================================

# Duplicate control route removed - already defined earlier

@app.route('/gamepad_action', methods=['POST'])
def handle_gamepad_action():
    """Handle gamepad button actions from web interface"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data received'}), 400
        
        action = data.get('action')
        if not action:
            return jsonify({'success': False, 'error': 'No action specified'}), 400
        
        print(f"🎮 Gamepad action received: {action}")
        
        # Broadcast gamepad action to log viewers in real-time
        if SOCKETIO_AVAILABLE and socketio_app:
            gamepad_log = {
                'id': f"gamepad_http_{int(time.time() * 1000000)}",
                'timestamp': datetime.now().isoformat() + 'Z',
                'level': 'info',
                'source': 'gamepad',
                'message': f"🎮 HTTP Gamepad action: {action}",
                'metadata': {
                    'action': action,
                    'interface': 'web_http',
                    'endpoint': '/gamepad_action'
                }
            }
            socketio_app.emit('log_entry', {'log': gamepad_log}, room=None)
        
        # Use the comprehensive web gamepad processor
        try:
            from web_gamepad_processor import process_web_gamepad_action
            result = process_web_gamepad_action(action)
            
            # Log the result
            if SOCKETIO_AVAILABLE and socketio_app:
                result_log = {
                    'id': f"gamepad_http_result_{int(time.time() * 1000000)}",
                    'timestamp': datetime.now().isoformat() + 'Z',
                    'level': 'info' if result.get('success', False) else 'warning',
                    'source': 'gamepad',
                    'message': f"🤖 HTTP Gamepad result: {result.get('laika_action', 'processed')}",
                    'metadata': {
                        'result': result,
                        'success': result.get('success', False)
                    }
                }
                socketio_app.emit('log_entry', {'log': result_log}, room=None)
            
            return jsonify({
                'success': result['success'],
                'action': action,
                'laika_action': result.get('laika_action', action),
                'button_name': result.get('button_name', ''),
                'description': result.get('description', ''),
                'category': result.get('category', ''),
                'message': f'Gamepad action {action} processed successfully',
                'timestamp': datetime.now().isoformat(),
                **result  # Include all processor results
            })
            
        except ImportError as e:
            # Fallback: log the action
            print(f"🤖 Gamepad action (fallback): {action}")
            return jsonify({
                'success': True,
                'action': action,
                'message': f'Action {action} logged (gamepad processor not available)',
                'timestamp': datetime.now().isoformat()
            })
            
    except Exception as e:
        print(f"❌ Error handling gamepad action: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/gamepad_movement', methods=['POST'])
def handle_gamepad_movement():
    """Handle gamepad movement commands from web interface"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No movement data received'}), 400
        
        linear_x = data.get('linear_x', 0.0)
        linear_y = data.get('linear_y', 0.0)
        angular_z = data.get('angular_z', 0.0)
        
        # Only process significant movements to reduce noise
        if abs(linear_x) < 0.05 and abs(linear_y) < 0.05 and abs(angular_z) < 0.05:
            return jsonify({'success': True, 'message': 'Movement below threshold, ignored'})
        
        print(f"🎮 Gamepad movement: linear_x={linear_x:.2f}, linear_y={linear_y:.2f}, angular_z={angular_z:.2f}")
        
        # Broadcast movement to log viewers in real-time (only significant movements)
        if SOCKETIO_AVAILABLE and socketio_app:
            movement_log = {
                'id': f"gamepad_http_movement_{int(time.time() * 1000000)}",
                'timestamp': datetime.now().isoformat() + 'Z',
                'level': 'info',
                'source': 'gamepad',
                'message': f"🎮 HTTP Movement: X={linear_x:.2f}, Y={linear_y:.2f}, Z={angular_z:.2f}",
                'metadata': {
                    'movement': {
                        'linear_x': linear_x,
                        'linear_y': linear_y,
                        'angular_z': angular_z
                    },
                    'interface': 'web_http',
                    'endpoint': '/gamepad_movement'
                }
            }
            socketio_app.emit('log_entry', {'log': movement_log}, room=None)
        
        try:
            # Use the comprehensive web gamepad processor
            from web_gamepad_processor import process_web_gamepad_movement
            result = process_web_gamepad_movement(linear_x, linear_y, angular_z)
            
            return jsonify({
                'success': result['success'],
                'movement': result.get('movement', {
                    'linear_x': linear_x,
                    'linear_y': linear_y,
                    'angular_z': angular_z
                }),
                'modifiers': result.get('modifiers', {}),
                'message': 'Movement command processed by gamepad processor',
                'timestamp': datetime.now().isoformat(),
                **result  # Include all processor results
            })
            
        except ImportError as e:
            # Fallback: just log the movement
            print(f"🤖 Movement command (fallback): x={linear_x:.2f}, y={linear_y:.2f}, z={angular_z:.2f}")
            return jsonify({
                'success': True,
                'movement': {
                    'linear_x': linear_x,
                    'linear_y': linear_y,
                    'angular_z': angular_z
                },
                'message': 'Movement logged (gamepad processor not available)',
                'timestamp': datetime.now().isoformat()
            })
            
    except Exception as e:
        print(f"❌ Error handling gamepad movement: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Helper functions for LLM functionality
def get_current_llm_prompt():
    """Get the current system prompt for LAIKA"""
    return get_current_system_prompt()

def get_current_system_prompt():
    """Get the current system prompt"""
    default_prompt = """You are LAIKA, a friendly robotic dog assistant. You can execute various actions like:
- sit, stand, lie, stop
- wave, dance, bow, hello
- move forward, backward, left, right
- wag tail, bark, play

When given commands, respond enthusiastically and indicate what action you will perform. 
Keep responses brief and dog-like with emojis. Always be helpful and friendly!"""
    
    try:
        # Try to load from config file
        config_path = '/home/pi/LAIKA/config/llm_prompt.txt'
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return f.read().strip()
    except Exception as e:
        print(f"Warning: Could not load custom prompt: {e}")
    
    return default_prompt

def determine_action_from_button(button_name):
    """Map button names to robot actions"""
    button_action_map = {
        'sit': 'sit',
        'stand': 'stand', 
        'lie': 'lie',
        'stop': 'stop',
        'wave': 'wave',
        'dance': 'dance',
        'bow': 'bow',
        'hello': 'wave',
        'forward': 'forward',
        'backward': 'backward',
        'left': 'left',
        'right': 'right'
    }
    return button_action_map.get(button_name.lower(), None)

def determine_action_from_text(text):
    """Extract action from text input"""
    text_lower = text.lower()
    
    # Simple keyword matching
    if any(word in text_lower for word in ['sit', 'down']):
        return 'sit'
    elif any(word in text_lower for word in ['stand', 'up', 'get up']):
        return 'stand'
    elif any(word in text_lower for word in ['lie', 'lay']):
        return 'lie'
    elif any(word in text_lower for word in ['wave', 'hello', 'hi']):
        return 'wave'
    elif any(word in text_lower for word in ['dance']):
        return 'dance'
    elif any(word in text_lower for word in ['bow']):
        return 'bow'
    elif any(word in text_lower for word in ['stop', 'halt']):
        return 'stop'
    elif any(word in text_lower for word in ['forward', 'ahead']):
        return 'forward'
    elif any(word in text_lower for word in ['backward', 'back']):
        return 'backward'
    elif any(word in text_lower for word in ['left', 'turn left']):
        return 'left'
    elif any(word in text_lower for word in ['right', 'turn right']):
        return 'right'
    
    return None

def calculate_openai_cost(model, input_tokens, output_tokens):
    """Calculate estimated cost for OpenAI API usage"""
    # Pricing per 1K tokens (approximate)
    pricing = {
        'gpt-4': {'input': 0.03, 'output': 0.06},
        'gpt-4o': {'input': 0.005, 'output': 0.015},
        'gpt-4o-mini': {'input': 0.00015, 'output': 0.0006},
        'gpt-3.5-turbo': {'input': 0.001, 'output': 0.002}
    }
    
    if model not in pricing:
        model = 'gpt-4o-mini'  # Default fallback
    
    input_cost = (input_tokens / 1000) * pricing[model]['input']
    output_cost = (output_tokens / 1000) * pricing[model]['output']
    
    return input_cost + output_cost

def get_llm_config():
    """Get LLM configuration settings"""
    default_config = {
        'model': 'gpt-4o-mini',
        'track_usage': True,
        'max_tokens': 500,
        'temperature': 0.7
    }
    
    try:
        config_path = '/home/pi/LAIKA/config/llm_config.json'
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = json.load(f)
                return {**default_config, **config}
    except Exception as e:
        print(f"Warning: Could not load LLM config: {e}")
    
    return default_config

def update_llm_usage_stats(tokens, cost):
    """Update usage statistics"""
    try:
        stats_path = '/home/pi/LAIKA/config/llm_usage_stats.json'
        
        # Load existing stats or create new
        if os.path.exists(stats_path):
            with open(stats_path, 'r') as f:
                stats = json.load(f)
        else:
            stats = {'total_tokens': 0, 'total_cost': 0.0, 'requests': 0}
        
        # Update stats
        stats['total_tokens'] += tokens
        stats['total_cost'] += cost
        stats['requests'] += 1
        stats['last_updated'] = datetime.now().isoformat()
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(stats_path), exist_ok=True)
        
        # Save updated stats
        with open(stats_path, 'w') as f:
            json.dump(stats, f, indent=2)
            
    except Exception as e:
        print(f"Warning: Could not update usage stats: {e}")

def try_execute_robot_action(text_or_action):
    """Try to execute robot action from text or direct action"""
    if not text_or_action:
        return False
    
    # If it's already an action, execute directly
    if text_or_action.lower() in ['sit', 'stand', 'lie', 'stop', 'wave', 'dance', 'bow', 'forward', 'backward', 'left', 'right']:
        return execute_robot_action_direct(text_or_action.lower())
    
    # Try to extract action from text
    action = determine_action_from_text(text_or_action)
    if action:
        return execute_robot_action_direct(action)
    
    return False

def get_laika_system_prompt():
    """Alias for get_current_system_prompt for backward compatibility"""
    return get_current_system_prompt()

# Main LLM endpoints
@app.route('/llm', methods=['POST'])
def handle_llm_request():
    """Handle custom LLM text input"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data received'
            }), 400
        
        input_text = data.get('input', '').strip()
        if not input_text:
            return jsonify({
                'success': False,
                'error': 'No input text provided'
            }), 400
        
        model = data.get('model', 'gpt-4o-mini')
        execute_actions = data.get('execute_actions', True)
        source = data.get('source', 'web_llm')
        
        print(f"🤖 LLM request: {input_text[:50]}..." if len(input_text) > 50 else f"🤖 LLM request: {input_text}")
        
        # Add to history
        add_to_llm_history(data)
        
        # Process with OpenAI if available
        if OPENAI_AVAILABLE and openai_client:
            try:
                # Get system prompt
                system_prompt = get_current_system_prompt()
                
                # Get current context and sensors data
                context_data = None
                sensors_data = None
                
                if context_camera:
                    try:
                        # Capture fresh context if this is a visual query
                        if any(word in input_text.lower() for word in ['look', 'see', 'what', 'photo', 'picture', 'camera']):
                            context_camera.capture_context_now()
                        context_data = context_camera.get_context_data()
                    except Exception as e:
                        print(f"⚠️  Context capture error: {e}")
                
                if sensor_telemetry:
                    try:
                        sensors_data = sensor_telemetry.get_current_telemetry()
                    except Exception as e:
                        print(f"⚠️  Sensors error: {e}")
                
                # Enhance user input with context
                enhanced_input = input_text
                if sensors_data:
                    enhanced_input += f"\n\nCurrent sensor context: {json.dumps(sensors_data, indent=2)}"
                
                # Check if this is a visual query
                is_visual_query = any(word in input_text.lower() for word in ['look', 'see', 'what', 'photo', 'picture', 'camera', 'image'])
                
                messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": enhanced_input}
                ]
                
                # Add visual context if available and needed
                if is_visual_query and context_data and context_camera:
                    try:
                        context_image_path = context_camera.get_context_image_path()
                        if context_image_path and os.path.exists(context_image_path):
                            # Encode image for OpenAI Vision API
                            base64_image = context_camera.encode_context_image()
                            if base64_image:
                                # Use vision model for visual queries
                                messages[1]["content"] = [
                                    {"type": "text", "text": enhanced_input + "\n\nI'm looking at this image from my camera:"},
                                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                                ]
                                model = "gpt-4o"  # Use vision model
                                print("📷 Added camera context to LLM query")
                    except Exception as e:
                        print(f"⚠️  Visual context error: {e}")
                
                response = openai_client.chat.completions.create(
                    model=model,
                    messages=messages,
                    max_tokens=500,
                    temperature=0.7
                )
                
                llm_response = response.choices[0].message.content
                tokens_used = response.usage.total_tokens
                
                # Calculate cost
                estimated_cost = calculate_openai_cost(model, response.usage.prompt_tokens, response.usage.completion_tokens)
                
                # Try to execute robot actions if requested
                action_executed = False
                if execute_actions:
                    action_executed = try_execute_robot_action(llm_response)
                
                response_data = {
                    'success': True,
                    'response': llm_response,
                    'tokens_used': tokens_used,
                    'estimated_cost': f"{estimated_cost:.6f}",
                    'model_used': model,
                    'action_executed': action_executed,
                    'context_used': context_data is not None,
                    'sensors_used': sensors_data is not None,
                    'visual_query': is_visual_query,
                    'message': 'LLM request processed successfully'
                }
                
                # Update history with response
                add_to_llm_history(data, response_data)
                
                return jsonify(response_data)
                
            except Exception as e:
                print(f"❌ OpenAI error: {e}")
                error_response = {
                    'success': False,
                    'error': f'OpenAI error: {str(e)}',
                    'response': 'Sorry, I encountered an error processing your request.'
                }
                add_to_llm_history(data, error_response)
                return jsonify(error_response), 500
        else:
            # Fallback response when OpenAI is not available
            fallback_response = {
                'success': False,
                'error': 'LLM service not available',
                'response': 'LLM service is not configured or available. Please check your OpenAI API key.'
            }
            add_to_llm_history(data, fallback_response)
            return jsonify(fallback_response), 503
            
    except Exception as e:
        print(f"❌ Error handling LLM request: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/llm/<action>', methods=['POST'])
def handle_llm_action(action):
    """Handle quick LLM action commands"""
    try:
        print(f"🤖 LLM action: {action}")
        
        # Process with OpenAI if available
        if OPENAI_AVAILABLE and openai_client:
            try:
                system_prompt = get_current_system_prompt()
                
                response = openai_client.chat.completions.create(
                    model='gpt-4o-mini',  # Use fast model for quick actions
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Execute action: {action}"}
                    ],
                    max_tokens=200,
                    temperature=0.3
                )
                
                llm_response = response.choices[0].message.content
                
                # Try to execute robot action
                action_executed = try_execute_robot_action(action)  # Try the action directly first
                
                return jsonify({
                    'success': True,
                    'action': action,
                    'response': llm_response,
                    'action_executed': action_executed,
                    'message': f'Action {action} processed successfully'
                })
                
            except Exception as e:
                print(f"❌ OpenAI error for action {action}: {e}")
                return jsonify({
                    'success': False,
                    'error': f'OpenAI error: {str(e)}',
                    'action': action
                }), 500
        else:
            # Fallback: try to execute action directly
            action_executed = try_execute_robot_action(action)
            
            return jsonify({
                'success': action_executed,
                'action': action,
                'response': f'Action {action} {"executed" if action_executed else "failed"}',
                'action_executed': action_executed,
                'message': f'Direct action {action} {"executed" if action_executed else "failed"}'
            })
            
    except Exception as e:
        print(f"❌ Error handling LLM action {action}: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'action': action
        }), 500

@app.route('/llm/sit', methods=['POST', 'GET'])
def handle_llm_sit():
    """Direct LLM endpoint for sit command"""
    try:
        print("🐕 LLM Sit command received")
        
        # Execute the sit command directly
        result = execute_robot_action_direct('sit')
        
        return jsonify({
            'success': result,
            'action': 'sit',
            'message': '✅ Sit command executed successfully!' if result else '❌ Sit command failed',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Error handling LLM sit: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Removed duplicate route - functionality merged into the main handle_llm_action below

def execute_robot_action_direct(action):
    """Execute robot action directly using laika_do.py"""
    import subprocess
    try:
        result = subprocess.run([
            'python3', '/home/pi/LAIKA/laika_do.py', action
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode == 0:
            print(f"✅ Robot action '{action}' executed successfully")
            return True
        else:
            print(f"❌ Robot action '{action}' failed: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"⏰ Robot action '{action}' timed out")
        return False
    except Exception as e:
        print(f"❌ Error executing robot action '{action}': {e}")
        return False

def execute_llm_action(action):
    """Execute action determined by LLM"""
    return execute_robot_action_direct(action)

# LLM History storage
llm_history = []

def add_to_llm_history(input_data, response_data=None):
    """Add entry to LLM history"""
    global llm_history
    
    entry = {
        'id': f"{time.time()}_{len(llm_history)}",
        'timestamp': datetime.now().isoformat(),
        'input': input_data.get('input', ''),
        'source': input_data.get('source', 'unknown'),
        'type': input_data.get('type', 'unknown'),
        'status': 'pending'
    }
    
    if response_data:
        entry.update({
            'response': response_data.get('response', ''),
            'status': 'success' if response_data.get('success') else 'error',
            'action_executed': response_data.get('action_executed'),
            'tokens_used': response_data.get('tokens_used'),
            'estimated_cost': response_data.get('estimated_cost')
        })
    
    llm_history.append(entry)
    
    # Keep only last 200 entries
    if len(llm_history) > 200:
        llm_history = llm_history[-200:]
    
    # Broadcast to connected clients if SocketIO is available
    if SOCKETIO_AVAILABLE and socketio_app:
        try:
            socketio_app.emit('llm_history_update', {'data': entry})
        except Exception as e:
            print(f"❌ Failed to broadcast LLM history: {e}")
    
    return entry['id']

@app.route('/api/llm/prompt', methods=['GET', 'POST'])
def api_llm_prompt():
    """Get or set the LLM system prompt"""
    if request.method == 'GET':
        try:
            current_prompt = get_laika_system_prompt()
            return jsonify({
                'success': True,
                'prompt': current_prompt
            })
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            new_prompt = data.get('prompt', '')
            
            if not new_prompt:
                return jsonify({'success': False, 'error': 'Prompt is required'}), 400
            
            # Save the prompt to config file
            try:
                config_path = '/home/pi/LAIKA/config/llm_prompt.txt'
                os.makedirs(os.path.dirname(config_path), exist_ok=True)
                
                with open(config_path, 'w') as f:
                    f.write(new_prompt)
                
                return jsonify({
                    'success': True,
                    'message': 'Prompt updated successfully',
                    'prompt': new_prompt
                })
            except Exception as save_error:
                print(f"Warning: Could not save prompt: {save_error}")
                return jsonify({
                    'success': True,
                    'message': 'Prompt updated successfully (in memory only)',
                    'prompt': new_prompt
                })
            
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/llm/prompt/reset', methods=['POST'])
def api_reset_llm_prompt():
    """Reset LLM prompt to default"""
    try:
        # Get the default prompt (without loading from file)
        default_prompt = """You are LAIKA, a friendly robotic dog assistant. You can execute various actions like:
- sit, stand, lie, stop
- wave, dance, bow, hello
- move forward, backward, left, right
- wag tail, bark, play

When given commands, respond enthusiastically and indicate what action you will perform. 
Keep responses brief and dog-like with emojis. Always be helpful and friendly!"""
        
        # Remove the custom prompt file so it falls back to default
        config_path = '/home/pi/LAIKA/config/llm_prompt.txt'
        if os.path.exists(config_path):
            os.remove(config_path)
        
        return jsonify({
            'success': True,
            'prompt': default_prompt,
            'message': 'Prompt reset to default'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/llm/history', methods=['GET'])
def api_get_llm_history():
    """Get LLM history"""
    try:
        limit = request.args.get('limit', 50, type=int)
        return jsonify({
            'success': True,
            'history': llm_history[-limit:] if limit > 0 else llm_history,
            'total': len(llm_history)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Context and Sensors API endpoints
@app.route('/api/llm/context/image')
def get_context_image():
    """Get current context image"""
    try:
        context_image_path = '/home/pi/LAIKA/captured_images/context.jpg'
        
        if os.path.exists(context_image_path):
            return send_file(context_image_path, mimetype='image/jpeg')
        else:
            return jsonify({
                'success': False,
                'error': 'Context image not found'
            }), 404
            
    except Exception as e:
        print(f"❌ Error getting context image: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/llm/context/capture', methods=['POST'])
def capture_context():
    """Capture new context image"""
    try:
        if context_camera:
            success = context_camera.capture_context_now()
            if success:
                context_data = context_camera.get_context_data()
                return jsonify({
                    'success': True,
                    'data': context_data,
                    'message': 'Context captured successfully'
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to capture context'
                }), 500
        else:
            return jsonify({
                'success': False,
                'error': 'Context camera system not available'
            }), 503
            
    except Exception as e:
        print(f"❌ Error capturing context: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/llm/context/refresh', methods=['POST'])
def refresh_context():
    """Refresh context data"""
    try:
        if context_camera:
            # Force a new capture
            success = context_camera.capture_context_now()
            context_data = context_camera.get_context_data()
            
            return jsonify({
                'success': True,
                'data': context_data,
                'message': 'Context refreshed successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Context camera system not available'
            }), 503
            
    except Exception as e:
        print(f"❌ Error refreshing context: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/llm/sensors')
def get_sensors_data():
    """Get current sensors data"""
    try:
        if sensor_telemetry:
            telemetry_data = sensor_telemetry.get_current_telemetry()
            return jsonify(telemetry_data)
        else:
            return jsonify({
                'success': False,
                'error': 'Sensor telemetry system not available'
            }), 503
            
    except Exception as e:
        print(f"❌ Error getting sensors data: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/llm/sensors/refresh', methods=['POST'])
def refresh_sensors():
    """Refresh sensors data"""
    try:
        if sensor_telemetry:
            sensor_telemetry.force_refresh()
            telemetry_data = sensor_telemetry.get_current_telemetry()
            
            return jsonify({
                'success': True,
                'data': telemetry_data,
                'message': 'Sensors refreshed successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Sensor telemetry system not available'
            }), 503
            
    except Exception as e:
        print(f"❌ Error refreshing sensors: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def determine_action_from_button(button_input):
    """Simple button to action mapping - LLM can learn and override these"""
    button_actions = {
        'a': 'hello',
        'b': 'dance', 
        'x': 'sit',
        'y': 'take_photo',
        'start': 'emergency_stop',
        'select': 'sleep',
        'dpad-up': 'head_up',
        'dpad-down': 'head_down',
        'dpad-left': 'head_left',
        'dpad-right': 'head_right',
        'l1': 'speed_boost',
        'r1': 'precision_mode',
        'l2': 'crouch',
        'r2': 'stretch'
    }
    
    return button_actions.get(button_input.lower(), None)

def determine_action_from_text(text_input):
    """Determine action from text input (STT, chat, etc.)"""
    text_lower = text_input.lower()
    
    # Simple keyword matching - LLM can make this much smarter
    if any(word in text_lower for word in ['sit', 'sit down']):
        return 'sit'
    elif any(word in text_lower for word in ['dance', 'dancing']):
        return 'dance'
    elif any(word in text_lower for word in ['hello', 'hi', 'wave']):
        return 'hello'
    elif any(word in text_lower for word in ['photo', 'picture', 'camera']):
        return 'take_photo'
    elif any(word in text_lower for word in ['sleep', 'rest']):
        return 'sleep'
    elif any(word in text_lower for word in ['stop', 'emergency']):
        return 'emergency_stop'
    elif any(word in text_lower for word in ['head up', 'look up']):
        return 'head_up'
    elif any(word in text_lower for word in ['head down', 'look down']):
        return 'head_down'
    
    return None

def execute_llm_action(action):
    """Execute the action determined by LLM"""
    try:
        # This should integrate with your existing robot action system
        from web_gamepad_processor import process_web_gamepad_action
        result = process_web_gamepad_action(action)
        print(f"🤖 Executed action: {action} - Result: {result}")
        return result
    except ImportError:
        print(f"🤖 Would execute action: {action} (processor not available)")
        return {'success': True, 'action': action, 'message': 'Simulated execution'}

@app.route('/llm/prompt', methods=['GET', 'POST'])
def handle_llm_prompt():
    """Get or set the LLM system prompt for LAIKA"""
    try:
        if request.method == 'GET':
            # Return current system prompt
            current_prompt = get_current_llm_prompt()
            return jsonify({
                'success': True,
                'prompt': current_prompt,
                'prompt_length': len(current_prompt),
                'last_updated': get_prompt_last_updated(),
                'timestamp': datetime.now().isoformat()
            })
        
        elif request.method == 'POST':
            # Update system prompt
            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'error': 'No data received'}), 400
            
            new_prompt = data.get('prompt', '')
            if not new_prompt.strip():
                return jsonify({'success': False, 'error': 'Empty prompt not allowed'}), 400
            
            # Save the new prompt
            save_result = save_llm_prompt(new_prompt)
            
            if save_result['success']:
                print(f"🧠 LLM prompt updated ({len(new_prompt)} characters)")
                return jsonify({
                    'success': True,
                    'message': 'Prompt updated successfully',
                    'prompt_length': len(new_prompt),
                    'timestamp': datetime.now().isoformat()
                })
            else:
                return jsonify({
                    'success': False,
                    'error': save_result.get('error', 'Failed to save prompt')
                }), 500
                
    except Exception as e:
        print(f"❌ Error handling LLM prompt: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def get_current_llm_prompt():
    """Get the current LLM system prompt"""
    try:
        # Try to read from file first
        prompt_file = 'llm_system_prompt.txt'
        if os.path.exists(prompt_file):
            with open(prompt_file, 'r', encoding='utf-8') as f:
                return f.read().strip()
    except Exception as e:
        print(f"⚠️ Error reading prompt file: {e}")
    
    # Default system prompt for LAIKA gamepad control
    return """You are LAIKA, a friendly robotic dog with personality and emotions. You can learn and remember things.

When you receive gamepad input:
- Button presses like "x", "a", "start" etc. should trigger robot actions
- You can learn new button mappings when users teach you
- Movement inputs control how you move around
- Be expressive and dog-like in your responses

Current button mappings you know:
- A button: hello/greeting gesture
- B button: dance routine  
- X button: sit down
- Y button: take photo
- Start: emergency stop
- Select: go to sleep
- D-pad: head movements (up/down/left/right)
- L1/R1: speed control
- L2/R2: posture changes

You can learn new mappings when users say things like:
"X button should make you sit" or "When I press Y, do a backflip"

Always respond with personality and explain what you're doing. Be a good dog! 🐕"""

def get_prompt_last_updated():
    """Get when the prompt was last updated"""
    try:
        prompt_file = 'llm_system_prompt.txt'
        if os.path.exists(prompt_file):
            import os
            return datetime.fromtimestamp(os.path.getmtime(prompt_file)).isoformat()
    except Exception:
        pass
    return "Never"

def save_llm_prompt(prompt):
    """Save the LLM system prompt to file"""
    try:
        prompt_file = 'llm_system_prompt.txt'
        with open(prompt_file, 'w', encoding='utf-8') as f:
            f.write(prompt)
        
        # Also create a backup with timestamp
        backup_file = f'llm_prompts/backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt'
        os.makedirs('llm_prompts', exist_ok=True)
        with open(backup_file, 'w', encoding='utf-8') as f:
            f.write(prompt)
        
        return {'success': True}
    except Exception as e:
        print(f"❌ Error saving prompt: {e}")
        return {'success': False, 'error': str(e)}

@app.route('/llm/config', methods=['GET', 'POST'])
def handle_llm_config():
    """Get or set LLM configuration (API keys, settings, etc.)"""
    try:
        if request.method == 'GET':
            # Return current LLM configuration (without exposing full API key)
            config = get_llm_config()
            
            # Mask API key for security
            if 'openai_api_key' in config and config['openai_api_key']:
                config['openai_api_key_masked'] = config['openai_api_key'][:8] + '...' + config['openai_api_key'][-4:]
                del config['openai_api_key']  # Don't send full key to frontend
            
            return jsonify({
                'success': True,
                'config': config,
                'timestamp': datetime.now().isoformat()
            })
        
        elif request.method == 'POST':
            # Update LLM configuration
            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'error': 'No data received'}), 400
            
            # Save configuration
            save_result = save_llm_config(data)
            
            if save_result['success']:
                print(f"🧠 LLM configuration updated")
                return jsonify({
                    'success': True,
                    'message': 'Configuration updated successfully',
                    'timestamp': datetime.now().isoformat()
                })
            else:
                return jsonify({
                    'success': False,
                    'error': save_result.get('error', 'Failed to save configuration')
                }), 500
                
    except Exception as e:
        print(f"❌ Error handling LLM config: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/llm/stats', methods=['GET'])
def get_llm_stats():
    """Get LLM usage statistics"""
    try:
        stats = get_llm_usage_stats()
        return jsonify({
            'success': True,
            'stats': stats,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        print(f"❌ Error getting LLM stats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def get_llm_config():
    """Get current LLM configuration"""
    try:
        config_file = 'llm_config.json'
        if os.path.exists(config_file):
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"⚠️ Error reading LLM config: {e}")
    
    # Default configuration
    return {
        'openai_api_key': '',
        'model': 'gpt-4',
        'max_tokens': 150,
        'temperature': 0.7,
        'track_usage': True,
        'cost_limit_daily': 10.0,  # USD
        'cost_limit_monthly': 100.0  # USD
    }

def save_llm_config(config):
    """Save LLM configuration"""
    try:
        config_file = 'llm_config.json'
        
        # Merge with existing config
        existing_config = get_llm_config()
        existing_config.update(config)
        
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(existing_config, f, indent=2)
        
        return {'success': True}
    except Exception as e:
        print(f"❌ Error saving LLM config: {e}")
        return {'success': False, 'error': str(e)}

def get_llm_usage_stats():
    """Get LLM usage statistics with token tracking and cost"""
    try:
        stats_file = 'llm_usage_stats.json'
        if os.path.exists(stats_file):
            with open(stats_file, 'r', encoding='utf-8') as f:
                stats = json.load(f)
        else:
            stats = {
                'total_requests': 0,
                'total_tokens': 0,
                'total_cost': 0.0,
                'daily_stats': {},
                'monthly_stats': {},
                'last_reset': datetime.now().isoformat()
            }
        
        # Add current period stats
        today = datetime.now().strftime('%Y-%m-%d')
        this_month = datetime.now().strftime('%Y-%m')
        
        daily_stats = stats['daily_stats'].get(today, {
            'requests': 0, 'tokens': 0, 'cost': 0.0
        })
        
        monthly_stats = stats['monthly_stats'].get(this_month, {
            'requests': 0, 'tokens': 0, 'cost': 0.0
        })
        
        return {
            'total_requests': stats['total_requests'],
            'total_tokens': stats['total_tokens'],
            'total_cost': round(stats['total_cost'], 4),
            'today': daily_stats,
            'this_month': monthly_stats,
            'last_reset': stats['last_reset']
        }
        
    except Exception as e:
        print(f"⚠️ Error reading LLM stats: {e}")
        return {
            'total_requests': 0,
            'total_tokens': 0,
            'total_cost': 0.0,
            'today': {'requests': 0, 'tokens': 0, 'cost': 0.0},
            'this_month': {'requests': 0, 'tokens': 0, 'cost': 0.0},
            'last_reset': datetime.now().isoformat()
        }

def update_llm_usage_stats(tokens_used, cost):
    """Update LLM usage statistics"""
    try:
        stats = get_llm_usage_stats()
        today = datetime.now().strftime('%Y-%m-%d')
        this_month = datetime.now().strftime('%Y-%m')
        
        # Update totals
        stats['total_requests'] += 1
        stats['total_tokens'] += tokens_used
        stats['total_cost'] += cost
        
        # Update daily stats
        if 'daily_stats' not in stats:
            stats['daily_stats'] = {}
        if today not in stats['daily_stats']:
            stats['daily_stats'][today] = {'requests': 0, 'tokens': 0, 'cost': 0.0}
        
        stats['daily_stats'][today]['requests'] += 1
        stats['daily_stats'][today]['tokens'] += tokens_used
        stats['daily_stats'][today]['cost'] += cost
        
        # Update monthly stats
        if 'monthly_stats' not in stats:
            stats['monthly_stats'] = {}
        if this_month not in stats['monthly_stats']:
            stats['monthly_stats'][this_month] = {'requests': 0, 'tokens': 0, 'cost': 0.0}
        
        stats['monthly_stats'][this_month]['requests'] += 1
        stats['monthly_stats'][this_month]['tokens'] += tokens_used
        stats['monthly_stats'][this_month]['cost'] += cost
        
        # Save updated stats
        stats_file = 'llm_usage_stats.json'
        with open(stats_file, 'w', encoding='utf-8') as f:
            json.dump(stats, f, indent=2)
        
        print(f"📊 LLM Usage: +{tokens_used} tokens, +${cost:.4f} cost")
        
    except Exception as e:
        print(f"❌ Error updating LLM stats: {e}")

def calculate_openai_cost(model, input_tokens, output_tokens):
    """Calculate OpenAI API cost based on current pricing"""
    # OpenAI pricing (as of 2024) - update these as needed
    pricing = {
        'gpt-4': {'input': 0.03 / 1000, 'output': 0.06 / 1000},  # per 1K tokens
        'gpt-4-turbo': {'input': 0.01 / 1000, 'output': 0.03 / 1000},
        'gpt-3.5-turbo': {'input': 0.0015 / 1000, 'output': 0.002 / 1000},
        'gpt-3.5-turbo-16k': {'input': 0.003 / 1000, 'output': 0.004 / 1000}
    }
    
    if model not in pricing:
        model = 'gpt-4'  # Default fallback
    
    input_cost = input_tokens * pricing[model]['input']
    output_cost = output_tokens * pricing[model]['output']
    
    return input_cost + output_cost

def create_gamepad_llm_prompt(gamepad_input):
    """Create an LLM prompt for gamepad input interpretation"""
    
    if gamepad_input['type'] == 'button_press':
        button = gamepad_input['button']
        context = gamepad_input.get('context', {})
        
        prompt = f"""
You are LAIKA, a robotic dog. A user just pressed the '{button}' button on their gamepad.

Current context:
- Button pressed: {button}
- Active buttons: {context.get('activeButtons', [])}
- Left stick position: {context.get('leftStick', {})}
- Right stick position: {context.get('rightStick', {})}
- Source: {gamepad_input.get('source', 'unknown')}

Based on this input, decide what action LAIKA should take. You can:
1. Perform a specific robot action (like sit, dance, hello, etc.)
2. Learn a new button mapping if the user teaches you
3. Ask for clarification if unsure
4. Respond with personality and emotion

Remember previous button mappings you've learned. Be expressive and dog-like in your responses.

Respond in JSON format:
{{
    "response": "Your conversational response as LAIKA",
    "actions": [
        {{
            "type": "robot_command",
            "command": "action_name",
            "parameters": {{}}
        }}
    ],
    "learned_mapping": null or {{"button": "button_name", "action": "action_name"}}
}}
"""

    elif gamepad_input['type'] == 'movement_input':
        movement = gamepad_input['movement']
        intent = movement.get('intent', [])
        
        prompt = f"""
You are LAIKA, a robotic dog. The user is moving the gamepad sticks for movement control.

Movement input:
- Left stick: {movement.get('leftStick', {})}
- Right stick: {movement.get('rightStick', {})}
- Movement intent: {intent}
- Source: {gamepad_input.get('source', 'unknown')}

Interpret this movement and decide how LAIKA should move. You can:
1. Execute the movement directly
2. Modify the movement based on context (e.g., slower if cautious)
3. Add personality to the movement (e.g., playful bouncing)
4. Refuse movement if it seems unsafe

Respond in JSON format:
{{
    "response": "Your conversational response about the movement",
    "actions": [
        {{
            "type": "movement",
            "movement": {{
                "linear_x": 0.0,
                "linear_y": 0.0,
                "angular_z": 0.0
            }}
        }}
    ]
}}
"""

    return prompt

def process_gamepad_with_llm(prompt, gamepad_input):
    """Process gamepad input through LLM - integrate with your existing LLM system"""
    
    # TODO: Replace this with actual LLM integration
    # This should connect to your existing LAIKA LLM system
    
    # For now, provide intelligent fallback responses
    if gamepad_input['type'] == 'button_press':
        button = gamepad_input['button']
        
        # Simple learning mapping
        button_actions = {
            'a': 'hello',
            'b': 'dance', 
            'x': 'sit',
            'y': 'take_photo',
            'start': 'emergency_stop',
            'select': 'sleep',
            'dpad-up': 'head_up',
            'dpad-down': 'head_down',
            'l1': 'speed_boost',
            'r1': 'precision_mode'
        }
        
        action = button_actions.get(button, 'unknown')
        
        return {
            'response': f"Woof! You pressed {button}! I'll {action} for you! 🐕",
            'actions': [
                {
                    'type': 'robot_command',
                    'command': action,
                    'parameters': {}
                }
            ] if action != 'unknown' else [],
            'learned_mapping': {'button': button, 'action': action} if action != 'unknown' else None
        }
    
    elif gamepad_input['type'] == 'movement_input':
        movement = gamepad_input['movement']
        left_stick = movement.get('leftStick', {})
        right_stick = movement.get('rightStick', {})
        
        return {
            'response': f"Moving around! Left stick: {left_stick}, Right stick: {right_stick}",
            'actions': [
                {
                    'type': 'movement',
                    'movement': {
                        'linear_x': -left_stick.get('y', 0) * 0.3,
                        'linear_y': left_stick.get('x', 0) * 0.2,
                        'angular_z': right_stick.get('x', 0) * 0.5
                    }
                }
            ]
        }
    
    return {'response': 'Woof! I received your input!', 'actions': []}

def create_fallback_gamepad_response(gamepad_input):
    """Create fallback response when LLM is not available"""
    
    if gamepad_input['type'] == 'button_press':
        button = gamepad_input['button']
        return {
            'response': f"Button {button} pressed - using fallback mode",
            'actions': [
                {
                    'type': 'robot_command',
                    'command': 'hello',  # Safe fallback action
                    'parameters': {}
                }
            ]
        }
    
    return {
        'response': 'Fallback mode active',
        'actions': []
    }

@app.route('/api/gamepad/status', methods=['GET'])
def get_gamepad_status():
    """Get gamepad connection and processing status"""
    try:
        # Check if enhanced gamepad handler is available
        gamepad_available = False
        motion_available = False
        
        try:
            from enhanced_gamepad_handler import EnhancedGamepadHandler
            gamepad_available = True
        except ImportError:
            pass
            
        try:
            from gamepad_motion_controller import GamepadMotionController
            motion_available = True
        except ImportError:
            pass
        
        return jsonify({
            'success': True,
            'gamepad_handler_available': gamepad_available,
            'motion_controller_available': motion_available,
            'endpoints_active': True,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/gamepad/broadcast', methods=['POST'])
def broadcast_gamepad_event():
    """Broadcast gamepad events to connected WebSocket clients"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data received'}), 400
        
        event_type = data.get('event_type')
        event_data = data.get('data', {})
        
        if not event_type:
            return jsonify({'success': False, 'error': 'No event type specified'}), 400
        
        # Broadcast to all connected SocketIO clients
        if SOCKETIO_AVAILABLE and socketio_app:
            if event_type == 'button_press':
                socketio_app.emit('gamepad_button_press', event_data, room=None)
            elif event_type == 'button_release':
                socketio_app.emit('gamepad_button_release', event_data, room=None)
            
            # Also create a log entry for the gamepad event
            gamepad_log = {
                'id': f"physical_gamepad_{int(time.time() * 1000000)}",
                'timestamp': datetime.now().isoformat() + 'Z',
                'level': 'info',
                'source': 'gamepad',
                'message': f"🎮 Physical gamepad: {event_data.get('button_name', 'Unknown')} {'pressed' if event_type == 'button_press' else 'released'}",
                'metadata': {
                    'button_index': event_data.get('button_index'),
                    'button_name': event_data.get('button_name'),
                    'event_type': event_type,
                    'interface': 'physical_gamepad'
                }
            }
            socketio_app.emit('log_entry', {'log': gamepad_log}, room=None)
        
        return jsonify({
            'success': True,
            'event_type': event_type,
            'broadcasted': True,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Error broadcasting gamepad event: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ================================
# WEBSOCKET ENDPOINTS FOR REAL-TIME CONTROL
# ================================

if SOCKETIO_AVAILABLE and socketio_app:
    
    @socketio_app.on('connect')
    def handle_connect():
        print(f"🔗 Client connected: {request.sid}")
        emit('connection_response', {'status': 'connected', 'message': 'Welcome to LAIKA!'})
    
    @socketio_app.on('disconnect')
    def handle_disconnect():
        print(f"📡 Client disconnected: {request.sid}")
    
    @socketio_app.on('control_connected')
    def handle_control_connected(data):
        print(f"🎮 Control interface connected: {data}")
        emit('control_response', {'status': 'acknowledged', 'timestamp': datetime.now().isoformat()})
    
    @socketio_app.on('gamepad_action')
    def handle_gamepad_action(data):
        print(f"🎮 Gamepad action: {data}")
        
        # Create log entry for gamepad action
        gamepad_log = {
            'id': f"gamepad_action_{int(time.time() * 1000000)}",
            'timestamp': datetime.now().isoformat() + 'Z',
            'level': 'info',
            'source': 'gamepad',
            'message': f"🎮 Gamepad action: {data.get('action', data.get('button', 'unknown'))}",
            'metadata': {
                'action_data': data,
                'client_id': request.sid,
                'interface': 'web_socketio'
            }
        }
        
        # Broadcast log entry to all log viewers in real-time
        socketio_app.emit('log_entry', {'log': gamepad_log}, room=None)
        
        try:
            # Process gamepad action using existing gamepad processor
            if 'web_gamepad_processor' in globals():
                result = web_gamepad_processor.process_gamepad_data(data)
                
                # Log the result
                result_log = {
                    'id': f"gamepad_result_{int(time.time() * 1000000)}",
                    'timestamp': datetime.now().isoformat() + 'Z',
                    'level': 'info' if result.get('success', False) else 'warning',
                    'source': 'gamepad',
                    'message': f"🤖 Gamepad action result: {result.get('laika_action', 'processed')}",
                    'metadata': {
                        'result': result,
                        'success': result.get('success', False)
                    }
                }
                socketio_app.emit('log_entry', {'log': result_log}, room=None)
                
                emit('gamepad_response', {'status': 'success', 'result': result})
            else:
                emit('gamepad_response', {'status': 'error', 'message': 'Gamepad processor not available'})
        except Exception as e:
            error_msg = f"❌ Gamepad action error: {e}"
            print(error_msg)
            
            # Log the error
            error_log = {
                'id': f"gamepad_error_{int(time.time() * 1000000)}",
                'timestamp': datetime.now().isoformat() + 'Z',
                'level': 'error',
                'source': 'gamepad',
                'message': error_msg,
                'metadata': {
                    'error': str(e),
                    'action_data': data
                }
            }
            socketio_app.emit('log_entry', {'log': error_log}, room=None)
            
            emit('error_response', {'error': str(e)})
    
    @socketio_app.on('movement_command')
    def handle_movement_command(data):
        print(f"🎮 Movement command: {data}")
        
        # Only log significant movements to avoid spam
        linear_x = data.get('linear_x', 0)
        linear_y = data.get('linear_y', 0) 
        angular_z = data.get('angular_z', 0)
        
        if abs(linear_x) > 0.1 or abs(linear_y) > 0.1 or abs(angular_z) > 0.1:
            # Create log entry for movement command
            movement_log = {
                'id': f"gamepad_movement_{int(time.time() * 1000000)}",
                'timestamp': datetime.now().isoformat() + 'Z',
                'level': 'info',
                'source': 'gamepad',
                'message': f"🎮 Movement: X={linear_x:.2f}, Y={linear_y:.2f}, Z={angular_z:.2f}",
                'metadata': {
                    'movement_data': data,
                    'client_id': request.sid,
                    'interface': 'web_socketio'
                }
            }
            
            # Broadcast log entry to all log viewers in real-time
            socketio_app.emit('log_entry', {'log': movement_log}, room=None)
        
        try:
            # Process movement command
            emit('movement_response', {'status': 'success', 'command': data})
        except Exception as e:
            error_msg = f"❌ Movement command error: {e}"
            print(error_msg)
            
            # Log the error
            error_log = {
                'id': f"movement_error_{int(time.time() * 1000000)}",
                'timestamp': datetime.now().isoformat() + 'Z',
                'level': 'error',
                'source': 'gamepad',
                'message': error_msg,
                'metadata': {
                    'error': str(e),
                    'movement_data': data
                }
            }
            socketio_app.emit('log_entry', {'log': error_log}, room=None)
            
            emit('error_response', {'error': str(e)})
    
    @socketio_app.on('request_logs')
    def handle_request_logs(data):
        print(f"📋 Log request: {data}")
        try:
            # Get logs using the existing log collection system
            limit = data.get('count', 100)
            level = data.get('level', '')
            since = data.get('since')
            
            logs = collect_system_logs(limit=limit, since=since, level_filter=level)
            
            # Send logs back to client
            emit('log_batch', {
                'logs': logs,
                'total': len(logs),
                'timestamp': datetime.now().isoformat()
            })
            
        except Exception as e:
            print(f"❌ Log request error: {e}")
            emit('error_response', {'error': str(e), 'type': 'log_error'})
    
    @socketio_app.on('logs_connected')
    def handle_logs_connected(data):
        print(f"📋 Logs interface connected: {data}")
        emit('logs_response', {'status': 'acknowledged', 'timestamp': datetime.now().isoformat()})
        
        # Send initial logs
        try:
            logs = collect_system_logs(limit=50)
            emit('log_batch', {
                'logs': logs,
                'total': len(logs),
                'timestamp': datetime.now().isoformat()
            })
        except Exception as e:
            print(f"❌ Initial logs error: {e}")
            emit('error_response', {'error': str(e), 'type': 'log_error'})
    
    @socketio_app.on('gamepad_interface_connected')
    def handle_gamepad_interface_connected(data):
        print(f"🎮 Gamepad interface connected: {data}")
        emit('gamepad_interface_response', {'status': 'acknowledged', 'timestamp': datetime.now().isoformat()})
        
        # Send current gamepad status
        try:
            # Check if gamepad API server is running
            gamepad_status = {
                'connected': False,
                'gamepad_count': 0,
                'last_activity': None
            }
            
            # Try to get status from gamepad API if available
            try:
                import requests
                response = requests.get('http://localhost:8888/api/gamepad/status', timeout=1)
                if response.status_code == 200:
                    gamepad_data = response.json()
                    gamepad_status['connected'] = gamepad_data.get('gamepad_connected', False)
                    gamepad_status['gamepad_count'] = gamepad_data.get('gamepad_count', 0)
            except:
                pass  # Gamepad API not available
            
            emit('gamepad_status', gamepad_status)
            
        except Exception as e:
            print(f"❌ Gamepad status error: {e}")
            emit('error_response', {'error': str(e), 'type': 'gamepad_error'})
    
    print("✅ SocketIO event handlers registered")

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
        cpu_usage = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Get uptime
        boot_time = psutil.boot_time()
        uptime_seconds = time.time() - boot_time
        if uptime_seconds < 3600:
            uptime = f"{int(uptime_seconds/60)}m"
        elif uptime_seconds < 86400:
            uptime = f"{int(uptime_seconds/3600)}h {int((uptime_seconds % 3600)/60)}m"
        else:
            uptime = f"{int(uptime_seconds/86400)}d {int((uptime_seconds % 86400)/3600)}h"
        
        # Get load average (Linux only)
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
        if not data:
            return jsonify({'success': False, 'error': 'JSON data required'}), 400
            
        pid = data.get('pid')
        if not pid:
            return jsonify({'success': False, 'error': 'PID is required'}), 400
        
        try:
            pid = int(pid)
        except ValueError:
            return jsonify({'success': False, 'error': 'PID must be a number'}), 400
        
        # Try to get process info first
        try:
            proc = psutil.Process(pid)
            process_name = proc.name()
            
            # Kill the process
            proc.terminate()
            
            # Wait a bit and force kill if still running
            try:
                proc.wait(timeout=3)
            except psutil.TimeoutExpired:
                proc.kill()
            
            return jsonify({
                'success': True,
                'message': f'Process {process_name} (PID: {pid}) terminated successfully'
            })
            
        except psutil.NoSuchProcess:
            return jsonify({'success': False, 'error': f'Process with PID {pid} not found'}), 404
        except psutil.AccessDenied:
            return jsonify({'success': False, 'error': f'Access denied to kill process {pid}'}), 403
        except Exception as e:
            return jsonify({'success': False, 'error': f'Failed to kill process: {str(e)}'}), 500
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'server': 'tron_laika_pwa'})

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
                'timestamp': datetime.now().isoformat(),
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
        
    except ImportError as e:
        # Fallback: return empty chat with status
        return jsonify({
            'success': False,
            'error': f'Pipeline logger not available: {str(e)}',
            'messages': [],
            'status': {
                'stt_running': False,
                'llm_running': False,
                'tts_available': False,
                'timestamp': datetime.now().isoformat()
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
                'timestamp': datetime.now().isoformat()
            },
            'total_messages': 0
        })

@app.route('/api/conversation-data')
def get_conversation_data():
    """Get conversation data for the conversation monitor (fallback endpoint)"""
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
                    "timestamp": datetime.now().isoformat()
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

# System Logs API - Real logging system for LAIKA
@app.route('/api/system/logs', methods=['GET'])
def get_system_logs():
    """Get real system logs from LAIKA components"""
    try:
        limit = int(request.args.get('limit', 100))
        since = request.args.get('since')
        level = request.args.get('level', '').lower()
        
        logs = collect_system_logs(limit=limit, since=since, level_filter=level)
        
        return jsonify({
            'success': True,
            'logs': logs,
            'total': len(logs),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Error getting system logs: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'logs': []
        }), 500

@app.route('/api/system/status', methods=['GET'])
def get_system_status():
    """Get system status for health checks"""
    try:
        return jsonify({
            'success': True,
            'status': 'online',
            'services': {
                'web_server': 'running',
                'logging_system': 'active'
            },
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/fan/status')
def get_fan_status():
    """Get current fan status and control information"""
    try:
        fan_data = get_fan_info()
        return jsonify({
            'success': True,
            'data': fan_data,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/fan/control', methods=['POST'])
def control_fan():
    """Control fan speed (if supported)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        new_state = data.get('state')
        if new_state is None:
            return jsonify({
                'success': False,
                'error': 'Fan state not provided'
            }), 400
        
        # Validate fan state
        fan_info = get_fan_info()
        max_state = fan_info.get('maxState', 4)
        
        if not (0 <= new_state <= max_state):
            return jsonify({
                'success': False,
                'error': f'Fan state must be between 0 and {max_state}'
            }), 400
        
        # Set fan state (requires root privileges)
        try:
            with open('/sys/class/thermal/cooling_device0/cur_state', 'w') as f:
                f.write(str(new_state))
            
            # Get updated fan info
            updated_fan_info = get_fan_info()
            
            return jsonify({
                'success': True,
                'message': f'Fan state set to {new_state}',
                'data': updated_fan_info,
                'timestamp': datetime.now().isoformat()
            })
        except PermissionError:
            return jsonify({
                'success': False,
                'error': 'Permission denied - fan control requires elevated privileges',
                'timestamp': datetime.now().isoformat()
            }), 403
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'Failed to set fan state: {str(e)}',
                'timestamp': datetime.now().isoformat()
            }), 500
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/dashboard/data')
def get_dashboard_data():
    """Get comprehensive dashboard data with real sensor information"""
    try:
        import psutil
        import subprocess
        import socket
        import time
        
        dashboard_data = {}
        
        # Get real system performance data
        dashboard_data['performance'] = {
            'cpu': round(psutil.cpu_percent(interval=0.1)),
            'memory': round(psutil.virtual_memory().percent),
            'storage': round(psutil.disk_usage('/').percent),
            'uptime': format_uptime_dashboard(psutil.boot_time()),
            'processes': len(psutil.pids())
        }
        
        # Get real temperature data
        dashboard_data['temperature'] = get_system_temperatures()
        
        # Get real network data
        dashboard_data['network'] = get_network_info_dashboard()
        
        # Get real battery data
        dashboard_data['battery'] = get_battery_info_dashboard()
        
        # Get real fan data
        dashboard_data['fan'] = get_fan_info()
        
        # Get IMU data (placeholder for now)
        dashboard_data['imu'] = {
            'orientation': '--',
            'pitch': 0,
            'roll': 0,
            'acceleration': 9.8,
            'gyroscope': 0,
            'magnetometer': 0
        }
        
        # Get servo data (empty for now)
        dashboard_data['servos'] = []
        
        return jsonify({
            'success': True,
            'data': dashboard_data,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

def format_uptime_dashboard(boot_time):
    """Format system uptime for dashboard"""
    try:
        import time
        uptime_seconds = time.time() - boot_time
        days = int(uptime_seconds // 86400)
        hours = int((uptime_seconds % 86400) // 3600)
        if days > 0:
            return f"{days}d {hours}h"
        else:
            return f"{hours}h {int((uptime_seconds % 3600) // 60)}m"
    except:
        return "--"

def get_system_temperatures():
    """Get real system temperatures"""
    temps = {'cpu': 0, 'battery': 0, 'motor': 0, 'ambient': 0}
    
    try:
        # Try to read CPU temperature from Raspberry Pi
        try:
            with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                cpu_temp = int(f.read().strip()) / 1000.0
                temps['cpu'] = round(cpu_temp)
                # Estimate other temperatures based on CPU temp
                temps['battery'] = round(cpu_temp - 5)
                temps['motor'] = round(cpu_temp + 5)
                temps['ambient'] = round(cpu_temp - 10)
        except:
            # Fallback values if temperature sensor not available
            temps = {'cpu': 45, 'battery': 40, 'motor': 50, 'ambient': 25}
    except Exception as e:
        print(f"Error reading temperatures: {e}")
    
    return temps

def get_fan_info():
    """Get real fan information from thermal cooling device"""
    fan_info = {
        'state': 0,
        'maxState': 4,
        'speed': 0,
        'mode': 'Auto',
        'target': 65,
        'efficiency': 85,
        'type': 'pwm-fan'
    }
    
    try:
        # Read current fan state
        try:
            with open('/sys/class/thermal/cooling_device0/cur_state', 'r') as f:
                fan_info['state'] = int(f.read().strip())
        except:
            pass
        
        # Read max fan state
        try:
            with open('/sys/class/thermal/cooling_device0/max_state', 'r') as f:
                fan_info['maxState'] = int(f.read().strip())
        except:
            pass
            
        # Read fan type
        try:
            with open('/sys/class/thermal/cooling_device0/type', 'r') as f:
                fan_info['type'] = f.read().strip()
        except:
            pass
        
        # Calculate speed percentage
        if fan_info['maxState'] > 0:
            fan_info['speed'] = round((fan_info['state'] / fan_info['maxState']) * 100)
        
        # Estimate cooling efficiency based on current state and temperature
        temps = get_system_temperatures()
        cpu_temp = temps.get('cpu', 45)
        
        # Calculate efficiency based on temperature vs fan state
        if fan_info['state'] == 0:
            # Fan off - efficiency based on temperature
            fan_info['efficiency'] = max(50, 100 - (cpu_temp - 40) * 2) if cpu_temp > 40 else 100
        else:
            # Fan running - higher efficiency
            target_temp = fan_info['target']
            temp_diff = abs(cpu_temp - target_temp)
            fan_info['efficiency'] = max(60, 100 - temp_diff * 3)
            
        fan_info['efficiency'] = round(min(100, max(0, fan_info['efficiency'])))
        
    except Exception as e:
        print(f"Error reading fan info: {e}")
    
    return fan_info

def get_network_info_dashboard():
    """Get real network information for dashboard"""
    import subprocess
    import socket
    
    net_info = {'signal': None, 'ssid': None, 'ip': None, 'download': 0, 'upload': 0, 'latency': None}
    
    try:
        # Get WiFi info using iwconfig
        try:
            result = subprocess.run(['iwconfig'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                for line in lines:
                    if 'ESSID:' in line:
                        ssid = line.split('ESSID:')[1].strip().strip('"')
                        if ssid and ssid != 'off/any':
                            net_info['ssid'] = ssid
                    if 'Signal level=' in line:
                        signal = line.split('Signal level=')[1].split()[0]
                        try:
                            net_info['signal'] = int(signal)
                        except:
                            pass
        except:
            pass
        
        # Get IP address
        try:
            hostname = socket.gethostname()
            net_info['ip'] = socket.gethostbyname(hostname)
        except:
            try:
                # Fallback method
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("8.8.8.8", 80))
                net_info['ip'] = s.getsockname()[0]
                s.close()
            except:
                pass
        
        # Simple ping test for latency
        try:
            result = subprocess.run(['ping', '-c', '1', '8.8.8.8'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if 'time=' in line:
                        latency = line.split('time=')[1].split()[0]
                        try:
                            net_info['latency'] = int(float(latency))
                        except:
                            pass
        except:
            pass
        
    except Exception as e:
        print(f"Error reading network info: {e}")
    
    return net_info

def get_battery_info_dashboard():
    """Get real battery information for dashboard"""
    import psutil
    
    battery_info = {'level': 85, 'voltage': 7.4, 'current': 2.1, 'charging': False}
    
    try:
        # Try to get battery info from system
        if hasattr(psutil, 'sensors_battery'):
            battery = psutil.sensors_battery()
            if battery:
                battery_info['level'] = round(battery.percent)
                battery_info['charging'] = battery.power_plugged
        
        # Try to read battery voltage from system files if available
        # This would be robot-specific implementation
        
    except Exception as e:
        print(f"Error reading battery info: {e}")
    
    return battery_info

def collect_system_logs(limit=100, since=None, level_filter=None):
    """Collect real logs from LAIKA system components"""
    logs = []
    
    try:
        # 1. Collect from systemd journal for LAIKA services
        journal_logs = collect_systemd_logs(limit//4)
        logs.extend(journal_logs)
        
        # 2. Collect from Python logging files
        python_logs = collect_python_logs(limit//4)
        logs.extend(python_logs)
        
        # 3. Collect from application-specific log files
        app_logs = collect_application_logs(limit//4)
        logs.extend(app_logs)
        
        # 4. Generate real-time system status logs
        status_logs = generate_status_logs(limit//4)
        logs.extend(status_logs)
        
        # Sort by timestamp (newest first)
        logs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        # Apply filters
        if since:
            try:
                since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
                logs = [log for log in logs if datetime.fromisoformat(log['timestamp'].replace('Z', '+00:00')) > since_dt]
            except:
                pass
        
        if level_filter and level_filter in ['error', 'warning', 'info', 'debug', 'trace']:
            logs = [log for log in logs if log.get('level', '').lower() == level_filter]
        
        return logs[:limit]
        
    except Exception as e:
        print(f"❌ Error collecting system logs: {e}")
        return []

def collect_systemd_logs(limit=25):
    """Collect logs from systemd journal for LAIKA services"""
    logs = []
    try:
        import subprocess
        
        # Get logs from LAIKA-related systemd services
        services = ['laika-pwa', 'laika-websocket', 'laika-stt', 'laika-ngrok']
        
        for service in services:
            try:
                # Get recent journal entries for this service
                cmd = ['journalctl', '-u', service, '-n', str(limit//len(services)), '--output=json', '--no-pager']
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
                
                if result.returncode == 0:
                    for line in result.stdout.strip().split('\n'):
                        if line.strip():
                            try:
                                entry = json.loads(line)
                                logs.append({
                                    'id': f"systemd_{entry.get('__CURSOR', '')}",
                                    'timestamp': datetime.fromtimestamp(int(entry.get('__REALTIME_TIMESTAMP', '0')) / 1000000).isoformat() + 'Z',
                                    'level': 'info' if entry.get('PRIORITY', '6') in ['6', '5'] else ('warning' if entry.get('PRIORITY') == '4' else 'error'),
                                    'source': f"systemd_{service}",
                                    'message': entry.get('MESSAGE', ''),
                                    'metadata': {
                                        'service': service,
                                        'pid': entry.get('_PID'),
                                        'unit': entry.get('_SYSTEMD_UNIT')
                                    }
                                })
                            except json.JSONDecodeError:
                                continue
                                
            except (subprocess.TimeoutExpired, FileNotFoundError):
                continue
                
    except Exception as e:
        print(f"❌ Error collecting systemd logs: {e}")
    
    return logs

def collect_python_logs(limit=25):
    """Collect logs from Python log files"""
    logs = []
    
    try:
        # Look for common log files in the LAIKA directory
        log_files = [
            '/home/pi/LAIKA/laika.log',
            '/home/pi/LAIKA/stt_bridge.log',
            '/home/pi/LAIKA/websocket.log',
            '/var/log/laika.log'
        ]
        
        for log_file in log_files:
            if os.path.exists(log_file):
                try:
                    with open(log_file, 'r') as f:
                        lines = f.readlines()[-limit//len([f for f in log_files if os.path.exists(f)]):]  # Get recent lines
                        
                    for line in reversed(lines):  # Process newest first
                        if line.strip():
                            # Parse log line (assuming standard Python logging format)
                            log_entry = parse_log_line(line, os.path.basename(log_file))
                            if log_entry:
                                logs.append(log_entry)
                                
                except Exception as e:
                    print(f"❌ Error reading log file {log_file}: {e}")
                    
    except Exception as e:
        print(f"❌ Error collecting Python logs: {e}")
    
    return logs

def collect_application_logs(limit=25):
    """Collect logs from running LAIKA application processes"""
    logs = []
    
    try:
        # Check for active LAIKA processes and their status
        import psutil
        import time
        
        laika_processes = []
        for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'create_time', 'cpu_percent', 'memory_percent']):
            try:
                if any('laika' in str(item).lower() for item in proc.info['cmdline'] or []):
                    laika_processes.append(proc.info)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        # Generate logs for each process
        for proc in laika_processes[:limit//2]:
            logs.append({
                'id': f"process_{proc['pid']}_{int(time.time())}",
                'timestamp': datetime.now().isoformat() + 'Z',
                'level': 'info',
                'source': 'process_monitor',
                'message': f"Process {proc['name']} (PID: {proc['pid']}) - CPU: {proc.get('cpu_percent', 0):.1f}%, Memory: {proc.get('memory_percent', 0):.1f}%",
                'metadata': {
                    'pid': proc['pid'],
                    'name': proc['name'],
                    'cpu_percent': proc.get('cpu_percent', 0),
                    'memory_percent': proc.get('memory_percent', 0)
                }
            })
            
    except Exception as e:
        print(f"❌ Error collecting application logs: {e}")
    
    return logs

def generate_status_logs(limit=25):
    """Generate real-time system status logs"""
    logs = []
    
    try:
        import psutil
        import time
        
        # System metrics
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Network status
        try:
            network = psutil.net_io_counters()
            network_active = True
        except:
            network_active = False
        
        # Generate status log entries
        current_time = datetime.now().isoformat() + 'Z'
        
        logs.append({
            'id': f"system_cpu_{int(time.time())}",
            'timestamp': current_time,
            'level': 'warning' if cpu_percent > 80 else 'info',
            'source': 'system_monitor',
            'message': f"CPU usage: {cpu_percent:.1f}%",
            'metadata': {'cpu_percent': cpu_percent, 'threshold': 80}
        })
        
        logs.append({
            'id': f"system_memory_{int(time.time())}",
            'timestamp': current_time,
            'level': 'warning' if memory.percent > 85 else 'info',
            'source': 'system_monitor',
            'message': f"Memory usage: {memory.percent:.1f}% ({memory.used // (1024**2)}MB / {memory.total // (1024**2)}MB)",
            'metadata': {'memory_percent': memory.percent, 'memory_used_mb': memory.used // (1024**2)}
        })
        
        logs.append({
            'id': f"system_disk_{int(time.time())}",
            'timestamp': current_time,
            'level': 'warning' if disk.percent > 90 else 'info',
            'source': 'system_monitor',
            'message': f"Disk usage: {disk.percent:.1f}% ({disk.used // (1024**3)}GB / {disk.total // (1024**3)}GB)",
            'metadata': {'disk_percent': disk.percent, 'disk_used_gb': disk.used // (1024**3)}
        })
        
        if network_active:
            logs.append({
                'id': f"network_status_{int(time.time())}",
                'timestamp': current_time,
                'level': 'info',
                'source': 'network_monitor',
                'message': f"Network active - Bytes sent: {network.bytes_sent // (1024**2)}MB, received: {network.bytes_recv // (1024**2)}MB",
                'metadata': {
                    'bytes_sent_mb': network.bytes_sent // (1024**2),
                    'bytes_recv_mb': network.bytes_recv // (1024**2)
                }
            })
        else:
            logs.append({
                'id': f"network_error_{int(time.time())}",
                'timestamp': current_time,
                'level': 'error',
                'source': 'network_monitor',
                'message': "Network interface not accessible",
                'metadata': {}
            })
            
    except Exception as e:
        print(f"❌ Error generating status logs: {e}")
    
    return logs

def parse_log_line(line, source):
    """Parse a log line and return structured log entry"""
    try:
        # Try to parse standard Python logging format
        # Format: YYYY-MM-DD HH:MM:SS,mmm - LEVEL - message
        import re
        
        pattern = r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+ - (\w+) - (.+)'
        match = re.match(pattern, line.strip())
        
        if match:
            timestamp_str, level, message = match.groups()
            timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S').isoformat() + 'Z'
            
            return {
                'id': f"{source}_{hash(line)}",
                'timestamp': timestamp,
                'level': level.lower(),
                'source': source.replace('.log', ''),
                'message': message.strip(),
                'metadata': {'log_file': source}
            }
        else:
            # Fallback for non-standard format
            return {
                'id': f"{source}_{hash(line)}",
                'timestamp': datetime.now().isoformat() + 'Z',
                'level': 'info',
                'source': source.replace('.log', ''),
                'message': line.strip(),
                'metadata': {'log_file': source, 'raw_format': True}
            }
            
    except Exception as e:
        return None

# Music tracking API endpoints
@app.route('/api/music/tracks')
def get_music_tracks():
    """Get detected music tracks from AudD database"""
    try:
        import sqlite3
        db_path = "/home/pi/LAIKA/data/music_tracks.db"
        
        if not os.path.exists(db_path):
            return jsonify({"tracks": [], "message": "No music database found"})
        
        limit = request.args.get('limit', 50, type=int)
        
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute('''
                SELECT * FROM detected_tracks 
                ORDER BY timestamp DESC 
                LIMIT ?
            ''', (limit,))
            
            tracks = [dict(row) for row in cursor.fetchall()]
            
            return jsonify({
                "tracks": tracks,
                "count": len(tracks),
                "message": f"Retrieved {len(tracks)} tracks"
            })
            
    except Exception as e:
        return jsonify({"error": f"Failed to get tracks: {e}"}), 500

@app.route('/api/music/identify', methods=['POST'])
def identify_music():
    """Trigger manual music identification"""
    try:
        # This would trigger the AudD service to do an immediate identification
        # For now, return a placeholder response
        return jsonify({
            "message": "Music identification triggered",
            "status": "processing"
        })
    except Exception as e:
        return jsonify({"error": f"Failed to trigger identification: {e}"}), 500

@app.route('/api/music/stats')
def get_music_stats():
    """Get music detection statistics"""
    try:
        import sqlite3
        db_path = "/home/pi/LAIKA/data/music_tracks.db"
        
        if not os.path.exists(db_path):
            return jsonify({"stats": {}, "message": "No music database found"})
        
        with sqlite3.connect(db_path) as conn:
            # Get total tracks
            total_tracks = conn.execute('SELECT COUNT(*) FROM detected_tracks').fetchone()[0]
            
            # Get tracks today
            today_tracks = conn.execute('''
                SELECT COUNT(*) FROM detected_tracks 
                WHERE date(timestamp) = date('now')
            ''').fetchone()[0]
            
            # Get top artists
            top_artists = conn.execute('''
                SELECT artist, COUNT(*) as count 
                FROM detected_tracks 
                WHERE artist IS NOT NULL
                GROUP BY artist 
                ORDER BY count DESC 
                LIMIT 10
            ''').fetchall()
            
            return jsonify({
                "stats": {
                    "total_tracks": total_tracks,
                    "today_tracks": today_tracks,
                    "top_artists": [{"artist": row[0], "count": row[1]} for row in top_artists]
                }
            })
            
    except Exception as e:
        return jsonify({"error": f"Failed to get stats: {e}"}), 500

# GitHub Repository Management API endpoints
@app.route('/api/github/status')
def get_github_status():
    """Get status of LAIKA repositories"""
    try:
        import subprocess
        import os
        from datetime import datetime
        
        repositories = []
        
        # Main LAIKA repository
        main_repo_path = '/home/pi/LAIKA'
        if os.path.exists(main_repo_path):
            main_status = get_repository_status(main_repo_path, 'LAIKA (Main)', 'main')
            repositories.append(main_status)
        
        # laika-pwa submodule
        pwa_repo_path = '/home/pi/LAIKA/laika-pwa'
        if os.path.exists(pwa_repo_path):
            pwa_status = get_repository_status(pwa_repo_path, 'laika-pwa', 'submodule')
            repositories.append(pwa_status)
        
        return jsonify({
            'success': True,
            'repositories': repositories,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to get repository status: {str(e)}',
            'repositories': []
        }), 500

@app.route('/api/github/update-all', methods=['POST'])
def update_all_repositories():
    """Update all repositories recursively"""
    try:
        import subprocess
        import os
        from datetime import datetime
        
        results = []
        
        # Update main repository
        main_result = update_repository('/home/pi/LAIKA', 'LAIKA (Main)')
        results.append(main_result)
        
        # Update submodules if main update was successful
        if main_result['success']:
            submodule_result = refresh_submodules('/home/pi/LAIKA')
            results.append({
                'repository': 'Submodules',
                'success': submodule_result['success'],
                'status': submodule_result['message']
            })
        
        # Check if all operations were successful
        all_success = all(result['success'] for result in results)
        
        return jsonify({
            'success': all_success,
            'results': results,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to update repositories: {str(e)}',
            'results': []
        }), 500

@app.route('/api/github/update-main', methods=['POST'])
def update_main_repository():
    """Update main LAIKA repository only"""
    try:
        from datetime import datetime
        
        result = update_repository('/home/pi/LAIKA', 'LAIKA (Main)')
        
        return jsonify({
            'success': result['success'],
            'message': result['status'],
            'repository': result['repository'],
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to update main repository: {str(e)}'
        }), 500

@app.route('/api/github/refresh-submodules', methods=['POST'])
def refresh_submodules_endpoint():
    """Refresh git submodules"""
    try:
        from datetime import datetime
        
        result = refresh_submodules('/home/pi/LAIKA')
        
        return jsonify({
            'success': result['success'],
            'message': result['message'],
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to refresh submodules: {str(e)}'
        }), 500

@app.route('/api/github/reset-hard', methods=['POST'])
def reset_hard():
    """Perform hard reset on repositories (dangerous)"""
    try:
        import subprocess
        import os
        from datetime import datetime
        
        results = []
        
        # Hard reset main repository
        main_repo_path = '/home/pi/LAIKA'
        if os.path.exists(main_repo_path):
            try:
                # Fetch latest changes
                subprocess.run(['git', 'fetch', 'origin'], cwd=main_repo_path, check=True, capture_output=True, text=True)
                
                # Hard reset to origin/main
                subprocess.run(['git', 'reset', '--hard', 'origin/main'], cwd=main_repo_path, check=True, capture_output=True, text=True)
                
                results.append({
                    'repository': 'LAIKA (Main)',
                    'success': True,
                    'status': 'Hard reset completed successfully'
                })
            except subprocess.CalledProcessError as e:
                results.append({
                    'repository': 'LAIKA (Main)',
                    'success': False,
                    'status': f'Hard reset failed: {e.stderr}'
                })
        
        # Reset submodules
        submodule_result = refresh_submodules(main_repo_path, hard_reset=True)
        results.append({
            'repository': 'Submodules',
            'success': submodule_result['success'],
            'status': submodule_result['message']
        })
        
        all_success = all(result['success'] for result in results)
        
        return jsonify({
            'success': all_success,
            'results': results,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Failed to perform hard reset: {str(e)}',
            'results': []
        }), 500

def get_repository_status(repo_path, repo_name, repo_type):
    """Get detailed status of a git repository"""
    try:
        import subprocess
        import os
        from datetime import datetime
        
        if not os.path.exists(repo_path):
            return {
                'name': repo_name,
                'path': repo_path,
                'type': repo_type,
                'status': 'not found',
                'lastCheck': datetime.now().isoformat(),
                'branch': 'unknown',
                'commits_behind': 0
            }
        
        # Get current branch
        try:
            branch_result = subprocess.run(['git', 'branch', '--show-current'], 
                                         cwd=repo_path, capture_output=True, text=True, check=True)
            current_branch = branch_result.stdout.strip()
        except:
            current_branch = 'unknown'
        
        # Fetch latest changes (but don't merge)
        try:
            subprocess.run(['git', 'fetch', 'origin'], cwd=repo_path, capture_output=True, text=True, timeout=30)
        except:
            pass  # Continue even if fetch fails
        
        # Check if repository is up to date
        try:
            # Get commits behind
            behind_result = subprocess.run(['git', 'rev-list', '--count', f'HEAD..origin/{current_branch}'], 
                                         cwd=repo_path, capture_output=True, text=True)
            commits_behind = int(behind_result.stdout.strip()) if behind_result.returncode == 0 else 0
        except:
            commits_behind = 0
        
        # Determine status
        if commits_behind > 0:
            status = 'needs update'
        else:
            status = 'up to date'
        
        return {
            'name': repo_name,
            'path': repo_path,
            'type': repo_type,
            'status': status,
            'lastCheck': datetime.now().isoformat(),
            'branch': current_branch,
            'commits_behind': commits_behind
        }
        
    except Exception as e:
        return {
            'name': repo_name,
            'path': repo_path,
            'type': repo_type,
            'status': 'error',
            'lastCheck': datetime.now().isoformat(),
            'branch': 'unknown',
            'commits_behind': 0,
            'error': str(e)
        }

def update_repository(repo_path, repo_name):
    """Update a single git repository"""
    try:
        import subprocess
        import os
        
        if not os.path.exists(repo_path):
            return {
                'repository': repo_name,
                'success': False,
                'status': 'Repository path not found'
            }
        
        # Fetch latest changes
        fetch_result = subprocess.run(['git', 'fetch', 'origin'], 
                                    cwd=repo_path, capture_output=True, text=True, timeout=60)
        
        if fetch_result.returncode != 0:
            return {
                'repository': repo_name,
                'success': False,
                'status': f'Fetch failed: {fetch_result.stderr}'
            }
        
        # Get current branch
        branch_result = subprocess.run(['git', 'branch', '--show-current'], 
                                     cwd=repo_path, capture_output=True, text=True)
        current_branch = branch_result.stdout.strip() if branch_result.returncode == 0 else 'main'
        
        # Configure git to handle divergent branches
        subprocess.run(['git', 'config', 'pull.rebase', 'false'], 
                      cwd=repo_path, capture_output=True, text=True)
        
        # Pull latest changes
        pull_result = subprocess.run(['git', 'pull', 'origin', current_branch], 
                                   cwd=repo_path, capture_output=True, text=True, timeout=60)
        
        if pull_result.returncode != 0:
            # If pull fails due to divergent branches, try merge strategy
            if ('divergent branches' in pull_result.stderr or 
                'Need to specify how to reconcile' in pull_result.stderr or
                'refusing to merge unrelated histories' in pull_result.stderr):
                
                merge_result = subprocess.run(['git', 'pull', '--allow-unrelated-histories', '--no-rebase', 'origin', current_branch], 
                                            cwd=repo_path, capture_output=True, text=True, timeout=60)
                if merge_result.returncode != 0:
                    return {
                        'repository': repo_name,
                        'success': False,
                        'status': f'Pull failed after attempting merge with unrelated histories: {merge_result.stderr}'
                    }
            else:
                return {
                    'repository': repo_name,
                    'success': False,
                    'status': f'Pull failed: {pull_result.stderr}'
                }
        
        return {
            'repository': repo_name,
            'success': True,
            'status': 'Updated successfully'
        }
        
    except subprocess.TimeoutExpired:
        return {
            'repository': repo_name,
            'success': False,
            'status': 'Update timed out'
        }
    except Exception as e:
        return {
            'repository': repo_name,
            'success': False,
            'status': f'Update failed: {str(e)}'
        }

def refresh_submodules(repo_path, hard_reset=False):
    """Refresh git submodules"""
    try:
        import subprocess
        import os
        
        if not os.path.exists(repo_path):
            return {
                'success': False,
                'message': 'Repository path not found'
            }
        
        commands = []
        
        if hard_reset:
            # Hard reset submodules
            commands = [
                ['git', 'submodule', 'foreach', '--recursive', 'git', 'reset', '--hard', 'HEAD'],
                ['git', 'submodule', 'update', '--init', '--recursive', '--force'],
                ['git', 'submodule', 'foreach', '--recursive', 'git', 'clean', '-fd']
            ]
        else:
            # Normal submodule update
            commands = [
                ['git', 'submodule', 'update', '--init', '--recursive'],
                ['git', 'submodule', 'foreach', '--recursive', 'git', 'pull', 'origin', 'main']
            ]
        
        for cmd in commands:
            result = subprocess.run(cmd, cwd=repo_path, capture_output=True, text=True, timeout=120)
            if result.returncode != 0:
                return {
                    'success': False,
                    'message': f'Submodule command failed: {" ".join(cmd)} - {result.stderr}'
                }
        
        return {
            'success': True,
            'message': 'Submodules refreshed successfully'
        }
        
    except subprocess.TimeoutExpired:
        return {
            'success': False,
            'message': 'Submodule refresh timed out'
        }
    except Exception as e:
        return {
            'success': False,
            'message': f'Submodule refresh failed: {str(e)}'
        }

# Shell Terminal API endpoints
@app.route('/api/shell/status')
def shell_status():
    """Get shell service status"""
    try:
        return jsonify({
            'success': True,
            'status': 'online',
            'shell_available': True,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/shell/execute', methods=['POST'])
def execute_shell_command():
    """Execute shell command with security controls"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'JSON data required'}), 400
            
        command = data.get('command', '').strip()
        cwd = data.get('cwd', '/home/pi/LAIKA')
        
        if not command:
            return jsonify({'success': False, 'error': 'Command is required'}), 400
        
        # Security: Command whitelist and blacklist
        dangerous_commands = [
            'rm -rf /', 'dd', 'mkfs', 'fdisk', 'parted', 'wipefs',
            'shutdown', 'reboot', 'halt', 'poweroff', 'init 0', 'init 6',
            'passwd', 'su -', 'sudo su', 'chmod 777', 'chown root'
        ]
        
        # Check for dangerous commands
        for dangerous in dangerous_commands:
            if dangerous in command.lower():
                return jsonify({
                    'success': False,
                    'error': f'Command "{dangerous}" is not allowed for security reasons'
                }), 403
        
        # Limit command length
        if len(command) > 500:
            return jsonify({
                'success': False,
                'error': 'Command too long (max 500 characters)'
            }), 400
        
        # Validate working directory
        if not cwd.startswith('/home/pi'):
            cwd = '/home/pi/LAIKA'
        
        # Execute command with timeout and security restrictions
        import subprocess
        import os
        
        try:
            # Set up environment
            env = os.environ.copy()
            env['PATH'] = '/usr/local/bin:/usr/bin:/bin'  # Restrict PATH
            
            # Handle built-in commands
            if command.startswith('cd '):
                new_dir = command[3:].strip()
                if new_dir == '':
                    new_dir = '/home/pi'
                elif new_dir.startswith('~'):
                    new_dir = new_dir.replace('~', '/home/pi', 1)
                elif not new_dir.startswith('/'):
                    new_dir = os.path.join(cwd, new_dir)
                
                # Normalize path and check if it exists
                try:
                    new_dir = os.path.abspath(new_dir)
                    if os.path.exists(new_dir) and os.path.isdir(new_dir):
                        # Security: Only allow directories under /home/pi
                        if new_dir.startswith('/home/pi'):
                            return jsonify({
                                'success': True,
                                'output': '',
                                'cwd': new_dir,
                                'message': f'Changed directory to {new_dir}'
                            })
                        else:
                            return jsonify({
                                'success': False,
                                'error': 'Access denied: Can only navigate within /home/pi'
                            })
                    else:
                        return jsonify({
                            'success': False,
                            'error': f'Directory not found: {new_dir}'
                        })
                except Exception as e:
                    return jsonify({
                        'success': False,
                        'error': f'Invalid path: {str(e)}'
                    })
            
            # Execute other commands
            result = subprocess.run(
                command,
                shell=True,
                cwd=cwd,
                env=env,
                capture_output=True,
                text=True,
                timeout=30,  # 30 second timeout
                user='pi'  # Run as pi user
            )
            
            # Combine stdout and stderr
            output = result.stdout
            if result.stderr:
                output += '\n' + result.stderr
            
            return jsonify({
                'success': result.returncode == 0,
                'output': output.strip(),
                'cwd': cwd,
                'return_code': result.returncode,
                'error': result.stderr.strip() if result.stderr and result.returncode != 0 else None
            })
            
        except subprocess.TimeoutExpired:
            return jsonify({
                'success': False,
                'error': 'Command timed out (30 second limit)',
                'cwd': cwd
            })
        except PermissionError:
            return jsonify({
                'success': False,
                'error': 'Permission denied - insufficient privileges',
                'cwd': cwd
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'error': f'Command execution failed: {str(e)}',
                'cwd': cwd
            })
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500

@app.route('/api/shell/history', methods=['GET', 'POST'])
def shell_history():
    """Get or add to shell command history"""
    history_file = '/tmp/laika_shell_history.txt'
    
    if request.method == 'GET':
        try:
            if os.path.exists(history_file):
                with open(history_file, 'r') as f:
                    history = [line.strip() for line in f.readlines()][-50:]  # Last 50 commands
            else:
                history = []
                
            return jsonify({
                'success': True,
                'history': history,
                'count': len(history)
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            command = data.get('command', '').strip()
            
            if command:
                # Append to history file
                with open(history_file, 'a') as f:
                    f.write(f"{command}\n")
                
                return jsonify({
                    'success': True,
                    'message': 'Command added to history'
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'No command provided'
                }), 400
                
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500

@app.route('/api/shell/suggestions')
def shell_suggestions():
    """Get command suggestions based on input"""
    try:
        query = request.args.get('q', '').lower().strip()
        if not query:
            return jsonify({'success': True, 'suggestions': []})
        
        # Common Linux commands with descriptions
        common_commands = [
            {'cmd': 'ls', 'desc': 'List directory contents', 'category': 'file'},
            {'cmd': 'ls -la', 'desc': 'List all files with details', 'category': 'file'},
            {'cmd': 'cd', 'desc': 'Change directory', 'category': 'navigation'},
            {'cmd': 'pwd', 'desc': 'Print working directory', 'category': 'navigation'},
            {'cmd': 'cat', 'desc': 'Display file contents', 'category': 'file'},
            {'cmd': 'less', 'desc': 'View file contents page by page', 'category': 'file'},
            {'cmd': 'head', 'desc': 'Show first lines of file', 'category': 'file'},
            {'cmd': 'tail', 'desc': 'Show last lines of file', 'category': 'file'},
            {'cmd': 'grep', 'desc': 'Search text patterns', 'category': 'search'},
            {'cmd': 'find', 'desc': 'Find files and directories', 'category': 'search'},
            {'cmd': 'ps', 'desc': 'Show running processes', 'category': 'process'},
            {'cmd': 'ps aux', 'desc': 'Show all processes with details', 'category': 'process'},
            {'cmd': 'top', 'desc': 'Display system processes', 'category': 'process'},
            {'cmd': 'htop', 'desc': 'Interactive process viewer', 'category': 'process'},
            {'cmd': 'df -h', 'desc': 'Show disk usage', 'category': 'system'},
            {'cmd': 'free -h', 'desc': 'Show memory usage', 'category': 'system'},
            {'cmd': 'uptime', 'desc': 'Show system uptime', 'category': 'system'},
            {'cmd': 'whoami', 'desc': 'Show current user', 'category': 'system'},
            {'cmd': 'date', 'desc': 'Show current date and time', 'category': 'system'},
            {'cmd': 'systemctl status', 'desc': 'Check service status', 'category': 'service'},
            {'cmd': 'systemctl list-units', 'desc': 'List all systemd units', 'category': 'service'},
            {'cmd': 'journalctl -f', 'desc': 'Follow system logs', 'category': 'logs'},
            {'cmd': 'journalctl -u', 'desc': 'Show logs for specific service', 'category': 'logs'},
            {'cmd': 'git status', 'desc': 'Show git repository status', 'category': 'git'},
            {'cmd': 'git log', 'desc': 'Show git commit history', 'category': 'git'},
            {'cmd': 'python3', 'desc': 'Python interpreter', 'category': 'dev'},
            {'cmd': 'pip3 list', 'desc': 'List installed Python packages', 'category': 'dev'},
            {'cmd': 'nano', 'desc': 'Simple text editor', 'category': 'edit'},
            {'cmd': 'vim', 'desc': 'Vi text editor', 'category': 'edit'}
        ]
        
        # Filter suggestions based on query
        suggestions = [
            cmd for cmd in common_commands 
            if cmd['cmd'].startswith(query) or query in cmd['desc'].lower()
        ][:10]  # Limit to 10 suggestions
        
        return jsonify({
            'success': True,
            'suggestions': suggestions,
            'query': query
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/tts/settings', methods=['GET', 'POST'])
def tts_settings():
    """Get or update TTS settings"""
    settings_file = '/tmp/laika_tts_settings.json'
    
    if request.method == 'GET':
        try:
            # Load current settings
            default_settings = {
                'provider': 'piper',
                'voice_id': 'en_US-amy-medium',
                'volume': 70,
                'rate': 1.0,
                'stability': 0.5,
                'similarity_boost': 0.75,
                'language': 'en-US'
            }
            
            if os.path.exists(settings_file):
                with open(settings_file, 'r') as f:
                    settings = json.load(f)
                    # Merge with defaults to ensure all keys exist
                    settings = {**default_settings, **settings}
            else:
                settings = default_settings
            
            return jsonify({
                'success': True,
                'config': settings
            })
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    elif request.method == 'POST':
        try:
            data = request.get_json()
            
            # Validate settings
            required_fields = ['provider', 'voice_id', 'volume', 'rate']
            for field in required_fields:
                if field not in data:
                    return jsonify({
                        'success': False,
                        'error': f'Missing required field: {field}'
                    }), 400
            
            # Validate ranges
            if not (0 <= data['volume'] <= 100):
                return jsonify({
                    'success': False,
                    'error': 'Volume must be between 0 and 100'
                }), 400
                
            if not (0.5 <= data['rate'] <= 2.0):
                return jsonify({
                    'success': False,
                    'error': 'Rate must be between 0.5 and 2.0'
                }), 400
            
            # Save settings
            with open(settings_file, 'w') as f:
                json.dump(data, f, indent=2)
            
            # Update system volume if needed
            try:
                import subprocess
                subprocess.run(['amixer', 'set', 'Master', f"{data['volume']}%"], 
                             capture_output=True, check=False)
            except:
                pass  # Ignore amixer errors
            
            return jsonify({
                'success': True,
                'message': 'Settings saved successfully'
            })
            
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500

@app.route('/api/tts/test', methods=['POST'])
def tts_test():
    """Test TTS with given text and settings"""
    try:
        data = request.get_json()
        text = data.get('text', '').strip()
        provider = data.get('provider', 'piper')
        voice_id = data.get('voice_id', 'default')
        settings = data.get('settings', {})
        
        if not text:
            return jsonify({
                'success': False,
                'error': 'No text provided'
            }), 400
        
        if len(text) > 500:
            return jsonify({
                'success': False,
                'error': 'Text too long (max 500 characters)'
            }), 400
        
        # Generate unique filename for this test
        timestamp = int(time.time())
        audio_filename = f"tts_test_{timestamp}.wav"
        audio_path = f"/tmp/{audio_filename}"
        
        # Try to use the TTS system
        try:
            # Import TTS system
            sys.path.append('/home/pi/LAIKA')
            from laika_say import speak_text
            
            # Temporarily adjust system volume
            volume = settings.get('volume', 0.7)
            if isinstance(volume, (int, float)) and 0 <= volume <= 1:
                volume_percent = int(volume * 100)
                try:
                    subprocess.run(['amixer', 'set', 'Master', f"{volume_percent}%"], 
                                 capture_output=True, check=False)
                except:
                    pass
            
            # Generate speech (this will play it automatically)
            success = speak_text(text)
            
            if success:
                return jsonify({
                    'success': True,
                    'message': 'TTS test completed',
                    'provider_used': provider,
                    'voice_used': voice_id,
                    'text_length': len(text)
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'TTS generation failed'
                })
                
        except ImportError:
            return jsonify({
                'success': False,
                'error': 'TTS system not available'
            }), 503
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/tts/voices')
def tts_voices():
    """Get available TTS voices for each provider"""
    try:
        voices = {
            'elevenlabs': [
                {
                    'id': 'GN4wbsbejSnGSa1AzjH5',
                    'name': 'Ekaterina',
                    'description': 'Multilingual female voice (English/Russian)',
                    'gender': 'female',
                    'languages': ['en-US', 'ru-RU'],
                    'premium': True
                },
                {
                    'id': 'oKxkBkm5a8Bmrd1Whf2c',
                    'name': 'Prince Nuri',
                    'description': 'Clear male voice with good pronunciation',
                    'gender': 'male',
                    'languages': ['en-US'],
                    'premium': True
                }
            ],
            'piper': [
                {
                    'id': 'en_US-joe-medium',
                    'name': 'Joe (English Male)',
                    'description': 'Clear male English voice',
                    'gender': 'male',
                    'languages': ['en-US'],
                    'available': os.path.exists('/home/pi/LAIKA/models/piper/en_US-joe-medium.onnx')
                },
                {
                    'id': 'en_US-amy-medium',
                    'name': 'Amy (English Female)',
                    'description': 'Natural female English voice',
                    'gender': 'female',
                    'languages': ['en-US'],
                    'available': os.path.exists('/home/pi/LAIKA/models/piper/en_US-amy-medium.onnx')
                },
                {
                    'id': 'ru_RU-denis-medium',
                    'name': 'Denis (Russian Male)',
                    'description': 'Clear male Russian voice',
                    'gender': 'male',
                    'languages': ['ru-RU'],
                    'available': os.path.exists('/home/pi/LAIKA/models/piper/ru_RU-denis-medium.onnx')
                },
                {
                    'id': 'ru_RU-irina-medium',
                    'name': 'Irina (Russian Female)',
                    'description': 'Natural female Russian voice',
                    'gender': 'female',
                    'languages': ['ru-RU'],
                    'available': os.path.exists('/home/pi/LAIKA/models/piper/ru_RU-irina-medium.onnx')
                }
            ],
            'system': [
                {
                    'id': 'espeak-default',
                    'name': 'eSpeak Default',
                    'description': 'Basic system voice (espeak)',
                    'gender': 'neutral',
                    'languages': ['en-US', 'ru-RU'],
                    'available': True
                }
            ]
        }
        
        return jsonify({
            'success': True,
            'voices': voices
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Voice API endpoints for STT/TTS functionality
@app.route('/api/voice/tts', methods=['POST', 'HEAD'])
def voice_tts():
    """Text-to-Speech API endpoint for voice system"""
    if request.method == 'HEAD':
        # Check if TTS is available
        return ('', 200) if True else ('', 503)
    
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({
                'success': False,
                'error': 'Text is required'
            }), 400
        
        text = data['text']
        provider = data.get('provider', 'elevenlabs')
        voice_config = data.get('voice_config', {})
        
        print(f"🔊 TTS Request: '{text}' using {provider}")
        
        # For now, return a placeholder response
        # TODO: Implement actual TTS integration with ElevenLabs/Piper
        return jsonify({
            'success': False,
            'error': 'TTS endpoint not fully implemented yet',
            'message': 'This endpoint needs integration with actual TTS services'
        }), 501
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/chat/message', methods=['POST'])
def chat_message():
    """Chat message API endpoint for voice system"""
    try:
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({
                'success': False,
                'error': 'Message is required'
            }), 400
        
        message = data['message']
        use_voice = data.get('use_voice', False)
        
        print(f"💬 Chat Message: '{message}' (voice: {use_voice})")
        
        # For now, return a placeholder response
        # TODO: Implement actual LLM integration
        laika_response = f"I heard you say: '{message}'. This is a placeholder response until the LLM integration is complete."
        
        return jsonify({
            'success': True,
            'laika_response': laika_response,
            'message': message,
            'use_voice': use_voice,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/voice/stt', methods=['POST'])
def voice_stt():
    """Speech-to-Text API endpoint for OpenAI Realtime integration"""
    try:
        # Check if we have audio data
        if 'audio' not in request.files and 'audio_data' not in request.form:
            return jsonify({
                'success': False,
                'error': 'Audio data is required'
            }), 400
        
        # Get configuration
        data = request.get_json() if request.is_json else {}
        language = data.get('language', 'en-US')
        provider = data.get('provider', 'openai_whisper')
        
        print(f"🎤 STT Request using {provider} for language {language}")
        
        # For now, return a placeholder response
        # TODO: Implement actual OpenAI Whisper/Realtime API integration
        return jsonify({
            'success': False,
            'error': 'OpenAI Realtime STT not implemented yet',
            'message': 'This endpoint needs integration with OpenAI Realtime API',
            'provider': provider,
            'language': language
        }), 501
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/voice/status')
def voice_status():
    """Get voice system status and capabilities"""
    try:
        status = {
            'tts': {
                'elevenlabs': {
                    'available': False,  # TODO: Check actual ElevenLabs API key
                    'voice_id': 'GN4wbsbejSnGSa1AzjH5',
                    'model': 'eleven_turbo_v2_5'
                },
                'piper': {
                    'available': os.path.exists('/home/pi/LAIKA/models/piper/'),
                    'models': []  # TODO: Scan for available Piper models
                },
                'web_speech': {
                    'available': True,  # Always available in browser
                    'note': 'Browser-based synthesis'
                }
            },
            'stt': {
                'web_speech': {
                    'available': True,  # Always available in browser
                    'note': 'Browser-based recognition'
                },
                'openai_whisper': {
                    'available': OPENAI_AVAILABLE and bool(os.getenv('OPENAI_API_KEY')),
                    'model': 'whisper-1'
                },
                'openai_realtime': {
                    'available': False,  # TODO: Implement OpenAI Realtime API
                    'note': 'Not yet implemented'
                }
            },
            'server_time': datetime.now().isoformat(),
            'capabilities': [
                'web_speech_api',
                'placeholder_endpoints'
            ]
        }
        
        return jsonify({
            'success': True,
            'status': status
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/keys', methods=['GET', 'POST'])
def handle_api_keys():
    """Get or set API keys for all services"""
    try:
        if request.method == 'GET':
            # Load current API keys
            api_keys = load_api_keys()
            
            # Mask all keys for security
            masked_keys = {}
            for service, key in api_keys.items():
                if key and service.endswith('_api_key'):
                    masked_keys[service] = key[:8] + '...' + key[-4:] if len(key) > 12 else '***'
                else:
                    masked_keys[service] = key
            
            return jsonify({
                'success': True,
                'api_keys': masked_keys,
                'timestamp': datetime.now().isoformat()
            })
        
        elif request.method == 'POST':
            # Update API keys
            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'error': 'No data received'}), 400
            
            # Save API keys
            save_result = save_api_keys(data)
            
            if save_result['success']:
                print(f"🔑 API keys updated")
                return jsonify({
                    'success': True,
                    'message': 'API keys updated successfully',
                    'timestamp': datetime.now().isoformat()
                })
            else:
                return jsonify({
                    'success': False,
                    'error': save_result.get('error', 'Failed to save API keys')
                }), 500
                
    except Exception as e:
        print(f"❌ Error handling API keys: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/keys/test', methods=['POST'])
def test_api_keys():
    """Test API keys for LLM, STT, and TTS services"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data received'}), 400
        
        service = data.get('service', '')
        api_key = data.get('api_key', '')
        
        if not service or not api_key:
            return jsonify({'success': False, 'error': 'Service and API key required'}), 400
        
        test_results = {}
        
        if service == 'llm' or service == 'openai':
            # Test OpenAI API key
            try:
                from openai import OpenAI
                client = OpenAI(api_key=api_key)
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": "Hello"}],
                    max_tokens=10
                )
                test_results['llm'] = {'success': True, 'message': 'OpenAI API key is valid'}
            except Exception as e:
                test_results['llm'] = {'success': False, 'error': str(e)}
        
        elif service == 'stt' or service == 'elevenlabs':
            # Test ElevenLabs API key for STT
            try:
                import urllib.request
                import urllib.parse
                import json
                
                url = "https://api.elevenlabs.io/v1/voices"
                headers = {"xi-api-key": api_key}
                
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req) as response:
                    if response.status == 200:
                        test_results['stt'] = {'success': True, 'message': 'ElevenLabs API key is valid for STT'}
                    else:
                        test_results['stt'] = {'success': False, 'error': f'HTTP {response.status}'}
            except Exception as e:
                test_results['stt'] = {'success': False, 'error': str(e)}
        
        elif service == 'tts' or service == 'elevenlabs':
            # Test ElevenLabs API key for TTS
            try:
                import urllib.request
                import urllib.parse
                import json
                
                url = "https://api.elevenlabs.io/v1/voices"
                headers = {"xi-api-key": api_key}
                
                req = urllib.request.Request(url, headers=headers)
                with urllib.request.urlopen(req) as response:
                    if response.status == 200:
                        test_results['tts'] = {'success': True, 'message': 'ElevenLabs API key is valid for TTS'}
                    else:
                        test_results['tts'] = {'success': False, 'error': f'HTTP {response.status}'}
            except Exception as e:
                test_results['tts'] = {'success': False, 'error': str(e)}
        
        return jsonify({
            'success': True,
            'test_results': test_results,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Error testing API keys: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def load_api_keys():
    """Load API keys from config file"""
    try:
        import json
        config_path = os.path.join('config', 'api_keys.json')
        
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return json.load(f)
        else:
            return {
                'openai_api_key': '',
                'anthropic_api_key': '',
                'elevenlabs_api_key': '',
                'google_api_key': ''
            }
    except Exception as e:
        print(f"❌ Error loading API keys: {e}")
        return {}

def save_api_keys(api_keys):
    """Save API keys to config file"""
    try:
        import json
        config_path = os.path.join('config', 'api_keys.json')
        
        # Ensure config directory exists
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        
        # Load existing keys and update
        existing_keys = load_api_keys()
        existing_keys.update(api_keys)
        
        # Save updated keys
        with open(config_path, 'w') as f:
            json.dump(existing_keys, f, indent=2)
        
        # Update environment variables
        for key_name, key_value in api_keys.items():
            if key_value:
                env_var = key_name.upper()
                os.environ[env_var] = key_value
        
        return {'success': True}
    except Exception as e:
        print(f"❌ Error saving API keys: {e}")
        return {'success': False, 'error': str(e)}


if __name__ == '__main__':
    print("🚀 Starting LAIKA TRON PWA Server...")
    print(f"📡 Server will be available at: http://localhost:5000")
    print(f"🌐 NGROK tunnel: https://laika.ngrok.app")
    print("💫 TRON Grid activated!")
    
    # Initialize systems
    # Initialize STT API
    try:
        init_stt_api(app, socketio_app)
        if SOCKETIO_AVAILABLE and socketio_app:
            register_stt_handlers(socketio_app)
        print("✅ STT API initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize STT API: {e}")

    # Initialize WiFi API
    if WIFI_API_AVAILABLE:
        try:
            if SOCKETIO_AVAILABLE and socketio_app:
                register_wifi_handlers(socketio_app)
            print("✅ WiFi API initialized successfully")
        except Exception as e:
            print(f"❌ Failed to initialize WiFi API: {e}")

    initialize_llm_systems()
    

    
    # Initialize 3D integration
    if THREE_D_AVAILABLE:
        try:
            integrate_3d_routes(app)
            print("✅ 3D routes integrated successfully")
        except Exception as e:
            print(f"❌ Failed to integrate 3D routes: {e}")
    
    # Start the SocketIO server
    if socketio_app:
        socketio_app.run(
            app,
            host='0.0.0.0',
            port=8081,
            debug=False,
            allow_unsafe_werkzeug=True
        )
    else:
        # Fallback to regular Flask server if SocketIO failed
        app.run(
            host='0.0.0.0',
            port=8081,
            debug=False
        )

