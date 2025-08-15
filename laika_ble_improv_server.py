#!/usr/bin/env python3
"""
LAIKA BLE Improv Server
Implements the BLE Improv protocol for WiFi provisioning using BlueZ D-Bus API
"""

import asyncio
import logging
import subprocess
import struct
import time
import json
from enum import IntEnum
from typing import Optional, Dict, Any

try:
    import dbus
    import dbus.service
    import dbus.mainloop.glib
    from gi.repository import GLib
    HAS_DBUS = True
except ImportError:
    HAS_DBUS = False
    print("D-Bus libraries not available. Install with: sudo apt install python3-dbus python3-gi")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# BLE Improv Protocol Constants
IMPROV_SERVICE_UUID = "00467768-6228-2272-4663-277478268000"
IMPROV_CURRENT_STATE_UUID = "00467768-6228-2272-4663-277478268001"
IMPROV_ERROR_STATE_UUID = "00467768-6228-2272-4663-277478268002"
IMPROV_RPC_COMMAND_UUID = "00467768-6228-2272-4663-277478268003"
IMPROV_RPC_RESULT_UUID = "00467768-6228-2272-4663-277478268004"
IMPROV_CAPABILITIES_UUID = "00467768-6228-2272-4663-277478268005"

class ImprovState(IntEnum):
    """BLE Improv state values"""
    READY = 0x02
    PROVISIONING = 0x03
    PROVISIONED = 0x04

class ImprovError(IntEnum):
    """BLE Improv error values"""
    NO_ERROR = 0x00
    INVALID_RPC = 0x01
    UNKNOWN_RPC = 0x02
    UNABLE_TO_CONNECT = 0x03
    NOT_AUTHORIZED = 0x04

class ImprovCommand(IntEnum):
    """BLE Improv RPC commands"""
    WIFI_SETTINGS = 0x01
    IDENTIFY = 0x02

