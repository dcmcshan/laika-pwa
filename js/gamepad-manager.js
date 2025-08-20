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
            // Process button actions using physical gamepad mapping
            this.processGamepadActions(gamepad, changes);
            
            // Send to control instance
            if (this.control && this.control.processGamepadInput) {
                this.control.processGamepadInput(gamepad, changes);
            }

            // Send to robot if passthrough enabled (direct robot control)
            if (this.passthroughMode) {
                this.sendGamepadToRobot(gamepad, changes);
            }
        }

        // Update previous state
        this.previousStates.set(index, this.cloneGamepadState(gamepad));
    }

    // LLM-based gamepad action processing - let LAIKA's brain decide what to do
    async processGamepadActions(gamepad, changes) {
        const buttonMapping = this.getStandardButtonMapping();
        
        // Process button presses through LLM
        for (const buttonChange of changes.buttons) {
            if (buttonChange.pressed) {
                const buttonName = buttonMapping[buttonChange.index];
                
                if (buttonName) {
                    console.log(`🎮 Web gamepad button ${buttonName} -> sending to LLM for interpretation`);
                    await this.sendGamepadInputToLLM({
                        type: 'button_press',
                        button: buttonName,
                        timestamp: Date.now(),
                        context: this.getGamepadContext(gamepad)
                    });
                }
            }
        }

        // Process analog stick movements through LLM (with throttling)
        this.processAnalogMovementLLM(gamepad);
    }

    // Send gamepad context to LLM for intelligent interpretation
    getGamepadContext(gamepad) {
        return {
            leftStick: {
                x: gamepad.axes[0] || 0,
                y: gamepad.axes[1] || 0,
                magnitude: Math.sqrt((gamepad.axes[0] || 0)**2 + (gamepad.axes[1] || 0)**2)
            },
            rightStick: {
                x: gamepad.axes[2] || 0,
                y: gamepad.axes[3] || 0,
                magnitude: Math.sqrt((gamepad.axes[2] || 0)**2 + (gamepad.axes[3] || 0)**2)
            },
            activeButtons: Array.from({length: gamepad.buttons.length}, (_, i) => 
                gamepad.buttons[i].pressed ? this.getStandardButtonMapping()[i] : null
            ).filter(Boolean),
            gamepadId: gamepad.id,
            timestamp: Date.now()
        };
    }

    // Enhanced button mapping to match physical gamepad exactly
    getStandardButtonMapping() {
        return {
            0: 'a',           // A/Cross button
            1: 'b',           // B/Circle button  
            2: 'x',           // X/Square button
            3: 'y',           // Y/Triangle button
            4: 'l1',          // Left shoulder button
            5: 'r1',          // Right shoulder button
            6: 'l2',          // Left trigger
            7: 'r2',          // Right trigger
            8: 'select',      // Select/Back button
            9: 'start',       // Start/Menu button
            10: 'left-stick', // Left stick press
            11: 'right-stick',// Right stick press
            12: 'dpad-up',    // D-pad up
            13: 'dpad-down',  // D-pad down
            14: 'dpad-left',  // D-pad left
            15: 'dpad-right'  // D-pad right
        };
    }

    // Enhanced physical gamepad action mapping (matches enhanced_gamepad_handler.py)
    getPhysicalGamepadActions() {
        return {
            'a': 'hello',           // Greeting gesture
            'b': 'dance',           // Dance routine
            'x': 'play_sound',      // Play sound/bark
            'y': 'take_photo',      // Take photo
            'l1': 'speed_boost',    // Increase speed
            'r1': 'precision_mode', // Precision mode
            'l2': 'crouch',         // Lower stance
            'r2': 'stretch',        // Stretch routine
            'select': 'sleep',      // Sleep mode
            'start': 'emergency_stop', // Emergency stop
            'left-stick': 'center_head',   // Center head
            'right-stick': 'led_rainbow',  // LED rainbow
            'dpad-up': 'head_up',     // Head up
            'dpad-down': 'head_down', // Head down  
            'dpad-left': 'head_left', // Head left
            'dpad-right': 'head_right' // Head right
        };
    }

    // Process analog stick movements through LLM with intelligent interpretation
    processAnalogMovementLLM(gamepad) {
        const deadzone = 0.15;
        
        // Left stick: movement (x = strafe, y = forward/back)
        const leftX = Math.abs(gamepad.axes[0]) > deadzone ? gamepad.axes[0] : 0;
        const leftY = Math.abs(gamepad.axes[1]) > deadzone ? -gamepad.axes[1] : 0; // Invert Y
        
        // Right stick: rotation and head control
        const rightX = Math.abs(gamepad.axes[2]) > deadzone ? gamepad.axes[2] : 0;
        const rightY = Math.abs(gamepad.axes[3]) > deadzone ? -gamepad.axes[3] : 0; // Invert Y
        
        // Throttle movement updates to avoid overwhelming the LLM
        const now = Date.now();
        if (!this.lastMovementUpdate || (now - this.lastMovementUpdate) > 200) { // 5Hz max
            
            // Send movement intent to LLM if significant movement detected
            if (Math.abs(leftX) > 0.05 || Math.abs(leftY) > 0.05 || 
                Math.abs(rightX) > 0.05 || Math.abs(rightY) > 0.05) {
                
                this.sendGamepadInputToLLM({
                    type: 'movement_input',
                    movement: {
                        leftStick: { x: leftX, y: leftY },
                        rightStick: { x: rightX, y: rightY },
                        intent: this.interpretMovementIntent(leftX, leftY, rightX, rightY)
                    },
                    timestamp: now,
                    context: this.getGamepadContext(gamepad)
                });
                
                this.lastMovementUpdate = now;
            }
        }
    }

    // Interpret movement intent for the LLM
    interpretMovementIntent(leftX, leftY, rightX, rightY) {
        const intents = [];
        
        // Analyze left stick (movement)
        if (Math.abs(leftY) > 0.1) {
            intents.push(leftY > 0 ? 'move_forward' : 'move_backward');
        }
        if (Math.abs(leftX) > 0.1) {
            intents.push(leftX > 0 ? 'strafe_right' : 'strafe_left');
        }
        
        // Analyze right stick (look/turn)
        if (Math.abs(rightX) > 0.1) {
            intents.push(rightX > 0 ? 'turn_right' : 'turn_left');
        }
        if (Math.abs(rightY) > 0.1) {
            intents.push(rightY > 0 ? 'look_up' : 'look_down');
        }
        
        return intents;
    }

    // Send gamepad input to unified LLM endpoint
    async sendGamepadInputToLLM(gamepadInput) {
        try {
            // Extract the button name or movement info
            let input = '';
            if (gamepadInput.type === 'button_press') {
                input = gamepadInput.button;
            } else if (gamepadInput.type === 'movement_input') {
                input = `movement: ${JSON.stringify(gamepadInput.movement.intent)}`;
            }

            // First try WebSocket for real-time communication
            if (this.control && this.control.ws && this.control.ws.readyState === WebSocket.OPEN) {
                const message = {
                    type: 'llm_input',
                    input: input,
                    source: 'web_gamepad',
                    gamepad_context: gamepadInput.context,
                    timestamp: Date.now()
                };
                
                this.control.ws.send(JSON.stringify(message));
                console.log(`🧠 Sent to LLM via WebSocket: "${input}"`);
                return;
            }

            // Fallback to simple HTTP endpoint
            const response = await fetch('/llm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: input,
                    type: 'gamepad',
                    source: 'web_gamepad',
                    button: gamepadInput.button,
                    timestamp: Date.now()
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`🧠 LLM response:`, result.response);
                
                // Action is automatically executed by the server
                if (result.action_executed) {
                    console.log(`✅ Action "${result.action}" executed successfully`);
                }
            } else {
                console.error(`❌ Failed to send to LLM:`, response.statusText);
            }
        } catch (error) {
            console.error(`❌ Error sending to LLM:`, error);
        }
    }

    // Execute actions suggested by the LLM
    async executeLLMSuggestedActions(actions) {
        for (const action of actions) {
            console.log(`🤖 Executing LLM-suggested action:`, action);
            
            if (action.type === 'robot_command') {
                await this.sendDirectRobotCommand(action.command, action.parameters);
            } else if (action.type === 'movement') {
                await this.sendMovementCommand(action.movement);
            } else if (action.type === 'speech') {
                console.log(`🗣️ LAIKA says: ${action.text}`);
                // Could integrate with TTS system here
            }
        }
    }

    // Send direct robot command (bypassing further LLM processing)
    async sendDirectRobotCommand(command, parameters = {}) {
        try {
            const response = await fetch('/api/robot/direct_command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    command: command,
                    parameters: parameters,
                    source: 'llm_gamepad_processor',
                    timestamp: Date.now()
                })
            });

            if (!response.ok) {
                console.error(`❌ Failed to send direct robot command:`, response.statusText);
            }
        } catch (error) {
            console.error(`❌ Error sending direct robot command:`, error);
        }
    }

    // Send movement command (matches physical gamepad motion control)
    async sendMovementCommand(movement) {
        try {
            const response = await fetch('/gamepad_movement', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(movement)
            });

            if (!response.ok) {
                console.error('❌ Failed to send movement command:', response.statusText);
            }
        } catch (error) {
            console.error('❌ Error sending movement command:', error);
        }
    }

    // Send head movement command
    async sendHeadMovement(yValue) {
        const action = yValue > 0 ? 'head_up' : 'head_down';
        await this.sendRobotAction(action, 'right-stick-y');
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

        // Send raw gamepad data to LAIKA
        if (this.control && this.control.sendLAIKAMessage) {
            this.control.sendLAIKAMessage(gamepadData);
        } else if (this.control && this.control.sendMessage) {
            this.control.sendMessage(gamepadData);
        } else {
            console.log('📡 No control interface available for gamepad data');
        }
    }

    sendControllerToRobot(controllerData, source) {
        const message = {
            type: 'controller_input',
            source: source,
            timestamp: controllerData.timestamp || Date.now(),
            data: controllerData
        };

        // Send to LAIKA via control interface
        if (this.control && this.control.sendLAIKAMessage) {
            this.control.sendLAIKAMessage(message);
        } else if (this.control && this.control.sendMessage) {
            this.control.sendMessage(message);
        } else {
            console.log('📡 No control interface available for controller data');
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
