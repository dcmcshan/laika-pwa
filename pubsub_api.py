#!/usr/bin/env python3
"""
LAIKA PubSub API Module
Provides API endpoints for accessing the pubsub log system
"""

import os
import json
import sys
from datetime import datetime
from typing import Dict, List, Optional
from flask import Blueprint, jsonify, request

# Add parent directory to path to import laika_pubsub_server
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from laika_pubsub_server import get_recent_log_entries, clear_pubsub_log, get_client_count, get_subscription_count
    PUBSUB_AVAILABLE = True
except ImportError:
    PUBSUB_AVAILABLE = False
    print("⚠️  PubSub server not available - running without pubsub functionality")

# Create Flask Blueprint
pubsub_bp = Blueprint('pubsub', __name__, url_prefix='/api/pubsub')

@pubsub_bp.route('/log', methods=['GET'])
def get_pubsub_log():
    """Get recent pubsub log entries"""
    if not PUBSUB_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'PubSub system not available',
            'entries': []
        }), 503
    
    try:
        limit = int(request.args.get('limit', 100))
        entries = get_recent_log_entries(limit=limit)
        
        return jsonify({
            'success': True,
            'entries': entries,
            'total': len(entries),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'entries': []
        }), 500

@pubsub_bp.route('/log', methods=['DELETE'])
def clear_log():
    """Clear the pubsub log"""
    if not PUBSUB_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'PubSub system not available'
        }), 503
    
    try:
        clear_pubsub_log()
        return jsonify({
            'success': True,
            'message': 'PubSub log cleared',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@pubsub_bp.route('/status', methods=['GET'])
def get_pubsub_status():
    """Get pubsub system status"""
    if not PUBSUB_AVAILABLE:
        return jsonify({
            'success': False,
            'error': 'PubSub system not available',
            'status': 'unavailable'
        }), 503
    
    try:
        client_count = get_client_count()
        subscription_count = get_subscription_count()
        
        return jsonify({
            'success': True,
            'status': 'running',
            'clients': client_count,
            'subscriptions': subscription_count,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'status': 'error'
        }), 500

def init_pubsub_api(app):
    """Initialize the pubsub API with the Flask app"""
    app.register_blueprint(pubsub_bp)
    print("✅ PubSub API initialized")
