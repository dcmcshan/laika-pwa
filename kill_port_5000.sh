#!/bin/bash
# Script to kill any processes using port 5000
# This allows the LAIKA PWA service to start cleanly

echo "Checking for processes using port 5000..."

# Find processes using port 5000
PIDS=$(lsof -t -i:5000 2>/dev/null || true)

if [ -n "$PIDS" ]; then
    echo "Found processes using port 5000: $PIDS"
    echo "Terminating processes..."
    
    # First try SIGTERM (graceful)
    kill $PIDS 2>/dev/null || true
    sleep 2
    
    # Check if any are still running and force kill
    REMAINING=$(lsof -t -i:5000 2>/dev/null || true)
    if [ -n "$REMAINING" ]; then
        echo "Force killing remaining processes: $REMAINING"
        kill -9 $REMAINING 2>/dev/null || true
    fi
    
    echo "Port 5000 cleared"
else
    echo "Port 5000 is available"
fi

exit 0
