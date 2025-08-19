# 🐕 LAIKA Controller PWA

A comprehensive Progressive Web Application for controlling and monitoring LAIKA robots anywhere in the world.

## 🌟 Features

### 🌍 Global Connectivity
- **Worldwide Access**: Connect to LAIKA from anywhere in the world via registered IP addresses
- **Smart Connection Priority**: Automatically tries registered devices first, then falls back to local BLE discovery
- **Device Registry**: Global registry system that tracks all LAIKA devices and their network locations
- **Multi-Connection Support**: Supports both WiFi/Network and Bluetooth Low Energy connections

### 🤖 Complete Robot Control
- **Comprehensive Action Library**: Over 80+ robot actions across 9 categories
  - Basic Movement (sit, stand, walk, turn)
  - Interactive Actions (wave, bow, shake hands)
  - Performance Mode (dance, moonwalk, boxing, push-ups)
  - Sports Actions (kick ball, stretch, play)
  - LED Control (colors, patterns, effects)
  - Camera & Vision (photo capture, scene analysis)
  - Behavior Modes (greeting, guard, play modes)
  - System Commands (status, calibration, updates)
  - Emergency Controls (stop, halt, safe mode)

### 📹 Live Camera Feed
- **Real-time Streaming**: See what LAIKA sees through her camera
- **Scene Analysis**: AI-powered scene description and object recognition
- **Photo Capture**: Take photos remotely and view them instantly
- **Vision Commands**: "What do you see?" functionality

### 🗺️ SLAM Mapping & Navigation
- **Live Map Viewer**: Real-time SLAM map visualization
- **Robot Position Tracking**: See LAIKA's current location on the map
- **Navigation Commands**: Send LAIKA to specific locations
- **Map History**: Browse previous mapping sessions
- **Auto-refresh**: Continuous map updates during exploration

### 📊 System Monitoring
- **Live System Status**: Battery level, WiFi status, sensor health
- **Log Browsing**: View system logs, action history, and error reports
- **Performance Metrics**: Monitor CPU, memory, and network usage
- **Diagnostic Tools**: Built-in system diagnostics and troubleshooting

### 🔧 Advanced Features
- **WiFi Provisioning**: Configure LAIKA's WiFi settings via BLE
- **OTA Updates**: Over-the-air software updates
- **Sequence Programming**: Create and execute custom action sequences
- **Voice Command Integration**: Send voice commands remotely
- **Multi-Device Support**: Manage multiple LAIKA robots from one interface

## 🏗️ Architecture

### Frontend (PWA)
```
LAIKA PWA
├── HTML5 Interface (Cyberpunk/TRON aesthetic)
├── Service Worker (Offline support)
├── Web Bluetooth API (Local BLE connection)
├── WebSocket Client (Network communication)
├── Camera Streaming (WebRTC/HTTP streaming)
└── Progressive Web App Features
```

### Backend Services
```
LAIKA Robot
├── Registration Service (Auto-register with PWA)
├── WebSocket Server (Real-time communication)
├── HTTP API Server (REST endpoints)
├── Camera Service (Live streaming)
├── SLAM Interface (Map generation)
└── WiFi Provisioning (BLE setup)
```

### Communication Flow
```
PWA → Device Registry → LAIKA Robot
 ↓         ↓              ↓
BLE    IP Address    WebSocket/HTTP
 ↓         ↓              ↓
WiFi   Network Conn   Camera/SLAM
```

## 🚀 Getting Started

### Prerequisites
- Modern web browser with Web Bluetooth support (Chrome, Edge)
- HTTPS connection or localhost for PWA features
- LAIKA robot with network connectivity

### Installation
1. **Access the PWA**: Navigate to `https://dcmcshan.github.io/laika-pwa/`
2. **Install App**: Click "Install LAIKA Controller" when prompted
3. **Connect to LAIKA**: 
   - PWA will automatically search for registered LAIKA devices
   - If none found, use BLE discovery to find local devices
   - Configure WiFi if needed

### Connection Methods

