#!/usr/bin/env python3
"""
3D Model API for LAIKA PWA
Handles 3D model loading, joint states, and ROS integration
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path

logger = logging.getLogger(__name__)

class LAIKA3DAPI:
    """3D Model API for LAIKA PWA"""
    
    def __init__(self, base_dir: str = None):
        self.base_dir = base_dir or os.path.dirname(os.path.abspath(__file__))
        self.puppypi_dir = os.path.join(self.base_dir, 'puppypi_description')
        self.urdf_file = os.path.join(self.puppypi_dir, 'puppy.urdf')
        self.meshes_dir = os.path.join(self.puppypi_dir, 'meshes')
        
        # Model metadata
        self.model_info = {
            'name': 'PuppyPi Robot',
            'version': '1.0.0',
            'description': 'Quadruped robot with 12 degrees of freedom',
            'joints': [],
            'links': [],
            'materials': []
        }
        
        # Joint states cache
        self.joint_states = {}
        self.last_update = None
        
        # Initialize
        self._load_model_info()
    
    def _load_model_info(self):
        """Load model information from URDF and meshes"""
        try:
            if os.path.exists(self.urdf_file):
                self._parse_urdf_info()
            
            if os.path.exists(self.meshes_dir):
                self._load_mesh_info()
                
            logger.info(f"✅ 3D Model API initialized with {len(self.model_info['joints'])} joints")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize 3D Model API: {e}")
    
    def _parse_urdf_info(self):
        """Parse URDF file to extract joint and link information"""
        try:
            import xml.etree.ElementTree as ET
            
            tree = ET.parse(self.urdf_file)
            root = tree.getroot()
            
            # Extract joints
            for joint in root.findall('.//joint'):
                joint_info = {
                    'name': joint.get('name', ''),
                    'type': joint.get('type', ''),
                    'parent': '',
                    'child': ''
                }
                
                parent = joint.find('parent')
                if parent is not None:
                    joint_info['parent'] = parent.get('link', '')
                
                child = joint.find('child')
                if child is not None:
                    joint_info['child'] = child.get('link', '')
                
                self.model_info['joints'].append(joint_info)
            
            # Extract links
            for link in root.findall('.//link'):
                link_info = {
                    'name': link.get('name', ''),
                    'visual': False,
                    'collision': False
                }
                
                if link.find('visual') is not None:
                    link_info['visual'] = True
                
                if link.find('collision') is not None:
                    link_info['collision'] = True
                
                self.model_info['links'].append(link_info)
            
            # Extract materials
            for material in root.findall('.//material'):
                material_info = {
                    'name': material.get('name', ''),
                    'color': {'r': 0.8, 'g': 0.8, 'b': 0.8, 'a': 1.0}
                }
                
                color = material.find('color')
                if color is not None:
                    rgba = color.get('rgba', '0.8 0.8 0.8 1.0').split()
                    if len(rgba) >= 4:
                        material_info['color'] = {
                            'r': float(rgba[0]),
                            'g': float(rgba[1]),
                            'b': float(rgba[2]),
                            'a': float(rgba[3])
                        }
                
                self.model_info['materials'].append(material_info)
                
        except Exception as e:
            logger.error(f"❌ Failed to parse URDF: {e}")
    
    def _load_mesh_info(self):
        """Load information about available mesh files"""
        try:
            mesh_files = []
            for file in os.listdir(self.meshes_dir):
                if file.endswith(('.stl', '.STL')):
                    mesh_files.append({
                        'name': file,
                        'path': f'/puppypi_description/meshes/{file}',
                        'size': os.path.getsize(os.path.join(self.meshes_dir, file))
                    })
            
            self.model_info['meshes'] = mesh_files
            logger.info(f"📦 Loaded {len(mesh_files)} mesh files")
            
        except Exception as e:
            logger.error(f"❌ Failed to load mesh info: {e}")
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get complete model information"""
        return {
            'success': True,
            'model': self.model_info,
            'timestamp': datetime.now().isoformat(),
            'status': {
                'urdf_loaded': os.path.exists(self.urdf_file),
                'meshes_available': os.path.exists(self.meshes_dir),
                'joint_count': len(self.model_info['joints']),
                'link_count': len(self.model_info['links'])
            }
        }
    
    def get_joint_states(self) -> Dict[str, Any]:
        """Get current joint states"""
        return {
            'success': True,
            'joint_states': self.joint_states,
            'timestamp': self.last_update or datetime.now().isoformat(),
            'joint_count': len(self.joint_states)
        }
    
    def update_joint_states(self, joint_data: Dict[str, Any]):
        """Update joint states from ROS or other sources"""
        try:
            if 'name' in joint_data and 'position' in joint_data:
                names = joint_data['name']
                positions = joint_data['position']
                
                for i, name in enumerate(names):
                    if i < len(positions):
                        self.joint_states[name] = {
                            'position': positions[i],
                            'velocity': joint_data.get('velocity', [0.0] * len(names))[i] if i < len(joint_data.get('velocity', [])) else 0.0,
                            'effort': joint_data.get('effort', [0.0] * len(names))[i] if i < len(joint_data.get('effort', [])) else 0.0
                        }
                
                self.last_update = datetime.now().isoformat()
                logger.debug(f"🔄 Updated {len(names)} joint states")
                
        except Exception as e:
            logger.error(f"❌ Failed to update joint states: {e}")
    
    def get_joint_info(self, joint_name: str) -> Dict[str, Any]:
        """Get information about a specific joint"""
        for joint in self.model_info['joints']:
            if joint['name'] == joint_name:
                return {
                    'success': True,
                    'joint': joint,
                    'current_state': self.joint_states.get(joint_name, {})
                }
        
        return {
            'success': False,
            'error': f'Joint "{joint_name}" not found'
        }
    
    def get_animation_presets(self) -> Dict[str, Any]:
        """Get predefined animation presets"""
        presets = {
            'idle': {
                'name': 'Idle',
                'description': 'Gentle breathing motion',
                'duration': 2.0,
                'joints': {
                    'lf_joint1': {'amplitude': 0.1, 'frequency': 1.0, 'phase': 0.0},
                    'rf_joint1': {'amplitude': 0.1, 'frequency': 1.0, 'phase': 0.0},
                    'lb_joint1': {'amplitude': 0.1, 'frequency': 1.0, 'phase': 0.0},
                    'rb_joint1': {'amplitude': 0.1, 'frequency': 1.0, 'phase': 0.0}
                }
            },
            'walk': {
                'name': 'Walk',
                'description': 'Walking gait animation',
                'duration': 1.5,
                'joints': {
                    'lf_joint1': {'amplitude': 0.3, 'frequency': 2.0, 'phase': 0.0},
                    'lf_joint2': {'amplitude': 0.2, 'frequency': 2.0, 'phase': 0.5},
                    'rf_joint1': {'amplitude': 0.3, 'frequency': 2.0, 'phase': 1.0},
                    'rf_joint2': {'amplitude': 0.2, 'frequency': 2.0, 'phase': 1.5},
                    'lb_joint1': {'amplitude': 0.3, 'frequency': 2.0, 'phase': 0.5},
                    'lb_joint2': {'amplitude': 0.2, 'frequency': 2.0, 'phase': 1.0},
                    'rb_joint1': {'amplitude': 0.3, 'frequency': 2.0, 'phase': 0.0},
                    'rb_joint2': {'amplitude': 0.2, 'frequency': 2.0, 'phase': 0.5}
                }
            },
            'sit': {
                'name': 'Sit',
                'description': 'Sitting pose',
                'duration': 1.0,
                'joints': {
                    'lf_joint1': {'position': -0.5},
                    'lf_joint2': {'position': 0.8},
                    'rf_joint1': {'position': -0.5},
                    'rf_joint2': {'position': 0.8},
                    'lb_joint1': {'position': -0.3},
                    'lb_joint2': {'position': 0.6},
                    'rb_joint1': {'position': -0.3},
                    'rb_joint2': {'position': 0.6}
                }
            },
            'dance': {
                'name': 'Dance',
                'description': 'Playful dance motion',
                'duration': 3.0,
                'joints': {
                    'lf_joint1': {'amplitude': 0.4, 'frequency': 3.0, 'phase': 0.0},
                    'lf_joint2': {'amplitude': 0.3, 'frequency': 3.0, 'phase': 0.5},
                    'rf_joint1': {'amplitude': 0.4, 'frequency': 3.0, 'phase': 1.0},
                    'rf_joint2': {'amplitude': 0.3, 'frequency': 3.0, 'phase': 1.5},
                    'lb_joint1': {'amplitude': 0.4, 'frequency': 3.0, 'phase': 0.5},
                    'lb_joint2': {'amplitude': 0.3, 'frequency': 3.0, 'phase': 1.0},
                    'rb_joint1': {'amplitude': 0.4, 'frequency': 3.0, 'phase': 0.0},
                    'rb_joint2': {'amplitude': 0.3, 'frequency': 3.0, 'phase': 0.5}
                }
            }
        }
        
        return {
            'success': True,
            'presets': presets,
            'count': len(presets)
        }
    
    def calculate_animation_frame(self, preset_name: str, time: float) -> Dict[str, float]:
        """Calculate joint positions for a given animation preset and time"""
        presets = self.get_animation_presets()
        
        if not presets['success'] or preset_name not in presets['presets']:
            return {}
        
        preset = presets['presets'][preset_name]
        joint_positions = {}
        
        for joint_name, config in preset['joints'].items():
            if 'position' in config:
                # Static position
                joint_positions[joint_name] = config['position']
            elif 'amplitude' in config and 'frequency' in config:
                # Animated position
                amplitude = config['amplitude']
                frequency = config['frequency']
                phase = config.get('phase', 0.0)
                
                position = amplitude * (time * frequency + phase)
                joint_positions[joint_name] = position
        
        return joint_positions
    
    def get_ros_integration_status(self) -> Dict[str, Any]:
        """Get ROS integration status and configuration"""
        return {
            'success': True,
            'rosbridge': {
                'enabled': True,
                'url': 'ws://localhost:9090',
                'topics': {
                    'joint_states': '/joint_states',
                    'robot_state': '/robot_state',
                    'tf': '/tf'
                }
            },
            'joint_state_topic': '/joint_states',
            'message_type': 'sensor_msgs/JointState',
            'update_frequency': 30.0
        }
    
    def get_viewer_config(self) -> Dict[str, Any]:
        """Get 3D viewer configuration"""
        return {
            'success': True,
            'viewer': {
                'camera': {
                    'position': [2, 2, 2],
                    'target': [0, 0.1, 0],
                    'fov': 45,
                    'near': 0.01,
                    'far': 100
                },
                'lighting': {
                    'ambient': {'color': [0.4, 0.4, 0.4], 'intensity': 0.6},
                    'directional': {'color': [1, 1, 1], 'intensity': 0.8, 'position': [10, 10, 5]},
                    'hemisphere': {'color': [0.6, 0.6, 0.6], 'intensity': 1.0}
                },
                'grid': {
                    'enabled': True,
                    'size': 4,
                    'divisions': 20,
                    'color': [0, 1, 1],
                    'secondary_color': [0.2, 0.2, 0.2]
                },
                'materials': {
                    'default': {'color': [0, 1, 1], 'transparent': True, 'opacity': 0.8},
                    'wireframe': {'color': [0, 1, 1], 'wireframe': True},
                    'highlight': {'color': [1, 1, 0], 'transparent': True, 'opacity': 0.9}
                }
            },
            'controls': {
                'orbit_controls': True,
                'damping': True,
                'damping_factor': 0.05,
                'max_polar_angle': 1.5708
            }
        }

# Global instance
_3d_api = None

def get_3d_api() -> LAIKA3DAPI:
    """Get the global 3D API instance"""
    global _3d_api
    if _3d_api is None:
        _3d_api = LAIKA3DAPI()
    return _3d_api
