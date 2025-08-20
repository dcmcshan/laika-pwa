/**
 * Virtual Gamepad Overlay
 * Touch-based gamepad for devices without physical controllers
 * Provides the same functionality as physical gamepads
 */

class VirtualGamepad {
    constructor(gamepadManager) {
        this.gamepadManager = gamepadManager;
        this.isVisible = false;
        this.isEnabled = false;
        
        // Touch tracking
        this.activeTouches = new Map();
        this.leftStickTouch = null;
        this.rightStickTouch = null;
        
        // Virtual gamepad state
        this.virtualState = {
            buttons: new Map(),
            axes: [0, 0, 0, 0], // left-x, left-y, right-x, right-y
            leftStick: { x: 0, y: 0, active: false },
            rightStick: { x: 0, y: 0, active: false }
        };
        
        // Button mappings (matches physical gamepad)
        this.buttonMappings = {
            'a': 'hello',
            'b': 'dance', 
            'x': 'play_sound',
            'y': 'take_photo',
            'l1': 'speed_boost',
            'r1': 'precision_mode',
            'l2': 'crouch',
            'r2': 'stretch',
            'select': 'sleep',
            'start': 'emergency_stop',
            'dpad-up': 'head_up',
            'dpad-down': 'head_down',
            'dpad-left': 'head_left',
            'dpad-right': 'head_right'
        };
        
        this.init();
    }

    init() {
        this.createVirtualGamepadUI();
        this.setupEventListeners();
        this.checkAutoShow();
        console.log('🎮 Virtual gamepad initialized');
    }

    createVirtualGamepadUI() {
        // Create virtual gamepad container
        this.container = document.createElement('div');
        this.container.id = 'virtual-gamepad';
        this.container.className = 'virtual-gamepad hidden';
        
        this.container.innerHTML = `
            <div class="virtual-gamepad-controls">
                <!-- Left side: D-pad and left analog stick -->
                <div class="gamepad-left">
                    <div class="dpad-container">
                        <button class="dpad-btn dpad-up" data-button="dpad-up">↑</button>
                        <button class="dpad-btn dpad-left" data-button="dpad-left">←</button>
                        <button class="dpad-btn dpad-right" data-button="dpad-right">→</button>
                        <button class="dpad-btn dpad-down" data-button="dpad-down">↓</button>
                    </div>
                    <div class="analog-stick left-stick" data-stick="left">
                        <div class="stick-base">
                            <div class="stick-knob"></div>
                        </div>
                        <div class="stick-label">Move</div>
                    </div>
                </div>

                <!-- Center: Menu buttons -->
                <div class="gamepad-center">
                    <button class="menu-btn select-btn" data-button="select">⏸</button>
                    <div class="gamepad-logo">🎮</div>
                    <button class="menu-btn start-btn" data-button="start">⏹</button>
                </div>

                <!-- Right side: Face buttons and right analog stick -->
                <div class="gamepad-right">
                    <div class="face-buttons">
                        <button class="face-btn y-btn" data-button="y">Y</button>
                        <button class="face-btn x-btn" data-button="x">X</button>
                        <button class="face-btn b-btn" data-button="b">B</button>
                        <button class="face-btn a-btn" data-button="a">A</button>
                    </div>
                    <div class="analog-stick right-stick" data-stick="right">
                        <div class="stick-base">
                            <div class="stick-knob"></div>
                        </div>
                        <div class="stick-label">Look/Turn</div>
                    </div>
                </div>

                <!-- Shoulder buttons -->
                <div class="shoulder-buttons">
                    <button class="shoulder-btn l1-btn" data-button="l1">L1</button>
                    <button class="shoulder-btn r1-btn" data-button="r1">R1</button>
                    <button class="shoulder-btn l2-btn" data-button="l2">L2</button>
                    <button class="shoulder-btn r2-btn" data-button="r2">R2</button>
                </div>
            </div>

            <!-- Toggle button -->
            <button class="virtual-gamepad-toggle" id="virtual-gamepad-toggle">
                🎮
            </button>
        `;

        // Add CSS styles
        this.addVirtualGamepadStyles();
        
        // Append to body
        document.body.appendChild(this.container);
    }

    addVirtualGamepadStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .virtual-gamepad {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 10000;
                user-select: none;
                touch-action: manipulation;
                transition: all 0.3s ease;
            }

            .virtual-gamepad.hidden {
                opacity: 0;
                pointer-events: none;
                transform: translateX(-50%) translateY(100px);
            }

