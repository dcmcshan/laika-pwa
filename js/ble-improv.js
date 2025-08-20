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
     * Scan for BLE Improv devices
     */
    async scan() {
        if (!this.isSupported()) {
            throw new Error('Web Bluetooth is not supported in this browser');
        }

        try {
            console.log('Scanning for BLE Improv devices...');
            
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: [this.SERVICE_UUID] },
                    { namePrefix: 'LAIKA' },
                    { namePrefix: 'ESP32' }
                ],
                optionalServices: [this.SERVICE_UUID]
            });

            console.log('Device found:', this.device.name);
            
            // Add disconnect listener
            this.device.addEventListener('gattserverdisconnected', () => {
                console.log('Device disconnected');
                this.isConnected = false;
                if (this.onDisconnected) {
                    this.onDisconnected();
                }
            });

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

            // Get the Improv service
            const service = await this.server.getPrimaryService(this.SERVICE_UUID);
            console.log('Got Improv service');

            // Get all characteristics
            this.characteristics.currentState = await service.getCharacteristic(this.CURRENT_STATE_UUID);
            this.characteristics.errorState = await service.getCharacteristic(this.ERROR_STATE_UUID);
            this.characteristics.rpcCommand = await service.getCharacteristic(this.RPC_COMMAND_UUID);
            this.characteristics.rpcResult = await service.getCharacteristic(this.RPC_RESULT_UUID);
            this.characteristics.capabilities = await service.getCharacteristic(this.CAPABILITIES_UUID);

            console.log('Got all characteristics');

            // Set up notifications
            await this.characteristics.currentState.startNotifications();
            this.characteristics.currentState.addEventListener('characteristicvaluechanged', (event) => {
                const state = new Uint8Array(event.target.value.buffer)[0];
                console.log('State changed:', state);
                if (this.onStateChange) {
                    this.onStateChange(state);
                }
            });

            await this.characteristics.errorState.startNotifications();
            this.characteristics.errorState.addEventListener('characteristicvaluechanged', (event) => {
                const error = new Uint8Array(event.target.value.buffer)[0];
                console.log('Error state:', error);
                if (this.onError) {
                    this.onError(error);
                }
            });

            await this.characteristics.rpcResult.startNotifications();
            this.characteristics.rpcResult.addEventListener('characteristicvaluechanged', (event) => {
                const result = new Uint8Array(event.target.value.buffer);
                console.log('RPC result:', result);
                if (this.onResult) {
                    this.onResult(result);
                }
            });

            this.isConnected = true;
            console.log('BLE Improv connection established');
            
            return true;
        } catch (error) {
            console.error('Connection failed:', error);
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
