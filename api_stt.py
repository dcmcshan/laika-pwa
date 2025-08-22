#!/usr/bin/env python3
"""
LAIKA STT API Module
Handles all STT-related endpoints and functionality
"""

from flask import Blueprint, request, jsonify
from flask_socketio import emit
from datetime import datetime
import json
import os

# Create Blueprint for STT routes
stt_bp = Blueprint('stt', __name__, url_prefix='/api/stt')

# Global transcript history
transcript_history = []
MAX_HISTORY_SIZE = 100  # Keep last 100 transcripts

# Global SocketIO app reference (will be set by main app)
socketio_app = None
SOCKETIO_AVAILABLE = False

def init_stt_api(app, socketio=None):
    """Initialize STT API with Flask app and SocketIO"""
    global socketio_app, SOCKETIO_AVAILABLE
    
    if socketio:
        socketio_app = socketio
        SOCKETIO_AVAILABLE = True
    
    # Register blueprint
    app.register_blueprint(stt_bp)
    
    # Initialize standalone STT service
    try:
        import sys
        import os
        # Add parent directory to path to find standalone_stt_service.py
        parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if parent_dir not in sys.path:
            sys.path.append(parent_dir)
        
        from standalone_stt_service import get_stt_service
        
        # Get the standalone STT service
        app.stt_service = get_stt_service()
        
        # Set up SocketIO callback for broadcasting transcripts
        if socketio:
            def broadcast_transcript(event, data):
                socketio.emit(event, data)
            
            app.stt_service.set_socketio_callback(broadcast_transcript)
        
        # Start the STT service automatically in background
        if hasattr(app.stt_service, 'start_recording'):
            app.stt_service.start_recording()
            print("✅ STT service started automatically in background")
        
        print("✅ Standalone STT service initialized successfully")
            
    except ImportError as e:
        print(f"❌ Failed to import standalone STT service: {e}")
        app.stt_service = None
    except Exception as e:
        print(f"❌ Failed to initialize STT service: {e}")
        app.stt_service = None
    
    print("✅ STT API module initialized")

