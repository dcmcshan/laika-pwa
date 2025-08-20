/**
 * BLE Improv Protocol Implementation
 * Implements the BLE Improv specification for WiFi provisioning
 * https://www.improv-wifi.com/
 */

class BLEImprov {
    constructor() {
        // BLE Improv Service UUIDs
        this.SERVICE_UUID = '00467768-6228-2272-4663-277478268000';
        this.CURRENT_STATE_UUID = '00467768-6228-2272-4663-277478268001';
        this.ERROR_STATE_UUID = '00467768-6228-2272-4663-277478268002';
        this.RPC_COMMAND_UUID = '00467768-6228-2272-4663-277478268003';
        this.RPC_RESULT_UUID = '00467768-6228-2272-4663-277478268004';
        this.CAPABILITIES_UUID = '00467768-6228-2272-4663-277478268005';
        
        // Alternative service UUIDs for fallback scanning
        this.LAIKA_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
        this.CHAT_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
        this.FALLBACK_SERVICES = [
            this.SERVICE_UUID,
            this.LAIKA_SERVICE_UUID, 
            this.CHAT_SERVICE_UUID,
            '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
            '0000180a-0000-1000-8000-00805f9b34fb'  // Device Information Service
        ];
        
        // States
        this.STATES = {
            READY: 0x02,
            PROVISIONING: 0x03,
            PROVISIONED: 0x04
        };
        
        // Errors
        this.ERRORS = {
            NO_ERROR: 0x00,
            INVALID_RPC: 0x01,
            UNKNOWN_RPC: 0x02,
            UNABLE_TO_CONNECT: 0x03,
            NOT_AUTHORIZED: 0x04
        };
        
        // Commands
        this.COMMANDS = {
            WIFI_SETTINGS: 0x01,
            IDENTIFY: 0x02
        };
        
        this.device = null;
        this.server = null;
        this.characteristics = {};
        this.isConnected = false;
        
        this.onStateChange = null;
        this.onError = null;
        this.onResult = null;
        this.onDisconnected = null;
    }

    /**
     * Check if Web Bluetooth is supported
     */
    isSupported() {
        return 'bluetooth' in navigator && 'requestDevice' in navigator.bluetooth;
    }

    /**
     * Check for previously paired devices and auto-connect if available
     */
    async checkForPairedDevices() {
        if (!this.isSupported()) {
            return null;
        }

        try {
            // Check if getDevices is supported (Chrome 85+)
            if (!navigator.bluetooth.getDevices) {
                console.log('getDevices not supported, cannot check for paired devices');
                return null;
            }

            console.log('Checking for previously paired devices...');
            const devices = await navigator.bluetooth.getDevices();
            
            if (devices.length === 0) {
                console.log('No previously paired devices found');
                return null;
            }

            console.log(`Found ${devices.length} paired device(s):`, devices.map(d => d.name));
            
            // Look for LAIKA devices or devices that support Improv
            for (const device of devices) {
                if (device.name && (device.name.includes('LAIKA') || device.name.includes('ESP32'))) {
                    console.log(`Found potential LAIKA device: ${device.name}`);
                    
                    // Try to connect to this device
                    try {
                        if (device.gatt && device.gatt.connected) {
                            console.log('Device already connected');
                            this.device = device;
                            this.setupDeviceListeners();
                            return device;
                        }
                        
                        // Try to connect
                        console.log(`Attempting auto-connection to ${device.name}...`);
                        this.device = device;
                        this.setupDeviceListeners();
                        
                        // Try to connect and verify services
                        await this.connect();
                        console.log(`Successfully auto-connected to ${device.name}`);
                        return device;
                        
                    } catch (connectError) {
                        console.warn(`Auto-connection to ${device.name} failed:`, connectError);
                        // Continue to next device
                        continue;
                    }
                }
            }
            
            console.log('No suitable paired LAIKA devices found for auto-connection');
            return null;
            
        } catch (error) {
            console.warn('Error checking for paired devices:', error);
            return null;
        }
    }

    /**
     * Set up device event listeners
     */
    setupDeviceListeners() {
        if (!this.device) return;
        
        // Remove existing listeners to avoid duplicates
        this.device.removeEventListener('gattserverdisconnected', this.handleDisconnection);
        
        // Add disconnect listener
        this.handleDisconnection = () => {
            console.log('Device disconnected');
            this.isConnected = false;
            if (this.onDisconnected) {
                this.onDisconnected();
            }
        };
        
        this.device.addEventListener('gattserverdisconnected', this.handleDisconnection);
    }