            .virtual-gamepad-controls {
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: rgba(0, 0, 0, 0.9);
                border: 2px solid #00ffff;
                border-radius: 20px;
                padding: 20px;
                min-width: 600px;
                box-shadow: 0 0 30px rgba(0, 255, 255, 0.5);
                backdrop-filter: blur(10px);
            }

            .gamepad-left, .gamepad-right {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 20px;
            }

            .gamepad-center {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 10px;
            }

            /* D-pad styles */
            .dpad-container {
                position: relative;
                width: 80px;
                height: 80px;
            }

            .dpad-btn {
                position: absolute;
                width: 25px;
                height: 25px;
                background: #00ffff;
                border: none;
                border-radius: 4px;
                color: #000;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.1s ease;
            }

            .dpad-up { top: 0; left: 50%; transform: translateX(-50%); }
            .dpad-down { bottom: 0; left: 50%; transform: translateX(-50%); }
            .dpad-left { left: 0; top: 50%; transform: translateY(-50%); }
            .dpad-right { right: 0; top: 50%; transform: translateY(-50%); }

            .dpad-btn:active {
                background: #ffffff;
                transform: scale(0.9) translateX(-50%);
            }

            /* Face buttons */
            .face-buttons {
                position: relative;
                width: 80px;
                height: 80px;
            }

            .face-btn {
                position: absolute;
                width: 30px;
                height: 30px;
                border: 2px solid #00ffff;
                border-radius: 50%;
                color: #00ffff;
                font-weight: bold;
                cursor: pointer;
                transition: all 0.1s ease;
                background: rgba(0, 255, 255, 0.1);
            }

            .y-btn { top: 0; left: 50%; transform: translateX(-50%); background: rgba(255, 255, 0, 0.3); }
            .a-btn { bottom: 0; left: 50%; transform: translateX(-50%); background: rgba(0, 255, 0, 0.3); }
            .x-btn { left: 0; top: 50%; transform: translateY(-50%); background: rgba(0, 100, 255, 0.3); }
            .b-btn { right: 0; top: 50%; transform: translateY(-50%); background: rgba(255, 0, 0, 0.3); }

            .face-btn:active {
                background: #00ffff;
                color: #000;
                transform: scale(0.9);
            }

            /* Analog sticks */
            .analog-stick {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 5px;
            }

            .stick-base {
                position: relative;
                width: 60px;
                height: 60px;
                background: rgba(0, 255, 255, 0.2);
                border: 2px solid #00ffff;
                border-radius: 50%;
                cursor: pointer;
            }

            .stick-knob {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 20px;
                height: 20px;
                background: #00ffff;
                border-radius: 50%;
                transform: translate(-50%, -50%);
                transition: all 0.1s ease;
                pointer-events: none;
            }

            .stick-label {
                font-size: 10px;
                color: #00ffff;
                text-align: center;
                font-family: 'Orbitron', monospace;
            }

            /* Menu buttons */
            .menu-btn {
                width: 30px;
                height: 30px;
                background: rgba(0, 255, 255, 0.2);
                border: 1px solid #00ffff;
                border-radius: 4px;
                color: #00ffff;
                cursor: pointer;
                font-size: 12px;
            }

            .menu-btn:active {
                background: #00ffff;
                color: #000;
            }

            .gamepad-logo {
                font-size: 20px;
                color: #00ffff;
            }

            /* Shoulder buttons */
            .shoulder-buttons {
                position: absolute;
                top: -15px;
                left: 0;
                right: 0;
                display: flex;
                justify-content: space-between;
                padding: 0 40px;
            }

            .shoulder-btn {
                width: 40px;
                height: 20px;
                background: rgba(0, 255, 255, 0.2);
                border: 1px solid #00ffff;
                border-radius: 8px 8px 0 0;
                color: #00ffff;
                cursor: pointer;
                font-size: 10px;
                font-weight: bold;
            }

            .shoulder-btn:active {
                background: #00ffff;
                color: #000;
            }

            /* Toggle button */
            .virtual-gamepad-toggle {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                background: rgba(0, 255, 255, 0.9);
                border: 2px solid #00ffff;
                border-radius: 50%;
                color: #000;
                font-size: 20px;
                cursor: pointer;
                z-index: 10001;
                transition: all 0.3s ease;
                box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
            }

            .virtual-gamepad-toggle:hover {
                background: #00ffff;
                box-shadow: 0 0 30px rgba(0, 255, 255, 0.8);
            }

