# LAIKA PWA - Enhanced Robot Controller

A Progressive Web App (PWA) for controlling the LAIKA robot with advanced features including camera streaming and SLAM mapping.

## 🌟 Features

### Core Features
- **BLE WiFi Provisioning**: Connect to LAIKA via Bluetooth and configure WiFi
- **Robot Control**: Full control over robot movements, poses, and behaviors
- **PWA Support**: Install as a native app on mobile devices

### Advanced Features (WiFi Required)
- **📹 Live Camera Feed**: Real-time camera streaming from LAIKA
- **🗺️ SLAM Mapping**: View and interact with SLAM navigation maps
- **🤖 Robot Pose Tracking**: Real-time robot position and orientation
- **🔄 Auto-refresh**: Automatic map updates and pose tracking

## 🚀 Quick Start

### 1. Start the Backend Server

```bash
cd LAIKA/laika-pwa
./start_server.sh
```

The server will be available at `http://0.0.0.0:5000`

### 2. Access the PWA

Open your browser and navigate to:
- **Local**: `http://localhost:5000`
- **Network**: `http://[LAIKA_IP]:5000`

### 3. Connect to LAIKA

1. Click "Find LAIKA" to scan for the robot
2. Connect via Bluetooth
3. Configure WiFi settings
4. Once WiFi is connected, advanced features become available

## 📱 PWA Installation

### iOS (Safari)
1. Open the PWA in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. The app will now appear on your home screen

### Android (Chrome)
1. Open the PWA in Chrome
2. Tap the menu (three dots)
3. Select "Add to Home screen"
4. The app will now appear on your home screen

## 🔧 Advanced Features

### Camera Feed
- **Start Camera**: Begin live video streaming
- **Stop Camera**: End video streaming
- **Real-time**: 30 FPS video feed from LAIKA's camera

### SLAM Mapping
- **Refresh Map**: Manually update the SLAM map
- **Auto Refresh**: Automatically update map every 5 seconds
- **Robot Position**: Real-time tracking of LAIKA's position
- **Map Resolution**: Display current map resolution

### Robot Control
- **Basic Movements**: Stand, sit, lie down, go home
- **Directional Control**: Forward, backward, turn left/right
- **Interactive Actions**: Bow, wave, shake hands, nod
- **Performance Mode**: Dance, moonwalk, boxing, push-ups
- **Sports Mode**: Kick ball, stretch, greeting
- **Pose Control**: Adjust height, pitch, and roll
- **LED Control**: Red, green, blue lights, lights off
- **Emergency Controls**: Stop and reset

## 🏗️ Architecture

### Frontend (PWA)
- **HTML5**: Modern web standards
- **CSS3**: TRON-inspired cyberpunk aesthetic
- **JavaScript**: ES6+ with async/await
- **Web Bluetooth**: BLE communication
- **Service Worker**: Offline support

### Backend (Flask Server)
- **Flask**: Python web framework
- **OpenCV**: Camera processing
- **ROS2 Integration**: Robot communication
- **SLAM Processing**: Map generation and updates

### Communication Flow
```
PWA (Browser) ←→ Flask Server ←→ ROS2 ←→ LAIKA Robot
     ↓              ↓              ↓
  BLE/WiFi      Camera/SLAM    Robot Control
```

## 📋 Requirements

### Server Requirements
- Python 3.8+
- OpenCV
- Flask
- ROS2 (optional, for real robot data)
- Camera hardware (optional)

### Browser Requirements
- Chrome/Edge (for Web Bluetooth)
- Safari (iOS PWA support)
- HTTPS or localhost (for PWA features)

## 🔌 API Endpoints

### Status
- `GET /api/status` - System status

### Camera
- `GET /api/camera/stream` - Live camera feed
- `POST /api/camera/start` - Start camera
- `POST /api/camera/stop` - Stop camera

### SLAM
- `GET /api/slam/map` - Get SLAM map
- `GET /api/slam/pose` - Get robot pose

### Robot Control
- `POST /api/robot/command` - Send robot command

## 🛠️ Development

### Running in Development Mode
```bash
cd LAIKA/laika-pwa
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 server.py
```

### File Structure
```
laika-pwa/
├── index.html          # Main PWA interface
├── js/
│   ├── app.js         # Main application logic
│   └── ble-improv.js  # BLE Improv protocol
├── server.py          # Flask backend server
├── requirements.txt   # Python dependencies
├── start_server.sh    # Startup script
└── README.md         # This file
```

### Customization
- **Styling**: Modify CSS variables in `index.html`
- **Features**: Add new controls in `app.js`
- **Backend**: Extend `server.py` with new endpoints
- **BLE**: Modify `ble-improv.js` for custom protocols

## 🐛 Troubleshooting

### Common Issues

**BLE Connection Fails**
- Ensure LAIKA is in pairing mode
- Check browser supports Web Bluetooth
- Try refreshing the page

**Camera Not Working**
- Verify WiFi connection is established
- Check camera hardware is connected
- Ensure server is running

**SLAM Map Not Loading**
- Confirm ROS2 is running (if using real robot)
- Check SLAM nodes are active
- Verify network connectivity

**PWA Not Installing**
- Use HTTPS or localhost
- Clear browser cache
- Check browser supports PWA

### Debug Mode
Enable browser developer tools to see detailed logs:
```javascript
// In browser console
localStorage.setItem('debug', 'true');
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is part of the PuppyPi ecosystem. See the main repository for license information.

## 🙏 Acknowledgments

- BLE Improv protocol for WiFi provisioning
- ROS2 community for robot middleware
- OpenCV for computer vision capabilities
- Flask for web framework
