/**
 * Network Scanner for PuppyPi Discovery
 * Scans local network for puppypi devices and establishes WebSocket connections
 */

class NetworkScanner {
    constructor() {
        this.discoveredDevices = [];
        this.currentDevice = null;
        this.websocket = null;
        this.isScanning = false;
        this.scanTimeout = 5000; // 5 seconds per scan
        this.retryAttempts = 3;
        
        // Common PuppyPi ports and endpoints (5002 for real LAIKA API)
        this.puppyPiPorts = [5002, 8501, 9026, 5000, 8080];
        this.healthEndpoints = ['/health', '/api/status', '/status', '/'];
        this.wsEndpoints = ['/ws', '/websocket', '/api/ws'];
        
        // Network ranges to scan
        this.networkRanges = this.getNetworkRanges();
        
        // Callbacks
        this.onDeviceFound = null;
        this.onScanComplete = null;
        this.onConnectionEstablished = null;
        this.onConnectionLost = null;
        this.onError = null;
    }
    
    /**
     * Get network ranges to scan based on current IP
     */
    getNetworkRanges() {
        const ranges = [
            '192.168.1',   // Common home router
            '192.168.0',   // Common home router  
            '192.168.4',   // PuppyPi hotspot
            '10.0.0',      // Corporate/advanced routers
            '172.16.0'     // Docker/container networks
        ];
        
        // Try to detect current network from browser if possible
        try {
            // This won't work in most browsers due to security, but worth trying
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (connection && connection.effectiveType) {
                console.log('Network type detected:', connection.effectiveType);
            }
        } catch (e) {
            // Ignore - expected to fail in most browsers
        }
        
        return ranges;
    }
    
    /**
     * Start scanning for PuppyPi devices on the network
     */
    async startScan() {
        if (this.isScanning) {
            console.warn('🔍 Network scan already in progress');
            return;
        }
        
        this.isScanning = true;
        this.discoveredDevices = [];
        
        console.log('🔍 Starting PuppyPi network discovery...');
        
        try {
            // Scan each network range
            for (const range of this.networkRanges) {
                await this.scanNetworkRange(range);
            }
            
            // Also try mDNS names
            await this.scanMdnsNames();
            
            console.log(`🔍 Network scan complete. Found ${this.discoveredDevices.length} devices`);
            
            if (this.onScanComplete) {
                this.onScanComplete(this.discoveredDevices);
            }
            
        } catch (error) {
            console.error('🔍 Network scan error:', error);
            if (this.onError) {
                this.onError(error);
            }
        } finally {
            this.isScanning = false;
        }
        
        return this.discoveredDevices;
    }
    
    /**
     * Scan a specific network range (e.g., '192.168.1')
     */
    async scanNetworkRange(range) {
        console.log(`🔍 Scanning network range: ${range}.x`);
        
        // Create promises for parallel scanning
        const scanPromises = [];
        
        // Scan common IPs first (1, 100, 101, 200, etc.)
        const priorityIPs = [1, 100, 101, 200, 254];
        
        for (const ip of priorityIPs) {
            const fullIP = `${range}.${ip}`;
            scanPromises.push(this.scanDevice(fullIP));
        }
        
        // Wait for priority IPs with short timeout
        await Promise.allSettled(scanPromises);
        
        // If no devices found in priority IPs, do a broader scan
        if (this.discoveredDevices.length === 0) {
            const broadScanPromises = [];
            
            // Scan remaining IPs in smaller batches to avoid overwhelming the network
            for (let i = 2; i <= 253; i++) {
                if (!priorityIPs.includes(i)) {
                    const fullIP = `${range}.${i}`;
                    broadScanPromises.push(this.scanDevice(fullIP));
                    
                    // Process in batches of 20
                    if (broadScanPromises.length >= 20) {
                        await Promise.allSettled(broadScanPromises);
                        broadScanPromises.length = 0; // Clear array
                        
                        // Small delay between batches
                        await this.delay(100);
                    }
                }
            }
            
            // Process remaining IPs
            if (broadScanPromises.length > 0) {
                await Promise.allSettled(broadScanPromises);
            }
        }
    }
    
