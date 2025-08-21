#!/usr/bin/env python3
"""
LAIKA Sensor Telemetry System
Provides sensor data for LLM context
"""

import os
import time
import json
import psutil
from datetime import datetime
from typing import Optional, Dict, Any
import subprocess

class SensorTelemetrySystem:
    """Sensor telemetry system for providing sensor context to LLM"""
    
    def __init__(self):
        self.last_telemetry_time = None
        self.telemetry_file = "/home/pi/LAIKA/sensors.json"
        self.telemetry_cache = {}
        self.cache_duration = 2.0  # Cache for 2 seconds
        
        # Ensure telemetry directory exists
        os.makedirs(os.path.dirname(self.telemetry_file), exist_ok=True)
    
    def get_current_telemetry(self) -> Dict[str, Any]:
        """Get current sensor telemetry data"""
        current_time = time.time()
        
        # Return cached data if recent
        if (self.last_telemetry_time and 
            current_time - self.last_telemetry_time < self.cache_duration and 
            self.telemetry_cache):
            return self.telemetry_cache
        
        try:
            # Get system telemetry
            system_telemetry = self._get_system_telemetry()
            
            # Get robot-specific telemetry if available
            robot_telemetry = self._get_robot_telemetry()
            
            # Combine telemetry data
            telemetry_data = {
                "timestamp": datetime.now().isoformat(),
                "system": system_telemetry,
                "robot": robot_telemetry,
                "sensors_available": {
                    "system": True,
                    "robot": robot_telemetry is not None,
                    "camera": self._check_camera_status(),
                    "network": self._get_network_status()
                }
            }
            
            # Cache the data
            self.telemetry_cache = telemetry_data
            self.last_telemetry_time = current_time
            
            # Save to file
            self._save_telemetry(telemetry_data)
            
            return telemetry_data
            
        except Exception as e:
            print(f"❌ Telemetry error: {e}")
            return self._get_fallback_telemetry()
    
    def _get_system_telemetry(self) -> Dict[str, Any]:
        """Get system-level telemetry"""
        try:
            # CPU information
            cpu_percent = psutil.cpu_percent(interval=0.1)
            cpu_count = psutil.cpu_count()
            cpu_freq = psutil.cpu_freq()
            
            # Memory information
            memory = psutil.virtual_memory()
            
            # Disk information
            disk = psutil.disk_usage('/')
            
            # Temperature (if available)
            temperature = self._get_temperature()
            
            return {
                "cpu": {
                    "percent": cpu_percent,
                    "count": cpu_count,
                    "frequency_mhz": cpu_freq.current if cpu_freq else None
                },
                "memory": {
                    "total_gb": round(memory.total / (1024**3), 2),
                    "available_gb": round(memory.available / (1024**3), 2),
                    "percent_used": memory.percent
                },
                "disk": {
                    "total_gb": round(disk.total / (1024**3), 2),
                    "free_gb": round(disk.free / (1024**3), 2),
                    "percent_used": round((disk.used / disk.total) * 100, 2)
                },
                "temperature_celsius": temperature,
                "uptime_seconds": time.time() - psutil.boot_time()
            }
            
        except Exception as e:
            print(f"❌ System telemetry error: {e}")
            return {"error": str(e)}
    
    def _get_robot_telemetry(self) -> Optional[Dict[str, Any]]:
        """Get robot-specific telemetry"""
        try:
            # Try to get ROS2 robot data if available
            robot_data = self._get_ros2_robot_data()
            if robot_data:
                return robot_data
            
            # Try to get from robot controller if available
            robot_data = self._get_robot_controller_data()
            if robot_data:
                return robot_data
            
            # Return simulated robot data
            return self._get_simulated_robot_data()
            
        except Exception as e:
            print(f"❌ Robot telemetry error: {e}")
            return None
    
    def _get_ros2_robot_data(self) -> Optional[Dict[str, Any]]:
        """Get ROS2 robot data if available"""
        try:
            # Check if ROS2 is running and get robot state
            result = subprocess.run(
                ['ros2', 'topic', 'echo', '/robot_state', '--once', '--timeout', '1'],
                capture_output=True, text=True, timeout=2
            )
            
            if result.returncode == 0 and result.stdout.strip():
                # Parse ROS2 output
                return {
                    "source": "ros2",
                    "data": result.stdout.strip()
                }
                
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
            pass
        
        return None
    
    def _get_robot_controller_data(self) -> Optional[Dict[str, Any]]:
        """Get robot controller data if available"""
        try:
            # Check if robot controller service is running
            controller_file = "/tmp/laika_controller_status.json"
            if os.path.exists(controller_file):
                with open(controller_file, 'r') as f:
                    data = json.load(f)
                    return {
                        "source": "controller",
                        "data": data
                    }
        except Exception:
            pass
        
        return None
    
    def _get_simulated_robot_data(self) -> Dict[str, Any]:
        """Get simulated robot data when real data is not available"""
        return {
            "source": "simulation",
            "status": "idle",
            "position": {
                "x": 0.0,
                "y": 0.0,
                "z": 0.0
            },
            "orientation": {
                "roll": 0.0,
                "pitch": 0.0,
                "yaw": 0.0
            },
            "battery": {
                "level": 85.0,
                "charging": False
            },
            "servos": {
                "status": "ok",
                "temperature": 45.0
            },
            "imu": {
                "accelerometer": {"x": 0.0, "y": 0.0, "z": 9.8},
                "gyroscope": {"x": 0.0, "y": 0.0, "z": 0.0},
                "magnetometer": {"x": 0.0, "y": 0.0, "z": 0.0}
            },
            "note": "Simulated robot data - real sensors not available"
        }
    
    def _get_temperature(self) -> Optional[float]:
        """Get system temperature if available"""
        try:
            # Try different temperature sources
            temp_sources = [
                "/sys/class/thermal/thermal_zone0/temp",
                "/sys/class/hwmon/hwmon0/temp1_input",
                "/proc/acpi/thermal_zone/THM0/temperature"
            ]
            
            for source in temp_sources:
                if os.path.exists(source):
                    with open(source, 'r') as f:
                        temp_raw = f.read().strip()
                        if temp_raw.isdigit():
                            # Convert from millidegrees to degrees
                            temp_celsius = float(temp_raw) / 1000.0
                            return round(temp_celsius, 1)
                            
        except Exception:
            pass
        
        return None
    
    def _check_camera_status(self) -> bool:
        """Check if camera is available"""
        try:
            # Check if camera device exists
            camera_devices = ["/dev/video0", "/dev/video1", "/dev/video2"]
            for device in camera_devices:
                if os.path.exists(device):
                    return True
            
            # Check if camera is accessible via OpenCV
            import cv2
            cap = cv2.VideoCapture(0)
            if cap.isOpened():
                cap.release()
                return True
                
        except Exception:
            pass
        
        return False
    
    def _get_network_status(self) -> Dict[str, Any]:
        """Get network status"""
        try:
            # Get network interfaces
            net_io = psutil.net_io_counters()
            
            # Get active connections
            connections = psutil.net_connections()
            active_connections = len([c for c in connections if c.status == 'ESTABLISHED'])
            
            return {
                "bytes_sent": net_io.bytes_sent,
                "bytes_recv": net_io.bytes_recv,
                "active_connections": active_connections,
                "interfaces": len(psutil.net_if_addrs())
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    def _save_telemetry(self, telemetry_data: Dict[str, Any]):
        """Save telemetry data to file"""
        try:
            with open(self.telemetry_file, 'w') as f:
                json.dump(telemetry_data, f, indent=2)
        except Exception as e:
            print(f"❌ Error saving telemetry: {e}")
    
    def _get_fallback_telemetry(self) -> Dict[str, Any]:
        """Get fallback telemetry when main system fails"""
        return {
            "timestamp": datetime.now().isoformat(),
            "system": {
                "cpu": {"percent": 0.0, "count": 1},
                "memory": {"total_gb": 1.0, "available_gb": 0.5, "percent_used": 50.0},
                "disk": {"total_gb": 10.0, "free_gb": 5.0, "percent_used": 50.0},
                "temperature_celsius": None,
                "uptime_seconds": 0.0
            },
            "robot": {
                "source": "fallback",
                "status": "unknown",
                "note": "Fallback telemetry - system error occurred"
            },
            "sensors_available": {
                "system": False,
                "robot": False,
                "camera": False,
                "network": False
            },
            "error": "Telemetry system error"
        }
    
    def get_telemetry_file_path(self) -> str:
        """Get path to telemetry file"""
        return self.telemetry_file
    
    def force_refresh(self):
        """Force refresh of telemetry data"""
        self.last_telemetry_time = None
        self.telemetry_cache = {}

# Global instance
_sensor_telemetry_system = None

def get_sensor_telemetry_system() -> SensorTelemetrySystem:
    """Get or create sensor telemetry system instance"""
    global _sensor_telemetry_system
    if _sensor_telemetry_system is None:
        _sensor_telemetry_system = SensorTelemetrySystem()
    return _sensor_telemetry_system

if __name__ == "__main__":
    # Test the sensor telemetry system
    telemetry_system = get_sensor_telemetry_system()
    telemetry_data = telemetry_system.get_current_telemetry()
    print(f"Telemetry data: {json.dumps(telemetry_data, indent=2)}")
