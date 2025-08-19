#!/usr/bin/env python3
"""
LAIKA Global Registry Server
Publicly accessible service for worldwide LAIKA device discovery
"""

import os
import sys
import json
import time
import logging
from datetime import datetime, timezone, timedelta
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import threading
from collections import defaultdict

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Global device registry
global_registry = {}
registration_stats = defaultdict(int)

# Configuration
DEVICE_TIMEOUT = 300  # 5 minutes - consider device offline after this
CLEANUP_INTERVAL = 60  # Clean up offline devices every minute
MAX_DEVICES = 1000    # Maximum devices to track

def cleanup_offline_devices():
    """Remove devices that haven't been seen recently"""
    current_time = datetime.now(timezone.utc)
    devices_to_remove = []
    
    for device_id, device_data in global_registry.items():
        try:
            last_seen = datetime.fromisoformat(device_data['location']['last_seen'].replace('Z', '+00:00'))
            time_diff = (current_time - last_seen).total_seconds()
            
            if time_diff > DEVICE_TIMEOUT:
                devices_to_remove.append(device_id)
        except Exception as e:
            logger.warning(f"Error checking device {device_id}: {e}")
            devices_to_remove.append(device_id)
    
    for device_id in devices_to_remove:
        logger.info(f"Removing offline device: {device_id}")
        del global_registry[device_id]
        registration_stats['devices_removed'] += 1

def start_cleanup_thread():
    """Start background thread for cleanup"""
    def cleanup_loop():
        while True:
            try:
                cleanup_offline_devices()
                time.sleep(CLEANUP_INTERVAL)
            except Exception as e:
                logger.error(f"Cleanup error: {e}")
                time.sleep(CLEANUP_INTERVAL)
    
    cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
    cleanup_thread.start()
    logger.info("Started cleanup thread")

# Device Registration API
@app.route('/api/register', methods=['POST'])
def register_device():
    """Register a LAIKA device globally"""
    try:
        if len(global_registry) >= MAX_DEVICES:
            return jsonify({
                "success": False,
                "error": "Registry full - maximum devices reached"
            }), 429
        
        data = request.get_json()
        if not data:
            return jsonify({
                "success": False,
                "error": "No data provided"
            }), 400
        
        # Validate required fields
        required_fields = ['device_id', 'device_name', 'device_type']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "success": False,
                    "error": f"Missing required field: {field}"
                }), 400
        
        device_id = data['device_id']
        
        # Get client IP for registration
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        if client_ip:
            client_ip = client_ip.split(',')[0].strip()
        
        # Update device data with registration info
        data['registration_ip'] = client_ip
        data['last_registration'] = datetime.now(timezone.utc).isoformat()
        
        # Ensure location info exists
        if 'location' not in data:
            data['location'] = {}
        data['location']['last_seen'] = datetime.now(timezone.utc).isoformat()
        
        # Store in global registry
        was_new_device = device_id not in global_registry
        global_registry[device_id] = data
        
        if was_new_device:
            registration_stats['new_devices'] += 1
            logger.info(f"New device registered: {data['device_name']} ({device_id}) from {client_ip}")
        else:
            registration_stats['device_updates'] += 1
            logger.info(f"Device updated: {data['device_name']} ({device_id}) from {client_ip}")
        
        registration_stats['total_registrations'] += 1
        
        return jsonify({
            "success": True,
            "message": "Device registered successfully",
            "device_id": device_id,
            "registered_at": data['last_registration'],
            "registry_stats": {
                "total_devices": len(global_registry),
                "was_new_device": was_new_device
            }
        })
        
    except Exception as e:
        logger.error(f"Registration error: {e}")
        return jsonify({
            "success": False,
            "error": "Registration failed"
        }), 500

@app.route('/api/devices/laika', methods=['GET'])
def get_laika_devices():
    """Get all registered LAIKA devices"""
    try:
        # Filter for LAIKA devices only
        laika_devices = []
        current_time = datetime.now(timezone.utc)
        
        for device_id, device_data in global_registry.items():
            if device_data.get('device_type') == 'laika_robot':
                # Check if device is online
                try:
                    last_seen = datetime.fromisoformat(device_data['location']['last_seen'].replace('Z', '+00:00'))
                    time_diff = (current_time - last_seen).total_seconds()
                    device_data['online'] = time_diff < DEVICE_TIMEOUT
                    device_data['last_seen_seconds'] = int(time_diff)
                except Exception:
                    device_data['online'] = False
                    device_data['last_seen_seconds'] = 999999
                
                laika_devices.append(device_data)
        
        # Sort by most recently seen
        laika_devices.sort(key=lambda d: d.get('last_seen_seconds', 999999))
        
        return jsonify({
            "success": True,
            "count": len(laika_devices),
            "online_count": len([d for d in laika_devices if d.get('online', False)]),
            "devices": laika_devices,
            "timestamp": time.time()
        })
        
    except Exception as e:
        logger.error(f"Error getting devices: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to retrieve devices"
        }), 500