#### Method 1: Registered Device (Preferred)
1. LAIKA automatically registers when connecting to WiFi
2. PWA discovers registered devices globally
3. Connect directly via IP address

#### Method 2: Local BLE Discovery
1. Click "Find LAIKA" 
2. Select LAIKA from BLE scan results
3. Configure WiFi settings if needed
4. LAIKA registers automatically after WiFi connection

#### Method 3: Manual IP Connection
1. Enter LAIKA's IP address directly
2. Connect via WebSocket or HTTP

## 📱 Usage Guide

### Basic Robot Control
1. **Connect** to LAIKA using any method above
2. **Navigate** to the Control Panel
3. **Select Actions** from organized categories:
   - Basic Movement: Sit, stand, walk, turn
   - Interactive: Wave, bow, shake hands
   - Performance: Dance, moonwalk, boxing
   - And many more...

### Camera & Vision
1. **Enable Camera**: Click "Start Camera" in advanced features
2. **View Live Feed**: Real-time streaming from LAIKA's camera
3. **Take Photos**: Capture images remotely
4. **Scene Analysis**: Ask "What do you see?" for AI descriptions

### SLAM Mapping
1. **Start Mapping**: LAIKA automatically maps as she moves
2. **View Map**: Real-time SLAM visualization
3. **Navigation**: Send LAIKA to specific map locations
4. **Auto-refresh**: Enable continuous map updates

### System Monitoring
1. **Status Dashboard**: View battery, WiFi, sensors
2. **Log Browser**: Access system logs and history
3. **Diagnostics**: Run system health checks
4. **Updates**: Install software updates remotely

## 🔧 API Endpoints

### Device Registry
```http
GET /api/devices/laika          # List all LAIKA devices
GET /api/devices/{device_id}    # Get specific device info
POST /api/register              # Register new device
```

### Robot Control
```http
POST /api/robot/command         # Send robot command
GET /api/robot/status           # Get robot status
GET /api/robot/battery          # Battery information
```

### Camera & Vision
```http
GET /api/camera/stream          # Live camera feed
POST /api/camera/capture        # Take photo
POST /api/vision/analyze        # Analyze scene
```

### SLAM & Navigation
```http
GET /api/slam/map               # Get current map
GET /api/slam/pose              # Robot position
POST /api/navigation/goto       # Navigate to position
```

### System Management
```http
GET /api/system/logs            # System logs
GET /api/system/diagnostics     # Run diagnostics
POST /api/system/update         # Software update
```

## 🎮 Control Interface

### Action Categories
- **🚶 Basic Movement**: Essential locomotion controls
- **🤝 Interactive**: Social and greeting behaviors  
- **🎭 Performance**: Entertainment and dance routines
- **⚽ Sports**: Athletic activities and games
- **💡 LED Control**: Lighting effects and colors
- **📹 Camera & Vision**: Visual perception and capture
- **🎭 Behavior Modes**: Personality and mode settings
- **⚙️ System**: Maintenance and configuration
- **🚨 Emergency**: Safety and emergency controls

### Advanced Features
- **Sequence Programming**: Chain multiple actions together
- **Voice Integration**: Send voice commands remotely
- **Custom Routines**: Create personalized behavior patterns
- **Scheduling**: Automate actions based on time/conditions

## 🌐 Global Registry System

### How It Works
1. **Auto-Registration**: LAIKA registers automatically when connecting to WiFi
2. **Global Discovery**: PWA can find LAIKA devices worldwide
3. **IP Tracking**: Maintains current IP addresses and network status
4. **Health Monitoring**: Tracks device availability and status

### Registry Features
- **Device Status**: Online/offline status with last seen timestamps
- **Network Information**: Current WiFi network and IP addresses
- **Service Discovery**: Available services (WebSocket, Camera, SLAM)
- **Connection Priority**: Smart connection ordering for best performance

## 🔒 Security Features

### Connection Security
- **HTTPS Required**: Secure communication for PWA features
- **WebSocket Security**: Encrypted WebSocket connections
- **Device Authentication**: Device ID verification
- **Network Isolation**: Secure network communication

