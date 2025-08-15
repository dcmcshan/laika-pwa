#!/bin/bash
# 🤖 LAIKA BLE Improv Service Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
PUPPYPI_HOST="puppypi"
PUPPYPI_USER="pi"
LAIKA_DIR="/home/pi/LAIKA/ble_services"
SERVICE_NAME="laika-ble-improv"

echo -e "${CYAN}🤖 LAIKA BLE Improv Service Deployment${NC}"
echo -e "${CYAN}=======================================${NC}"

# Function to print status
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

# Function to check if PuppyPi is reachable
check_connectivity() {
    print_status "Checking connectivity to PuppyPi..."
    
    if ping -c 1 -W 3 "$PUPPYPI_HOST" >/dev/null 2>&1; then
        print_success "PuppyPi is reachable at $PUPPYPI_HOST"
        return 0
    else
        print_warning "Cannot reach $PUPPYPI_HOST, scanning network..."
        
        # Scan for Raspberry Pi devices
        print_status "Scanning for Raspberry Pi devices..."
        nmap -sn 192.168.86.0/24 | grep -A 1 -B 1 "Nmap scan report" | grep -E "(192\.168\.86\.|npi|rpi|raspberry)"
        
        print_error "Please update PUPPYPI_HOST variable with correct IP address"
        return 1
    fi
}

# Function to test SSH connectivity
test_ssh() {
    print_status "Testing SSH connectivity..."
    
    if ssh -o ConnectTimeout=5 -o BatchMode=yes "$PUPPYPI_USER@$PUPPYPI_HOST" "whoami" >/dev/null 2>&1; then
        print_success "SSH connection successful"
        return 0
    else
        print_error "Cannot SSH to $PUPPYPI_USER@$PUPPYPI_HOST"
        print_warning "Make sure SSH keys are set up or use: ssh-copy-id $PUPPYPI_USER@$PUPPYPI_HOST"
        return 1
    fi
}

# Function to copy files
copy_files() {
    print_status "Copying BLE Improv service files..."
    
    # Copy the BLE server file
    if [ -f "laika_ble_improv_server.py" ]; then
        scp laika_ble_improv_server.py "$PUPPYPI_USER@$PUPPYPI_HOST:$LAIKA_DIR/"
        print_success "Copied laika_ble_improv_server.py"
    else
        print_error "laika_ble_improv_server.py not found in current directory"
        return 1
    fi
    
    # Copy requirements file if it exists
    if [ -f "ble_requirements.txt" ]; then
        scp ble_requirements.txt "$PUPPYPI_USER@$PUPPYPI_HOST:$LAIKA_DIR/"
        print_success "Copied ble_requirements.txt"
    fi
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing Python dependencies on PuppyPi..."
    
    ssh "$PUPPYPI_USER@$PUPPYPI_HOST" "cd $LAIKA_DIR && python3 -m pip install --user -r ble_requirements.txt"
    
    # Test import
    if ssh "$PUPPYPI_USER@$PUPPYPI_HOST" "python3 -c 'import bleak; print(\"✅ bleak imported successfully\")'"; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install or import dependencies"
        return 1
    fi
}

# Function to create systemd service
create_service() {
    print_status "Creating systemd service..."
    
    # Create service file content
    cat << 'EOF' | ssh "$PUPPYPI_USER@$PUPPYPI_HOST" "sudo tee /etc/systemd/system/$SERVICE_NAME.service > /dev/null"
[Unit]
Description=LAIKA BLE Improv Service
After=multi-user.target network.target bluetooth.target
Wants=network.target bluetooth.target

[Service]
Type=simple
User=pi
Group=pi
WorkingDirectory=/home/pi/LAIKA/ble_services
ExecStart=/usr/bin/python3 /home/pi/LAIKA/ble_services/laika_ble_improv_server.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

# Environment variables
Environment=PYTHONPATH=/home/pi/LAIKA
Environment=PYTHONUNBUFFERED=1

# Bluetooth permissions
SupplementaryGroups=bluetooth

[Install]
WantedBy=multi-user.target
EOF
    
    print_success "Created systemd service file"
}

