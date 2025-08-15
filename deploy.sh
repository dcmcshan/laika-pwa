#!/bin/bash

# LAIKA PWA Deployment Script

set -e

echo "🤖 LAIKA PWA Deployment Script"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. Consider running as a regular user for security."
fi

# Check Python version
print_status "Checking Python version..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    print_success "Python $PYTHON_VERSION found"
else
    print_error "Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "server.py" ]; then
    print_error "Please run this script from the LAIKA/laika-pwa directory"
    exit 1
fi

# Create virtual environment
print_status "Setting up virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    print_success "Virtual environment created"
else
    print_status "Virtual environment already exists"
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
print_status "Upgrading pip..."
pip install --upgrade pip

# Install requirements
print_status "Installing Python dependencies..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    print_success "Dependencies installed"
else
    print_error "requirements.txt not found"
    exit 1
fi

# Check for ROS2
print_status "Checking for ROS2..."
if command -v ros2 &> /dev/null; then
    print_success "ROS2 detected - will use real robot data"
    ROS2_AVAILABLE=true
else
    print_warning "ROS2 not detected - will run in simulation mode"
    ROS2_AVAILABLE=false
fi

# Check for camera
print_status "Checking for camera hardware..."
if [ -e "/dev/video0" ]; then
    print_success "Camera detected at /dev/video0"
    CAMERA_AVAILABLE=true
else
    print_warning "No camera detected - will use mock camera"
    CAMERA_AVAILABLE=false
fi

# Make startup script executable
print_status "Setting up startup script..."
chmod +x start_server.sh

# Create systemd service (optional)
if [ "$EUID" -eq 0 ]; then
    print_status "Creating systemd service..."
    cat > /etc/systemd/system/laika-pwa.service << EOF
[Unit]
Description=LAIKA PWA Server
After=network.target

[Service]
Type=simple
User=$SUDO_USER
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/start_server.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    print_success "Systemd service created"
    
    echo ""
    print_status "To enable the service to start on boot:"
    echo "  sudo systemctl enable laika-pwa.service"
    echo ""
    print_status "To start the service now:"
    echo "  sudo systemctl start laika-pwa.service"
    echo ""
    print_status "To check service status:"
    echo "  sudo systemctl status laika-pwa.service"
else
    print_status "Skipping systemd service creation (not running as root)"
fi

# Display final information
echo ""
print_success "Deployment completed successfully!"
echo ""
print_status "Next steps:"
echo "1. Start the server: ./start_server.sh"
echo "2. Open your browser to: http://localhost:5000"
echo "3. Connect to LAIKA via Bluetooth"
echo "4. Configure WiFi to enable advanced features"
echo ""
print_status "Server will be available at:"
echo "  - Local: http://localhost:5000"
echo "  - Network: http://$(hostname -I | awk '{print $1}'):5000"
echo ""
print_status "Advanced features available when WiFi is connected:"
echo "  - 📹 Live camera feed"
echo "  - 🗺️ SLAM mapping"
echo "  - 🤖 Robot pose tracking"
echo ""
print_status "For help, see README.md or run: ./start_server.sh --help"