### Privacy Protection
- **Local Processing**: Camera analysis can be done locally
- **Encrypted Storage**: Secure credential storage
- **Access Control**: Device-level access permissions
- **Audit Logging**: Connection and command logging

## 📊 System Requirements

### Browser Support
- **Chrome/Chromium**: Full feature support
- **Microsoft Edge**: Full feature support
- **Safari**: Limited (no Web Bluetooth)
- **Firefox**: Limited (no Web Bluetooth)

### Network Requirements
- **HTTPS**: Required for PWA and Web Bluetooth
- **WebSocket Support**: For real-time communication
- **Port Access**: 8765 (WebSocket), 5000 (HTTP), 8888 (Registry)

### LAIKA Requirements
- **WiFi Connectivity**: For network-based features
- **Bluetooth LE**: For initial setup and local connection
- **Camera Module**: For vision features (optional)
- **LIDAR/Sensors**: For SLAM mapping (optional)

## 🛠️ Development

### File Structure
```
laika-pwa/
├── index.html                 # Main PWA interface
├── manifest.json             # PWA manifest
├── sw.js                     # Service worker
├── js/
│   ├── app.js               # Main application logic
│   ├── laika-actions.js     # Robot action definitions
│   ├── ble-improv.js        # BLE WiFi provisioning
│   ├── network-scanner.js   # Network device discovery
│   └── version.js           # Build version info
├── css/
│   └── styles.css           # Cyberpunk/TRON styling
└── README.md               # This file
```

### Building & Deployment
```bash
# Clone repository
git clone https://github.com/dcmcshan/laika-pwa.git
cd laika-pwa

# Serve locally for development
python3 -m http.server 8080

# Or use any static file server
npx serve .
```

### Contributing
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🐛 Troubleshooting

### Connection Issues
- **BLE Not Working**: Ensure HTTPS and compatible browser
- **Network Connection Failed**: Check LAIKA's IP address and network
- **Registry Empty**: Wait for LAIKA to register after WiFi connection

### Camera Problems
- **No Video Feed**: Check camera permissions and network connection
- **Poor Quality**: Adjust streaming settings in LAIKA configuration
- **Lag Issues**: Reduce frame rate or resolution

### SLAM Issues
- **Map Not Loading**: Ensure SLAM service is running on LAIKA
- **Position Inaccurate**: Recalibrate LIDAR sensors
- **Map Outdated**: Enable auto-refresh or manually refresh

## 📈 Roadmap

### Planned Features
- [ ] **Multi-Robot Control**: Manage fleets of LAIKA robots
- [ ] **AR Integration**: Augmented reality overlay for camera feed
- [ ] **Voice Control**: Direct voice commands through PWA
- [ ] **Cloud Sync**: Synchronize settings across devices
- [ ] **Analytics Dashboard**: Usage statistics and insights
- [ ] **Mobile App**: Native mobile applications
- [ ] **API Gateway**: Centralized API management
- [ ] **Machine Learning**: Behavior learning and adaptation

### Version History
- **v1.0.0**: Initial release with basic control
- **v1.1.0**: Added camera streaming and SLAM viewer
- **v1.2.0**: Global registry and worldwide connectivity
- **v1.3.0**: Enhanced action library and sequences
- **v2.0.0**: Complete system monitoring and logs (planned)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **PuppyPi Community**: Hardware platform and inspiration
- **Web Bluetooth Community**: BLE implementation guidance
- **Progressive Web App Standards**: Modern web capabilities
- **TRON/Cyberpunk Aesthetic**: Visual design inspiration

## 📞 Support

For support and questions:
- **Issues**: [GitHub Issues](https://github.com/dcmcshan/laika-pwa/issues)
- **Discussions**: [GitHub Discussions](https://github.com/dcmcshan/laika-pwa/discussions)
- **Documentation**: [Wiki](https://github.com/dcmcshan/laika-pwa/wiki)

---

**Made with ❤️ for the LAIKA robot community**

*Control your robot companion from anywhere in the world with the power of modern web technology.*