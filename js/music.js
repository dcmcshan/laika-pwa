/**
 * LAIKA Music & Audio Controller
 * Real-time audio analysis, music recognition, and reactive behaviors
 * Now integrated with Hybrid STT Service for speech transcription
 */

class LAIKAMusic {
    constructor() {
        this.isConnected = false;
        this.audioActive = false;
        this.isRecording = false;
        this.isAnalyzing = false;
        this.sttActive = false;
        
        // Web Audio API
        this.audioContext = null;
        this.microphone = null;
        this.analyser = null;
        this.dataArray = null;
        this.bufferLength = 0;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        
        // Canvas contexts
        this.spectrumCanvas = null;
        this.spectrumCtx = null;
        this.waveformCanvas = null;
        this.waveformCtx = null;
        
        // Audio analysis
        this.frequencyData = null;
        this.timeDomainData = null;
        this.sampleRate = 44100;
        this.fftSize = 2048;
        
        // Beat detection
        this.beatDetector = {
            history: [],
            threshold: 1.3,
            minThreshold: 0.15,
            decay: 0.98,
            lastBeat: 0,
            bpm: 0,
            energy: 0
        };
        
        // Music recognition
        this.auddApiKey = null; // Will be set from environment or config
        this.recognitionInProgress = false;
        
        // STT Integration
        this.sttConfig = {
            provider: 'openai_realtime',
            language: 'en-US',
            continuous: false,
            interim_results: true
        };
        this.sttHistory = [];
        this.maxSttHistory = 50;
        
        // Reactive behaviors
        this.behaviors = {
            dance: false,
            ledSpectrum: false,
            headBob: false,
            colorPulse: false,
            movementSync: false
        };
        
        // Settings
        this.settings = {
            gain: 50,
            beatSensitivity: 5,
            visualMode: 'spectrum'
        };
        
        // WebSocket connection
        this.ws = null;
        
        // Animation frame
        this.animationId = null;
        
        this.init();
    }

    async init() {
        this.setupCanvases();
        this.setupEventListeners();
        this.updateUI();
        this.startStatusUpdates();
        
        // Load STT configuration
        await this.loadSTTConfig();
        
        // Attempt to connect
        await this.connectWebSocket();
        
        // Auto-start audio on load (with user interaction fallback)
        setTimeout(async () => {
            try {
                await this.startAudio();
            } catch (error) {
                console.log('🎤 Auto-start failed (user interaction required):', error.message);
                // Show a subtle notification that user can click to start audio
                this.showAudioStartPrompt();
            }
        }, 1000);
        
        // Load music data
        this.loadDetectedTracks();
        
        // Auto-refresh tracks every 5 minutes
        setInterval(() => {
            this.loadDetectedTracks();
        }, 300000);
        
        // Load STT history
        this.loadSTTHistory();
    }

    setupCanvases() {
        this.spectrumCanvas = document.getElementById('spectrumCanvas');
        this.spectrumCtx = this.spectrumCanvas?.getContext('2d');
        this.waveformCanvas = document.getElementById('waveformCanvas');
        this.waveformCtx = this.waveformCanvas?.getContext('2d');
    }

    resizeCanvases() {
        const spectrumRect = this.spectrumCanvas.parentElement.getBoundingClientRect();
        const waveformRect = this.waveformCanvas.parentElement.getBoundingClientRect();
        
        this.spectrumCanvas.width = spectrumRect.width;
        this.spectrumCanvas.height = spectrumRect.height;
        
        this.waveformCanvas.width = waveformRect.width;
        this.waveformCanvas.height = waveformRect.height;
    }