@app.route('/api/devices/<device_id>', methods=['GET'])
def get_device(device_id):
    """Get specific device information"""
    try:
        if device_id not in global_registry:
            return jsonify({
                "success": False,
                "error": "Device not found"
            }), 404
        
        device_data = global_registry[device_id]
        
        # Add online status
        current_time = datetime.now(timezone.utc)
        try:
            last_seen = datetime.fromisoformat(device_data['location']['last_seen'].replace('Z', '+00:00'))
            time_diff = (current_time - last_seen).total_seconds()
            device_data['online'] = time_diff < DEVICE_TIMEOUT
            device_data['last_seen_seconds'] = int(time_diff)
        except Exception:
            device_data['online'] = False
            device_data['last_seen_seconds'] = 999999
        
        return jsonify({
            "success": True,
            "device": device_data
        })
        
    except Exception as e:
        logger.error(f"Error getting device {device_id}: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to retrieve device"
        }), 500

@app.route('/api/devices/<device_id>', methods=['DELETE'])
def unregister_device(device_id):
    """Unregister a device"""
    try:
        if device_id not in global_registry:
            return jsonify({
                "success": False,
                "error": "Device not found"
            }), 404
        
        device_name = global_registry[device_id].get('device_name', 'Unknown')
        del global_registry[device_id]
        registration_stats['devices_removed'] += 1
        
        logger.info(f"Device unregistered: {device_name} ({device_id})")
        
        return jsonify({
            "success": True,
            "message": f"Device {device_id} unregistered successfully"
        })
        
    except Exception as e:
        logger.error(f"Error unregistering device {device_id}: {e}")
        return jsonify({
            "success": False,
            "error": "Failed to unregister device"
        }), 500

@app.route('/api/stats', methods=['GET'])
def get_registry_stats():
    """Get registry statistics"""
    current_time = datetime.now(timezone.utc)
    online_devices = 0
    
    for device_data in global_registry.values():
        try:
            last_seen = datetime.fromisoformat(device_data['location']['last_seen'].replace('Z', '+00:00'))
            time_diff = (current_time - last_seen).total_seconds()
            if time_diff < DEVICE_TIMEOUT:
                online_devices += 1
        except Exception:
            pass
    
    return jsonify({
        "success": True,
        "stats": {
            "total_devices": len(global_registry),
            "online_devices": online_devices,
            "offline_devices": len(global_registry) - online_devices,
            "device_timeout_seconds": DEVICE_TIMEOUT,
            "registration_stats": dict(registration_stats),
            "server_uptime": time.time(),
            "last_cleanup": datetime.now(timezone.utc).isoformat()
        }
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "laika-global-registry",
        "version": "1.0.0",
        "timestamp": time.time(),
        "registered_devices": len(global_registry),
        "max_devices": MAX_DEVICES
    })

@app.route('/', methods=['GET'])
def root():
    """Root endpoint with service information"""
    return jsonify({
        "service": "LAIKA Global Device Registry",
        "version": "1.0.0",
        "description": "Worldwide LAIKA device discovery and registration service",
        "endpoints": {
            "Device Management": {
                "POST /api/register": "Register a LAIKA device",
                "GET /api/devices/laika": "List all LAIKA devices",
                "GET /api/devices/<id>": "Get specific device info",
                "DELETE /api/devices/<id>": "Unregister device"
            },
            "Monitoring": {
                "GET /api/stats": "Registry statistics",
                "GET /health": "Health check"
            }
        },
        "current_stats": {
            "total_devices": len(global_registry),
            "device_timeout": f"{DEVICE_TIMEOUT} seconds",
            "max_devices": MAX_DEVICES
        }
    })

if __name__ == '__main__':
    logger.info("🌍 Starting LAIKA Global Registry Server...")
    logger.info(f"Device timeout: {DEVICE_TIMEOUT} seconds")
    logger.info(f"Max devices: {MAX_DEVICES}")
    logger.info("CORS enabled for worldwide PWA access")
    
    # Start cleanup thread
    start_cleanup_thread()
    
    # Run Flask app
    app.run(host='0.0.0.0', port=8888, debug=False, threaded=True)


