/**
 * LAIKA Robot Control Interface
 * ROS2 command interface with gamepad-style controls
 */

class LAIKAControl {
    constructor() {
        this.isConnected = false;
        this.currentMode = 'manual';
        this.gamepadConnected = false;
        this.commandRate = 0;
        this.lastCommandTime = Date.now();
        
        // Audio/Video feed state
        this.videoEnabled = false;
        this.audioEnabled = false;
        this.streamConnected = false;
        
        // Enhanced gamepad manager
        this.gamepadManager = null;
        
        // ROS2 connection
        this.ws = null;
        this.rosbridge = null;
        
        // Control state
        this.controlState = {
            leftStick: { x: 0, y: 0 },
            rightStick: { x: 0, y: 0 },
            buttons: new Set(),
            triggers: { l1: 0, r1: 0 }
        };
        
        // Command mappings
        this.buttonMappings = {
            'a': 'servo_dance',
            'b': 'led_rainbow',
            'x': 'play_sound',
            'y': 'take_photo',
            'dpad-up': 'head_up',
            'dpad-down': 'head_down',
            'dpad-left': 'head_left',
            'dpad-right': 'head_right',
            'l1': 'speed_boost',
            'r1': 'precision_mode',
            'start': 'autonomous_mode',
            'select': 'reset_pose'
        };
        
        // ROS2 Topics
        this.topics = {
            cmd_vel: '/cmd_vel',
            servo_commands: '/servo_commands',
            led_control: '/led_control',
            emergency_stop: '/emergency_stop',
            robot_state: '/robot_state',
            joint_states: '/joint_states',
            odom: '/odom'
        };
        
        // Telemetry data
        this.telemetry = {
            linearVel: 0,
            angularVel: 0,
            battery: 85,
            temperature: 45,
            imuStatus: 'STABLE'
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupEnhancedGamepadSupport();
        this.updateUI();
        this.startStatusUpdates();
        
        // Attempt to connect
        await this.connectWebSocket();
        
        // Initialize video/audio feed
        this.initializeVideoFeed();
        
        console.log('🎮 LAIKA Robot Control initialized');
    }

    setupEventListeners() {
        // Mode selector buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setControlMode(e.target.dataset.mode);
            });
        });

        // Gamepad buttons
        document.querySelectorAll('[data-button]').forEach(btn => {
            btn.addEventListener('mousedown', (e) => this.onButtonPress(e.target.dataset.button));
            btn.addEventListener('mouseup', (e) => this.onButtonRelease(e.target.dataset.button));
            btn.addEventListener('mouseleave', (e) => this.onButtonRelease(e.target.dataset.button));
            
            // Touch events for mobile
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.onButtonPress(e.target.dataset.button);
            });
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.onButtonRelease(e.target.dataset.button);
            });
        });

        // Analog stick controls
        this.setupAnalogSticks();

        // Emergency stop
        document.getElementById('emergencyStop').addEventListener('click', () => this.emergencyStop());

        // Bluetooth controller connection
        document.getElementById('bluetoothConnect').addEventListener('click', () => this.connectBluetoothController());

        // Video/Audio controls
        document.getElementById('controlVideoToggle')?.addEventListener('click', () => this.toggleVideo());
        document.getElementById('controlAudioToggle')?.addEventListener('click', () => this.toggleAudio());

        // Keyboard controls
        document.addEventListener('keydown', (e) => this.handleKeyboard(e, true));
        document.addEventListener('keyup', (e) => this.handleKeyboard(e, false));

        // Page visibility for safety
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopAllCommands();
            }
        });
    }

    setupAnalogSticks() {
        const sticks = document.querySelectorAll('.analog-stick');
        
        sticks.forEach(stick => {
            const knob = stick.querySelector('.stick-knob');
            const stickType = stick.dataset.stick;
            let isDragging = false;
            let stickCenter = { x: 0, y: 0 };
            
            const updateStickCenter = () => {
                const rect = stick.getBoundingClientRect();
                stickCenter = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                };
            };
            
            const moveStick = (clientX, clientY) => {
                updateStickCenter();
                
                const deltaX = clientX - stickCenter.x;
                const deltaY = clientY - stickCenter.y;
                const maxDistance = 20; // Max distance knob can move
                
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const limitedDistance = Math.min(distance, maxDistance);
                
                const angle = Math.atan2(deltaY, deltaX);
                const x = Math.cos(angle) * limitedDistance;
                const y = Math.sin(angle) * limitedDistance;
                
                knob.style.transform = `translate(${-50 + x}%, ${-50 + y}%)`;
                
                // Normalize to -1 to 1 range
                const normalizedX = x / maxDistance;
                const normalizedY = -y / maxDistance; // Invert Y axis
                
                this.controlState[stickType + 'Stick'] = { 
                    x: normalizedX, 
                    y: normalizedY 
                };
                
                this.sendMovementCommand();
            };
            
            const resetStick = () => {
                knob.style.transform = 'translate(-50%, -50%)';
                this.controlState[stickType + 'Stick'] = { x: 0, y: 0 };
                this.sendMovementCommand();
            };
            
            // Mouse events
            stick.addEventListener('mousedown', (e) => {
                isDragging = true;
                updateStickCenter();
                moveStick(e.clientX, e.clientY);
                e.preventDefault();
            });
            
            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    moveStick(e.clientX, e.clientY);
                }
            });
            
            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    resetStick();
                }
            });
            
            // Touch events
            stick.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                isDragging = true;
                updateStickCenter();
                moveStick(touch.clientX, touch.clientY);
            });
            
            document.addEventListener('touchmove', (e) => {
                if (isDragging && e.touches.length > 0) {
                    e.preventDefault();
                    const touch = e.touches[0];
                    moveStick(touch.clientX, touch.clientY);
                }
            });
            
            document.addEventListener('touchend', (e) => {
                if (isDragging) {
                    e.preventDefault();
                    isDragging = false;
                    resetStick();
                }
            });
        });
    }

    setupEnhancedGamepadSupport() {
        // Initialize enhanced gamepad manager
        if (typeof GamepadManager !== 'undefined') {
            this.gamepadManager = new GamepadManager(this);
            console.log('🎮 Enhanced Gamepad Manager initialized');
        } else {
            console.log('⚠️ Enhanced Gamepad Manager not available, falling back to basic support');
            this.setupBasicGamepadSupport();
        }
    }

    setupBasicGamepadSupport() {
        // Fallback gamepad support
        if (!navigator.getGamepads) {
            console.log('⚠️ Gamepad API not supported');
            return;
        }

        // Basic gamepad connection events
        window.addEventListener('gamepadconnected', (e) => {
            console.log('🎮 Gamepad connected:', e.gamepad.id);
            this.gamepadConnected = true;
            this.updateControllerStatus(e.gamepad.id);
            this.startGamepadLoop();
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('🎮 Gamepad disconnected:', e.gamepad.id);
            this.gamepadConnected = false;
            this.updateControllerStatus(null);
        });

        // Start checking for gamepads
        this.checkGamepadConnection();
    }

    checkGamepadConnection() {
        const gamepads = navigator.getGamepads();
        if (gamepads && gamepads[0] && !this.gamepadConnected) {
            this.gamepadConnected = true;
            this.startGamepadLoop();
        }
        
        if (!this.gamepadConnected) {
            setTimeout(() => this.checkGamepadConnection(), 1000);
        }
    }

    startGamepadLoop() {
        if (!this.gamepadConnected) return;

        const gamepadLoop = () => {
            if (!this.gamepadConnected) return;

            const gamepads = navigator.getGamepads();
            const gamepad = gamepads[0];

            if (gamepad) {
                this.processGamepadInput(gamepad);
            }

            requestAnimationFrame(gamepadLoop);
        };

        requestAnimationFrame(gamepadLoop);
    }

    connectSocketIO() {
        // Load SocketIO library if not already loaded
        if (typeof io === 'undefined') {
            console.log('📦 Loading SocketIO library...');
            const script = document.createElement('script');
            script.src = '/socket.io/socket.io.js';
            script.onload = () => {
                console.log('✅ SocketIO library loaded');
                this.initializeSocketIO();
            };
            script.onerror = () => {
                console.error('❌ Failed to load SocketIO library');
                this.isConnected = false;
                this.updateConnectionStatus();
            };
            document.head.appendChild(script);
        } else {
            this.initializeSocketIO();
        }
    }

    initializeSocketIO() {
        try {
            console.log('🔗 Connecting to LAIKA via SocketIO...');
            
            // Connect to the current origin (ngrok tunnel)
            this.socket = io(window.location.origin, {
                transports: ['websocket', 'polling'],
                upgrade: true,
                rememberUpgrade: true
            });

            this.socket.on('connect', () => {
                console.log('✅ SocketIO connected to LAIKA');
                this.isConnected = true;
                this.updateConnectionStatus();
                
                // Send initial handshake
                this.socket.emit('control_connected', {
                    client_id: 'control_interface',
                    timestamp: Date.now()
                });
            });

            this.socket.on('disconnect', () => {
                console.log('📡 SocketIO disconnected');
                this.isConnected = false;
                this.updateConnectionStatus();
                setTimeout(() => this.reconnect(), 3000);
            });

            this.socket.on('control_response', (data) => {
                console.log('🎮 Control response:', data);
            });

            this.socket.on('gamepad_response', (data) => {
                console.log('🎮 Gamepad response:', data);
            });

            this.socket.on('movement_response', (data) => {
                console.log('🎮 Movement response:', data);
            });

            this.socket.on('controller_response', (data) => {
                console.log('🎮 Controller response:', data);
            });

            this.socket.on('error_response', (data) => {
                console.error('❌ LAIKA error:', data);
            });

            this.socket.on('connect_error', (error) => {
                console.error('❌ SocketIO connection error:', error);
                this.isConnected = false;
                this.updateConnectionStatus();
            });

        } catch (error) {
            console.error('❌ Error initializing SocketIO:', error);
            this.isConnected = false;
            this.updateConnectionStatus();
        }
    }

    processGamepadInput(gamepad) {
        // Analog sticks
        const leftStick = {
            x: Math.abs(gamepad.axes[0]) > 0.1 ? gamepad.axes[0] : 0,
            y: Math.abs(gamepad.axes[1]) > 0.1 ? gamepad.axes[1] : 0
        };
        
        const rightStick = {
            x: Math.abs(gamepad.axes[2]) > 0.1 ? gamepad.axes[2] : 0,
            y: Math.abs(gamepad.axes[3]) > 0.1 ? gamepad.axes[3] : 0
        };

        // Update visual sticks
        this.updateVisualStick('left', leftStick);
        this.updateVisualStick('right', rightStick);

        this.controlState.leftStick = leftStick;
        this.controlState.rightStick = rightStick;

        // Buttons
        const buttonMapping = [
            'a', 'b', 'x', 'y',           // 0-3: Face buttons
            'l1', 'r1', 'l2', 'r2',       // 4-7: Shoulder buttons  
            'select', 'start',             // 8-9: Menu buttons
            'left-stick', 'right-stick',   // 10-11: Stick buttons
            'dpad-up', 'dpad-down',        // 12-13: D-pad up/down
            'dpad-left', 'dpad-right'      // 14-15: D-pad left/right
        ];

        gamepad.buttons.forEach((button, index) => {
            const buttonName = buttonMapping[index];
            if (!buttonName) return;

            if (button.pressed && !this.controlState.buttons.has(buttonName)) {
                this.onButtonPress(buttonName);
            } else if (!button.pressed && this.controlState.buttons.has(buttonName)) {
                this.onButtonRelease(buttonName);
            }
        });

        this.sendMovementCommand();
    }

    updateVisualStick(stickType, position) {
        const stick = document.querySelector(`[data-stick="${stickType}"]`);
        const knob = stick?.querySelector('.stick-knob');
        
        if (knob) {
            const x = position.x * 20; // 20px max movement
            const y = -position.y * 20; // Invert Y axis
            knob.style.transform = `translate(${-50 + x}%, ${-50 + y}%)`;
        }
    }

    async connectWebSocket() {
        // For ngrok environment, use SocketIO through the main tunnel
        if (window.location.hostname.includes('ngrok')) {
            console.log('🌐 Detected ngrok environment - using SocketIO through main tunnel');
            this.connectSocketIO();
            return;
        }
        
        // LAIKA WebSocket server URLs - for local development
        const wsUrls = [
            `ws://${window.location.hostname}:8765`, // LAIKA WebSocket server port
            'ws://laika.local:8765',
            'ws://localhost:8765'
        ];

        for (const url of wsUrls) {
            try {
                console.log(`🔗 Attempting WebSocket connection to ${url}`);
                
                this.ws = new WebSocket(url);
                
                this.ws.onopen = () => {
                    console.log('✅ WebSocket connected to LAIKA');
                    this.isConnected = true;
                    this.updateConnectionStatus();
                    this.subscribeToTopics();
                    
                    // Send initial handshake to LAIKA
                    this.sendLAIKAMessage({
                        type: 'control_connected',
                        client_id: 'control_interface',
                        timestamp: Date.now()
                    });
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.handleLAIKAMessage(data);
                    } catch (error) {
                        console.error('❌ Error parsing WebSocket message:', error);
                    }
                };

                this.ws.onclose = () => {
                    console.log('📡 WebSocket disconnected');
                    this.isConnected = false;
                    this.updateConnectionStatus();
                    setTimeout(() => this.reconnect(), 3000);
                };

                this.ws.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                };

                // Wait for connection
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 3000);
                    this.ws.onopen = () => {
                        clearTimeout(timeout);
                        resolve();
                    };
                    this.ws.onerror = () => {
                        clearTimeout(timeout);
                        reject(new Error('Connection failed'));
                    };
                });

                break; // Success, exit loop

            } catch (error) {
                console.log(`❌ Failed to connect to ${url}:`, error.message);
                this.ws = null;
                
                if (url === wsUrls[wsUrls.length - 1]) {
                    console.log('🔄 All connection attempts failed, using simulation mode');
                    this.enableSimulationMode();
                }
            }
        }
    }

    subscribeToTopics() {
        // Subscribe to robot state and telemetry topics
        const subscriptions = [
            { topic: '/odom', type: 'nav_msgs/Odometry' },
            { topic: '/joint_states', type: 'sensor_msgs/JointState' },
            { topic: '/robot_state', type: 'std_msgs/String' },
            { topic: '/battery_state', type: 'sensor_msgs/BatteryState' }
        ];

        subscriptions.forEach(sub => {
            this.sendROSMessage({
                op: 'subscribe',
                topic: sub.topic,
                type: sub.type
            });
        });
    }

    handleLAIKAMessage(message) {
        switch (message.type) {
            case 'status':
                this.handleStatusUpdate(message.data);
                break;
            case 'telemetry':
                this.handleTelemetryUpdate(message.data);
                break;
            case 'response':
                this.handleCommandResponse(message.data);
                break;
            case 'error':
                console.error('LAIKA Error:', message.data);
                break;
            default:
                console.log('LAIKA Message:', message);
        }
    }

    // Legacy compatibility method
    handleROSMessage(message) {
        this.handleLAIKAMessage(message);
    }

    handleTopicMessage(topic, msg) {
        switch (topic) {
            case '/odom':
                this.telemetry.linearVel = Math.sqrt(
                    msg.twist.twist.linear.x ** 2 + 
                    msg.twist.twist.linear.y ** 2
                );
                this.telemetry.angularVel = Math.abs(msg.twist.twist.angular.z);
                break;
            case '/battery_state':
                this.telemetry.battery = Math.round(msg.percentage * 100);
                break;
            case '/robot_state':
                this.telemetry.imuStatus = msg.data;
                break;
            case '/joint_states':
                // Process joint temperature if available
                if (msg.effort && msg.effort.length > 0) {
                    this.telemetry.temperature = Math.max(...msg.effort);
                }
                break;
        }
        
        this.updateTelemetryDisplay();
    }

    handleStatusUpdate(data) {
        if (data.battery !== undefined) {
            this.telemetry.battery = data.battery;
        }
        if (data.wifi) {
            console.log('WiFi status:', data.wifi);
        }
        this.updateTelemetryDisplay();
    }

    handleTelemetryUpdate(data) {
        if (data.linearVel !== undefined) {
            this.telemetry.linearVel = data.linearVel;
        }
        if (data.angularVel !== undefined) {
            this.telemetry.angularVel = data.angularVel;
        }
        if (data.battery !== undefined) {
            this.telemetry.battery = data.battery;
        }
        if (data.temperature !== undefined) {
            this.telemetry.temperature = data.temperature;
        }
        if (data.imuStatus !== undefined) {
            this.telemetry.imuStatus = data.imuStatus;
        }
        this.updateTelemetryDisplay();
    }

    handleCommandResponse(data) {
        if (data.success) {
            console.log('✅ Command executed successfully:', data.message);
        } else {
            console.error('❌ Command failed:', data.error);
        }
    }

    sendLAIKAMessage(message) {
        if (this.socket && this.socket.connected) {
            // Use SocketIO emit with appropriate event name
            const messageType = message.type || 'robot_command';
            this.socket.emit(messageType, message);
        } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Fallback to WebSocket for local development
            this.ws.send(JSON.stringify(message));
        } else {
            console.log('📡 No LAIKA connection available, message queued');
        }
    }

    // Legacy compatibility method
    sendROSMessage(message) {
        this.sendLAIKAMessage(message);
    }

    sendMovementCommand() {
        if (!this.isConnected || this.currentMode !== 'manual') return;

        const leftStick = this.controlState.leftStick;
        const rightStick = this.controlState.rightStick;
        
        // Send raw controller state to LAIKA for processing
        const controllerMessage = {
            type: 'controller_input',
            timestamp: Date.now(),
            data: {
                leftStick: leftStick,
                rightStick: rightStick,
                buttons: Array.from(this.controlState.buttons),
                triggers: this.controlState.triggers,
                mode: this.currentMode
            }
        };

        // Send via SocketIO with specific event type
        if (this.socket && this.socket.connected) {
            this.socket.emit('gamepad_input', {
                type: 'controller_input',
                data: controllerMessage.data,
                timestamp: controllerMessage.timestamp
            });
        } else {
            this.sendLAIKAMessage(controllerMessage);
        }
        
        // Also send traditional movement command for compatibility
        const linear = {
            x: leftStick.y * 2.0, // Forward/backward, max 2 m/s
            y: leftStick.x * 1.0, // Strafe left/right, max 1 m/s
            z: 0.0
        };
        
        const angular = {
            x: 0.0,
            y: 0.0,
            z: rightStick.x * 2.0 // Rotation, max 2 rad/s
        };

        // Apply speed modifiers
        if (this.controlState.buttons.has('l1')) {
            linear.x *= 0.3;
            linear.y *= 0.3;
            angular.z *= 0.3;
        }
        
        if (this.controlState.buttons.has('r1')) {
            linear.x *= 1.5;
            linear.y *= 1.5;
            angular.z *= 1.5;
        }

        const cmdVel = {
            type: 'movement_command',
            timestamp: Date.now(),
            data: {
                linear: linear,
                angular: angular
            }
        };

        this.sendLAIKAMessage(cmdVel);
        this.updateCommandRate();
    }

    publishTwist(twist) {
        this.sendROSMessage({
            op: 'publish',
            topic: this.topics.cmd_vel,
            msg: twist
        });
    }

    onButtonPress(buttonName) {
        this.controlState.buttons.add(buttonName);
        
        // Visual feedback
        const button = document.querySelector(`[data-button="${buttonName}"]`);
        if (button) {
            button.classList.add('active');
        }

        // Send raw button press event to LAIKA
        this.sendLAIKAMessage({
            type: 'button_press',
            timestamp: Date.now(),
            data: {
                button: buttonName,
                pressed: true
            }
        });

        // Execute mapped command
        const command = this.buttonMappings[buttonName];
        if (command && this.currentMode === 'manual') {
            this.executeCommand(command);
        }

        console.log(`🎮 Button pressed: ${buttonName} -> ${command || 'unmapped'}`);
    }

    onButtonRelease(buttonName) {
        this.controlState.buttons.delete(buttonName);
        
        // Visual feedback
        const button = document.querySelector(`[data-button="${buttonName}"]`);
        if (button) {
            button.classList.remove('active');
        }

        // Send raw button release event to LAIKA
        this.sendLAIKAMessage({
            type: 'button_press',
            timestamp: Date.now(),
            data: {
                button: buttonName,
                pressed: false
            }
        });

        // Stop continuous commands
        if (['dpad-up', 'dpad-down', 'dpad-left', 'dpad-right'].includes(buttonName)) {
            this.stopHeadMovement();
        }
    }

    executeCommand(command) {
        switch (command) {
            case 'servo_dance':
                this.sendServoCommand('dance_sequence');
                break;
            case 'led_rainbow':
                this.sendLEDCommand('rainbow');
                break;
            case 'play_sound':
                this.sendAudioCommand('beep');
                break;
            case 'take_photo':
                this.sendCameraCommand('capture');
                break;
            case 'head_up':
                this.sendServoCommand('head_tilt', 30);
                break;
            case 'head_down':
                this.sendServoCommand('head_tilt', -30);
                break;
            case 'head_left':
                this.sendServoCommand('head_pan', -45);
                break;
            case 'head_right':
                this.sendServoCommand('head_pan', 45);
                break;
            case 'reset_pose':
                this.sendServoCommand('reset_all');
                break;
            case 'autonomous_mode':
                this.toggleAutonomousMode();
                break;
            default:
                console.log(`Unknown command: ${command}`);
        }
    }

    sendServoCommand(action, value = 0) {
        const servoMsg = {
            action: action,
            value: value,
            timestamp: Date.now()
        };

        this.sendROSMessage({
            op: 'publish',
            topic: this.topics.servo_commands,
            msg: servoMsg
        });
    }

    sendLEDCommand(pattern) {
        const ledMsg = {
            pattern: pattern,
            duration: 3.0,
            timestamp: Date.now()
        };

        this.sendROSMessage({
            op: 'publish',
            topic: this.topics.led_control,
            msg: ledMsg
        });
    }

    sendCameraCommand(action) {
        // Send camera command through service call
        this.sendROSMessage({
            op: 'call_service',
            service: '/camera_service',
            args: { action: action }
        });
    }

    sendAudioCommand(sound) {
        this.sendROSMessage({
            op: 'publish',
            topic: '/audio_commands',
            msg: { sound: sound }
        });
    }

    emergencyStop() {
        console.log('🛑 EMERGENCY STOP ACTIVATED');
        
        // Stop all movement
        this.publishTwist({
            linear: { x: 0, y: 0, z: 0 },
            angular: { x: 0, y: 0, z: 0 }
        });

        // Send emergency stop signal
        this.sendROSMessage({
            op: 'publish',
            topic: this.topics.emergency_stop,
            msg: { 
                stop: true,
                timestamp: Date.now()
            }
        });

        // Reset all control states
        this.controlState.leftStick = { x: 0, y: 0 };
        this.controlState.rightStick = { x: 0, y: 0 };
        this.controlState.buttons.clear();

        // Visual feedback
        const emergencyBtn = document.getElementById('emergencyStop');
        emergencyBtn.style.animation = 'pulse 0.2s ease infinite';
        setTimeout(() => {
            emergencyBtn.style.animation = '';
        }, 2000);
    }

    stopAllCommands() {
        this.emergencyStop();
    }

    stopHeadMovement() {
        this.sendServoCommand('stop_head');
    }

    setControlMode(mode) {
        this.currentMode = mode;
        
        // Update UI
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
        
        document.getElementById('robotMode').textContent = 
            mode.charAt(0).toUpperCase() + mode.slice(1) + ' Control';
        
        console.log(`🎮 Control mode changed to: ${mode}`);
    }

    toggleAutonomousMode() {
        const newMode = this.currentMode === 'manual' ? 'autonomous' : 'manual';
        this.setControlMode(newMode);
        
        // Send mode change to robot
        this.sendROSMessage({
            op: 'publish',
            topic: '/control_mode',
            msg: { mode: newMode }
        });
    }

    handleKeyboard(event, isPressed) {
        const keyMap = {
            'KeyW': 'dpad-up',
            'KeyS': 'dpad-down',
            'KeyA': 'dpad-left',
            'KeyD': 'dpad-right',
            'Space': 'a',
            'Enter': 'start',
            'Escape': 'select',
            'KeyQ': 'l1',
            'KeyE': 'r1',
            'KeyZ': 'x',
            'KeyX': 'b',
            'KeyC': 'y'
        };

        const buttonName = keyMap[event.code];
        if (buttonName) {
            event.preventDefault();
            if (isPressed) {
                this.onButtonPress(buttonName);
            } else {
                this.onButtonRelease(buttonName);
            }
        }

        // Emergency stop with spacebar
        if (event.code === 'Space' && event.ctrlKey) {
            event.preventDefault();
            this.emergencyStop();
        }
    }

    updateCommandRate() {
        const now = Date.now();
        if (now - this.lastCommandTime < 1000) {
            this.commandRate++;
        } else {
            this.commandRate = 1;
            this.lastCommandTime = now;
        }
    }

    updateTelemetryDisplay() {
        document.getElementById('linearVel').textContent = `${this.telemetry.linearVel.toFixed(2)} m/s`;
        document.getElementById('angularVel').textContent = `${this.telemetry.angularVel.toFixed(2)} rad/s`;
        document.getElementById('batteryTelemetry').textContent = `${this.telemetry.battery}%`;
        document.getElementById('temperature').textContent = `${this.telemetry.temperature}°C`;
        document.getElementById('imuStatus').textContent = this.telemetry.imuStatus;
        document.getElementById('commandRate').textContent = this.commandRate;
    }

    updateUI() {
        this.updateTelemetryDisplay();
        this.updateConnectionStatus();
    }

    updateConnectionStatus() {
        const indicator = document.getElementById('connectionIndicator');
        const status = document.getElementById('connectionStatus');
        
        if (this.isConnected) {
            indicator.classList.add('connected');
            status.textContent = 'ROS2 Connected';
        } else {
            indicator.classList.remove('connected');
            status.textContent = 'Disconnected';
        }
    }

    startStatusUpdates() {
        // Update time
        setInterval(() => {
            const now = new Date();
            document.getElementById('currentTime').textContent = 
                now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }, 1000);

        // Reset command rate counter
        setInterval(() => {
            this.commandRate = 0;
            this.updateTelemetryDisplay();
        }, 1000);

        // Continuous movement commands
        setInterval(() => {
            if (this.isConnected && this.currentMode === 'manual') {
                this.sendMovementCommand();
            }
        }, 100); // 10 Hz update rate
    }

    enableSimulationMode() {
        console.log('🎭 Enabling control simulation mode');
        
        // Simulate connection
        setTimeout(() => {
            this.isConnected = true;
            this.updateConnectionStatus();
        }, 1000);
        
        // Simulate telemetry updates
        setInterval(() => {
            this.telemetry.linearVel = Math.abs(this.controlState.leftStick.y) * 2.0;
            this.telemetry.angularVel = Math.abs(this.controlState.rightStick.x) * 2.0;
            this.telemetry.battery = Math.max(20, 85 + Math.sin(Date.now() / 10000) * 5);
            this.telemetry.temperature = 45 + Math.sin(Date.now() / 5000) * 10;
            this.updateTelemetryDisplay();
        }, 100);
    }

    async connectBluetoothController() {
        const bluetoothBtn = document.getElementById('bluetoothConnect');
        const statusElement = document.getElementById('controllerStatus');
        
        if (!this.gamepadManager || !this.gamepadManager.scanForBluetoothControllers) {
            alert('Bluetooth gamepad support not available');
            return;
        }

        try {
            bluetoothBtn.classList.add('connecting');
            bluetoothBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
            statusElement.textContent = 'Scanning for controllers...';

            await this.gamepadManager.scanForBluetoothControllers();
            
            bluetoothBtn.classList.remove('connecting');
            bluetoothBtn.classList.add('connected');
            bluetoothBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
            
        } catch (error) {
            console.error('Bluetooth connection failed:', error);
            
            bluetoothBtn.classList.remove('connecting');
            bluetoothBtn.innerHTML = '<i class="fas fa-bluetooth"></i> Connect Bluetooth Controller';
            statusElement.textContent = 'Connection failed: ' + error.message;
            
            // Reset button after error display
            setTimeout(() => {
                statusElement.textContent = 'No controller connected';
            }, 3000);
        }
    }

    updateControllerStatus(controllerId) {
        const statusElement = document.getElementById('controllerStatus');
        const bluetoothBtn = document.getElementById('bluetoothConnect');
        
        if (controllerId) {
            statusElement.textContent = `Connected: ${controllerId}`;
            statusElement.classList.add('connected');
            bluetoothBtn.classList.add('connected');
            bluetoothBtn.innerHTML = '<i class="fas fa-gamepad"></i> Controller Connected';
        } else {
            statusElement.textContent = 'No controller connected';
            statusElement.classList.remove('connected');
            bluetoothBtn.classList.remove('connected');
            bluetoothBtn.innerHTML = '<i class="fas fa-bluetooth"></i> Connect Bluetooth Controller';
        }
    }

    // Enhanced gamepad callback methods for GamepadManager
    onGamepadConnected(gamepad) {
        console.log(`🎮 Enhanced gamepad connected: ${gamepad.id}`);
        this.gamepadConnected = true;
        this.updateControllerStatus(gamepad.id);
    }

    onGamepadDisconnected(gamepad) {
        console.log(`🎮 Enhanced gamepad disconnected: ${gamepad.id}`);
        this.gamepadConnected = false;
        this.updateControllerStatus(null);
    }

    processControllerInput(controllerData, source) {
        // Process input from enhanced gamepad manager
        if (source === 'bluetooth') {
            console.log('📶 Bluetooth controller input received');
        }
        
        // Apply controller data to visual gamepad
        this.applyControllerDataToUI(controllerData);
        
        // Send commands if in manual mode
        if (this.currentMode === 'manual') {
            this.processControllerCommands(controllerData);
        }
    }

    applyControllerDataToUI(controllerData) {
        // Update visual gamepad based on controller input
        if (controllerData.axes && controllerData.axes.length >= 4) {
            this.updateVisualStick('left', {
                x: controllerData.axes[0],
                y: controllerData.axes[1]
            });
            this.updateVisualStick('right', {
                x: controllerData.axes[2], 
                y: controllerData.axes[3]
            });
        }

        // Update button states
        if (controllerData.buttons) {
            const buttonMap = ['a', 'b', 'x', 'y', 'l1', 'r1', 'l2', 'r2', 'select', 'start'];
            
            controllerData.buttons.forEach((pressed, index) => {
                const buttonName = buttonMap[index];
                if (buttonName) {
                    const button = document.querySelector(`[data-button="${buttonName}"]`);
                    if (button) {
                        button.classList.toggle('active', pressed);
                    }
                }
            });
        }
    }

    processControllerCommands(controllerData) {
        // Convert controller data to robot commands
        if (controllerData.axes && controllerData.axes.length >= 4) {
            const leftStick = { x: controllerData.axes[0], y: controllerData.axes[1] };
            const rightStick = { x: controllerData.axes[2], y: controllerData.axes[3] };
            
            this.controlState.leftStick = leftStick;
            this.controlState.rightStick = rightStick;
            
            this.sendMovementCommand();
        }
    }

    // Video/Audio Feed Methods
    initializeVideoFeed() {
        console.log('📹 Initializing video feed...');
        
        // Set up video element
        const video = document.getElementById('controlVideoStream');
        if (video) {
            video.addEventListener('loadstart', () => this.onVideoLoadStart());
            video.addEventListener('canplay', () => this.onVideoCanPlay());
            video.addEventListener('error', (e) => this.onVideoError(e));
        }
        
        // Auto-start video feed on page load
        this.autoStartVideoFeed();
    }

    autoStartVideoFeed() {
        console.log('🚀 Auto-starting control video feed...');
        
        // Start video feed automatically
        setTimeout(() => {
            const video = document.getElementById('controlVideoStream');
            if (video) {
                // Use lower frame rate for control page (5-10 fps is plenty)
                const streamUrl = `${this.getServerUrl()}/camera/stream?fps=5&quality=low`;
                video.src = streamUrl;
                this.videoEnabled = true;
                this.updateVideoUI();
                console.log('✅ Control video feed auto-started:', streamUrl);
            }
        }, 1000); // Small delay to ensure page is fully loaded
    }

    toggleVideo() {
        this.videoEnabled = !this.videoEnabled;
        
        if (this.videoEnabled) {
            this.startVideoFeed();
        } else {
            this.stopVideoFeed();
        }
        
        this.updateVideoUI();
        console.log(`📹 Video ${this.videoEnabled ? 'enabled' : 'disabled'}`);
    }

    toggleAudio() {
        this.audioEnabled = !this.audioEnabled;
        
        if (this.audioEnabled) {
            this.startAudioFeed();
        } else {
            this.stopAudioFeed();
        }
        
        this.updateVideoUI();
        console.log(`🔊 Audio ${this.audioEnabled ? 'enabled' : 'disabled'}`);
    }

    startVideoFeed() {
        const video = document.getElementById('controlVideoStream');
        if (video && this.isConnected) {
            // Use the same camera stream as the camera page
            const streamUrl = this.getServerUrl() + '/camera/stream';
            video.src = streamUrl;
            this.videoEnabled = true;
            console.log('📹 Video feed started:', streamUrl);
        }
    }

    stopVideoFeed() {
        const video = document.getElementById('controlVideoStream');
        if (video) {
            video.src = '';
            this.videoEnabled = false;
            console.log('📹 Video feed stopped');
        }
    }

    startAudioFeed() {
        const audio = document.getElementById('controlAudioStream');
        if (audio && this.isConnected) {
            // Connect to audio stream endpoint
            audio.src = this.getServerUrl() + '/api/audio/stream';
            this.audioEnabled = true;
            console.log('🔊 Audio feed started');
        }
    }

    stopAudioFeed() {
        const audio = document.getElementById('controlAudioStream');
        if (audio) {
            audio.src = '';
            this.audioEnabled = false;
            console.log('🔊 Audio feed stopped');
        }
    }

    getServerUrl() {
        // Return the server URL for API calls - use ngrok tunneling if available
        if (window.location.hostname.includes('ngrok')) {
            return `${window.location.protocol}//${window.location.hostname}`;
        }
        return `${window.location.protocol}//${window.location.hostname}:5000`;
    }

    updateVideoUI() {
        // Update video toggle button
        const videoBtn = document.getElementById('controlVideoToggle');
        if (videoBtn) {
            const icon = videoBtn.querySelector('i');
            if (this.videoEnabled) {
                icon.className = 'fas fa-video';
                videoBtn.style.color = 'var(--success)';
            } else {
                icon.className = 'fas fa-video-slash';
                videoBtn.style.color = 'var(--text-primary)';
            }
        }
        
        // Update audio toggle button
        const audioBtn = document.getElementById('controlAudioToggle');
        if (audioBtn) {
            const icon = audioBtn.querySelector('i');
            if (this.audioEnabled) {
                icon.className = 'fas fa-volume-up';
                audioBtn.style.color = 'var(--success)';
            } else {
                icon.className = 'fas fa-volume-mute';
                audioBtn.style.color = 'var(--text-primary)';
            }
        }
        
        // Update stream status
        this.updateStreamStatus();
    }

    updateStreamStatus() {
        const indicator = document.getElementById('controlStreamIndicator');
        const status = document.getElementById('controlStreamStatus');
        
        if (this.videoEnabled || this.audioEnabled) {
            if (indicator) indicator.style.background = 'var(--success)';
            if (status) status.textContent = 'Streaming';
        } else {
            if (indicator) indicator.style.background = 'var(--error)';
            if (status) status.textContent = 'Disconnected';
        }
    }

    // Video event handlers
    onVideoLoadStart() {
        console.log('📹 Control video loading...');
        this.streamConnected = false;
        this.updateStreamStatus();
    }

    onVideoCanPlay() {
        console.log('📹 Control video ready');
        this.streamConnected = true;
        this.updateStreamStatus();
    }

    onVideoError(error) {
        console.error('❌ Control video error:', error);
        this.streamConnected = false;
        this.videoEnabled = false;
        this.updateVideoUI();
    }

    async reconnect() {
        if (!this.isConnected) {
            console.log('🔄 Attempting to reconnect...');
            await this.connectWebSocket();
            
            // Restart video/audio feeds if they were enabled
            if (this.videoEnabled) {
                this.startVideoFeed();
            }
            if (this.audioEnabled) {
                this.startAudioFeed();
            }
        }
    }
}

// Initialize robot control when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.laikaControl = new LAIKAControl();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.laikaControl) {
        window.laikaControl.stopAllCommands();
        if (window.laikaControl.ws) {
            window.laikaControl.ws.close();
        }
    }
});
