#!/usr/bin/env python3
"""
STT Services Backend for LAIKA
Handles multiple Speech-to-Text providers:
- Local Whisper
- OpenAI Whisper API
- OpenAI Realtime API
- ElevenLabs STT
"""

import os
import json
import tempfile
import asyncio
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import logging
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
UPLOAD_FOLDER = tempfile.mkdtemp()
ALLOWED_EXTENSIONS = {'wav', 'mp3', 'webm', 'ogg', 'm4a', 'flac'}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# STT configuration storage (in production, use a database)
STT_CONFIG_FILE = 'stt_config.json'

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_stt_config():
    """Load STT configuration from file"""
    try:
        if os.path.exists(STT_CONFIG_FILE):
            with open(STT_CONFIG_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Error loading STT config: {e}")
    return {'provider': 'web_speech'}

def save_stt_config(config):
    """Save STT configuration to file"""
    try:
        with open(STT_CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=2)
        return True
    except Exception as e:
        logger.error(f"Error saving STT config: {e}")
        return False

# Local Whisper STT
def process_with_local_whisper(audio_path):
    """Process audio with local Whisper model"""
    try:
        import whisper
        
        # Load model (you can change the model size: tiny, base, small, medium, large)
        model = whisper.load_model("base")
        
        # Process audio
        result = model.transcribe(audio_path)
        
        return {
            'transcript': result['text'],
            'language': result.get('language', 'unknown'),
            'provider': 'whisper_local'
        }
    except ImportError:
        logger.error("Whisper not installed. Run: pip install openai-whisper")
        raise Exception("Whisper not installed on this system")
    except Exception as e:
        logger.error(f"Local Whisper error: {e}")
        raise

# OpenAI Whisper API
def process_with_openai_whisper(audio_path):
    """Process audio with OpenAI Whisper API"""
    try:
        from openai import OpenAI
        
        # Initialize OpenAI client
        client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        if not client.api_key:
            raise Exception("OPENAI_API_KEY not set in environment variables")
        
        # Open and send audio file
        with open(audio_path, 'rb') as audio_file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text"
            )
        
        return {
            'transcript': transcript,
            'provider': 'openai_whisper'
        }
    except ImportError:
        logger.error("OpenAI library not installed. Run: pip install openai")
        raise Exception("OpenAI library not installed")
    except Exception as e:
        logger.error(f"OpenAI Whisper API error: {e}")
        raise

# OpenAI Realtime API
async def process_with_openai_realtime(audio_path):
    """Process audio with OpenAI Realtime API"""
    try:
        from openai import AsyncOpenAI
        
        # Initialize async OpenAI client
        client = AsyncOpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        if not client.api_key:
            raise Exception("OPENAI_API_KEY not set in environment variables")
        
        # Note: OpenAI Realtime API is primarily for streaming
        # For batch processing, we'll use the regular Whisper API
        # This is a placeholder for when realtime streaming is implemented
        
        with open(audio_path, 'rb') as audio_file:
            transcript = await client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text"
            )
        
        return {
            'transcript': transcript,
            'provider': 'openai_realtime',
            'note': 'Using batch processing. Realtime streaming requires WebSocket connection.'
        }
    except ImportError:
        logger.error("OpenAI library not installed. Run: pip install openai")
        raise Exception("OpenAI library not installed")
    except Exception as e:
        logger.error(f"OpenAI Realtime API error: {e}")
        raise

# ElevenLabs STT
def process_with_elevenlabs(audio_path):
    """Process audio with ElevenLabs STT"""
    try:
        import requests
        
        api_key = os.getenv('ELEVENLABS_API_KEY')
        if not api_key:
            raise Exception("ELEVENLABS_API_KEY not set in environment variables")
        
        # ElevenLabs STT endpoint (Note: As of 2024, ElevenLabs focuses on TTS)
        # This is a placeholder - check ElevenLabs documentation for actual STT API
        url = "https://api.elevenlabs.io/v1/speech-to-text"
        
        headers = {
            "xi-api-key": api_key,
        }
        
        with open(audio_path, 'rb') as audio_file:
            files = {'audio': audio_file}
            response = requests.post(url, headers=headers, files=files)
        
        if response.status_code == 200:
            result = response.json()
            return {
                'transcript': result.get('text', ''),
                'provider': 'elevenlabs'
            }
        else:
            raise Exception(f"ElevenLabs API returned {response.status_code}: {response.text}")
            
    except ImportError:
        logger.error("Requests library not installed. Run: pip install requests")
        raise Exception("Requests library not installed")
    except Exception as e:
        logger.error(f"ElevenLabs STT error: {e}")
        # Return a note that ElevenLabs STT might not be available
        return {
            'transcript': 'ElevenLabs STT not available. ElevenLabs primarily offers TTS services.',
            'provider': 'elevenlabs',
            'error': str(e)
        }

