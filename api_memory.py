#!/usr/bin/env python3
"""
LAIKA Memory API Module
Handles memory storage, retrieval, and management for LAIKA's knowledge base
"""

from flask import Blueprint, request, jsonify
from flask_socketio import emit
from datetime import datetime
import json
import os
import sqlite3
import threading
import time
import logging
import hashlib
from typing import Dict, List, Optional, Any

# Configure logging
logger = logging.getLogger(__name__)

# Create Blueprint for Memory routes
memory_bp = Blueprint('memory', __name__, url_prefix='/api/memory')

# Global SocketIO app reference (will be set by main app)
socketio_app = None
SOCKETIO_AVAILABLE = False

class MemoryManager:
    """Manage LAIKA's memory storage and retrieval"""
    
    def __init__(self, db_path="laika_memory.db"):
        self.db_path = db_path
        self.db_lock = threading.Lock()
        self.init_database()
        
    def init_database(self):
        """Initialize the memory database"""
        try:
            with self.db_lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Create memories table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS memories (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        memory_id TEXT UNIQUE NOT NULL,
                        category TEXT NOT NULL,
                        title TEXT NOT NULL,
                        content TEXT NOT NULL,
                        metadata TEXT,
                        importance REAL DEFAULT 1.0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        access_count INTEGER DEFAULT 0,
                        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Create conversations table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS conversations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        conversation_id TEXT UNIQUE NOT NULL,
                        user_id TEXT NOT NULL,
                        messages TEXT NOT NULL,
                        summary TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Create knowledge base table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS knowledge_base (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        topic TEXT NOT NULL,
                        content TEXT NOT NULL,
                        source TEXT,
                        confidence REAL DEFAULT 1.0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Create indexes
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_knowledge_topic ON knowledge_base(topic)')
                
                conn.commit()
                conn.close()
                
                logger.info("Memory database initialized successfully")
                
        except Exception as e:
            logger.error(f"Error initializing memory database: {e}")
    
    def store_memory(self, category: str, title: str, content: str, 
                    metadata: Optional[Dict] = None, importance: float = 1.0) -> Dict:
        """Store a new memory"""
        try:
            memory_id = hashlib.md5(f"{category}:{title}:{time.time()}".encode()).hexdigest()
            
            with self.db_lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute('''
                    INSERT INTO memories (memory_id, category, title, content, metadata, importance)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    memory_id,
                    category,
                    title,
                    content,
                    json.dumps(metadata) if metadata else None,
                    importance
                ))
                
                conn.commit()
                conn.close()
                
                # Broadcast to SocketIO clients
                if SOCKETIO_AVAILABLE and socketio_app:
                    socketio_app.emit('memory_stored', {
                        'memory_id': memory_id,
                        'category': category,
                        'title': title,
                        'timestamp': datetime.now().isoformat()
                    })
                
                return {
                    'success': True,
                    'memory_id': memory_id,
                    'message': 'Memory stored successfully'
                }
                
        except Exception as e:
            logger.error(f"Error storing memory: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def retrieve_memory(self, memory_id: str) -> Dict:
        """Retrieve a specific memory by ID"""
        try:
            with self.db_lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT memory_id, category, title, content, metadata, importance, 
                           created_at, updated_at, access_count, last_accessed
                    FROM memories WHERE memory_id = ?
                ''', (memory_id,))
                
                row = cursor.fetchone()
                conn.close()
                
                if row:
                    # Update access count and last accessed
                    self._update_memory_access(memory_id)
                    
                    return {
                        'success': True,
                        'memory': {
                            'memory_id': row[0],
                            'category': row[1],
                            'title': row[2],
                            'content': row[3],
                            'metadata': json.loads(row[4]) if row[4] else None,
                            'importance': row[5],
                            'created_at': row[6],
                            'updated_at': row[7],
                            'access_count': row[8],
                            'last_accessed': row[9]
                        }
                    }
                else:
                    return {
                        'success': False,
                        'error': 'Memory not found'
                    }
                    
        except Exception as e:
            logger.error(f"Error retrieving memory: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def search_memories(self, query: str, category: Optional[str] = None, 
                       limit: int = 10) -> Dict:
        """Search memories by content or title"""
        try:
            with self.db_lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                if category:
                    cursor.execute('''
                        SELECT memory_id, category, title, content, importance, 
                               created_at, access_count
                        FROM memories 
                        WHERE category = ? AND (title LIKE ? OR content LIKE ?)
                        ORDER BY importance DESC, access_count DESC
                        LIMIT ?
                    ''', (category, f'%{query}%', f'%{query}%', limit))
                else:
                    cursor.execute('''
                        SELECT memory_id, category, title, content, importance, 
                               created_at, access_count
                        FROM memories 
                        WHERE title LIKE ? OR content LIKE ?
                        ORDER BY importance DESC, access_count DESC
                        LIMIT ?
                    ''', (f'%{query}%', f'%{query}%', limit))
                
                rows = cursor.fetchall()
                conn.close()
                
                memories = []
                for row in rows:
                    memories.append({
                        'memory_id': row[0],
                        'category': row[1],
                        'title': row[2],
                        'content': row[3][:200] + '...' if len(row[3]) > 200 else row[3],
                        'importance': row[4],
                        'created_at': row[5],
                        'access_count': row[6]
                    })
                
                return {
                    'success': True,
                    'memories': memories,
                    'count': len(memories)
                }
                
        except Exception as e:
            logger.error(f"Error searching memories: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_memories_by_category(self, category: str, limit: int = 20) -> Dict:
        """Get all memories in a specific category"""
        try:
            with self.db_lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT memory_id, title, content, importance, created_at, access_count
                    FROM memories 
                    WHERE category = ?
                    ORDER BY importance DESC, created_at DESC
                    LIMIT ?
                ''', (category, limit))
                
                rows = cursor.fetchall()
                conn.close()
                
                memories = []
                for row in rows:
                    memories.append({
                        'memory_id': row[0],
                        'title': row[1],
                        'content': row[2][:200] + '...' if len(row[2]) > 200 else row[2],
                        'importance': row[3],
                        'created_at': row[4],
                        'access_count': row[5]
                    })
                
                return {
                    'success': True,
                    'memories': memories,
                    'category': category,
                    'count': len(memories)
                }
                
        except Exception as e:
            logger.error(f"Error getting memories by category: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def store_conversation(self, user_id: str, messages: List[Dict], 
                          summary: Optional[str] = None) -> Dict:
        """Store a conversation"""
        try:
            conversation_id = hashlib.md5(f"{user_id}:{time.time()}".encode()).hexdigest()
            
            with self.db_lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute('''
                    INSERT INTO conversations (conversation_id, user_id, messages, summary)
                    VALUES (?, ?, ?, ?)
                ''', (
                    conversation_id,
                    user_id,
                    json.dumps(messages),
                    summary
                ))
                
                conn.commit()
                conn.close()
                
                return {
                    'success': True,
                    'conversation_id': conversation_id,
                    'message': 'Conversation stored successfully'
                }
                
        except Exception as e:
            logger.error(f"Error storing conversation: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_conversation_history(self, user_id: str, limit: int = 10) -> Dict:
        """Get conversation history for a user"""
        try:
            with self.db_lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT conversation_id, messages, summary, created_at
                    FROM conversations 
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT ?
                ''', (user_id, limit))
                
                rows = cursor.fetchall()
                conn.close()
                
                conversations = []
                for row in rows:
                    messages = json.loads(row[1])
                    conversations.append({
                        'conversation_id': row[0],
                        'message_count': len(messages),
                        'summary': row[2],
                        'created_at': row[3],
                        'last_message': messages[-1]['content'] if messages else None
                    })
                
                return {
                    'success': True,
                    'conversations': conversations,
                    'user_id': user_id,
                    'count': len(conversations)
                }
                
        except Exception as e:
            logger.error(f"Error getting conversation history: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def store_knowledge(self, topic: str, content: str, source: Optional[str] = None,
                       confidence: float = 1.0) -> Dict:
        """Store knowledge base entry"""
        try:
            with self.db_lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute('''
                    INSERT INTO knowledge_base (topic, content, source, confidence)
                    VALUES (?, ?, ?, ?)
                ''', (topic, content, source, confidence))
                
                conn.commit()
                conn.close()
                
                return {
                    'success': True,
                    'message': 'Knowledge stored successfully'
                }
                
        except Exception as e:
            logger.error(f"Error storing knowledge: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def search_knowledge(self, topic: str) -> Dict:
        """Search knowledge base by topic"""
        try:
            with self.db_lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT topic, content, source, confidence, created_at
                    FROM knowledge_base 
                    WHERE topic LIKE ?
                    ORDER BY confidence DESC, created_at DESC
                ''', (f'%{topic}%',))
                
                rows = cursor.fetchall()
                conn.close()
                
                knowledge = []
                for row in rows:
                    knowledge.append({
                        'topic': row[0],
                        'content': row[1],
                        'source': row[2],
                        'confidence': row[3],
                        'created_at': row[4]
                    })
                
                return {
                    'success': True,
                    'knowledge': knowledge,
                    'count': len(knowledge)
                }
                
        except Exception as e:
            logger.error(f"Error searching knowledge: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_memory_stats(self) -> Dict:
        """Get memory statistics"""
        try:
            with self.db_lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Get counts
                cursor.execute('SELECT COUNT(*) FROM memories')
                memory_count = cursor.fetchone()[0]
                
                cursor.execute('SELECT COUNT(*) FROM conversations')
                conversation_count = cursor.fetchone()[0]
                
                cursor.execute('SELECT COUNT(*) FROM knowledge_base')
                knowledge_count = cursor.fetchone()[0]
                
                # Get categories
                cursor.execute('SELECT category, COUNT(*) FROM memories GROUP BY category')
                categories = dict(cursor.fetchall())
                
                # Get total size
                cursor.execute('SELECT SUM(LENGTH(content)) FROM memories')
                total_size = cursor.fetchone()[0] or 0
                
                conn.close()
                
                return {
                    'success': True,
                    'stats': {
                        'total_memories': memory_count,
                        'total_conversations': conversation_count,
                        'total_knowledge': knowledge_count,
                        'categories': categories,
                        'total_size_bytes': total_size,
                        'total_size_mb': round(total_size / (1024 * 1024), 2)
                    }
                }
                
        except Exception as e:
            logger.error(f"Error getting memory stats: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _update_memory_access(self, memory_id: str):
        """Update memory access count and timestamp"""
        try:
            with self.db_lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute('''
                    UPDATE memories 
                    SET access_count = access_count + 1, last_accessed = CURRENT_TIMESTAMP
                    WHERE memory_id = ?
                ''', (memory_id,))
                
                conn.commit()
                conn.close()
                
        except Exception as e:
            logger.error(f"Error updating memory access: {e}")

# Global memory manager instance
memory_manager = MemoryManager()

def init_memory_api(app, socketio=None):
    """Initialize Memory API with Flask app and SocketIO"""
    global socketio_app, SOCKETIO_AVAILABLE
    
    if socketio:
        socketio_app = socketio
        SOCKETIO_AVAILABLE = True
    
    # Register blueprint
    app.register_blueprint(memory_bp)
    
    print("✅ Memory API module initialized")

@memory_bp.route('/store', methods=['POST'])
def store_memory_endpoint():
    """Store a new memory"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data received'}), 400
        
        category = data.get('category', 'general')
        title = data.get('title', '')
        content = data.get('content', '')
        metadata = data.get('metadata')
        importance = data.get('importance', 1.0)
        
        if not title or not content:
            return jsonify({'success': False, 'error': 'Title and content are required'}), 400
        
        result = memory_manager.store_memory(category, title, content, metadata, importance)
        
        return jsonify({
            'success': result['success'],
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in store memory endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@memory_bp.route('/retrieve/<memory_id>', methods=['GET'])
def retrieve_memory_endpoint(memory_id):
    """Retrieve a specific memory"""
    try:
        result = memory_manager.retrieve_memory(memory_id)
        
        return jsonify({
            'success': result['success'],
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in retrieve memory endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@memory_bp.route('/search', methods=['GET'])
def search_memories_endpoint():
    """Search memories"""
    try:
        query = request.args.get('q', '')
        category = request.args.get('category')
        limit = int(request.args.get('limit', 10))
        
        if not query:
            return jsonify({'success': False, 'error': 'Query parameter required'}), 400
        
        result = memory_manager.search_memories(query, category, limit)
        
        return jsonify({
            'success': result['success'],
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in search memories endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@memory_bp.route('/category/<category>', methods=['GET'])
def get_memories_by_category_endpoint(category):
    """Get memories by category"""
    try:
        limit = int(request.args.get('limit', 20))
        result = memory_manager.get_memories_by_category(category, limit)
        
        return jsonify({
            'success': result['success'],
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in get memories by category endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@memory_bp.route('/conversation/store', methods=['POST'])
def store_conversation_endpoint():
    """Store a conversation"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data received'}), 400
        
        user_id = data.get('user_id', 'anonymous')
        messages = data.get('messages', [])
        summary = data.get('summary')
        
        if not messages:
            return jsonify({'success': False, 'error': 'Messages are required'}), 400
        
        result = memory_manager.store_conversation(user_id, messages, summary)
        
        return jsonify({
            'success': result['success'],
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in store conversation endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@memory_bp.route('/conversation/history/<user_id>', methods=['GET'])
def get_conversation_history_endpoint(user_id):
    """Get conversation history for a user"""
    try:
        limit = int(request.args.get('limit', 10))
        result = memory_manager.get_conversation_history(user_id, limit)
        
        return jsonify({
            'success': result['success'],
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in get conversation history endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@memory_bp.route('/knowledge/store', methods=['POST'])
def store_knowledge_endpoint():
    """Store knowledge base entry"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'error': 'No data received'}), 400
        
        topic = data.get('topic', '')
        content = data.get('content', '')
        source = data.get('source')
        confidence = data.get('confidence', 1.0)
        
        if not topic or not content:
            return jsonify({'success': False, 'error': 'Topic and content are required'}), 400
        
        result = memory_manager.store_knowledge(topic, content, source, confidence)
        
        return jsonify({
            'success': result['success'],
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in store knowledge endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@memory_bp.route('/knowledge/search', methods=['GET'])
def search_knowledge_endpoint():
    """Search knowledge base"""
    try:
        topic = request.args.get('topic', '')
        
        if not topic:
            return jsonify({'success': False, 'error': 'Topic parameter required'}), 400
        
        result = memory_manager.search_knowledge(topic)
        
        return jsonify({
            'success': result['success'],
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in search knowledge endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@memory_bp.route('/stats', methods=['GET'])
def get_memory_stats_endpoint():
    """Get memory statistics"""
    try:
        result = memory_manager.get_memory_stats()
        
        return jsonify({
            'success': result['success'],
            'result': result,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in get memory stats endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# SocketIO event handlers
def register_memory_handlers(socketio):
    """Register SocketIO event handlers for memory"""
    global socketio_app, SOCKETIO_AVAILABLE
    
    socketio_app = socketio
    SOCKETIO_AVAILABLE = True
    
    @socketio.on('connect')
    def handle_memory_connect():
        """Handle client connection for memory"""
        stats = memory_manager.get_memory_stats()
        emit('memory_stats', stats['result'] if stats['success'] else {})
    
    @socketio.on('store_memory')
    def handle_store_memory(data):
        """Handle memory storage request"""
        result = memory_manager.store_memory(
            data.get('category', 'general'),
            data.get('title', ''),
            data.get('content', ''),
            data.get('metadata'),
            data.get('importance', 1.0)
        )
        emit('memory_stored', result)
    
    @socketio.on('search_memories')
    def handle_search_memories(data):
        """Handle memory search request"""
        result = memory_manager.search_memories(
            data.get('query', ''),
            data.get('category'),
            data.get('limit', 10)
        )
        emit('memory_search_results', result)
    
    @socketio.on('get_memory_stats')
    def handle_get_stats():
        """Handle memory stats request"""
        result = memory_manager.get_memory_stats()
        emit('memory_stats', result['result'] if result['success'] else {})
    
    print("✅ Memory SocketIO handlers registered")
