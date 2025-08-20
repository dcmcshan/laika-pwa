#!/bin/bash
"""
Start Cursor Server API
Launches the standalone Cursor API server for LAIKA PWA integration
"""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Cursor Server API for LAIKA PWA${NC}"
echo "=================================================="

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 is required but not installed${NC}"
    exit 1
fi

# Check if Cursor server is running
echo -e "${YELLOW}🔍 Checking for running Cursor server...${NC}"
if pgrep -f "cursor-server" > /dev/null; then
    echo -e "${GREEN}✅ Cursor server is running${NC}"
else
    echo -e "${YELLOW}⚠️  Cursor server not detected. The API will work in simulation mode.${NC}"
fi

# Check for connection token
TOKEN_FILE="/run/user/1000/cursor-remote-code.token.77b20c32f2812cd4cdf3092bdf5622e7"
if [ -f "$TOKEN_FILE" ]; then
    echo -e "${GREEN}✅ Cursor connection token found${NC}"
else
    echo -e "${YELLOW}⚠️  Cursor connection token not found. Using simulation mode.${NC}"
fi

# Install dependencies if needed
echo -e "${YELLOW}📦 Checking dependencies...${NC}"
python3 -c "import aiohttp, aiofiles" 2>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}📥 Installing required dependencies...${NC}"
    pip3 install aiohttp aiofiles
fi

# Change to the correct directory
cd "$(dirname "$0")"

# Set environment variables
export PYTHONPATH="/home/pi/LAIKA:$PYTHONPATH"

# Start the server
echo -e "${GREEN}🚀 Starting Cursor API server on port 8766...${NC}"
echo -e "${BLUE}📡 API endpoints will be available at:${NC}"
echo "   - POST http://localhost:8766/cursor/chat"
echo "   - GET  http://localhost:8766/cursor/status"
echo "   - GET  http://localhost:8766/cursor/session/{id}"
echo ""
echo -e "${BLUE}🌐 Access the Cursor chat interface at:${NC}"
echo "   http://localhost:8080/cursor.html"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo "=================================================="

# Run the server
python3 cursor_server.py