# API Routes

@app.route('/api/stt/whisper/local', methods=['POST'])
def stt_whisper_local():
    """Local Whisper STT endpoint"""
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        file = request.files['audio']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            result = process_with_local_whisper(filepath)
            
            # Clean up
            os.remove(filepath)
            
            return jsonify(result)
        else:
            return jsonify({'error': 'Invalid file type'}), 400
            
    except Exception as e:
        logger.error(f"Local Whisper endpoint error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/stt/openai/whisper', methods=['POST'])
def stt_openai_whisper():
    """OpenAI Whisper API endpoint"""
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        file = request.files['audio']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            result = process_with_openai_whisper(filepath)
            
            # Clean up
            os.remove(filepath)
            
            return jsonify(result)
        else:
            return jsonify({'error': 'Invalid file type'}), 400
            
    except Exception as e:
        logger.error(f"OpenAI Whisper endpoint error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/stt/openai/realtime', methods=['POST'])
async def stt_openai_realtime():
    """OpenAI Realtime API endpoint"""
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        file = request.files['audio']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            result = await process_with_openai_realtime(filepath)
            
            # Clean up
            os.remove(filepath)
            
            return jsonify(result)
        else:
            return jsonify({'error': 'Invalid file type'}), 400
            
    except Exception as e:
        logger.error(f"OpenAI Realtime endpoint error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/stt/elevenlabs', methods=['POST'])
def stt_elevenlabs():
    """ElevenLabs STT endpoint"""
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        file = request.files['audio']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            result = process_with_elevenlabs(filepath)
            
            # Clean up
            os.remove(filepath)
            
            return jsonify(result)
        else:
            return jsonify({'error': 'Invalid file type'}), 400
            
    except Exception as e:
        logger.error(f"ElevenLabs endpoint error: {e}")
        return jsonify({'error': str(e)}), 500

# LAIKA STT Configuration endpoints

@app.route('/api/laika/stt/config', methods=['GET'])
def get_laika_stt_config():
    """Get LAIKA STT configuration"""
    config = load_stt_config()
    return jsonify(config)

@app.route('/api/laika/stt/config', methods=['POST'])
def set_laika_stt_config():
    """Set LAIKA STT configuration"""
    try:
        data = request.json
        if not data or 'provider' not in data:
            return jsonify({'error': 'Provider not specified'}), 400
        
        config = {
            'provider': data['provider'],
            'updated_at': datetime.now().isoformat(),
            'timestamp': data.get('timestamp', datetime.now().isoformat())
        }
        
        if save_stt_config(config):
            logger.info(f"LAIKA STT config updated: {config['provider']}")
            return jsonify({
                'success': True,
                'config': config
            })
        else:
            return jsonify({'error': 'Failed to save configuration'}), 500
            
    except Exception as e:
        logger.error(f"Error setting LAIKA STT config: {e}")
        return jsonify({'error': str(e)}), 500

# Health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'LAIKA STT Services',
        'timestamp': datetime.now().isoformat()
    })

# Serve the STT comparison page
@app.route('/stt')
def serve_stt_page():
    """Serve the STT comparison page"""
    return send_from_directory('.', 'stt.html')

if __name__ == '__main__':
    # Create upload folder if it doesn't exist
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    logger.info("Starting LAIKA STT Services...")
    logger.info(f"Upload folder: {UPLOAD_FOLDER}")
    logger.info("Available providers:")
    logger.info("  - Local Whisper (requires: pip install openai-whisper)")
    logger.info("  - OpenAI Whisper (requires: OPENAI_API_KEY env var)")
    logger.info("  - OpenAI Realtime (requires: OPENAI_API_KEY env var)")
    logger.info("  - ElevenLabs (requires: ELEVENLABS_API_KEY env var)")
    
    # Run the Flask app
    app.run(host='0.0.0.0', port=5001, debug=True)
