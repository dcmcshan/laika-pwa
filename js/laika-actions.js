/**
 * LAIKA Actions Manager
 * Comprehensive robot action system for PWA
 */

class LAIKAActions {
    constructor() {
        this.actions = this.defineActions();
        this.actionHistory = [];
        this.isExecuting = false;
    }

    defineActions() {
        return {
            // Basic Movement Actions
            basic_movement: {
                name: "Basic Movement",
                icon: "🚶",
                actions: {
                    sit: { name: "Sit", icon: "🪑", command: "sit", description: "Make LAIKA sit down" },
                    stand: { name: "Stand", icon: "🦴", command: "stand", description: "Make LAIKA stand up" },
                    lie_down: { name: "Lie Down", icon: "🛌", command: "lie_down", description: "Make LAIKA lie down" },
                    forward: { name: "Forward", icon: "⬆️", command: "forward", description: "Move LAIKA forward" },
                    backward: { name: "Backward", icon: "⬇️", command: "backward", description: "Move LAIKA backward" },
                    turn_left: { name: "Turn Left", icon: "⬅️", command: "turn_left", description: "Turn LAIKA left" },
                    turn_right: { name: "Turn Right", icon: "➡️", command: "turn_right", description: "Turn LAIKA right" },
                    stop: { name: "Stop", icon: "🛑", command: "stop", description: "Stop all movement", emergency: true }
                }
            },

            // Interactive Actions
            interactive: {
                name: "Interactive",
                icon: "🤝",
                actions: {
                    bow: { name: "Bow", icon: "🎩", command: "bow", description: "Make LAIKA bow politely" },
                    wave: { name: "Wave", icon: "👋", command: "wave", description: "Make LAIKA wave hello" },
                    shake_hands: { name: "Shake Hands", icon: "🤝", command: "shake_hands", description: "Make LAIKA shake hands" },
                    nod: { name: "Nod", icon: "✅", command: "nod", description: "Make LAIKA nod head" },
                    greeting: { name: "Greet", icon: "🙏", command: "greeting", description: "Make LAIKA greet someone" },
                    hello: { name: "Say Hello", icon: "👋", command: "hello", description: "Make LAIKA say hello" }
                }
            },

            // Performance Actions
            performance: {
                name: "Performance",
                icon: "🎭",
                actions: {
                    dance: { name: "Dance", icon: "💃", command: "dance", description: "Make LAIKA dance" },
                    moonwalk: { name: "Moonwalk", icon: "🌙", command: "moonwalk", description: "Make LAIKA moonwalk" },
                    boxing: { name: "Boxing", icon: "🥊", command: "boxing", description: "Make LAIKA do boxing moves" },
                    push_up: { name: "Push-ups", icon: "💪", command: "push_up", description: "Make LAIKA do push-ups" },
                    stretch: { name: "Stretch", icon: "🧘", command: "stretch", description: "Make LAIKA stretch" },
                    spin: { name: "Spin", icon: "🌪️", command: "spin", description: "Make LAIKA spin around" }
                }
            },

            // Sports Actions
            sports: {
                name: "Sports",
                icon: "⚽",
                actions: {
                    kick_ball_left: { name: "Kick Left", icon: "🦵", command: "kick_ball_left", description: "Kick ball with left foot" },
                    kick_ball_right: { name: "Kick Right", icon: "🦵", command: "kick_ball_right", description: "Kick ball with right foot" },
                    play_soccer: { name: "Play Soccer", icon: "⚽", command: "play_soccer", description: "Play soccer mode" },
                    catch_ball: { name: "Catch Ball", icon: "🏀", command: "catch_ball", description: "Catch a ball" }
                }
            },

            // LED Control Actions
            led_control: {
                name: "LED Control",
                icon: "💡",
                actions: {
                    lights_on: { name: "Lights On", icon: "💡", command: "lights_on", description: "Turn on all LEDs" },
                    lights_off: { name: "Lights Off", icon: "⚫", command: "lights_off", description: "Turn off all LEDs" },
                    red_light: { name: "Red", icon: "🔴", command: "red_light", description: "Set LEDs to red" },
                    green_light: { name: "Green", icon: "🟢", command: "green_light", description: "Set LEDs to green" },
                    blue_light: { name: "Blue", icon: "🔵", command: "blue_light", description: "Set LEDs to blue" },
                    yellow_light: { name: "Yellow", icon: "🟡", command: "yellow_light", description: "Set LEDs to yellow" },
                    purple_light: { name: "Purple", icon: "🟣", command: "purple_light", description: "Set LEDs to purple" },
                    cyan_light: { name: "Cyan", icon: "🔵", command: "cyan_light", description: "Set LEDs to cyan" },
                    white_light: { name: "White", icon: "⚪", command: "white_light", description: "Set LEDs to white" },
                    rainbow_lights: { name: "Rainbow", icon: "🌈", command: "rainbow_lights", description: "Cycle rainbow colors" },
                    blink_lights: { name: "Blink", icon: "✨", command: "blink_lights", description: "Make LEDs blink" },
                    pulse_lights: { name: "Pulse", icon: "💫", command: "pulse_lights", description: "Make LEDs pulse" }
                }
            },

            // Camera & Vision Actions
            camera_vision: {
                name: "Camera & Vision",
                icon: "📹",
                actions: {
                    take_photo: { name: "Take Photo", icon: "📸", command: "take_photo", description: "Take a photo" },
                    take_picture: { name: "Take Picture", icon: "📷", command: "take_picture", description: "Capture an image" },
                    what_do_you_see: { name: "What Do You See?", icon: "👁️", command: "what_do_you_see", description: "Describe what LAIKA sees" },
                    describe_scene: { name: "Describe Scene", icon: "🖼️", command: "describe_scene", description: "Analyze current scene" },
                    look_around: { name: "Look Around", icon: "🔍", command: "look_around", description: "Scan the environment" },
                    detect_colors: { name: "Detect Colors", icon: "🎨", command: "detect_colors", description: "Identify colors in view" },
                    find_faces: { name: "Find Faces", icon: "👤", command: "find_faces", description: "Detect human faces" },
                    recognize_objects: { name: "Recognize Objects", icon: "🔍", command: "recognize_objects", description: "Identify objects" },
                    start_camera: { name: "Start Camera", icon: "▶️", command: "start_camera", description: "Start camera feed" },
                    stop_camera: { name: "Stop Camera", icon: "⏹️", command: "stop_camera", description: "Stop camera feed" }
                }
            },

            // Behavior Modes
            behavior_modes: {
                name: "Behavior Modes",
                icon: "🎭",
                actions: {
                    greeting_mode: { name: "Greeting Mode", icon: "🤗", command: "greeting_mode", description: "Friendly welcoming mode" },
                    idle_mode: { name: "Idle Mode", icon: "😴", command: "idle_mode", description: "Passive waiting state" },
                    dance_mode: { name: "Dance Mode", icon: "💃", command: "dance_mode", description: "Ready for dance commands" },
                    sleep_mode: { name: "Sleep Mode", icon: "😴", command: "sleep_mode", description: "Enter sleep mode" },
                    wake_up: { name: "Wake Up", icon: "☀️", command: "wake_up", description: "Exit sleep mode" },
                    be_friendly: { name: "Be Friendly", icon: "😊", command: "be_friendly", description: "Adopt friendly behavior" },
                    be_quiet: { name: "Be Quiet", icon: "🤫", command: "be_quiet", description: "Become silent" },
                    be_active: { name: "Be Active", icon: "⚡", command: "be_active", description: "Become energetic" },
                    guard_mode: { name: "Guard Mode", icon: "🛡️", command: "guard_mode", description: "Security patrol mode" },
                    play_mode: { name: "Play Mode", icon: "🎮", command: "play_mode", description: "Playful interaction mode" }
                }
            },

            // System Actions
            system: {
                name: "System",
                icon: "⚙️",
                actions: {
                    battery_level: { name: "Battery Level", icon: "🔋", command: "battery_level", description: "Check battery status" },
                    system_status: { name: "System Status", icon: "📊", command: "system_status", description: "Check system health" },
                    calibrate: { name: "Calibrate", icon: "⚖️", command: "calibrate", description: "Calibrate systems" },
                    check_sensors: { name: "Check Sensors", icon: "📡", command: "check_sensors", description: "Test all sensors" },
                    reset: { name: "Reset", icon: "🔄", command: "reset", description: "Reset to default state" },
                    restart: { name: "Restart", icon: "🔄", command: "restart", description: "Reboot system" },
                    update_system: { name: "Update System", icon: "📥", command: "update_system", description: "Update LAIKA software" },
                    backup_data: { name: "Backup Data", icon: "💾", command: "backup_data", description: "Backup system data" },
                    factory_reset: { name: "Factory Reset", icon: "🏭", command: "factory_reset", description: "Reset to factory settings", dangerous: true }
                }
            },

            // Emergency Actions
            emergency: {
                name: "Emergency",
                icon: "🚨",
                actions: {
                    emergency_stop: { name: "Emergency Stop", icon: "🛑", command: "emergency_stop", description: "Immediate stop", emergency: true },
                    stop_everything: { name: "Stop Everything", icon: "⏹️", command: "stop_everything", description: "Halt all operations", emergency: true },
                    halt: { name: "Halt", icon: "✋", command: "halt", description: "Stop all movement", emergency: true },
                    freeze: { name: "Freeze", icon: "🧊", command: "freeze", description: "Freeze in place", emergency: true },
                    safe_mode: { name: "Safe Mode", icon: "🛡️", command: "safe_mode", description: "Enter safe mode", emergency: true }
                }
            },

            // Advanced Actions
            advanced: {
                name: "Advanced",
                icon: "🔬",
                actions: {
                    follow_me: { name: "Follow Me", icon: "👥", command: "follow_me", description: "Follow the user" },
                    patrol: { name: "Patrol", icon: "🚶", command: "patrol", description: "Patrol the area" },
                    map_area: { name: "Map Area", icon: "🗺️", command: "map_area", description: "Create SLAM map" },
                    navigate_to: { name: "Navigate To", icon: "🧭", command: "navigate_to", description: "Navigate to location" },
                    explore: { name: "Explore", icon: "🔍", command: "explore", description: "Explore surroundings" },
                    return_home: { name: "Return Home", icon: "🏠", command: "return_home", description: "Return to home position" },
                    learn_routine: { name: "Learn Routine", icon: "📚", command: "learn_routine", description: "Learn new routine" },
                    voice_training: { name: "Voice Training", icon: "🎤", command: "voice_training", description: "Train voice recognition" }
                }
            }
        };
    }

