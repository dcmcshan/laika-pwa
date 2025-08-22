#!/usr/bin/env python3
"""
LAIKA WiFi Management API
Provides WiFi status, scanning, and connection management for the PWA
"""

import subprocess
import json
import time
import socket
import platform
from typing import Dict, List, Any
import logging

logger = logging.getLogger(__name__)

class WiFiManager:
    """WiFi management for LAIKA system"""
    
    def __init__(self):
        self.system = platform.system()
        logger.info(f"WiFi Manager initialized for {self.system}")
    
    def get_wifi_status(self) -> Dict[str, Any]:
        """Get current WiFi connection status"""
        try:
            if self.system == "Darwin":  # macOS
                return self._get_wifi_status_macos()
            else:  # Linux (Raspberry Pi)
                return self._get_wifi_status_linux()
        except Exception as e:
            logger.error(f"Error getting WiFi status: {e}")
            return {"connected": False, "ssid": None, "ip_address": None, "signal": None}
    
    def _get_wifi_status_macos(self) -> Dict[str, Any]:
        """Get WiFi status on macOS"""
        try:
            # Get current WiFi network
            result = subprocess.run(
                ["networksetup", "-getairportnetwork", "en0"], 
                capture_output=True, text=True, timeout=5
            )
            
            if result.returncode == 0 and "Current Wi-Fi Network:" in result.stdout:
                ssid = result.stdout.split("Current Wi-Fi Network:")[1].strip()
                connected = True
            else:
                ssid = None
                connected = False
            
            # Get IP address
            ip_address = None
            try:
                hostname = socket.gethostname()
                ip_address = socket.gethostbyname(hostname)
            except:
                pass
            
            return {
                "connected": connected,
                "ssid": ssid,
                "ip_address": ip_address,
                "signal": None  # macOS doesn't easily provide signal strength
            }
            
        except Exception as e:
            logger.error(f"Error getting WiFi status on macOS: {e}")
            return {"connected": False, "ssid": None, "ip_address": None, "signal": None}
    
    def _get_wifi_status_linux(self) -> Dict[str, Any]:
        """Get WiFi status on Linux/Raspberry Pi"""
        try:
            # Check if connected to WiFi using iwconfig
            result = subprocess.run(['iwconfig'], capture_output=True, text=True, timeout=5)
            
            connected = False
            ssid = None
            signal = None
            
            if result.returncode == 0:
                lines = result.stdout.split('\n')
                for line in lines:
                    if 'ESSID:' in line:
                        ssid_part = line.split('ESSID:')[1].strip().strip('"')
                        if ssid_part and ssid_part != 'off/any':
                            ssid = ssid_part
                            connected = True
                    if 'Signal level=' in line:
                        signal_part = line.split('Signal level=')[1].split()[0]
                        try:
                            signal = int(signal_part)
                        except:
                            pass
            
            # Get IP address
            ip_address = None
            try:
                # Try to get IP from wlan0 interface
                result = subprocess.run(
                    ['ip', 'addr', 'show', 'wlan0'], 
                    capture_output=True, text=True, timeout=5
                )
                if result.returncode == 0:
                    for line in result.stdout.split('\n'):
                        if 'inet ' in line:
                            ip_address = line.split('inet ')[1].split('/')[0]
                            break
                
                # Fallback to hostname method
                if not ip_address:
                    hostname = socket.gethostname()
                    ip_address = socket.gethostbyname(hostname)
            except:
                pass
            
            return {
                "connected": connected,
                "ssid": ssid,
                "ip_address": ip_address,
                "signal": signal
            }
            
        except Exception as e:
            logger.error(f"Error getting WiFi status on Linux: {e}")
            return {"connected": False, "ssid": None, "ip_address": None, "signal": None}
    
    def scan_networks(self) -> List[Dict[str, Any]]:
        """Scan for available WiFi networks"""
        try:
            if self.system == "Darwin":  # macOS
                return self._scan_networks_macos()
            else:  # Linux (Raspberry Pi)
                return self._scan_networks_linux()
        except Exception as e:
            logger.error(f"Error scanning networks: {e}")
            return []
    
    def _scan_networks_macos(self) -> List[Dict[str, Any]]:
        """Scan WiFi networks on macOS"""
        try:
            # Use airport command to scan
            result = subprocess.run(
                ["/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport", "-s"],
                capture_output=True, text=True, timeout=10
            )
            
            networks = []
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')[1:]  # Skip header
                for line in lines:
                    parts = line.split()
                    if len(parts) >= 4:
                        ssid = parts[0]
                        signal = int(parts[1]) if parts[1].isdigit() else 0
                        security = parts[2] if len(parts) > 2 else ""
                        
                        networks.append({
                            "ssid": ssid,
                            "signal": signal,
                            "security": security,
                            "channel": parts[3] if len(parts) > 3 else ""
                        })
            
            return networks
            
        except Exception as e:
            logger.error(f"Error scanning networks on macOS: {e}")
            return []
    
    def _scan_networks_linux(self) -> List[Dict[str, Any]]:
        """Scan WiFi networks on Linux/Raspberry Pi"""
        try:
            # Use iwlist to scan networks
            result = subprocess.run(
                ['sudo', 'iwlist', 'wlan0', 'scan'], 
                capture_output=True, text=True, timeout=15
            )
            
            networks = []
            if result.returncode == 0:
                current_network = {}
                
                for line in result.stdout.split('\n'):
                    line = line.strip()
                    
                    if 'ESSID:' in line:
                        if current_network:
                            networks.append(current_network)
                        current_network = {}
                        ssid = line.split('ESSID:')[1].strip().strip('"')
                        if ssid:
                            current_network['ssid'] = ssid
                    
                    elif 'Quality=' in line:
                        try:
                            quality_part = line.split('Quality=')[1].split()[0]
                            signal = int(quality_part.split('/')[0]) * 100 // int(quality_part.split('/')[1])
                            current_network['signal'] = signal
                        except:
                            current_network['signal'] = 0
                    
                    elif 'Encryption key:' in line:
                        encrypted = 'on' in line.lower()
                        current_network['security'] = 'WPA/WPA2' if encrypted else ''
                
                # Add the last network
                if current_network:
                    networks.append(current_network)
            
            # Remove duplicates and sort by signal strength
            unique_networks = {}
            for network in networks:
                if 'ssid' in network and network['ssid']:
                    unique_networks[network['ssid']] = network
            
            return sorted(
                list(unique_networks.values()), 
                key=lambda x: x.get('signal', 0), 
                reverse=True
            )
            
        except Exception as e:
            logger.error(f"Error scanning networks on Linux: {e}")
            return []
    
    def connect_to_wifi(self, ssid: str, password: str) -> Dict[str, Any]:
        """Connect to a WiFi network"""
        try:
            if self.system == "Darwin":  # macOS
                return self._connect_wifi_macos(ssid, password)
            else:  # Linux (Raspberry Pi)
                return self._connect_wifi_linux(ssid, password)
        except Exception as e:
            logger.error(f"Error connecting to WiFi: {e}")
            return {"success": False, "message": str(e)}
    
    def _connect_wifi_macos(self, ssid: str, password: str) -> Dict[str, Any]:
        """Connect to WiFi on macOS"""
        try:
            # Use networksetup to connect
            result = subprocess.run([
                "networksetup", "-setairportnetwork", "en0", ssid, password
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                # Wait a moment and check connection
                time.sleep(3)
                status = self.get_wifi_status()
                
                if status["connected"] and status["ssid"] == ssid:
                    return {"success": True, "message": f"Successfully connected to {ssid}"}
                else:
                    return {"success": False, "message": "Failed to establish connection"}
            else:
                return {"success": False, "message": f"Connection failed: {result.stderr}"}
                
        except Exception as e:
            logger.error(f"Error connecting to WiFi on macOS: {e}")
            return {"success": False, "message": str(e)}
    
    def _connect_wifi_linux(self, ssid: str, password: str) -> Dict[str, Any]:
        """Connect to WiFi on Linux/Raspberry Pi"""
        try:
            # Use nmcli to connect
            cmd = [
                "sudo", "nmcli", "device", "wifi", "connect", ssid,
                "password", password, "ifname", "wlan0"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                # Wait a moment and check connection
                time.sleep(3)
                status = self.get_wifi_status()
                
                if status["connected"] and status["ssid"] == ssid:
                    return {"success": True, "message": f"Successfully connected to {ssid}"}
                else:
                    return {"success": False, "message": "Failed to establish connection"}
            else:
                return {"success": False, "message": f"Connection failed: {result.stderr}"}
                
        except Exception as e:
            logger.error(f"Error connecting to WiFi on Linux: {e}")
            return {"success": False, "message": str(e)}
    
    def disconnect_wifi(self) -> Dict[str, Any]:
        """Disconnect from current WiFi network"""
        try:
            if self.system == "Darwin":  # macOS
                return self._disconnect_wifi_macos()
            else:  # Linux (Raspberry Pi)
                return self._disconnect_wifi_linux()
        except Exception as e:
            logger.error(f"Error disconnecting from WiFi: {e}")
            return {"success": False, "message": str(e)}
    
    def _disconnect_wifi_macos(self) -> Dict[str, Any]:
        """Disconnect from WiFi on macOS"""
        try:
            # Turn off WiFi
            result = subprocess.run([
                "networksetup", "-setairportpower", "en0", "off"
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                # Turn WiFi back on
                subprocess.run([
                    "networksetup", "-setairportpower", "en0", "on"
                ], capture_output=True, text=True, timeout=10)
                
                return {"success": True, "message": "Successfully disconnected from WiFi"}
            else:
                return {"success": False, "message": f"Disconnect failed: {result.stderr}"}
                
        except Exception as e:
            logger.error(f"Error disconnecting from WiFi on macOS: {e}")
            return {"success": False, "message": str(e)}
    
    def _disconnect_wifi_linux(self) -> Dict[str, Any]:
        """Disconnect from WiFi on Linux/Raspberry Pi"""
        try:
            # Use nmcli to disconnect
            result = subprocess.run([
                "sudo", "nmcli", "device", "disconnect", "wlan0"
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                return {"success": True, "message": "Successfully disconnected from WiFi"}
            else:
                return {"success": False, "message": f"Disconnect failed: {result.stderr}"}
                
        except Exception as e:
            logger.error(f"Error disconnecting from WiFi on Linux: {e}")
            return {"success": False, "message": str(e)}

# Global WiFi manager instance
wifi_manager = WiFiManager()

def init_wifi_api():
    """Initialize the WiFi API"""
    logger.info("WiFi API initialized")
    return wifi_manager

def register_socketio_handlers(socketio_app):
    """Register SocketIO handlers for WiFi events"""
    if not socketio_app:
        return
    
    @socketio_app.on('wifi_status_request')
    def handle_wifi_status_request():
        """Handle WiFi status request via SocketIO"""
        try:
            status = wifi_manager.get_wifi_status()
            socketio_app.emit('wifi_status_update', status)
        except Exception as e:
            logger.error(f"Error handling WiFi status request: {e}")
            socketio_app.emit('wifi_status_update', {"error": str(e)})
    
    @socketio_app.on('wifi_scan_request')
    def handle_wifi_scan_request():
        """Handle WiFi scan request via SocketIO"""
        try:
            networks = wifi_manager.scan_networks()
            socketio_app.emit('wifi_scan_results', {"networks": networks})
        except Exception as e:
            logger.error(f"Error handling WiFi scan request: {e}")
            socketio_app.emit('wifi_scan_results', {"error": str(e)})
    
    logger.info("WiFi SocketIO handlers registered")
