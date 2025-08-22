#!/usr/bin/env python3
"""
LAIKA Behavior API Module
Handles behavior tree management, robot actions, and behavior control
"""

from flask import Blueprint, request, jsonify
from flask_socketio import emit
import os
import json
import xml.etree.ElementTree as ET
import subprocess
import threading
import time
import logging
from datetime import datetime

# Configure logging
logger = logging.getLogger(__name__)

# Create Blueprint
bhv_bp = Blueprint('behavior', __name__, url_prefix='/api/behavior')

# Configuration
NAVIGATION_CONFIG_DIR = "/home/ubuntu/ros2_ws/src/navigation/config"
BEHAVIOR_TREES = {
    "laika_advanced_behavior_tree.xml": "Advanced LAIKA Behavior Tree",
    "laika_behavior_tree.xml": "Basic LAIKA Behavior Tree",
    "default": "Default Nav2 Behavior Tree"
}

class BehaviorTreeManager:
    def __init__(self):
        self.current_tree = "laika_advanced_behavior_tree.xml"
        self.is_monitoring = False
        self.monitoring_thread = None
        self.ros2_status = {"ros2_running": False, "error": "Not checked"}
        
    def get_available_trees(self):
        """Get list of available behavior trees"""
        trees = []
        for filename, description in BEHAVIOR_TREES.items():
            if filename == "default":
                trees.append({
                    "filename": filename,
                    "description": description,
                    "is_default": True
                })
            else:
                filepath = os.path.join(NAVIGATION_CONFIG_DIR, filename)
                exists = os.path.exists(filepath)
                trees.append({
                    "filename": filename,
                    "description": description,
                    "exists": exists,
                    "is_default": False
                })
        return trees
    
    def load_behavior_tree(self, tree_name):
        """Load a behavior tree XML file"""
        if tree_name == "default":
            return {"status": "success", "message": "Using default Nav2 behavior tree"}
        
        filepath = os.path.join(NAVIGATION_CONFIG_DIR, tree_name)
        if not os.path.exists(filepath):
            return {"status": "error", "message": f"Behavior tree file not found: {tree_name}"}
        
        try:
            with open(filepath, 'r') as f:
                content = f.read()
            
            # Parse XML to validate
            ET.fromstring(content)
            
            self.current_tree = tree_name
            return {
                "status": "success", 
                "message": f"Loaded behavior tree: {tree_name}",
                "content": content
            }
        except Exception as e:
            return {"status": "error", "message": f"Error loading behavior tree: {str(e)}"}
    
    def save_behavior_tree(self, tree_name, content):
        """Save a behavior tree XML file"""
        if tree_name == "default":
            return {"status": "error", "message": "Cannot save to default tree"}
        
        filepath = os.path.join(NAVIGATION_CONFIG_DIR, tree_name)
        
        try:
            # Validate XML
            ET.fromstring(content)
            
            # Save file
            with open(filepath, 'w') as f:
                f.write(content)
            
            return {"status": "success", "message": f"Saved behavior tree: {tree_name}"}
        except Exception as e:
            return {"status": "error", "message": f"Error saving behavior tree: {str(e)}"}
    
    def start_groot_monitoring(self):
        """Start Groot2 monitoring"""
        if self.is_monitoring:
            return {"status": "error", "message": "Monitoring already active"}
        
        try:
            # Start Groot2 monitoring process
            self.monitoring_thread = threading.Thread(target=self._monitoring_worker, daemon=True)
            self.monitoring_thread.start()
            self.is_monitoring = True
            
            return {"status": "success", "message": "Groot2 monitoring started"}
        except Exception as e:
            return {"status": "error", "message": f"Error starting monitoring: {str(e)}"}
    
    def stop_groot_monitoring(self):
        """Stop Groot2 monitoring"""
        if not self.is_monitoring:
            return {"status": "error", "message": "Monitoring not active"}
        
        try:
            self.is_monitoring = False
            return {"status": "success", "message": "Groot2 monitoring stopped"}
        except Exception as e:
            return {"status": "error", "message": f"Error stopping monitoring: {str(e)}"}
    
    def _monitoring_worker(self):
        """Background worker for Groot2 monitoring"""
        while self.is_monitoring:
            try:
                # Check ROS2 status
                self.get_ros2_status()
                time.sleep(5)
            except Exception as e:
                logger.error(f"Monitoring worker error: {e}")
                time.sleep(10)
    
    def get_ros2_status(self):
        """Check if ROS2 is running"""
        try:
            result = subprocess.run(['ros2', 'node', 'list'], 
                                  capture_output=True, text=True, timeout=5)
            self.ros2_status = {
                "ros2_running": result.returncode == 0,
                "nodes": result.stdout.strip().split('\n') if result.stdout else [],
                "error": None
            }
        except subprocess.TimeoutExpired:
            self.ros2_status = {"ros2_running": False, "error": "Timeout"}
        except Exception as e:
            self.ros2_status = {"ros2_running": False, "error": str(e)}
        
        return self.ros2_status

