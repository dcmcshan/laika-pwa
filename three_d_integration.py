#!/usr/bin/env python3
"""
3D Integration Module for LAIKA PWA
Simple integration to register 3D routes with the main Flask app
"""

import logging

logger = logging.getLogger(__name__)

def integrate_3d_routes(app):
    """Integrate 3D routes with the main Flask app"""
    try:
        # Import and register 3D routes
        from three_d_routes import register_3d_routes
        
        success = register_3d_routes(app)
        
        if success:
            logger.info("✅ 3D routes integrated successfully")
            return True
        else:
            logger.error("❌ Failed to integrate 3D routes")
            return False
            
    except ImportError as e:
        logger.warning(f"⚠️ 3D routes not available: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Error integrating 3D routes: {e}")
        return False

def get_3d_available():
    """Check if 3D functionality is available"""
    try:
        from three_d_api import get_3d_api
        api = get_3d_api()
        return True
    except Exception:
        return False
