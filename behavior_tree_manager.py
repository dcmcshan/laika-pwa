#!/usr/bin/env python3

import os
import json
import xml.etree.ElementTree as ET
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import subprocess
import threading
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

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
            return {"status": "warning", "message": "Monitoring already active"}
        
        try:
            # Check if Nav2 is running
            result = subprocess.run(['ros2', 'node', 'list'], capture_output=True, text=True)
            if 'bt_navigator' not in result.stdout:
                return {"status": "error", "message": "Nav2 bt_navigator not running"}
            
            self.is_monitoring = True
            self.monitoring_thread = threading.Thread(target=self._monitoring_loop)
            self.monitoring_thread.daemon = True
            self.monitoring_thread.start()
            
            return {"status": "success", "message": "Groot2 monitoring started"}
        except Exception as e:
            return {"status": "error", "message": f"Error starting monitoring: {str(e)}"}
    
    def stop_groot_monitoring(self):
        """Stop Groot2 monitoring"""
        self.is_monitoring = False
        return {"status": "success", "message": "Groot2 monitoring stopped"}
    
    def _monitoring_loop(self):
        """Background monitoring loop"""
        while self.is_monitoring:
            try:
                # Check if Groot2 ports are active
                result = subprocess.run(['netstat', '-tlnp'], capture_output=True, text=True)
                groot_active = '1666' in result.stdout or '1667' in result.stdout
                
                if groot_active:
                    logger.info("Groot2 monitoring active")
                else:
                    logger.warning("Groot2 ports not detected")
                
                time.sleep(5)  # Check every 5 seconds
            except Exception as e:
                logger.error(f"Monitoring error: {e}")
                time.sleep(5)
    
    def get_ros2_status(self):
        """Get ROS2 system status"""
        try:
            # Check if ROS2 is running
            result = subprocess.run(['ros2', 'node', 'list'], capture_output=True, text=True)
            nodes = result.stdout.strip().split('\n') if result.stdout else []
            
            nav2_nodes = [node for node in nodes if 'nav' in node.lower()]
            
            return {
                "ros2_running": len(nodes) > 0,
                "nav2_nodes": nav2_nodes,
                "total_nodes": len(nodes)
            }
        except Exception as e:
            return {"ros2_running": False, "error": str(e)}

# Global manager instance
bt_manager = BehaviorTreeManager()

@app.route('/api/trees', methods=['GET'])
def get_trees():
    """Get available behavior trees"""
    return jsonify(bt_manager.get_available_trees())

@app.route('/api/trees/<tree_name>/load', methods=['POST'])
def load_tree(tree_name):
    """Load a behavior tree"""
    result = bt_manager.load_behavior_tree(tree_name)
    return jsonify(result)

@app.route('/api/trees/<tree_name>/save', methods=['POST'])
def save_tree(tree_name):
    """Save a behavior tree"""
    content = request.json.get('content')
    if not content:
        return jsonify({"status": "error", "message": "No content provided"})
    
    result = bt_manager.save_behavior_tree(tree_name, content)
    return jsonify(result)

@app.route('/api/monitoring/start', methods=['POST'])
def start_monitoring():
    """Start Groot2 monitoring"""
    result = bt_manager.start_groot_monitoring()
    return jsonify(result)

@app.route('/api/monitoring/stop', methods=['POST'])
def stop_monitoring():
    """Stop Groot2 monitoring"""
    result = bt_manager.stop_groot_monitoring()
    return jsonify(result)

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get system status"""
    ros2_status = bt_manager.get_ros2_status()
    return jsonify({
        "ros2": ros2_status,
        "monitoring": bt_manager.is_monitoring,
        "current_tree": bt_manager.current_tree
    })

@app.route('/api/trees/<tree_name>/content', methods=['GET'])
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

@app.route('/behavior')
def behavior_page():
    """Serve the behavior tree editor page"""
    return send_from_directory('.', 'behavior.html')

@app.route('/')
def index():
    """API root"""
    return jsonify({
        "name": "LAIKA Behavior Tree Manager",
        "version": "1.0.0",
        "endpoints": [
            "/api/trees - Get available trees",
            "/api/trees/{name}/load - Load a tree",
            "/api/trees/{name}/save - Save a tree",
            "/api/monitoring/start - Start monitoring",
            "/api/monitoring/stop - Stop monitoring",
            "/api/status - Get system status",
            "/behavior - Behavior tree editor"
        ]
    })

if __name__ == '__main__':
    logger.info("Starting LAIKA Behavior Tree Manager...")
    logger.info(f"Navigation config directory: {NAVIGATION_CONFIG_DIR}")
    
    # Check if config directory exists
    if not os.path.exists(NAVIGATION_CONFIG_DIR):
        logger.warning(f"Navigation config directory not found: {NAVIGATION_CONFIG_DIR}")
        logger.info("Please ensure ROS2 navigation package is properly installed")
    
    app.run(host='0.0.0.0', port=5001, debug=True)
