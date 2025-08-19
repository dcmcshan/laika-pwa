/**
 * LAIKA Controller PWA Main Application
 */

class LAIKAController {
    constructor() {
        this.bleImprov = new BLEImprov();
        this.networkScanner = new NetworkScanner();
        this.laikaActions = new LAIKAActions();
        this.logViewer = new LAIKALogViewer();
        this.webrtcConnection = new LAIKAWebRTCConnection();
        this.bleChat = new LAIKABLEChat();
        this.voiceSystem = new LAIKAVoiceSystem();
        this.isConnected = false;
        this.currentDevice = null;
        this.connectionType = null; // 'ble', 'network', or 'webrtc'
        this.networkDevices = [];
        
        // Override the sendActionCommand method
        this.laikaActions.sendActionCommand = this.sendRobotCommand.bind(this);
        
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
        
        // Action execution state
        this.isExecutingAction = false;
        this.currentActionQueue = [];
        
        // Device registry for global discovery
        this.deviceRegistry = new Map();
        this.registryCheckInterval = null;
        
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
        
        // Set up Network Scanner event handlers
        this.setupNetworkHandlers();
        
        // Set up UI event listeners
        this.setupEventListeners();
        
        // Set up PWA install prompt
        this.setupPWAInstall();
        
        // Set up action controls
        this.setupActionControls();
        
        // Initialize log viewer
        this.initializeLogViewer();
        
        // Initialize WebRTC connection
        this.initializeWebRTC();
        
        // Initialize BLE Chat
        this.initializeBLEChat();
        
        // Initialize Voice System
        this.initializeVoiceSystem();
        
        // Start device registry monitoring
        this.startRegistryMonitoring();
        
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

    setupNetworkHandlers() {
        this.networkScanner.onDeviceFound = (device) => {
            console.log('Network device found:', device);
            this.networkDevices.push(device);
            this.updateNetworkDevicesList();
        };

        this.networkScanner.onScanComplete = (devices) => {
            console.log(`Network scan complete. Found ${devices.length} devices`);
            this.networkDevices = devices;
            this.updateNetworkDevicesList();
            
            if (devices.length > 0) {
                this.showNetworkConnectionOptions();
            } else {
                this.showError('No PuppyPi devices found on network. Try BLE connection.');
            }
        };

        this.networkScanner.onConnectionEstablished = (device) => {
            console.log('Network connection established:', device);
            this.isConnected = true;
            this.connectionType = 'network';
            this.currentDevice = device;
            this.updateStatus('connected', '🌐', `Connected to ${device.name}`, 'Network Connected');
            this.showConnectedButtons();
            this.showSuccess(`Successfully connected to ${device.name} via network!`);
            this.handleWiFiConnected();
        };

        this.networkScanner.onConnectionLost = (event) => {
            console.log('Network connection lost:', event);
            this.handleDisconnection();
        };

        this.networkScanner.onError = (error) => {
            console.error('Network scanner error:', error);
            this.showError(`Network Error: ${error.message}`);
        };

        // Listen for PuppyPi messages
        window.addEventListener('puppypi-message', (event) => {
            this.handlePuppyPiMessage(event.detail);
        });
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
            
            // PRIORITY 1: Check WebRTC devices first (best for NAT traversal)
            console.log('🌐 Checking WebRTC devices...');
            this.updateStatus('connecting', '🌐', 'Checking WebRTC LAIKA devices...', 'WebRTC Discovery');
            
            const webrtcDevices = this.webrtcConnection.getAvailableDevices();
            if (webrtcDevices.length > 0) {
                const bestWebRTCDevice = webrtcDevices[0];
                console.log('🎯 Found WebRTC LAIKA:', bestWebRTCDevice.device_id);
                this.updateStatus('connecting', '🔄', `Connecting to ${bestWebRTCDevice.device_id} via WebRTC...`, 'WebRTC Connection');
                
                try {
                    await this.webrtcConnection.connectToDevice(bestWebRTCDevice.device_id);
                    this.isConnected = true;
                    this.connectionType = 'webrtc';
                    this.currentDevice = bestWebRTCDevice;
                    this.updateStatus('connected', '✅', `Connected to ${bestWebRTCDevice.device_id} via WebRTC`, 'WebRTC Connected');
                    this.showConnectedButtons();
                    this.showSuccess('Successfully connected via WebRTC with NAT traversal!');
                    return; // Success - WebRTC connection established
                } catch (webrtcError) {
                    console.warn('WebRTC connection failed:', webrtcError);
                    this.showError(`WebRTC connection failed: ${webrtcError.message}`);
                }
            }
            
            // PRIORITY 2: Check registered devices (direct IP)
            console.log('🌍 Checking global device registry...');
            this.updateStatus('connecting', '🌍', 'Checking registered LAIKA devices...', 'Registry Search');
            
            const registeredDevices = Array.from(this.deviceRegistry.values());
            const onlineDevices = registeredDevices.filter(d => {
                if (!d.network || !d.network.wifi_connected) return false;
                const lastSeen = new Date(d.location.last_seen);
                const timeDiff = (new Date() - lastSeen) / 1000;
                return timeDiff < 300; // Online if seen within 5 minutes
            });
            
            if (onlineDevices.length > 0) {
                // Try to connect to the most recently seen registered device
                onlineDevices.sort((a, b) => new Date(b.location.last_seen) - new Date(a.location.last_seen));
                const bestRegisteredDevice = onlineDevices[0];
                
                console.log('🎯 Found registered LAIKA:', bestRegisteredDevice.device_name);
                this.updateStatus('connecting', '🔄', `Connecting to registered ${bestRegisteredDevice.device_name}...`, 'Registry Connection');
                
                try {
                    await this.connectToRegistryDevice(bestRegisteredDevice.device_id);
                    return; // Success - registry connection established
                } catch (registryError) {
                    console.warn('Registry device connection failed:', registryError);
                    this.showError(`Failed to connect to registered device: ${registryError.message}`);
                }
            }
            
            // PRIORITY 2: Try local network discovery
            console.log('🔍 Starting local network discovery...');
            this.updateStatus('connecting', '🔍', 'Scanning local network for LAIKA...', 'Network Discovery');
            
            try {
                await this.networkScanner.startScan();
                
                if (this.networkDevices.length > 0) {
                    // Found local network devices - try to connect to best one
                    const bestDevice = this.networkScanner.getBestDevice();
                    if (bestDevice && bestDevice.websocketUrl) {
                        console.log('🌐 Connecting via local network to:', bestDevice.name);
                        this.updateStatus('connecting', '🔄', `Connecting to ${bestDevice.name}...`, 'Network Connection');
                        
                        await this.networkScanner.connectToDevice(bestDevice);
                        return; // Success - network connection established
                    }
                }
            } catch (networkError) {
                console.warn('Local network discovery failed:', networkError);
            }
            
            // PRIORITY 3: Fall back to BLE discovery as last resort
            console.log('📡 Falling back to BLE discovery...');
            this.updateStatus('connecting', '📡', 'No network devices found. Trying BLE...', 'BLE Discovery');
            
            const device = await this.bleImprov.scan();
            
            if (device) {
                this.currentDevice = device;
                this.connectionType = 'ble';
                this.updateStatus('connecting', '🔄', 'Connecting to LAIKA via BLE...', device.name || 'Unknown Device');
                
                await this.bleImprov.connect();
                
                this.isConnected = true;
                this.updateStatus('connected', '✅', 'Connected to LAIKA via BLE', device.name || 'Connected Device');
                this.showConnectedButtons();
                this.showSuccess('Successfully connected to LAIKA via BLE!');
                
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
            this.showError(`Connection failed: ${error.message}. Make sure LAIKA is powered on and nearby.`);
            this.updateStatus('disconnected', '❌', 'Connection failed', 'Not connected');
        } finally {
            this.setButtonLoading(this.elements.connectButton, false);
        }
    }

    async disconnectFromDevice() {
        try {
            this.setButtonLoading(this.elements.disconnectButton, true);
            
            if (this.connectionType === 'ble') {
                await this.bleImprov.disconnect();
            } else if (this.connectionType === 'network') {
                this.networkScanner.disconnect();
            }
            
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
        this.connectionType = null;
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
            // Try to load local map data directly for demonstration
            try {
                const response = await fetch('/api/slam/map');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        // Display map
                        this.elements.slamMap.src = `data:image/png;base64,${data.map_data}`;
                        this.elements.slamMap.style.display = 'block';
                        this.elements.slamPlaceholder.style.display = 'none';
                        
                        // Update info with more details
                        this.elements.mapResolution.textContent = `${data.resolution} m/pixel`;
                        
                        // Update robot position info
                        if (data.map_name && data.timestamp) {
                            const timestamp = new Date(data.timestamp * 1000).toLocaleTimeString();
                            this.elements.robotPosition.textContent = `${data.map_name} (${timestamp})`;
                        }
                        
                        this.showSuccess(`SLAM map loaded: ${data.width}×${data.height} pixels`);
                        return;
                    }
                }
            } catch (error) {
                console.warn('Failed to load local map:', error);
            }
            
            this.showError('WiFi connection required for SLAM map - showing demo mode');
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
                    
                    // Update info with more details
                    this.elements.mapResolution.textContent = `${data.resolution} m/pixel`;
                    
                    // Update robot position info
                    if (data.map_name && data.timestamp) {
                        const timestamp = new Date(data.timestamp * 1000).toLocaleTimeString();
                        this.elements.robotPosition.textContent = `${data.map_name} (${timestamp})`;
                    }
                    
                    this.showSuccess(`SLAM map updated: ${data.width}×${data.height} pixels`);
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
            
            // Send command based on connection type
            if (this.connectionType === 'network') {
                await this.sendNetworkCommand(command);
            } else if (this.connectionType === 'ble') {
                await this.simulateRobotCommand(command);
            }
            
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

    // Network-specific methods
    
    async sendNetworkCommand(command, data = null) {
        if (!this.networkScanner.websocket || this.networkScanner.websocket.readyState !== WebSocket.OPEN) {
            throw new Error('No active network connection');
        }
        
        await this.networkScanner.sendCommand(command, data);
    }
    
    updateNetworkDevicesList() {
        if (!this.elements.networksList) return;
        
        if (this.networkDevices.length === 0) {
            this.elements.networksList.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666;">
                    No PuppyPi devices found on network
                </div>
            `;
            return;
        }

        this.elements.networksList.innerHTML = this.networkDevices.map(device => `
            <div class="network-item" onclick="app.connectToNetworkDevice('${device.address}', ${device.port})">
                <div class="network-name">
                    ${device.name} 
                    <span style="color: var(--text-dim); font-size: 12px;">(${device.address}:${device.port})</span>
                </div>
                <div class="network-info">
                    <span>${device.type === 'laika' ? '🤖' : '📡'}</span>
                    <span>${device.websocketUrl ? '🔌' : '❌'}</span>
                    <span style="color: var(--atomic-cyan);">${device.type.toUpperCase()}</span>
                </div>
            </div>
        `).join('');
    }
    
    async connectToNetworkDevice(address, port) {
        const device = this.networkDevices.find(d => d.address === address && d.port === port);
        if (!device) {
            this.showError('Device not found');
            return;
        }
        
        try {
            this.setButtonLoading(this.elements.connectButton, true);
            this.hideMessages();
            
            console.log(`🌐 Connecting to ${device.name}...`);
            this.updateStatus('connecting', '🔄', `Connecting to ${device.name}...`, 'Network Connection');
            
            await this.networkScanner.connectToDevice(device);
            
        } catch (error) {
            console.error('Network connection failed:', error);
            this.showError(`Failed to connect to ${device.name}: ${error.message}`);
        } finally {
            this.setButtonLoading(this.elements.connectButton, false);
        }
    }
    
    showNetworkConnectionOptions() {
        // Update the connect button to show network options
        const connectButton = this.elements.connectButton;
        if (connectButton && this.networkDevices.length > 0) {
            const bestDevice = this.networkScanner.getBestDevice();
            connectButton.innerHTML = `
                <span>🌐</span>
                <span>Connect to ${bestDevice.name}</span>
            `;
            
            // Show network devices in the networks list if available
            this.updateNetworkDevicesList();
        }
    }
    
    handlePuppyPiMessage(messageData) {
        const { device, message } = messageData;
        console.log(`📨 Message from ${device.name}:`, message);
        
        // Handle different message types
        if (message.type === 'status') {
            this.updateDeviceStatus(message.data);
        } else if (message.type === 'response') {
            this.handleCommandResponse(message.data);
        } else if (message.type === 'error') {
            this.showError(`Device Error: ${message.data.error}`);
        } else if (message.type === 'notification') {
            this.showSuccess(message.data.message);
        }
    }
    
    updateDeviceStatus(statusData) {
        // Update UI based on device status
        if (statusData.battery) {
            // Update battery indicator if available
            console.log('Battery level:', statusData.battery);
        }
        
        if (statusData.wifi && statusData.wifi.connected) {
            // Device is connected to WiFi
            this.wifiConnected = true;
            this.serverUrl = `http://${this.currentDevice.address}:${this.currentDevice.port}`;
            this.handleWiFiConnected();
        }
    }
    
    handleCommandResponse(responseData) {
        if (responseData.success) {
            console.log('✅ Command executed successfully:', responseData.message);
        } else {
            console.error('❌ Command failed:', responseData.error);
            this.showError(`Command failed: ${responseData.error}`);
        }
    }
    
    // New methods for enhanced functionality
    
    setupActionControls() {
        // This will be called to set up the comprehensive action controls
        console.log('Setting up LAIKA action controls...');
        this.renderActionPanels();
    }
    
    initializeLogViewer() {
        // Initialize the log viewer when connected
        console.log('Initializing LAIKA log viewer...');
        try {
            this.logViewer.initialize();
        } catch (error) {
            console.warn('Log viewer initialization failed:', error);
        }
    }
    
    async initializeWebRTC() {
        // Initialize WebRTC connection for NAT traversal
        console.log('Initializing WebRTC connection...');
        try {
            // Set up event handlers
            this.webrtcConnection.onDeviceDiscovered = (device) => {
                console.log('WebRTC device discovered:', device.device_id);
                this.updateRegistryUI(); // Update UI with WebRTC devices
            };
            
            this.webrtcConnection.onConnectionEstablished = () => {
                console.log('WebRTC connection established');
                this.isConnected = true;
                this.connectionType = 'webrtc';
                this.handleWiFiConnected(); // Enable advanced features
            };
            
            this.webrtcConnection.onConnectionLost = () => {
                console.log('WebRTC connection lost');
                this.handleDisconnection();
            };
            
            this.webrtcConnection.onError = (error) => {
                console.error('WebRTC error:', error);
                this.showError(`WebRTC error: ${error.message}`);
            };
            
            // Initialize WebRTC (connects to signaling server)
            const success = await this.webrtcConnection.initialize();
            if (success) {
                console.log('✅ WebRTC initialized successfully');
            } else {
                console.warn('WebRTC initialization failed - will use fallback connections');
            }
        } catch (error) {
            console.warn('WebRTC initialization error:', error);
        }
    }
    
    initializeBLEChat() {
        // Initialize BLE Chat functionality
        console.log('Initializing BLE Chat...');
        try {
            // Set up event handlers
            this.bleChat.onMessageReceived = (data) => {
                console.log('BLE message received:', data);
                this.displayChatMessage(data.message, 'laika');
            };
            
            this.bleChat.onConnectionChanged = (connected) => {
                if (connected) {
                    console.log('BLE Chat connected');
                    this.showSuccess('Connected to LAIKA via BLE Chat!');
                    this.enableChatInterface();
                } else {
                    console.log('BLE Chat disconnected');
                    this.disableChatInterface();
                }
            };
            
            this.bleChat.onError = (error) => {
                console.error('BLE Chat error:', error);
                this.showError(`BLE Chat error: ${error.message}`);
            };
            
            // Set up chat UI if available
            this.setupChatInterface();
            
            console.log('✅ BLE Chat initialized successfully');
        } catch (error) {
            console.warn('BLE Chat initialization error:', error);
        }
    }
    
    initializeVoiceSystem() {
        // Initialize Voice System with STT and TTS
        console.log('Initializing Voice System...');
        try {
            // Set up event handlers
            this.voiceSystem.onSpeechRecognized = (data) => {
                console.log('Speech recognized:', data.transcript);
                this.displayChatMessage(data.transcript, 'user');
                
                if (data.isFinal) {
                    // Send to LAIKA for processing
                    this.processSpeechInput(data.transcript);
                }
            };
            
            this.voiceSystem.onSpeechStart = () => {
                console.log('Listening started');
                this.updateVoiceStatus('listening');
            };
            
            this.voiceSystem.onSpeechEnd = () => {
                console.log('Listening ended');
                this.updateVoiceStatus('idle');
            };
            
            this.voiceSystem.onTTSStart = () => {
                console.log('LAIKA speaking');
                this.updateVoiceStatus('speaking');
            };
            
            this.voiceSystem.onTTSEnd = () => {
                console.log('LAIKA finished speaking');
                this.updateVoiceStatus('idle');
            };
            
            this.voiceSystem.onError = (error) => {
                console.error('Voice system error:', error);
                this.showError(`Voice error: ${error}`);
                this.updateVoiceStatus('error');
            };
            
            // Set up chat UI
            this.setupVoiceChatInterface();
            
            console.log('✅ Voice System initialized successfully');
        } catch (error) {
            console.warn('Voice System initialization error:', error);
        }
    }
    
    renderActionPanels() {
        // Render all available LAIKA actions in the control panel
        const controlPage = document.getElementById('controlPage');
        if (!controlPage) return;
        
        // Find or create actions container
        let actionsContainer = document.getElementById('actionsContainer');
        if (!actionsContainer) {
            actionsContainer = document.createElement('div');
            actionsContainer.id = 'actionsContainer';
            actionsContainer.className = 'actions-container';
            controlPage.appendChild(actionsContainer);
        }
        
        // Render action categories
        const actions = this.laikaActions.actions;
        let html = '<h3>🤖 LAIKA Actions</h3>';
        
        Object.keys(actions).forEach(categoryKey => {
            const category = actions[categoryKey];
            html += `
                <div class="action-category">
                    <h4 class="category-header" onclick="app.toggleActionCategory('${categoryKey}')">
                        ${category.icon} ${category.name}
                        <span class="toggle-icon">▼</span>
                    </h4>
                    <div class="action-grid" id="category-${categoryKey}" style="display: none;">
            `;
            
            Object.keys(category.actions).forEach(actionKey => {
                const action = category.actions[actionKey];
                const buttonClass = action.emergency ? 'action-button emergency' : 
                                   action.dangerous ? 'action-button dangerous' : 'action-button';
                
                html += `
                    <button class="${buttonClass}" 
                            onclick="app.executeAction('${actionKey}')"
                            title="${action.description}">
                        <span class="action-icon">${action.icon}</span>
                        <span class="action-name">${action.name}</span>
                    </button>
                `;
            });
            
            html += '</div></div>';
        });
        
        actionsContainer.innerHTML = html;
    }
    
    toggleActionCategory(categoryKey) {
        const categoryDiv = document.getElementById(`category-${categoryKey}`);
        const toggleIcon = document.querySelector(`#category-${categoryKey}`).previousElementSibling.querySelector('.toggle-icon');
        
        if (categoryDiv.style.display === 'none') {
            categoryDiv.style.display = 'grid';
            toggleIcon.textContent = '▲';
        } else {
            categoryDiv.style.display = 'none';
            toggleIcon.textContent = '▼';
        }
    }
    
    async executeAction(actionName) {
        if (!this.isConnected) {
            this.showError('Not connected to LAIKA');
            return;
        }
        
        try {
            // Check if it's a dangerous action and confirm
            if (this.laikaActions.isDangerousAction(actionName)) {
                const confirmed = confirm(`Are you sure you want to execute "${actionName}"? This action may be irreversible.`);
                if (!confirmed) {
                    return;
                }
            }
            
            const result = await this.laikaActions.executeAction(actionName);
            const action = this.laikaActions.getAction(actionName);
            this.showSuccess(`✅ ${action.name} executed successfully`);
            
        } catch (error) {
            console.error(`Action ${actionName} failed:`, error);
            this.showError(`❌ Action failed: ${error.message}`);
        }
    }
    
    async sendRobotCommand(command, params = {}) {
        // Enhanced command sending that works with WebRTC, BLE, and network connections
        if (this.connectionType === 'webrtc') {
            return await this.webrtcConnection.sendCommand(command, params);
        } else if (this.connectionType === 'network') {
            return await this.sendNetworkCommand(command, params);
        } else if (this.connectionType === 'ble') {
            return await this.sendBLECommand(command, params);
        } else {
            throw new Error('No active connection to send command');
        }
    }
    
    async sendBLECommand(command, params = {}) {
        // For BLE connections, we'll simulate the command for now
        // In a real implementation, this would use BLE characteristics
        console.log(`📡 Sending BLE command: ${command}`, params);
        
        // Simulate command execution delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return {
            success: true,
            command: command,
            params: params,
            method: 'ble'
        };
    }
    