    /**
     * Try common mDNS names
     */
    async scanMdnsNames() {
        const mdnsNames = [
            'puppypi.local',
            'laika.local', 
            'raspberrypi.local',
            'pi.local'
        ];
        
        console.log('🔍 Scanning mDNS names...');
        
        const promises = mdnsNames.map(name => this.scanDevice(name));
        await Promise.allSettled(promises);
    }
    
    /**
     * Scan a specific device IP/hostname
     */
    async scanDevice(address) {
        for (const port of this.puppyPiPorts) {
            try {
                const device = await this.checkPuppyPiDevice(address, port);
                if (device) {
                    console.log(`🎯 Found PuppyPi device: ${address}:${port}`);
                    this.discoveredDevices.push(device);
                    
                    if (this.onDeviceFound) {
                        this.onDeviceFound(device);
                    }
                    
                    return device; // Found a device at this address
                }
            } catch (error) {
                // Continue scanning other ports
            }
        }
        
        return null;
    }
    
    /**
     * Check if a specific address:port is a PuppyPi device
     */
    async checkPuppyPiDevice(address, port) {
        const baseUrl = `http://${address}:${port}`;
        
        // Try different health check endpoints
        for (const endpoint of this.healthEndpoints) {
            try {
                const response = await this.fetchWithTimeout(`${baseUrl}${endpoint}`, {
                    method: 'GET',
                    mode: 'cors',
                    timeout: 2000
                });
                
                if (response.ok) {
                    let deviceInfo = {
                        address: address,
                        port: port,
                        baseUrl: baseUrl,
                        endpoint: endpoint,
                        name: 'PuppyPi Device',
                        type: 'puppypi',
                        capabilities: [],
                        timestamp: Date.now()
                    };
                    
                    // Try to get device information
                    try {
                        const data = await response.json();
                        
                        // Check for PuppyPi/LAIKA identifiers
                        if (data.name && (data.name.toLowerCase().includes('laika') || 
                                         data.name.toLowerCase().includes('puppy'))) {
                            deviceInfo.name = data.name;
                            deviceInfo.type = 'laika';
                        }
                        
                        if (data.version) deviceInfo.version = data.version;
                        if (data.capabilities) deviceInfo.capabilities = data.capabilities;
                        if (data.status) deviceInfo.status = data.status;
                        
                    } catch (e) {
                        // JSON parsing failed, but device responded - still valid
                    }
                    
                    // Test WebSocket capability
                    deviceInfo.websocketUrl = await this.findWebSocketEndpoint(baseUrl);
                    
                    return deviceInfo;
                }
            } catch (error) {
                // Continue to next endpoint
            }
        }
        
        return null;
    }
    
    /**
     * Find working WebSocket endpoint for a device
     */
    async findWebSocketEndpoint(baseUrl) {
        const wsBaseUrl = baseUrl.replace('http:', 'ws:').replace('https:', 'wss:');
        
        for (const endpoint of this.wsEndpoints) {
            const wsUrl = `${wsBaseUrl}${endpoint}`;
            
            try {
                // Test WebSocket connection
                const testResult = await this.testWebSocketConnection(wsUrl);
                if (testResult) {
                    return wsUrl;
                }
            } catch (error) {
                // Continue to next endpoint
            }
        }
        
        return null; // No WebSocket endpoint found
    }
    
    /**
     * Test WebSocket connection
     */
    async testWebSocketConnection(wsUrl) {
        return new Promise((resolve) => {
            try {
                const ws = new WebSocket(wsUrl);
                const timeout = setTimeout(() => {
                    ws.close();
                    resolve(false);
                }, 1000);
                
                ws.onopen = () => {
                    clearTimeout(timeout);
                    ws.close();
                    resolve(true);
                };
                
                ws.onerror = () => {
                    clearTimeout(timeout);
                    resolve(false);
                };
                
            } catch (error) {
                resolve(false);
            }
        });
    }
    
