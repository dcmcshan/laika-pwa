#!/bin/bash

# LAIKA PWA Service Setup Script for macOS
# This script installs and manages the LAIKA PWA server as a launchd service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVICE_NAME="com.laika.pwa"
PLIST_FILE="${HOME}/Library/LaunchAgents/${SERVICE_NAME}.plist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAIKA_BASE="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}🚀 LAIKA PWA Service Setup (macOS)${NC}"
echo "=========================================="

# Function to check if service exists
service_exists() {
    launchctl list | grep -q "${SERVICE_NAME}"
}

# Function to check if service is running
service_running() {
    launchctl list | grep "${SERVICE_NAME}" | grep -q "PID"
}

# Function to create logs directory
create_logs_dir() {
    mkdir -p "${SCRIPT_DIR}/logs"
    echo -e "${GREEN}✅ Logs directory created${NC}"
}

# Function to install service
install_service() {
    echo -e "${YELLOW}📦 Installing LAIKA PWA service...${NC}"
    
    # Create logs directory
    create_logs_dir
    
    # Copy and customize plist file
    cp "${SCRIPT_DIR}/launchd_plist.plist" "${PLIST_FILE}"
    
    # Update paths in plist file for current system
    sed -i '' "s|/Users/danielmcshan/GitHub/PuppyPi/LAIKA|${LAIKA_BASE}|g" "${PLIST_FILE}"
    
    # Set correct user paths
    CURRENT_USER=$(whoami)
    sed -i '' "s|danielmcshan|${CURRENT_USER}|g" "${PLIST_FILE}"
    
    echo -e "${GREEN}✅ Service file installed to ${PLIST_FILE}${NC}"
}

# Function to load service
load_service() {
    echo -e "${YELLOW}🔧 Loading LAIKA PWA service...${NC}"
    launchctl load "${PLIST_FILE}"
    echo -e "${GREEN}✅ Service loaded${NC}"
}

# Function to unload service
unload_service() {
    echo -e "${YELLOW}🛑 Unloading LAIKA PWA service...${NC}"
    launchctl unload "${PLIST_FILE}" 2>/dev/null || true
    echo -e "${GREEN}✅ Service unloaded${NC}"
}

# Function to start service
start_service() {
    echo -e "${YELLOW}🚀 Starting LAIKA PWA service...${NC}"
    
    if ! service_exists; then
        load_service
    fi
    
    launchctl start "${SERVICE_NAME}"
    
    # Wait a moment and check status
    sleep 3
    if service_running; then
        echo -e "${GREEN}✅ Service started successfully${NC}"
    else
        echo -e "${RED}❌ Service failed to start${NC}"
        show_logs
        exit 1
    fi
}

# Function to stop service
stop_service() {
    echo -e "${YELLOW}🛑 Stopping LAIKA PWA service...${NC}"
    launchctl stop "${SERVICE_NAME}" 2>/dev/null || true
    echo -e "${GREEN}✅ Service stopped${NC}"
}

# Function to restart service
restart_service() {
    echo -e "${YELLOW}🔄 Restarting LAIKA PWA service...${NC}"
    stop_service
    sleep 2
    start_service
}

# Function to show service status
show_status() {
    echo -e "${BLUE}📊 LAIKA PWA Service Status${NC}"
    echo "================================"
    
    if [[ -f "${PLIST_FILE}" ]]; then
        echo -e "Service file: ${GREEN}Installed${NC}"
        echo -e "Location: ${PLIST_FILE}"
        
        if service_exists; then
            echo -e "Loaded: ${GREEN}Yes${NC}"
            
            if service_running; then
                echo -e "Status: ${GREEN}Running${NC}"
                PID=$(launchctl list | grep "${SERVICE_NAME}" | awk '{print $1}')
                echo -e "PID: ${PID}"
            else
                echo -e "Status: ${RED}Stopped${NC}"
            fi
        else
            echo -e "Loaded: ${RED}No${NC}"
        fi
        
        echo ""
        echo -e "${YELLOW}Recent logs:${NC}"
        if [[ -f "${SCRIPT_DIR}/logs/laika-pwa.log" ]]; then
            tail -10 "${SCRIPT_DIR}/logs/laika-pwa.log"
        else
            echo "No log file found"
        fi
    else
        echo -e "Service: ${RED}Not installed${NC}"
    fi
}

# Function to show logs
show_logs() {
    echo -e "${BLUE}📋 LAIKA PWA Service Logs${NC}"
    echo "================================"
    
    if [[ -f "${SCRIPT_DIR}/logs/laika-pwa.log" ]]; then
        tail -f "${SCRIPT_DIR}/logs/laika-pwa.log"
    else
        echo "No log file found"
    fi
}

# Function to uninstall service
uninstall_service() {
    echo -e "${YELLOW}🗑️  Uninstalling LAIKA PWA service...${NC}"
    
    if service_running; then
        stop_service
    fi
    
    if service_exists; then
        unload_service
    fi
    
    if [[ -f "${PLIST_FILE}" ]]; then
        rm -f "${PLIST_FILE}"
        echo -e "${GREEN}✅ Service file removed${NC}"
    fi
    
    echo -e "${GREEN}✅ Service uninstalled${NC}"
}

# Main script logic
case "${1:-install}" in
    "install")
        if [[ -f "${PLIST_FILE}" ]]; then
            echo -e "${YELLOW}⚠️  Service already exists. Use 'restart' or 'reinstall'${NC}"
            exit 1
        fi
        
        install_service
        start_service
        show_status
        ;;
    
    "start")
        if [[ ! -f "${PLIST_FILE}" ]]; then
            echo -e "${RED}❌ Service not installed. Run 'install' first${NC}"
            exit 1
        fi
        start_service
        ;;
    
    "stop")
        if [[ ! -f "${PLIST_FILE}" ]]; then
            echo -e "${RED}❌ Service not installed${NC}"
            exit 1
        fi
        stop_service
        ;;
    
    "restart")
        if [[ ! -f "${PLIST_FILE}" ]]; then
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
    
    "load")
        if [[ ! -f "${PLIST_FILE}" ]]; then
            echo -e "${RED}❌ Service not installed. Run 'install' first${NC}"
            exit 1
        fi
        load_service
        ;;
    
    "unload")
        if [[ ! -f "${PLIST_FILE}" ]]; then
            echo -e "${RED}❌ Service not installed${NC}"
            exit 1
        fi
        unload_service
        ;;
    
    "uninstall")
        uninstall_service
        ;;
    
    "reinstall")
        uninstall_service
        install_service
        start_service
        show_status
        ;;
    
    *)
        echo -e "${BLUE}Usage: $0 {install|start|stop|restart|status|logs|load|unload|uninstall|reinstall}${NC}"
        echo ""
        echo "Commands:"
        echo "  install    - Install and start the service"
        echo "  start      - Start the service"
        echo "  stop       - Stop the service"
        echo "  restart    - Restart the service"
        echo "  status     - Show service status and recent logs"
        echo "  logs       - Show live service logs"
        echo "  load       - Load the service"
        echo "  unload     - Unload the service"
        echo "  uninstall  - Remove the service"
        echo "  reinstall  - Reinstall the service"
        exit 1
        ;;
esac
