#!/usr/bin/env python3
"""
LAIKA Music WebSocket Server
Handles real-time communication for music recognition and STT
"""

import asyncio
import websockets
import json
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Store connected clients
connected_clients = set()

class MusicWebSocketServer:
    def __init__(self, host='0.0.0.0', port=8765):
        self.host = host
        self.port = port
        self.clients = set()
        
    async def handle_client(self, websocket, path):
        """Handle individual WebSocket client connections"""
        client_id = id(websocket)
        self.clients.add(websocket)
        logger.info(f"🎵 Client connected: {client_id} (Total: {len(self.clients)})")
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.process_message(websocket, data)
                except json.JSONDecodeError:
                    logger.error(f"❌ Invalid JSON from client {client_id}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"📡 Client disconnected: {client_id}")
        except Exception as e:
            logger.error(f"❌ Error handling client {client_id}: {e}")
        finally:
            self.clients.discard(websocket)
            logger.info(f"🎵 Client removed: {client_id} (Total: {len(self.clients)})")
    
    async def process_message(self, websocket, data):
        """Process incoming messages from clients"""
        message_type = data.get('type', 'unknown')
        
        logger.info(f"📨 Received {message_type} message")
        
        if message_type == 'beat-detected':
            await self.handle_beat_detected(data)
        elif message_type == 'music-recognized':
            await self.handle_music_recognized(data)
        elif message_type == 'stt-transcript':
            await self.handle_stt_transcript(data)
        elif message_type == 'behavior-toggle':
            await self.handle_behavior_toggle(data)
        elif message_type == 'ping':
            await self.send_response(websocket, {'type': 'pong', 'timestamp': datetime.now().isoformat()})
        else:
            logger.warning(f"⚠️ Unknown message type: {message_type}")
    
    async def handle_beat_detected(self, data):
        """Handle beat detection messages"""
        bpm = data.get('bpm', 0)
        energy = data.get('energy', 0)
        logger.info(f"💓 Beat detected: {bpm} BPM, Energy: {energy}")
        
        # Broadcast to all clients
        await self.broadcast({
            'type': 'beat-sync',
            'bpm': bpm,
            'energy': energy,
            'timestamp': datetime.now().isoformat()
        })
    
    async def handle_music_recognized(self, data):
        """Handle music recognition messages"""
        song = data.get('song', {})
        auto = data.get('auto', False)
        logger.info(f"🎵 Music recognized: {song.get('title', 'Unknown')} by {song.get('artist', 'Unknown')} (Auto: {auto})")
        
        # Broadcast to all clients
        await self.broadcast({
            'type': 'music-info',
            'song': song,
            'auto': auto,
            'timestamp': datetime.now().isoformat()
        })
    
    async def handle_stt_transcript(self, data):
        """Handle STT transcript messages"""
        transcript = data.get('transcript', {})
        text = transcript.get('text', '')
        confidence = transcript.get('confidence', 0)
        logger.info(f"🎤 STT transcript: '{text}' (Confidence: {confidence})")
        
        # Broadcast to all clients
        await self.broadcast({
            'type': 'stt-transcript',
            'transcript': transcript,
            'timestamp': datetime.now().isoformat()
        })
    
    async def handle_behavior_toggle(self, data):
        """Handle behavior toggle messages"""
        behavior = data.get('behavior', '')
        enabled = data.get('enabled', False)
        logger.info(f"🤖 Behavior toggle: {behavior} = {enabled}")
        
        # Broadcast to all clients
        await self.broadcast({
            'type': 'behavior-ack',
            'behavior': behavior,
            'active': enabled,
            'timestamp': datetime.now().isoformat()
        })
    
    async def broadcast(self, message):
        """Broadcast message to all connected clients"""
        if not self.clients:
            return
            
        message_str = json.dumps(message)
        disconnected = set()
        
        for client in self.clients:
            try:
                await client.send(message_str)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)
            except Exception as e:
                logger.error(f"❌ Error broadcasting to client: {e}")
                disconnected.add(client)
        
        # Remove disconnected clients
        self.clients -= disconnected
        if disconnected:
            logger.info(f"🧹 Removed {len(disconnected)} disconnected clients")
    
    async def send_response(self, websocket, message):
        """Send response to specific client"""
        try:
            await websocket.send(json.dumps(message))
        except websockets.exceptions.ConnectionClosed:
            logger.warning("⚠️ Client disconnected while sending response")
        except Exception as e:
            logger.error(f"❌ Error sending response: {e}")
    
    async def start(self):
        """Start the WebSocket server"""
        logger.info(f"🚀 Starting Music WebSocket Server on {self.host}:{self.port}")
        
        async with websockets.serve(self.handle_client, self.host, self.port):
            logger.info(f"✅ Music WebSocket Server running on ws://{self.host}:{self.port}")
            await asyncio.Future()  # Run forever
    
    def run(self):
        """Run the server in the main thread"""
        asyncio.run(self.start())

if __name__ == '__main__':
    server = MusicWebSocketServer()
    try:
        server.run()
    except KeyboardInterrupt:
        logger.info("🛑 Music WebSocket Server stopped by user")
    except Exception as e:
        logger.error(f"❌ Music WebSocket Server error: {e}")