            /* Mobile responsive adjustments */
            @media screen and (max-width: 768px) {
                .virtual-gamepad-controls {
                    min-width: 90vw;
                    padding: 15px;
                    border-radius: 15px;
                }

                .gamepad-left, .gamepad-right {
                    gap: 15px;
                }

                .dpad-container, .face-buttons {
                    width: 70px;
                    height: 70px;
                }

                .stick-base {
                    width: 50px;
                    height: 50px;
                }

                .stick-knob {
                    width: 16px;
                    height: 16px;
                }
            }

            @media screen and (max-width: 480px) {
                .virtual-gamepad-controls {
                    min-width: 95vw;
                    padding: 10px;
                }

                .dpad-container, .face-buttons {
                    width: 60px;
                    height: 60px;
                }

                .dpad-btn, .face-btn {
                    width: 20px;
                    height: 20px;
                    font-size: 10px;
                }

                .stick-base {
                    width: 40px;
                    height: 40px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    setupEventListeners() {
        // Button press events
        this.container.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.container.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.container.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // Prevent default touch behaviors
        this.container.addEventListener('touchstart', (e) => e.preventDefault());
        this.container.addEventListener('touchmove', (e) => e.preventDefault());
        
        // Toggle button
        const toggleBtn = document.getElementById('virtual-gamepad-toggle');
        toggleBtn.addEventListener('click', this.toggle.bind(this));
        
        // Mouse events for desktop testing
        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.container.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.container.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    handleTouchStart(event) {
        for (const touch of event.changedTouches) {
            const element = document.elementFromPoint(touch.clientX, touch.clientY);
            const button = element?.dataset?.button;
            const stick = element?.closest('[data-stick]')?.dataset?.stick;
            
            if (button) {
                this.pressButton(button);
            } else if (stick) {
                this.startStickControl(stick, touch);
            }
        }
    }

    handleTouchMove(event) {
        for (const touch of event.changedTouches) {
            if (this.leftStickTouch && this.leftStickTouch.identifier === touch.identifier) {
                this.updateStick('left', touch);
            } else if (this.rightStickTouch && this.rightStickTouch.identifier === touch.identifier) {
                this.updateStick('right', touch);
            }
        }
    }

    handleTouchEnd(event) {
        for (const touch of event.changedTouches) {
            const element = document.elementFromPoint(touch.clientX, touch.clientY);
            const button = element?.dataset?.button;
            
            if (button) {
                this.releaseButton(button);
            }
            
            // Check if stick control ended
            if (this.leftStickTouch && this.leftStickTouch.identifier === touch.identifier) {
                this.endStickControl('left');
            } else if (this.rightStickTouch && this.rightStickTouch.identifier === touch.identifier) {
                this.endStickControl('right');
            }
        }
    }

    handleMouseDown(event) {
        const button = event.target.dataset?.button;
        const stick = event.target.closest('[data-stick]')?.dataset?.stick;
        
        if (button) {
            this.pressButton(button);
        } else if (stick) {
            this.startStickControl(stick, { clientX: event.clientX, clientY: event.clientY });
        }
    }

    handleMouseMove(event) {
        if (this.leftStickTouch) {
            this.updateStick('left', { clientX: event.clientX, clientY: event.clientY });
        }
        if (this.rightStickTouch) {
            this.updateStick('right', { clientX: event.clientX, clientY: event.clientY });
        }
    }

    handleMouseUp(event) {
        const button = event.target.dataset?.button;
        
        if (button) {
            this.releaseButton(button);
        }
        
        if (this.leftStickTouch) {
            this.endStickControl('left');
        }
        if (this.rightStickTouch) {
            this.endStickControl('right');
        }
    }

    async pressButton(buttonName) {
        if (this.virtualState.buttons.has(buttonName)) return;
        
        this.virtualState.buttons.add(buttonName);
        
        // Send to LLM for intelligent processing instead of direct action mapping
        if (this.gamepadManager && this.gamepadManager.sendGamepadInputToLLM) {
            console.log(`🎮 Virtual gamepad button ${buttonName} -> sending to LLM for interpretation`);
            await this.gamepadManager.sendGamepadInputToLLM({
                type: 'button_press',
                button: buttonName,
                source: 'virtual_gamepad',
                timestamp: Date.now(),
                context: this.getVirtualGamepadContext()
            });
        } else {
            // Fallback to direct action if LLM processing not available
            const action = this.buttonMappings[buttonName];
            if (action) {
                console.log(`🎮 Virtual gamepad button ${buttonName} -> direct action ${action}`);
                await this.sendDirectAction(action, buttonName);
            }
        }
        
        // Visual feedback
        const buttonElement = this.container.querySelector(`[data-button="${buttonName}"]`);
        if (buttonElement) {
            buttonElement.classList.add('active');
        }
    }

    // Get virtual gamepad context for LLM
    getVirtualGamepadContext() {
        return {
            leftStick: this.virtualState.leftStick,
            rightStick: this.virtualState.rightStick,
            activeButtons: Array.from(this.virtualState.buttons),
            gamepadType: 'virtual',
            timestamp: Date.now()
        };
    }

    // Fallback direct action sending
    async sendDirectAction(action, buttonName) {
        try {
            const response = await fetch('/gamepad_action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: action,
                    button: buttonName,
                    source: 'virtual_gamepad_direct',
                    timestamp: Date.now()
                })
            });

            if (!response.ok) {
                console.error(`❌ Failed to send direct action ${action}:`, response.statusText);
            }
        } catch (error) {
            console.error(`❌ Error sending direct action ${action}:`, error);
        }
    }

