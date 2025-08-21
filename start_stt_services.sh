#!/bin/bash

# LAIKA STT Services Startup Script

echo "🎤 Starting LAIKA STT Services..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing STT dependencies..."
pip install -r requirements_stt.txt

# Set environment variables (if .env file exists)
if [ -f ".env" ]; then
    export $(cat .env | xargs)
    echo "Environment variables loaded from .env"
fi

# Check for API keys
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  Warning: OPENAI_API_KEY not set. OpenAI Whisper and Realtime APIs will not work."
fi

if [ -z "$ELEVENLABS_API_KEY" ]; then
    echo "⚠️  Warning: ELEVENLABS_API_KEY not set. ElevenLabs STT will not work."
fi

# Start the STT services
echo "Starting STT services on port 5001..."
python stt_services.py