@stt_bp.route('/config', methods=['GET', 'POST'])
def api_stt_config():
    """Get or set STT configuration"""
    try:
        if request.method == 'GET':
            # Return current STT configuration
            config = {
                'provider': 'openai_realtime',
                'enable_elevenlabs': False,
                'fallback_order': ['openai_realtime', 'openai_whisper', 'local_whisper'],
                'wake_word': 'LAIKA',
                'sample_rate': 16000,
                'channels': 1
            }
            
            # Try to get actual config from service if available
            try:
                from hybrid_stt_service import HybridSTTService
                if hasattr(request.app, 'stt_service'):
                    config['provider'] = request.app.stt_service.primary_provider
                    config['enable_elevenlabs'] = request.app.stt_service.enable_elevenlabs
                    config['fallback_order'] = request.app.stt_service.fallback_order
            except ImportError:
                pass
            
            return jsonify({
                'success': True,
                'config': config,
                'timestamp': datetime.now().isoformat()
            })
        
        elif request.method == 'POST':
            # Update STT configuration
            data = request.get_json()
            if not data:
                return jsonify({'success': False, 'error': 'No data received'}), 400
            
            provider = data.get('provider', 'openai_realtime')
            enable_elevenlabs = data.get('enable_elevenlabs', False)
            wake_word = data.get('wake_word', 'LAIKA')
            
            # Try to update actual service if available
            try:
                from hybrid_stt_service import HybridSTTService
                if not hasattr(request.app, 'stt_service'):
                    request.app.stt_service = HybridSTTService()
                
                request.app.stt_service.set_provider(provider)
                request.app.stt_service.enable_elevenlabs = enable_elevenlabs
            except ImportError:
                pass
            
            return jsonify({
                'success': True,
                'message': 'STT configuration updated',
                'config': {
                    'provider': provider,
                    'enable_elevenlabs': enable_elevenlabs,
                    'wake_word': wake_word
                },
                'timestamp': datetime.now().isoformat()
            })
            
    except Exception as e:
        print(f"❌ Error handling STT config: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@stt_bp.route('/config/reset', methods=['POST'])
def api_stt_config_reset():
    """Reset STT configuration to defaults"""
    try:
        default_config = {
            'provider': 'openai_realtime',
            'enable_elevenlabs': False,
            'fallback_order': ['openai_realtime', 'openai_whisper', 'local_whisper'],
            'wake_word': 'LAIKA',
            'sample_rate': 16000,
            'channels': 1
        }
        
        # Try to reset actual service if available
        try:
            from hybrid_stt_service import HybridSTTService
            if not hasattr(request.app, 'stt_service'):
                request.app.stt_service = HybridSTTService()
            
            request.app.stt_service.set_provider(default_config['provider'])
            request.app.stt_service.enable_elevenlabs = default_config['enable_elevenlabs']
        except ImportError:
            pass
        
        return jsonify({
            'success': True,
            'message': 'STT configuration reset to defaults',
            'config': default_config,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Error resetting STT config: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@stt_bp.route('/test', methods=['POST'])
def api_stt_test():
    """Test STT functionality"""
    try:
        # Simulate STT test
        test_transcript = "This is a test of the LAIKA hybrid STT system."
        
        return jsonify({
            'success': True,
            'transcript': test_transcript,
            'provider': 'test',
            'message': 'STT test completed successfully',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Error testing STT: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@stt_bp.route('/simulate', methods=['POST'])
def api_stt_simulate():
    """Simulate real-time STT transcript"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data received'}), 400
        
        text = data.get('text', 'Simulated transcript from LAIKA STT')
        provider = data.get('provider', 'openai_realtime')
        
        # Broadcast to SocketIO clients
        if SOCKETIO_AVAILABLE and socketio_app:
            socketio_app.emit('stt_response', {
                'type': 'stt_response',
                'subtype': 'transcript',
                'text': text,
                'provider': provider,
                'timestamp': datetime.now().isoformat()
            })
        
        return jsonify({
            'success': True,
            'message': 'Simulated transcript sent',
            'text': text,
            'provider': provider,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Error simulating STT: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@stt_bp.route('/audio', methods=['POST'])
def api_stt_audio():
    """Receive audio data from PWA and process with STT service"""
    try:
        if not hasattr(request, 'app') or not hasattr(request.app, 'stt_service') or not request.app.stt_service:
            return jsonify({'success': False, 'error': 'STT service not initialized'}), 500
        
        stt_service = request.app.stt_service
        
        # Get audio data from request
        data = request.get_json()
        if not data or 'audio' not in data:
            return jsonify({'success': False, 'error': 'No audio data received'}), 400
        
        # Decode base64 audio data
        import base64
        audio_data = base64.b64decode(data['audio'])
        
        # Send to STT service
        if hasattr(stt_service, 'process_audio'):
            stt_service.process_audio(audio_data)
            print("✅ Audio data sent to STT service")
        else:
            print("⚠️ STT service does not have process_audio method")
        
        return jsonify({
            'success': True,
            'message': 'Audio data received and processed',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Error processing audio: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@stt_bp.route('/transcript', methods=['POST'])
def api_stt_transcript():
    """Receive transcript from STT service and broadcast to connected clients"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data received'}), 400
        
        transcript = data.get('text', '')
        provider = data.get('provider', 'unknown')
        timestamp = data.get('timestamp', datetime.now().isoformat())
        
        if not transcript:
            return jsonify({'success': False, 'error': 'No transcript text received'}), 400
        
        print(f"📝 Received transcript from {provider}: {transcript}")
        
        # Add to transcript history
        global transcript_history
        transcript_entry = {
            'id': len(transcript_history) + 1,
            'text': transcript,
            'provider': provider,
            'timestamp': timestamp,
            'datetime': datetime.now().isoformat()
        }
        transcript_history.append(transcript_entry)
        
        # Keep only the last MAX_HISTORY_SIZE entries
        if len(transcript_history) > MAX_HISTORY_SIZE:
            transcript_history = transcript_history[-MAX_HISTORY_SIZE:]
        
        # Broadcast transcript to all connected SocketIO clients
        if SOCKETIO_AVAILABLE and socketio_app:
            socketio_app.emit('stt_response', {
                'type': 'transcript',
                'text': transcript,
                'provider': provider,
                'timestamp': timestamp,
                'history_id': transcript_entry['id']
            })
            print(f"✅ Broadcasted transcript to connected clients")
        
        return jsonify({
            'success': True,
            'message': 'Transcript received and broadcasted',
            'transcript': transcript,
            'provider': provider,
            'timestamp': timestamp,
            'history_id': transcript_entry['id']
        })
        
    except Exception as e:
        print(f"❌ Error handling transcript: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@stt_bp.route('/history', methods=['GET'])
def api_stt_history():
    """Get transcript history"""
    try:
        # Get query parameters
        limit = request.args.get('limit', 100, type=int)
        provider = request.args.get('provider', None)
        since = request.args.get('since', None)  # ISO timestamp
        
        # Get history from standalone STT service
        if hasattr(request, 'app') and hasattr(request.app, 'stt_service') and request.app.stt_service:
            stt_service = request.app.stt_service
            if hasattr(stt_service, 'get_transcript_history'):
                history = stt_service.get_transcript_history()
            else:
                history = []
        else:
            history = []
        
        # Filter history based on parameters
        filtered_history = history.copy()
        
        if provider:
            filtered_history = [entry for entry in filtered_history if entry.get('provider') == provider]
        
        if since:
            try:
                since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
                filtered_history = [entry for entry in filtered_history 
                                  if datetime.fromisoformat(entry.get('timestamp', '').replace('Z', '+00:00')) >= since_dt]
            except ValueError:
                return jsonify({'success': False, 'error': 'Invalid since timestamp format'}), 400
        
        # Apply limit
        if limit and limit > 0:
            filtered_history = filtered_history[-limit:]
        
        return jsonify({
            'success': True,
            'history': filtered_history,
            'total_count': len(filtered_history),
            'total_available': len(history),
            'max_history_size': 100
        })
        
    except Exception as e:
        print(f"❌ Error retrieving transcript history: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@stt_bp.route('/history/clear', methods=['POST'])
def api_stt_history_clear():
    """Clear transcript history"""
    try:
        global transcript_history
        old_count = len(transcript_history)
        transcript_history = []
        
        return jsonify({
            'success': True,
            'message': f'Cleared {old_count} transcript entries',
            'cleared_count': old_count
        })
        
    except Exception as e:
        print(f"❌ Error clearing transcript history: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@stt_bp.route('/start', methods=['POST'])
def api_stt_start():
    """Start the STT service"""
    try:
        if not hasattr(request, 'app') or not hasattr(request.app, 'stt_service') or not request.app.stt_service:
            return jsonify({'success': False, 'error': 'STT service not initialized'}), 500
        
        stt_service = request.app.stt_service
        
        # Start the standalone STT service
        if hasattr(stt_service, 'start_recording'):
            stt_service.start_recording()
            print("✅ STT service started successfully")
        else:
            print("⚠️ STT service does not have start_recording method")
        
        return jsonify({
            'success': True,
            'message': 'STT service started successfully',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Error starting STT service: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@stt_bp.route('/stop', methods=['POST'])
def api_stt_stop():
    """Stop the STT service"""
    try:
        if not hasattr(request, 'app') or not hasattr(request.app, 'stt_service') or not request.app.stt_service:
            return jsonify({'success': False, 'error': 'STT service not initialized'}), 500
        
        stt_service = request.app.stt_service
        
        # Stop the standalone STT service
        if hasattr(stt_service, 'stop_recording'):
            stt_service.stop_recording()
            print("✅ STT service stopped successfully")
        else:
            print("⚠️ STT service does not have stop_recording method")
        
        return jsonify({
            'success': True,
            'message': 'STT service stopped successfully',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Error stopping STT service: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@stt_bp.route('/status', methods=['GET'])
def api_stt_status():
    """Get STT service status"""
    try:
        # Check if STT service is available and running
        stt_available = False
        stt_running = False
        stt_provider = None
        
        try:
            import sys
            import os
            # Add parent directory to path to find standalone_stt_service.py
            parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            if parent_dir not in sys.path:
                sys.path.append(parent_dir)
            
            from standalone_stt_service import StandaloneSTTService
            stt_available = True
            
            # Check if service instance exists and is running
            if hasattr(request, 'app') and hasattr(request.app, 'stt_service') and request.app.stt_service:
                stt_service = request.app.stt_service
                stt_running = stt_service.is_recording if hasattr(stt_service, 'is_recording') else True  # Assume running if service exists
                stt_provider = "openai_whisper"  # Standalone service uses OpenAI Whisper
        except ImportError:
            pass
        
        return jsonify({
            'success': True,
            'status': {
                'stt_available': stt_available,
                'stt_running': stt_running,
                'stt_provider': stt_provider,
                'history_count': len(transcript_history),
                'max_history_size': MAX_HISTORY_SIZE,
                'socketio_available': SOCKETIO_AVAILABLE
            },
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ Error getting STT status: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# SocketIO event handlers
def handle_stt_audio(data):
    """Handle real-time audio data from STT client"""
    try:
        audio_data = data.get('audio')
        provider = data.get('provider', 'openai_realtime')
        
        if not audio_data:
            emit('stt_response', {'type': 'error', 'message': 'No audio data received'})
            return
        
        # Convert audio data to proper format for STT processing
        import numpy as np
        audio_array = np.array(audio_data, dtype=np.int16)
        
        # For now, simulate real-time transcription
        # TODO: Implement proper real-time STT processing
        transcript = f"Real-time transcript at {datetime.now().strftime('%H:%M:%S')}"
        
        # Add to history and broadcast
        global transcript_history
        transcript_entry = {
            'id': len(transcript_history) + 1,
            'text': transcript,
            'provider': provider,
            'timestamp': datetime.now().strftime('%H:%M:%S'),
            'datetime': datetime.now().isoformat()
        }
        transcript_history.append(transcript_entry)
        
        # Keep only the last MAX_HISTORY_SIZE entries
        if len(transcript_history) > MAX_HISTORY_SIZE:
            transcript_history = transcript_history[-MAX_HISTORY_SIZE:]
        
        emit('stt_response', {
            'type': 'transcript',
            'text': transcript,
            'provider': provider,
            'timestamp': datetime.now().isoformat(),
            'history_id': transcript_entry['id']
        })
        
    except Exception as e:
        print(f"❌ STT audio processing error: {e}")
        emit('stt_response', {
            'type': 'error',
            'message': f'STT processing error: {str(e)}'
        })

def handle_stt_connect():
    """Handle STT client connection"""
    print(f"🎤 STT client connected")
    emit('stt_response', {
        'type': 'status',
        'message': 'Connected to real-time STT service',
        'timestamp': datetime.now().isoformat()
    })

def handle_stt_disconnect():
    """Handle STT client disconnection"""
    print(f"🎤 STT client disconnected")

def register_socketio_handlers(socketio):
    """Register SocketIO event handlers"""
    global socketio_app, SOCKETIO_AVAILABLE
    
    socketio_app = socketio
    SOCKETIO_AVAILABLE = True
    
    @socketio.on('stt_audio')
    def on_stt_audio(data):
        handle_stt_audio(data)
    
    @socketio.on('subscribe')
    def on_subscribe(data):
        """Handle subscription to STT events"""
        channel = data.get('channel')
        if channel == 'stt':
            emit('stt_response', {
                'type': 'status',
                'subtype': 'status',
                'message': 'Subscribed to STT events',
                'timestamp': datetime.now().isoformat()
            })
            print(f"🎤 STT client subscribed to channel: {channel}")
    
    @socketio.on('stt_config')
    def on_stt_config(data):
        """Handle STT configuration updates"""
        provider = data.get('provider', 'openai_realtime')
        print(f"🎤 STT provider updated to: {provider}")
        emit('stt_response', {
            'type': 'status',
            'subtype': 'status',
            'message': f'STT provider updated to {provider}',
            'timestamp': datetime.now().isoformat()
        })
    
    @socketio.on('connect')
    def on_connect():
        handle_stt_connect()
    
    @socketio.on('disconnect')
    def on_disconnect():
        handle_stt_disconnect()
    
    print("✅ STT SocketIO handlers registered")
