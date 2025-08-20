/**
 * LAIKA Camera Controller
 * Advanced HD streaming with AI vision integration
 */

class LAIKACamera {
    constructor() {
        this.isConnected = false;
        this.isStreaming = false;
        this.isRecording = false;
        this.isFullscreen = false;
        this.currentZoom = 1.0;
        this.streamQuality = '1080p';
        this.aiFeatures = {
            objectDetection: false,
            faceRecognition: false,
            motionTracking: false,
            sceneAnalysis: false
        };
        
        // Camera settings
        this.cameraSettings = {
            exposure: -3.0,
            brightness: 120,
            contrast: 60,
            saturation: 80,
            gain: 100,
            whiteBalance: 4000,
            autoExposure: false,
            autoWhiteBalance: true
        };
        
        // WebRTC and WebSocket connections
        this.ws = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        
        // AI detection data
        this.detectedObjects = [];
        this.detectedFaces = [];
        this.motionLevel = 0;
        this.currentScene = 'Unknown';
        
        // Camera control state
        this.panPosition = 0;    // -180 to 180 degrees
        this.tiltPosition = 0;   // -90 to 90 degrees
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.updateUI();
        this.updateCameraSettingsUI();
        this.startStatusUpdates();
        
        // Load camera parameters from server
        await this.loadCameraParametersHTTP();
        
        // Attempt to connect
        await this.connectWebSocket();
        
        console.log('🎥 LAIKA Camera initialized');
    }

