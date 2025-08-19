#!/usr/bin/env python3
"""
LAIKA PWA Demo API Server
RESTful API for testing and demonstrating LAIKA PWA functionality
"""

import os
import sys
import json
import time
import random
import logging
from datetime import datetime, timezone
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import threading
import base64
from PIL import Image, ImageDraw, ImageFont
import io
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Demo state
demo_state = {
    "device_id": "LAIKA-DEMO-001",
    "device_name": "LAIKA Demo Robot",
    "connected": False,
    "battery_level": 85,
    "wifi_connected": True,
    "wifi_ssid": "Demo Network",
    "local_ip": "192.168.1.100",
    "public_ip": "203.0.113.42",
    "camera_active": False,
    "slam_active": False,
    "current_action": None,
    "led_color": "off",
    "pose": {"height": -10, "pitch": 0, "roll": 0},
    "position": {"x": 2.5, "y": 1.8, "theta": 45},
    "last_command": None,
    "command_history": [],
    "system_logs": [
        {"timestamp": "2024-01-20T10:30:00Z", "level": "INFO", "message": "LAIKA Demo API started", "category": "system"},
        {"timestamp": "2024-01-20T10:29:45Z", "level": "INFO", "message": "WiFi connected to Demo Network", "category": "network"},
        {"timestamp": "2024-01-20T10:29:30Z", "level": "INFO", "message": "System initialization complete", "category": "system"},
        {"timestamp": "2024-01-20T10:29:15Z", "level": "INFO", "message": "Camera module initialized", "category": "camera"},
        {"timestamp": "2024-01-20T10:29:10Z", "level": "INFO", "message": "SLAM service started", "category": "slam"},
        {"timestamp": "2024-01-20T10:29:05Z", "level": "INFO", "message": "Robot controller ready", "category": "robot"},
        {"timestamp": "2024-01-20T10:29:00Z", "level": "INFO", "message": "PWA registration service started", "category": "pwa"},
        {"timestamp": "2024-01-20T10:28:55Z", "level": "DEBUG", "message": "Loading robot action definitions", "category": "robot"},
        {"timestamp": "2024-01-20T10:28:50Z", "level": "INFO", "message": "WebSocket server listening on port 8765", "category": "network"},
        {"timestamp": "2024-01-20T10:28:45Z", "level": "INFO", "message": "HTTP API server listening on port 5000", "category": "network"},
        {"timestamp": "2024-01-20T10:28:40Z", "level": "WARN", "message": "Battery level below 90%, currently at 85%", "category": "power"},
        {"timestamp": "2024-01-20T10:28:35Z", "level": "INFO", "message": "Servo calibration complete", "category": "robot"},
        {"timestamp": "2024-01-20T10:28:30Z", "level": "DEBUG", "message": "IMU sensor calibrated", "category": "sensors"},
        {"timestamp": "2024-01-20T10:28:25Z", "level": "INFO", "message": "LIDAR sensor initialized", "category": "sensors"},
        {"timestamp": "2024-01-20T10:28:20Z", "level": "ERROR", "message": "Failed to connect to voice service, retrying...", "category": "voice"},
        {"timestamp": "2024-01-20T10:28:15Z", "level": "INFO", "message": "Voice recognition service started", "category": "voice"},
        {"timestamp": "2024-01-20T10:28:10Z", "level": "DEBUG", "message": "Loading neural network models", "category": "ai"},
        {"timestamp": "2024-01-20T10:28:05Z", "level": "INFO", "message": "Boot sequence completed successfully", "category": "system"}
    ]
}

