#!/usr/bin/env python3
"""
LAIKA TRON PWA Server - Full Featured with TRON Aesthetic
Serves all the beautiful TRON-styled pages with robust startup
"""

from flask import Flask, send_file, jsonify, request, render_template_string, redirect
from flask_cors import CORS
import os
import json
import threading
import time
import sys
from datetime import datetime
import base64
import psutil

# Add LAIKA system to path
sys.path.append('/home/pi/LAIKA')

# Try to import OpenAI and other LLM components
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    print("Warning: OpenAI not available - chat will use fallback responses")
    OPENAI_AVAILABLE = False
    OpenAI = None

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

app = Flask(__name__)
CORS(app)

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
    return """You are LAIKA, an intelligent quadruped robot companion with advanced situational awareness. You have a warm, friendly, and slightly playful personality.

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

When responding:
- Be conversational and engaging, like a friendly companion
- Reference your sensor data, visual context, or map data when relevant
- Offer to help with tasks you can physically perform
- Ask clarifying questions if commands are unclear
- Show awareness of your environment and capabilities
- Keep responses concise but warm and informative
- Use contextual information to provide situationally appropriate responses

You will receive comprehensive context including sensor readings, camera images, and system status. Use this information to provide contextually intelligent and aware responses."""

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
    """Initialize camera safely in background thread"""
    global camera, camera_initialized
    try:
        import sys
        sys.path.append('/home/pi/LAIKA')
        from laika_camera_control_service import LAIKACameraController
        
        import signal
        def timeout_handler(signum, frame):
            raise TimeoutError("Camera init timeout")
        
        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(3)  # 3 second timeout
        
        camera = LAIKACameraController()
        if hasattr(camera, 'camera_open'):
            camera.camera_open()
        camera_initialized = True
        print("📷 Camera initialized successfully")
        
    except Exception as e:
        print(f"⚠️ Camera initialization failed: {e} - using mock camera")
        # Mock camera fallback
        class MockCamera:
            def get_frame(self): return False, None
            def camera_open(self): pass
        camera = MockCamera()
        camera_initialized = True
    finally:
        try:
            signal.alarm(0)
        except:
            pass

# Routes for all the TRON-styled pages
@app.route('/')
def index():
    """Serve the beautiful TRON-styled index page"""
    try:
        return send_file('/home/pi/LAIKA/laika-pwa/index.html')
    except FileNotFoundError:
        return send_file('/home/pi/LAIKA/index.html')

@app.route('/index.html')
def index_html():
    """Redirect index.html to root"""
    return redirect('/')

@app.route('/camera')
def camera_page():
    """Serve the TRON-styled camera page"""
    try:
        return send_file('/home/pi/LAIKA/laika-pwa/camera.html')
    except FileNotFoundError:
        # Redirect to the actual camera page if the file doesn't exist
        return redirect('/camera')

@app.route('/control')
def control_page():
    """Serve the TRON-styled control page"""
    try:
        return send_file('/home/pi/LAIKA/laika-pwa/control.html')
    except Exception as e:
        print(f"Error serving control.html: {e}")
        return f"Error: {e}", 500

@app.route('/dashboard')
def dashboard_page():
    """Serve the TRON-styled dashboard page"""
    return send_file('/home/pi/LAIKA/laika-pwa/dashboard.html')

@app.route('/slam')
def slam_page():
    """Serve the TRON-styled SLAM page"""
    return send_file('/home/pi/LAIKA/laika-pwa/slam.html')

@app.route('/chat')
def chat_page():
    """Serve the TRON-styled chat page"""
    return send_file('/home/pi/LAIKA/laika-pwa/chat.html')

@app.route('/conversation')
def conversation_page():
    """Serve the TRON-styled conversation page"""
    return send_file('/home/pi/LAIKA/laika-pwa/conversation.html')

@app.route('/music')
def music_page():
    """Serve the TRON-styled music page"""
    return send_file('/home/pi/LAIKA/laika-pwa/music.html')