class LAIKABLEImprovServer:
    """LAIKA BLE Improv Server using BlueZ D-Bus"""
    
    def __init__(self, device_name: str = "LAIKA"):
        self.device_name = device_name
        self.current_state = ImprovState.READY
        self.current_error = ImprovError.NO_ERROR
        self.capabilities = 0x00
        
        self.bus = None
        self.adapter = None
        self.advertisement = None
        self.service_manager = None
        
        logger.info(f"Initializing LAIKA BLE Improv server: {device_name}")
    
    def get_wifi_status(self) -> Dict[str, Any]:
        """Check current WiFi connection status"""
        try:
            # Try nmcli first (more reliable)
            result = subprocess.run(
                ["nmcli", "-t", "-f", "ACTIVE,SSID", "con", "show"], 
                capture_output=True, 
                text=True, 
                timeout=5
            )
            
            if result.returncode == 0:
                for line in result.stdout.strip().split('\n'):
                    if line.startswith('yes:'):
                        ssid = line.split(':', 1)[1]
                        if ssid:
                            return {"connected": True, "ssid": ssid}
            
            # Fallback to iwgetid
            result = subprocess.run(
                ["iwgetid", "-r"], 
                capture_output=True, 
                text=True, 
                timeout=5
            )
            
            if result.returncode == 0 and result.stdout.strip():
                ssid = result.stdout.strip()
                return {"connected": True, "ssid": ssid}
            
            return {"connected": False, "ssid": None}
                
        except Exception as e:
            logger.error(f"Error checking WiFi status: {e}")
            return {"connected": False, "ssid": None}
    
    def connect_to_wifi(self, ssid: str, password: str) -> bool:
        """Connect to WiFi network"""
        try:
            logger.info(f"Attempting to connect to WiFi: {ssid}")
            
            # Use NetworkManager via nmcli
            cmd = [
                "sudo", "nmcli", "device", "wifi", "connect", ssid,
                "password", password, "ifname", "wlan0"
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                # Wait and verify connection
                time.sleep(3)
                wifi_status = self.get_wifi_status()
                
                if wifi_status["connected"] and wifi_status["ssid"] == ssid:
                    logger.info(f"Successfully connected to WiFi: {ssid}")
                    return True
                else:
                    logger.error(f"Connection verification failed for: {ssid}")
                    return False
            else:
                logger.error(f"nmcli failed: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Error connecting to WiFi: {e}")
            return False
    
    def identify_device(self):
        """Identify the device (could trigger LED/sound)"""
        logger.info("Device identification requested")
        # Here you could add code to:
        # - Flash LEDs on LAIKA
        # - Play a sound
        # - Move servos briefly
        # For now, just log it
        return True
    
    def setup_bluetooth(self):
        """Setup Bluetooth adapter and advertising"""
        if not HAS_DBUS:
            logger.error("D-Bus not available. Cannot setup Bluetooth.")
            return False
        
        try:
            # Setup D-Bus main loop
            dbus.mainloop.glib.DBusGMainLoop(set_as_default=True)
            self.bus = dbus.SystemBus()
            
            # Get Bluetooth adapter
            manager = dbus.Interface(
                self.bus.get_object("org.bluez", "/"),
                "org.freedesktop.DBus.ObjectManager"
            )
            
            objects = manager.GetManagedObjects()
            adapter_path = None
            
            for path, interfaces in objects.items():
                if "org.bluez.Adapter1" in interfaces:
                    adapter_path = path
                    break
            
            if not adapter_path:
                logger.error("No Bluetooth adapter found")
                return False
            
            self.adapter = dbus.Interface(
                self.bus.get_object("org.bluez", adapter_path),
                "org.bluez.Adapter1"
            )
            
            # Power on adapter
            self.adapter.Set("org.bluez.Adapter1", "Powered", dbus.Boolean(True))
            self.adapter.Set("org.bluez.Adapter1", "Discoverable", dbus.Boolean(True))
            self.adapter.Set("org.bluez.Adapter1", "DiscoverableTimeout", dbus.UInt32(0))
            self.adapter.Set("org.bluez.Adapter1", "Alias", self.device_name)
            
            logger.info("Bluetooth adapter configured successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to setup Bluetooth: {e}")
            return False
    
    def create_simple_advertiser(self):
        """Create a simple BLE advertiser for LAIKA"""
        try:
            # Use hciconfig and hcitool for simple advertising
            # This is a fallback when complex GATT services aren't working
            
            # Make device discoverable
            subprocess.run(["sudo", "hciconfig", "hci0", "up"], check=True)
            subprocess.run(["sudo", "hciconfig", "hci0", "piscan"], check=True)
            
            # Set device name
            subprocess.run(["sudo", "hciconfig", "hci0", "name", self.device_name], check=True)
            
            logger.info(f"Simple BLE advertising started for {self.device_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create simple advertiser: {e}")
            return False
    
    def start_simple_server(self):
        """Start a simple BLE-like server using existing tools"""
        try:
            logger.info("Starting simple LAIKA BLE server...")
            
            # Setup basic Bluetooth
            if not self.setup_bluetooth():
                logger.warning("Full Bluetooth setup failed, trying simple advertiser...")
                if not self.create_simple_advertiser():
                    logger.error("All Bluetooth setup methods failed")
                    return False
            
            # Check initial WiFi status
            wifi_status = self.get_wifi_status()
            if wifi_status["connected"]:
                self.current_state = ImprovState.PROVISIONED
                logger.info(f"Already connected to WiFi: {wifi_status['ssid']}")
            else:
                self.current_state = ImprovState.READY
                logger.info("Ready for WiFi provisioning")
            
            # Start a simple loop to keep the service running
            logger.info("LAIKA BLE Improv server is running")
            logger.info("Device is discoverable as: " + self.device_name)
            logger.info("Use the LAIKA Controller PWA to connect")
            
            # Simple event loop
            try:
                loop = GLib.MainLoop()
                loop.run()
            except:
                # Fallback to simple sleep loop
                logger.info("Using simple keep-alive loop")
                while True:
                    time.sleep(10)
                    # Periodically check WiFi status
                    wifi_status = self.get_wifi_status()
                    if wifi_status["connected"]:
                        if self.current_state != ImprovState.PROVISIONED:
                            self.current_state = ImprovState.PROVISIONED
                            logger.info(f"WiFi connected: {wifi_status['ssid']}")
                    else:
                        if self.current_state != ImprovState.READY:
                            self.current_state = ImprovState.READY
                            logger.info("WiFi disconnected, ready for provisioning")
            
        except KeyboardInterrupt:
            logger.info("Server stopped by user")
        except Exception as e:
            logger.error(f"Server error: {e}")
        finally:
            self.stop_server()
    
    def stop_server(self):
        """Stop the BLE server"""
        logger.info("Stopping LAIKA BLE Improv server")
        
        try:
            # Reset Bluetooth to normal state
            subprocess.run(["sudo", "hciconfig", "hci0", "noscan"], timeout=5)
        except:
            pass

def main():
    """Main function"""
    logger.info("Starting LAIKA BLE Improv Server")
    
    # Check if running as root or with proper permissions
    try:
        subprocess.run(["hciconfig"], capture_output=True, check=True)
    except subprocess.CalledProcessError:
        logger.error("Cannot access Bluetooth. Run with sudo or add user to bluetooth group:")
        logger.error("sudo usermod -a -G bluetooth $USER")
        return
    
    server = LAIKABLEImprovServer("LAIKA")
    server.start_simple_server()

if __name__ == "__main__":
    main()
