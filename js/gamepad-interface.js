/**
 * LAIKA Gamepad Interface
 * Real-time gamepad visualization and monitoring
 */

class LAIKAGamepadInterface {
    constructor() {
        this.isConnected = false;
        this.socket = null;
        this.gamepadConnected = false;
        this.connectionStartTime = null;
        this.stats = {
            totalPresses: 0,
            activeButtons: 0,
            lastButton: 'None'
        };
        this.buttonStates = {};
        this.buttonNames = {
            0: 'A', 1: 'B', 2: 'X', 3: 'Y',
            4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2',
            8: 'SELECT', 9: 'START', 10: 'L3', 11: 'R3',
            12: 'D-UP', 13: 'D-DOWN', 14: 'D-LEFT', 15: 'D-RIGHT',
            16: 'HOME'
        };
        
        this.init();
    }

    async init() {
        console.log('🎮 Initializing LAIKA Gamepad Interface...');
        
        this.setupEventListeners();
        this.connectToLAIKA();
        this.startGamepadPolling();
        this.updateConnectionTime();
        
        console.log('✅ Gamepad Interface initialized');
    }

    setupEventListeners() {
        // Window events
        window.addEventListener('beforeunload', () => {
            if (this.socket) {
                this.socket.disconnect();
            }
        });

        // Gamepad connection events
        window.addEventListener('gamepadconnected', (e) => {
            console.log('🎮 Physical gamepad connected:', e.gamepad.id);
            this.handleGamepadConnected(e.gamepad);
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            console.log('🎮 Physical gamepad disconnected:', e.gamepad.id);
            this.handleGamepadDisconnected();
        });
    }

    connectToLAIKA() {
        try {
            console.log('🔗 Connecting to LAIKA gamepad service...');
            
            // Connect to the current origin with proper Engine.IO version
            this.socket = io(window.location.origin, {
                transports: ['polling', 'websocket'],
                upgrade: true,
                rememberUpgrade: true,
                forceNew: true,
                query: {
                    EIO: '4'
                },
                timeout: 10000
            });

            this.socket.on('connect', () => {
                console.log('✅ Connected to LAIKA gamepad service');
                this.isConnected = true;
                this.updateConnectionStatus();
                
                // Send initial handshake
                this.socket.emit('gamepad_interface_connected', {
                    client_id: 'gamepad_interface',
                    timestamp: Date.now()
                });
            });

            this.socket.on('disconnect', () => {
                console.log('📡 Disconnected from LAIKA gamepad service');
                this.isConnected = false;
                this.updateConnectionStatus();
            });

            // Listen for gamepad events from the system
            this.socket.on('gamepad_button_press', (data) => {
                this.handleGamepadButtonPress(data);
            });

            this.socket.on('gamepad_button_release', (data) => {
                this.handleGamepadButtonRelease(data);
            });

            this.socket.on('gamepad_status', (data) => {
                this.handleGamepadStatus(data);
            });

            this.socket.on('error', (error) => {
                console.error('❌ Socket error:', error);
            });

        } catch (error) {
            console.error('❌ Failed to connect to LAIKA gamepad service:', error);
        }
    }

    startGamepadPolling() {
        // Poll for gamepad state changes
        const pollGamepads = () => {
            const gamepads = navigator.getGamepads();
            let hasConnectedGamepad = false;

            for (let i = 0; i < gamepads.length; i++) {
                const gamepad = gamepads[i];
                if (gamepad && gamepad.connected) {
                    hasConnectedGamepad = true;
                    this.processGamepadState(gamepad);
                }
            }

            if (hasConnectedGamepad !== this.gamepadConnected) {
                this.gamepadConnected = hasConnectedGamepad;
                this.updateConnectionStatus();
            }

            requestAnimationFrame(pollGamepads);
        };

        pollGamepads();
    }

    processGamepadState(gamepad) {
        // Check button states
        for (let i = 0; i < gamepad.buttons.length; i++) {
            const button = gamepad.buttons[i];
            const wasPressed = this.buttonStates[i] || false;
            const isPressed = button.pressed;

            if (isPressed !== wasPressed) {
                this.buttonStates[i] = isPressed;
                
                if (isPressed) {
                    this.handleButtonPress(i);
                } else {
                    this.handleButtonRelease(i);
                }
            }
        }

        // Update active button count
        this.stats.activeButtons = Object.values(this.buttonStates).filter(pressed => pressed).length;
        this.updateStats();
    }