    startRegistryMonitoring() {
        // Start monitoring device registry for global LAIKA discovery
        console.log('🔍 Starting device registry monitoring...');
        
        this.registryCheckInterval = setInterval(() => {
            this.checkDeviceRegistry();
        }, 30000); // Check every 30 seconds
        
        // Initial check
        this.checkDeviceRegistry();
    }
    
    async checkDeviceRegistry() {
        try {
            // Try to fetch from local registry first
            const response = await fetch('http://localhost:8888/api/devices/laika');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.devices) {
                    this.updateDeviceRegistry(data.devices);
                }
            }
        } catch (error) {
            console.debug('Registry check failed (expected if no local registry):', error.message);
        }
    }
    
    updateDeviceRegistry(devices) {
        devices.forEach(device => {
            this.deviceRegistry.set(device.device_id, {
                ...device,
                last_updated: new Date()
            });
        });
        
        console.log(`📋 Device registry updated: ${this.deviceRegistry.size} devices`);
        this.updateRegistryUI();
    }
    
    updateRegistryUI() {
        // Update UI to show available LAIKA devices globally
        const registryContainer = document.getElementById('globalDevicesContainer');
        if (!registryContainer) return;
        
        const devices = Array.from(this.deviceRegistry.values());
        const onlineDevices = devices.filter(d => d.network && d.network.wifi_connected);
        
        if (onlineDevices.length > 0) {
            let html = '<h4>🌐 Available LAIKA Devices</h4>';
            onlineDevices.forEach(device => {
                const lastSeen = new Date(device.location.last_seen);
                const timeDiff = (new Date() - lastSeen) / 1000; // seconds
                const status = timeDiff < 300 ? 'online' : 'offline'; // 5 minutes
                
                html += `
                    <div class="registry-device ${status}">
                        <div class="device-info">
                            <strong>${device.device_name}</strong>
                            <span class="device-id">${device.device_id}</span>
                        </div>
                        <div class="device-network">
                            <span>📍 ${device.network.ssid || 'Unknown Network'}</span>
                            <span>🌐 ${device.network.local_ip || 'No IP'}</span>
                        </div>
                        <div class="device-actions">
                            <button onclick="app.connectToRegistryDevice('${device.device_id}')" 
                                    class="connect-btn ${status}">
                                ${status === 'online' ? 'Connect' : 'Offline'}
                            </button>
                        </div>
                    </div>
                `;
            });
            registryContainer.innerHTML = html;
        } else {
            registryContainer.innerHTML = '<p>No LAIKA devices found in registry</p>';
        }
    }
    
    async connectToRegistryDevice(deviceId) {
        const device = this.deviceRegistry.get(deviceId);
        if (!device) {
            this.showError('Device not found in registry');
            return;
        }
        
        try {
            this.setButtonLoading(this.elements.connectButton, true);
            this.updateStatus('connecting', '🔄', `Connecting to ${device.device_name}...`, 'Registry Connection');
            
            // Try to connect via WebSocket if available
            if (device.services && device.services.websocket) {
                const wsUrl = device.services.websocket;
                console.log(`🌐 Connecting to registry device via WebSocket: ${wsUrl}`);
                
                // Create a mock device object for network scanner
                const networkDevice = {
                    name: device.device_name,
                    address: device.network.local_ip,
                    port: 8765,
                    websocketUrl: wsUrl,
                    type: 'laika',
                    device_id: deviceId
                };
                
                await this.networkScanner.connectToDevice(networkDevice);
                this.showSuccess(`Connected to ${device.device_name} from registry!`);
            } else {
                this.showError('Device does not support WebSocket connection');
            }
            
        } catch (error) {
            console.error('Registry device connection failed:', error);
            this.showError(`Failed to connect to ${device.device_name}: ${error.message}`);
        } finally {
            this.setButtonLoading(this.elements.connectButton, false);
        }
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
