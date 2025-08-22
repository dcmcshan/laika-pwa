#!/bin/bash

# Download All 3D Libraries for LAIKA PWA
# This script downloads all required 3D libraries locally to avoid CDN issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Downloading All 3D Libraries for LAIKA PWA${NC}"
echo "======================================================"

# Create libs directory
LIBS_DIR="js/libs"
mkdir -p "$LIBS_DIR"

# Function to download file with multiple fallbacks
download_file_with_fallbacks() {
    local filename="$1"
    local description="$2"
    shift 2
    local urls=("$@")
    
    echo -e "${YELLOW}📥 Downloading ${description}...${NC}"
    
    for url in "${urls[@]}"; do
        echo -e "  Trying: ${url}"
        if curl -L -o "${LIBS_DIR}/${filename}" "$url" 2>/dev/null; then
            # Check if file is valid (not HTML error page)
            if head -1 "${LIBS_DIR}/${filename}" | grep -q "DOCTYPE\|html\|<!DOCTYPE"; then
                echo -e "  ${RED}❌ Got HTML page instead of JavaScript${NC}"
                continue
            fi
            if [ ! -s "${LIBS_DIR}/${filename}" ]; then
                echo -e "  ${RED}❌ File is empty${NC}"
                continue
            fi
            echo -e "  ${GREEN}✅ Downloaded ${filename} successfully${NC}"
            return 0
        else
            echo -e "  ${RED}❌ Failed${NC}"
        fi
    done
    
    echo -e "${RED}❌ Failed to download ${filename} from all sources${NC}"
    return 1
}

# Download Three.js and related libraries
echo -e "${BLUE}🔧 Downloading Three.js libraries...${NC}"

# Three.js core - multiple sources
download_file_with_fallbacks \
    "three.min.js" \
    "Three.js core library" \
    "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" \
    "https://unpkg.com/three@0.128.0/build/three.min.js" \
    "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js" \
    "https://threejs.org/build/three.min.js"

# OrbitControls - multiple sources
download_file_with_fallbacks \
    "OrbitControls.js" \
    "Three.js OrbitControls" \
    "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/controls/OrbitControls.js" \
    "https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js" \
    "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js" \
    "https://threejs.org/examples/js/controls/OrbitControls.js"

# URDFLoader - multiple sources
download_file_with_fallbacks \
    "URDFLoader.min.js" \
    "URDF Loader" \
    "https://cdnjs.cloudflare.com/ajax/libs/urdf-loader/0.9.6/URDFLoader.min.js" \
    "https://unpkg.com/urdf-loader@0.9.6/dist/URDFLoader.min.js" \
    "https://cdn.jsdelivr.net/npm/urdf-loader@0.9.6/dist/URDFLoader.min.js"

# ROSLib - multiple sources
download_file_with_fallbacks \
    "roslib.min.js" \
    "ROSLib" \
    "https://cdnjs.cloudflare.com/ajax/libs/roslib/1.3.0/roslib.min.js" \
    "https://unpkg.com/roslib@1.3.0/build/roslib.min.js" \
    "https://cdn.jsdelivr.net/npm/roslib@1.3.0/build/roslib.min.js"

echo ""
echo -e "${GREEN}🎉 3D Libraries download attempt completed!${NC}"
echo -e "${BLUE}📁 Files saved to: ${LIBS_DIR}/${NC}"
echo ""
echo -e "${YELLOW}📋 Downloaded files:${NC}"
ls -la "$LIBS_DIR"
echo ""

# Verify files
echo -e "${BLUE}🔍 Verifying downloaded files...${NC}"
for file in three.min.js OrbitControls.js URDFLoader.min.js roslib.min.js; do
    if [ -f "${LIBS_DIR}/${file}" ]; then
        size=$(wc -c < "${LIBS_DIR}/${file}")
        if [ $size -gt 1000 ]; then
            echo -e "  ${GREEN}✅ ${file} (${size} bytes)${NC}"
        else
            echo -e "  ${RED}❌ ${file} (${size} bytes) - too small, likely corrupted${NC}"
        fi
    else
        echo -e "  ${RED}❌ ${file} - not found${NC}"
    fi
done

echo ""
echo -e "${BLUE}💡 Next steps:${NC}"
echo -e "1. Update the 3D viewer to use local files only"
echo -e "2. Remove CDN dependencies"
echo -e "3. Test the 3D viewer"
echo ""
echo -e "${BLUE}📝 Local file paths:${NC}"
echo -e "   /js/libs/three.min.js"
echo -e "   /js/libs/OrbitControls.js"
echo -e "   /js/libs/URDFLoader.min.js"
echo -e "   /js/libs/roslib.min.js"
