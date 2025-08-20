#!/usr/bin/env python3
"""
Cursor Server Integration Module
Provides a clean /cursor endpoint for Cursor AI integration with LAIKA PWA
"""

import asyncio
import json
import logging
import os
import uuid
import subprocess
from datetime import datetime
from typing import Dict, Any, Optional, List
from pathlib import Path
import aiohttp
from aiohttp import web
import aiofiles

# Import OpenAI for real AI responses
try:
    from openai import AsyncOpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    print("Warning: OpenAI not available")
    OPENAI_AVAILABLE = False
    AsyncOpenAI = None

logger = logging.getLogger(__name__)

class CursorServerAPI:
    """Standalone Cursor Server API integration"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # OpenAI client setup
        self.openai_client = None
        self.openai_model = self.config.get("openai_model", "gpt-4o-mini")
        self.openai_api_key = self.config.get("openai_api_key") or os.getenv("OPENAI_API_KEY")
        
        # Initialize OpenAI client
        if OPENAI_AVAILABLE and self.openai_api_key:
            self.openai_client = AsyncOpenAI(api_key=self.openai_api_key)
            logger.info("✅ OpenAI client initialized")
        else:
            logger.warning("⚠️ OpenAI not available - using simulation mode")
        
        # Cursor server connection details (for detection only)
        self.cursor_host = "127.0.0.1"
        self.cursor_port = None
        self.connection_token = None
        self.is_available = bool(self.openai_client)
        
        # Session management
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self.max_sessions = 100
        
        # Initialize
        self._discover_cursor_server()
        
    def _discover_cursor_server(self):
        """Discover running Cursor server"""
        try:
            # Read connection token
            token_file = "/run/user/1000/cursor-remote-code.token.77b20c32f2812cd4cdf3092bdf5622e7"
            if os.path.exists(token_file):
                with open(token_file, 'r') as f:
                    self.connection_token = f.read().strip()
                logger.info(f"✅ Found Cursor connection token")
                self.is_available = True
            else:
                logger.warning("⚠️ Cursor connection token not found")
                self.is_available = False
                return
                
            # Find actual server port
            self.cursor_port = self._find_cursor_port()
            if self.cursor_port:
                logger.info(f"✅ Cursor server discovered on port: {self.cursor_port}")
            else:
                logger.warning("⚠️ Could not find Cursor server port")
                
        except Exception as e:
            logger.error(f"❌ Error discovering Cursor server: {e}")
            self.is_available = False
            
    def _find_cursor_port(self) -> Optional[int]:
        """Find the actual Cursor server port"""
        try:
            # Check for listening ports from cursor-server processes
            result = subprocess.run([
                'lsof', '-i', '-P', '-n', '-a', '-c', 'node'
            ], capture_output=True, text=True)
            
            for line in result.stdout.split('\n'):
                if 'cursor-server' in line and 'LISTEN' in line and '127.0.0.1:' in line:
                    # Extract port
                    parts = line.split()
                    for part in parts:
                        if '127.0.0.1:' in part:
                            port_str = part.split(':')[-1]
                            if port_str.isdigit():
                                port = int(port_str)
                                if port > 1024:  # Skip system ports
                                    return port
        except Exception as e:
            logger.error(f"❌ Error finding cursor port: {e}")
            
        return None
        
    def get_session(self, session_id: str) -> Dict[str, Any]:
        """Get or create a session"""
        if session_id not in self.sessions:
            # Clean up old sessions if we're at the limit
            if len(self.sessions) >= self.max_sessions:
                oldest_session = min(
                    self.sessions.keys(),
                    key=lambda k: self.sessions[k]['created_at']
                )
                del self.sessions[oldest_session]
                
            self.sessions[session_id] = {
                'id': session_id,
                'created_at': datetime.now().isoformat(),
                'last_activity': datetime.now().isoformat(),
                'messages': [],
                'context': {}
            }
            
        # Update last activity
        self.sessions[session_id]['last_activity'] = datetime.now().isoformat()
        return self.sessions[session_id]
        
    async def process_chat_message(self, session_id: str, message: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Process a chat message through Cursor AI"""
        session = self.get_session(session_id)
        
        # Add user message to session
        user_message = {
            'id': str(uuid.uuid4()),
            'role': 'user',
            'content': message,
            'timestamp': datetime.now().isoformat()
        }
        session['messages'].append(user_message)
        
        # Update context if provided
        if context:
            session['context'].update(context)
            
        try:
            # Generate response using OpenAI or fallback to simulation
            if self.openai_client:
                response_content = await self._generate_openai_response(message, session)
            else:
                response_content = await self._generate_cursor_response(message, session)
            
            # Add assistant response to session
            assistant_message = {
                'id': str(uuid.uuid4()),
                'role': 'assistant',
                'content': response_content,
                'timestamp': datetime.now().isoformat(),
                'metadata': {
                    'model': 'cursor-ai',
                    'session_id': session_id
                }
            }
            session['messages'].append(assistant_message)
            
            # Limit message history
            if len(session['messages']) > 50:
                session['messages'] = session['messages'][-40:]  # Keep last 40 messages
                
            return {
                'success': True,
                'message': assistant_message,
                'session': {
                    'id': session_id,
                    'message_count': len(session['messages'])
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Error processing chat message: {e}")
            return {
                'success': False,
                'error': str(e),
                'message': {
                    'id': str(uuid.uuid4()),
                    'role': 'assistant',
                    'content': f"I encountered an error: {str(e)}",
                    'timestamp': datetime.now().isoformat(),
                    'metadata': {'error': True}
                }
            }
    
    async def _generate_openai_response(self, message: str, session: Dict[str, Any]) -> str:
        """Generate response using OpenAI API"""
        try:
            context = session.get('context', {})
            
            # Build conversation history for OpenAI
            messages = [
                {
                    "role": "system", 
                    "content": self._get_system_prompt(context)
                }
            ]
            
            # Add recent conversation history (last 10 messages)
            recent_messages = session['messages'][-10:] if len(session['messages']) > 10 else session['messages']
            for msg in recent_messages:
                if msg['role'] in ['user', 'assistant']:
                    messages.append({
                        "role": msg['role'],
                        "content": msg['content']
                    })
            
            # Add current message
            messages.append({
                "role": "user",
                "content": message
            })
            
            # Call OpenAI API
            response = await self.openai_client.chat.completions.create(
                model=self.openai_model,
                messages=messages,
                max_tokens=1500,
                temperature=0.7,
                top_p=0.9
            )
            
            return response.choices[0].message.content or "I apologize, but I couldn't generate a response."
            
        except Exception as e:
            logger.error(f"❌ OpenAI API error: {e}")
            # Fallback to simulation
            return await self._generate_cursor_response(message, session)
    
    def _get_system_prompt(self, context: Dict[str, Any]) -> str:
        """Generate system prompt for OpenAI based on context"""
        base_prompt = """You are Cursor AI, an advanced AI coding assistant integrated with the LAIKA robot development environment. You are an expert in:

🔧 **Code Development**: Python, JavaScript, TypeScript, HTML, CSS, React, Flask, FastAPI, WebSockets, ROS2
🤖 **LAIKA Robot System**: PuppyPi Pro robot control, servo management, sensor integration, camera systems, LIDAR/SLAM
🌐 **Web Development**: Progressive Web Apps (PWA), real-time communication, WebRTC, mobile interfaces
⚙️ **System Integration**: Docker, Linux, Raspberry Pi, hardware interfaces, service management

**Your Role:**
- Provide expert coding assistance and debugging help
- Generate clean, production-ready code with proper error handling
- Explain complex concepts clearly and concisely
- Offer architectural guidance and best practices
- Help with LAIKA-specific development tasks

**Communication Style:**
- Be direct and helpful
- Provide code examples when relevant
- Use appropriate emojis sparingly for clarity
- Ask clarifying questions when needed
- Reference specific files and components when possible"""

        # Add context-specific information
        if context.get('project_path'):
            base_prompt += f"\n\n**Current Project**: {context['project_path']}"
            
        if context.get('current_file'):
            base_prompt += f"\n**Current File**: {context['current_file']}"
            
        return base_prompt
            
    async def _generate_cursor_response(self, message: str, session: Dict[str, Any]) -> str:
        """Generate a Cursor AI-style response"""
        message_lower = message.lower()
        context = session.get('context', {})
        
        # Analyze message intent and generate appropriate response
        if any(word in message_lower for word in ['hello', 'hi', 'hey']):
            return """Hello! I'm Cursor AI, integrated with your LAIKA PWA system.

I can help you with:
🔧 **Code Development**
- Generate functions, classes, and modules
- Debug and optimize existing code
- Explain complex algorithms

🤖 **LAIKA Integration** 
- Robot control programming
- PWA development assistance
- WebSocket and API integration

📁 **Project Management**
- File structure organization  
- Documentation generation
- Testing strategies

What would you like to work on today?"""

        elif any(word in message_lower for word in ['code', 'function', 'class', 'write']):
            return """I'd be happy to help you write code! 

To provide the best assistance, could you tell me:
- What programming language?
- What functionality do you need?
- Any specific requirements or constraints?

For example:
- "Write a Python function to control LAIKA's LEDs"
- "Create a JavaScript class for WebSocket communication"
- "Generate a React component for the chat interface"

I can also help with:
- Code review and optimization
- Adding error handling
- Writing tests
- Documentation"""

        elif any(word in message_lower for word in ['laika', 'robot', 'pwa']):
            project_info = """I can see you're working on the LAIKA robot project! Based on the codebase structure, I can help with:

🐕 **Robot Control**
- Adding new robot actions and behaviors
- Improving servo control and movement
- Sensor data processing (LIDAR, IMU, camera)

🌐 **PWA Development**
- Enhancing the chat interface
- Adding new PWA features
- WebSocket communication improvements

🔧 **System Integration**
- ROS2 node development
- Service and topic management
- Hardware interface optimization

What specific aspect of the LAIKA project would you like to work on?"""
            
            if context.get('current_file'):
                project_info += f"\n\n📄 **Current File**: `{context['current_file']}`"
                
            return project_info

        elif any(word in message_lower for word in ['help', 'what can you do', 'capabilities']):
            return """I'm Cursor AI, now accessible through your LAIKA PWA! Here's what I can do:

🚀 **Code Generation & Assistance**
- Write functions, classes, and complete modules
- Generate boilerplate code and templates
- Create unit tests and documentation

🔍 **Code Analysis & Debugging**  
- Review code for bugs and improvements
- Explain complex code sections
- Suggest optimizations and best practices

🤖 **LAIKA-Specific Help**
- Robot action programming
- PWA interface development  
- WebSocket and API integration
- ROS2 node development

💡 **Project Guidance**
- Architecture recommendations
- File organization suggestions
- Technology stack advice

Just describe what you're trying to build or the problem you're facing, and I'll help you solve it!"""

        elif any(word in message_lower for word in ['error', 'bug', 'debug', 'fix']):
            return """I'm ready to help debug your issue! 

To provide the best assistance, please share:
- **Error message** (if any)
- **Code snippet** that's causing problems
- **Expected behavior** vs actual behavior
- **Context** (what you were trying to do)

I can help with:
- Python runtime errors
- JavaScript/TypeScript issues
- WebSocket connection problems
- Robot control debugging
- PWA functionality issues

Feel free to paste your code or describe the problem in detail!"""

        elif 'file' in message_lower or 'open' in message_lower:
            return """I can help you work with files in your LAIKA project!

**Available commands:**
- "Show me the contents of [filename]"
- "Explain the structure of [filename]" 
- "Help me modify [filename]"
- "Create a new file for [purpose]"

**Common LAIKA files I can help with:**
- `laika_controller.py` - Main robot controller
- `laika_websocket_server.py` - WebSocket server
- `laika-pwa/js/chat.js` - PWA chat interface
- `laika_say.py` - Text-to-speech system

Which file would you like to work with?"""

        else:
            # Generic helpful response
            return f"""I received your message: "{message}"

As Cursor AI integrated with LAIKA, I'm here to help with any coding or development tasks! 

**Quick actions:**
- Ask me to write specific code
- Share an error message for debugging help
- Request explanations of existing code
- Get suggestions for new features

**LAIKA-specific help:**
- Robot programming and control
- PWA development and enhancement  
- WebSocket and API integration
- System architecture improvements

What would you like to work on? The more specific you are, the better I can help!"""

    async def get_session_info(self, session_id: str) -> Dict[str, Any]:
        """Get information about a session"""
        if session_id not in self.sessions:
            return {'error': 'Session not found'}
            
        session = self.sessions[session_id]
        return {
            'id': session['id'],
            'created_at': session['created_at'],
            'last_activity': session['last_activity'],
            'message_count': len(session['messages']),
            'has_context': bool(session.get('context'))
        }
        
    async def clear_session(self, session_id: str) -> Dict[str, Any]:
        """Clear a session's messages"""
        if session_id in self.sessions:
            self.sessions[session_id]['messages'] = []
            return {'success': True, 'message': 'Session cleared'}
        return {'error': 'Session not found'}
        
    def get_status(self) -> Dict[str, Any]:
        """Get API status"""
        return {
            'cursor_available': self.is_available,
            'cursor_host': self.cursor_host,
            'cursor_port': self.cursor_port,
            'has_token': bool(self.connection_token),
            'active_sessions': len(self.sessions),
            'max_sessions': self.max_sessions
        }

# Create global instance
cursor_api = CursorServerAPI()

# Route handlers
async def handle_chat(request):
    """Handle chat message"""
    try:
        data = await request.json()
        
        session_id = data.get('session_id', str(uuid.uuid4()))
        message = data.get('message', '').strip()
        context = data.get('context')
        
        if not message:
            return web.json_response({
                'error': 'Message is required'
            }, status=400)
            
        result = await cursor_api.process_chat_message(session_id, message, context)
        
        return web.json_response(result)
        
    except Exception as e:
        logger.error(f"❌ Error in chat handler: {e}")
        return web.json_response({
            'error': str(e)
        }, status=500)

async def handle_session_info(request):
    """Get session information"""
    session_id = request.match_info.get('session_id')
    if not session_id:
        return web.json_response({'error': 'Session ID required'}, status=400)
        
    result = await cursor_api.get_session_info(session_id)
    return web.json_response(result)

async def handle_clear_session(request):
    """Clear session messages"""
    session_id = request.match_info.get('session_id')
    if not session_id:
        return web.json_response({'error': 'Session ID required'}, status=400)
        
    result = await cursor_api.clear_session(session_id)
    return web.json_response(result)

async def handle_status(request):
    """Get API status"""
    status = cursor_api.get_status()
    return web.json_response(status)

# Setup routes
def setup_cursor_routes(app):
    """Setup Cursor API routes"""
    app.router.add_post('/cursor/chat', handle_chat)
    app.router.add_get('/cursor/session/{session_id}', handle_session_info)
    app.router.add_delete('/cursor/session/{session_id}', handle_clear_session)
    app.router.add_get('/cursor/status', handle_status)
    
    logger.info("✅ Cursor API routes configured")

# Standalone server for testing
async def create_cursor_app():
    """Create standalone Cursor API app"""
    app = web.Application()
    
    # CORS middleware
    async def cors_middleware(request, handler):
        response = await handler(request)
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        return response
    
    app.middlewares.append(cors_middleware)
    
    # Handle OPTIONS requests
    async def options_handler(request):
        return web.Response(headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        })
    
    app.router.add_options('/{path:.*}', options_handler)
    
    # Setup routes
    setup_cursor_routes(app)
    
    return app

if __name__ == '__main__':
    """Run standalone Cursor API server"""
    logging.basicConfig(level=logging.INFO)
    
    async def main():
        app = await create_cursor_app()
        runner = web.AppRunner(app)
        await runner.setup()
        
        site = web.TCPSite(runner, '0.0.0.0', 8766)  # Different port from main WebSocket
        await site.start()
        
        print("🚀 Cursor API Server running on http://0.0.0.0:8766")
        print("📡 Endpoints:")
        print("  POST /cursor/chat - Send chat message")
        print("  GET /cursor/status - Get API status")
        print("  GET /cursor/session/{id} - Get session info")
        print("  DELETE /cursor/session/{id} - Clear session")
        
        try:
            await asyncio.Future()  # Run forever
        except KeyboardInterrupt:
            print("\n🛑 Shutting down...")
        finally:
            await runner.cleanup()
    
    asyncio.run(main())
