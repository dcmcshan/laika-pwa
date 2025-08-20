/**
 * Enhanced Gamepad Manager
 * Bluetooth gamepad support for iPhone and other devices
 * Includes controller passthrough to robot
 */

class GamepadManager {
    constructor(controlInstance) {
        this.control = controlInstance;
        this.gamepads = new Map();
        this.supportedControllers = new Map();
        this.isScanning = false;
        this.passthroughMode = false;
        this.hapticSupported = false;
        
        // Controller database
        this.initControllerDatabase();
        
        // State tracking
        this.previousStates = new Map();
        this.deadzone = 0.15;
        this.pollRate = 60; // Hz
        this.isPolling = false;
        
        // Bluetooth support
        this.bluetoothDevice = null;
        this.bluetoothCharacteristic = null;
        
        this.init();
    }

    init() {
        this.setupGamepadAPI();
        this.setupBluetoothAPI();
        this.checkHapticSupport();
        
        console.log('🎮 Enhanced Gamepad Manager initialized');
    }

    initControllerDatabase() {
        // Popular gamepad mappings for iPhone/iPad
        this.supportedControllers.set('PlayStation Controller', {
            name: 'DualShock 4/DualSense',
            vendor: 'Sony',
            mapping: 'standard',
            bluetoothService: '1812', // HID Service
            features: ['haptic', 'gyro', 'touchpad']
        });

        this.supportedControllers.set('Xbox Controller', {
            name: 'Xbox Wireless Controller',
            vendor: 'Microsoft', 
            mapping: 'standard',
            bluetoothService: '1812',
            features: ['haptic', 'trigger-feedback']
        });

        this.supportedControllers.set('MFi Controller', {
            name: 'MFi Certified Controller',
            vendor: 'Various',
            mapping: 'standard',
            bluetoothService: '1812',
            features: ['basic']
        });

        this.supportedControllers.set('Nintendo Switch Pro', {
            name: 'Switch Pro Controller',
            vendor: 'Nintendo',
            mapping: 'nintendo',
            bluetoothService: '1812',
            features: ['haptic', 'gyro', 'nfc']
        });
    }

    setupGamepadAPI() {
        // Standard Gamepad API events
        window.addEventListener('gamepadconnected', (e) => {
            this.onGamepadConnected(e.gamepad);
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            this.onGamepadDisconnected(e.gamepad);
        });

        // Start polling for gamepad input
        this.startPolling();
    }

    setupBluetoothAPI() {
        // Check for Web Bluetooth support
        if (!navigator.bluetooth) {
            console.log('⚠️ Web Bluetooth not supported');
            return;
        }

        console.log('📶 Web Bluetooth API available');
    }

    checkHapticSupport() {
        // Check for Haptic Feedback API (iOS 13+)
        if ('vibrate' in navigator || 'hapticFeedback' in navigator) {
            this.hapticSupported = true;
            console.log('📳 Haptic feedback supported');
        }
    }

