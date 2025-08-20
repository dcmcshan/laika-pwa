from flask import Flask, jsonify
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

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
    ice_servers = []
    for stun_server in STUN_SERVERS:
        ice_servers.append({"urls": stun_server})
    for turn_server in TURN_SERVERS:
        ice_servers.append(turn_server)
    return ice_servers

@app.route('/')
def index():
    return jsonify({
        "service": "laika-webrtc-signaling",
        "status": "running", 
        "version": "1.0.0",
        "message": "LAIKA WebRTC Signaling Server - Production Ready"
    })

@app.route('/health')
def health():
    return jsonify({
        "service": "laika-webrtc-signaling",
        "status": "healthy",
        "version": "1.0.0",
        "stun_servers": len(STUN_SERVERS),
        "turn_servers": len(TURN_SERVERS)
    })

@app.route('/ice-servers')
def ice_servers():
    return jsonify({
        "ice_servers": get_ice_servers(),
        "success": True,
        "count": len(get_ice_servers())
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    # Production-safe Flask run
    app.run(host='0.0.0.0', port=port, debug=False)