def generate_demo_camera_frame():
    """Generate a demo camera frame"""
    # Create a 640x480 image
    img = Image.new('RGB', (640, 480), color='lightblue')
    draw = ImageDraw.Draw(img)
    
    # Add some demo elements
    draw.rectangle([50, 50, 590, 430], outline='darkblue', width=3)
    
    # Add timestamp
    timestamp = datetime.now().strftime("%H:%M:%S")
    draw.text((60, 60), f"LAIKA Demo Camera Feed", fill='darkblue')
    draw.text((60, 90), f"Time: {timestamp}", fill='darkblue')
    
    # Add some moving elements
    t = time.time()
    x = int(320 + 100 * np.sin(t))
    y = int(240 + 50 * np.cos(t))
    draw.ellipse([x-20, y-20, x+20, y+20], fill='red')
    draw.text((x-15, y-5), "🤖", fill='white')
    
    # Add status info
    draw.text((60, 400), f"Battery: {demo_state['battery_level']}%", fill='green')
    draw.text((60, 420), f"Position: ({demo_state['position']['x']:.1f}, {demo_state['position']['y']:.1f})", fill='green')
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='JPEG', quality=80)
    img_data = buffer.getvalue()
    
    return base64.b64encode(img_data).decode('utf-8')

def generate_demo_slam_map():
    """Generate a demo SLAM map"""
    # Create a 800x600 map image
    img = Image.new('RGB', (800, 600), color='gray')
    draw = ImageDraw.Draw(img)
    
    # Draw some walls (black)
    draw.rectangle([100, 100, 200, 300], fill='black')  # Wall 1
    draw.rectangle([400, 200, 500, 400], fill='black')  # Wall 2
    draw.ellipse([600, 150, 650, 200], fill='black')    # Round obstacle
    
    # Draw free space (white)
    draw.rectangle([50, 50, 750, 550], outline='white', width=2)
    
    # Draw robot position (green circle)
    robot_x = int(demo_state['position']['x'] * 100 + 200)
    robot_y = int(demo_state['position']['y'] * 100 + 200)
    draw.ellipse([robot_x-10, robot_y-10, robot_x+10, robot_y+10], fill='lime')
    draw.text((robot_x-15, robot_y-25), "LAIKA", fill='lime')
    
    # Draw path (yellow line)
    path_points = [(150, 150), (250, 200), (350, 250), (robot_x, robot_y)]
    for i in range(len(path_points)-1):
        draw.line([path_points[i], path_points[i+1]], fill='yellow', width=2)
    
    # Add grid
    for x in range(0, 800, 50):
        draw.line([(x, 0), (x, 600)], fill='darkgray', width=1)
    for y in range(0, 600, 50):
        draw.line([(0, y), (800, y)], fill='darkgray', width=1)
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_data = buffer.getvalue()
    
    return base64.b64encode(img_data).decode('utf-8')

# Device Registry API
@app.route('/api/devices/laika', methods=['GET'])
def get_laika_devices():
    """Get all LAIKA devices from registry"""
    devices = [{
        "device_id": demo_state["device_id"],
        "device_name": demo_state["device_name"],
        "device_type": "laika_robot",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "network": {
            "wifi_connected": demo_state["wifi_connected"],
            "ssid": demo_state["wifi_ssid"],
            "local_ip": demo_state["local_ip"],
            "public_ip": demo_state["public_ip"]
        },
        "services": {
            "websocket": f"ws://{demo_state['local_ip']}:8765",
            "pwa_server": f"http://{demo_state['local_ip']}:5000",
            "wifi_provisioning": f"http://{demo_state['local_ip']}:8080"
        },
        "capabilities": [
            "robot_control", "camera_streaming", "slam_mapping", 
            "voice_commands", "wifi_provisioning"
        ],
        "location": {
            "last_seen": datetime.now(timezone.utc).isoformat(),
            "network_name": demo_state["wifi_ssid"]
        },
        "pwa_compatible": True,
        "version": "1.0.0"
    }]
    
    return jsonify({
        "success": True,
        "count": len(devices),
        "devices": devices,
        "timestamp": time.time()
    })

