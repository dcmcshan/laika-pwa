#!/usr/bin/env python3
"""
LAIKA WebRTC Signaling Server
Enables peer-to-peer connections between PWA and LAIKA devices worldwide
using WebRTC with STUN/TURN for NAT traversal
"""

import os
import sys
import json
import time
import logging
import asyncio
import websockets
from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
import threading
from collections import defaultdict
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'laika-webrtc-signaling-2024'
CORS(app, origins="*")
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Global state
connected_devices = {}  # device_id -> {socket_id, device_info, last_seen}
connected_clients = {}  # client_id -> {socket_id, client_info, last_seen}
signaling_rooms = {}    # room_id -> {device_id, client_id, created_at}

# STUN servers for NAT traversal
STUN_SERVERS = [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:stun2.l.google.com:19302",
    "stun:stun.stunprotocol.org:3478",
    "stun:stun.cloudflare.com:3478"
]

# Free TURN servers (for demo - in production use your own)
TURN_SERVERS = [
    {
        "urls": "turn:openrelay.metered.ca:80",
        "username": "openrelayproject",
        "credential": "openrelayproject"
    },
    {
        "urls": "turn:openrelay.metered.ca:443",
        "username": "openrelayproject", 
        "credential": "openrelayproject"
    }
]

def get_ice_servers():
    """Get ICE servers configuration for WebRTC"""
    ice_servers = []
    
    # Add STUN servers
    for stun_url in STUN_SERVERS:
        ice_servers.append({"urls": stun_url})
    
    # Add TURN servers
    for turn_config in TURN_SERVERS:
        ice_servers.append(turn_config)
    
    return ice_servers

# WebSocket Events for Signaling
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    logger.info(f"Client connected: {request.sid}")
    emit('connected', {'sid': request.sid, 'ice_servers': get_ice_servers()})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    logger.info(f"Client disconnected: {request.sid}")
    
    # Remove from devices if it was a device
    device_to_remove = None
    for device_id, info in connected_devices.items():
        if info['socket_id'] == request.sid:
            device_to_remove = device_id
            break
    
    if device_to_remove:
        del connected_devices[device_to_remove]
        logger.info(f"Device {device_to_remove} disconnected")
        # Notify all clients about device offline
        socketio.emit('device_offline', {'device_id': device_to_remove})
    
    # Remove from clients if it was a client
    client_to_remove = None
    for client_id, info in connected_clients.items():
        if info['socket_id'] == request.sid:
            client_to_remove = client_id
            break
    
    if client_to_remove:
        del connected_clients[client_to_remove]
        logger.info(f"Client {client_to_remove} disconnected")

@socketio.on('register_device')
def handle_device_registration(data):
    """Register a LAIKA device for signaling"""
    try:
        device_id = data.get('device_id')
        device_info = data.get('device_info', {})
        
        if not device_id:
            emit('error', {'message': 'Device ID required'})
            return
        
        # Store device connection
        connected_devices[device_id] = {
            'socket_id': request.sid,
            'device_info': device_info,
            'last_seen': datetime.now(timezone.utc).isoformat(),
            'connection_type': 'webrtc'
        }
        
        logger.info(f"Device registered: {device_id} ({device_info.get('device_name', 'Unknown')})")
        
        # Join device-specific room
        join_room(f"device_{device_id}")
        
        # Notify all clients about new device
        socketio.emit('device_online', {
            'device_id': device_id,
            'device_info': device_info,
            'connection_type': 'webrtc'
        })
        
        emit('registration_success', {
            'device_id': device_id,
            'message': 'Device registered successfully for WebRTC signaling'
        })
        
    except Exception as e:
        logger.error(f"Device registration error: {e}")
        emit('error', {'message': 'Registration failed'})

@socketio.on('register_client')
def handle_client_registration(data):
    """Register a PWA client for signaling"""
    try:
        client_id = data.get('client_id', str(uuid.uuid4()))
        client_info = data.get('client_info', {})
        
        # Store client connection
        connected_clients[client_id] = {
            'socket_id': request.sid,
            'client_info': client_info,
            'last_seen': datetime.now(timezone.utc).isoformat()
        }
        
        logger.info(f"Client registered: {client_id}")
        
        # Join client-specific room
        join_room(f"client_{client_id}")
        
        emit('registration_success', {
            'client_id': client_id,
            'available_devices': list(connected_devices.keys()),
            'ice_servers': get_ice_servers()
        })
        
    except Exception as e:
        logger.error(f"Client registration error: {e}")
        emit('error', {'message': 'Client registration failed'})

