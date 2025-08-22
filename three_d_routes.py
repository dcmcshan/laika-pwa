#!/usr/bin/env python3
"""
3D Model Routes for LAIKA PWA
Modular Flask routes for 3D model functionality
"""

from flask import Blueprint, jsonify, request
from datetime import datetime
import logging

# Import our 3D API
from three_d_api import get_3d_api

logger = logging.getLogger(__name__)

# Create Blueprint for 3D routes
three_d_bp = Blueprint('3d', __name__, url_prefix='/api/3d')

@three_d_bp.route('/model/info', methods=['GET'])
def get_model_info():
    """Get 3D model information"""
    try:
        api = get_3d_api()
        return jsonify(api.get_model_info())
    except Exception as e:
        logger.error(f"❌ Failed to get model info: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@three_d_bp.route('/joints/states', methods=['GET'])
def get_joint_states():
    """Get current joint states"""
    try:
        api = get_3d_api()
        return jsonify(api.get_joint_states())
    except Exception as e:
        logger.error(f"❌ Failed to get joint states: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@three_d_bp.route('/joints/states', methods=['POST'])
def update_joint_states():
    """Update joint states from external sources (ROS, etc.)"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data received'
            }), 400
        
        api = get_3d_api()
        api.update_joint_states(data)
        
        return jsonify({
            'success': True,
            'message': f'Updated {len(data.get("name", []))} joint states',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"❌ Failed to update joint states: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@three_d_bp.route('/joints/<joint_name>', methods=['GET'])
def get_joint_info(joint_name):
    """Get information about a specific joint"""
    try:
        api = get_3d_api()
        return jsonify(api.get_joint_info(joint_name))
    except Exception as e:
        logger.error(f"❌ Failed to get joint info for {joint_name}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@three_d_bp.route('/animations/presets', methods=['GET'])
def get_animation_presets():
    """Get available animation presets"""
    try:
        api = get_3d_api()
        return jsonify(api.get_animation_presets())
    except Exception as e:
        logger.error(f"❌ Failed to get animation presets: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@three_d_bp.route('/animations/calculate', methods=['POST'])
def calculate_animation_frame():
    """Calculate joint positions for animation preset at given time"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data received'
            }), 400
        
        preset_name = data.get('preset')
        time_value = data.get('time', 0.0)
        
        if not preset_name:
            return jsonify({
                'success': False,
                'error': 'Preset name required'
            }), 400
        
        api = get_3d_api()
        joint_positions = api.calculate_animation_frame(preset_name, time_value)
        
        return jsonify({
            'success': True,
            'preset': preset_name,
            'time': time_value,
            'joint_positions': joint_positions,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"❌ Failed to calculate animation frame: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@three_d_bp.route('/ros/status', methods=['GET'])
def get_ros_integration_status():
    """Get ROS integration status and configuration"""
    try:
        api = get_3d_api()
        return jsonify(api.get_ros_integration_status())
    except Exception as e:
        logger.error(f"❌ Failed to get ROS status: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@three_d_bp.route('/viewer/config', methods=['GET'])
def get_viewer_config():
    """Get 3D viewer configuration"""
    try:
        api = get_3d_api()
        return jsonify(api.get_viewer_config())
    except Exception as e:
        logger.error(f"❌ Failed to get viewer config: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@three_d_bp.route('/status', methods=['GET'])
def get_3d_status():
    """Get overall 3D system status"""
    try:
        api = get_3d_api()
        
        # Get all status information
        model_info = api.get_model_info()
        joint_states = api.get_joint_states()
        ros_status = api.get_ros_integration_status()
        viewer_config = api.get_viewer_config()
        
        return jsonify({
            'success': True,
            'status': {
                'model': model_info.get('status', {}),
                'joints': joint_states,
                'ros': ros_status,
                'viewer': viewer_config.get('success', False)
            },
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"❌ Failed to get 3D status: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def register_3d_routes(app):
    """Register 3D routes with the main Flask app"""
    try:
        app.register_blueprint(three_d_bp)
        logger.info("✅ 3D routes registered successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to register 3D routes: {e}")
        return False