    handleGamepadConnected(gamepad) {
        this.gamepadConnected = true;
        this.connectionStartTime = Date.now();
        this.updateConnectionStatus();
        this.addLogEntry(`🎮 Gamepad connected: ${gamepad.id}`, 'connected');
    }

    handleGamepadDisconnected() {
        this.gamepadConnected = false;
        this.connectionStartTime = null;
        this.buttonStates = {};
        this.clearAllButtonStates();
        this.updateConnectionStatus();
        this.addLogEntry('🎮 Gamepad disconnected', 'disconnected');
    }

    handleButtonPress(buttonIndex) {
        const buttonName = this.buttonNames[buttonIndex] || `Button ${buttonIndex}`;
        
        // Update visual state
        this.setButtonState(buttonIndex, true);
        
        // Update stats
        this.stats.totalPresses++;
        this.stats.lastButton = buttonName;
        this.updateStats();
        
        // Add log entry
        this.addLogEntry(`🔘 ${buttonName} pressed`, 'pressed');
        
        console.log(`🎮 Button ${buttonIndex} (${buttonName}) pressed`);
    }

    handleButtonRelease(buttonIndex) {
        const buttonName = this.buttonNames[buttonIndex] || `Button ${buttonIndex}`;
        
        // Update visual state
        this.setButtonState(buttonIndex, false);
        
        // Add log entry
        this.addLogEntry(`⚪ ${buttonName} released`, 'released');
        
        console.log(`🎮 Button ${buttonIndex} (${buttonName}) released`);
    }

    handleGamepadButtonPress(data) {
        // Handle gamepad events from the server (physical gamepad via system)
        const buttonIndex = data.button_index || data.button;
        if (buttonIndex !== undefined) {
            this.handleButtonPress(buttonIndex);
        }
    }

    handleGamepadButtonRelease(data) {
        // Handle gamepad events from the server (physical gamepad via system)
        const buttonIndex = data.button_index || data.button;
        if (buttonIndex !== undefined) {
            this.handleButtonRelease(buttonIndex);
        }
    }

    handleGamepadStatus(data) {
        console.log('🎮 Gamepad status update:', data);
        if (data.connected !== undefined) {
            this.gamepadConnected = data.connected;
            this.updateConnectionStatus();
        }
    }

    setButtonState(buttonIndex, pressed) {
        const buttonElement = document.querySelector(`[data-button="${buttonIndex}"]`);
        if (buttonElement) {
            if (pressed) {
                buttonElement.classList.add('pressed');
            } else {
                buttonElement.classList.remove('pressed');
            }
        }
    }

    clearAllButtonStates() {
        const buttons = document.querySelectorAll('.gamepad-button');
        buttons.forEach(button => {
            button.classList.remove('pressed');
        });
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connectionStatus');
        
        if (this.gamepadConnected) {
            statusElement.textContent = '🟢 Gamepad Connected';
            statusElement.className = 'connection-status connected';
        } else {
            statusElement.textContent = '🔴 Gamepad Disconnected';
            statusElement.className = 'connection-status disconnected';
        }
    }

    updateStats() {
        document.getElementById('totalPresses').textContent = this.stats.totalPresses;
        document.getElementById('activeButtons').textContent = this.stats.activeButtons;
        document.getElementById('lastButton').textContent = this.stats.lastButton;
    }

    updateConnectionTime() {
        const updateTime = () => {
            const timeElement = document.getElementById('connectionTime');
            
            if (this.connectionStartTime) {
                const elapsed = Date.now() - this.connectionStartTime;
                const minutes = Math.floor(elapsed / 60000);
                const seconds = Math.floor((elapsed % 60000) / 1000);
                timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } else {
                timeElement.textContent = '--:--';
            }
            
            setTimeout(updateTime, 1000);
        };
        
        updateTime();
    }

    addLogEntry(message, type = 'info') {
        const logContainer = document.getElementById('buttonLog');
        const timestamp = new Date().toLocaleTimeString();
        
        const entry = document.createElement('div');
        entry.className = `button-log-entry ${type}`;
        entry.textContent = `[${timestamp}] ${message}`;
        
        // Add to top of log
        if (logContainer.firstChild && logContainer.firstChild.textContent.includes('Waiting for')) {
            logContainer.innerHTML = '';
        }
        
        logContainer.insertBefore(entry, logContainer.firstChild);
        
        // Keep only last 50 entries
        while (logContainer.children.length > 50) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.laikaGamepadInterface = new LAIKAGamepadInterface();
});