@socketio.on('request_connection')
def handle_connection_request(data):
    """Handle connection request from client to device"""
    try:
        device_id = data.get('device_id')
        client_id = data.get('client_id')
        
        if not device_id or not client_id:
            emit('error', {'message': 'Device ID and Client ID required'})
            return
        
        if device_id not in connected_devices:
            emit('error', {'message': 'Device not available'})
            return
        
        # Create signaling room
        room_id = f"signaling_{device_id}_{client_id}_{int(time.time())}"
        signaling_rooms[room_id] = {
            'device_id': device_id,
            'client_id': client_id,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        # Join both parties to signaling room
        join_room(room_id)
        socketio.server.enter_room(connected_devices[device_id]['socket_id'], room_id)
        
        # Notify device of connection request
        socketio.emit('connection_request', {
            'client_id': client_id,
            'room_id': room_id,
            'ice_servers': get_ice_servers()
        }, room=f"device_{device_id}")
        
        # Notify client that request was sent
        emit('connection_request_sent', {
            'device_id': device_id,
            'room_id': room_id,
            'ice_servers': get_ice_servers()
        })
        
        logger.info(f"Connection request: {client_id} -> {device_id} (room: {room_id})")
        
    except Exception as e:
        logger.error(f"Connection request error: {e}")
        emit('error', {'message': 'Connection request failed'})

@socketio.on('webrtc_offer')
def handle_webrtc_offer(data):
    """Forward WebRTC offer"""
    try:
        room_id = data.get('room_id')
        offer = data.get('offer')
        
        if not room_id or not offer:
            emit('error', {'message': 'Room ID and offer required'})
            return
        
        # Forward offer to the room (excluding sender)
        emit('webrtc_offer', {
            'offer': offer,
            'from': request.sid
        }, room=room_id, include_self=False)
        
        logger.info(f"WebRTC offer forwarded in room {room_id}")
        
    except Exception as e:
        logger.error(f"WebRTC offer error: {e}")
        emit('error', {'message': 'Failed to forward offer'})

@socketio.on('webrtc_answer')
def handle_webrtc_answer(data):
    """Forward WebRTC answer"""
    try:
        room_id = data.get('room_id')
        answer = data.get('answer')
        
        if not room_id or not answer:
            emit('error', {'message': 'Room ID and answer required'})
            return
        
        # Forward answer to the room (excluding sender)
        emit('webrtc_answer', {
            'answer': answer,
            'from': request.sid
        }, room=room_id, include_self=False)
        
        logger.info(f"WebRTC answer forwarded in room {room_id}")
        
    except Exception as e:
        logger.error(f"WebRTC answer error: {e}")
        emit('error', {'message': 'Failed to forward answer'})

@socketio.on('ice_candidate')
def handle_ice_candidate(data):
    """Forward ICE candidate"""
    try:
        room_id = data.get('room_id')
        candidate = data.get('candidate')
        
        if not room_id or not candidate:
            emit('error', {'message': 'Room ID and candidate required'})
            return
        
        # Forward ICE candidate to the room (excluding sender)
        emit('ice_candidate', {
            'candidate': candidate,
            'from': request.sid
        }, room=room_id, include_self=False)
        
        logger.debug(f"ICE candidate forwarded in room {room_id}")
        
    except Exception as e:
        logger.error(f"ICE candidate error: {e}")
        emit('error', {'message': 'Failed to forward ICE candidate'})

@socketio.on('connection_established')
def handle_connection_established(data):
    """Handle successful WebRTC connection"""
    try:
        room_id = data.get('room_id')
        
        if room_id in signaling_rooms:
            room_info = signaling_rooms[room_id]
            logger.info(f"WebRTC connection established: {room_info['client_id']} <-> {room_info['device_id']}")
            
            # Notify both parties
            emit('connection_success', {
                'message': 'WebRTC connection established',
                'room_id': room_id
            }, room=room_id)
        
    except Exception as e:
        logger.error(f"Connection established error: {e}")

# HTTP API Endpoints
@app.route('/api/devices', methods=['GET'])
def get_available_devices():
    """Get list of available devices for WebRTC connection"""
    try:
        current_time = datetime.now(timezone.utc)
        available_devices = []
        
        for device_id, info in connected_devices.items():
            device_data = {
                'device_id': device_id,
                'device_info': info['device_info'],
                'connection_type': info['connection_type'],
                'last_seen': info['last_seen'],
                'online': True  # If connected to signaling server, consider online
            }
            available_devices.append(device_data)
        
        return jsonify({
            'success': True,
            'count': len(available_devices),
            'devices': available_devices,
            'signaling_server': {
                'url': request.host_url,
                'websocket_url': f"ws://{request.host}/socket.io/",
                'ice_servers': get_ice_servers()
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting devices: {e}")
        return jsonify({'success': False, 'error': 'Failed to get devices'}), 500

@app.route('/api/stats', methods=['GET'])
def get_signaling_stats():
    """Get signaling server statistics"""
    return jsonify({
        'success': True,
        'stats': {
            'connected_devices': len(connected_devices),
            'connected_clients': len(connected_clients),
            'active_signaling_rooms': len(signaling_rooms),
            'stun_servers': len(STUN_SERVERS),
            'turn_servers': len(TURN_SERVERS),
            'server_uptime': time.time()
        },
        'ice_servers': get_ice_servers()
    })

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'laika-webrtc-signaling',
        'version': '1.0.0',
        'timestamp': time.time(),
        'connected_devices': len(connected_devices),
        'websocket_url': f"ws://{request.host}/socket.io/"
    })

@app.route('/', methods=['GET'])
def root():
    """Root endpoint with service information"""
    return jsonify({
        'service': 'LAIKA WebRTC Signaling Server',
        'version': '1.0.0',
        'description': 'WebRTC signaling server for peer-to-peer LAIKA connections with NAT traversal',
        'features': [
            'WebRTC peer-to-peer connections',
            'STUN/TURN NAT traversal',
            'Real-time signaling via WebSocket',
            'Global device discovery',
            'Automatic connection management'
        ],
        'endpoints': {
            'WebSocket': '/socket.io/ - Real-time signaling',
            'HTTP API': {
                'GET /api/devices': 'List available devices',
                'GET /api/stats': 'Server statistics',
                'GET /health': 'Health check'
            }
        },
        'webrtc_config': {
            'stun_servers': len(STUN_SERVERS),
            'turn_servers': len(TURN_SERVERS),
            'websocket_url': f"ws://{request.host}/socket.io/"
        }
    })

def cleanup_old_rooms():
    """Clean up old signaling rooms"""
    current_time = datetime.now(timezone.utc)
    rooms_to_remove = []
    
    for room_id, room_info in signaling_rooms.items():
        try:
            created_at = datetime.fromisoformat(room_info['created_at'].replace('Z', '+00:00'))
            age = (current_time - created_at).total_seconds()
            
            # Remove rooms older than 1 hour
            if age > 3600:
                rooms_to_remove.append(room_id)
        except Exception as e:
            logger.warning(f"Error checking room {room_id}: {e}")
            rooms_to_remove.append(room_id)
    
    for room_id in rooms_to_remove:
        del signaling_rooms[room_id]
        logger.info(f"Removed old signaling room: {room_id}")

def start_cleanup_thread():
    """Start background cleanup thread"""
    def cleanup_loop():
        while True:
            try:
                cleanup_old_rooms()
                time.sleep(300)  # Clean up every 5 minutes
            except Exception as e:
                logger.error(f"Cleanup error: {e}")
                time.sleep(300)
    
    cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
    cleanup_thread.start()
    logger.info("Started cleanup thread")

if __name__ == '__main__':
    logger.info("🌐 Starting LAIKA WebRTC Signaling Server...")
    logger.info(f"STUN servers: {len(STUN_SERVERS)}")
    logger.info(f"TURN servers: {len(TURN_SERVERS)}")
    logger.info("WebSocket signaling enabled")
    logger.info("CORS enabled for worldwide PWA access")
    
    # Start cleanup thread
#     start_cleanup_thread()
    
    # Get port from environment (for cloud deployment) or default to 9999
    port = int(os.environ.get('PORT', 9999))
    logger.info(f"Starting server on port {port}")
    
    # Run with SocketIO
    socketio.run(app, host='0.0.0.0', port=port, debug=False)


# Last updated: Tue Aug 19 11:14:07 PM HKT 2025
