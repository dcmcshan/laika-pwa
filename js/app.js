/**
 * LAIKA Controller PWA Main Application
 */

class LAIKAController {
    constructor() {
        this.bleImprov = new BLEImprov();
        this.isConnected = false;
        this.currentDevice = null;
        
        // UI Elements
        this.elements = {
            statusCard: document.getElementById('statusCard'),
            statusTitle: document.getElementById('statusTitle'),
            statusIcon: document.getElementById('statusIcon'),
            statusText: document.getElementById('statusText'),
            connectionInfo: document.getElementById('connectionInfo'),
            
            connectButton: document.getElementById('connectButton'),
            identifyButton: document.getElementById('identifyButton'),
            configureWifiButton: document.getElementById('configureWifiButton'),
            controlPageButton: document.getElementById('controlPageButton'),
            disconnectButton: document.getElementById('disconnectButton'),
            
            wifiForm: document.getElementById('wifiForm'),
            networksList: document.getElementById('networksList'),
            ssidInput: document.getElementById('ssidInput'),
            passwordInput: document.getElementById('passwordInput'),
            submitWifiButton: document.getElementById('submitWifiButton'),
            cancelWifiButton: document.getElementById('cancelWifiButton'),
            
            errorMessage: document.getElementById('errorMessage'),
            successMessage: document.getElementById('successMessage'),
            
            // Control page elements
            controlPage: document.getElementById('controlPage'),
            backToMainButton: document.getElementById('backToMainButton'),
            
                    // Pose controls
        heightSlider: document.getElementById('heightSlider'),
        pitchSlider: document.getElementById('pitchSlider'),
        rollSlider: document.getElementById('rollSlider'),
        heightValue: document.getElementById('heightValue'),
        pitchValue: document.getElementById('pitchValue'),
        rollValue: document.getElementById('rollValue'),
        
        // WiFi and advanced features
        wifiStatus: document.getElementById('wifiStatus'),
        advancedFeatures: document.getElementById('advancedFeatures'),
        cameraButton: document.getElementById('cameraButton'),
        slamButton: document.getElementById('slamButton'),
        
        // Camera elements
        cameraSection: document.getElementById('cameraSection'),
        startCameraBtn: document.getElementById('startCameraBtn'),
        stopCameraBtn: document.getElementById('stopCameraBtn'),
        cameraStream: document.getElementById('cameraStream'),
        cameraPlaceholder: document.getElementById('cameraPlaceholder'),
        
        // SLAM elements
        slamSection: document.getElementById('slamSection'),
        refreshMapBtn: document.getElementById('refreshMapBtn'),
        autoRefreshBtn: document.getElementById('autoRefreshBtn'),
        slamMap: document.getElementById('slamMap'),
        slamPlaceholder: document.getElementById('slamPlaceholder'),
        robotPosition: document.getElementById('robotPosition'),
        mapResolution: document.getElementById('mapResolution'),
        
        installBanner: document.getElementById('installBanner'),
        installButton: document.getElementById('installButton')
        };
        
        this.networks = [];
        this.deferredPrompt = null;
        
        // WiFi and advanced features state
        this.wifiConnected = false;
        this.serverUrl = null;
        this.cameraActive = false;
        this.slamAutoRefresh = false;
        this.cameraStreamInterval = null;
        this.slamRefreshInterval = null;
        
        this.init();
    }

    init() {
        console.log('Initializing LAIKA Controller...');
        
        // Check BLE support
        if (!this.bleImprov.isSupported()) {
            this.showError('Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or another compatible browser.');
            this.elements.connectButton.disabled = true;
            return;
        }

        // Set up BLE event handlers
        this.setupBLEHandlers();
        
        // Set up UI event listeners
        this.setupEventListeners();
        
        // Set up PWA install prompt
        this.setupPWAInstall();
        
        // Check for URL parameters
        this.handleURLParams();
        
        console.log('LAIKA Controller initialized');
    }

