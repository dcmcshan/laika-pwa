#!/usr/bin/env python3
"""
LAIKA Sensors API Module
Handles sensor telemetry, monitoring, and sensor data endpoints
"""

from flask import Blueprint, request, jsonify
from flask_socketio import emit
from datetime import datetime
import json
import os
import psutil
import subprocess
import threading
import time
import logging

# Configure logging
logger = logging.getLogger(__name__)

# Create Blueprint for Sensors routes
sensors_bp = Blueprint('sensors', __name__, url_prefix='/api/sensors')

# Global SocketIO app reference (will be set by main app)
socketio_app = None
SOCKETIO_AVAILABLE = False

# Sensor telemetry system reference
sensor_telemetry = None
TELEMETRY_AVAILABLE = False

class SensorMonitor:
    """Monitor and manage sensor data collection"""
    
    def __init__(self):
        self.is_monitoring = False
        self.monitoring_thread = None
        self.update_interval = 1.0  # seconds
        self.sensor_data = {}
        self.last_update = None
        
    def start_monitoring(self):
        """Start continuous sensor monitoring"""
        if self.is_monitoring:
            return {"status": "already_running", "message": "Sensor monitoring already active"}
        
        self.is_monitoring = True
        self.monitoring_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitoring_thread.start()
        
        return {"status": "started", "message": "Sensor monitoring started"}
    
    def stop_monitoring(self):
        """Stop continuous sensor monitoring"""
        self.is_monitoring = False
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=2.0)
        
        return {"status": "stopped", "message": "Sensor monitoring stopped"}
    
    def _monitor_loop(self):
        """Main monitoring loop"""
        while self.is_monitoring:
            try:
                # Get system sensors
                system_data = self._get_system_sensors()
                
                # Get robot sensors if available
                robot_data = self._get_robot_sensors()
                
                # Combine data
                self.sensor_data = {
                    "system": system_data,
                    "robot": robot_data,
                    "timestamp": datetime.now().isoformat(),
                    "monitoring": True
                }
                
                self.last_update = datetime.now()
                
                # Broadcast to SocketIO clients
                if SOCKETIO_AVAILABLE and socketio_app:
                    socketio_app.emit('sensor_update', self.sensor_data)
                
                time.sleep(self.update_interval)
                
            except Exception as e:
                logger.error(f"Error in sensor monitoring loop: {e}")
                time.sleep(self.update_interval)
    
    def _get_system_sensors(self):
        """Get system-level sensor data"""
        try:
            return {
                "cpu": {
                    "usage_percent": psutil.cpu_percent(interval=1),
                    "count": psutil.cpu_count(),
                    "frequency": psutil.cpu_freq()._asdict() if psutil.cpu_freq() else None,
                    "temperature": self._get_cpu_temperature()
                },
                "memory": {
                    "total": psutil.virtual_memory().total,
                    "available": psutil.virtual_memory().available,
                    "used": psutil.virtual_memory().used,
                    "percent": psutil.virtual_memory().percent
                },
                "disk": {
                    "total": psutil.disk_usage('/').total,
                    "used": psutil.disk_usage('/').used,
                    "free": psutil.disk_usage('/').free,
                    "percent": psutil.disk_usage('/').percent
                },
                "network": {
                    "bytes_sent": psutil.net_io_counters().bytes_sent,
                    "bytes_recv": psutil.net_io_counters().bytes_recv,
                    "packets_sent": psutil.net_io_counters().packets_sent,
                    "packets_recv": psutil.net_io_counters().packets_recv
                },
                "battery": self._get_battery_info()
            }
        except Exception as e:
            logger.error(f"Error getting system sensors: {e}")
            return {"error": str(e)}
    
    def _get_robot_sensors(self):
        """Get robot-specific sensor data"""
        try:
            if sensor_telemetry and TELEMETRY_AVAILABLE:
                return sensor_telemetry.get_current_telemetry()
            else:
                return {"status": "unavailable", "message": "Robot telemetry system not available"}
        except Exception as e:
            logger.error(f"Error getting robot sensors: {e}")
            return {"error": str(e)}
    
    def _get_cpu_temperature(self):
        """Get CPU temperature if available"""
        try:
            # Try different methods to get CPU temperature
            temp_paths = [
                "/sys/class/thermal/thermal_zone0/temp",
                "/sys/class/hwmon/hwmon0/temp1_input",
                "/proc/acpi/thermal_zone/THM0/temperature"
            ]
            
            for path in temp_paths:
                if os.path.exists(path):
                    with open(path, 'r') as f:
                        temp_raw = int(f.read().strip())
                        # Convert to Celsius (most sensors report in millidegrees)
                        if temp_raw > 1000:
                            return temp_raw / 1000.0
                        else:
                            return temp_raw
            return None
        except Exception:
            return None
    
    def _get_battery_info(self):
        """Get battery information if available"""
        try:
            battery = psutil.sensors_battery()
            if battery:
                return {
                    "percent": battery.percent,
                    "power_plugged": battery.power_plugged,
                    "time_left": battery.secsleft if battery.secsleft != -1 else None
                }
            return None
        except Exception:
            return None
    
    def get_current_data(self):
        """Get current sensor data"""
        if not self.sensor_data:
            # Get one-time reading if not monitoring
            self.sensor_data = {
                "system": self._get_system_sensors(),
                "robot": self._get_robot_sensors(),
                "timestamp": datetime.now().isoformat(),
                "monitoring": False
            }
        
        return self.sensor_data
    
    def set_update_interval(self, interval):
        """Set sensor update interval in seconds"""
        if 0.1 <= interval <= 10.0:
            self.update_interval = interval
            return {"status": "success", "message": f"Update interval set to {interval}s"}
        else:
            return {"status": "error", "message": "Interval must be between 0.1 and 10.0 seconds"}

