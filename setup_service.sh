#!/bin/bash

# LAIKA PWA Service Setup Script
# This script installs and manages the LAIKA PWA server as a system service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICE_NAME="laika-pwa"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAIKA_BASE="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🚀 LAIKA PWA Service Setup${NC}"
echo "=================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
   exit 1
fi

# Function to check if service exists
service_exists() {
    systemctl list-unit-files | grep -q "^${SERVICE_NAME}.service"
}

# Function to check if service is running
service_running() {
    systemctl is-active --quiet "${SERVICE_NAME}"
}

# Function to install service
install_service() {
    echo -e "${YELLOW}📦 Installing LAIKA PWA service...${NC}"
    
    # Copy service file
    cp "${SCRIPT_DIR}/${SERVICE_NAME}.service" "${SERVICE_FILE}"
    
    # Update paths in service file for current system
    sed -i "s|/home/pi/LAIKA|${LAIKA_BASE}|g" "${SERVICE_FILE}"
    
    # Set correct user/group
    CURRENT_USER=$(who am i | awk '{print $1}')
    if [[ -z "$CURRENT_USER" ]]; then
        CURRENT_USER=$(logname)
    fi
    if [[ -z "$CURRENT_USER" ]]; then
        CURRENT_USER="pi"
    fi
    
    sed -i "s|User=pi|User=${CURRENT_USER}|g" "${SERVICE_FILE}"
    sed -i "s|Group=pi|Group=${CURRENT_USER}|g" "${SERVICE_FILE}"
    
    # Reload systemd
    systemctl daemon-reload
    
    echo -e "${GREEN}✅ Service file installed to ${SERVICE_FILE}${NC}"
}

# Function to enable service
enable_service() {
    echo -e "${YELLOW}🔧 Enabling LAIKA PWA service...${NC}"
    systemctl enable "${SERVICE_NAME}"
    echo -e "${GREEN}✅ Service enabled for auto-start${NC}"
}

# Function to start service
start_service() {
    echo -e "${YELLOW}🚀 Starting LAIKA PWA service...${NC}"
    systemctl start "${SERVICE_NAME}"
    
    # Wait a moment and check status
    sleep 3
    if service_running; then
        echo -e "${GREEN}✅ Service started successfully${NC}"
    else
        echo -e "${RED}❌ Service failed to start${NC}"
        systemctl status "${SERVICE_NAME}" --no-pager
        exit 1
    fi
}

# Function to stop service
stop_service() {
    echo -e "${YELLOW}🛑 Stopping LAIKA PWA service...${NC}"
    systemctl stop "${SERVICE_NAME}"
    echo -e "${GREEN}✅ Service stopped${NC}"
}

# Function to restart service
restart_service() {
    echo -e "${YELLOW}🔄 Restarting LAIKA PWA service...${NC}"
    systemctl restart "${SERVICE_NAME}"
    
    # Wait a moment and check status
    sleep 3
    if service_running; then
        echo -e "${GREEN}✅ Service restarted successfully${NC}"
    else
        echo -e "${RED}❌ Service failed to restart${NC}"
        systemctl status "${SERVICE_NAME}" --no-pager
        exit 1
    fi
}

# Function to show service status
show_status() {
    echo -e "${BLUE}📊 LAIKA PWA Service Status${NC}"
    echo "================================"
    
    if service_exists; then
        echo -e "Service: ${GREEN}Installed${NC}"
        systemctl is-enabled "${SERVICE_NAME}" >/dev/null 2>&1 && echo -e "Auto-start: ${GREEN}Enabled${NC}" || echo -e "Auto-start: ${RED}Disabled${NC}"
        
        if service_running; then
            echo -e "Status: ${GREEN}Running${NC}"
            echo -e "PID: $(systemctl show -p MainPID --value ${SERVICE_NAME})"
            echo -e "Uptime: $(systemctl show -p ActiveEnterTimestamp --value ${SERVICE_NAME})"
        else
            echo -e "Status: ${RED}Stopped${NC}"
        fi
        
        echo ""
        echo -e "${YELLOW}Recent logs:${NC}"
        journalctl -u "${SERVICE_NAME}" -n 10 --no-pager
    else
        echo -e "Service: ${RED}Not installed${NC}"
    fi
}

# Function to show logs
show_logs() {
    echo -e "${BLUE}📋 LAIKA PWA Service Logs${NC}"
    echo "================================"
    journalctl -u "${SERVICE_NAME}" -f
}

# Function to uninstall service
uninstall_service() {
    echo -e "${YELLOW}🗑️  Uninstalling LAIKA PWA service...${NC}"
    
    if service_running; then
        stop_service
    fi
    
    if service_exists; then
        systemctl disable "${SERVICE_NAME}" 2>/dev/null || true
        rm -f "${SERVICE_FILE}"
        systemctl daemon-reload
        echo -e "${GREEN}✅ Service uninstalled${NC}"
    else
        echo -e "${YELLOW}⚠️  Service not installed${NC}"
    fi
}

# Main script logic
case "${1:-install}" in
    "install")
        if service_exists; then
            echo -e "${YELLOW}⚠️  Service already exists. Use 'restart' or 'reinstall'${NC}"
            exit 1
        fi
        
        install_service
        enable_service
        start_service
        show_status
        ;;
    
    "start")
        if ! service_exists; then
            echo -e "${RED}❌ Service not installed. Run 'install' first${NC}"
            exit 1
        fi
        start_service
        ;;
    
    "stop")
        if ! service_exists; then
            echo -e "${RED}❌ Service not installed${NC}"
            exit 1
        fi
        stop_service
        ;;
    
    "restart")
        if ! service_exists; then
            echo -e "${RED}❌ Service not installed. Run 'install' first${NC}"
            exit 1
        fi
        restart_service
        ;;
    
    "status")
        show_status
        ;;
    
    "logs")
        show_logs
        ;;
    
    "enable")
        if ! service_exists; then
            echo -e "${RED}❌ Service not installed. Run 'install' first${NC}"
            exit 1
        fi
        enable_service
        ;;
    
    "disable")
        if ! service_exists; then
            echo -e "${RED}❌ Service not installed${NC}"
            exit 1
        fi
        systemctl disable "${SERVICE_NAME}"
        echo -e "${GREEN}✅ Service disabled${NC}"
        ;;
    
    "uninstall")
        uninstall_service
        ;;
    
    "reinstall")
        uninstall_service
        install_service
        enable_service
        start_service
        show_status
        ;;
    
    *)
        echo -e "${BLUE}Usage: $0 {install|start|stop|restart|status|logs|enable|disable|uninstall|reinstall}${NC}"
        echo ""
        echo "Commands:"
        echo "  install    - Install and start the service"
        echo "  start      - Start the service"
        echo "  stop       - Stop the service"
        echo "  restart    - Restart the service"
        echo "  status     - Show service status and recent logs"
        echo "  logs       - Show live service logs"
        echo "  enable     - Enable auto-start"
        echo "  disable    - Disable auto-start"
        echo "  uninstall  - Remove the service"
        echo "  reinstall  - Reinstall the service"
        exit 1
        ;;
esac
