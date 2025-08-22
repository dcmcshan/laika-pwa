/**
 * LAIKA Hybrid STT Control Panel
 * Real-time STT integration with continuous audio streaming
 */

class HybridSTTControl {
    constructor() {
        this.isRecording = true; // Always recording by default
        this.transcriptHistory = [];
        this.currentProvider = 'openai_realtime';
        this.providers = ['openai_realtime', 'openai_whisper', 'local_whisper', 'elevenlabs'];
        this.websocket = null; // OpenAI WebSocket connection
        this.socket = null; // SocketIO fallback
        this.audioContext = null;
        this.mediaStream = null;
        this.audioProcessor = null;
        this.chunkCount = 0; // For audio buffer commits
        
        // Music analysis
        this.musicAnalysis = {
            enabled: true,
            beatDetection: true,
            songIdentification: true,
            tempo: 0,
            isMusic: false,
            currentSong: null,
            beatHistory: []
        };
        
        this.initializeUI();
        this.loadCurrentConfiguration();
        this.setupEventListeners();
        
        // Connect to server for transcripts (no audio recording needed)
        this.connectToServer();
        
                         // Start with empty transcript area
                 this.updateStatus('Real-time STT system ready');
    }

    initializeUI() {
        // Initialize provider selection
        const providerSelect = document.getElementById('sttProvider');
        if (providerSelect) {
            providerSelect.innerHTML = '';
            this.providers.forEach(provider => {
                const option = document.createElement('option');
                option.value = provider;
                option.textContent = this.formatProviderName(provider);
                providerSelect.appendChild(option);
            });
            providerSelect.value = this.currentProvider;
        }

        // Initialize status display
        this.updateStatus('Real-time STT is active and listening...');
    }

    setupEventListeners() {
        // Provider selection
        const providerSelect = document.getElementById('sttProvider');
        if (providerSelect) {
            providerSelect.addEventListener('change', (e) => this.updateProvider(e.target.value));
        }

        // Test STT button
        const testButton = document.getElementById('testSTT');
        if (testButton) {
            testButton.addEventListener('click', () => this.testSTT());
        }

        // Clear history button
        const clearButton = document.getElementById('clearHistory');
        if (clearButton) {
            clearButton.addEventListener('click', () => this.clearHistory());
        }

        // Save configuration button
        const saveButton = document.getElementById('saveConfig');
        if (saveButton) {
            saveButton.addEventListener('click', () => this.saveConfiguration());
        }

        // Reset configuration button
        const resetButton = document.getElementById('resetConfig');
        if (resetButton) {
            resetButton.addEventListener('click', () => this.resetConfiguration());
        }
    }

    async loadCurrentConfiguration() {
        try {
            // Use default configuration - no API call needed
            this.currentProvider = 'openai_realtime';
            const providerSelect = document.getElementById('sttProvider');
            if (providerSelect) {
                providerSelect.value = this.currentProvider;
            }
            this.updateStatus('Using default configuration');
            
            // Load API keys
            await this.loadApiKeys();
            
        } catch (error) {
            console.error('Configuration error:', error);
            this.updateStatus('Using default configuration');
        }
    }

    async saveConfiguration() {
        try {
            const provider = document.getElementById('sttProvider').value;
            const config = {
                provider: provider,
                enable_elevenlabs: provider === 'elevenlabs'
            };

            const response = await fetch('/api/stt/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            if (response.ok) {
                this.updateStatus('Configuration saved successfully');
            } else {
                throw new Error('Failed to save configuration');
            }
        } catch (error) {
            console.error('Failed to save configuration:', error);
            this.updateStatus('Failed to save configuration');
        }
    }

    async resetConfiguration() {
        try {
            const response = await fetch('/api/stt/config/reset', { method: 'POST' });
            if (response.ok) {
                this.currentProvider = 'openai_realtime';
                document.getElementById('sttProvider').value = this.currentProvider;
                this.updateStatus('Configuration reset to defaults');
            } else {
                throw new Error('Failed to reset configuration');
            }
        } catch (error) {
            console.error('Failed to reset configuration:', error);
            this.updateStatus('Failed to reset configuration');
        }
    }

    async testSTT() {
        try {
            this.updateStatus('Testing STT...');
            
            // Add a test transcript immediately for testing
            this.addTranscript("This is a test transcript from the LAIKA hybrid STT system.", 'Test');
            
            const response = await fetch('/api/stt/test', { method: 'POST' });
            if (response.ok) {
                const result = await response.json();
                this.addTranscript(result.transcript, 'API Test');
                this.updateStatus('Real-time STT is active and listening...');
            } else {
                throw new Error('STT test failed');
            }
        } catch (error) {
            console.error('STT test failed:', error);
            this.updateStatus('STT test failed');
        }
    }

