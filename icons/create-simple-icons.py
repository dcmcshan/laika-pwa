#!/usr/bin/env python3
"""
Simple icon creator for LAIKA PWA
Creates basic PNG icons from SVG
"""

import os
from pathlib import Path

def create_svg_icon():
    """Create a simple SVG icon for LAIKA"""
    svg_content = '''<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2196F3;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#21CBF3;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background with rounded corners -->
  <rect width="512" height="512" rx="51.2" ry="51.2" fill="url(#bg)"/>
  
  <!-- Dog silhouette -->
  <g transform="translate(128, 128) scale(2)">
    <!-- Body -->
    <ellipse cx="64" cy="96" rx="48" ry="32" fill="white" opacity="0.9"/>
    
    <!-- Head -->
    <circle cx="64" cy="48" r="28" fill="white" opacity="0.9"/>
    
    <!-- Ears -->
    <ellipse cx="48" cy="32" rx="8" ry="16" fill="white" opacity="0.8"/>
    <ellipse cx="80" cy="32" rx="8" ry="16" fill="white" opacity="0.8"/>
    
    <!-- Legs -->
    <rect x="40" y="120" width="8" height="20" fill="white" opacity="0.8"/>
    <rect x="56" y="120" width="8" height="20" fill="white" opacity="0.8"/>
    <rect x="72" y="120" width="8" height="20" fill="white" opacity="0.8"/>
    <rect x="88" y="120" width="8" height="20" fill="white" opacity="0.8"/>
    
    <!-- Tail -->
    <ellipse cx="112" cy="88" rx="12" ry="6" fill="white" opacity="0.8"/>
    
    <!-- Face features -->
    <circle cx="56" cy="44" r="3" fill="#333"/>
    <circle cx="72" cy="44" r="3" fill="#333"/>
    <ellipse cx="64" cy="52" rx="4" ry="2" fill="#333"/>
  </g>
  
  <!-- Tech elements -->
  <g transform="translate(384, 384)" opacity="0.3">
    <circle cx="0" cy="0" r="24" fill="none" stroke="white" stroke-width="3"/>
    <circle cx="0" cy="0" r="12" fill="none" stroke="white" stroke-width="2"/>
    <circle cx="0" cy="0" r="4" fill="white"/>
  </g>
</svg>'''
    
    return svg_content

def create_icon_html():
    """Create an HTML file that generates PNG icons from SVG"""
    html_content = '''<!DOCTYPE html>
<html>
<head>
    <title>LAIKA Icon Generator</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .icons { display: flex; flex-wrap: wrap; gap: 10px; }
        .icon { text-align: center; margin: 10px; }
        canvas { border: 1px solid #ccc; }
        button { padding: 8px 16px; margin: 5px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <h1>🐕 LAIKA PWA Icons</h1>
    <button onclick="generateAllIcons()">Generate All Icons</button>
    <button onclick="downloadAll()">Download All</button>
    
    <div id="icons" class="icons"></div>

    <script>
        const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
        const svgContent = `''' + create_svg_icon() + '''`;
        const canvases = {};

        function createIcon(size) {
            return new Promise((resolve) => {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');

                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, size, size);
                    resolve(canvas);
                };
                
                const blob = new Blob([svgContent], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                img.src = url;
            });
        }

        async function generateAllIcons() {
            const container = document.getElementById('icons');
            container.innerHTML = '';

            for (const size of sizes) {
                const canvas = await createIcon(size);
                canvases[size] = canvas;

                const div = document.createElement('div');
                div.className = 'icon';
                
                const label = document.createElement('div');
                label.textContent = `${size}×${size}`;
                
                const btn = document.createElement('button');
                btn.textContent = 'Download';
                btn.onclick = () => downloadIcon(canvas, size);
                
                div.appendChild(canvas);
                div.appendChild(label);
                div.appendChild(btn);
                container.appendChild(div);
            }
        }

        function downloadIcon(canvas, size) {
            const link = document.createElement('a');
            link.download = `icon-${size}x${size}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }

        function downloadAll() {
            Object.entries(canvases).forEach(([size, canvas], index) => {
                setTimeout(() => downloadIcon(canvas, size), index * 100);
            });
        }

        // Auto-generate on load
        generateAllIcons();
    </script>
</body>
</html>'''
    
    return html_content

def main():
    print("🐕 Creating LAIKA PWA icons...")
    
    # Create the icon generator HTML
    with open('icon-generator.html', 'w') as f:
        f.write(create_icon_html())
    
    print("✅ Icon generator created: icon-generator.html")
    print("📱 Open icon-generator.html in your browser to generate PNG icons")
    print("💾 Download all icons and place them in the icons/ directory")

if __name__ == "__main__":
    main()
