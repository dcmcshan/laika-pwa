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
import os
from typing import Dict, List, Any
import logging

logger = logging.getLogger(__name__)

class WiFiManager:
    """WiFi management for LAIKA system"""
    
    def __init__(self):
        self.system = platform.system()
        self.config_dir = os.path.join(os.path.dirname(__file__), 'config')
        self.wifi_config_file = os.path.join(self.config_dir, 'wifi_networks.json')
        self._ensure_config_dir()
        logger.info(f"WiFi Manager initialized for {self.system}")
    
    def _ensure_config_dir(self):
        """Ensure config directory exists"""
        os.makedirs(self.config_dir, exist_ok=True)
    
    def _load_known_networks(self) -> List[Dict[str, Any]]:
        """Load known WiFi networks from config file"""
        try:
            if os.path.exists(self.wifi_config_file):
                with open(self.wifi_config_file, 'r') as f:
                    data = json.load(f)
                    return data.get('networks', [])
            return []
        except Exception as e:
            logger.error(f"Error loading known networks: {e}")
            return []
    
    def _save_known_networks(self, networks: List[Dict[str, Any]]):
        """Save known WiFi networks to config file"""
        try:
            data = {'networks': networks}
            with open(self.wifi_config_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving known networks: {e}")
    
    def _add_known_network(self, ssid: str, security: str = ""):
        """Add a network to known networks list"""
        try:
            networks = self._load_known_networks()
            
            # Check if network already exists
            for network in networks:
                if network.get('ssid') == ssid:
                    return  # Already exists
            
            # Add new network
            networks.append({
                'ssid': ssid,
                'security': security,
                'last_connected': time.time(),
                'connection_count': 0
            })
            
            self._save_known_networks(networks)
            logger.info(f"Added network to known networks: {ssid}")
        except Exception as e:
            logger.error(f"Error adding known network: {e}")
    
    def _update_network_stats(self, ssid: str):
        """Update connection statistics for a known network"""
        try:
            networks = self._load_known_networks()
            
            for network in networks:
                if network.get('ssid') == ssid:
                    network['last_connected'] = time.time()
                    network['connection_count'] = network.get('connection_count', 0) + 1
                    break
            
            self._save_known_networks(networks)
        except Exception as e:
            logger.error(f"Error updating network stats: {e}")
    
    def get_known_networks(self) -> List[Dict[str, Any]]:
        """Get list of known WiFi networks"""
        try:
            networks = self._load_known_networks()
            
            # Add current availability status to known networks
            available_networks = self.scan_networks()
            available_ssids = {net['ssid'] for net in available_networks}
            
            for network in networks:
                network['available'] = network['ssid'] in available_ssids
                # Add signal strength if available
                for avail_net in available_networks:
                    if avail_net['ssid'] == network['ssid']:
                        network['signal'] = avail_net.get('signal', 0)
                        break
                else:
                    network['signal'] = 0
            
            # Sort by last connected time (most recent first)
            networks.sort(key=lambda x: x.get('last_connected', 0), reverse=True)
            
            return networks
        except Exception as e:
            logger.error(f"Error getting known networks: {e}")
            return []
    
    def remove_known_network(self, ssid: str) -> Dict[str, Any]:
        """Remove a network from known networks"""
        try:
            networks = self._load_known_networks()
            original_count = len(networks)
            
            networks = [net for net in networks if net.get('ssid') != ssid]
            
            if len(networks) < original_count:
                self._save_known_networks(networks)
                return {"success": True, "message": f"Removed {ssid} from known networks"}
            else:
                return {"success": False, "message": f"Network {ssid} not found in known networks"}
        except Exception as e:
            logger.error(f"Error removing known network: {e}")
            return {"success": False, "message": str(e)}
    
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
            connected = False
            ssid = None
            
            # Method 1: Try system_profiler first (most reliable)
            try:
                result = subprocess.run(
                    ["system_profiler", "SPAirPortDataType"], 
                    capture_output=True, text=True, timeout=10
                )
                
                if result.returncode == 0:
                    lines = result.stdout.split('\n')
                    for i, line in enumerate(lines):
                        if 'Current Network Information:' in line:
                            # Look for the network name in the next few lines
                            for j in range(i+1, min(i+10, len(lines))):
                                next_line = lines[j].strip()
                                if next_line and ':' in next_line and not any(keyword in next_line for keyword in ['PHY Mode', 'Channel', 'Country Code', 'Network Type']):
                                    ssid = next_line.split(':')[0].strip()
                                    connected = True
                                    break
                            break
            except Exception as e:
                logger.error(f"Error using system_profiler: {e}")
            
            # Method 2: Fallback to networksetup
            if not connected:
                try:
                    result = subprocess.run(
                        ["networksetup", "-getairportnetwork", "en0"], 
                        capture_output=True, text=True, timeout=5
                    )
                    
                    if result.returncode == 0:
                        output = result.stdout.strip()
                        if "Current Wi-Fi Network:" in output:
                            ssid = output.split("Current Wi-Fi Network:")[1].strip()
                            connected = True
                except Exception as e:
                    logger.error(f"Error using networksetup: {e}")
            
            # Get IP address
            ip_address = None
            try:
                # Try to get IP from en0 interface first
                ip_result = subprocess.run(
                    ["ifconfig", "en0"], 
                    capture_output=True, text=True, timeout=5
                )
                if ip_result.returncode == 0:
                    for line in ip_result.stdout.split('\n'):
                        if 'inet ' in line and '127.0.0.1' not in line:
                            ip_address = line.split('inet ')[1].split()[0]
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
            # Try multiple methods to scan networks
            networks = []
            
            # Method 1: Try airport command with different paths
            airport_paths = [
                "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport",
                "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/A/Resources/airport",
                "/usr/local/bin/airport"
            ]
            
            for airport_path in airport_paths:
                try:
                    result = subprocess.run(
                        [airport_path, "-s"],
                        capture_output=True, text=True, timeout=10
                    )
                    
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
                        break  # If successful, break out of the loop
                except:
                    continue
            
            # Method 2: If airport command fails, try using system_profiler
            if not networks:
                try:
                    result = subprocess.run(
                        ["system_profiler", "SPAirPortDataType"],
                        capture_output=True, text=True, timeout=15
                    )
                    
                    if result.returncode == 0:
                        current_network = {}
                        in_network_section = False
                        
                        for line in result.stdout.split('\n'):
                            line = line.strip()
                            
                            # Look for "Other Local Wi-Fi Networks" section
                            if 'Other Local Wi-Fi Networks:' in line:
                                in_network_section = True
                                continue
                            
                            # Only process lines when we're in the network section
                            if in_network_section and ':' in line:
                                # Check if this looks like a network name (not a property)
                                if not any(keyword in line for keyword in ['Security:', 'Signal / Noise:', 'PHY Mode:', 'Channel:', 'Country Code:', 'Network Type:', 'MAC Address:', 'Firmware Version:', 'Card Type:', 'Status:', 'Locale:', 'Wake On Wireless:', 'AirDrop:', 'Auto Unlock:', 'Transmit Rate:', 'MCS Index:', 'Interfaces:', 'en0:', 'awdl0:', 'CoreWLAN:', 'CoreWLANKit:', 'Menu Extra:', 'System Information:', 'IO80211 Family:', 'Diagnostics:', 'AirPort Utility:', 'Software Versions:', 'Wi-Fi:']):
                                    # This might be a network name
                                    if current_network and 'ssid' in current_network:
                                        networks.append(current_network)
                                    current_network = {}
                                    ssid = line.split(':')[0].strip()
                                    current_network['ssid'] = ssid
                            elif 'Security:' in line and in_network_section and current_network:
                                security = line.split('Security:')[1].strip()
                                current_network['security'] = security
                            elif 'Signal / Noise:' in line and in_network_section and current_network:
                                # Extract signal strength from signal/noise ratio
                                signal_part = line.split('Signal / Noise:')[1].strip()
                                try:
                                    signal = int(signal_part.split('/')[0].strip())
                                    current_network['signal'] = min(signal, 100)  # Cap at 100%
                                except:
                                    current_network['signal'] = 50  # Default
                            elif line == '' and in_network_section:
                                # End of network section
                                in_network_section = False
                        
                        # Add the last network
                        if current_network and 'ssid' in current_network:
                            networks.append(current_network)
                        
                        # Clean up networks - remove any that don't look like real networks
                        networks = [net for net in networks if net.get('ssid') and 
                                  not any(keyword in net['ssid'] for keyword in ['Supported Channels', 'Current Network Information', 'Interfaces', 'en0', 'awdl0'])]
                except Exception as e:
                    logger.error(f"Error using system_profiler: {e}")
            
            # Method 3: Fallback - return known networks from system
            if not networks:
                try:
                    # Get known networks from system
                    result = subprocess.run(
                        ["networksetup", "-listpreferredwirelessnetworks", "en0"],
                        capture_output=True, text=True, timeout=5
                    )
                    
                    if result.returncode == 0:
                        for line in result.stdout.split('\n'):
                            line = line.strip()
                            if line and not line.startswith('Preferred networks'):
                                networks.append({
                                    "ssid": line,
                                    "signal": 0,  # Unknown signal strength
                                    "security": "Unknown",
                                    "channel": ""
                                })
                except Exception as e:
                    logger.error(f"Error getting preferred networks: {e}")
            
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
                    # Add to known networks and update stats
                    self._add_known_network(ssid, "WPA/WPA2")
                    self._update_network_stats(ssid)
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
                    # Add to known networks and update stats
                    self._add_known_network(ssid, "WPA/WPA2")
                    self._update_network_stats(ssid)
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
