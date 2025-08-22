# LAIKA PWA Service Setup

This document explains how to set up the LAIKA PWA server as a system service so it automatically starts and restarts.

## Overview

The LAIKA PWA server can be run as a system service using:
- **Linux (Raspberry Pi)**: systemd service
- **macOS**: launchd service

## Benefits of Running as a Service

- ✅ **Auto-start**: Server starts automatically when the system boots
- ✅ **Auto-restart**: Server restarts automatically if it crashes
- ✅ **Background operation**: Runs in the background without terminal
- ✅ **Logging**: Automatic log rotation and management
- ✅ **Easy management**: Simple commands to start/stop/restart

## Linux (Raspberry Pi) Setup

### 1. Install the Service

```bash
# Navigate to the laika-pwa directory
cd /home/pi/LAIKA/laika-pwa

# Install the service (requires sudo)
sudo ./setup_service.sh install
```

### 2. Manage the Service

```bash
# Check service status
sudo ./setup_service.sh status

# Start the service
sudo ./setup_service.sh start

# Stop the service
sudo ./setup_service.sh stop

# Restart the service
sudo ./setup_service.sh restart

# View live logs
sudo ./setup_service.sh logs

# Uninstall the service
sudo ./setup_service.sh uninstall
```

### 3. Service Details

- **Service Name**: `laika-pwa`
- **Port**: 8081
- **User**: pi
- **Working Directory**: `/home/pi/LAIKA/laika-pwa`
- **Logs**: `journalctl -u laika-pwa`

## macOS Setup

### 1. Install the Service

```bash
# Navigate to the laika-pwa directory
cd /Users/yourusername/GitHub/PuppyPi/LAIKA/laika-pwa

# Install the service
./setup_macos_service.sh install
```

### 2. Manage the Service

```bash
# Check service status
./setup_macos_service.sh status

# Start the service
./setup_macos_service.sh start

# Stop the service
./setup_macos_service.sh stop

# Restart the service
./setup_macos_service.sh restart

# View live logs
./setup_macos_service.sh logs

# Uninstall the service
./setup_macos_service.sh uninstall
```

### 3. Service Details

- **Service Name**: `com.laika.pwa`
- **Port**: 8081
- **User**: Current user
- **Working Directory**: `/Users/yourusername/GitHub/PuppyPi/LAIKA/laika-pwa`
- **Logs**: `~/Library/Logs/laika-pwa.log`

## Manual Service Management

### Linux (systemd)

```bash
# Check status
sudo systemctl status laika-pwa

# Start service
sudo systemctl start laika-pwa

# Stop service
sudo systemctl stop laika-pwa

# Enable auto-start
sudo systemctl enable laika-pwa

# Disable auto-start
sudo systemctl disable laika-pwa

# View logs
sudo journalctl -u laika-pwa -f
```

### macOS (launchd)

```bash
# Check status
launchctl list | grep com.laika.pwa

# Load service
launchctl load ~/Library/LaunchAgents/com.laika.pwa.plist

# Unload service
launchctl unload ~/Library/LaunchAgents/com.laika.pwa.plist

# Start service
launchctl start com.laika.pwa

# Stop service
launchctl stop com.laika.pwa
```

## Troubleshooting

### Service Won't Start

1. **Check logs**:
   ```bash
   # Linux
   sudo journalctl -u laika-pwa -n 50
   
   # macOS
   tail -50 ~/Library/Logs/laika-pwa.log
   ```

2. **Check file permissions**:
   ```bash
   # Make sure the script is executable
   chmod +x tron_server.py
   ```

3. **Check Python environment**:
   ```bash
   # Verify virtual environment
   source /home/pi/LAIKA/venv/bin/activate  # Linux
   source ~/GitHub/PuppyPi/LAIKA/venv/bin/activate  # macOS
   ```

### Port Already in Use

If port 8081 is already in use:

```bash
# Find what's using the port
sudo lsof -i :8081  # Linux
lsof -i :8081       # macOS

# Kill the process
sudo kill -9 <PID>
```

### Service Configuration

The service files are located at:
- **Linux**: `/etc/systemd/system/laika-pwa.service`
- **macOS**: `~/Library/LaunchAgents/com.laika.pwa.plist`

You can edit these files to modify:
- Working directory
- Environment variables
- Restart behavior
- Log locations

## Accessing the PWA

Once the service is running, you can access the LAIKA PWA at:

- **Local**: http://localhost:8081
- **Network**: http://your-ip-address:8081
- **3D Viewer**: http://localhost:8081/3d

## Development vs Production

For development, you can still run the server manually:

```bash
# Manual start (development)
python3 tron_server.py

# Service start (production)
sudo ./setup_service.sh start  # Linux
./setup_macos_service.sh start # macOS
```

## Security Notes

- The service runs with the user's permissions
- Logs are stored locally
- The server binds to all interfaces (0.0.0.0)
- Consider firewall rules for production use