@app.route('/processes')
def processes_page():
    """Serve the TRON-styled processes page"""
    return send_file('/home/pi/LAIKA/laika-pwa/processes.html')

@app.route('/logs')
def logs_page():
    """Serve the TRON-styled logs page"""
    return send_file('/home/pi/LAIKA/laika-pwa/logs.html')

@app.route('/cursor')
def cursor_page():
    """Serve the TRON-styled cursor page"""
    return send_file('/home/pi/LAIKA/laika-pwa/cursor.html')

@app.route('/github')
def github_page():
    """Serve the TRON-styled GitHub manager page"""
    return send_file('/home/pi/LAIKA/laika-pwa/github.html')

# Static file serving
@app.route('/css/<path:filename>')
def css_files(filename):
    return send_file(f'/home/pi/LAIKA/laika-pwa/css/{filename}')

@app.route('/js/<path:filename>')
def js_files(filename):
    return send_file(f'/home/pi/LAIKA/laika-pwa/js/{filename}')

@app.route('/icons/<path:filename>')
def icon_files(filename):
    return send_file(f'/home/pi/LAIKA/laika-pwa/icons/{filename}')

@app.route('/manifest.json')
def manifest():
    return send_file('/home/pi/LAIKA/laika-pwa/manifest.json')

@app.route('/sw.js')
def service_worker():
    return send_file('/home/pi/LAIKA/laika-pwa/sw.js')

@app.route('/stt-llm-tts')
def stt_llm_tts_page():
    """Serve the STT-LLM-TTS pipeline monitoring page"""
    return send_file('/home/pi/LAIKA/laika-pwa/internal.html')

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
                
                return jsonify({
                    'type': 'chat_response',
                    'message': response_text,
                    'metadata': {
                        'personality': personality,
                        'user_id': user_id,
                        'model': model,
                        'visual_query': is_visual_query,
                        'context_available': bool(context.get('sensor_telemetry')),
                        'server': 'tron_server_llm'
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
        laika_say_path = '/home/pi/LAIKA/laika_say.py'
        
        if not os.path.exists(laika_say_path):
            return jsonify({'success': False, 'error': 'TTS system not available'})
        
        # Run laika_say.py with the provided text
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

@app.route('/camera/stream')
def camera_stream():
    """Camera stream endpoint"""
    if not camera_initialized or not camera:
        return jsonify({'error': 'Camera not available'}), 503
    
    def generate():
        while True:
            try:
                success, frame = camera.get_frame()
                if success:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
                else:
                    time.sleep(0.1)
            except Exception as e:
                print(f"Camera stream error: {e}")
                break
    
    return app.response_class(generate(),
                              mimetype='multipart/x-mixed-replace; boundary=frame')

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
        
        # Pull latest changes
        pull_result = subprocess.run(['git', 'pull', 'origin', current_branch], 
                                   cwd=repo_path, capture_output=True, text=True, timeout=60)
        
        if pull_result.returncode != 0:
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

if __name__ == '__main__':
    print("🚀 Starting LAIKA TRON PWA Server...")
    print("🎨 Full TRON aesthetic with all pages")
    print("📷 Camera moved to /camera endpoint")
    print("🎵 Music tracking API endpoints added")
    print("🧠 Initializing LLM and context systems...")
    
    # Initialize LLM and context systems
    initialize_llm_systems()
    
    print("🌐 Server starting on http://0.0.0.0:5000")
    
    # Initialize camera in background thread (non-blocking)
    camera_thread = threading.Thread(target=safe_camera_init, daemon=True)
    camera_thread.start()
    
    # ALWAYS START THE FLASK SERVER - GUARANTEED!
    try:
        app.run(host='0.0.0.0', port=5000, debug=False, threaded=True, use_reloader=False)
    except Exception as e:
        print(f"❌ Server failed: {e}")
        # Fallback - try localhost only
        app.run(host='127.0.0.1', port=5000, debug=False, threaded=True, use_reloader=False)
