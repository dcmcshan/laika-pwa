#!/bin/bash

echo "🚀 DEPLOYING LAIKA WEBRTC SIGNALING SERVER TO RAILWAY"
echo "=================================================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    curl -fsSL https://railway.app/install.sh | sh
    export PATH=$PATH:~/.railway/bin
fi

echo "✅ Railway CLI ready"

# Login to Railway (if not already logged in)
echo "🔑 Checking Railway authentication..."
railway whoami 2>/dev/null || {
    echo "Please login to Railway:"
    railway login
}

# Create new Railway project
echo "📦 Creating Railway project..."
railway project new laika-webrtc-signaling

# Deploy the signaling server
echo "🌐 Deploying signaling server..."
railway up --detach

# Get the deployment URL
echo "🔗 Getting deployment URL..."
RAILWAY_URL=$(railway domain)

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo "================================"
echo "Signaling Server URL: $RAILWAY_URL"
echo "Health Check: $RAILWAY_URL/health"
echo "WebSocket URL: wss://$RAILWAY_URL/socket.io/"
echo ""
echo "Next step: Update PWA to use this URL"

# Save the URL for later use
echo "$RAILWAY_URL" > cloud-signaling-url.txt
echo "✅ URL saved to cloud-signaling-url.txt"
