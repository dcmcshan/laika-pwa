#!/usr/bin/env python3
"""
Context Camera System for LAIKA LLM - macOS Version
Provides camera context for LLM interactions using the macOS camera service
"""

import os
import time
import json
import base64
from datetime import datetime
from typing import Optional, Dict, Any
import cv2
import numpy as np

class ContextCameraSystem:
    """Context camera system for providing visual context to LLM - macOS version"""
    
    def __init__(self):
        self.camera = None
        self.last_capture_time = None
        # Use local directory for macOS compatibility
        self.capture_directory = os.path.join(os.getcwd(), "captured_images")
        self.context_image_path = os.path.join(self.capture_directory, "content.png")  # Use content.png from our service
        self.context_data_path = os.path.join(self.capture_directory, "content.png.json")  # Use our metadata file
        
        # Ensure capture directory exists
        os.makedirs(self.capture_directory, exist_ok=True)
        
        print(f"📷 Context camera system initialized for macOS")
        print(f"📁 Using directory: {self.capture_directory}")
        print(f"🖼️  Looking for: {self.context_image_path}")
    
    def capture_context_now(self) -> bool:
        """Capture current context image - triggers our macOS camera service"""
        try:
            # Instead of capturing directly, we'll use the existing content.png from our service
            if os.path.exists(self.context_image_path):
                # Get the modification time to check if it's recent
                mtime = os.path.getmtime(self.context_image_path)
                self.last_capture_time = datetime.fromtimestamp(mtime)
                
                # Read the metadata if it exists
                if os.path.exists(self.context_data_path):
                    with open(self.context_data_path, 'r') as f:
                        metadata = json.load(f)
                else:
                    # Create basic metadata
                    metadata = {
                        "timestamp": self.last_capture_time.isoformat(),
                        "image_path": self.context_image_path,
                        "capture_method": "macos_camera_service"
                    }
                
                print(f"📷 Context image available: {self.context_image_path}")
                return True
            else:
                print(f"⚠️  No context image found at: {self.context_image_path}")
                return False
                
        except Exception as e:
            print(f"❌ Context capture error: {e}")
            return False
    
    def get_context_image_path(self) -> Optional[str]:
        """Get path to current context image"""
        if os.path.exists(self.context_image_path):
            return self.context_image_path
        return None
    
    def get_context_data(self) -> Optional[Dict[str, Any]]:
        """Get current context data"""
        try:
            if os.path.exists(self.context_data_path):
                with open(self.context_data_path, 'r') as f:
                    return json.load(f)
            elif os.path.exists(self.context_image_path):
                # Create basic data if metadata doesn't exist
                mtime = os.path.getmtime(self.context_image_path)
                return {
                    "timestamp": datetime.fromtimestamp(mtime).isoformat(),
                    "image_path": self.context_image_path,
                    "capture_method": "macos_camera_service",
                    "note": "Metadata file not found, using basic info"
                }
        except Exception as e:
            print(f"❌ Error reading context data: {e}")
        return None
    
    def encode_context_image(self) -> Optional[str]:
        """Encode context image to base64"""
        try:
            if os.path.exists(self.context_image_path):
                with open(self.context_image_path, 'rb') as f:
                    image_data = f.read()
                    return base64.b64encode(image_data).decode('utf-8')
        except Exception as e:
            print(f"❌ Error encoding context image: {e}")
        return None
    
    def is_image_recent(self, max_age_seconds: int = 30) -> bool:
        """Check if the context image is recent"""
        if not os.path.exists(self.context_image_path):
            return False
        
        try:
            mtime = os.path.getmtime(self.context_image_path)
            age = time.time() - mtime
            return age <= max_age_seconds
        except Exception as e:
            print(f"❌ Error checking image age: {e}")
            return False
    
    def cleanup(self):
        """Clean up resources"""
        if self.camera:
            self.camera.release()

# Global instance
_context_camera_system = None

def get_context_camera_system() -> ContextCameraSystem:
    """Get or create the global context camera system instance"""
    global _context_camera_system
    if _context_camera_system is None:
        _context_camera_system = ContextCameraSystem()
    return _context_camera_system

if __name__ == "__main__":
    # Test the context camera system
    camera_system = get_context_camera_system()
    
    print("🧪 Testing context camera system...")
    
    # Check if context image exists
    if camera_system.get_context_image_path():
        print("✅ Context image found")
        data = camera_system.get_context_data()
        if data:
            print(f"📋 Context data: {json.dumps(data, indent=2)}")
    else:
        print("❌ No context image found")
        print("💡 Run './capture_photo.sh' to capture a new image")