# Function to start service
start_service() {
    print_status "Starting BLE Improv service..."
    
    # Reload systemd, enable and start service
    ssh "$PUPPYPI_USER@$PUPPYPI_HOST" "
        sudo systemctl daemon-reload &&
        sudo systemctl enable $SERVICE_NAME.service &&
        sudo systemctl start $SERVICE_NAME.service
    "
    
    print_success "Service started and enabled"
}

# Function to check service status
check_service() {
    print_status "Checking service status..."
    
    # Get service status
    if ssh "$PUPPYPI_USER@$PUPPYPI_HOST" "sudo systemctl is-active $SERVICE_NAME.service" | grep -q "active"; then
        print_success "Service is running"
        
        # Show brief status
        ssh "$PUPPYPI_USER@$PUPPYPI_HOST" "sudo systemctl status $SERVICE_NAME.service --no-pager -l"
        
        return 0
    else
        print_error "Service is not running"
        
        # Show logs
        print_status "Recent logs:"
        ssh "$PUPPYPI_USER@$PUPPYPI_HOST" "sudo journalctl -u $SERVICE_NAME.service -n 20 --no-pager"
        
        return 1
    fi
}

# Function to check Bluetooth status
check_bluetooth() {
    print_status "Checking Bluetooth status..."
    
    if ssh "$PUPPYPI_USER@$PUPPYPI_HOST" "sudo systemctl is-active bluetooth" | grep -q "active"; then
        print_success "Bluetooth service is running"
        
        # Check if hci0 is up
        if ssh "$PUPPYPI_USER@$PUPPYPI_HOST" "sudo hciconfig hci0" | grep -q "UP RUNNING"; then
            print_success "Bluetooth adapter is up and running"
        else
            print_warning "Bluetooth adapter may not be properly configured"
            ssh "$PUPPYPI_USER@$PUPPYPI_HOST" "sudo hciconfig hci0 up"
        fi
    else
        print_error "Bluetooth service is not running"
        return 1
    fi
}

# Main deployment function
main() {
    echo -e "${CYAN}Starting deployment process...${NC}"
    
    # Check connectivity
    if ! check_connectivity; then
        exit 1
    fi
    
    # Test SSH
    if ! test_ssh; then
        exit 1
    fi
    
    # Copy files
    if ! copy_files; then
        exit 1
    fi
    
    # Install dependencies
    if ! install_dependencies; then
        exit 1
    fi
    
    # Create systemd service
    if ! create_service; then
        exit 1
    fi
    
    # Start service
    if ! start_service; then
        exit 1
    fi
    
    # Check Bluetooth
    check_bluetooth
    
    # Check service status
    if check_service; then
        echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
        echo -e "${CYAN}LAIKA BLE Improv service is now running on PuppyPi${NC}"
        echo ""
        echo -e "${YELLOW}Next steps:${NC}"
        echo "1. Open the PWA: http://localhost:8081/laika-pwa/"
        echo "2. Click '⚡ Find LAIKA' to connect via BLE"
        echo "3. Configure WiFi using BLE Improv"
        echo "4. Use '🎮 Control LAIKA' for robot control"
        echo ""
        echo -e "${BLUE}To monitor the service:${NC}"
        echo "  sudo systemctl status $SERVICE_NAME.service"
        echo "  sudo journalctl -u $SERVICE_NAME.service -f"
    else
        print_error "Deployment completed but service is not running properly"
        exit 1
    fi
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --status       Check service status only"
        echo "  --restart      Restart the service"
        echo "  --logs         Show service logs"
        echo ""
        echo "Environment variables:"
        echo "  PUPPYPI_HOST   PuppyPi hostname or IP (default: puppypi)"
        echo "  PUPPYPI_USER   SSH username (default: pi)"
        ;;
    --status)
        check_connectivity && test_ssh && check_service
        ;;
    --restart)
        print_status "Restarting BLE Improv service..."
        ssh "$PUPPYPI_USER@$PUPPYPI_HOST" "sudo systemctl restart $SERVICE_NAME.service"
        check_service
        ;;
    --logs)
        print_status "Showing service logs..."
        ssh "$PUPPYPI_USER@$PUPPYPI_HOST" "sudo journalctl -u $SERVICE_NAME.service -f"
        ;;
    *)
        main
        ;;
esac