# Global manager instance
bt_manager = BehaviorTreeManager()

def init_bhv_api(app, socketio=None):
    """Initialize Behavior API with Flask app and SocketIO"""
    app.register_blueprint(bhv_bp)
    if socketio:
        register_socketio_handlers(socketio)
    print("✅ Behavior API module initialized")

# API Endpoints
@bhv_bp.route('/trees', methods=['GET'])
def get_trees():
    """Get available behavior trees"""
    return jsonify(bt_manager.get_available_trees())

@bhv_bp.route('/trees/<tree_name>/load', methods=['POST'])
def load_tree(tree_name):
    """Load a behavior tree"""
    result = bt_manager.load_behavior_tree(tree_name)
    return jsonify(result)

@bhv_bp.route('/trees/<tree_name>/save', methods=['POST'])
def save_tree(tree_name):
    """Save a behavior tree"""
    content = request.json.get('content')
    if not content:
        return jsonify({"status": "error", "message": "No content provided"})
    
    result = bt_manager.save_behavior_tree(tree_name, content)
    return jsonify(result)

@bhv_bp.route('/monitoring/start', methods=['POST'])
def start_monitoring():
    """Start Groot2 monitoring"""
    result = bt_manager.start_groot_monitoring()
    return jsonify(result)

@bhv_bp.route('/monitoring/stop', methods=['POST'])
def stop_monitoring():
    """Stop Groot2 monitoring"""
    result = bt_manager.stop_groot_monitoring()
    return jsonify(result)

@bhv_bp.route('/status', methods=['GET'])
def get_status():
    """Get system status"""
    ros2_status = bt_manager.get_ros2_status()
    return jsonify({
        "ros2": ros2_status,
        "monitoring": bt_manager.is_monitoring,
        "current_tree": bt_manager.current_tree
    })

@bhv_bp.route('/trees/<tree_name>/content', methods=['GET'])
def get_tree_content(tree_name):
    """Get behavior tree content"""
    if tree_name == "default":
        return jsonify({"status": "error", "message": "Cannot get default tree content"})
    
    filepath = os.path.join(NAVIGATION_CONFIG_DIR, tree_name)
    if not os.path.exists(filepath):
        return jsonify({"status": "error", "message": "File not found"})
    
    try:
        with open(filepath, 'r') as f:
            content = f.read()
        return jsonify({"status": "success", "content": content})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@bhv_bp.route('/actions/trigger', methods=['POST'])
