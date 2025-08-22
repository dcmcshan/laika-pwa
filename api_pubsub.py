#!/usr/bin/env python3
"""
LAIKA PubSub Service API
Handles PubSub service management and monitoring
"""

import os
import json
import subprocess
import psutil
import time
from datetime import datetime
from flask import Blueprint, request, jsonify
import logging

# Create Blueprint
pubsub_bp = Blueprint('pubsub', __name__, url_prefix='/api/services/pubsub')

def init_pubsub_api(app):
    """Initialize PubSub API with Flask app"""
    app.register_blueprint(pubsub_bp)
    print("✅ PubSub API module initialized")

@pubsub_bp.route('/', methods=['GET'])
def get_service_info():
    """Get PubSub service information"""
    try:
        # Check if service is running
        service_running = False
        service_pid = None
        restart_count = 0
        
        # Look for the PubSub service process
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if proc.info['cmdline'] and any('laika_pubsub.py' in cmd for cmd in proc.info['cmdline']):
                    service_running = True
                    service_pid = proc.info['pid']
                    break
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        service_info = {
            'name': 'pubsub',
            'display_name': 'PubSub Service',
            'description': 'Central PubSub service for inter-service communication',
            'status': 'active' if service_running else 'inactive',
            'status_text': 'Running' if service_running else 'Stopped',
            'pid': service_pid,
            'restart_count': restart_count,
            'controllable': True,
            'enabled': True,
            'last_updated': datetime.now().isoformat()
        }
        
        return jsonify({
            'success': True,
            'service': service_info
        })
        
    except Exception as e:
        logging.error(f"Error getting PubSub service info: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@pubsub_bp.route('/start', methods=['POST'])
def start_service():
    """Start the PubSub service"""
    try:
        # Check if already running
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if proc.info['cmdline'] and any('laika_pubsub.py' in cmd for cmd in proc.info['cmdline']):
                    return jsonify({
                        'success': False,
                        'error': 'Service is already running'
                    }), 400
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        # Start the service using laika_services
        result = subprocess.run(['./laika_services', 'start', 'pubsub'], 
                              capture_output=True, text=True, cwd='..')
        
        if result.returncode == 0:
            return jsonify({
                'success': True,
                'message': 'PubSub service started successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': f'Failed to start service: {result.stderr}'
            }), 500
            
    except Exception as e:
        logging.error(f"Error starting PubSub service: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@pubsub_bp.route('/stop', methods=['POST'])
def stop_service():
    """Stop the PubSub service"""
    try:
        # Find and stop the service
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            try:
                if proc.info['cmdline'] and any('laika_pubsub.py' in cmd for cmd in proc.info['cmdline']):
                    proc.terminate()
                    proc.wait(timeout=10)
                    return jsonify({
                        'success': True,
                        'message': 'PubSub service stopped successfully'
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.TimeoutExpired):
                continue
        
        return jsonify({
            'success': False,
            'error': 'Service not found or already stopped'
        }), 400
        
    except Exception as e:
        logging.error(f"Error stopping PubSub service: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@pubsub_bp.route('/restart', methods=['POST'])
def restart_service():
    """Restart the PubSub service"""
    try:
        # Stop first
        stop_result = stop_service()
        if stop_result.status_code != 200:
            return stop_result
        
        # Wait a moment
        time.sleep(2)
        
        # Start again
        return start_service()
        
    except Exception as e:
        logging.error(f"Error restarting PubSub service: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@pubsub_bp.route('/logs', methods=['GET'])
def get_logs():
    """Get PubSub service logs"""
    try:
        log_file = '/var/log/laika_pubsub.log'
        logs = []
        
        if os.path.exists(log_file):
            with open(log_file, 'r') as f:
                lines = f.readlines()
                # Get last 100 lines
                for line in lines[-100:]:
                    line = line.strip()
                    if line:
                        # Parse log line (basic parsing)
                        try:
                            # Expected format: timestamp - LAIKA.PubSub - level - message
                            parts = line.split(' - ', 3)
                            if len(parts) >= 4:
                                timestamp_str = parts[0]
                                level = parts[2]
                                message = parts[3]
                                
                                # Parse timestamp
                                try:
                                    timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                                except:
                                    timestamp = datetime.now()
                                
                                logs.append({
                                    'timestamp': timestamp.isoformat(),
                                    'level': level.lower(),
                                    'message': message
                                })
                            else:
                                # Fallback for unparseable lines
                                logs.append({
                                    'timestamp': datetime.now().isoformat(),
                                    'level': 'info',
                                    'message': line
                                })
                        except Exception as parse_error:
                            logging.warning(f"Error parsing log line: {parse_error}")
                            continue
        
        return jsonify({
            'success': True,
            'logs': logs
        })
        
    except Exception as e:
        logging.error(f"Error getting PubSub logs: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@pubsub_bp.route('/logs/clear', methods=['POST'])
def clear_logs():
    """Clear PubSub service logs"""
    try:
        log_file = '/var/log/laika_pubsub.log'
        
        if os.path.exists(log_file):
            # Clear the log file
            with open(log_file, 'w') as f:
                f.write('')
            
            return jsonify({
                'success': True,
                'message': 'Logs cleared successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Log file not found'
            }), 404
            
    except Exception as e:
        logging.error(f"Error clearing PubSub logs: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@pubsub_bp.route('/logs/download', methods=['GET'])
def download_logs():
    """Download PubSub service logs"""
    try:
        from flask import send_file
        import tempfile
        
        log_file = '/var/log/laika_pubsub.log'
        
        if os.path.exists(log_file):
            return send_file(log_file, as_attachment=True, download_name='pubsub_logs.txt')
        else:
            # Create empty file if log doesn't exist
            temp_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt')
            temp_file.write('No logs available\n')
            temp_file.close()
            
            return send_file(temp_file.name, as_attachment=True, download_name='pubsub_logs.txt')
            
    except Exception as e:
        logging.error(f"Error downloading PubSub logs: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