    async connectToServer() {
        try {
            // No microphone access needed - LAIKA STT is always listening
            this.isRecording = true;
            this.updateStatus('Connected to LAIKA STT (always listening)...');
            
            // Start WebSocket connection to receive transcripts
            this.startRealtimeConnection();
            
            // Load existing transcript history
            await this.loadTranscriptHistory();
            
        } catch (error) {
            console.error('Failed to connect to STT service:', error);
            this.updateStatus('Failed to connect to STT service');
            this.isRecording = false;
        }
    }

    async loadTranscriptHistory() {
        try {
            const response = await fetch('/api/stt/history?limit=50');
            const data = await response.json();
            
            if (data.success && data.history) {
                this.transcriptHistory = data.history;
                this.updateTranscriptDisplay();
                console.log(`Loaded ${data.history.length} transcript entries`);
                this.addLogMessage(`Loaded ${data.history.length} transcript entries`, 'success');
            }
        } catch (error) {
            console.error('Error loading transcript history:', error);
            this.addLogMessage('Error loading transcript history', 'error');
        }
    }

    async clearHistory() {
        try {
            const response = await fetch('/api/stt/history/clear', {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                this.transcriptHistory = [];
                this.updateTranscriptDisplay();
                this.addLogMessage(`Cleared ${data.cleared_count} transcript entries`, 'success');
            }
        } catch (error) {
            console.error('Error clearing history:', error);
            this.addLogMessage('Error clearing history', 'error');
        }
    }

    startRealtimeConnection() {
        try {
            // Use SocketIO for real-time STT connection
            if (typeof io !== 'undefined') {
                this.socket = io();
                
                                        this.socket.on('connect', () => {
                            console.log('SocketIO connected to real-time STT service');
                            this.updateStatus('Connected to real-time STT service');
                            // No audio streaming needed - LAIKA STT handles audio
                        });
                
                this.socket.on('stt_response', (data) => {
                    if (data.type === 'transcript') {
                        this.addTranscript(data.text, 'Real-time', data.provider, data.timestamp);
                    } else if (data.type === 'status') {
                        this.updateStatus(data.message);
                    }
                });
                
                this.socket.on('song_identification_response', (data) => {
                    if (data.type === 'song_identified') {
                        this.updateSongIdentification(data.song);
                    } else if (data.type === 'no_song_found') {
                        this.updateSongIdentification(null, 'No song found');
                    } else if (data.type === 'error') {
                        this.updateSongIdentification(null, data.message);
                    }
                });
                
                this.socket.on('disconnect', () => {
                    console.log('SocketIO connection closed');
                    this.updateStatus('WebSocket connection closed');
                });
                
            } else {
                // Fallback to WebSocket if SocketIO not available
                const wsUrl = `ws://${window.location.host}/ws/stt`;
                this.websocket = new WebSocket(wsUrl);
                
                this.websocket.onopen = () => {
                    console.log('WebSocket connected to real-time STT service');
                    this.updateStatus('Connected to real-time STT service');
                    this.startAudioStreaming();
                };
                
                this.websocket.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    if (data.type === 'transcript') {
                        this.addTranscript(data.text, 'Real-time', data.provider, data.timestamp);
                    } else if (data.type === 'status') {
                        this.updateStatus(data.message);
                    }
                };
                
                this.websocket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    this.updateStatus('WebSocket connection error');
                };
                
                this.websocket.onclose = () => {
                    console.log('WebSocket connection closed');
                    this.updateStatus('WebSocket connection closed');
                };
            }
            
        } catch (error) {
            console.error('Failed to start connection:', error);
            this.updateStatus('Failed to connect to STT service');
        }
    }

    startAudioStreaming() {
        if (!this.mediaStream) return;
        
        this.audioContext = new AudioContext({ sampleRate: 16000 });
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        
        // Create script processor for audio streaming
        const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (event) => {
            if (this.isRecording) {
                const audioData = event.inputBuffer.getChannelData(0);
                // Convert to 16-bit PCM
                const pcmData = new Int16Array(audioData.length);
                for (let i = 0; i < audioData.length; i++) {
                    pcmData[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
                }
                
                // Send audio data via SocketIO or WebSocket
                if (this.socket && this.socket.connected) {
                    this.socket.emit('stt_audio', {
                        type: 'audio',
                        data: Array.from(pcmData),
                        provider: this.currentProvider
                    });
                } else if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                    this.websocket.send(JSON.stringify({
                        type: 'audio',
                        data: Array.from(pcmData),
                        provider: this.currentProvider
                    }));
                }
                
                // Perform music analysis
                this.analyzeMusic(audioData);
            }
        };
        
        source.connect(processor);
        processor.connect(this.audioContext.destination);
        
        this.audioProcessor = processor;
    }
    
    analyzeMusic(audioData) {
        if (!this.musicAnalysis.enabled) return;
        
        try {
            // Simple beat detection using amplitude analysis
            const amplitude = this.calculateAmplitude(audioData);
            const timestamp = Date.now();
            
            // Detect beats based on amplitude threshold
            if (amplitude > 0.05) { // Lower threshold for better sensitivity
                this.musicAnalysis.beatHistory.push(timestamp);
                
                // Keep only recent beats (last 5 seconds)
                this.musicAnalysis.beatHistory = this.musicAnalysis.beatHistory.filter(
                    beat => timestamp - beat < 5000
                );
                
                // Calculate tempo from beat intervals
                if (this.musicAnalysis.beatHistory.length > 2) {
                    const intervals = [];
                    for (let i = 1; i < this.musicAnalysis.beatHistory.length; i++) {
                        intervals.push(this.musicAnalysis.beatHistory[i] - this.musicAnalysis.beatHistory[i-1]);
                    }
                    
                    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                    this.musicAnalysis.tempo = Math.round(60000 / avgInterval); // BPM
                    
                    // Determine if this is music (consistent tempo)
                    const tempoVariance = this.calculateVariance(intervals);
                    this.musicAnalysis.isMusic = tempoVariance < 200; // More lenient threshold
                    
                    // Update UI with music analysis
                    this.updateMusicAnalysis();
                    
                    // Update beat status
                    this.updateBeatStatus();
                    
                    // Trigger song identification if music is detected
                    if (this.musicAnalysis.isMusic && this.musicAnalysis.songIdentification) {
                        this.triggerSongIdentification(audioData);
                    }
                }
            }
            
        } catch (error) {
            console.error('Music analysis error:', error);
        }
    }
    
    calculateAmplitude(audioData) {
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += Math.abs(audioData[i]);
        }
        return sum / audioData.length;
    }
    
    calculateVariance(values) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    }
    
    updateMusicAnalysis() {
        const musicStatus = document.getElementById('musicStatus');
        if (musicStatus) {
            if (this.musicAnalysis.isMusic) {
                musicStatus.textContent = `🎵 Music detected! Tempo: ${this.musicAnalysis.tempo} BPM`;
                musicStatus.className = 'music-status music-detected';
            } else {
                musicStatus.textContent = '🔇 No music detected';
                musicStatus.className = 'music-status no-music';
            }
        }
    }
    
    updateBeatStatus() {
        const beatStatus = document.getElementById('beatStatus');
        if (beatStatus) {
            if (this.musicAnalysis.isMusic && this.musicAnalysis.tempo > 0) {
                beatStatus.textContent = `Active - ${this.musicAnalysis.tempo} BPM`;
            } else {
                beatStatus.textContent = 'Listening...';
            }
        }
    }
    
    triggerSongIdentification(audioData) {
        // Only trigger song ID every 30 seconds to avoid excessive API calls
        const now = Date.now();
        if (now - this.lastSongIdTime < 30000) {
            return;
        }
        
        this.lastSongIdTime = now;
        
        // Update song ID status
        const songIdStatus = document.getElementById('songIdStatus');
        if (songIdStatus) {
            songIdStatus.textContent = 'Analyzing...';
        }
        
        // Send audio data to server for song identification
        if (this.socket && this.socket.connected) {
            this.socket.emit('song_identification', {
                type: 'song_id_request',
                audio_data: Array.from(new Int16Array(audioData.buffer)),
                timestamp: now
            });
        }
    }

    stopRealtimeConnection() {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }
        
        if (this.audioProcessor) {
            this.audioProcessor.disconnect();
            this.audioProcessor = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    updateProvider(provider) {
        this.currentProvider = provider;
        console.log('STT provider updated to:', provider);
        this.updateStatus(`Provider updated to: ${this.formatProviderName(provider)}`);
    }

    updateStatus(message) {
        const statusElement = document.getElementById('sttStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    addTranscript(text, source, provider = null, timestamp = null) {
        const now = new Date();
        const transcript = {
            id: Date.now(),
            text: text,
            source: source,
            timestamp: timestamp || now.toLocaleTimeString(),
            provider: provider || this.currentProvider,
            datetime: now.toISOString()
        };
        
        this.transcriptHistory.unshift(transcript);
        this.updateTranscriptDisplay();
    }

    updateTranscriptDisplay() {
        const historyContainer = document.getElementById('transcriptHistory');
        if (!historyContainer) return;

        historyContainer.innerHTML = '';
        
        if (this.transcriptHistory.length === 0) {
            historyContainer.innerHTML = `
                <div style="opacity: 0.5; text-align: center; padding: 20px;">
                    No transcripts yet...<br>
                    <small>Real-time transcripts will appear here with timestamps</small>
                </div>
            `;
            return;
        }
        
        this.transcriptHistory.forEach(transcript => {
            const transcriptElement = document.createElement('div');
            transcriptElement.className = 'transcript-item';
            
            // Format timestamp nicely
            let timeDisplay = transcript.timestamp;
            if (transcript.datetime) {
                const date = new Date(transcript.datetime);
                timeDisplay = date.toLocaleTimeString();
            }
            
            transcriptElement.innerHTML = `
                <div class="transcript-header">
                    <span class="transcript-time">🕐 ${timeDisplay}</span>
                    <span class="transcript-source">📝 ${transcript.source}</span>
                    <span class="transcript-provider">🔧 ${this.formatProviderName(transcript.provider)}</span>
                </div>
                <div class="transcript-text">"${transcript.text}"</div>
            `;
            historyContainer.appendChild(transcriptElement);
        });
    }

    clearHistory() {
        this.transcriptHistory = [];
        this.updateTranscriptDisplay();
        this.updateStatus('Transcript history cleared');
    }

    formatProviderName(provider) {
        const names = {
            'openai_realtime': 'OpenAI Real-time',
            'openai_whisper': 'OpenAI Whisper',
            'local_whisper': 'Local Whisper',
            'elevenlabs': 'ElevenLabs'
        };
        return names[provider] || provider;
    }
    
    updateSongIdentification(songData, errorMessage = null) {
        const songIdStatus = document.getElementById('songIdStatus');
        if (songIdStatus) {
            if (songData) {
                songIdStatus.textContent = `🎵 ${songData.title} - ${songData.artist}`;
                if (songData.confidence) {
                    songIdStatus.textContent += ` (${Math.round(songData.confidence * 100)}% confidence)`;
                }
            } else if (errorMessage) {
                songIdStatus.textContent = `❌ ${errorMessage}`;
            } else {
                songIdStatus.textContent = 'Ready';
            }
        }
    }
    
    async loadApiKeys() {
        try {
            const response = await fetch('/api/keys');
            const data = await response.json();
            
            if (data.success) {
                // Populate API key fields with masked values
                const elevenlabsKey = data.api_keys.elevenlabs_api_key;
                if (elevenlabsKey && elevenlabsKey !== '') {
                    document.getElementById('elevenlabs-api-key').value = elevenlabsKey;
                }
            }
        } catch (error) {
            console.error('Error loading API keys:', error);
        }
    }
    
    async saveApiKey(keyName, inputId) {
        const input = document.getElementById(inputId);
        const apiKey = input.value.trim();
        
        if (!apiKey) {
            this.showApiKeyStatus(inputId.replace('-api-key', '-status'), 'Please enter an API key', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/keys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ [keyName]: apiKey })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showApiKeyStatus(inputId.replace('-api-key', '-status'), 'API key saved successfully!', 'success');
                input.value = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
            } else {
                this.showApiKeyStatus(inputId.replace('-api-key', '-status'), 'Failed to save API key: ' + data.error, 'error');
            }
        } catch (error) {
            this.showApiKeyStatus(inputId.replace('-api-key', '-status'), 'Error saving API key: ' + error.message, 'error');
        }
    }
    
    async testApiKey(service, inputId) {
        const input = document.getElementById(inputId);
        const apiKey = input.value.trim();
        
        if (!apiKey) {
            this.showApiKeyStatus(inputId.replace('-api-key', '-status'), 'Please enter an API key to test', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/keys/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ service: service, api_key: apiKey })
            });
            
            const data = await response.json();
            
            if (data.success) {
                const testResult = data.test_results[service];
                if (testResult && testResult.success) {
                    this.showApiKeyStatus(inputId.replace('-api-key', '-status'), testResult.message, 'success');
                } else {
                    this.showApiKeyStatus(inputId.replace('-api-key', '-status'), 'API key test failed: ' + (testResult?.error || 'Unknown error'), 'error');
                }
            } else {
                this.showApiKeyStatus(inputId.replace('-api-key', '-status'), 'Test failed: ' + data.error, 'error');
            }
        } catch (error) {
            this.showApiKeyStatus(inputId.replace('-api-key', '-status'), 'Error testing API key: ' + error.message, 'error');
        }
    }
    
    showApiKeyStatus(statusId, message, type) {
        const statusElement = document.getElementById(statusId);
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `api-key-status ${type}`;
            
            // Clear status after 5 seconds
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.className = 'api-key-status';
            }, 5000);
        }
    }
}

// Global functions for API key management (called from HTML)
function saveApiKey(keyName, inputId) {
    if (window.sttControl) {
        window.sttControl.saveApiKey(keyName, inputId);
    }
}

function testApiKey(service, inputId) {
    if (window.sttControl) {
        window.sttControl.testApiKey(service, inputId);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎤 Initializing LAIKA Real-time STT Control Panel...');
    window.sttControl = new HybridSTTControl();
});


