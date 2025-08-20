#!/usr/bin/env python3
"""
Simple HTTPS server for testing LAIKA Controller PWA
Web Bluetooth requires HTTPS, so this serves the PWA over HTTPS with self-signed certificates
"""

import http.server
import socketserver
import ssl
import os
import sys
from pathlib import Path

class PWAHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler for PWA with proper headers"""
    
    def end_headers(self):
        # Add PWA-friendly headers
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        
        # CORS headers for development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        
        super().end_headers()
    
    def do_GET(self):
        # Handle service worker requests
        if self.path == '/sw.js':
            self.send_response(200)
            self.send_header('Content-type', 'application/javascript')
            self.send_header('Service-Worker-Allowed', '/')
            self.end_headers()
            
            with open('sw.js', 'rb') as f:
                self.wfile.write(f.read())
            return
        
        # Handle manifest requests
        if self.path == '/manifest.json':
            self.send_response(200)
            self.send_header('Content-type', 'application/manifest+json')
            self.end_headers()
            
            with open('manifest.json', 'rb') as f:
                self.wfile.write(f.read())
            return
        
        # Default handling
        super().do_GET()

def create_self_signed_cert():
    """Create a self-signed certificate for HTTPS"""
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.primitives import serialization
        import datetime
        
        print("Generating self-signed certificate...")
        
        # Generate private key
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        
        # Create certificate
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, u"localhost"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"LAIKA PWA Test Server"),
        ])
        
        cert = x509.CertificateBuilder().subject_name(
            subject
        ).issuer_name(
            issuer
        ).public_key(
            private_key.public_key()
        ).serial_number(
            x509.random_serial_number()
        ).not_valid_before(
            datetime.datetime.utcnow()
        ).not_valid_after(
            datetime.datetime.utcnow() + datetime.timedelta(days=365)
        ).add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName(u"localhost"),
                x509.DNSName(u"127.0.0.1"),
            ]),
            critical=False,
        ).sign(private_key, hashes.SHA256())
        
        # Write certificate and key
        with open("server.crt", "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        
        with open("server.key", "wb") as f:
            f.write(private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ))
        
        print("✅ Certificate generated: server.crt, server.key")
        return True
        
    except ImportError:
        print("⚠️  cryptography package not found. Install with: pip install cryptography")
        return False
    except Exception as e:
        print(f"❌ Failed to generate certificate: {e}")
        return False

def main():
    port = 8443  # HTTPS port
    
    print("🐕 LAIKA Controller PWA Test Server")
    print("=" * 40)
    
    # Check if we're in the right directory
    if not os.path.exists('index.html'):
        print("❌ Error: index.html not found. Please run from the laika-pwa directory.")
        sys.exit(1)
    
    # Check for certificate files
    if not (os.path.exists('server.crt') and os.path.exists('server.key')):
        print("🔒 HTTPS certificate not found. Generating self-signed certificate...")
        if not create_self_signed_cert():
            print("❌ Failed to create certificate. Falling back to HTTP.")
            
            # Fallback to HTTP
            print(f"\n🌐 Starting HTTP server on port 8081...")
            print(f"📱 Open: http://localhost:8081")
            print("⚠️  Note: Web Bluetooth requires HTTPS in production")
            print("\nPress Ctrl+C to stop")
            
            with socketserver.TCPServer(("", 8081), PWAHTTPRequestHandler) as httpd:
                httpd.serve_forever()
            return
    
    # Create HTTPS server
    print(f"\n🔒 Starting HTTPS server on port {port}...")
    print(f"📱 Open: https://localhost:{port}")
    print("⚠️  You may need to accept the self-signed certificate warning")
    print("\n✨ Features available:")
    print("   - Web Bluetooth API (requires HTTPS)")
    print("   - PWA installation")
    print("   - Service Worker caching")
    print("\nPress Ctrl+C to stop")
    
    try:
        with socketserver.TCPServer(("", port), PWAHTTPRequestHandler) as httpd:
            # Wrap with SSL
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain('server.crt', 'server.key')
            httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
            
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print("\n\n🛑 Server stopped")
    except Exception as e:
        print(f"❌ Server error: {e}")
        print("\n💡 Try running with HTTP instead:")
        print("   python3 -m http.server 8080")

if __name__ == "__main__":
    main()