    releaseButton(buttonName) {
        this.virtualState.buttons.delete(buttonName);
        
        // Remove visual feedback
        const buttonElement = this.container.querySelector(`[data-button="${buttonName}"]`);
        if (buttonElement) {
            buttonElement.classList.remove('active');
        }
    }

    startStickControl(stickType, touch) {
        const stickElement = this.container.querySelector(`[data-stick="${stickType}"] .stick-base`);
        const rect = stickElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        if (stickType === 'left') {
            this.leftStickTouch = { 
                identifier: touch.identifier || 'mouse',
                centerX, 
                centerY,
                maxRadius: rect.width / 2
            };
        } else {
            this.rightStickTouch = { 
                identifier: touch.identifier || 'mouse',
                centerX, 
                centerY,
                maxRadius: rect.width / 2
            };
        }
        
        this.updateStick(stickType, touch);
    }

    updateStick(stickType, touch) {
        const stickTouch = stickType === 'left' ? this.leftStickTouch : this.rightStickTouch;
        if (!stickTouch) return;
        
        const deltaX = touch.clientX - stickTouch.centerX;
        const deltaY = touch.clientY - stickTouch.centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        // Clamp to stick radius
        const clampedDistance = Math.min(distance, stickTouch.maxRadius);
        const angle = Math.atan2(deltaY, deltaX);
        
        const clampedX = Math.cos(angle) * clampedDistance;
        const clampedY = Math.sin(angle) * clampedDistance;
        
        // Convert to -1 to 1 range
        const normalizedX = clampedX / stickTouch.maxRadius;
        const normalizedY = clampedY / stickTouch.maxRadius;
        
        // Update virtual state
        if (stickType === 'left') {
            this.virtualState.axes[0] = normalizedX;
            this.virtualState.axes[1] = normalizedY;
            this.virtualState.leftStick = { x: normalizedX, y: normalizedY, active: true };
        } else {
            this.virtualState.axes[2] = normalizedX;
            this.virtualState.axes[3] = normalizedY;
            this.virtualState.rightStick = { x: normalizedX, y: normalizedY, active: true };
        }
        
        // Update visual position
        const knob = this.container.querySelector(`[data-stick="${stickType}"] .stick-knob`);
        if (knob) {
            knob.style.transform = `translate(${-50 + (normalizedX * 50)}%, ${-50 + (normalizedY * 50)}%)`;
        }
        
        // Send movement commands
        this.sendMovementUpdate();
    }

    endStickControl(stickType) {
        if (stickType === 'left') {
            this.leftStickTouch = null;
            this.virtualState.axes[0] = 0;
            this.virtualState.axes[1] = 0;
            this.virtualState.leftStick = { x: 0, y: 0, active: false };
        } else {
            this.rightStickTouch = null;
            this.virtualState.axes[2] = 0;
            this.virtualState.axes[3] = 0;
            this.virtualState.rightStick = { x: 0, y: 0, active: false };
        }
        
        // Reset visual position
        const knob = this.container.querySelector(`[data-stick="${stickType}"] .stick-knob`);
        if (knob) {
            knob.style.transform = 'translate(-50%, -50%)';
        }
        
        // Send stop command
        this.sendMovementUpdate();
    }