    setupBLEHandlers() {
        this.bleImprov.onStateChange = (state) => {
            console.log('BLE state changed:', this.bleImprov.getStateName(state));
            this.updateConnectionStatus(state);
        };

        this.bleImprov.onError = (error) => {
            console.error('BLE error:', this.bleImprov.getErrorName(error));
            this.showError(`BLE Error: ${this.bleImprov.getErrorName(error)}`);
        };

        this.bleImprov.onResult = (result) => {
            console.log('BLE result received:', result);
            const parsed = this.bleImprov.parseRpcResult(result);
            if (parsed) {
                this.showSuccess(parsed.message || 'Command completed successfully');
            }
        };

        this.bleImprov.onDisconnected = () => {
            console.log('Device disconnected');
            this.handleDisconnection();
        };
    }

    setupEventListeners() {
        // Connect button
        this.elements.connectButton.addEventListener('click', () => {
            this.connectToDevice();
        });

        // Identify button
        this.elements.identifyButton.addEventListener('click', () => {
            this.identifyDevice();
        });

        // Configure WiFi button
        this.elements.configureWifiButton.addEventListener('click', () => {
            this.showWiFiForm();
        });

        // Control page button
        this.elements.controlPageButton.addEventListener('click', () => {
            this.showControlPage();
        });

        // Back to main button
        this.elements.backToMainButton.addEventListener('click', () => {
            this.hideControlPage();
        });

        // Disconnect button
        this.elements.disconnectButton.addEventListener('click', () => {
            this.disconnectFromDevice();
        });

        // WiFi form buttons
        this.elements.submitWifiButton.addEventListener('click', () => {
            this.submitWiFiConfiguration();
        });

        this.elements.cancelWifiButton.addEventListener('click', () => {
            this.hideWiFiForm();
        });

        // Form inputs
        this.elements.ssidInput.addEventListener('input', () => {
            this.validateWiFiForm();
        });

        this.elements.passwordInput.addEventListener('input', () => {
            this.validateWiFiForm();
        });

        // Set up control page event listeners
        this.setupControlPageListeners();
        
        // Set up advanced features event listeners
        this.setupAdvancedFeaturesListeners();
    }

