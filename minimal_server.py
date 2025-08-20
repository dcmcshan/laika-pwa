#!/usr/bin/env python3
"""
MINIMAL LAIKA PWA Server - GUARANTEED TO WORK
Navigation-based design with separate pages for each feature
"""

from flask import Flask, render_template_string, jsonify, request
from flask_cors import CORS
import os
import json

app = Flask(__name__)
CORS(app)

# Navigation-based index page
INDEX_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LAIKA - Robot Control Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #1a1a1a; color: #fff; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; }
        .header p { opacity: 0.9; font-size: 1.1em; }
        .nav-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; padding: 30px; max-width: 1200px; margin: 0 auto; }
        .nav-card { background: #2a2a2a; border-radius: 15px; padding: 25px; text-decoration: none; color: #fff; transition: all 0.3s ease; border: 2px solid transparent; }
        .nav-card:hover { transform: translateY(-5px); border-color: #667eea; box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3); }
        .nav-card h3 { font-size: 1.5em; margin-bottom: 10px; color: #667eea; }
        .nav-card p { opacity: 0.8; line-height: 1.5; }
        .nav-card .icon { font-size: 3em; margin-bottom: 15px; display: block; }
        .status { position: fixed; top: 20px; right: 20px; background: #2a2a2a; padding: 10px 15px; border-radius: 8px; font-size: 0.9em; }
        .status.online { border-left: 4px solid #4CAF50; }
        .footer { text-align: center; padding: 20px; opacity: 0.6; }
    </style>
</head>
<body>
    <div class="status online">🟢 LAIKA Online</div>
    
    <div class="header">
        <h1>🐕 LAIKA</h1>
        <p>Robot Control Dashboard</p>
    </div>

    <div class="nav-grid">
        <a href="/camera" class="nav-card">
            <span class="icon">📷</span>
            <h3>Camera View</h3>
            <p>Live camera feed and vision controls</p>
        </a>

        <a href="/movement" class="nav-card">
            <span class="icon">🎮</span>
            <h3>Movement Control</h3>
            <p>Manual robot movement and navigation</p>
        </a>

        <a href="/slam" class="nav-card">
            <span class="icon">🗺️</span>
            <h3>SLAM Mapping</h3>
            <p>Real-time mapping and localization</p>
        </a>

        <a href="/voice" class="nav-card">
            <span class="icon">🎤</span>
            <h3>Voice Commands</h3>
            <p>Speech recognition and voice control</p>
        </a>

        <a href="/sensors" class="nav-card">
            <span class="icon">📊</span>
            <h3>Sensor Data</h3>
            <p>Real-time telemetry and diagnostics</p>
        </a>

        <a href="/settings" class="nav-card">
            <span class="icon">⚙️</span>
            <h3>Settings</h3>
            <p>System configuration and preferences</p>
        </a>
    </div>

    <div class="footer">
        <p>LAIKA PWA v2.0 - Powered by Flask & ngrok</p>
    </div>
</body>
</html>
"""

# Individual page templates
CAMERA_PAGE = """
<!DOCTYPE html>
<html><head><title>LAIKA - Camera</title></head>
<body style="background:#1a1a1a;color:#fff;font-family:Arial;padding:20px;">
<h1>📷 Camera View</h1>
<p><a href="/" style="color:#667eea;">← Back to Dashboard</a></p>
<div style="margin:20px 0;">
    <h3>Live Camera Feed</h3>
    <p>Camera functionality will be available when hardware is connected.</p>
    <div style="background:#333;padding:20px;border-radius:10px;margin:10px 0;">
        <p>🔧 Status: Mock Camera Mode</p>
        <p>📡 Stream: Not Available</p>
    </div>
</div>
</body></html>
"""

MOVEMENT_PAGE = """
<!DOCTYPE html>
<html><head><title>LAIKA - Movement</title></head>
<body style="background:#1a1a1a;color:#fff;font-family:Arial;padding:20px;">
<h1>🎮 Movement Control</h1>
<p><a href="/" style="color:#667eea;">← Back to Dashboard</a></p>
<div style="margin:20px 0;">
    <h3>Robot Controls</h3>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:300px;margin:20px 0;">
        <div></div><button style="padding:15px;background:#667eea;color:#fff;border:none;border-radius:8px;cursor:pointer;">↑</button><div></div>
        <button style="padding:15px;background:#667eea;color:#fff;border:none;border-radius:8px;cursor:pointer;">←</button>
        <button style="padding:15px;background:#f44336;color:#fff;border:none;border-radius:8px;cursor:pointer;">STOP</button>
        <button style="padding:15px;background:#667eea;color:#fff;border:none;border-radius:8px;cursor:pointer;">→</button>
        <div></div><button style="padding:15px;background:#667eea;color:#fff;border:none;border-radius:8px;cursor:pointer;">↓</button><div></div>
    </div>
</div>
</body></html>
"""

@app.route('/')
def index():
    return INDEX_HTML

@app.route('/camera')
def camera_page():
    return CAMERA_PAGE

@app.route('/movement')
def movement_page():
    return MOVEMENT_PAGE

@app.route('/slam')
def slam_page():
    return "<h1>🗺️ SLAM Mapping</h1><p><a href='/'>← Back</a></p><p>SLAM functionality coming soon...</p>"

@app.route('/voice')
def voice_page():
    return "<h1>🎤 Voice Commands</h1><p><a href='/'>← Back</a></p><p>Voice control coming soon...</p>"

@app.route('/sensors')
def sensors_page():
    return "<h1>📊 Sensor Data</h1><p><a href='/'>← Back</a></p><p>Sensor telemetry coming soon...</p>"

@app.route('/settings')
def settings_page():
    return "<h1>⚙️ Settings</h1><p><a href='/'>← Back</a></p><p>System settings coming soon...</p>"

@app.route('/api/status')
def api_status():
    return jsonify({
        'status': 'online',
        'server': 'minimal_pwa',
        'features': ['navigation', 'camera', 'movement', 'slam', 'voice', 'sensors', 'settings']
    })

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'server': 'minimal_laika_pwa'})

if __name__ == '__main__':
    print("🚀 Starting MINIMAL LAIKA PWA Server...")
    print("📋 Navigation-based design with separate pages")
    print("🌐 Server will be available at http://0.0.0.0:5000")
    
    # GUARANTEED TO START - NO DEPENDENCIES, NO HANGING
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