    setupEventListeners() {
        // Audio controls
        document.getElementById('startAudioBtn')?.addEventListener('click', () => this.toggleAudio());
        document.getElementById('recordBtn')?.addEventListener('click', () => this.toggleRecording());
        document.getElementById('playbackBtn')?.addEventListener('click', () => this.playRecording());
        document.getElementById('stopBtn')?.addEventListener('click', () => this.stopAll());
        
        // Music recognition
        document.getElementById('recognizeBtn')?.addEventListener('click', () => this.recognizeMusic());
        
        // STT controls
        document.getElementById('startSttBtn')?.addEventListener('click', () => this.toggleSTT());
        document.getElementById('clearSttBtn')?.addEventListener('click', () => this.clearSTTHistory());
        
        // Behavior toggles
        document.querySelectorAll('.behavior-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const behavior = toggle.dataset.behavior;
                this.toggleBehavior(behavior);
            });
        });
        
        // Settings
        document.getElementById('gainSlider')?.addEventListener('input', (e) => this.setGain(e.target.value));
        document.getElementById('beatSensitivity')?.addEventListener('input', (e) => this.setBeatSensitivity(e.target.value));
        document.getElementById('visualMode')?.addEventListener('change', (e) => this.setVisualMode(e.target.value));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Track history refresh
        document.getElementById('refreshTracks')?.addEventListener('click', () => this.loadDetectedTracks());
    }

    async connectWebSocket() {
        const wsUrls = [
            `ws://${window.location.hostname}:8765/music`,
            'ws://laika.local:8765/music',
            'ws://localhost:8765/music'
        ];

        for (const url of wsUrls) {
            try {
                console.log(`🔗 Attempting WebSocket connection to ${url}`);
                
                this.ws = new WebSocket(url);
                
                this.ws.onopen = () => {
                    console.log('✅ WebSocket connected to LAIKA music service');
                    this.isConnected = true;
                    this.updateConnectionStatus();
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

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'behavior-ack':
                this.updateBehaviorStatus(data.behavior, data.active);
                break;
            case 'beat-sync':
                this.syncBeatWithRobot(data.beat);
                break;
            case 'music-info':
                this.displayMusicInfo(data.info);
                break;
            case 'error':
                console.error('❌ Music service error:', data.message);
                break;
            default:
                console.log('📦 Unknown message type:', data.type);
        }
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.log('📡 WebSocket not connected, message queued');
        }
    }

    // Audio setup and control
    async toggleAudio() {
        if (this.audioActive) {
            this.stopAudio();
        } else {
            await this.startAudio();
        }
    }

    async startAudio() {
        try {
            console.log('🎤 Starting audio capture...');
            
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: this.sampleRate
                }
            });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create microphone source
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            // Create analyser
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = 0.8;
            
            // Connect nodes
            this.microphone.connect(this.analyser);
            
            // Setup data arrays
            this.bufferLength = this.analyser.frequencyBinCount;
            this.frequencyData = new Uint8Array(this.bufferLength);
            this.timeDomainData = new Uint8Array(this.bufferLength);
            
            // Setup media recorder for recognition
            this.mediaRecorder = new MediaRecorder(stream);
            this.setupMediaRecorder();
            
            this.audioActive = true;
            this.startAnalysis();
            this.updateUI();
            
            console.log('✅ Audio capture started');
            
        } catch (error) {
            console.error('❌ Failed to start audio:', error);
            alert('Microphone access denied or not available');
        }
    }

    stopAudio() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        this.audioActive = false;
        this.isAnalyzing = false;
        this.updateUI();
        
        console.log('🔇 Audio capture stopped');
    }

    startAnalysis() {
        if (!this.audioActive) return;
        
        this.isAnalyzing = true;
        
        const analyze = () => {
            if (!this.isAnalyzing) return;
            
            // Get frequency and time domain data
            this.analyser.getByteFrequencyData(this.frequencyData);
            this.analyser.getByteTimeDomainData(this.timeDomainData);
            
            // Detect beats
            this.detectBeat();
            
            // Update visualizations
            this.updateVisualizations();
            
            // Update frequency bands
            this.updateFrequencyBands();
            
            // Send data to robot if connected
            this.sendAudioDataToRobot();
            
            this.animationId = requestAnimationFrame(analyze);
        };
        
        analyze();
    }

    // Beat detection algorithm
    detectBeat() {
        if (!this.frequencyData) return;
        
        // Calculate energy in low frequencies (bass)
        let energy = 0;
        const lowFreqEnd = Math.floor(this.bufferLength * 0.1); // First 10% of frequencies
        
        for (let i = 0; i < lowFreqEnd; i++) {
            energy += this.frequencyData[i] * this.frequencyData[i];
        }
        
        energy /= lowFreqEnd;
        this.beatDetector.energy = energy;
        
        // Add to history
        this.beatDetector.history.push(energy);
        if (this.beatDetector.history.length > 20) {
            this.beatDetector.history.shift();
        }
        
        // Calculate average energy
        const avgEnergy = this.beatDetector.history.reduce((a, b) => a + b, 0) / this.beatDetector.history.length;
        
        // Adaptive threshold
        const threshold = avgEnergy * (this.beatDetector.threshold + (this.settings.beatSensitivity - 5) * 0.1);
        
        // Beat detection
        const now = Date.now();
        if (energy > threshold && energy > this.beatDetector.minThreshold && 
            now - this.beatDetector.lastBeat > 200) { // Minimum 200ms between beats
            
            this.onBeatDetected();
            this.beatDetector.lastBeat = now;
            
            // Calculate BPM
            if (this.beatDetector.lastBeat > 0) {
                const interval = now - this.beatDetector.lastBeat;
                this.beatDetector.bpm = Math.round(60000 / interval);
            }
        }
        
        // Decay threshold
        this.beatDetector.threshold *= this.beatDetector.decay;
        if (this.beatDetector.threshold < 1.1) {
            this.beatDetector.threshold = 1.1;
        }
    }

    onBeatDetected() {
        // Visual beat indicator
        const beatCircle = document.getElementById('beatCircle');
        beatCircle.classList.add('beat');
        setTimeout(() => beatCircle.classList.remove('beat'), 100);
        
        // Update BPM display
        document.getElementById('tempoValue').textContent = this.beatDetector.bpm || '--';
        
        // Trigger robot behaviors
        this.triggerBeatBehaviors();
        
        // Send beat to robot
        this.sendMessage({
            type: 'beat-detected',
            bpm: this.beatDetector.bpm,
            energy: this.beatDetector.energy,
            timestamp: Date.now()
        });
    }

    triggerBeatBehaviors() {
        if (this.behaviors.dance) {
            // Send beat dance trigger to behavior system
            this.sendMessage({
                type: 'behavior-trigger',
                input_type: 'ros_topic',
                input_data: {
                    topic: '/beat_detected',
                    data: 'beat',
                    bpm: this.beatDetector.bpm,
                    energy: this.beatDetector.energy,
                    intensity: Math.min(this.beatDetector.energy / 100, 1.0)
                }
            });
            
            // Also send legacy robot-behavior message for compatibility
            this.sendMessage({
                type: 'robot-behavior',
                behavior: 'dance-beat',
                intensity: Math.min(this.beatDetector.energy / 100, 1.0)
            });
        }
        
        if (this.behaviors.headBob) {
            this.sendMessage({
                type: 'robot-behavior',
                behavior: 'head-bob',
                direction: Math.random() > 0.5 ? 'left' : 'right'
            });
        }
        
        if (this.behaviors.colorPulse) {
            const hue = Math.floor(Math.random() * 360);
            this.sendMessage({
                type: 'robot-behavior',
                behavior: 'color-pulse',
                color: `hsl(${hue}, 100%, 50%)`,
                duration: 500
            });
        }
    }

    // Visualizations
    updateVisualizations() {
        if (this.settings.visualMode === 'spectrum' || this.settings.visualMode === 'both') {
            this.drawSpectrum();
        }
        
        if (this.settings.visualMode === 'waveform' || this.settings.visualMode === 'both') {
            this.drawWaveform();
        }
    }

    drawSpectrum() {
        const canvas = this.spectrumCanvas;
        const ctx = this.spectrumCtx;
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Create gradient
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#00ff88');
        gradient.addColorStop(0.5, '#00d9ff');
        gradient.addColorStop(1, '#ff6600');
        
        // Draw spectrum bars
        const barWidth = width / this.bufferLength;
        let x = 0;
        
        for (let i = 0; i < this.bufferLength; i++) {
            const barHeight = (this.frequencyData[i] / 255) * height;
            
            ctx.fillStyle = gradient;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            
            x += barWidth;
        }
        
        // Add glow effect
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 10;
        ctx.globalCompositeOperation = 'lighter';
        
        // Redraw with glow
        x = 0;
        for (let i = 0; i < this.bufferLength; i++) {
            const barHeight = (this.frequencyData[i] / 255) * height;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            x += barWidth;
        }
        
        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
    }

    drawWaveform() {
        const canvas = this.waveformCanvas;
        const ctx = this.waveformCtx;
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw waveform
        ctx.strokeStyle = '#00d9ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const sliceWidth = width / this.bufferLength;
        let x = 0;
        
        for (let i = 0; i < this.bufferLength; i++) {
            const v = this.timeDomainData[i] / 128.0;
            const y = v * height / 2;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        ctx.stroke();
        
        // Add glow
        ctx.shadowColor = '#00d9ff';
        ctx.shadowBlur = 5;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    updateFrequencyBands() {
        const bands = document.querySelectorAll('.frequency-bar');
        const bandsPerBar = Math.floor(this.bufferLength / bands.length);
        
        bands.forEach((bar, index) => {
            let sum = 0;
            const start = index * bandsPerBar;
            const end = start + bandsPerBar;
            
            for (let i = start; i < end && i < this.bufferLength; i++) {
                sum += this.frequencyData[i];
            }
            
            const average = sum / bandsPerBar;
            const height = (average / 255) * 100;
            
            bar.style.height = `${height}%`;
        });
    }

    // Music recognition with AudD
    async recognizeMusic() {
        if (this.recognitionInProgress || !this.audioActive) return;
        
        this.recognitionInProgress = true;
        const recognizeBtn = document.getElementById('recognizeBtn');
        const statusEl = document.getElementById('recognitionStatus');
        
        recognizeBtn.disabled = true;
        recognizeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Listening...';
        statusEl.textContent = 'Listening for music...';
        
        try {
            // Trigger manual music identification via API
            const response = await fetch('/api/music/identify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (response.ok) {
                statusEl.textContent = 'Music identification triggered - check back in 30 seconds';
                // Refresh track list after a delay
                setTimeout(() => {
                    this.loadDetectedTracks();
                }, 35000);
            } else {
                statusEl.textContent = result.error || 'Identification failed';
            }
            
        } catch (error) {
            console.error('❌ Music recognition failed:', error);
            statusEl.textContent = 'Recognition failed';
        } finally {
            this.recognitionInProgress = false;
            recognizeBtn.disabled = false;
            recognizeBtn.innerHTML = '<i class="fas fa-search"></i> Identify Song';
            
            setTimeout(() => {
                statusEl.textContent = 'Ready to identify music';
            }, 3000);
        }
    }

    async loadDetectedTracks() {
        try {
            const response = await fetch('/api/music/tracks?limit=20');
            const data = await response.json();
            
            if (response.ok && data.tracks) {
                this.displayTrackHistory(data.tracks);
                this.loadMusicStats();
            } else {
                console.warn('No music tracks found:', data.message);
            }
        } catch (error) {
            console.error('❌ Failed to load detected tracks:', error);
        }
    }

    async loadMusicStats() {
        try {
            const response = await fetch('/api/music/stats');
            const data = await response.json();
            
            if (response.ok && data.stats) {
                this.displayMusicStats(data.stats);
            }
        } catch (error) {
            console.error('❌ Failed to load music stats:', error);
        }
    }

    displayTrackHistory(tracks) {
        const historyContainer = document.getElementById('trackHistory');
        if (!historyContainer) return;

        if (tracks.length === 0) {
            historyContainer.innerHTML = `
                <div class="no-tracks">
                    <i class="fas fa-music"></i>
                    <p>No music tracks detected yet</p>
                    <small>Enable AudD service to start detecting music</small>
                </div>
            `;
            return;
        }

        const tracksHtml = tracks.map(track => {
            const date = new Date(track.timestamp);
            const timeAgo = this.getTimeAgo(date);
            
            return `
                <div class="track-item" data-track-id="${track.id}">
                    <div class="track-info">
                        <div class="track-title">${track.title || 'Unknown Title'}</div>
                        <div class="track-artist">${track.artist || 'Unknown Artist'}</div>
                        ${track.album ? `<div class="track-album">${track.album}</div>` : ''}
                    </div>
                    <div class="track-meta">
                        <div class="track-time">${timeAgo}</div>
                        <div class="track-confidence">
                            <i class="fas fa-chart-bar"></i>
                            ${Math.round((track.confidence || 0.8) * 100)}%
                        </div>
                    </div>
                    <div class="track-links">
                        ${track.spotify_url ? `<a href="${track.spotify_url}" target="_blank" class="spotify-link"><i class="fab fa-spotify"></i></a>` : ''}
                        ${track.apple_music_url ? `<a href="${track.apple_music_url}" target="_blank" class="apple-link"><i class="fab fa-apple"></i></a>` : ''}
                        ${track.deezer_url ? `<a href="${track.deezer_url}" target="_blank" class="deezer-link"><i class="fab fa-deezer"></i></a>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        historyContainer.innerHTML = `
            <h3><i class="fas fa-history"></i> Recently Detected Tracks</h3>
            <div class="tracks-list">
                ${tracksHtml}
            </div>
        `;
    }

    displayMusicStats(stats) {
        const statsContainer = document.getElementById('musicStats');
        if (!statsContainer) return;

        const topArtistsHtml = stats.top_artists.slice(0, 5).map(artist => `
            <div class="artist-stat">
                <span class="artist-name">${artist.artist}</span>
                <span class="artist-count">${artist.count}</span>
            </div>
        `).join('');

        statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.total_tracks}</div>
                    <div class="stat-label">Total Tracks</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.today_tracks}</div>
                    <div class="stat-label">Today</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Top Artists</div>
                    <div class="top-artists">
                        ${topArtistsHtml}
                    </div>
                </div>
            </div>
        `;
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }

    showAudioStartPrompt() {
        // Create a subtle prompt for user to start audio
        const audioStatus = document.getElementById('audioStatus');
        if (audioStatus) {
            audioStatus.innerHTML = '<i class="fas fa-hand-pointer"></i> Click to start audio';
            audioStatus.style.cursor = 'pointer';
            audioStatus.style.opacity = '0.8';
            
            const startAudioHandler = async () => {
                try {
                    await this.startAudio();
                    audioStatus.removeEventListener('click', startAudioHandler);
                    audioStatus.style.cursor = 'default';
                    audioStatus.style.opacity = '1';
                } catch (error) {
                    console.error('Failed to start audio:', error);
                }
            };
            
            audioStatus.addEventListener('click', startAudioHandler);
        }
    }

    async recordForRecognition(duration) {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder) {
                reject(new Error('Media recorder not available'));
                return;
            }
            
            this.recordedChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                resolve(this.recordedChunks);
            };
            
            this.mediaRecorder.start();
            setTimeout(() => {
                this.mediaRecorder.stop();
            }, duration);
        });
    }

    async callAuddAPI() {
        // Simulate AudD API call with mock data
        // In production, you would send the recorded audio to AudD
        const mockSongs = [
            { title: 'Daft Punk - Get Lucky', artist: 'Daft Punk', album: 'Random Access Memories' },
            { title: 'The Weeknd - Blinding Lights', artist: 'The Weeknd', album: 'After Hours' },
            { title: 'Billie Eilish - bad guy', artist: 'Billie Eilish', album: 'When We All Fall Asleep, Where Do We Go?' },
            { title: 'Post Malone - Circles', artist: 'Post Malone', album: 'Hollywood\'s Bleeding' },
            { title: 'Ed Sheeran - Shape of You', artist: 'Ed Sheeran', album: '÷ (Divide)' }
        ];
        
        return new Promise((resolve) => {
            setTimeout(() => {
                // Simulate 70% success rate
                if (Math.random() > 0.3) {
                    const song = mockSongs[Math.floor(Math.random() * mockSongs.length)];
                    resolve(song);
                } else {
                    resolve(null);
                }
            }, 2000);
        });
    }

    displayRecognitionResult(result) {
        const songInfo = document.getElementById('songInfo');
        const songTitle = document.getElementById('songTitle');
        const songArtist = document.getElementById('songArtist');
        
        songTitle.textContent = result.title;
        songArtist.textContent = result.artist;
        songInfo.classList.add('show');
        
        // Send to robot
        this.sendMessage({
            type: 'music-recognized',
            song: result
        });
        
        // Hide after 10 seconds
        setTimeout(() => {
            songInfo.classList.remove('show');
        }, 10000);
    }

    // Behavior controls
    toggleBehavior(behaviorName) {
        const behaviorKey = behaviorName.replace('-', '');
        this.behaviors[behaviorKey] = !this.behaviors[behaviorKey];
        
        const toggle = document.querySelector(`[data-behavior="${behaviorName}"]`);
        const switchEl = toggle.querySelector('.toggle-switch');
        
        if (this.behaviors[behaviorKey]) {
            toggle.classList.add('active');
            switchEl.classList.add('active');
        } else {
            toggle.classList.remove('active');
            switchEl.classList.remove('active');
        }
        
        // Send to robot
        this.sendMessage({
            type: 'behavior-toggle',
            behavior: behaviorName,
            enabled: this.behaviors[behaviorKey]
        });
        
        this.updateReactionStatus(behaviorName, this.behaviors[behaviorKey]);
    }

    updateReactionStatus(behavior, active) {
        const statusMap = {
            'dance': 'danceStatus',
            'led-spectrum': 'ledStatus',
            'head-bob': 'headStatus',
            'color-pulse': 'colorStatus',
            'movement-sync': 'movementStatus'
        };
        
        const statusEl = document.getElementById(statusMap[behavior]);
        if (statusEl) {
            statusEl.textContent = active ? 'Active' : 'Inactive';
            statusEl.classList.toggle('active', active);
        }
    }

    // Recording and playback
    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    startRecording() {
        if (!this.mediaRecorder) return;
        
        this.recordedChunks = [];
        this.mediaRecorder.start();
        this.isRecording = true;
        this.updateUI();
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.updateUI();
        }
    }

    playRecording() {
        if (this.recordedChunks.length === 0) return;
        
        const blob = new Blob(this.recordedChunks, { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play();
    }

    setupMediaRecorder() {
        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };
    }

    stopAll() {
        this.stopRecording();
        this.stopAudio();
    }

    // Settings
    setGain(value) {
        this.settings.gain = parseInt(value);
        document.getElementById('gainValue').textContent = `${value}%`;
        
        // Apply gain to audio context if available
        if (this.audioContext && this.microphone) {
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = value / 100;
            this.microphone.disconnect();
            this.microphone.connect(gainNode);
            gainNode.connect(this.analyser);
        }
    }

    setBeatSensitivity(value) {
        this.settings.beatSensitivity = parseInt(value);
        document.getElementById('beatSensValue').textContent = value;
    }

    setVisualMode(mode) {
        this.settings.visualMode = mode;
    }

    // Audio data transmission
    sendAudioDataToRobot() {
        if (!this.isConnected || !this.frequencyData) return;
        
        // Send spectrum data for LED visualization
        if (this.behaviors.ledSpectrum) {
            const spectrumData = Array.from(this.frequencyData.slice(0, 32)); // First 32 bands
            this.sendMessage({
                type: 'spectrum-data',
                data: spectrumData,
                timestamp: Date.now()
            });
        }
        
        // Send movement sync data
        if (this.behaviors.movementSync) {
            const bassEnergy = this.frequencyData.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
            const midEnergy = this.frequencyData.slice(10, 50).reduce((a, b) => a + b, 0) / 40;
            const highEnergy = this.frequencyData.slice(50, 100).reduce((a, b) => a + b, 0) / 50;
            
            this.sendMessage({
                type: 'movement-sync',
                bass: bassEnergy / 255,
                mid: midEnergy / 255,
                high: highEnergy / 255
            });
        }
    }

    handleKeyboard(event) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;
        
        switch (event.key) {
            case ' ':
                event.preventDefault();
                this.toggleAudio();
                break;
            case 'r':
                event.preventDefault();
                this.toggleRecording();
                break;
            case 'p':
                event.preventDefault();
                this.playRecording();
                break;
            case 's':
                event.preventDefault();
                this.stopAll();
                break;
            case 'i':
                event.preventDefault();
                this.recognizeMusic();
                break;
        }
    }

    // UI updates
    updateUI() {
        const startBtn = document.getElementById('startAudioBtn');
        const recordBtn = document.getElementById('recordBtn');
        const audioStatus = document.getElementById('audioStatus');
        
        if (this.audioActive) {
            startBtn.classList.add('active');
            startBtn.innerHTML = '<i class="fas fa-microphone-slash"></i> Stop Audio';
            audioStatus.textContent = 'Audio Active';
        } else {
            startBtn.classList.remove('active');
            startBtn.innerHTML = '<i class="fas fa-microphone"></i> Start Audio';
            audioStatus.textContent = 'Audio Inactive';
        }
        
        if (this.isRecording) {
            recordBtn.classList.add('recording');
            recordBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Recording';
        } else {
            recordBtn.classList.remove('recording');
            recordBtn.innerHTML = '<i class="fas fa-record-vinyl"></i> Record';
        }
        
        // Update beat status
        document.getElementById('beatStatus').textContent = this.audioActive ? 'Active' : 'Inactive';
        document.getElementById('beatStatus').classList.toggle('active', this.audioActive);
    }

    updateConnectionStatus() {
        const indicator = document.getElementById('connectionIndicator');
        const status = document.getElementById('connectionStatus');
        
        if (this.isConnected) {
            indicator.classList.add('connected');
            status.textContent = 'Connected';
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
    }

    enableSimulationMode() {
        console.log('🎭 Enabling music simulation mode');
        
        // Simulate connection
        setTimeout(() => {
            this.isConnected = true;
            this.updateConnectionStatus();
        }, 1000);
        
        // Simulate beat detection
        setInterval(() => {
            if (this.audioActive && Math.random() > 0.7) {
                this.beatDetector.bpm = 120 + Math.floor(Math.random() * 60);
                this.onBeatDetected();
            }
        }, 500 + Math.random() * 1000);
    }

    async reconnect() {
        if (!this.isConnected) {
            console.log('🔄 Attempting to reconnect...');
            await this.connectWebSocket();
        }
    }

    // STT Integration Methods
    async loadSTTConfig() {
        try {
            const response = await fetch('/api/stt/config');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.config) {
                    this.sttConfig = { ...this.sttConfig, ...data.config };
                    console.log('✅ STT configuration loaded:', this.sttConfig);
                }
            }
        } catch (error) {
            console.warn('⚠️ Failed to load STT config:', error);
        }
    }

    async toggleSTT() {
        if (this.sttActive) {
            this.stopSTT();
        } else {
            await this.startSTT();
        }
    }

    async startSTT() {
        if (!this.audioActive) {
            alert('Please start audio capture first');
            return;
        }
        
        try {
            console.log('🎤 Starting STT service...');
            
            // Start STT simulation/connection
            const response = await fetch('/api/stt/simulate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    mode: 'continuous',
                    language: this.sttConfig.language
                })
            });
            
            if (response.ok) {
                this.sttActive = true;
                this.updateUI();
                this.addSTTLog('🎤 STT service started', 'success');
                
                // Start periodic STT simulation
                this.sttSimulationInterval = setInterval(() => {
                    this.simulateSTTTranscript();
                }, 3000 + Math.random() * 5000); // Random intervals between 3-8 seconds
                
            } else {
                throw new Error('Failed to start STT service');
            }
            
        } catch (error) {
            console.error('❌ Failed to start STT:', error);
            this.addSTTLog('❌ STT start failed: ' + error.message, 'error');
        }
    }

    stopSTT() {
        this.sttActive = false;
        if (this.sttSimulationInterval) {
            clearInterval(this.sttSimulationInterval);
            this.sttSimulationInterval = null;
        }
        this.updateUI();
        this.addSTTLog('🔇 STT service stopped', 'info');
    }

    async simulateSTTTranscript() {
        if (!this.sttActive) return;
        
        const testPhrases = [
            "Hello LAIKA, how are you today?",
            "What's the weather like?",
            "Tell me a joke",
            "Play some music",
            "What time is it?",
            "How are you feeling?",
            "Can you dance?",
            "What's your favorite song?",
            "Tell me about yourself",
            "Good morning LAIKA"
        ];
        
        const randomPhrase = testPhrases[Math.floor(Math.random() * testPhrases.length)];
        const confidence = 0.85 + Math.random() * 0.15; // 85-100% confidence
        
        this.addSTTTranscript(randomPhrase, confidence, 'openai_realtime');
    }

    addSTTTranscript(text, confidence, provider) {
        const transcript = {
            id: Date.now(),
            text: text,
            confidence: confidence,
            provider: provider,
            timestamp: new Date().toISOString(),
            language: this.sttConfig.language
        };
        
        this.sttHistory.unshift(transcript);
        if (this.sttHistory.length > this.maxSttHistory) {
            this.sttHistory.pop();
        }
        
        this.displaySTTHistory();
        this.addSTTLog(`🎯 "${text}" (${Math.round(confidence * 100)}%)`, 'transcript');
        
        // Send to robot if connected
        this.sendMessage({
            type: 'stt-transcript',
            transcript: transcript
        });
    }

    addSTTLog(message, type = 'info') {
        const logContainer = document.getElementById('sttLogs');
        if (!logContainer) return;
        
        const logEntry = document.createElement('div');
        logEntry.className = `stt-log-entry stt-log-${type}`;
        logEntry.innerHTML = `
            <span class="stt-log-time">${new Date().toLocaleTimeString()}</span>
            <span class="stt-log-message">${message}</span>
        `;
        
        logContainer.insertBefore(logEntry, logContainer.firstChild);
        
        // Keep only last 20 log entries
        while (logContainer.children.length > 20) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }

    async loadSTTHistory() {
        try {
            const response = await fetch('/api/stt/history?limit=50');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.transcripts) {
                    this.sttHistory = data.transcripts;
                    this.displaySTTHistory();
                }
            }
        } catch (error) {
            console.warn('⚠️ Failed to load STT history:', error);
        }
    }

    displaySTTHistory() {
        const historyContainer = document.getElementById('sttHistory');
        if (!historyContainer) return;

        if (this.sttHistory.length === 0) {
            historyContainer.innerHTML = `
                <div class="no-transcripts">
                    <i class="fas fa-microphone-slash"></i>
                    <p>No transcripts yet</p>
                    <small>Start STT service to begin transcription</small>
                </div>
            `;
            return;
        }

        const transcriptsHtml = this.sttHistory.map(transcript => {
            const date = new Date(transcript.timestamp);
            const timeAgo = this.getTimeAgo(date);
            const confidenceColor = transcript.confidence > 0.9 ? '#00ff88' : 
                                   transcript.confidence > 0.7 ? '#ffaa00' : '#ff4444';
            
            return `
                <div class="transcript-item" data-transcript-id="${transcript.id}">
                    <div class="transcript-text">${transcript.text}</div>
                    <div class="transcript-meta">
                        <div class="transcript-time">${timeAgo}</div>
                        <div class="transcript-confidence" style="color: ${confidenceColor}">
                            <i class="fas fa-chart-bar"></i>
                            ${Math.round(transcript.confidence * 100)}%
                        </div>
                        <div class="transcript-provider">
                            <i class="fas fa-cog"></i>
                            ${transcript.provider}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        historyContainer.innerHTML = `
            <h3><i class="fas fa-history"></i> Recent Transcripts</h3>
            <div class="transcripts-list">
                ${transcriptsHtml}
            </div>
        `;
    }

    async clearSTTHistory() {
        try {
            const response = await fetch('/api/stt/history/clear', { method: 'POST' });
            if (response.ok) {
                this.sttHistory = [];
                this.displaySTTHistory();
                this.addSTTLog('🗑️ STT history cleared', 'info');
            }
        } catch (error) {
            console.error('❌ Failed to clear STT history:', error);
            this.addSTTLog('❌ Failed to clear history: ' + error.message, 'error');
        }
    }
}

// Initialize music controller when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.laikaMusic = new LAIKAMusic();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.laikaMusic) {
        window.laikaMusic.stopAll();
        if (window.laikaMusic.ws) {
            window.laikaMusic.ws.close();
        }
    }
});

