#!/usr/bin/env python3
"""
LAIKA Architecture API
Modular API for service status monitoring and system architecture visualization
"""

import os
import json
import subprocess
import psutil
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import logging

# Optional imports
try:
    import asyncio
    import websockets
    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ArchitectureAPI:
    """API for monitoring LAIKA system architecture and services"""
    
    def __init__(self):
        self.services = {
            # Core AI Services
            'stt': {'name': 'STT', 'description': 'Speech-to-Text Service', 'port': 8766, 'type': 'ai'},
            'llm': {'name': 'LLM', 'description': 'Large Language Model Service', 'port': 8766, 'type': 'ai'},
            'tts': {'name': 'TTS', 'description': 'Text-to-Speech Service', 'port': 8766, 'type': 'ai'},
            'aud': {'name': 'AUD', 'description': 'Audio Detection Service', 'port': 8766, 'type': 'ai'},
            
            # Robot Control Services
            'act': {'name': 'ACT', 'description': 'Action Control Service', 'port': 8766, 'type': 'robot'},
            'sen': {'name': 'SEN', 'description': 'Sensor Data Service', 'port': 8766, 'type': 'robot'},
            'cam': {'name': 'CAM', 'description': 'Camera Service', 'port': 8766, 'type': 'robot'},
            
            # Infrastructure Services
            'pubsub': {'name': 'PubSub', 'description': 'Message Broker Service', 'port': 8766, 'type': 'infra'},
            'mem': {'name': 'MEM', 'description': 'Memory Service', 'port': 8766, 'type': 'infra'},
            
            # External Systems
            'ros2': {'name': 'ROS2', 'description': 'ROS2 Bridge', 'port': 9090, 'type': 'external'},
            'bvh': {'name': 'BVH', 'description': 'Behavior Tree Service', 'port': 8766, 'type': 'external'}
        }
        
        self.service_status = {}
        self.pubsub_log = []
        self.start_time = datetime.now()
        
    def get_service_status(self, service_id: str) -> Dict[str, Any]:
        """Get status of a specific service"""
        if service_id not in self.services:
            return {'error': f'Service {service_id} not found'}
        
        service_info = self.services[service_id]
        
        try:
            # Check if process is running
            is_running = self._check_service_process(service_id)
            
            # Check if port is listening
            port_listening = self._check_port_listening(service_info['port'])
            
            # Check pubsub connectivity
            pubsub_connected = self._check_pubsub_connectivity(service_id)
            
            # Determine overall status
            if is_running and port_listening:
                status = 'up'
            elif is_running or port_listening:
                status = 'warning'
            else:
                status = 'down'
            
            return {
                'id': service_id,
                'name': service_info['name'],
                'description': service_info['description'],
                'type': service_info['type'],
                'status': status,
                'is_running': is_running,
                'port_listening': port_listening,
                'pubsub_connected': pubsub_connected,
                'last_check': datetime.now().isoformat(),
                'uptime': self._get_service_uptime(service_id)
            }
            
        except Exception as e:
            logger.error(f"Error checking service {service_id}: {e}")
            return {
                'id': service_id,
                'name': service_info['name'],
                'description': service_info['description'],
                'type': service_info['type'],
                'status': 'error',
                'error': str(e),
                'last_check': datetime.now().isoformat()
            }
    
    def get_all_service_status(self) -> Dict[str, Any]:
        """Get status of all services"""
        statuses = {}
        for service_id in self.services:
            statuses[service_id] = self.get_service_status(service_id)
        
        return {
            'services': statuses,
            'timestamp': datetime.now().isoformat(),
            'total_services': len(self.services),
            'active_services': len([s for s in statuses.values() if s.get('status') == 'up']),
            'system_uptime': self._get_system_uptime()
        }
    
    def get_pubsub_log(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent pubsub log entries"""
        try:
            # Try to read from pubsub log file
            log_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs', 'laika_pubsub.log')
            if os.path.exists(log_file):
                with open(log_file, 'r') as f:
                    lines = f.readlines()
                    # Parse log entries (simplified - you might want to enhance this)
                    entries = []
                    for line in lines[-limit:]:
                        try:
                            # Parse timestamp and message
                            parts = line.split(' - ', 2)
                            if len(parts) >= 3:
                                timestamp_str = parts[0]
                                level = parts[1]
                                message = parts[2].strip()
                                
                                entries.append({
                                    'timestamp': timestamp_str,
                                    'level': level,
                                    'message': message,
                                    'source': 'pubsub'
                                })
                        except:
                            continue
                    return entries[-limit:]
            
            # Fallback to in-memory log
            return self.pubsub_log[-limit:]
            
        except Exception as e:
            logger.error(f"Error reading pubsub log: {e}")
            return []
    
    def get_system_stats(self) -> Dict[str, Any]:
        """Get overall system statistics"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Get network stats
            network = psutil.net_io_counters()
            
            return {
                'cpu_percent': cpu_percent,
                'memory': {
                    'total': memory.total,
                    'available': memory.available,
                    'percent': memory.percent,
                    'used': memory.used
                },
                'disk': {
                    'total': disk.total,
                    'used': disk.used,
                    'free': disk.free,
                    'percent': (disk.used / disk.total) * 100
                },
                'network': {
                    'bytes_sent': network.bytes_sent,
                    'bytes_recv': network.bytes_recv,
                    'packets_sent': network.packets_sent,
                    'packets_recv': network.packets_recv
                },
                'uptime': self._get_system_uptime(),
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting system stats: {e}")
            return {'error': str(e)}
    
    def _check_service_process(self, service_id: str) -> bool:
        """Check if a service process is running"""
        try:
            # Look for Python processes with service name
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    cmdline = proc.info['cmdline']
                    if cmdline and any(service_id in arg for arg in cmdline):
                        return True
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            
            # Also check for systemd services
            service_name = f"laika-{service_id}.service"
            try:
                result = subprocess.run(
                    ['systemctl', 'is-active', service_name],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                return result.returncode == 0 and result.stdout.strip() == 'active'
            except:
                pass
            
            return False
            
        except Exception as e:
            logger.error(f"Error checking process for {service_id}: {e}")
            return False
    
    def _check_port_listening(self, port: int) -> bool:
        """Check if a port is listening"""
        try:
            for conn in psutil.net_connections():
                if conn.laddr.port == port and conn.status == 'LISTEN':
                    return True
            return False
        except Exception as e:
            logger.error(f"Error checking port {port}: {e}")
            return False
    
    def _check_pubsub_connectivity(self, service_id: str) -> bool:
        """Check if service is connected to pubsub"""
        try:
            # This is a simplified check - in practice you might want to
            # actually connect to the pubsub service and check for active connections
            return self._check_port_listening(8766)
        except Exception as e:
            logger.error(f"Error checking pubsub connectivity for {service_id}: {e}")
            return False
    
    def _get_service_uptime(self, service_id: str) -> Optional[str]:
        """Get uptime of a service"""
        try:
            # Look for the process and get its start time
            for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'create_time']):
                try:
                    cmdline = proc.info['cmdline']
                    if cmdline and any(service_id in arg for arg in cmdline):
                        start_time = datetime.fromtimestamp(proc.info['create_time'])
                        uptime = datetime.now() - start_time
                        return str(uptime).split('.')[0]  # Remove microseconds
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting uptime for {service_id}: {e}")
            return None
    
    def _get_system_uptime(self) -> str:
        """Get system uptime"""
        try:
            uptime_seconds = psutil.boot_time()
            boot_time = datetime.fromtimestamp(uptime_seconds)
            uptime = datetime.now() - boot_time
            return str(uptime).split('.')[0]
        except Exception as e:
            logger.error(f"Error getting system uptime: {e}")
            return "unknown"

# Global instance
arch_api = ArchitectureAPI()

def init_architecture_api(app):
    """Initialize architecture API routes with Flask app"""
    from flask import request, jsonify
    
    @app.route('/api/service/status/<service_id>')
    def get_service_status(service_id):
        """Get status of a specific service"""
        try:
            status = arch_api.get_service_status(service_id)
            return jsonify(status)
        except Exception as e:
            logger.error(f"Error in get_service_status: {e}")
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/services/status')
    def get_all_services_status():
        """Get status of all services"""
        try:
            status = arch_api.get_all_service_status()
            return jsonify(status)
        except Exception as e:
            logger.error(f"Error in get_all_services_status: {e}")
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/pubsub/log')
    def get_pubsub_log():
        """Get recent pubsub log entries"""
        try:
            limit = request.args.get('limit', 100, type=int)
            log_entries = arch_api.get_pubsub_log(limit)
            return jsonify(log_entries)
        except Exception as e:
            logger.error(f"Error in get_pubsub_log: {e}")
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/system/stats')
    def get_system_stats():
        """Get system statistics"""
        try:
            stats = arch_api.get_system_stats()
            return jsonify(stats)
        except Exception as e:
            logger.error(f"Error in get_system_stats: {e}")
            return jsonify({'error': str(e)}), 500
    
    @app.route('/api/architecture/overview')
    def get_architecture_overview():
        """Get comprehensive architecture overview"""
        try:
            services_status = arch_api.get_all_service_status()
            system_stats = arch_api.get_system_stats()
            pubsub_log = arch_api.get_pubsub_log(10)  # Last 10 entries
            
            return jsonify({
                'services': services_status,
                'system': system_stats,
                'recent_messages': pubsub_log,
                'timestamp': datetime.now().isoformat()
            })
        except Exception as e:
            logger.error(f"Error in get_architecture_overview: {e}")
            return jsonify({'error': str(e)}), 500

# For standalone testing
if __name__ == '__main__':
    print("=" * 60)
    print("🔧 LAIKA Architecture API - Testing Mode")
    print("=" * 60)
    print("This module is designed to be imported by the main server.")
    print("Running standalone for testing purposes only.")
    print("=" * 60)
    
    # Test the API
    api = ArchitectureAPI()
    
    print("\n=== Service Status ===")
    for service_id in api.services:
        status = api.get_service_status(service_id)
        print(f"{service_id}: {status['status']}")
    
    print("\n=== System Stats ===")
    stats = api.get_system_stats()
    print(f"CPU: {stats.get('cpu_percent', 'N/A')}%")
    print(f"Memory: {stats.get('memory', {}).get('percent', 'N/A')}%")
    print(f"Uptime: {stats.get('uptime', 'N/A')}")
    
    print("\n=== API Endpoints ===")
    print("When integrated with Flask server:")
    print("- GET /api/services/status - All service statuses")
    print("- GET /api/service/status/<service_id> - Individual service status")
    print("- GET /api/system/stats - System statistics")
    print("- GET /api/pubsub/log - PubSub log entries")
    print("- GET /api/architecture/overview - Complete overview")
    print("=" * 60)
