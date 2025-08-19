# 🎮 LAIKA PWA Demo Guide

## 🚀 Live Demo

**Access the LAIKA PWA at: [https://dcmcshan.github.io/laika-pwa/](https://dcmcshan.github.io/laika-pwa/)**

## 🧪 Testing with Demo API

### Quick Start
1. **Start Demo API Server**:
   ```bash
   cd laika-pwa
   python3 demo-api.py
   ```
   Server runs on `http://localhost:5001`

2. **Open PWA**: Navigate to [https://dcmcshan.github.io/laika-pwa/](https://dcmcshan.github.io/laika-pwa/)

3. **Test Connection**: The PWA will automatically discover the demo LAIKA device

## 🎯 Demo Features

### 🌍 Global Device Discovery
- PWA automatically checks for registered LAIKA devices
- Demo device appears in global registry
- Smart connection priority: Registry → Network → BLE

### 🤖 Robot Control Testing
Test all 80+ robot actions across categories:

**Basic Movement**:
```bash
curl -X POST http://localhost:5001/api/robot/command \
  -H "Content-Type: application/json" \
  -d '{"command": "sit"}'

curl -X POST http://localhost:5001/api/robot/command \
  -H "Content-Type: application/json" \
  -d '{"command": "dance"}'
```

**LED Control**:
```bash
curl -X POST http://localhost:5001/api/robot/command \
  -H "Content-Type: application/json" \
  -d '{"command": "red_light"}'
```

**Performance Actions**:
```bash
curl -X POST http://localhost:5001/api/robot/command \
  -H "Content-Type: application/json" \
  -d '{"command": "moonwalk"}'
```

### 📹 Camera Feed Testing
```bash
# Start camera
curl -X POST http://localhost:5001/api/camera/start

# View live stream at: http://localhost:5001/api/camera/stream

# Capture photo
curl -X POST http://localhost:5001/api/camera/capture

# Stop camera  
curl -X POST http://localhost:5001/api/camera/stop
```

### 🗺️ SLAM Map Testing
```bash
# Get current map
curl http://localhost:5001/api/slam/map

# Get robot position
curl http://localhost:5001/api/slam/pose

# Navigate to position
curl -X POST http://localhost:5001/api/navigation/goto \
  -H "Content-Type: application/json" \
  -d '{"x": 3.0, "y": 2.0}'
```

### 📊 System Monitoring
```bash
# Get robot status
curl http://localhost:5001/api/robot/status

# Get system logs
curl http://localhost:5001/api/system/logs

# Run diagnostics
curl http://localhost:5001/api/system/diagnostics

# Trigger system update
curl -X POST http://localhost:5001/api/system/update \
  -H "Content-Type: application/json" \
  -d '{"type": "software"}'
```

## 🎪 Interactive PWA Testing

### 1. Device Discovery
- Open PWA → Automatically finds demo device
- Shows in "Global LAIKA Registry" section
- Displays online status and network info

### 2. Robot Control
- Navigate to Control Panel
- Try different action categories:
  - **Basic Movement**: Sit, Stand, Dance, Wave
  - **LED Control**: Red, Green, Blue lights
  - **Performance**: Moonwalk, Boxing, Push-ups
  - **Emergency**: Emergency Stop, Reset

### 3. Camera Feed
- Enable "Advanced Features" 
- Click "Start Camera"
- View live demo feed with moving robot indicator
- Capture photos and view them

### 4. SLAM Mapping
- Click "SLAM Map" to view live map
- Enable "Auto Refresh" for continuous updates
- Watch robot position move during navigation
- View map resolution and timestamps

### 5. System Monitoring
- Check battery level and system status
- View command history and execution logs
- Monitor WiFi connection status
- Run system diagnostics

## 🔧 API Endpoints Reference

### Device Registry
- `GET /api/devices/laika` - List registered LAIKA devices

### Robot Control  
- `POST /api/robot/command` - Execute robot commands
- `GET /api/robot/status` - Get current robot status

### Camera System
- `GET /api/camera/stream` - Live camera feed (MJPEG)
- `POST /api/camera/start` - Start camera streaming
- `POST /api/camera/stop` - Stop camera streaming  
- `POST /api/camera/capture` - Capture single photo

### SLAM & Navigation
- `GET /api/slam/map` - Get current SLAM map (Base64 PNG)
- `GET /api/slam/pose` - Get robot position and orientation
- `POST /api/navigation/goto` - Navigate to coordinates

### System Management
- `GET /api/system/logs` - Get system logs with filtering
- `GET /api/system/diagnostics` - Run system health checks
- `POST /api/system/update` - Initiate software updates

### Health & Status
- `GET /health` - API health check
- `GET /` - API documentation and available endpoints

## 🎮 Demo Scenarios

### Scenario 1: First Time User
1. Open PWA on mobile/desktop
2. PWA discovers demo LAIKA automatically  
3. Connect with one click
4. Explore basic movements (sit, stand, wave)
5. Try LED controls and see visual feedback

### Scenario 2: Advanced Control
1. Access comprehensive action library
2. Test performance modes (dance, moonwalk)
3. Use emergency controls and safety features
4. Create action sequences
5. Monitor system status and logs

### Scenario 3: Remote Monitoring
1. Enable camera feed
2. View live streaming from LAIKA's perspective
3. Navigate using SLAM map
4. Monitor battery and system health
5. Capture photos remotely

### Scenario 4: System Administration  
1. Review system logs and command history
2. Run diagnostic checks
3. Monitor resource usage
4. Initiate software updates
5. Configure system settings

## 🐛 Troubleshooting

### PWA Not Connecting
- Ensure demo API is running on port 5001
- Check browser console for CORS errors
- Verify HTTPS for PWA features

### Camera Feed Issues
- Start camera via API: `POST /api/camera/start`
- Check stream URL: `http://localhost:5001/api/camera/stream`
- Ensure browser supports MJPEG streams

### SLAM Map Not Loading
- Verify map endpoint: `GET /api/slam/map`
- Check for Base64 image data in response
- Ensure PNG format compatibility

## 📱 PWA Installation

### Desktop (Chrome/Edge)
1. Click install button in address bar
2. Or use "Install LAIKA Controller" banner
3. App appears as native application

### Mobile (iOS/Android)
1. Open PWA in browser
2. Add to Home Screen option
3. Launches as native app experience

## 🎉 Demo Highlights

### Key Demonstrations
- **Global Connectivity**: Show worldwide device discovery
- **Comprehensive Control**: 80+ robot actions organized by category  
- **Live Monitoring**: Real-time camera, maps, and system status
- **Smart Connection**: Automatic device discovery and connection
- **Native Experience**: PWA with offline support and install prompts
- **Safety Features**: Emergency controls and dangerous action confirmations
- **System Management**: Logs, diagnostics, and OTA updates

### Performance Features
- **Real-time Updates**: WebSocket communication for instant feedback
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Offline Support**: Service worker caching for offline use
- **Progressive Enhancement**: Graceful degradation across browsers
- **Security**: HTTPS required, secure communication protocols

---

**🚀 The LAIKA PWA demonstrates the future of robot control - worldwide connectivity, comprehensive control, and native app experience through modern web technology!**




