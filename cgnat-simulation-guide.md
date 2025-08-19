# 🧪 CGNAT Simulation Guide

## Overview
This guide shows you how to simulate CGNAT (Carrier Grade Network Address Translation) to test LAIKA's worldwide access capabilities, mimicking real-world scenarios like Starlink satellite internet.

## 🎯 Method 1: Mobile Hotspot (Recommended)

### Why This Works
- Most mobile carriers use CGNAT
- Creates the exact same network conditions as Starlink
- Easy to set up and tear down
- No special equipment needed

### Step-by-Step Setup

**1. Enable Mobile Hotspot**
```
📱 On your phone:
- Go to Settings → Mobile Hotspot
- Turn on WiFi hotspot
- Note the network name and password
```

**2. Connect LAIKA to Hotspot**
```bash
# On LAIKA, connect to the mobile hotspot WiFi
# This puts LAIKA behind carrier CGNAT
# She'll get an IP like: 100.64.x.x (CGNAT range)
```

**3. Test from Different Network**
```
💻 From your home WiFi (or any other network):
- Open PWA at https://dcmcshan.github.io/laika-pwa/
- Click "Find LAIKA"
- Registry should show LAIKA online
- Direct connection should FAIL (this proves CGNAT blocking)
```

### Expected Results
✅ **Registry Detection**: PWA finds LAIKA in global registry  
❌ **Direct Connection**: Cannot reach LAIKA's IP directly  
🔍 **Perfect Simulation**: Exactly like Starlink CGNAT!

## 🐳 Method 2: Docker NAT Simulation

### Setup Docker Network
```bash
# Create isolated network with strict NAT
docker network create --driver bridge \
  --subnet=172.20.0.0/16 \
  --opt com.docker.network.bridge.enable_ip_masquerade=true \
  cgnat-sim

# Run LAIKA in isolated container
docker run -it --network cgnat-sim \
  --name laika-cgnat \
  python:3.9 bash
```

### Test Isolation
```bash
# From container: Can reach internet
curl google.com  # ✅ Works

# From outside: Cannot reach container
curl 172.20.0.2:5002  # ❌ Blocked by NAT
```

## 🌐 Method 3: Router Configuration

### Strict NAT Settings
```
Router Admin Panel:
1. Disable UPnP/NAT-PMP
2. Block all inbound port forwarding
3. Enable "Strict NAT" mode
4. Disable DMZ
5. Block unsolicited inbound traffic
```

### Firewall Rules
```bash
# On router/firewall:
# Block all inbound connections to LAIKA's subnet
iptables -I FORWARD -d 192.168.1.0/24 -j DROP
iptables -I FORWARD -d 192.168.1.100 -m state --state ESTABLISHED,RELATED -j ACCEPT
```

## 🧪 Testing Scenarios

### Test 1: Registry Detection
```javascript
// PWA should detect LAIKA in registry:
{
  "device_id": "LAIKA-2CCF6793D86B",
  "local_ip": "100.64.1.100",      // CGNAT IP
  "public_ip": "203.0.113.45",     // Shared carrier IP
  "status": "online",
  "cgnat": true                    // Behind CGNAT
}
```

### Test 2: Connection Failure
```bash
# PWA attempts connection:
curl http://203.0.113.45:5002/health
# Result: Connection timeout/refused
# Reason: CGNAT blocks inbound connections
```

### Test 3: VPN Solution
```bash
# Install Tailscale on LAIKA
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# LAIKA gets VPN IP: 100.64.0.1
# PWA can now connect via VPN network
curl http://100.64.0.1:5002/health  # ✅ Works!
```

## 🔍 Verification Commands

### Check LAIKA's Network Status
```bash
# On LAIKA:
ip route get 8.8.8.8           # Check routing
curl ifconfig.me               # Get public IP
netstat -tuln | grep 5002      # Verify API running
```

### Test PWA Connection
```javascript
// In PWA console:
fetch('http://LAIKA_IP:5002/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);  // Should fail with CGNAT
```

### Verify CGNAT Behavior
```bash
# From external network:
nmap -p 5002 LAIKA_PUBLIC_IP   # Should show filtered/closed
telnet LAIKA_PUBLIC_IP 5002    # Should timeout
```

## 🚀 Solutions to Test

### 1. VPN Tunneling (Tailscale)
```bash
# Both LAIKA and PWA device join same VPN
# Creates peer-to-peer connection through CGNAT
```

### 2. Cloud Relay Service
```bash
# LAIKA maintains outbound connection to relay
# PWA connects through relay server
```

### 3. SSH Reverse Tunnel
```bash
# LAIKA creates reverse tunnel to cloud server
ssh -R 8080:localhost:5002 user@cloud-server.com
# PWA connects to cloud-server.com:8080
```

## 📊 Expected Test Results

| Scenario | Registry | Direct Connection | VPN Connection |
|----------|----------|-------------------|----------------|
| Same Network | ✅ Found | ✅ Works | ✅ Works |
| CGNAT Simulation | ✅ Found | ❌ Blocked | ✅ Works |
| Real Starlink | ✅ Found | ❌ Blocked | ✅ Works |

This simulation perfectly replicates real-world CGNAT challenges and validates our solutions! 🌍🤖