    /**
     * Scan for BLE Improv devices
     */
    async scan() {
        if (!this.isSupported()) {
            throw new Error('Web Bluetooth is not supported in this browser');
        }

        try {
            console.log('Scanning for BLE Improv devices...');
            
            // Try multiple scanning strategies for better device discovery
            let device = null;
            
            // Strategy 1: Try scanning with Improv service UUID
            try {
                console.log('Trying Improv service UUID scan...');
                device = await navigator.bluetooth.requestDevice({
                    filters: [
                        { services: [this.SERVICE_UUID] }
                    ],
                    optionalServices: this.FALLBACK_SERVICES
                });
            } catch (improvError) {
                console.log('Improv service scan failed, trying LAIKA service scan...');
                
                // Strategy 2: Try scanning with LAIKA service UUID
                try {
                    device = await navigator.bluetooth.requestDevice({
                        filters: [
                            { services: [this.LAIKA_SERVICE_UUID] }
                        ],
                        optionalServices: this.FALLBACK_SERVICES
                    });
                } catch (laikaError) {
                    console.log('LAIKA service scan failed, trying name-based scan...');
                    
                    // Strategy 3: Try scanning by device name
                    try {
                        device = await navigator.bluetooth.requestDevice({
                            filters: [
                                { namePrefix: 'LAIKA' },
                                { namePrefix: 'ESP32' }
                            ],
                            optionalServices: this.FALLBACK_SERVICES
                        });
                    } catch (nameError) {
                        console.log('Name-based scan failed, trying multiple services scan...');
                        
                        // Strategy 4: Try scanning with any of our known services
                        try {
                            device = await navigator.bluetooth.requestDevice({
                                filters: this.FALLBACK_SERVICES.map(service => ({ services: [service] })),
                                optionalServices: this.FALLBACK_SERVICES
                            });
                        } catch (multiError) {
                            console.log('Multi-service scan failed, trying accept all devices...');
                            
                            // Strategy 5: Accept all devices (let user choose)
                            device = await navigator.bluetooth.requestDevice({
                                acceptAllDevices: true,
                                optionalServices: this.FALLBACK_SERVICES
                            });
                        }
                    }
                }
            }

            if (!device) {
                throw new Error('No device selected');
            }

            this.device = device;
            console.log('Device found:', this.device.name);
            
            // Set up device listeners
            this.setupDeviceListeners();

            return this.device;
        } catch (error) {
            console.error('Scan failed:', error);
            throw error;
        }
    }