# Robot Control API
@app.route('/api/robot/command', methods=['POST'])
def robot_command():
    """Execute robot command"""
    data = request.get_json()
    command = data.get('command')
    params = data.get('params', {})
    
    if not command:
        return jsonify({"success": False, "error": "No command provided"}), 400
    
    # Simulate command execution
    demo_state["last_command"] = {
        "command": command,
        "params": params,
        "timestamp": datetime.now().isoformat()
    }
    
    # Add to command history
    demo_state["command_history"].insert(0, demo_state["last_command"])
    if len(demo_state["command_history"]) > 50:
        demo_state["command_history"] = demo_state["command_history"][:50]
    
    # Add command execution to system logs
    demo_state["system_logs"].insert(0, {
        "timestamp": datetime.now().isoformat(),
        "level": "INFO",
        "message": f"Executed command: {command}",
        "category": "robot"
    })
    
    # Simulate different command effects
    if command in ['sit', 'stand', 'lie_down', 'dance', 'wave', 'bow']:
        demo_state["current_action"] = command
        # Simulate action duration
        threading.Timer(3.0, lambda: setattr(demo_state, 'current_action', None)).start()
    
    elif command.endswith('_light') or command == 'lights_off':
        demo_state["led_color"] = command.replace('_light', '') if command != 'lights_off' else 'off'
    
    elif command == 'take_photo':
        # Simulate photo capture
        demo_state["system_logs"].insert(0, {
            "timestamp": datetime.now().isoformat(),
            "level": "INFO",
            "message": f"Photo captured: demo_photo_{int(time.time())}.jpg"
        })
    
    elif command == 'emergency_stop':
        demo_state["current_action"] = None
        demo_state["led_color"] = 'red'
    
    # Random battery drain
    if random.random() < 0.3:
        demo_state["battery_level"] = max(0, demo_state["battery_level"] - random.randint(1, 3))
    
    logger.info(f"Executed command: {command} with params: {params}")
    
    return jsonify({
        "success": True,
        "message": f"Command '{command}' executed successfully",
        "command": command,
        "params": params,
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/robot/status', methods=['GET'])
def robot_status():
    """Get robot status"""
    return jsonify({
        "success": True,
        "status": {
            "device_id": demo_state["device_id"],
            "device_name": demo_state["device_name"],
            "connected": demo_state["connected"],
            "battery_level": demo_state["battery_level"],
            "wifi_connected": demo_state["wifi_connected"],
            "wifi_ssid": demo_state["wifi_ssid"],
            "current_action": demo_state["current_action"],
            "led_color": demo_state["led_color"],
            "pose": demo_state["pose"],
            "position": demo_state["position"],
            "camera_active": demo_state["camera_active"],
            "slam_active": demo_state["slam_active"],
            "last_command": demo_state["last_command"],
            "timestamp": datetime.now().isoformat()
        }
    })

# Camera API
@app.route('/api/camera/stream', methods=['GET'])
def camera_stream():
    """Camera video stream endpoint"""
    def generate():
        while True:
            if demo_state["camera_active"]:
                # Generate demo frame
                frame_b64 = generate_demo_camera_frame()
                frame_data = base64.b64decode(frame_b64)
                
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_data + b'\r\n')
            else:
                # Send placeholder
                yield (b'--frame\r\n'
                       b'Content-Type: text/plain\r\n\r\n'
                       b'Camera not active\r\n')
            
            time.sleep(0.1)  # 10 FPS
    
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/camera/start', methods=['POST'])
def start_camera():
    """Start camera"""
    demo_state["camera_active"] = True
    demo_state["system_logs"].insert(0, {
        "timestamp": datetime.now().isoformat(),
        "level": "INFO",
        "message": "Camera started"
    })
    return jsonify({"success": True, "message": "Camera started"})

@app.route('/api/camera/stop', methods=['POST'])
def stop_camera():
    """Stop camera"""
    demo_state["camera_active"] = False
    demo_state["system_logs"].insert(0, {
        "timestamp": datetime.now().isoformat(),
        "level": "INFO",
        "message": "Camera stopped"
    })
    return jsonify({"success": True, "message": "Camera stopped"})

@app.route('/api/camera/capture', methods=['POST'])
def capture_photo():
    """Capture a photo"""
    frame_b64 = generate_demo_camera_frame()
    photo_id = f"demo_photo_{int(time.time())}"
    
    demo_state["system_logs"].insert(0, {
        "timestamp": datetime.now().isoformat(),
        "level": "INFO",
        "message": f"Photo captured: {photo_id}.jpg"
    })
    
    return jsonify({
        "success": True,
        "message": "Photo captured",
        "photo_id": photo_id,
        "image_data": f"data:image/jpeg;base64,{frame_b64}"
    })

# SLAM API
@app.route('/api/slam/map', methods=['GET'])
def get_slam_map():
    """Get SLAM map"""
    map_b64 = generate_demo_slam_map()
    
    return jsonify({
        "success": True,
        "map_data": map_b64,
        "resolution": 0.05,
        "width": 800,
        "height": 600,
        "map_name": "Demo SLAM Map",
        "timestamp": int(time.time())
    })

@app.route('/api/slam/pose', methods=['GET'])
def get_robot_pose():
    """Get robot pose"""
    return jsonify({
        "success": True,
        "pose": demo_state["position"]
    })

@app.route('/api/navigation/goto', methods=['POST'])
def navigate_to():
    """Navigate to position"""
    data = request.get_json()
    target_x = data.get('x', 0)
    target_y = data.get('y', 0)
    
    # Simulate movement by gradually updating position
    def move_to_target():
        current_x = demo_state["position"]["x"]
        current_y = demo_state["position"]["y"]
        
        # Simple linear interpolation
        steps = 10
        for i in range(steps):
            progress = (i + 1) / steps
            new_x = current_x + (target_x - current_x) * progress
            new_y = current_y + (target_y - current_y) * progress
            
            demo_state["position"]["x"] = new_x
            demo_state["position"]["y"] = new_y
            time.sleep(0.5)
    
    threading.Thread(target=move_to_target, daemon=True).start()
    
    return jsonify({
        "success": True,
        "message": f"Navigating to ({target_x}, {target_y})",
        "target": {"x": target_x, "y": target_y}
    })

# System API
@app.route('/api/system/logs', methods=['GET'])
def get_system_logs():
    """Get system logs with filtering"""
    limit = request.args.get('limit', 100, type=int)
    level_filter = request.args.get('level', None)  # INFO, DEBUG, WARN, ERROR
    category_filter = request.args.get('category', None)  # system, robot, camera, etc.
    search = request.args.get('search', None)
    
    logs = demo_state["system_logs"]
    
    # Apply filters
    if level_filter:
        logs = [log for log in logs if log.get('level', '').upper() == level_filter.upper()]
    
    if category_filter:
        logs = [log for log in logs if log.get('category', '') == category_filter]
    
    if search:
        logs = [log for log in logs if search.lower() in log.get('message', '').lower()]
    
    # Apply limit
    logs = logs[:limit]
    
    # Get available categories and levels for UI
    all_categories = list(set([log.get('category', 'unknown') for log in demo_state["system_logs"]]))
    all_levels = list(set([log.get('level', 'INFO') for log in demo_state["system_logs"]]))
    
    return jsonify({
        "success": True,
        "logs": logs,
        "count": len(logs),
        "total_logs": len(demo_state["system_logs"]),
        "filters": {
            "available_categories": sorted(all_categories),
            "available_levels": sorted(all_levels),
            "applied_filters": {
                "level": level_filter,
                "category": category_filter,
                "search": search,
                "limit": limit
            }
        }
    })

@app.route('/api/system/logs/live', methods=['GET'])
def get_live_logs():
    """Get live log stream (Server-Sent Events)"""
    def generate_log_stream():
        last_count = len(demo_state["system_logs"])
        while True:
            current_count = len(demo_state["system_logs"])
            if current_count > last_count:
                # New logs available
                new_logs = demo_state["system_logs"][:current_count - last_count]
                for log in reversed(new_logs):  # Send newest first
                    yield f"data: {json.dumps(log)}\n\n"
                last_count = current_count
            time.sleep(1)  # Check for new logs every second
    
    return Response(generate_log_stream(), mimetype='text/event-stream')

@app.route('/api/system/command-history', methods=['GET'])
def get_command_history():
    """Get command execution history"""
    limit = request.args.get('limit', 50, type=int)
    commands = demo_state["command_history"][:limit]
    
    return jsonify({
        "success": True,
        "commands": commands,
        "count": len(commands)
    })

@app.route('/api/system/diagnostics', methods=['GET'])
def system_diagnostics():
    """Run system diagnostics"""
    diagnostics = {
        "cpu_usage": random.randint(10, 80),
        "memory_usage": random.randint(30, 90),
        "disk_usage": random.randint(20, 70),
        "network_latency": random.randint(5, 50),
        "sensors": {
            "camera": "OK",
            "lidar": "OK",
            "imu": "OK",
            "motors": "OK"
        },
        "services": {
            "websocket_server": "Running",
            "camera_service": "Running" if demo_state["camera_active"] else "Stopped",
            "slam_service": "Running",
            "voice_service": "Running"
        },
        "timestamp": datetime.now().isoformat()
    }
    
    return jsonify({
        "success": True,
        "diagnostics": diagnostics
    })

@app.route('/api/system/update', methods=['POST'])
def system_update():
    """Perform system update"""
    data = request.get_json()
    update_type = data.get('type', 'software')
    
    # Simulate update process
    def simulate_update():
        time.sleep(2)
        demo_state["system_logs"].insert(0, {
            "timestamp": datetime.now().isoformat(),
            "level": "INFO",
            "message": f"System {update_type} update completed successfully"
        })
    
    threading.Thread(target=simulate_update, daemon=True).start()
    
    return jsonify({
        "success": True,
        "message": f"System {update_type} update initiated",
        "update_type": update_type
    })

# Health check
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "laika-demo-api",
        "version": "1.0.0",
        "timestamp": time.time(),
        "demo_state": {
            "device_name": demo_state["device_name"],
            "connected": demo_state["connected"],
            "battery": demo_state["battery_level"]
        }
    })

