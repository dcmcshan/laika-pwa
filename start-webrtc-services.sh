#!/bin/bash
# LAIKA WebRTC Services Startup Script

echo "🌐 Starting LAIKA WebRTC Services..."

# Change to the correct directory
cd /home/pi/LAIKA/laika-pwa

# Kill any existing processes
echo "Stopping existing services..."
pkill -f "webrtc-signaling-server.py"
pkill -f "laika_webrtc_client.py"
sleep 2

# Start the WebRTC signaling server
echo "Starting WebRTC signaling server on port 9999..."
python3 webrtc-signaling-server.py &
SIGNALING_PID=$!
echo "Signaling server PID: $SIGNALING_PID"

# Wait for signaling server to start
sleep 3

# Test signaling server
echo "Testing signaling server..."
if curl -s http://localhost:9999/health > /dev/null; then
    echo "✅ Signaling server is running"
else
    echo "❌ Signaling server failed to start"
    exit 1
fi

# Start the LAIKA WebRTC client (if on LAIKA device)
if [ -f "/home/pi/LAIKA/laika_controller.py" ]; then
    echo "Starting LAIKA WebRTC client..."
    cd /home/pi/LAIKA
    python3 laika_webrtc_client.py --signaling-server http://localhost:9999 &
    CLIENT_PID=$!
    echo "WebRTC client PID: $CLIENT_PID"
    cd /home/pi/LAIKA/laika-pwa
else
    echo "LAIKA controller not found - running signaling server only"
fi

echo ""
echo "🎉 WebRTC services started!"
echo "📡 Signaling server: http://localhost:9999"
echo "🌐 PWA can now connect via WebRTC with NAT traversal"
echo ""
echo "To stop services: pkill -f 'webrtc-signaling-server.py' && pkill -f 'laika_webrtc_client.py'"
echo ""
echo "Services running in background. Press Ctrl+C to stop monitoring."

# Keep script running and monitor services
while true; do
    sleep 30
    if ! kill -0 $SIGNALING_PID 2>/dev/null; then
        echo "❌ Signaling server stopped unexpectedly"
        break
    fi
    echo "✅ Services running - $(date)"
done