    async scanForBluetoothControllers() {
        if (!navigator.bluetooth) {
            throw new Error('Bluetooth not supported');
        }

        this.isScanning = true;

        try {
            console.log('🔍 Scanning for Bluetooth controllers...');

            const device = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: ['human_interface_device'] },
                    { services: [0x1812] }, // HID Service
                    { namePrefix: 'DualShock' },
                    { namePrefix: 'Xbox' },
                    { namePrefix: 'Switch' }
                ],
                optionalServices: ['battery_service', 'device_information']
            });

            console.log(`🎮 Found device: ${device.name}`);
            await this.connectBluetoothController(device);

        } catch (error) {
            console.error('❌ Bluetooth scan failed:', error);
            throw error;
        } finally {
            this.isScanning = false;
        }
    }

    async connectBluetoothController(device) {
        try {
            console.log(`🔗 Connecting to ${device.name}...`);

            this.bluetoothDevice = device;
            const server = await device.gatt.connect();
            
            // Get HID service
            const service = await server.getPrimaryService(0x1812);
            
            // Get report characteristic
            const characteristic = await service.getCharacteristic(0x2A4D);
            this.bluetoothCharacteristic = characteristic;

            // Listen for input reports
            await characteristic.startNotifications();
            characteristic.addEventListener('characteristicvaluechanged', 
                (event) => this.handleBluetoothInput(event));

            // Handle disconnection
            device.addEventListener('gattserverdisconnected', () => {
                this.onBluetoothDisconnected();
            });

            console.log(`✅ Connected to ${device.name}`);
            this.triggerHapticFeedback('connected');

            return true;

        } catch (error) {
            console.error('❌ Bluetooth connection failed:', error);
            throw error;
        }
    }

    handleBluetoothInput(event) {
        const data = new Uint8Array(event.target.value.buffer);
        
        // Parse HID report based on controller type
        const controllerData = this.parseHIDReport(data);
        
        if (controllerData) {
            this.processControllerInput(controllerData, 'bluetooth');
        }
    }

    parseHIDReport(data) {
        // Basic HID report parsing for standard controllers
        if (data.length < 8) return null;

        const gamepadState = {
            buttons: [],
            axes: [],
            timestamp: performance.now()
        };

        // Parse button states (first 2 bytes typically)
        const buttonByte1 = data[1];
        const buttonByte2 = data[2];

        // Standard button mapping
        gamepadState.buttons = [
            !!(buttonByte1 & 0x01), // A/Cross
            !!(buttonByte1 & 0x02), // B/Circle  
            !!(buttonByte1 & 0x04), // X/Square
            !!(buttonByte1 & 0x08), // Y/Triangle
            !!(buttonByte1 & 0x10), // L1/LB
            !!(buttonByte1 & 0x20), // R1/RB
            !!(buttonByte1 & 0x40), // L2/LT
            !!(buttonByte1 & 0x80), // R2/RT
            !!(buttonByte2 & 0x01), // Select/Share
            !!(buttonByte2 & 0x02), // Start/Options
            !!(buttonByte2 & 0x04), // L3
            !!(buttonByte2 & 0x08), // R3
        ];

        // Parse analog stick data (typically bytes 3-6)
        if (data.length >= 7) {
            gamepadState.axes = [
                (data[3] - 128) / 128, // Left stick X
                (data[4] - 128) / 128, // Left stick Y  
                (data[5] - 128) / 128, // Right stick X
                (data[6] - 128) / 128, // Right stick Y
            ];
        }

        return gamepadState;
    }

    onGamepadConnected(gamepad) {
        console.log(`🎮 Gamepad connected: ${gamepad.id}`);
        
        this.gamepads.set(gamepad.index, {
            gamepad: gamepad,
            type: this.identifyController(gamepad.id),
            connected: true,
            lastUpdate: performance.now()
        });

        this.previousStates.set(gamepad.index, this.cloneGamepadState(gamepad));
        this.triggerHapticFeedback('connected');

        // Notify control instance
        if (this.control && this.control.onGamepadConnected) {
            this.control.onGamepadConnected(gamepad);
        }
    }

    onGamepadDisconnected(gamepad) {
        console.log(`🎮 Gamepad disconnected: ${gamepad.id}`);
        
        this.gamepads.delete(gamepad.index);
        this.previousStates.delete(gamepad.index);

        // Notify control instance
        if (this.control && this.control.onGamepadDisconnected) {
            this.control.onGamepadDisconnected(gamepad);
        }
    }

    onBluetoothDisconnected() {
        console.log('📶 Bluetooth controller disconnected');
        this.bluetoothDevice = null;
        this.bluetoothCharacteristic = null;
    }

    identifyController(id) {
        const idLower = id.toLowerCase();
        
        if (idLower.includes('dualshock') || idLower.includes('dualsense')) {
            return 'PlayStation Controller';
        } else if (idLower.includes('xbox')) {
            return 'Xbox Controller';
        } else if (idLower.includes('switch')) {
            return 'Nintendo Switch Pro';
        } else if (idLower.includes('mfi')) {
            return 'MFi Controller';
        }
        
        return 'Unknown Controller';
    }

    startPolling() {
        if (this.isPolling) return;
        
        this.isPolling = true;
        const pollInterval = 1000 / this.pollRate;

        const poll = () => {
            if (!this.isPolling) return;

            this.pollGamepads();
            setTimeout(poll, pollInterval);
        };

        poll();
    }

    stopPolling() {
        this.isPolling = false;
    }

    pollGamepads() {
        const gamepads = navigator.getGamepads();
        
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (!gamepad) continue;

            const gamepadInfo = this.gamepads.get(i);
            if (!gamepadInfo) {
                // New gamepad detected
                this.onGamepadConnected(gamepad);
                continue;
            }

            // Process input changes
            this.processGamepadInput(gamepad, i);
        }
    }

    processGamepadInput(gamepad, index) {
        const previousState = this.previousStates.get(index);
        if (!previousState) return;

        const changes = this.getInputChanges(gamepad, previousState);
        
        if (changes.buttons.length > 0 || changes.axes.length > 0) {
            // Send to control instance
            if (this.control && this.control.processGamepadInput) {
                this.control.processGamepadInput(gamepad, changes);
            }

            // Send to robot if passthrough enabled
            if (this.passthroughMode) {
                this.sendGamepadToRobot(gamepad, changes);
            }
        }

        // Update previous state
        this.previousStates.set(index, this.cloneGamepadState(gamepad));
    }

    processControllerInput(controllerData, source) {
        // Process parsed controller data from Bluetooth
        if (this.control && this.control.processControllerInput) {
            this.control.processControllerInput(controllerData, source);
        }

        if (this.passthroughMode) {
            this.sendControllerToRobot(controllerData, source);
        }
    }

    getInputChanges(current, previous) {
        const changes = {
            buttons: [],
            axes: []
        };

        // Check button changes
        for (let i = 0; i < current.buttons.length; i++) {
            const currentPressed = current.buttons[i].pressed;
            const previousPressed = previous.buttons[i]?.pressed || false;
            
            if (currentPressed !== previousPressed) {
                changes.buttons.push({
                    index: i,
                    pressed: currentPressed,
                    value: current.buttons[i].value
                });

                // Trigger haptic for button presses
                if (currentPressed) {
                    this.triggerHapticFeedback('button');
                }
            }
        }

        // Check axis changes (with deadzone)
        for (let i = 0; i < current.axes.length; i++) {
            const currentValue = current.axes[i];
            const previousValue = previous.axes[i] || 0;
            
            const currentFiltered = Math.abs(currentValue) < this.deadzone ? 0 : currentValue;
            const previousFiltered = Math.abs(previousValue) < this.deadzone ? 0 : previousValue;
            
            if (Math.abs(currentFiltered - previousFiltered) > 0.01) {
                changes.axes.push({
                    index: i,
                    value: currentFiltered,
                    delta: currentFiltered - previousFiltered
                });
            }
        }

        return changes;
    }

    sendGamepadToRobot(gamepad, changes) {
        const gamepadData = {
            type: 'gamepad_input',
            gamepad_id: gamepad.id,
            timestamp: performance.now(),
            buttons: gamepad.buttons.map(btn => ({
                pressed: btn.pressed,
                value: btn.value
            })),
            axes: gamepad.axes.slice(),
            changes: changes
        };

        // Send via WebSocket to robot
        if (this.control && this.control.sendMessage) {
            this.control.sendMessage(gamepadData);
        }
    }

    sendControllerToRobot(controllerData, source) {
        const message = {
            type: 'controller_input',
            source: source,
            timestamp: controllerData.timestamp,
            data: controllerData
        };

        if (this.control && this.control.sendMessage) {
            this.control.sendMessage(message);
        }
    }

    triggerHapticFeedback(type) {
        if (!this.hapticSupported) return;

        const patterns = {
            'button': [10],
            'connected': [50, 30, 50],
            'error': [100, 50, 100, 50, 100],
            'success': [30, 20, 30]
        };

        const pattern = patterns[type] || patterns['button'];

        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }

        // Also try to trigger controller haptic if connected
        this.triggerControllerHaptic(type);
    }

    triggerControllerHaptic(type) {
        // Send haptic command to connected gamepads
        this.gamepads.forEach((gamepadInfo) => {
            const gamepad = gamepadInfo.gamepad;
            
            if (gamepad.hapticActuators) {
                gamepad.hapticActuators.forEach(actuator => {
                    const intensity = type === 'button' ? 0.3 : 0.5;
                    const duration = type === 'button' ? 50 : 100;
                    
                    actuator.pulse(intensity, duration).catch(() => {
                        // Haptic not supported on this controller
                    });
                });
            }
        });
    }

    cloneGamepadState(gamepad) {
        return {
            buttons: gamepad.buttons.map(btn => ({
                pressed: btn.pressed,
                value: btn.value
            })),
            axes: gamepad.axes.slice(),
            timestamp: gamepad.timestamp
        };
    }

    setPassthroughMode(enabled) {
        this.passthroughMode = enabled;
        console.log(`🎮 Gamepad passthrough: ${enabled ? 'enabled' : 'disabled'}`);
    }

    setDeadzone(value) {
        this.deadzone = Math.max(0, Math.min(1, value));
        console.log(`🎮 Deadzone set to: ${this.deadzone}`);
    }

    getConnectedControllers() {
        return Array.from(this.gamepads.values()).map(info => ({
            id: info.gamepad.id,
            type: info.type,
            connected: info.connected,
            lastUpdate: info.lastUpdate
        }));
    }

    disconnect() {
        this.stopPolling();
        
        if (this.bluetoothDevice && this.bluetoothDevice.gatt.connected) {
            this.bluetoothDevice.gatt.disconnect();
        }

        this.gamepads.clear();
        this.previousStates.clear();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GamepadManager;
} else {
    window.GamepadManager = GamepadManager;
}