    getAllActions() {
        const allActions = {};
        Object.keys(this.actions).forEach(category => {
            Object.keys(this.actions[category].actions).forEach(actionKey => {
                allActions[actionKey] = {
                    ...this.actions[category].actions[actionKey],
                    category: category
                };
            });
        });
        return allActions;
    }

    getActionsByCategory(category) {
        return this.actions[category] || null;
    }

    getAction(actionName) {
        const allActions = this.getAllActions();
        return allActions[actionName] || null;
    }

    async executeAction(actionName, params = {}) {
        if (this.isExecuting) {
            throw new Error("Another action is currently executing");
        }

        const action = this.getAction(actionName);
        if (!action) {
            throw new Error(`Unknown action: ${actionName}`);
        }

        this.isExecuting = true;
        
        try {
            console.log(`🤖 Executing action: ${action.name} (${action.command})`);
            
            // Add to history
            this.actionHistory.push({
                action: actionName,
                timestamp: new Date().toISOString(),
                params: params
            });

            // Keep only last 50 actions in history
            if (this.actionHistory.length > 50) {
                this.actionHistory = this.actionHistory.slice(-50);
            }

            // Execute the action
            const result = await this.sendActionCommand(action.command, params);
            
            console.log(`✅ Action completed: ${action.name}`);
            return result;

        } catch (error) {
            console.error(`❌ Action failed: ${action.name}`, error);
            throw error;
        } finally {
            this.isExecuting = false;
        }
    }

