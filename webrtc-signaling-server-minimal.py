#!/usr/bin/env python3
"""
LAIKA WebRTC Signaling Server - Minimal Version for Cloud Deployment
"""

import os
import json
import time
import logging
from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'laika-webrtc-signaling-2024'
CORS(app, origins="*")

# STUN servers for NAT traversal
STUN_SERVERS = [
    "stun:stun.l.google.com:19302",
    "stun:stun1.l.google.com:19302",
    "stun:stun2.l.google.com:19302",
    "stun:stun.stunprotocol.org:3478",
    "stun:stun.cloudflare.com:3478"
]

# Free TURN servers
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
    for stun_server in STUN_SERVERS:
        ice_servers.append({"urls": stun_server})
    
    # Add TURN servers
    for turn_server in TURN_SERVERS:
        ice_servers.append(turn_server)
    
    return ice_servers

@app.route('/')
def index():
    """Root endpoint"""
    return jsonify({
        "service": "laika-webrtc-signaling",
        "status": "running",
        "version": "1.0.0-minimal",
        "endpoints": ["/health", "/ice-servers"]
    })

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        "service": "laika-webrtc-signaling",
        "status": "healthy",
        "version": "1.0.0-minimal",
        "timestamp": time.time(),
        "stun_servers": len(STUN_SERVERS),
        "turn_servers": len(TURN_SERVERS)
    })

@app.route('/ice-servers')
def ice_servers():
    """Get ICE servers for WebRTC"""
    return jsonify({
        "ice_servers": get_ice_servers(),
        "success": True,
        "count": len(get_ice_servers())
    })

if __name__ == '__main__':
    logger.info("🌐 Starting LAIKA WebRTC Signaling Server (Minimal)...")
    logger.info(f"STUN servers: {len(STUN_SERVERS)}")
    logger.info(f"TURN servers: {len(TURN_SERVERS)}")
    
    # Get port from environment
    port = int(os.environ.get('PORT', 5000))
    logger.info(f"Starting server on port {port}")
    
    # Run with basic Flask server
    app.run(host='0.0.0.0', port=port, debug=False)