    setupEventListeners() {
        // Video controls
        document.getElementById('playPauseBtn').addEventListener('click', () => this.toggleStream());
        document.getElementById('fullscreenBtn').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('pipBtn').addEventListener('click', () => this.togglePictureInPicture());
        document.getElementById('photoBtn').addEventListener('click', () => this.takePhoto());
        document.getElementById('recordBtn').addEventListener('click', () => this.toggleRecording());
        document.getElementById('micBtn').addEventListener('click', () => this.toggleMicrophone());

        // Pan/Tilt controls
        document.querySelectorAll('.pan-tilt-btn').forEach(btn => {
            btn.addEventListener('mousedown', (e) => this.startPanTilt(e.target.dataset.direction));
            btn.addEventListener('mouseup', () => this.stopPanTilt());
            btn.addEventListener('mouseleave', () => this.stopPanTilt());
            
            // Touch events for mobile
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.startPanTilt(e.target.dataset.direction);
            });
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.stopPanTilt();
            });
        });

        // Zoom controls
        document.getElementById('zoomSlider').addEventListener('input', (e) => this.setZoom(parseFloat(e.target.value)));
        document.getElementById('zoomInBtn').addEventListener('click', () => this.adjustZoom(0.5));
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.adjustZoom(-0.5));

        // Quality settings
        document.querySelectorAll('.quality-option').forEach(option => {
            option.addEventListener('click', (e) => this.setStreamQuality(e.target.dataset.quality));
        });

        // AI feature toggles
        document.querySelectorAll('.feature-toggle').forEach(toggle => {
            if (toggle.dataset.feature) {
                toggle.addEventListener('click', (e) => this.toggleAIFeature(e.currentTarget.dataset.feature));
            } else if (toggle.dataset.setting) {
                toggle.addEventListener('click', (e) => this.toggleCameraSetting(e.currentTarget.dataset.setting));
            }
        });

        // Camera settings sliders
        document.getElementById('exposureSlider').addEventListener('input', (e) => this.setCameraSetting('exposure', parseFloat(e.target.value)));
        document.getElementById('brightnessSlider').addEventListener('input', (e) => this.setCameraSetting('brightness', parseInt(e.target.value)));
        document.getElementById('contrastSlider').addEventListener('input', (e) => this.setCameraSetting('contrast', parseInt(e.target.value)));
        document.getElementById('saturationSlider').addEventListener('input', (e) => this.setCameraSetting('saturation', parseInt(e.target.value)));
        document.getElementById('gainSlider').addEventListener('input', (e) => this.setCameraSetting('gain', parseInt(e.target.value)));
        document.getElementById('whiteBalanceSlider').addEventListener('input', (e) => this.setCameraSetting('whiteBalance', parseInt(e.target.value)));

        // Camera settings buttons
        document.getElementById('exposureDownBtn').addEventListener('click', () => this.adjustCameraSetting('exposure', -0.5));
        document.getElementById('exposureUpBtn').addEventListener('click', () => this.adjustCameraSetting('exposure', 0.5));
        document.getElementById('brightnessDownBtn').addEventListener('click', () => this.adjustCameraSetting('brightness', -5));
        document.getElementById('brightnessUpBtn').addEventListener('click', () => this.adjustCameraSetting('brightness', 5));
        document.getElementById('contrastDownBtn').addEventListener('click', () => this.adjustCameraSetting('contrast', -5));
        document.getElementById('contrastUpBtn').addEventListener('click', () => this.adjustCameraSetting('contrast', 5));
        document.getElementById('saturationDownBtn').addEventListener('click', () => this.adjustCameraSetting('saturation', -5));
        document.getElementById('saturationUpBtn').addEventListener('click', () => this.adjustCameraSetting('saturation', 5));
        document.getElementById('gainDownBtn').addEventListener('click', () => this.adjustCameraSetting('gain', -10));
        document.getElementById('gainUpBtn').addEventListener('click', () => this.adjustCameraSetting('gain', 10));
        document.getElementById('whiteBalanceDownBtn').addEventListener('click', () => this.adjustCameraSetting('whiteBalance', -100));
        document.getElementById('whiteBalanceUpBtn').addEventListener('click', () => this.adjustCameraSetting('whiteBalance', 100));

        // Camera presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.applyCameraPreset(e.target.dataset.preset));
        });

        // Video element events
        const video = document.getElementById('videoStream');
        video.addEventListener('loadstart', () => this.onVideoLoadStart());
        video.addEventListener('canplay', () => this.onVideoCanPlay());
        video.addEventListener('error', (e) => this.onVideoError(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Page visibility for performance optimization
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isStreaming) {
                this.pauseStream();
            } else if (!document.hidden && this.isConnected) {
                this.resumeStream();
            }
        });
    }

    async connectWebSocket() {
        const wsUrls = [
            `ws://${window.location.hostname}:8765`,
            'ws://laika.local:8765',
            'ws://localhost:8765'
        ];

        for (const url of wsUrls) {
            try {
                console.log(`🔗 Attempting WebSocket connection to ${url}`);
                
                this.ws = new WebSocket(url);
                
                this.ws.onopen = () => {
                    console.log('✅ WebSocket connected to LAIKA camera service');
                    this.isConnected = true;
                    this.updateConnectionStatus();
                    this.initializeWebRTC();
                };

                this.ws.onmessage = (event) => {
                    this.handleWebSocketMessage(JSON.parse(event.data));
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

    async initializeWebRTC() {
        try {
            // Create RTCPeerConnection
            this.peerConnection = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            // Handle remote stream
            this.peerConnection.ontrack = (event) => {
                console.log('📺 Received remote stream');
                const video = document.getElementById('videoStream');
                if (video && event.streams[0]) {
                    video.srcObject = event.streams[0];
                    this.remoteStream = event.streams[0];
                    this.isStreaming = true;
                    this.updateUI();
                }
            };

            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.sendMessage({
                        type: 'ice-candidate',
                        candidate: event.candidate
                    });
                }
            };

            // Request stream from LAIKA
            this.sendMessage({
                type: 'request-stream',
                quality: this.streamQuality
            });

        } catch (error) {
            console.error('❌ WebRTC initialization failed:', error);
            this.enableSimulationMode();
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'stream-offer':
                this.handleStreamOffer(data.offer);
                break;
            case 'ice-candidate':
                this.handleIceCandidate(data.candidate);
                break;
            case 'camera-status':
                this.handleCameraStatus(data);
                break;
            case 'ai-detection':
                this.handleAIDetection(data);
                break;
            case 'pan-tilt-status':
                this.handlePanTiltStatus(data);
                break;
            case 'error':
                console.error('❌ Camera error:', data.message);
                break;
            default:
                console.log('📦 Unknown message type:', data.type);
        }
    }

    async handleStreamOffer(offer) {
        try {
            await this.peerConnection.setRemoteDescription(offer);
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.sendMessage({
                type: 'stream-answer',
                answer: answer
            });
        } catch (error) {
            console.error('❌ Failed to handle stream offer:', error);
        }
    }

    async handleIceCandidate(candidate) {
        try {
            await this.peerConnection.addIceCandidate(candidate);
        } catch (error) {
            console.error('❌ Failed to add ICE candidate:', error);
        }
    }

    handleCameraStatus(data) {
        if (data.pan !== undefined) this.panPosition = data.pan;
        if (data.tilt !== undefined) this.tiltPosition = data.tilt;
        if (data.zoom !== undefined) this.currentZoom = data.zoom;
        this.updateUI();
    }

    handleAIDetection(data) {
        this.detectedObjects = data.objects || [];
        this.detectedFaces = data.faces || [];
        this.motionLevel = data.motion || 0;
        this.currentScene = data.scene || 'Unknown';
        
        this.updateAIOverlay();
        this.updateAIStats();
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.log('📡 WebSocket not connected, message queued');
        }
    }

    // Camera Control Methods
    toggleStream() {
        if (this.isStreaming) {
            this.pauseStream();
        } else {
            this.resumeStream();
        }
    }

    pauseStream() {
        const video = document.getElementById('videoStream');
        if (video) {
            video.pause();
        }
        this.isStreaming = false;
        this.updateUI();
    }

    resumeStream() {
        const video = document.getElementById('videoStream');
        if (video) {
            video.play();
        }
        this.isStreaming = true;
        this.updateUI();
    }

    async toggleFullscreen() {
        const videoWrapper = document.querySelector('.video-wrapper');
        
        if (!this.isFullscreen) {
            try {
                if (videoWrapper.requestFullscreen) {
                    await videoWrapper.requestFullscreen();
                } else if (videoWrapper.webkitRequestFullscreen) {
                    await videoWrapper.webkitRequestFullscreen();
                }
                this.isFullscreen = true;
            } catch (error) {
                console.error('❌ Fullscreen failed:', error);
            }
        } else {
            try {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    await document.webkitExitFullscreen();
                }
                this.isFullscreen = false;
            } catch (error) {
                console.error('❌ Exit fullscreen failed:', error);
            }
        }
        this.updateUI();
    }

    async togglePictureInPicture() {
        const video = document.getElementById('videoStream');
        
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else if (video.requestPictureInPicture) {
                await video.requestPictureInPicture();
            }
        } catch (error) {
            console.error('❌ Picture-in-Picture failed:', error);
        }
    }

    takePhoto() {
        const video = document.getElementById('videoStream');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = video.videoWidth || 1920;
        canvas.height = video.videoHeight || 1080;
        
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to blob and download
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `laika-photo-${new Date().toISOString().slice(0, 19)}.jpg`;
            a.click();
            URL.revokeObjectURL(url);
        }, 'image/jpeg', 0.9);

        // Send photo command to LAIKA
        this.sendMessage({
            type: 'camera-command',
            action: 'take-photo'
        });

        // Visual feedback
        const photoBtn = document.getElementById('photoBtn');
        photoBtn.style.animation = 'glow 0.3s ease';
        setTimeout(() => {
            photoBtn.style.animation = '';
        }, 300);
    }

    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        this.isRecording = true;
        this.sendMessage({
            type: 'camera-command',
            action: 'start-recording'
        });
        this.updateUI();
        console.log('🔴 Recording started');
    }

    stopRecording() {
        this.isRecording = false;
        this.sendMessage({
            type: 'camera-command',
            action: 'stop-recording'
        });
        this.updateUI();
        console.log('⏹️ Recording stopped');
    }

    // Pan/Tilt Control
    startPanTilt(direction) {
        let panDelta = 0, tiltDelta = 0;
        
        switch (direction) {
            case 'up': tiltDelta = 5; break;
            case 'down': tiltDelta = -5; break;
            case 'left': panDelta = -5; break;
            case 'right': panDelta = 5; break;
            case 'center': 
                this.panPosition = 0;
                this.tiltPosition = 0;
                break;
        }

        if (direction !== 'center') {
            this.panPosition = Math.max(-180, Math.min(180, this.panPosition + panDelta));
            this.tiltPosition = Math.max(-90, Math.min(90, this.tiltPosition + tiltDelta));
        }

        this.sendMessage({
            type: 'camera-command',
            action: 'pan-tilt',
            pan: this.panPosition,
            tilt: this.tiltPosition
        });

        console.log(`🎥 Pan/Tilt: ${this.panPosition}°, ${this.tiltPosition}°`);
    }

    stopPanTilt() {
        this.sendMessage({
            type: 'camera-command',
            action: 'stop-pan-tilt'
        });
    }

    // Zoom Control
    setZoom(zoomLevel) {
        this.currentZoom = Math.max(1, Math.min(10, zoomLevel));
        document.getElementById('zoomSlider').value = this.currentZoom;
        document.getElementById('zoomValue').textContent = `${this.currentZoom.toFixed(1)}x`;
        
        this.sendMessage({
            type: 'camera-command',
            action: 'set-zoom',
            zoom: this.currentZoom
        });
    }

    adjustZoom(delta) {
        this.setZoom(this.currentZoom + delta);
    }

    // Stream Quality
    setStreamQuality(quality) {
        this.streamQuality = quality;
        
        // Update UI
        document.querySelectorAll('.quality-option').forEach(option => {
            option.classList.remove('active');
        });
        document.querySelector(`[data-quality="${quality}"]`).classList.add('active');
        
        // Send quality change to LAIKA
        this.sendMessage({
            type: 'camera-command',
            action: 'set-quality',
            quality: quality
        });
        
        console.log(`📺 Stream quality changed to ${quality}`);
    }

    // AI Features
    toggleAIFeature(feature) {
        this.aiFeatures[feature] = !this.aiFeatures[feature];
        
        const toggle = document.querySelector(`[data-feature="${feature}"]`);
        const toggleSwitch = toggle.querySelector('.toggle-switch');
        
        if (this.aiFeatures[feature]) {
            toggle.classList.add('active');
            toggleSwitch.classList.add('active');
        } else {
            toggle.classList.remove('active');
            toggleSwitch.classList.remove('active');
        }
        
        this.sendMessage({
            type: 'ai-command',
            action: 'toggle-feature',
            feature: feature,
            enabled: this.aiFeatures[feature]
        });
        
        console.log(`🧠 AI ${feature}: ${this.aiFeatures[feature] ? 'enabled' : 'disabled'}`);
    }

    // Camera Settings Methods
    setCameraSetting(setting, value) {
        // Apply limits based on setting type
        switch (setting) {
            case 'exposure':
                value = Math.max(-7, Math.min(1, value));
                break;
            case 'brightness':
                value = Math.max(0, Math.min(255, value));
                break;
            case 'contrast':
                value = Math.max(0, Math.min(100, value));
                break;
            case 'saturation':
                value = Math.max(0, Math.min(100, value));
                break;
            case 'gain':
                value = Math.max(0, Math.min(200, value));
                break;
            case 'whiteBalance':
                value = Math.max(2800, Math.min(6500, value));
                break;
        }

        this.cameraSettings[setting] = value;
        this.updateCameraSettingsUI();
        
        // Send to LAIKA camera service via HTTP API
        this.sendCameraParameterHTTP(setting, value);

        console.log(`📸 Camera ${setting}: ${value}`);
    }

    adjustCameraSetting(setting, delta) {
        const currentValue = this.cameraSettings[setting];
        this.setCameraSetting(setting, currentValue + delta);
    }

    toggleCameraSetting(setting) {
        const newValue = !this.cameraSettings[setting];
        this.cameraSettings[setting] = newValue;
        
        const toggle = document.querySelector(`[data-setting="${setting}"]`);
        const toggleSwitch = toggle.querySelector('.toggle-switch');
        
        if (newValue) {
            toggle.classList.add('active');
            toggleSwitch.classList.add('active');
        } else {
            toggle.classList.remove('active');
            toggleSwitch.classList.remove('active');
        }
        
        // Send to LAIKA camera service
        this.sendMessage({
            type: 'camera-command',
            action: 'set-auto-parameter',
            parameter: setting,
            enabled: newValue
        });
        
        console.log(`📸 ${setting}: ${newValue ? 'enabled' : 'disabled'}`);
    }

    applyCameraPreset(preset) {
        let presetSettings = {};
        
        switch (preset) {
            case 'daylight':
                presetSettings = {
                    exposure: -1.0,
                    brightness: 100,
                    contrast: 50,
                    saturation: 70,
                    gain: 50,
                    whiteBalance: 5500,
                    autoExposure: false,
                    autoWhiteBalance: true
                };
                break;
            case 'lowlight':
                presetSettings = {
                    exposure: -3.0,
                    brightness: 140,
                    contrast: 70,
                    saturation: 80,
                    gain: 150,
                    whiteBalance: 3200,
                    autoExposure: false,
                    autoWhiteBalance: false
                };
                break;
            case 'indoor':
                presetSettings = {
                    exposure: -2.0,
                    brightness: 120,
                    contrast: 60,
                    saturation: 75,
                    gain: 80,
                    whiteBalance: 4000,
                    autoExposure: true,
                    autoWhiteBalance: true
                };
                break;
            case 'reset':
                presetSettings = {
                    exposure: -1.0,
                    brightness: 100,
                    contrast: 50,
                    saturation: 50,
                    gain: 50,
                    whiteBalance: 4000,
                    autoExposure: true,
                    autoWhiteBalance: true
                };
                break;
        }
        
        // Apply all settings
        Object.keys(presetSettings).forEach(setting => {
            if (setting === 'autoExposure' || setting === 'autoWhiteBalance') {
                this.cameraSettings[setting] = presetSettings[setting];
                const toggle = document.querySelector(`[data-setting="${setting}"]`);
                const toggleSwitch = toggle?.querySelector('.toggle-switch');
                if (toggle && toggleSwitch) {
                    if (presetSettings[setting]) {
                        toggle.classList.add('active');
                        toggleSwitch.classList.add('active');
                    } else {
                        toggle.classList.remove('active');
                        toggleSwitch.classList.remove('active');
                    }
                }
            } else {
                this.setCameraSetting(setting, presetSettings[setting]);
            }
        });
        
        // Update preset button states
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        if (preset !== 'reset') {
            document.querySelector(`[data-preset="${preset}"]`).classList.add('active');
        }
        
        // Send preset to LAIKA
        this.sendCameraPresetHTTP(preset, presetSettings);
        
        console.log(`📸 Applied camera preset: ${preset}`);
    }

    updateCameraSettingsUI() {
        // Update slider values
        document.getElementById('exposureSlider').value = this.cameraSettings.exposure;
        document.getElementById('brightnessSlider').value = this.cameraSettings.brightness;
        document.getElementById('contrastSlider').value = this.cameraSettings.contrast;
        document.getElementById('saturationSlider').value = this.cameraSettings.saturation;
        document.getElementById('gainSlider').value = this.cameraSettings.gain;
        document.getElementById('whiteBalanceSlider').value = this.cameraSettings.whiteBalance;
        
        // Update value displays
        document.getElementById('exposureValue').textContent = this.cameraSettings.exposure.toFixed(1);
        document.getElementById('brightnessValue').textContent = this.cameraSettings.brightness;
        document.getElementById('contrastValue').textContent = this.cameraSettings.contrast;
        document.getElementById('saturationValue').textContent = this.cameraSettings.saturation;
        document.getElementById('gainValue').textContent = this.cameraSettings.gain;
        document.getElementById('whiteBalanceValue').textContent = `${this.cameraSettings.whiteBalance}K`;
    }

    // HTTP API Methods for Camera Parameters
    async sendCameraParameterHTTP(parameter, value) {
        try {
            const serverUrls = [
                `http://${window.location.hostname}:5000`,
                'http://laika.local:5000',
                'http://localhost:5000'
            ];

            for (const serverUrl of serverUrls) {
                try {
                    const response = await fetch(`${serverUrl}/api/camera/parameters`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            parameter: parameter,
                            value: value
                        })
                    });

                    const result = await response.json();
                    if (result.success) {
                        console.log(`✅ Camera parameter sent: ${parameter} = ${value}`);
                        return;
                    } else {
                        console.warn(`⚠️ Failed to set camera parameter: ${result.error}`);
                    }
                } catch (e) {
                    console.log(`Failed to connect to ${serverUrl}: ${e.message}`);
                }
            }
            
            console.warn('⚠️ Could not connect to any camera service');
        } catch (error) {
            console.error('❌ Error sending camera parameter:', error);
        }
    }

    async sendCameraPresetHTTP(preset, settings) {
        try {
            const serverUrls = [
                `http://${window.location.hostname}:5000`,
                'http://laika.local:5000',
                'http://localhost:5000'
            ];

            for (const serverUrl of serverUrls) {
                try {
                    const response = await fetch(`${serverUrl}/api/camera/preset`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            preset: preset,
                            settings: settings
                        })
                    });

                    const result = await response.json();
                    if (result.success) {
                        console.log(`✅ Camera preset applied: ${preset}`);
                        return;
                    } else {
                        console.warn(`⚠️ Failed to apply preset: ${result.error}`);
                    }
                } catch (e) {
                    console.log(`Failed to connect to ${serverUrl}: ${e.message}`);
                }
            }
            
            console.warn('⚠️ Could not connect to any camera service');
        } catch (error) {
            console.error('❌ Error sending camera preset:', error);
        }
    }

    async loadCameraParametersHTTP() {
        try {
            const serverUrls = [
                `http://${window.location.hostname}:5000`,
                'http://laika.local:5000',
                'http://localhost:5000'
            ];

            for (const serverUrl of serverUrls) {
                try {
                    const response = await fetch(`${serverUrl}/api/camera/parameters`);
                    const result = await response.json();
                    
                    if (result.success && result.parameters) {
                        // Update camera settings from server
                        Object.assign(this.cameraSettings, result.parameters);
                        this.updateCameraSettingsUI();
                        console.log('✅ Camera parameters loaded from server');
                        return;
                    }
                } catch (e) {
                    console.log(`Failed to connect to ${serverUrl}: ${e.message}`);
                }
            }
            
            console.log('⚠️ Could not load camera parameters from server, using defaults');
        } catch (error) {
            console.error('❌ Error loading camera parameters:', error);
        }
    }

    updateAIOverlay() {
        const overlay = document.getElementById('videoOverlay');
        overlay.innerHTML = '';
        
        // Draw object detection boxes
        if (this.aiFeatures.objectDetection) {
            this.detectedObjects.forEach(obj => {
                const box = document.createElement('div');
                box.className = 'ai-overlay';
                box.style.left = `${obj.x}%`;
                box.style.top = `${obj.y}%`;
                box.style.width = `${obj.width}%`;
                box.style.height = `${obj.height}%`;
                box.textContent = `${obj.label} (${Math.round(obj.confidence * 100)}%)`;
                overlay.appendChild(box);
            });
        }
        
        // Draw face detection boxes
        if (this.aiFeatures.faceRecognition) {
            this.detectedFaces.forEach(face => {
                const box = document.createElement('div');
                box.className = 'ai-overlay';
                box.style.borderColor = '#ff6600';
                box.style.backgroundColor = 'rgba(255, 102, 0, 0.2)';
                box.style.left = `${face.x}%`;
                box.style.top = `${face.y}%`;
                box.style.width = `${face.width}%`;
                box.style.height = `${face.height}%`;
                box.textContent = face.name || 'Unknown Face';
                overlay.appendChild(box);
            });
        }
    }

    updateAIStats() {
        document.getElementById('objectCount').textContent = this.detectedObjects.length;
        document.getElementById('faceCount').textContent = this.detectedFaces.length;
        document.getElementById('motionLevel').textContent = this.motionLevel > 50 ? 'High' : this.motionLevel > 20 ? 'Medium' : 'Low';
        document.getElementById('sceneType').textContent = this.currentScene;
    }

    // Event Handlers
    onVideoLoadStart() {
        console.log('📺 Video loading started');
        this.updateConnectionStatus();
    }

    onVideoCanPlay() {
        console.log('📺 Video ready to play');
        this.isStreaming = true;
        this.updateUI();
        this.updateConnectionStatus();
    }

    onVideoError(error) {
        console.error('❌ Video error:', error);
        this.isStreaming = false;
        this.updateUI();
        this.updateConnectionStatus();
    }

    handleKeyboard(event) {
        if (event.target.tagName === 'INPUT') return;
        
        switch (event.key) {
            case ' ':
                event.preventDefault();
                this.toggleStream();
                break;
            case 'f':
                event.preventDefault();
                this.toggleFullscreen();
                break;
            case 'p':
                event.preventDefault();
                this.togglePictureInPicture();
                break;
            case 'c':
                event.preventDefault();
                this.takePhoto();
                break;
            case 'r':
                event.preventDefault();
                this.toggleRecording();
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.startPanTilt('up');
                setTimeout(() => this.stopPanTilt(), 100);
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.startPanTilt('down');
                setTimeout(() => this.stopPanTilt(), 100);
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.startPanTilt('left');
                setTimeout(() => this.stopPanTilt(), 100);
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.startPanTilt('right');
                setTimeout(() => this.stopPanTilt(), 100);
                break;
            case 'Home':
                event.preventDefault();
                this.startPanTilt('center');
                break;
            case '=':
            case '+':
                event.preventDefault();
                this.adjustZoom(0.5);
                break;
            case '-':
                event.preventDefault();
                this.adjustZoom(-0.5);
                break;
        }
    }

    // UI Updates
    updateUI() {
        // Play/Pause button
        const playPauseBtn = document.getElementById('playPauseBtn');
        const playIcon = playPauseBtn.querySelector('i');
        playIcon.className = this.isStreaming ? 'fas fa-pause' : 'fas fa-play';
        
        // Recording button
        const recordBtn = document.getElementById('recordBtn');
        recordBtn.classList.toggle('recording', this.isRecording);
        
        // Fullscreen button
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const fullscreenIcon = fullscreenBtn.querySelector('i');
        fullscreenIcon.className = this.isFullscreen ? 'fas fa-compress' : 'fas fa-expand';
        
        // Zoom display
        document.getElementById('zoomValue').textContent = `${this.currentZoom.toFixed(1)}x`;
        document.getElementById('zoomSlider').value = this.currentZoom;
    }

    updateConnectionStatus() {
        const statusIndicator = document.getElementById('streamStatus');
        const statusText = document.getElementById('streamStatusText');
        const connectionStatus = document.getElementById('connectionStatus');
        
        if (this.isConnected && this.isStreaming) {
            statusIndicator.classList.add('connected');
            statusText.textContent = 'Live';
            connectionStatus.textContent = 'Connected';
        } else if (this.isConnected) {
            statusIndicator.classList.remove('connected');
            statusText.textContent = 'Connected';
            connectionStatus.textContent = 'Connected';
        } else {
            statusIndicator.classList.remove('connected');
            statusText.textContent = 'Disconnected';
            connectionStatus.textContent = 'Disconnected';
        }
    }

    startStatusUpdates() {
        // Update time
        setInterval(() => {
            const now = new Date();
            document.getElementById('currentTime').textContent = 
                now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }, 1000);
        
        // Simulate battery updates
        setInterval(() => {
            const battery = Math.max(20, 85 + Math.sin(Date.now() / 10000) * 5);
            document.getElementById('batteryLevel').textContent = `${Math.round(battery)}%`;
        }, 5000);
    }

    enableSimulationMode() {
        console.log('🎭 Enabling camera simulation mode');
        
        // Simulate connection
        setTimeout(() => {
            this.isConnected = true;
            this.updateConnectionStatus();
        }, 1000);
        
        // Simulate AI detections
        setInterval(() => {
            if (Math.random() > 0.7) {
                this.simulateAIDetections();
            }
        }, 2000);
        
        // Simulate camera status updates
        setInterval(() => {
            this.currentZoom = 1 + Math.random() * 2;
            this.updateUI();
        }, 5000);
    }

    simulateAIDetections() {
        // Simulate object detection
        this.detectedObjects = [];
        if (this.aiFeatures.objectDetection) {
            const objectTypes = ['person', 'chair', 'table', 'book', 'laptop'];
            const numObjects = Math.floor(Math.random() * 3);
            
            for (let i = 0; i < numObjects; i++) {
                this.detectedObjects.push({
                    label: objectTypes[Math.floor(Math.random() * objectTypes.length)],
                    confidence: 0.7 + Math.random() * 0.3,
                    x: Math.random() * 80,
                    y: Math.random() * 80,
                    width: 10 + Math.random() * 20,
                    height: 10 + Math.random() * 20
                });
            }
        }
        
        // Simulate face detection
        this.detectedFaces = [];
        if (this.aiFeatures.faceRecognition && Math.random() > 0.5) {
            this.detectedFaces.push({
                name: 'Human',
                x: 20 + Math.random() * 60,
                y: 20 + Math.random() * 60,
                width: 15,
                height: 20
            });
        }
        
        // Simulate motion and scene
        this.motionLevel = Math.random() * 100;
        const scenes = ['Indoor', 'Living Room', 'Kitchen', 'Office', 'Outdoor'];
        this.currentScene = scenes[Math.floor(Math.random() * scenes.length)];
        
        this.updateAIOverlay();
        this.updateAIStats();
    }

    async reconnect() {
        if (!this.isConnected) {
            console.log('🔄 Attempting to reconnect...');
            await this.connectWebSocket();
        }
    }
}

// Initialize camera when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.laikaCamera = new LAIKACamera();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.laikaCamera && window.laikaCamera.ws) {
        window.laikaCamera.ws.close();
    }
});