# Global sensor monitor instance
sensor_monitor = SensorMonitor()

def init_sensors_api(app, socketio=None, telemetry_system=None):
    """Initialize Sensors API with Flask app and SocketIO"""
    global socketio_app, SOCKETIO_AVAILABLE, sensor_telemetry, TELEMETRY_AVAILABLE
    
    if socketio:
        socketio_app = socketio
        SOCKETIO_AVAILABLE = True
    
    if telemetry_system:
        sensor_telemetry = telemetry_system
        TELEMETRY_AVAILABLE = True
    
    # Register blueprint
    app.register_blueprint(sensors_bp)
    
    print("✅ Sensors API module initialized")

@sensors_bp.route('/status', methods=['GET'])
def get_sensor_status():
    """Get current sensor monitoring status"""
    try:
        return jsonify({
            'success': True,
            'monitoring': sensor_monitor.is_monitoring,
            'telemetry_available': TELEMETRY_AVAILABLE,
            'socketio_available': SOCKETIO_AVAILABLE,
            'update_interval': sensor_monitor.update_interval,
            'last_update': sensor_monitor.last_update.isoformat() if sensor_monitor.last_update else None,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting sensor status: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sensors_bp.route('/data', methods=['GET'])
def get_sensor_data():
    """Get current sensor data"""
    try:
        data = sensor_monitor.get_current_data()
        return jsonify({
            'success': True,
            'data': data,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting sensor data: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sensors_bp.route('/monitor/start', methods=['POST'])
def start_sensor_monitoring():
    """Start continuous sensor monitoring"""
    try:
        result = sensor_monitor.start_monitoring()
        return jsonify({
            'success': result['status'] != 'error',
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error starting sensor monitoring: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sensors_bp.route('/monitor/stop', methods=['POST'])
def stop_sensor_monitoring():
    """Stop continuous sensor monitoring"""
    try:
        result = sensor_monitor.stop_monitoring()
        return jsonify({
            'success': result['status'] != 'error',
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error stopping sensor monitoring: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sensors_bp.route('/monitor/interval', methods=['POST'])
def set_monitor_interval():
    """Set sensor monitoring update interval"""
    try:
        data = request.get_json()
        if not data or 'interval' not in data:
            return jsonify({'success': False, 'error': 'Interval parameter required'}), 400
        
        interval = float(data['interval'])
        result = sensor_monitor.set_update_interval(interval)
        
        return jsonify({
            'success': result['status'] != 'error',
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
    except ValueError:
        return jsonify({'success': False, 'error': 'Invalid interval value'}), 400
    except Exception as e:
        logger.error(f"Error setting monitor interval: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sensors_bp.route('/system', methods=['GET'])
def get_system_sensors():
    """Get system sensor data only"""
    try:
        system_data = sensor_monitor._get_system_sensors()
        return jsonify({
            'success': True,
            'data': system_data,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting system sensors: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sensors_bp.route('/robot', methods=['GET'])
def get_robot_sensors():
    """Get robot sensor data only"""
    try:
        robot_data = sensor_monitor._get_robot_sensors()
        return jsonify({
            'success': True,
            'data': robot_data,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error getting robot sensors: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@sensors_bp.route('/refresh', methods=['POST'])
def refresh_sensor_data():
    """Force refresh of sensor data"""
    try:
        # Force a new reading
        sensor_monitor.sensor_data = {}
        data = sensor_monitor.get_current_data()
        
        return jsonify({
            'success': True,
            'data': data,
            'message': 'Sensor data refreshed',
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error refreshing sensor data: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# SocketIO event handlers
def register_sensors_handlers(socketio):
    """Register SocketIO event handlers for sensors"""
    global socketio_app, SOCKETIO_AVAILABLE
    
    socketio_app = socketio
    SOCKETIO_AVAILABLE = True
    
    @socketio.on('connect')
    def handle_sensor_connect():
        """Handle client connection for sensors"""
        emit('sensor_status', {
            'monitoring': sensor_monitor.is_monitoring,
            'telemetry_available': TELEMETRY_AVAILABLE,
            'update_interval': sensor_monitor.update_interval
        })
    
    @socketio.on('request_sensor_data')
    def handle_sensor_data_request():
        """Handle sensor data request from client"""
        data = sensor_monitor.get_current_data()
        emit('sensor_data', data)
    
    @socketio.on('start_sensor_monitoring')
    def handle_start_monitoring():
        """Handle start monitoring request"""
        result = sensor_monitor.start_monitoring()
        emit('sensor_monitoring_status', result)
    
    @socketio.on('stop_sensor_monitoring')
    def handle_stop_monitoring():
        """Handle stop monitoring request"""
        result = sensor_monitor.stop_monitoring()
        emit('sensor_monitoring_status', result)
    
    print("✅ Sensors SocketIO handlers registered")
