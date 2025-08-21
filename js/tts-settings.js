/**
 * LAIKA TTS Settings Controller
 * Handles voice provider selection, ElevenLabs integration, and voice testing
 */

class TTSSettings {
    constructor() {
        this.currentProvider = 'piper';
        this.currentVoice = null;
        this.elevenLabsApiKey = '';
        this.voices = [];
        this.isPlaying = false;
        this.audioContext = null;
        
        this.initializeEventListeners();
        this.loadSettings();
        this.updateUI();
    }

    initializeEventListeners() {
        // Provider selection
        document.querySelectorAll('input[name="provider"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentProvider = e.target.value;
                this.updateUI();
                this.saveSettings();
            });
        });

        // Voice option selection
        document.querySelectorAll('.voice-option').forEach(option => {
            option.addEventListener('click', (e) => {
                if (e.target.type !== 'radio') {
                    const radio = option.querySelector('input[type="radio"]');
                    radio.checked = true;
                    this.currentProvider = radio.value;
                    this.updateUI();
                    this.saveSettings();
                }
            });
        });

        // ElevenLabs API key testing
        const testApiKeyBtn = document.getElementById('test-api-key');
        if (testApiKeyBtn) {
            testApiKeyBtn.addEventListener('click', () => this.testElevenLabsAPI());
        }

        // Load voices button
        const loadVoicesBtn = document.getElementById('load-voices');
        if (loadVoicesBtn) {
            loadVoicesBtn.addEventListener('click', () => this.loadElevenLabsVoices());
        }

        // Text tabs
        document.querySelectorAll('.text-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTextTab(e.target.dataset.tab);
            });
        });

        // Test voice button
        const testVoiceBtn = document.getElementById('test-voice');
        if (testVoiceBtn) {
            testVoiceBtn.addEventListener('click', () => this.testVoice());
        }

        // Stop voice button
        const stopVoiceBtn = document.getElementById('stop-voice');
        if (stopVoiceBtn) {
            stopVoiceBtn.addEventListener('click', () => this.stopVoice());
        }

        // Test buttons
        document.querySelectorAll('.test-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const text = e.target.dataset.text;
                if (text) {
                    this.testVoiceWithText(text);
                }
            });
        });

        // Sliders
        this.initializeSliders();

        // Save settings
        const saveBtn = document.getElementById('save-settings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveSettings());
        }

        // Reset settings
        const resetBtn = document.getElementById('reset-settings');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSettings());
        }

        // Export config
        const exportBtn = document.getElementById('export-config');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportConfig());
        }
    }

    initializeSliders() {
        // Volume slider
        const volumeSlider = document.getElementById('volume-slider');
        const volumeValue = document.getElementById('volume-value');
        if (volumeSlider && volumeValue) {
            volumeSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                volumeValue.textContent = `${value}%`;
                this.updateVolume(value);
            });
        }

        // Rate slider
        const rateSlider = document.getElementById('rate-slider');
        const rateValue = document.getElementById('rate-value');
        if (rateSlider && rateValue) {
            rateSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                rateValue.textContent = `${value}x`;
                this.updateRate(value);
            });
        }

        // Stability slider (ElevenLabs)
        const stabilitySlider = document.getElementById('stability-slider');
        const stabilityValue = document.getElementById('stability-value');
        if (stabilitySlider && stabilityValue) {
            stabilitySlider.addEventListener('input', (e) => {
                const value = e.target.value;
                stabilityValue.textContent = value;
                this.updateStability(value);
            });
        }

        // Similarity slider (ElevenLabs)
        const similaritySlider = document.getElementById('similarity-slider');
        const similarityValue = document.getElementById('similarity-value');
        if (similaritySlider && similarityValue) {
            similaritySlider.addEventListener('input', (e) => {
                const value = e.target.value;
                similarityValue.textContent = value;
                this.updateSimilarity(value);
            });
        }
    }

    updateUI() {
        // Update voice option styling
        document.querySelectorAll('.voice-option').forEach(option => {
            option.classList.remove('selected');
            const radio = option.querySelector('input[type="radio"]');
            if (radio.checked) {
                option.classList.add('selected');
            }
        });

        // Show/hide ElevenLabs configuration
        const elevenLabsConfig = document.getElementById('elevenlabs-config');
        if (elevenLabsConfig) {
            elevenLabsConfig.style.display = this.currentProvider === 'elevenlabs' ? 'block' : 'none';
        }

        // Show/hide ElevenLabs-specific controls
        const stabilityControl = document.getElementById('stability-control');
        const similarityControl = document.getElementById('similarity-control');
        
        if (stabilityControl) {
            stabilityControl.style.display = this.currentProvider === 'elevenlabs' ? 'block' : 'none';
        }
        if (similarityControl) {
            similarityControl.style.display = this.currentProvider === 'elevenlabs' ? 'block' : 'none';
        }

        // Update voice selection based on provider
        this.updateVoiceSelection();
    }

    updateVoiceSelection() {
        const container = document.getElementById('voice-selection-container');
        if (!container) return;

        container.innerHTML = '';

        switch (this.currentProvider) {
            case 'elevenlabs':
                this.renderElevenLabsVoices(container);
                break;
            case 'piper':
                this.renderPiperVoices(container);
                break;
            case 'system':
                this.renderSystemVoices(container);
                break;
        }
    }

    renderElevenLabsVoices(container) {
        if (this.voices.length === 0) {
            container.innerHTML = `
                <div class="voice-option">
                    <p>No voices loaded. Click "Load Available Voices" to fetch from ElevenLabs.</p>
                </div>
            `;
            return;
        }

        this.voices.forEach(voice => {
            const voiceElement = document.createElement('div');
            voiceElement.className = 'voice-card';
            voiceElement.innerHTML = `
                <h4>${voice.name}</h4>
                <p>${voice.description || 'No description available'}</p>
                <p><strong>Category:</strong> ${voice.category}</p>
                <p><strong>Language:</strong> ${voice.labels?.language || 'Unknown'}</p>
                <button class="btn btn-secondary" onclick="window.ttsSettings.selectVoice('${voice.voice_id}')">
                    Select Voice
                </button>
                <button class="btn" onclick="window.ttsSettings.previewVoice('${voice.voice_id}')">
                    Preview
                </button>
            `;
            container.appendChild(voiceElement);
        });
    }

    renderPiperVoices(container) {
        const piperVoices = [
            { id: 'joe', name: 'Joe (English Male)', description: 'Clear male English voice', language: 'en-US' },
            { id: 'amy', name: 'Amy (English Female)', description: 'Natural female English voice', language: 'en-US' },
            { id: 'russian', name: 'Russian Voice', description: 'Russian language voice', language: 'ru-RU' }
        ];

        piperVoices.forEach(voice => {
            const voiceElement = document.createElement('div');
            voiceElement.className = 'voice-card';
            voiceElement.innerHTML = `
                <h4>${voice.name}</h4>
                <p>${voice.description}</p>
                <p><strong>Language:</strong> ${voice.language}</p>
                <button class="btn btn-secondary" onclick="window.ttsSettings.selectVoice('${voice.id}')">
                    Select Voice
                </button>
            `;
            container.appendChild(voiceElement);
        });
    }

    renderSystemVoices(container) {
        const systemVoices = [
            { id: 'espeak', name: 'eSpeak', description: 'Fast system TTS', language: 'en-US' },
            { id: 'festival', name: 'Festival', description: 'Festival TTS engine', language: 'en-US' }
        ];

        systemVoices.forEach(voice => {
            const voiceElement = document.createElement('div');
            voiceElement.className = 'voice-card';
            voiceElement.innerHTML = `
                <h4>${voice.name}</h4>
                <p>${voice.description}</p>
                <p><strong>Language:</strong> ${voice.language}</p>
                <button class="btn btn-secondary" onclick="window.ttsSettings.selectVoice('${voice.id}')">
                    Select Voice
                </button>
            `;
            container.appendChild(voiceElement);
        });
    }

    async testElevenLabsAPI() {
        const apiKeyInput = document.getElementById('elevenlabs-api-key');
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            this.showStatus('Please enter an API key', 'error');
            return;
        }

        this.showStatus('Testing API key...', 'info');
        
        try {
            const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: {
                    'xi-api-key': apiKey
                }
            });

            if (response.ok) {
                this.elevenLabsApiKey = apiKey;
                this.showStatus('API key is valid!', 'success');
                this.loadElevenLabsVoices();
            } else {
                this.showStatus('Invalid API key. Please check and try again.', 'error');
            }
        } catch (error) {
            this.showStatus('Error testing API key: ' + error.message, 'error');
        }
    }

    async loadElevenLabsVoices() {
        if (!this.elevenLabsApiKey) {
            this.showStatus('Please enter and test your API key first', 'error');
            return;
        }

        this.showStatus('Loading voices from ElevenLabs...', 'info');
        
        try {
            const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: {
                    'xi-api-key': this.elevenLabsApiKey
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.voices = data.voices || [];
                this.updateVoiceSelection();
                this.showStatus(`Loaded ${this.voices.length} voices from ElevenLabs`, 'success');
            } else {
                this.showStatus('Error loading voices: ' + response.statusText, 'error');
            }
        } catch (error) {
            this.showStatus('Error loading voices: ' + error.message, 'error');
        }
    }

    selectVoice(voiceId) {
        this.currentVoice = voiceId;
        this.showStatus(`Selected voice: ${voiceId}`, 'success');
        this.saveSettings();
    }

    async previewVoice(voiceId) {
        if (this.currentProvider !== 'elevenlabs') {
            this.showStatus('Voice preview only available for ElevenLabs', 'info');
            return;
        }

        const text = "Welcome to Burning Man. I am LAIKA, your Loyal AI K9 Agent.";
        await this.testVoiceWithText(text, voiceId);
    }

    switchTextTab(tabName) {
        // Update tab styling
        document.querySelectorAll('.text-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content visibility
        document.querySelectorAll('.text-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-text`).classList.add('active');
    }

    async testVoice() {
        const activeTab = document.querySelector('.text-tab.active');
        const tabName = activeTab.dataset.tab;
        const textarea = document.getElementById(`${tabName}-textarea`);
        const text = textarea.value.trim();

        if (!text) {
            this.showStatus('Please enter some text to test', 'error');
            return;
        }

        await this.testVoiceWithText(text);
    }

    async testVoiceWithText(text, voiceId = null) {
        if (this.isPlaying) {
            this.stopVoice();
        }

        this.showStatus('Generating speech...', 'info');
        this.isPlaying = true;

        try {
            let audioUrl;
            
            switch (this.currentProvider) {
                case 'elevenlabs':
                    audioUrl = await this.generateElevenLabsSpeech(text, voiceId);
                    break;
                case 'piper':
                    audioUrl = await this.generatePiperSpeech(text);
                    break;
                case 'system':
                    audioUrl = await this.generateSystemSpeech(text);
                    break;
                default:
                    throw new Error('Unknown provider');
            }

            if (audioUrl) {
                await this.playAudio(audioUrl);
                this.showStatus('Playing audio...', 'success');
            }
        } catch (error) {
            this.showStatus('Error generating speech: ' + error.message, 'error');
            this.isPlaying = false;
        }
    }

    async generateElevenLabsSpeech(text, voiceId = null) {
        const voice = voiceId || this.currentVoice || 'pNInz6obpgDQGcFmaJgB'; // Default voice
        const apiKey = this.elevenLabsApiKey;

        if (!apiKey) {
            throw new Error('ElevenLabs API key not configured');
        }

        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: {
                    stability: parseFloat(document.getElementById('stability-slider')?.value || 0.5),
                    similarity_boost: parseFloat(document.getElementById('similarity-slider')?.value || 0.75)
                }
            })
        });

        if (!response.ok) {
            throw new Error(`ElevenLabs API error: ${response.statusText}`);
        }

        const audioBlob = await response.blob();
        return URL.createObjectURL(audioBlob);
    }

    async generatePiperSpeech(text) {
        // Call local Piper TTS API
        const response = await fetch('/api/tts/speak', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                provider: 'piper',
                voice: this.currentVoice || 'joe',
                rate: parseFloat(document.getElementById('rate-slider')?.value || 1.0),
                volume: parseFloat(document.getElementById('volume-slider')?.value || 70) / 100
            })
        });

        if (!response.ok) {
            throw new Error(`Piper TTS error: ${response.statusText}`);
        }

        const audioBlob = await response.blob();
        return URL.createObjectURL(audioBlob);
    }

    async generateSystemSpeech(text) {
        // Call system TTS API
        const response = await fetch('/api/tts/speak', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                provider: 'system',
                voice: this.currentVoice || 'espeak',
                rate: parseFloat(document.getElementById('rate-slider')?.value || 1.0),
                volume: parseFloat(document.getElementById('volume-slider')?.value || 70) / 100
            })
        });

        if (!response.ok) {
            throw new Error(`System TTS error: ${response.statusText}`);
        }

        const audioBlob = await response.blob();
        return URL.createObjectURL(audioBlob);
    }

    async playAudio(audioUrl) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(audioUrl);
            
            audio.addEventListener('ended', () => {
                this.isPlaying = false;
                URL.revokeObjectURL(audioUrl);
                this.showStatus('Audio playback completed', 'success');
                resolve();
            });

            audio.addEventListener('error', (error) => {
                this.isPlaying = false;
                URL.revokeObjectURL(audioUrl);
                reject(error);
            });

            audio.volume = parseFloat(document.getElementById('volume-slider')?.value || 70) / 100;
            audio.playbackRate = parseFloat(document.getElementById('rate-slider')?.value || 1.0);
            
            audio.play().catch(reject);
        });
    }

    stopVoice() {
        this.isPlaying = false;
        // Stop any currently playing audio
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        this.showStatus('Audio stopped', 'info');
    }

    updateVolume(value) {
        // Update volume for any currently playing audio
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
            audio.volume = value / 100;
        });
    }

    updateRate(value) {
        // Update playback rate for any currently playing audio
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
            audio.playbackRate = value;
        });
    }

    updateStability(value) {
        // ElevenLabs specific - would be used in API calls
    }

    updateSimilarity(value) {
        // ElevenLabs specific - would be used in API calls
    }

    showStatus(message, type = 'info') {
        const statusElement = document.getElementById('tts-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status-message status-${type}`;
            statusElement.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 5000);
        }
    }

    loadSettings() {
        try {
            const settings = localStorage.getItem('laika-tts-settings');
            if (settings) {
                const data = JSON.parse(settings);
                this.currentProvider = data.provider || 'piper';
                this.currentVoice = data.voice || null;
                this.elevenLabsApiKey = data.elevenLabsApiKey || '';
                
                // Update UI elements
                const providerRadio = document.getElementById(`provider-${this.currentProvider}`);
                if (providerRadio) {
                    providerRadio.checked = true;
                }

                const apiKeyInput = document.getElementById('elevenlabs-api-key');
                if (apiKeyInput) {
                    apiKeyInput.value = this.elevenLabsApiKey;
                }

                // Update sliders
                if (data.volume !== undefined) {
                    const volumeSlider = document.getElementById('volume-slider');
                    const volumeValue = document.getElementById('volume-value');
                    if (volumeSlider && volumeValue) {
                        volumeSlider.value = data.volume;
                        volumeValue.textContent = `${data.volume}%`;
                    }
                }

                if (data.rate !== undefined) {
                    const rateSlider = document.getElementById('rate-slider');
                    const rateValue = document.getElementById('rate-value');
                    if (rateSlider && rateValue) {
                        rateSlider.value = data.rate;
                        rateValue.textContent = `${data.rate}x`;
                    }
                }

                if (data.stability !== undefined) {
                    const stabilitySlider = document.getElementById('stability-slider');
                    const stabilityValue = document.getElementById('stability-value');
                    if (stabilitySlider && stabilityValue) {
                        stabilitySlider.value = data.stability;
                        stabilityValue.textContent = data.stability;
                    }
                }

                if (data.similarity !== undefined) {
                    const similaritySlider = document.getElementById('similarity-slider');
                    const similarityValue = document.getElementById('similarity-value');
                    if (similaritySlider && similarityValue) {
                        similaritySlider.value = data.similarity;
                        similarityValue.textContent = data.similarity;
                    }
                }
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    saveSettings() {
        try {
            const settings = {
                provider: this.currentProvider,
                voice: this.currentVoice,
                elevenLabsApiKey: this.elevenLabsApiKey,
                volume: parseFloat(document.getElementById('volume-slider')?.value || 70),
                rate: parseFloat(document.getElementById('rate-slider')?.value || 1.0),
                stability: parseFloat(document.getElementById('stability-slider')?.value || 0.5),
                similarity: parseFloat(document.getElementById('similarity-slider')?.value || 0.75)
            };

            localStorage.setItem('laika-tts-settings', JSON.stringify(settings));
            this.showStatus('Settings saved successfully', 'success');
        } catch (error) {
            this.showStatus('Error saving settings: ' + error.message, 'error');
        }
    }

    resetSettings() {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            localStorage.removeItem('laika-tts-settings');
            location.reload();
        }
    }

    exportConfig() {
        try {
            const settings = {
                provider: this.currentProvider,
                voice: this.currentVoice,
                volume: parseFloat(document.getElementById('volume-slider')?.value || 70),
                rate: parseFloat(document.getElementById('rate-slider')?.value || 1.0),
                stability: parseFloat(document.getElementById('stability-slider')?.value || 0.5),
                similarity: parseFloat(document.getElementById('similarity-slider')?.value || 0.75),
                timestamp: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'laika-tts-config.json';
            a.click();
            URL.revokeObjectURL(url);
            
            this.showStatus('Configuration exported successfully', 'success');
        } catch (error) {
            this.showStatus('Error exporting configuration: ' + error.message, 'error');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.ttsSettings = new TTSSettings();
});