    /**
     * Connect to a discovered device via WebSocket
     */
    async connectToDevice(device) {
        if (!device || !device.websocketUrl) {
            throw new Error('Device does not support WebSocket connection');
        }
        
        console.log(`🔌 Connecting to ${device.name} via WebSocket...`);
        
        try {
            // Close existing connection
            if (this.websocket) {
                this.websocket.close();
            }
            
            this.websocket = new WebSocket(device.websocketUrl);
            this.currentDevice = device;
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('WebSocket connection timeout'));
                }, 5000);
                
                this.websocket.onopen = () => {
                    clearTimeout(timeout);
                    console.log(`✅ Connected to ${device.name}`);
                    
                    if (this.onConnectionEstablished) {
                        this.onConnectionEstablished(device);
                    }
                    
                    resolve(device);
                };
                
                this.websocket.onmessage = (event) => {
                    this.handleWebSocketMessage(event);
                };
                
                this.websocket.onclose = (event) => {
                    console.log(`🔌 WebSocket connection closed: ${event.code}`);
                    this.currentDevice = null;
                    
                    if (this.onConnectionLost) {
                        this.onConnectionLost(event);
                    }
                };
                
                this.websocket.onerror = (error) => {
                    clearTimeout(timeout);
                    console.error('🔌 WebSocket error:', error);
                    reject(error);
                };
            });
            
        } catch (error) {
            console.error('🔌 Failed to connect to device:', error);
            throw error;
        }
    }
    
    /**
     * Handle incoming WebSocket messages
     */
    handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('📨 Received WebSocket message:', data);
            
            // Dispatch custom event for other components to handle
            const customEvent = new CustomEvent('puppypi-message', {
                detail: { device: this.currentDevice, message: data }
            });
            window.dispatchEvent(customEvent);
            
        } catch (error) {
            console.error('📨 Error parsing WebSocket message:', error);
        }
    }
    
    /**
     * Send command to connected device
     */
    async sendCommand(command, data = null) {
        if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
            throw new Error('No active WebSocket connection');
        }
        
        const message = {
            command: command,
            data: data,
            timestamp: Date.now()
        };
        
        console.log('📤 Sending command:', message);
        this.websocket.send(JSON.stringify(message));
    }
    
    /**
     * Disconnect from current device
     */
    disconnect() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        this.currentDevice = null;
    }
    
    /**
     * Get best available device (highest priority/capabilities)
     */
    getBestDevice() {
        if (this.discoveredDevices.length === 0) {
            return null;
        }
        
        // Sort by priority: LAIKA devices first, then by capabilities
        const sorted = [...this.discoveredDevices].sort((a, b) => {
            // LAIKA devices have higher priority
            if (a.type === 'laika' && b.type !== 'laika') return -1;
            if (b.type === 'laika' && a.type !== 'laika') return 1;
            
            // Devices with WebSocket support have higher priority
            if (a.websocketUrl && !b.websocketUrl) return -1;
            if (b.websocketUrl && !a.websocketUrl) return 1;
            
            // More capabilities = higher priority
            return (b.capabilities?.length || 0) - (a.capabilities?.length || 0);
        });
        
        return sorted[0];
    }
    
    /**
     * Utility: fetch with timeout
     */
    async fetchWithTimeout(url, options = {}) {
        const timeout = options.timeout || 3000;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    
    /**
     * Utility: delay
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Check if device is still reachable
     */
    async pingDevice(device) {
        try {
            const response = await this.fetchWithTimeout(`${device.baseUrl}/health`, {
                timeout: 2000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Auto-discover and connect to best device
     */
    async autoConnect() {
        console.log('🔍 Starting auto-discovery and connection...');
        
        await this.startScan();
        
        const bestDevice = this.getBestDevice();
        if (bestDevice) {
            await this.connectToDevice(bestDevice);
            return bestDevice;
        } else {
            throw new Error('No PuppyPi devices found on network');
        }
    }
}

// Export for use in other modules
window.NetworkScanner = NetworkScanner;