    /**
     * Connect to the BLE device
     */
    async connect() {
        if (!this.device) {
            throw new Error('No device selected. Call scan() first.');
        }

        try {
            console.log('Connecting to device...');
            
            this.server = await this.device.gatt.connect();
            console.log('Connected to GATT server');

            // Try to get the Improv service with fallback handling
            let service = null;
            let serviceType = 'unknown';
            
            // Try each service UUID in order of preference
            for (const serviceUuid of this.FALLBACK_SERVICES) {
                try {
                    service = await this.server.getPrimaryService(serviceUuid);
                    if (serviceUuid === this.SERVICE_UUID) {
                        serviceType = 'improv';
                    } else if (serviceUuid === this.LAIKA_SERVICE_UUID) {
                        serviceType = 'laika';
                    } else if (serviceUuid === this.CHAT_SERVICE_UUID) {
                        serviceType = 'chat';
                    } else {
                        serviceType = 'standard';
                    }
                    console.log(`Got ${serviceType} service: ${serviceUuid}`);
                    break;
                } catch (serviceError) {
                    console.log(`Service ${serviceUuid} not found, trying next...`);
                    continue;
                }
            }
            
            if (!service) {
                console.warn('No known services found, trying to list available services...');
                
                // List all available services for debugging
                try {
                    const services = await this.server.getPrimaryServices();
                    console.log('Available services:', services.map(s => s.uuid));
                    
                    // If we have any services, try to use the first one
                    if (services.length > 0) {
                        service = services[0];
                        serviceType = 'fallback';
                        console.log(`Using fallback service: ${service.uuid}`);
                    }
                } catch (listError) {
                    console.error('Could not list services:', listError);
                }
                
                if (!service) {
                    throw new Error(`No compatible services found on device. This device may not support LAIKA protocols.`);
                }
            }

            // Store the service type for later use
            this.currentServiceType = serviceType;

            // Get all characteristics with individual error handling
            try {
                this.characteristics.currentState = await service.getCharacteristic(this.CURRENT_STATE_UUID);
                console.log('Got current state characteristic');
            } catch (error) {
                console.warn('Current state characteristic not found:', error);
            }

            try {
                this.characteristics.errorState = await service.getCharacteristic(this.ERROR_STATE_UUID);
                console.log('Got error state characteristic');
            } catch (error) {
                console.warn('Error state characteristic not found:', error);
            }

            try {
                this.characteristics.rpcCommand = await service.getCharacteristic(this.RPC_COMMAND_UUID);
                console.log('Got RPC command characteristic');
            } catch (error) {
                console.warn('RPC command characteristic not found:', error);
            }

            try {
                this.characteristics.rpcResult = await service.getCharacteristic(this.RPC_RESULT_UUID);
                console.log('Got RPC result characteristic');
            } catch (error) {
                console.warn('RPC result characteristic not found:', error);
            }

            try {
                this.characteristics.capabilities = await service.getCharacteristic(this.CAPABILITIES_UUID);
                console.log('Got capabilities characteristic');
            } catch (error) {
                console.warn('Capabilities characteristic not found:', error);
            }

            // Verify we have at least the essential characteristics
            if (!this.characteristics.rpcCommand) {
                throw new Error('Essential RPC command characteristic not found. Device may not support Improv protocol.');
            }

            console.log('Got required characteristics');

            // Set up notifications with error handling
            if (this.characteristics.currentState) {
                try {
                    await this.characteristics.currentState.startNotifications();
                    this.characteristics.currentState.addEventListener('characteristicvaluechanged', (event) => {
                        const state = new Uint8Array(event.target.value.buffer)[0];
                        console.log('State changed:', state);
                        if (this.onStateChange) {
                            this.onStateChange(state);
                        }
                    });
                    console.log('Current state notifications enabled');
                } catch (error) {
                    console.warn('Could not enable current state notifications:', error);
                }
            }

            if (this.characteristics.errorState) {
                try {
                    await this.characteristics.errorState.startNotifications();
                    this.characteristics.errorState.addEventListener('characteristicvaluechanged', (event) => {
                        const error = new Uint8Array(event.target.value.buffer)[0];
                        console.log('Error state:', error);
                        if (this.onError) {
                            this.onError(error);
                        }
                    });
                    console.log('Error state notifications enabled');
                } catch (error) {
                    console.warn('Could not enable error state notifications:', error);
                }
            }

            if (this.characteristics.rpcResult) {
                try {
                    await this.characteristics.rpcResult.startNotifications();
                    this.characteristics.rpcResult.addEventListener('characteristicvaluechanged', (event) => {
                        const result = new Uint8Array(event.target.value.buffer);
                        console.log('RPC result:', result);
                        if (this.onResult) {
                            this.onResult(result);
                        }
                    });
                    console.log('RPC result notifications enabled');
                } catch (error) {
                    console.warn('Could not enable RPC result notifications:', error);
                }
            }

            this.isConnected = true;
            console.log('BLE Improv connection established');
            
            return true;
        } catch (error) {
            console.error('Connection failed:', error);
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Disconnect from the device
     */
    async disconnect() {
        if (this.server && this.server.connected) {
            await this.server.disconnect();
        }
        this.isConnected = false;
        this.device = null;
        this.server = null;
        this.characteristics = {};
    }

    /**
     * Get current device state
     */
    async getCurrentState() {
        if (!this.isConnected) {
            throw new Error('Not connected to device');
        }

        try {
            const value = await this.characteristics.currentState.readValue();
            const state = new Uint8Array(value.buffer)[0];
            return state;
        } catch (error) {
            console.error('Failed to read current state:', error);
            throw error;
        }
    }

    /**
     * Get device capabilities
     */
    async getCapabilities() {
        if (!this.isConnected) {
            throw new Error('Not connected to device');
        }

        try {
            const value = await this.characteristics.capabilities.readValue();
            const capabilities = new Uint8Array(value.buffer)[0];
            return capabilities;
        } catch (error) {
            console.error('Failed to read capabilities:', error);
            throw error;
        }
    }

    /**
     * Send identify command
     */
    async identify() {
        if (!this.isConnected) {
            throw new Error('Not connected to device');
        }

        try {
            const command = new Uint8Array([this.COMMANDS.IDENTIFY]);
            await this.characteristics.rpcCommand.writeValue(command);
            console.log('Identify command sent');
        } catch (error) {
            console.error('Failed to send identify command:', error);
            throw error;
        }
    }

    /**
     * Scan for WiFi networks via system command
     */
    async scanNetworks() {
        if (!this.isConnected) {
            throw new Error('Not connected to device');
        }

        try {
            console.log('📡 Requesting WiFi network scan...');
            
            // For now, return some common networks + scan results
            // In production, this would query the device's WiFi scan results
            const mockNetworks = [
                { ssid: 'Home_WiFi', signal: 85, security: true },
                { ssid: 'Guest_Network', signal: 72, security: false },
                { ssid: 'Office_5G', signal: 68, security: true },
                { ssid: 'Neighbor_WiFi', signal: 45, security: true }
            ];
            
            if (this.onNetworksFound) {
                this.onNetworksFound(mockNetworks);
            }
            
            return mockNetworks;
            
        } catch (error) {
            console.error('Failed to scan networks:', error);
            throw error;
        }
    }

    /**
     * Configure WiFi settings
     */
    async configureWiFi(ssid, password) {
        if (!this.isConnected) {
            throw new Error('Not connected to device');
        }

        try {
            console.log(`Configuring WiFi: ${ssid}`);
            
            // Encode SSID and password
            const ssidBytes = new TextEncoder().encode(ssid);
            const passwordBytes = new TextEncoder().encode(password);
            
            // Build command: [COMMAND, SSID_LENGTH, SSID_BYTES, PASSWORD_LENGTH, PASSWORD_BYTES]
            const command = new Uint8Array(1 + 1 + ssidBytes.length + 1 + passwordBytes.length);
            let offset = 0;
            
            // Command type
            command[offset++] = this.COMMANDS.WIFI_SETTINGS;
            
            // SSID length and bytes
            command[offset++] = ssidBytes.length;
            command.set(ssidBytes, offset);
            offset += ssidBytes.length;
            
            // Password length and bytes
            command[offset++] = passwordBytes.length;
            command.set(passwordBytes, offset);
            
            console.log('Sending WiFi configuration command...');
            await this.characteristics.rpcCommand.writeValue(command);
            
        } catch (error) {
            console.error('Failed to configure WiFi:', error);
            throw error;
        }
    }

    /**
     * Send WiFi settings (alias for configureWiFi for compatibility)
     */
    async sendWiFiSettings(ssid, password) {
        return await this.configureWiFi(ssid, password);
    }

    /**
     * Parse RPC result
     */
    parseRpcResult(result) {
        if (result.length < 1) {
            return null;
        }

        const command = result[0];
        let message = '';
        
        if (result.length > 1) {
            // Parse string result
            let offset = 1;
            if (offset < result.length) {
                const messageLength = result[offset++];
                if (offset + messageLength <= result.length) {
                    const messageBytes = result.slice(offset, offset + messageLength);
                    message = new TextDecoder().decode(messageBytes);
                }
            }
        }

        return {
            command,
            message
        };
    }

    /**
     * Get state name from state code
     */
    getStateName(state) {
        switch (state) {
            case this.STATES.READY: return 'Ready';
            case this.STATES.PROVISIONING: return 'Provisioning';
            case this.STATES.PROVISIONED: return 'Provisioned';
            default: return 'Unknown';
        }
    }

    /**
     * Get error name from error code
     */
    getErrorName(error) {
        switch (error) {
            case this.ERRORS.NO_ERROR: return 'No Error';
            case this.ERRORS.INVALID_RPC: return 'Invalid RPC';
            case this.ERRORS.UNKNOWN_RPC: return 'Unknown RPC';
            case this.ERRORS.UNABLE_TO_CONNECT: return 'Unable to Connect';
            case this.ERRORS.NOT_AUTHORIZED: return 'Not Authorized';
            default: return 'Unknown Error';
        }
    }
}

// Export for use in other scripts
window.BLEImprov = BLEImprov;
