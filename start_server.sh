#!/bin/bash

# LAIKA PWA Server Startup Script

echo "🤖 Starting LAIKA PWA Backend Server..."

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install/upgrade pip
echo "⬆️ Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "📚 Installing dependencies..."
pip install -r requirements.txt

# Check if ROS2 is available
if command -v ros2 &> /dev/null; then
    echo "✅ ROS2 detected - will use real camera and SLAM data"
else
    echo "⚠️ ROS2 not detected - running in simulation mode"
fi

# Check if camera is available
if [ -e "/dev/video0" ]; then
    echo "📹 Camera detected at /dev/video0"
else
    echo "⚠️ No camera detected - using mock camera"
fi

# Start the server
echo "🚀 Starting Flask server..."
echo "📡 Server will be available at: http://0.0.0.0:5000"
echo "📱 PWA will be available at: http://0.0.0.0:5000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python3 server.py