    async sendMovementUpdate() {
        const leftStick = this.virtualState.leftStick;
        const rightStick = this.virtualState.rightStick;
        
        // Throttle movement updates to avoid overwhelming the LLM
        const now = Date.now();
        if (!this.lastMovementUpdate || (now - this.lastMovementUpdate) > 200) { // 5Hz max
            
            // Send movement intent to LLM if significant movement detected
            if (Math.abs(leftStick.x) > 0.05 || Math.abs(leftStick.y) > 0.05 || 
                Math.abs(rightStick.x) > 0.05 || Math.abs(rightStick.y) > 0.05) {
                
                if (this.gamepadManager && this.gamepadManager.sendGamepadInputToLLM) {
                    await this.gamepadManager.sendGamepadInputToLLM({
                        type: 'movement_input',
                        source: 'virtual_gamepad',
                        movement: {
                            leftStick: leftStick,
                            rightStick: rightStick,
                            intent: this.interpretMovementIntent(leftStick, rightStick)
                        },
                        timestamp: now,
                        context: this.getVirtualGamepadContext()
                    });
                } else {
                    // Fallback to direct movement command
                    const movement = {
                        linear_x: -leftStick.y * 0.3,    // Forward/back (invert Y)
                        linear_y: leftStick.x * 0.2,     // Strafe left/right
                        angular_z: rightStick.x * 0.5    // Rotation
                    };
                    
                    await this.sendDirectMovement(movement);
                }
                
                this.lastMovementUpdate = now;
            }
        }
    }

    // Interpret movement intent for the LLM (virtual gamepad version)
    interpretMovementIntent(leftStick, rightStick) {
        const intents = [];
        
        // Analyze left stick (movement)
        if (Math.abs(leftStick.y) > 0.1) {
            intents.push(leftStick.y > 0 ? 'move_forward' : 'move_backward');
        }
        if (Math.abs(leftStick.x) > 0.1) {
            intents.push(leftStick.x > 0 ? 'strafe_right' : 'strafe_left');
        }
        
        // Analyze right stick (look/turn)
        if (Math.abs(rightStick.x) > 0.1) {
            intents.push(rightStick.x > 0 ? 'turn_right' : 'turn_left');
        }
        if (Math.abs(rightStick.y) > 0.1) {
            intents.push(rightStick.y > 0 ? 'look_up' : 'look_down');
        }
        
        return intents;
    }

    // Fallback direct movement sending
    async sendDirectMovement(movement) {
        try {
            const response = await fetch('/gamepad_movement', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...movement,
                    source: 'virtual_gamepad_direct',
                    timestamp: Date.now()
                })
            });

            if (!response.ok) {
                console.error('❌ Failed to send direct movement command:', response.statusText);
            }
        } catch (error) {
            console.error('❌ Error sending direct movement command:', error);
        }
    }

    checkAutoShow() {
        // Auto-show virtual gamepad if no physical gamepad is connected
        const checkGamepads = () => {
            const gamepads = navigator.getGamepads();
            const hasPhysicalGamepad = Array.from(gamepads).some(gp => gp && gp.connected);
            
            if (!hasPhysicalGamepad && !this.isVisible) {
                console.log('🎮 No physical gamepad detected, showing virtual gamepad');
                // Don't auto-show, let user decide
                // this.show();
            }
        };
        
        // Check periodically
        setInterval(checkGamepads, 5000);
        checkGamepads();
    }

    show() {
        this.isVisible = true;
        this.isEnabled = true;
        this.container.classList.remove('hidden');
        console.log('🎮 Virtual gamepad shown');
    }

    hide() {
        this.isVisible = false;
        this.isEnabled = false;
        this.container.classList.add('hidden');
        console.log('🎮 Virtual gamepad hidden');
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    // Get virtual gamepad state in same format as physical gamepad
    getGamepadState() {
        return {
            id: 'virtual-gamepad',
            connected: this.isEnabled,
            mapping: 'standard',
            axes: this.virtualState.axes,
            buttons: Array.from({ length: 16 }, (_, i) => {
                const buttonNames = [
                    'a', 'b', 'x', 'y', 'l1', 'r1', 'l2', 'r2',
                    'select', 'start', 'left-stick', 'right-stick',
                    'dpad-up', 'dpad-down', 'dpad-left', 'dpad-right'
                ];
                const buttonName = buttonNames[i];
                return {
                    pressed: this.virtualState.buttons.has(buttonName),
                    value: this.virtualState.buttons.has(buttonName) ? 1.0 : 0.0
                };
            })
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualGamepad;
}
