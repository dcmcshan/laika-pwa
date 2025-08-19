/**
 * Cloud Signaling Server Configuration
 * This will be updated with the actual deployed URL
 */

// Temporary public signaling server (replace with your own)
const CLOUD_SIGNALING_SERVERS = [
    // Primary: Your deployed signaling server (update this)
    'wss://laika-webrtc-signaling.onrender.com/socket.io/',
    
    // Fallback: Local development server
    'ws://192.168.86.29:9999/socket.io/',
    
    // Fallback: localhost for testing
    'ws://localhost:9999/socket.io/'
];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CLOUD_SIGNALING_SERVERS };
} else if (typeof window !== 'undefined') {
    window.CLOUD_SIGNALING_SERVERS = CLOUD_SIGNALING_SERVERS;
}