# Root endpoint
@app.route('/', methods=['GET'])
def root():
    """Root endpoint with API documentation"""
    return jsonify({
        "service": "LAIKA PWA Demo API",
        "version": "1.0.0",
        "description": "RESTful API for testing and demonstrating LAIKA PWA functionality",
        "endpoints": {
            "Device Registry": {
                "GET /api/devices/laika": "List all LAIKA devices"
            },
            "Robot Control": {
                "POST /api/robot/command": "Execute robot command",
                "GET /api/robot/status": "Get robot status"
            },
            "Camera": {
                "GET /api/camera/stream": "Live camera feed",
                "POST /api/camera/start": "Start camera",
                "POST /api/camera/stop": "Stop camera",
                "POST /api/camera/capture": "Capture photo"
            },
            "SLAM": {
                "GET /api/slam/map": "Get SLAM map",
                "GET /api/slam/pose": "Get robot pose",
                "POST /api/navigation/goto": "Navigate to position"
            },
            "System": {
                "GET /api/system/logs": "Get system logs",
                "GET /api/system/diagnostics": "System diagnostics",
                "POST /api/system/update": "System update"
            }
        },
        "demo_commands": [
            "sit", "stand", "lie_down", "dance", "wave", "bow",
            "red_light", "green_light", "blue_light", "lights_off",
            "take_photo", "emergency_stop"
        ]
    })

if __name__ == '__main__':
    logger.info("🚀 Starting LAIKA PWA Demo API Server...")
    logger.info(f"Demo device: {demo_state['device_name']} ({demo_state['device_id']})")
    logger.info("Available at: http://localhost:5001")
    logger.info("CORS enabled for PWA testing")
    
    # Set demo device as connected
    demo_state["connected"] = True
    
    app.run(host='0.0.0.0', port=5001, debug=True, threaded=True)