    setupPWAInstall() {
        // Listen for the beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('PWA install prompt available');
            e.preventDefault();
            this.deferredPrompt = e;
            this.elements.installBanner.classList.add('show');
        });

        // Install button click
        this.elements.installButton.addEventListener('click', async () => {
            if (this.deferredPrompt) {
                this.deferredPrompt.prompt();
                const { outcome } = await this.deferredPrompt.userChoice;
                console.log('PWA install outcome:', outcome);
                this.deferredPrompt = null;
                this.elements.installBanner.classList.remove('show');
            }
        });

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            console.log('PWA installed successfully');
            this.elements.installBanner.classList.remove('show');
            this.showSuccess('LAIKA Controller installed successfully!');
        });
    }

    handleURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        
        if (action === 'connect') {
            // Auto-connect if requested
            setTimeout(() => {
                this.connectToDevice();
            }, 1000);
        } else if (action === 'wifi') {
            // Show WiFi form if requested
            this.showWiFiForm();
        }
    }

    async connectToDevice() {
        try {
            this.setButtonLoading(this.elements.connectButton, true);
            this.hideMessages();
            
            console.log('Starting device scan...');
            const device = await this.bleImprov.scan();
            
            if (device) {
                this.currentDevice = device;
                this.updateStatus('connecting', '🔄', 'Connecting to LAIKA...', device.name || 'Unknown Device');
                
                await this.bleImprov.connect();
                
                this.isConnected = true;
                this.updateStatus('connected', '✅', 'Connected to LAIKA', device.name || 'Connected Device');
                this.showConnectedButtons();
                this.showSuccess('Successfully connected to LAIKA!');
                
                // Get initial state
                try {
                    const state = await this.bleImprov.getCurrentState();
                    console.log('Initial state:', this.bleImprov.getStateName(state));
                } catch (error) {
                    console.warn('Could not read initial state:', error);
                }
            }
            
        } catch (error) {
            console.error('Connection failed:', error);
            this.showError(`Connection failed: ${error.message}`);
            this.updateStatus('disconnected', '❌', 'Connection failed', 'Not connected');
        } finally {
            this.setButtonLoading(this.elements.connectButton, false);
        }
    }

    async disconnectFromDevice() {
        try {
            this.setButtonLoading(this.elements.disconnectButton, true);
            
            await this.bleImprov.disconnect();
            this.handleDisconnection();
            this.showSuccess('Disconnected from LAIKA');
            
        } catch (error) {
            console.error('Disconnection failed:', error);
            this.showError(`Disconnection failed: ${error.message}`);
        } finally {
            this.setButtonLoading(this.elements.disconnectButton, false);
        }
    }

    handleDisconnection() {
        this.isConnected = false;
        this.currentDevice = null;
        this.updateStatus('disconnected', '📡', 'Ready to connect to LAIKA', 'Not connected');
        this.showDisconnectedButtons();
        this.hideWiFiForm();
        
        // Clean up advanced features
        this.cleanupAdvancedFeatures();
    }

    cleanupAdvancedFeatures() {
        // Stop camera
        if (this.cameraActive) {
            this.stopCamera();
        }
        
        // Stop SLAM auto-refresh
        if (this.slamAutoRefresh) {
            this.toggleSLAMAutoRefresh();
        }
        
        // Reset WiFi state
        this.wifiConnected = false;
        this.serverUrl = null;
        
        // Update WiFi status
        if (this.elements.wifiStatus) {
            this.elements.wifiStatus.innerHTML = `
                <div class="status-indicator disconnected">
                    <span class="status-icon">📡</span>
                    <span class="status-text">WiFi: Not Connected</span>
                </div>
                <p class="status-description">Connect to WiFi to enable camera feed and SLAM mapping</p>
            `;
        }
        
        // Hide advanced features
        if (this.elements.advancedFeatures) {
            this.elements.advancedFeatures.style.display = 'none';
        }
        
        // Hide camera and SLAM sections
        if (this.elements.cameraSection) {
            this.elements.cameraSection.style.display = 'none';
        }
        if (this.elements.slamSection) {
            this.elements.slamSection.style.display = 'none';
        }
    }

    async identifyDevice() {
        if (!this.isConnected) {
            this.showError('Not connected to device');
            return;
        }

        try {
            this.setButtonLoading(this.elements.identifyButton, true);
            
            await this.bleImprov.identify();
            this.showSuccess('Identify command sent to LAIKA');
            
        } catch (error) {
            console.error('Identify failed:', error);
            this.showError(`Identify failed: ${error.message}`);
        } finally {
            this.setButtonLoading(this.elements.identifyButton, false);
        }
    }

    showWiFiForm() {
        this.elements.wifiForm.classList.add('show');
        this.elements.configureWifiButton.style.display = 'none';
        
        // Scan for networks
        this.scanNetworks();
    }

    hideWiFiForm() {
        this.elements.wifiForm.classList.remove('show');
        this.elements.configureWifiButton.style.display = 'block';
        
        // Clear form
        this.elements.ssidInput.value = '';
        this.elements.passwordInput.value = '';
    }

    async scanNetworks() {
        // Mock network scan for now - replace with actual BLE scan when available
        const mockNetworks = [
            { ssid: 'HomeWiFi', signal: 85, security: 'WPA2' },
            { ssid: 'OfficeNetwork', signal: 72, security: 'WPA2' },
            { ssid: 'PublicWiFi', signal: 45, security: '' },
            { ssid: 'Neighbor_5G', signal: 38, security: 'WPA3' },
            { ssid: 'TestNetwork', signal: 92, security: 'WPA2' }
        ];

        this.networks = mockNetworks.sort((a, b) => b.signal - a.signal);
        this.renderNetworksList();
    }

    renderNetworksList() {
        if (this.networks.length === 0) {
            this.elements.networksList.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666;">
                    No networks found
                </div>
            `;
            return;
        }

        this.elements.networksList.innerHTML = this.networks.map(network => `
            <div class="network-item" onclick="app.selectNetwork('${network.ssid}')">
                <div class="network-name">${network.ssid}</div>
                <div class="network-info">
                    <span>${network.signal}%</span>
                    <span>${network.security ? '🔒' : '🔓'}</span>
                </div>
            </div>
        `).join('');
    }

    selectNetwork(ssid) {
        this.elements.ssidInput.value = ssid;
        this.validateWiFiForm();
    }

    validateWiFiForm() {
        const ssid = this.elements.ssidInput.value.trim();
        const password = this.elements.passwordInput.value;
        
        const isValid = ssid.length > 0;
        this.elements.submitWifiButton.disabled = !isValid;
    }

    async submitWiFiConfiguration() {
        if (!this.isConnected) {
            this.showError('Not connected to device');
            return;
        }

        const ssid = this.elements.ssidInput.value.trim();
        const password = this.elements.passwordInput.value;

        if (!ssid) {
            this.showError('Please enter a network name (SSID)');
            return;
        }

        try {
            this.setButtonLoading(this.elements.submitWifiButton, true);
            this.hideMessages();
            
            console.log(`Configuring WiFi: ${ssid}`);
            await this.bleImprov.configureWiFi(ssid, password);
            
            this.showSuccess('WiFi configuration sent to LAIKA. Please wait for connection...');
            
            // Hide form after successful submission
            setTimeout(() => {
                this.hideWiFiForm();
            }, 2000);
            
        } catch (error) {
            console.error('WiFi configuration failed:', error);
            this.showError(`WiFi configuration failed: ${error.message}`);
        } finally {
            this.setButtonLoading(this.elements.submitWifiButton, false);
        }
    }

    updateStatus(type, icon, text, connectionText) {
        this.elements.statusIcon.textContent = icon;
        this.elements.statusText.textContent = text;
        this.elements.connectionInfo.textContent = connectionText;
        
        // Update card styling
        this.elements.statusCard.className = `status-card ${type}`;
    }

    updateConnectionStatus(state) {
        const stateName = this.bleImprov.getStateName(state);
        
        switch (state) {
            case this.bleImprov.STATES.READY:
                this.updateStatus('connected', '✅', 'LAIKA is ready for WiFi configuration', 'Connected - Ready');
                break;
            case this.bleImprov.STATES.PROVISIONING:
                this.updateStatus('connecting', '🔄', 'LAIKA is connecting to WiFi...', 'Provisioning WiFi');
                break;
            case this.bleImprov.STATES.PROVISIONED:
                this.updateStatus('connected', '🌐', 'LAIKA is connected to WiFi!', 'WiFi Connected');
                this.showSuccess('LAIKA successfully connected to WiFi!');
                this.handleWiFiConnected();
                break;
            default:
                this.updateStatus('connected', '✅', `LAIKA status: ${stateName}`, `Connected - ${stateName}`);
        }
    }

    handleWiFiConnected() {
        this.wifiConnected = true;
        this.serverUrl = 'http://192.168.4.1:5000'; // Default LAIKA server URL
        
        // Update WiFi status in control page
        if (this.elements.wifiStatus) {
            this.elements.wifiStatus.innerHTML = `
                <div class="status-indicator connected">
                    <span class="status-icon">🌐</span>
                    <span class="status-text">WiFi: Connected</span>
                </div>
                <p class="status-description">Advanced features are now available</p>
            `;
        }
        
        // Show advanced features
        if (this.elements.advancedFeatures) {
            this.elements.advancedFeatures.style.display = 'block';
        }
        
        // Test server connection
        this.testServerConnection();
    }

    async testServerConnection() {
        try {
            const response = await fetch(`${this.serverUrl}/api/status`);
            if (response.ok) {
                const data = await response.json();
                console.log('Server status:', data);
                this.showSuccess('Server connection established');
            } else {
                console.warn('Server not responding');
                this.showError('Server connection failed - using simulation mode');
            }
        } catch (error) {
            console.warn('Server connection failed:', error);
            this.showError('Server connection failed - using simulation mode');
        }
    }

    setupControlPageListeners() {
        // Control buttons
        document.querySelectorAll('.control-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                if (action) {
                    this.executeRobotAction(action);
                }
            });
        });

        // Pose sliders
        if (this.elements.heightSlider) {
            this.elements.heightSlider.addEventListener('input', (e) => {
                this.elements.heightValue.textContent = e.target.value;
                this.updatePose();
            });
        }

        if (this.elements.pitchSlider) {
            this.elements.pitchSlider.addEventListener('input', (e) => {
                this.elements.pitchValue.textContent = e.target.value + '°';
                this.updatePose();
            });
        }

        if (this.elements.rollSlider) {
            this.elements.rollSlider.addEventListener('input', (e) => {
                this.elements.rollValue.textContent = e.target.value + '°';
                this.updatePose();
            });
        }
    }

    setupAdvancedFeaturesListeners() {
        // Camera button
        if (this.elements.cameraButton) {
            this.elements.cameraButton.addEventListener('click', () => {
                this.toggleCameraSection();
            });
        }

        // SLAM button
        if (this.elements.slamButton) {
            this.elements.slamButton.addEventListener('click', () => {
                this.toggleSLAMSection();
            });
        }

        // Camera controls
        if (this.elements.startCameraBtn) {
            this.elements.startCameraBtn.addEventListener('click', () => {
                this.startCamera();
            });
        }

        if (this.elements.stopCameraBtn) {
            this.elements.stopCameraBtn.addEventListener('click', () => {
                this.stopCamera();
            });
        }

        // SLAM controls
        if (this.elements.refreshMapBtn) {
            this.elements.refreshMapBtn.addEventListener('click', () => {
                this.refreshSLAMMap();
            });
        }

        if (this.elements.autoRefreshBtn) {
            this.elements.autoRefreshBtn.addEventListener('click', () => {
                this.toggleSLAMAutoRefresh();
            });
        }
    }

    toggleCameraSection() {
        const section = this.elements.cameraSection;
        const slamSection = this.elements.slamSection;
        
        if (section.style.display === 'none') {
            section.style.display = 'block';
            slamSection.style.display = 'none';
            this.elements.cameraButton.style.background = 'rgba(0, 255, 255, 0.2)';
            this.elements.slamButton.style.background = 'var(--panel-bg)';
        } else {
            section.style.display = 'none';
            this.elements.cameraButton.style.background = 'var(--panel-bg)';
        }
    }

    toggleSLAMSection() {
        const section = this.elements.slamSection;
        const cameraSection = this.elements.cameraSection;
        
        if (section.style.display === 'none') {
            section.style.display = 'block';
            cameraSection.style.display = 'none';
            this.elements.slamButton.style.background = 'rgba(0, 255, 255, 0.2)';
            this.elements.cameraButton.style.background = 'var(--panel-bg)';
        } else {
            section.style.display = 'none';
            this.elements.slamButton.style.background = 'var(--panel-bg)';
        }
    }

    async startCamera() {
        if (!this.wifiConnected) {
            this.showError('WiFi connection required for camera feed');
            return;
        }

        try {
            this.setButtonLoading(this.elements.startCameraBtn, true);
            
            // Start camera stream
            this.elements.cameraStream.src = `${this.serverUrl}/api/camera/stream`;
            this.elements.cameraStream.style.display = 'block';
            this.elements.cameraPlaceholder.style.display = 'none';
            
            this.cameraActive = true;
            this.showSuccess('Camera feed started');
            
        } catch (error) {
            console.error('Failed to start camera:', error);
            this.showError('Failed to start camera feed');
        } finally {
            this.setButtonLoading(this.elements.startCameraBtn, false);
        }
    }

    async stopCamera() {
        try {
            this.setButtonLoading(this.elements.stopCameraBtn, true);
            
            // Stop camera stream
            this.elements.cameraStream.src = '';
            this.elements.cameraStream.style.display = 'none';
            this.elements.cameraPlaceholder.style.display = 'block';
            
            this.cameraActive = false;
            this.showSuccess('Camera feed stopped');
            
        } catch (error) {
            console.error('Failed to stop camera:', error);
            this.showError('Failed to stop camera feed');
        } finally {
            this.setButtonLoading(this.elements.stopCameraBtn, false);
        }
    }

    async refreshSLAMMap() {
        if (!this.wifiConnected) {
            this.showError('WiFi connection required for SLAM map');
            return;
        }

        try {
            this.setButtonLoading(this.elements.refreshMapBtn, true);
            
            const response = await fetch(`${this.serverUrl}/api/slam/map`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Display map
                    this.elements.slamMap.src = `data:image/png;base64,${data.map_data}`;
                    this.elements.slamMap.style.display = 'block';
                    this.elements.slamPlaceholder.style.display = 'none';
                    
                    // Update info
                    this.elements.mapResolution.textContent = `${data.resolution} m/pixel`;
                    
                    this.showSuccess('SLAM map updated');
                } else {
                    this.showError('Failed to load SLAM map');
                }
            } else {
                this.showError('Failed to fetch SLAM map');
            }
            
        } catch (error) {
            console.error('Failed to refresh SLAM map:', error);
            this.showError('Failed to refresh SLAM map');
        } finally {
            this.setButtonLoading(this.elements.refreshMapBtn, false);
        }
    }

    async updateRobotPose() {
        if (!this.wifiConnected) return;

        try {
            const response = await fetch(`${this.serverUrl}/api/slam/pose`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.pose) {
                    const pose = data.pose;
                    this.elements.robotPosition.textContent = 
                        `X: ${pose.x.toFixed(2)}m, Y: ${pose.y.toFixed(2)}m, θ: ${pose.theta.toFixed(2)}°`;
                }
            }
        } catch (error) {
            console.warn('Failed to update robot pose:', error);
        }
    }

    toggleSLAMAutoRefresh() {
        this.slamAutoRefresh = !this.slamAutoRefresh;
        
        if (this.slamAutoRefresh) {
            this.elements.autoRefreshBtn.style.background = 'rgba(0, 255, 255, 0.2)';
            this.elements.autoRefreshBtn.innerHTML = '<span class="control-icon">⏸️</span><span class="control-label">Stop Auto</span>';
            
            // Start auto-refresh
            this.slamRefreshInterval = setInterval(() => {
                this.refreshSLAMMap();
                this.updateRobotPose();
            }, 5000); // Refresh every 5 seconds
            
            this.showSuccess('SLAM auto-refresh enabled');
        } else {
            this.elements.autoRefreshBtn.style.background = 'var(--panel-bg)';
            this.elements.autoRefreshBtn.innerHTML = '<span class="control-icon">⚡</span><span class="control-label">Auto Refresh</span>';
            
            // Stop auto-refresh
            if (this.slamRefreshInterval) {
                clearInterval(this.slamRefreshInterval);
                this.slamRefreshInterval = null;
            }
            
            this.showSuccess('SLAM auto-refresh disabled');
        }
    }

    showControlPage() {
        // Hide main page elements
        document.querySelector('.main-content').style.display = 'none';
        document.querySelector('.header').style.display = 'none';
        
        // Show control page
        this.elements.controlPage.style.display = 'block';
        this.elements.controlPage.classList.add('show');
    }

    hideControlPage() {
        // Show main page elements
        document.querySelector('.main-content').style.display = 'block';
        document.querySelector('.header').style.display = 'block';
        
        // Hide control page
        this.elements.controlPage.style.display = 'none';
        this.elements.controlPage.classList.remove('show');
    }

    async executeRobotAction(action) {
        if (!this.isConnected) {
            this.showError('Not connected to LAIKA');
            return;
        }

        console.log(`Executing robot action: ${action}`);
        
        try {
            // Find the button that was clicked
            const button = document.querySelector(`[data-action="${action}"]`);
            if (button) {
                this.setButtonLoading(button, true);
            }

            // Map actions to actual commands
            const actionMap = {
                // Basic movements
                'stand': 'stand',
                'sit': 'sit',
                'lie_down': 'lie_down',
                'go_home': 'go_home',
                
                // Movement directions
                'forward': 'move_forward',
                'back': 'move_backward', 
                'turn_left': 'turn_left',
                'turn_right': 'turn_right',
                
                // Interactive actions
                'bow': 'bow',
                'wave': 'wave',
                'shake_hands': 'shake_hands',
                'nod': 'nod',
                
                // Performance actions
                'dance': 'dance',
                'moonwalk': 'moonwalk',
                'boxing': 'boxing',
                'push_up': 'push_up',
                
                // Sports actions
                'kick_ball_left': 'kick_ball_left',
                'kick_ball_right': 'kick_ball_right',
                'stretch': 'stretch',
                'greeting': 'greeting',
                
                // LED controls
                'red_light': 'red_light',
                'green_light': 'green_light',
                'blue_light': 'blue_light',
                'lights_off': 'lights_off',
                
                // Emergency controls
                'stop': 'emergency_stop',
                'reset': 'reset'
            };

            const command = actionMap[action] || action;
            
            // For now, we'll simulate the command - replace with actual BLE communication
            await this.simulateRobotCommand(command);
            
            this.showSuccess(`Command "${action}" sent to LAIKA`);
            
        } catch (error) {
            console.error(`Action ${action} failed:`, error);
            this.showError(`Action "${action}" failed: ${error.message}`);
        } finally {
            const button = document.querySelector(`[data-action="${action}"]`);
            if (button) {
                this.setButtonLoading(button, false);
            }
        }
    }

    async simulateRobotCommand(command) {
        // Simulate command execution delay
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log(`Simulated robot command: ${command}`);
                resolve();
            }, 500);
        });
    }

    updatePose() {
        if (!this.isConnected) return;

        const height = parseFloat(this.elements.heightSlider.value);
        const pitch = parseFloat(this.elements.pitchSlider.value);
        const roll = parseFloat(this.elements.rollSlider.value);

        console.log(`Updating pose: height=${height}, pitch=${pitch}, roll=${roll}`);
        
        // For now, just log the pose update - replace with actual BLE communication
        this.simulateRobotCommand(`pose_update:height=${height},pitch=${pitch},roll=${roll}`);
    }

    showConnectedButtons() {
        this.elements.connectButton.style.display = 'none';
        this.elements.identifyButton.style.display = 'block';
        this.elements.configureWifiButton.style.display = 'block';
        this.elements.controlPageButton.style.display = 'block';
        this.elements.disconnectButton.style.display = 'block';
    }

    showDisconnectedButtons() {
        this.elements.connectButton.style.display = 'block';
        this.elements.identifyButton.style.display = 'none';
        this.elements.configureWifiButton.style.display = 'none';
        this.elements.controlPageButton.style.display = 'none';
        this.elements.disconnectButton.style.display = 'none';
    }

    setButtonLoading(button, loading) {
        if (loading) {
            button.disabled = true;
            const originalText = button.innerHTML;
            button.dataset.originalText = originalText;
            button.innerHTML = '<span class="loading-spinner"></span><span>Loading...</span>';
        } else {
            button.disabled = false;
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        }
    }

    showError(message) {
        this.hideMessages();
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.classList.add('show');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.elements.errorMessage.classList.remove('show');
        }, 5000);
    }

    showSuccess(message) {
        this.hideMessages();
        this.elements.successMessage.textContent = message;
        this.elements.successMessage.classList.add('show');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            this.elements.successMessage.classList.remove('show');
        }, 3000);
    }

    hideMessages() {
        this.elements.errorMessage.classList.remove('show');
        this.elements.successMessage.classList.remove('show');
    }
}

// Global function for network selection (called from HTML)
function scanNetworks() {
    if (window.app) {
        window.app.scanNetworks();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new LAIKAController();
    try {
        if (window.LAIKA_BUILD_INFO) {
            console.log(`LAIKA PWA build: ${window.LAIKA_BUILD_INFO.commit} @ ${window.LAIKA_BUILD_INFO.timestamp}`);
        }
    } catch (e) {}
    console.log('LAIKA Controller PWA loaded');
});
