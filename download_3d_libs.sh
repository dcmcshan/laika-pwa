#!/bin/bash

# Download 3D Libraries for LAIKA PWA
# This script downloads the required 3D libraries locally as a backup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Downloading 3D Libraries for LAIKA PWA${NC}"
echo "================================================"

# Create libs directory
LIBS_DIR="js/libs"
mkdir -p "$LIBS_DIR"

# Function to download file
download_file() {
    local url="$1"
    local filename="$2"
    local description="$3"
    
    echo -e "${YELLOW}📥 Downloading ${description}...${NC}"
    
    if curl -L -o "${LIBS_DIR}/${filename}" "$url" 2>/dev/null; then
        echo -e "${GREEN}✅ Downloaded ${filename}${NC}"
    else
        echo -e "${RED}❌ Failed to download ${filename}${NC}"
        return 1
    fi
}

# Download Three.js and related libraries
echo -e "${BLUE}🔧 Downloading Three.js libraries...${NC}"

# Three.js core
download_file \
    "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" \
    "three.min.js" \
    "Three.js core library"

# OrbitControls
download_file \
    "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/controls/OrbitControls.js" \
    "OrbitControls.js" \
    "Three.js OrbitControls"

# URDFLoader
download_file \
    "https://cdnjs.cloudflare.com/ajax/libs/urdf-loader/0.9.6/URDFLoader.min.js" \
    "URDFLoader.min.js" \
    "URDF Loader"

# ROSLib
download_file \
    "https://cdnjs.cloudflare.com/ajax/libs/roslib/1.3.0/roslib.min.js" \
    "roslib.min.js" \
    "ROSLib"

echo ""
echo -e "${GREEN}🎉 3D Libraries downloaded successfully!${NC}"
echo -e "${BLUE}📁 Files saved to: ${LIBS_DIR}/${NC}"
echo ""
echo -e "${YELLOW}📋 Downloaded files:${NC}"
ls -la "$LIBS_DIR"
echo ""
echo -e "${BLUE}💡 You can now use local fallback by updating the 3D viewer to use:${NC}"
echo -e "   /js/libs/three.min.js"
echo -e "   /js/libs/OrbitControls.js"
echo -e "   /js/libs/URDFLoader.min.js"
echo -e "   /js/libs/roslib.min.js"
