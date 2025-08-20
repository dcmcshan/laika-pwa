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
        this.audioEnabled = false;
        this.microphoneEnabled = false;
        this.audioStream = null;
        this.microphoneStream = null;
        this.aiFeatures = {
            objectDetection: false,
            faceRecognition: false,
            motionTracking: false,
            sceneAnalysis: false
        };
        
        // Audio features
        this.audioFeatures = {
            audioStream: false,
            microphoneInput: false,
            voiceActivation: false,
            noiseCancellation: false
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
        
        // Audio settings
        this.audioSettings = {
            volume: 80,
            micGain: 50,
            sampleRate: 48000,
            channels: 2,
            latency: 50
        };
        
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
        
        // Auto-start camera stream on page load
        await this.autoStartStream();
        
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
        document.getElementById('speakerBtn').addEventListener('click', () => this.toggleSpeaker());
        document.getElementById('talkBtn').addEventListener('click', () => this.togglePushToTalk());

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
                toggle.addEventListener('click', (e) => this.toggleFeature(e.currentTarget.dataset.feature));
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

        // Audio controls
        document.getElementById('volumeSlider')?.addEventListener('input', (e) => this.setVolume(parseInt(e.target.value)));
        document.getElementById('volumeUpBtn')?.addEventListener('click', () => this.adjustVolume(5));
        document.getElementById('volumeDownBtn')?.addEventListener('click', () => this.adjustVolume(-5));
        document.getElementById('micGainSlider')?.addEventListener('input', (e) => this.setMicGain(parseInt(e.target.value)));
        document.getElementById('micGainUpBtn')?.addEventListener('click', () => this.adjustMicGain(5));
        document.getElementById('micGainDownBtn')?.addEventListener('click', () => this.adjustMicGain(-5));

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
        // For ngrok environment, we'll use HTTP streaming instead of WebSocket
        console.log('🌐 Connecting to LAIKA camera service via ngrok...');
        
        try {
            // Use the correct server URL
            const baseUrl = this.getServerUrl();
            
            // Test camera status
            const response = await fetch(`${baseUrl}/api/camera/status`);
            if (response.ok) {
                const status = await response.json();
                console.log('✅ Camera service connected:', status);
                this.isConnected = true;
                this.baseUrl = baseUrl;
                this.updateConnectionStatus();
                
                // Start HTTP streaming instead of WebRTC
                this.startHttpStream();
                return;
            }
        } catch (error) {
            console.log('❌ Failed to connect to camera service:', error.message);
        }
        
        // Fallback to WebSocket for local development
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

    startHttpStream() {
        try {
            console.log('📺 Starting HTTP camera stream...');
            const video = document.getElementById('videoStream');
            
            // For ngrok HTTPS, we need to use the same protocol and host
            const isNgrok = window.location.hostname.includes('ngrok');
            const streamUrl = isNgrok ? 
                `${window.location.origin}/camera/stream` : 
                `${this.baseUrl}/camera/stream`;
            
            console.log(`🔗 Stream URL: ${streamUrl}`);
            
            // For HTTP streaming, we'll use an img element instead of video
            if (video.tagName === 'VIDEO') {
                // Replace video with img for MJPEG stream
                const img = document.createElement('img');
                img.id = 'videoStream';
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'cover';
                img.style.background = 'linear-gradient(45deg, #1a1a1a, #2a2a2a)';
                
                img.onload = () => {
                    console.log('✅ Camera stream started');
                    this.isStreaming = true;
                    this.updateUI();
                    this.updateConnectionStatus();
                };
                
                img.onerror = (error) => {
                    console.error('❌ Failed to load camera stream:', error);
                    console.log('🔄 Trying alternative stream methods...');
                    this.enableSimulationMode();
                };
                
                img.src = streamUrl;
                video.parentNode.replaceChild(img, video);
            } else {
                // Already an img element, just update src
                video.src = streamUrl;
                this.isStreaming = true;
                this.updateUI();
                this.updateConnectionStatus();
            }
            
        } catch (error) {
            console.error('❌ HTTP stream initialization failed:', error);
            this.enableSimulationMode();
        }
    }

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
            if (video.tagName === 'VIDEO' && video.pause) {
                video.pause();
            } else if (video.tagName === 'IMG') {
                // For IMG element, hide it to simulate pause
                video.style.opacity = '0.5';
                video.style.filter = 'grayscale(100%)';
            }
        }
        this.isStreaming = false;
        this.updateUI();
        this.updateConnectionStatus();
        console.log('⏸️ Stream paused');
    }

    resumeStream() {
        const video = document.getElementById('videoStream');
        if (video) {
            if (video.tagName === 'VIDEO' && video.play) {
                video.play().catch(error => {
                    console.error('❌ Failed to resume stream:', error);
                });
            } else if (video.tagName === 'IMG') {
                // For IMG element, restore normal appearance and refresh stream
                video.style.opacity = '1';
                video.style.filter = 'none';
                if (this.baseUrl) {
                    const timestamp = Date.now();
                    video.src = `${this.baseUrl}/camera/stream?t=${timestamp}`;
                }
            }
        }
        this.isStreaming = true;
        this.updateUI();
        this.updateConnectionStatus();
        console.log('▶️ Stream resumed');
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

    toggleSpeaker() {
        this.audioEnabled = !this.audioEnabled;
        
        if (this.audioEnabled) {
            this.startAudioStream();
        } else {
            this.stopAudioStream();
        }
        
        this.updateUI();
        console.log(`🔊 Speaker ${this.audioEnabled ? 'enabled' : 'disabled'}`);
    }

    togglePushToTalk() {
        // Toggle push-to-talk mode
        console.log('📻 Push-to-talk activated');
        // Implementation for push-to-talk functionality
    }

    async startAudioStream() {
        try {
            const audio = document.getElementById('audioStream');
            if (audio) {
                console.log('🎵 Starting audio stream...');
                
                // Use Server-Sent Events for audio streaming to avoid STT conflicts
                this.audioEventSource = new EventSource(`${this.getServerUrl()}/api/audio/stream`);
                
                // Create Web Audio API context for audio processing
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.audioGainNode = this.audioContext.createGain();
                this.audioGainNode.gain.value = this.audioSettings.volume / 100;
                
                // Create audio buffer source
                this.audioBuffer = [];
                this.isAudioPlaying = false;
                
                this.audioEventSource.onmessage = (event) => {
                    try {
                        const audioData = event.data;
                        
                        // Skip error messages
                        if (audioData.startsWith('error')) {
                            console.warn('Audio stream error:', audioData);
                            return;
                        }
                        
                        // Decode base64 audio data
                        const binaryData = atob(audioData);
                        const audioBytes = new Uint8Array(binaryData.length);
                        for (let i = 0; i < binaryData.length; i++) {
                            audioBytes[i] = binaryData.charCodeAt(i);
                        }
                        
                        // Convert to audio buffer and play
                        this.playAudioChunk(audioBytes);
                        
                    } catch (error) {
                        console.warn('Audio processing error:', error);
                    }
                };
                
                this.audioEventSource.onerror = (error) => {
                    console.error('❌ Audio stream connection error:', error);
                    // Try to reconnect after a delay
                    setTimeout(() => {
                        if (this.audioEnabled) {
                            this.startAudioStream();
                        }
                    }, 2000);
                };
                
                this.audioEnabled = true;
                this.audioStream = audio;
                console.log('✅ Audio stream started with SSE');
            }
        } catch (error) {
            console.error('❌ Failed to start audio stream:', error);
        }
    }
    
    playAudioChunk(audioBytes) {
        try {
            if (!this.audioContext || this.audioContext.state === 'closed') {
                return;
            }
            
            // Convert raw PCM data to AudioBuffer
            const samples = audioBytes.length / 4; // 16-bit stereo = 4 bytes per sample
            const audioBuffer = this.audioContext.createBuffer(2, samples / 2, 48000);
            
            // Convert bytes to float samples
            const leftChannel = audioBuffer.getChannelData(0);
            const rightChannel = audioBuffer.getChannelData(1);
            
            for (let i = 0; i < samples / 2; i++) {
                // Little-endian 16-bit samples
                const leftSample = (audioBytes[i * 4 + 1] << 8) | audioBytes[i * 4];
                const rightSample = (audioBytes[i * 4 + 3] << 8) | audioBytes[i * 4 + 2];
                
                // Convert to float [-1, 1]
                leftChannel[i] = leftSample < 32768 ? leftSample / 32768 : (leftSample - 65536) / 32768;
                rightChannel[i] = rightSample < 32768 ? rightSample / 32768 : (rightSample - 65536) / 32768;
            }
            
            // Create buffer source and play
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioGainNode);
            this.audioGainNode.connect(this.audioContext.destination);
            source.start();
            
        } catch (error) {
            console.warn('Audio playback error:', error);
        }
    }

    stopAudioStream() {
        try {
            // Close Server-Sent Events connection
            if (this.audioEventSource) {
                this.audioEventSource.close();
                this.audioEventSource = null;
            }
            
            // Close Web Audio API context
            if (this.audioContext && this.audioContext.state !== 'closed') {
                this.audioContext.close();
                this.audioContext = null;
            }
            
            // Clean up audio elements
            const audio = document.getElementById('audioStream');
            if (audio) {
                audio.pause();
                audio.src = '';
            }
            
            this.audioStream = null;
            this.audioEnabled = false;
            this.audioGainNode = null;
            this.isAudioPlaying = false;
            
            console.log('🔇 Audio stream stopped and cleaned up');
            
        } catch (error) {
            console.error('Error stopping audio stream:', error);
        }
    }

    async startMicrophoneInput() {
        try {
            this.microphoneStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: this.audioSettings.sampleRate,
                    channelCount: this.audioSettings.channels,
                    echoCancellation: this.audioFeatures.noiseCancellation,
                    noiseSuppression: this.audioFeatures.noiseCancellation
                } 
            });
            
            // Send microphone data to LAIKA via WebRTC or WebSocket
            this.sendMicrophoneData();
            console.log('🎤 Microphone input started');
        } catch (error) {
            console.error('❌ Failed to access microphone:', error);
        }
    }

    stopMicrophoneInput() {
        if (this.microphoneStream) {
            this.microphoneStream.getTracks().forEach(track => track.stop());
            this.microphoneStream = null;
            console.log('🎤 Microphone input stopped');
        }
    }

    sendMicrophoneData() {
        // Implementation to send microphone data to LAIKA
        // This would typically use WebRTC data channels or WebSocket
        if (this.microphoneStream) {
            // Create audio context for processing
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(this.microphoneStream);
            
            // Add audio processing here (gain, filters, etc.)
            const gainNode = audioContext.createGain();
            gainNode.gain.value = this.audioSettings.micGain / 100;
            
            source.connect(gainNode);
            // Connect to WebRTC or WebSocket for transmission
        }
    }

    setVolume(volume) {
        this.audioSettings.volume = Math.max(0, Math.min(100, volume));
        
        const audio = document.getElementById('audioStream');
        if (audio) {
            audio.volume = this.audioSettings.volume / 100;
        }
        
        this.updateAudioSettingsUI();
        console.log(`🔊 Volume set to ${this.audioSettings.volume}%`);
    }

    adjustVolume(delta) {
        this.setVolume(this.audioSettings.volume + delta);
    }

    setMicGain(gain) {
        this.audioSettings.micGain = Math.max(0, Math.min(100, gain));
        this.updateAudioSettingsUI();
        
        // Apply gain to microphone input if active
        if (this.microphoneStream) {
            this.sendMicrophoneData(); // Reapply gain
        }
        
        console.log(`🎤 Microphone gain set to ${this.audioSettings.micGain}%`);
    }

    adjustMicGain(delta) {
        this.setMicGain(this.audioSettings.micGain + delta);
    }

    updateAudioSettingsUI() {
        // Update volume slider and display
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');
        if (volumeSlider) volumeSlider.value = this.audioSettings.volume;
        if (volumeValue) volumeValue.textContent = `${this.audioSettings.volume}%`;
        
        // Update mic gain slider and display
        const micGainSlider = document.getElementById('micGainSlider');
        const micGainValue = document.getElementById('micGainValue');
        if (micGainSlider) micGainSlider.value = this.audioSettings.micGain;
        if (micGainValue) micGainValue.textContent = `${this.audioSettings.micGain}%`;
    }

    toggleFeature(featureName) {
        // Handle both AI and audio features
        if (featureName in this.aiFeatures) {
            this.aiFeatures[featureName] = !this.aiFeatures[featureName];
            console.log(`🧠 AI Feature ${featureName}: ${this.aiFeatures[featureName] ? 'ON' : 'OFF'}`);
            
            // Send AI feature command to server
            this.sendMessage({
                type: 'ai-feature',
                feature: featureName,
                enabled: this.aiFeatures[featureName]
            });
        } else if (featureName in this.audioFeatures) {
            this.audioFeatures[featureName] = !this.audioFeatures[featureName];
            console.log(`🎵 Audio Feature ${featureName}: ${this.audioFeatures[featureName] ? 'ON' : 'OFF'}`);
            
            // Handle specific audio features
            switch (featureName) {
                case 'audioStream':
                    if (this.audioFeatures.audioStream) {
                        this.startAudioStream();
                    } else {
                        this.stopAudioStream();
                    }
                    break;
                case 'microphoneInput':
                    if (this.audioFeatures.microphoneInput) {
                        this.startMicrophoneInput();
                    } else {
                        this.stopMicrophoneInput();
                    }
                    break;
                case 'voiceActivation':
                    // Handle voice activation toggle
                    this.sendMessage({
                        type: 'audio-feature',
                        feature: 'voice-activation',
                        enabled: this.audioFeatures.voiceActivation
                    });
                    break;
                case 'noiseCancellation':
                    // Update microphone settings if active
                    if (this.microphoneStream) {
                        this.stopMicrophoneInput();
                        this.startMicrophoneInput(); // Restart with new settings
                    }
                    break;
            }
        }
        
        this.updateFeatureUI();
    }

    updateFeatureUI() {
        // Update AI feature toggles
        Object.entries(this.aiFeatures).forEach(([feature, enabled]) => {
            const toggle = document.querySelector(`[data-feature="${feature}"]`);
            if (toggle) {
                const switchElement = toggle.querySelector('.toggle-switch');
                if (switchElement) {
                    switchElement.classList.toggle('active', enabled);
                }
                toggle.classList.toggle('active', enabled);
            }
        });
        
        // Update audio feature toggles
        Object.entries(this.audioFeatures).forEach(([feature, enabled]) => {
            const toggle = document.querySelector(`[data-feature="${feature}"]`);
            if (toggle) {
                const switchElement = toggle.querySelector('.toggle-switch');
                if (switchElement) {
                    switchElement.classList.toggle('active', enabled);
                }
                toggle.classList.toggle('active', enabled);
            }
        });
        
        // Update audio stats
        this.updateAudioStats();
    }

    updateAudioStats() {
        // Update audio level indicators (would be updated from actual audio analysis)
        document.getElementById('audioLevel').textContent = this.audioEnabled ? '0 dB' : 'Off';
        document.getElementById('micLevel').textContent = this.microphoneEnabled ? '0 dB' : 'Off';
        document.getElementById('audioQuality').textContent = `${this.audioSettings.sampleRate/1000}kHz`;
        document.getElementById('audioLatency').textContent = `< ${this.audioSettings.latency}ms`;
    }

    async autoStartStream() {
        console.log('🚀 Auto-starting camera stream...');
        
        try {
            // Start the video stream automatically
            const video = document.getElementById('videoStream');
            if (video) {
                // Use the correct stream endpoint
                const streamUrl = `${this.getServerUrl()}/camera/stream`;
                console.log(`🔗 Auto-starting stream with URL: ${streamUrl}`);
                
                // For HTTPS/ngrok, we need to use an img element for MJPEG
                if (window.location.protocol === 'https:') {
                    // Replace video with img for MJPEG stream
                    const img = document.createElement('img');
                    img.id = 'videoStream';
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'cover';
                    img.style.background = 'linear-gradient(45deg, #1a1a1a, #2a2a2a)';
                    
                    img.onload = () => {
                        console.log('✅ Camera stream started');
                        this.isStreaming = true;
                        this.updateUI();
                        this.updateConnectionStatus();
                    };
                    
                    img.onerror = (error) => {
                        console.error('❌ Failed to load camera stream:', error);
                        this.enableSimulationMode();
                    };
                    
                    img.src = streamUrl;
                    video.parentNode.replaceChild(img, video);
                } else {
                    // HTTP - use video element
                    video.src = streamUrl;
                }
                
                // Update UI to show streaming state
                this.isStreaming = true;
                this.updateUI();
                this.updateConnectionStatus();
                
                // Update play/pause button to show pause icon
                const playPauseBtn = document.getElementById('playPauseBtn');
                if (playPauseBtn) {
                    const icon = playPauseBtn.querySelector('i');
                    if (icon) {
                        icon.className = 'fas fa-pause';
                    }
                }
                
                console.log('✅ Camera stream auto-started');
            }
        } catch (error) {
            console.error('❌ Failed to auto-start camera stream:', error);
        }
    }

    getServerUrl() {
        // Return the server URL for API calls
        // For ngrok, use the same origin (no port needed)
        const isNgrok = window.location.hostname.includes('ngrok');
        return isNgrok ? window.location.origin : `${window.location.protocol}//${window.location.hostname}:5000`;
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
                this.getServerUrl(),  // Use the correct server URL for ngrok
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
                this.getServerUrl(),  // Use the correct server URL for ngrok
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
                this.getServerUrl(),  // Use the correct server URL for ngrok
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
        const videoStatus = document.getElementById('videoStatus');
        const audioStatus = document.getElementById('audioStatus');
        const statusText = document.getElementById('streamStatusText');
        const connectionStatus = document.getElementById('connectionStatus');
        
        if (this.isConnected && this.isStreaming) {
            if (videoStatus) {
                videoStatus.classList.remove('disconnected', 'connecting');
                videoStatus.classList.add('connected');
            }
            if (audioStatus) {
                audioStatus.classList.remove('disconnected', 'connecting');
                audioStatus.classList.add(this.audioEnabled ? 'connected' : 'disconnected');
            }
            if (statusText) statusText.textContent = 'Live Stream';
            if (connectionStatus) connectionStatus.textContent = 'Connected';
        } else if (this.isConnected) {
            if (videoStatus) {
                videoStatus.classList.remove('disconnected', 'connected');
                videoStatus.classList.add('connecting');
            }
            if (audioStatus) {
                audioStatus.classList.remove('connected', 'connecting');
                audioStatus.classList.add('disconnected');
            }
            if (statusText) statusText.textContent = 'Connected';
            if (connectionStatus) connectionStatus.textContent = 'Connected';
        } else {
            if (videoStatus) {
                videoStatus.classList.remove('connected', 'connecting');
                videoStatus.classList.add('disconnected');
            }
            if (audioStatus) {
                audioStatus.classList.remove('connected', 'connecting');
                audioStatus.classList.add('disconnected');
            }
            if (statusText) statusText.textContent = 'Disconnected';
            if (connectionStatus) connectionStatus.textContent = 'Disconnected';
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