    async sendActionCommand(command, params = {}) {
        // This method should be overridden by the implementing class
        // to send commands via WebSocket, HTTP, or other communication method
        throw new Error("sendActionCommand must be implemented by the parent class");
    }

    getActionHistory() {
        return [...this.actionHistory];
    }

    clearActionHistory() {
        this.actionHistory = [];
    }

    isEmergencyAction(actionName) {
        const action = this.getAction(actionName);
        return action && action.emergency === true;
    }

    isDangerousAction(actionName) {
        const action = this.getAction(actionName);
        return action && action.dangerous === true;
    }

    async executeSequence(actionSequence, delay = 1000) {
        if (this.isExecuting) {
            throw new Error("Another action is currently executing");
        }

        const results = [];
        
        for (const actionItem of actionSequence) {
            const actionName = typeof actionItem === 'string' ? actionItem : actionItem.action;
            const params = typeof actionItem === 'object' ? actionItem.params || {} : {};
            
            try {
                const result = await this.executeAction(actionName, params);
                results.push({ action: actionName, success: true, result });
                
                // Wait between actions
                if (delay > 0) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } catch (error) {
                results.push({ action: actionName, success: false, error: error.message });
                // Continue with sequence even if one action fails
            }
        }
        
        return results;
    }

    // Predefined action sequences
    getPredefinedSequences() {
        return {
            morning_routine: [
                { action: "wake_up", params: {} },
                { action: "stretch", params: {} },
                { action: "greeting", params: {} },
                { action: "system_status", params: {} }
            ],
            greeting_sequence: [
                { action: "wave", params: {} },
                { action: "bow", params: {} },
                { action: "green_light", params: {} }
            ],
            dance_performance: [
                { action: "dance_mode", params: {} },
                { action: "rainbow_lights", params: {} },
                { action: "dance", params: {} },
                { action: "spin", params: {} },
                { action: "bow", params: {} }
            ],
            security_patrol: [
                { action: "guard_mode", params: {} },
                { action: "red_light", params: {} },
                { action: "look_around", params: {} },
                { action: "patrol", params: {} }
            ],
            shutdown_sequence: [
                { action: "wave", params: {} },
                { action: "lights_off", params: {} },
                { action: "sit", params: {} },
                { action: "sleep_mode", params: {} }
            ]
        };
    }

    async executeSequenceByName(sequenceName, delay = 1000) {
        const sequences = this.getPredefinedSequences();
        const sequence = sequences[sequenceName];
        
        if (!sequence) {
            throw new Error(`Unknown sequence: ${sequenceName}`);
        }
        
        return await this.executeSequence(sequence, delay);
    }
}

// Export for use in other modules
window.LAIKAActions = LAIKAActions;