def trigger_behavior():
    """Trigger a specific behavior action"""
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "No data provided"})
    
    action = data.get('action')
    if not action:
        return jsonify({"status": "error", "message": "No action specified"})
    
    try:
        # Execute robot action via laika_do.py
        result = subprocess.run([
            'python3', '/home/pi/LAIKA/laika_do.py', action
        ], capture_output=True, text=True, timeout=10)
        
        if result.returncode == 0:
            return jsonify({
                "status": "success",
                "action": action,
                "message": f"Behavior action '{action}' executed successfully",
                "output": result.stdout.strip() if result.stdout else 'Action completed'
            })
        else:
            return jsonify({
                "status": "error",
                "action": action,
                "message": f"Behavior action '{action}' failed",
                "error": result.stderr.strip() if result.stderr else 'Action failed'
            })
            
    except subprocess.TimeoutExpired:
        return jsonify({
            "status": "error",
            "action": action,
            "message": f"Behavior action '{action}' timed out"
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "action": action,
            "message": f"Error executing behavior action: {str(e)}"
        })

@bhv_bp.route('/actions/list', methods=['GET'])
def list_actions():
    """Get list of available behavior actions"""
    actions = [
        {"name": "sit", "description": "Sit down", "category": "basic"},
        {"name": "stand", "description": "Stand up", "category": "basic"},
        {"name": "lie", "description": "Lie down", "category": "basic"},
        {"name": "hello", "description": "Wave hello", "category": "interactive"},
        {"name": "dance", "description": "Perform dance", "category": "performance"},
        {"name": "wave", "description": "Wave", "category": "interactive"},
        {"name": "bow", "description": "Bow politely", "category": "interactive"},
        {"name": "stop", "description": "Stop current action", "category": "control"},
        {"name": "reset", "description": "Reset to initial position", "category": "control"},
        {"name": "forward", "description": "Move forward", "category": "movement"},
        {"name": "backward", "description": "Move backward", "category": "movement"},
        {"name": "left", "description": "Turn left", "category": "movement"},
        {"name": "right", "description": "Turn right", "category": "movement"}
    ]
    
    return jsonify({
        "status": "success",
        "actions": actions,
        "categories": ["basic", "interactive", "performance", "control", "movement"]
    })

def register_socketio_handlers(socketio):
    """Register SocketIO event handlers for behavior API"""
    
    @socketio.on('behavior_trigger')
    def handle_behavior_trigger(data):
        """Handle behavior trigger via WebSocket"""
        try:
            action = data.get('action')
            if not action:
                emit('behavior_response', {
                    'status': 'error',
                    'message': 'No action specified'
                })
                return
            
            # Execute the action
            result = subprocess.run([
                'python3', '/home/pi/LAIKA/laika_do.py', action
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                emit('behavior_response', {
                    'status': 'success',
                    'action': action,
                    'message': f'Behavior action "{action}" executed successfully',
                    'timestamp': datetime.now().isoformat()
                })
            else:
                emit('behavior_response', {
                    'status': 'error',
                    'action': action,
                    'message': f'Behavior action "{action}" failed: {result.stderr}',
                    'timestamp': datetime.now().isoformat()
                })
                
        except Exception as e:
            emit('behavior_response', {
                'status': 'error',
                'message': f'Error executing behavior action: {str(e)}',
                'timestamp': datetime.now().isoformat()
            })
    
    @socketio.on('behavior_status_request')
    def handle_behavior_status_request():
        """Handle behavior status request via WebSocket"""
        try:
            ros2_status = bt_manager.get_ros2_status()
            emit('behavior_status', {
                'ros2': ros2_status,
                'monitoring': bt_manager.is_monitoring,
                'current_tree': bt_manager.current_tree,
                'timestamp': datetime.now().isoformat()
            })
        except Exception as e:
            emit('behavior_status', {
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
    
    @socketio.on('connect')
    def handle_connect():
        """Handle client connection"""
        print("🔌 Behavior API client connected")
        emit('behavior_status', {
            'message': 'Connected to Behavior API',
            'timestamp': datetime.now().isoformat()
        })
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle client disconnection"""
        print("🔌 Behavior API client disconnected")
