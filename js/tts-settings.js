/**
 * LAIKA TTS Settings Manager
 * Handles voice configuration, testing, and settings management
 */

class TTSSettings {
    constructor() {
        this.currentConfig = {
            provider: 'piper',
            voice_id: 'default',
            volume: 70,
            rate: 1.0,
            stability: 0.5,
            similarity_boost: 0.75,
            language: 'en-US'
        };
        
        this.voices = {
            elevenlabs: [
                {
                    id: 'GN4wbsbejSnGSa1AzjH5',
                    name: 'Ekaterina',
                    description: 'Multilingual female voice (English/Russian)',
                    gender: 'female',
                    languages: ['en-US', 'ru-RU'],
                    premium: true
                },
                {
                    id: 'oKxkBkm5a8Bmrd1Whf2c',
                    name: 'Prince Nuri',
                    description: 'Clear male voice with good pronunciation',
                    gender: 'male',
                    languages: ['en-US'],
                    premium: true
                },
                {
                    id: 'zrHiDhphv9ZnVXBqCLjz',
                    name: 'Mimi',
                    description: 'Young female voice, cheerful and friendly',
                    gender: 'female',
                    languages: ['en-US'],
                    premium: true
                }
            ],
            piper: [
                {
                    id: 'en_US-joe-medium',
                    name: 'Joe (English Male)',
                    description: 'Clear male English voice',
                    gender: 'male',
                    languages: ['en-US'],
                    path: 'models/piper/en_US-joe-medium.onnx'
                },
                {
                    id: 'en_US-amy-medium',
                    name: 'Amy (English Female)',
                    description: 'Natural female English voice',
                    gender: 'female',
                    languages: ['en-US'],
                    path: 'models/piper/en_US-amy-medium.onnx'
                },
                {
                    id: 'ru_RU-denis-medium',
                    name: 'Denis (Russian Male)',
                    description: 'Clear male Russian voice',
                    gender: 'male',
                    languages: ['ru-RU'],
                    path: 'models/piper/ru_RU-denis-medium.onnx'
                },
                {
                    id: 'ru_RU-irina-medium',
                    name: 'Irina (Russian Female)',
                    description: 'Natural female Russian voice',
                    gender: 'female',
                    languages: ['ru-RU'],
                    path: 'models/piper/ru_RU-irina-medium.onnx'
                }
            ],
            system: [
                {
                    id: 'espeak-default',
                    name: 'eSpeak Default',
                    description: 'Basic system voice (espeak)',
                    gender: 'neutral',
                    languages: ['en-US', 'ru-RU']
                },
                {
                    id: 'festival-default',
                    name: 'Festival Default',
                    description: 'System voice (festival)',
                    gender: 'neutral',
                    languages: ['en-US']
                }
            ]
        };
        
        this.isPlaying = false;
        this.currentAudio = null;
        
        this.init();
    }
    
    init() {
        this.loadCurrentSettings();
        this.bindEventListeners();
        this.updateVoiceSelection();
        this.updateVolumeDisplay();
        this.updateProviderControls();
        this.checkConnectionStatus();
    }
    
    bindEventListeners() {
        // Provider selection
        document.querySelectorAll('input[name="provider"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentConfig.provider = e.target.value;
                this.updateVoiceSelection();
                this.updateProviderControls();
            });
        });
        
        // Volume control
        const volumeSlider = document.getElementById('volume-slider');
        volumeSlider.addEventListener('input', (e) => {
            this.currentConfig.volume = parseInt(e.target.value);
            this.updateVolumeDisplay();
        });
        
        // Speech rate control
        const rateSlider = document.getElementById('rate-slider');
        rateSlider.addEventListener('input', (e) => {
            this.currentConfig.rate = parseFloat(e.target.value);
            document.getElementById('rate-value').textContent = `${e.target.value}x`;
        });
        
        // ElevenLabs controls
        const stabilitySlider = document.getElementById('stability-slider');
        stabilitySlider.addEventListener('input', (e) => {
            this.currentConfig.stability = parseFloat(e.target.value);
            document.getElementById('stability-value').textContent = e.target.value;
        });
        
        const similaritySlider = document.getElementById('similarity-slider');
        similaritySlider.addEventListener('input', (e) => {
            this.currentConfig.similarity_boost = parseFloat(e.target.value);
            document.getElementById('similarity-value').textContent = e.target.value;
        });
        
        // Test buttons
        document.querySelectorAll('.test-btn[data-text]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const text = e.target.getAttribute('data-text');
                this.testVoice(text);
            });
        });
        
        // Custom test
        document.getElementById('test-custom').addEventListener('click', () => {
            const customText = document.getElementById('custom-text').value.trim();
            if (customText) {
                this.testVoice(customText);
            }
        });
        
        // Settings buttons
        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveSettings();
        });
        
        document.getElementById('reset-settings').addEventListener('click', () => {
            this.resetToDefaults();
        });
        
        document.getElementById('export-config').addEventListener('click', () => {
            this.exportConfig();
        });
    }
    
    updateVoiceSelection() {
        const container = document.getElementById('voice-selection-container');
        const provider = this.currentConfig.provider;
        const voices = this.voices[provider] || [];
        
        container.innerHTML = '';
        
        if (voices.length === 0) {
            container.innerHTML = '<p>No voices available for this provider.</p>';
            return;
        }
        
        voices.forEach(voice => {
            const voiceOption = document.createElement('div');
            voiceOption.className = 'voice-option';
            voiceOption.dataset.voiceId = voice.id;
            
            const isSelected = this.currentConfig.voice_id === voice.id;
            if (isSelected) {
                voiceOption.classList.add('selected');
            }
            
            const genderIcon = voice.gender === 'female' ? '👩' : voice.gender === 'male' ? '👨' : '🤖';
            const premiumBadge = voice.premium ? '<span class="provider-badge">Premium</span>' : '';
            
            voiceOption.innerHTML = `
                <div class="voice-provider">
                    <input type="radio" name="voice" value="${voice.id}" id="voice-${voice.id}" ${isSelected ? 'checked' : ''}>
                    <label for="voice-${voice.id}"><strong>${genderIcon} ${voice.name}</strong></label>
                    ${premiumBadge}
                </div>
                <p>${voice.description}</p>
                <small>Languages: ${voice.languages.join(', ')}</small>
            `;
            
            voiceOption.addEventListener('click', () => {
                // Update selection
                container.querySelectorAll('.voice-option').forEach(opt => opt.classList.remove('selected'));
                voiceOption.classList.add('selected');
                
                // Update radio button
                const radio = voiceOption.querySelector('input[type="radio"]');
                radio.checked = true;
                
                // Update config
                this.currentConfig.voice_id = voice.id;
            });
            
            container.appendChild(voiceOption);
        });
    }
    
    updateVolumeDisplay() {
        const volumeValue = document.getElementById('volume-value');
        const volumeLevel = document.getElementById('volume-level');
        
        volumeValue.textContent = `${this.currentConfig.volume}%`;
        volumeLevel.style.width = `${this.currentConfig.volume}%`;
    }
    
    updateProviderControls() {
        const stabilityControl = document.getElementById('stability-control');
        const similarityControl = document.getElementById('similarity-control');
        
        // Show/hide ElevenLabs specific controls
        if (this.currentConfig.provider === 'elevenlabs') {
            stabilityControl.style.display = 'block';
            similarityControl.style.display = 'block';
        } else {
            stabilityControl.style.display = 'none';
            similarityControl.style.display = 'none';
        }
    }
    
    async testVoice(text) {
        if (this.isPlaying) {
            this.showStatus('⏸️ Stopping current playback...', 'info');
            this.stopCurrentAudio();
            return;
        }
        
        this.showStatus('🔊 Generating speech...', 'info');
        this.isPlaying = true;
        
        // Update test buttons
        document.querySelectorAll('.test-btn').forEach(btn => {
            btn.textContent = btn.textContent.replace('Test', 'Stop').replace('🧪', '⏸️');
        });
        
        try {
            const response = await fetch('/api/tts/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    provider: this.currentConfig.provider,
                    voice_id: this.currentConfig.voice_id,
                    settings: {
                        volume: this.currentConfig.volume / 100,
                        rate: this.currentConfig.rate,
                        stability: this.currentConfig.stability,
                        similarity_boost: this.currentConfig.similarity_boost
                    }
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.audio_url) {
                this.showStatus('▶️ Playing speech...', 'success');
                this.playAudio(result.audio_url);
            } else {
                throw new Error(result.error || 'Failed to generate speech');
            }
            
        } catch (error) {
            console.error('TTS test error:', error);
            this.showStatus(`❌ Error: ${error.message}`, 'error');
            this.isPlaying = false;
            this.resetTestButtons();
        }
    }
    
    playAudio(audioUrl) {
        this.currentAudio = new Audio(audioUrl);
        
        this.currentAudio.addEventListener('ended', () => {
            this.showStatus('✅ Playback complete', 'success');
            this.isPlaying = false;
            this.resetTestButtons();
        });
        
        this.currentAudio.addEventListener('error', (e) => {
            this.showStatus('❌ Playback error', 'error');
            this.isPlaying = false;
            this.resetTestButtons();
        });
        
        this.currentAudio.play().catch(error => {
            this.showStatus(`❌ Playback failed: ${error.message}`, 'error');
            this.isPlaying = false;
            this.resetTestButtons();
        });
    }
    
    stopCurrentAudio() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
        }
        this.isPlaying = false;
        this.resetTestButtons();
        this.showStatus('⏹️ Playback stopped', 'info');
    }
    
    resetTestButtons() {
        document.querySelectorAll('.test-btn').forEach(btn => {
            const originalText = btn.getAttribute('data-text') ? 
                btn.textContent.split(' ')[0] : 'Test';
            btn.textContent = originalText;
        });
        
        document.getElementById('test-custom').textContent = 'Test';
    }
    
    showStatus(message, type = 'info') {
        const statusDiv = document.getElementById('tts-status');
        statusDiv.style.display = 'block';
        statusDiv.textContent = message;
        
        // Update styling based on type
        statusDiv.className = `status-${type}`;
        
        switch (type) {
            case 'success':
                statusDiv.style.background = 'rgba(76, 175, 80, 0.2)';
                statusDiv.style.borderColor = '#4CAF50';
                statusDiv.style.color = '#4CAF50';
                break;
            case 'error':
                statusDiv.style.background = 'rgba(244, 67, 54, 0.2)';
                statusDiv.style.borderColor = '#f44336';
                statusDiv.style.color = '#f44336';
                break;
            case 'info':
            default:
                statusDiv.style.background = 'rgba(0, 255, 255, 0.1)';
                statusDiv.style.borderColor = '#00ffff';
                statusDiv.style.color = '#00ffff';
                break;
        }
        
        statusDiv.style.border = '1px solid';
        
        // Auto-hide after 5 seconds for success/info messages
        if (type !== 'error') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
    }
    
    async saveSettings() {
        this.showStatus('💾 Saving settings...', 'info');
        
        try {
            const response = await fetch('/api/tts/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.currentConfig)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.showStatus('✅ Settings saved successfully!', 'success');
                
                // Update save status
                const saveStatus = document.getElementById('save-status');
                saveStatus.innerHTML = '<span style="color: #4CAF50;">✅ Saved</span>';
                setTimeout(() => {
                    saveStatus.innerHTML = '';
                }, 3000);
            } else {
                throw new Error(result.error || 'Failed to save settings');
            }
            
        } catch (error) {
            console.error('Save settings error:', error);
            this.showStatus(`❌ Save failed: ${error.message}`, 'error');
        }
    }
    
    resetToDefaults() {
        if (!confirm('Reset all voice settings to defaults? This cannot be undone.')) {
            return;
        }
        
        // Reset to default values
        this.currentConfig = {
            provider: 'piper',
            voice_id: 'en_US-amy-medium',
            volume: 70,
            rate: 1.0,
            stability: 0.5,
            similarity_boost: 0.75,
            language: 'en-US'
        };
        
        // Update UI
        document.getElementById('provider-piper').checked = true;
        document.getElementById('volume-slider').value = 70;
        document.getElementById('rate-slider').value = 1.0;
        document.getElementById('stability-slider').value = 0.5;
        document.getElementById('similarity-slider').value = 0.75;
        
        this.updateVoiceSelection();
        this.updateVolumeDisplay();
        this.updateProviderControls();
        
        // Update value displays
        document.getElementById('rate-value').textContent = '1.0x';
        document.getElementById('stability-value').textContent = '0.5';
        document.getElementById('similarity-value').textContent = '0.75';
        
        this.showStatus('🔄 Settings reset to defaults', 'info');
    }
    
    exportConfig() {
        const config = {
            ...this.currentConfig,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };
        
        const dataStr = JSON.stringify(config, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `laika-tts-config-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        this.showStatus('📤 Configuration exported', 'success');
    }
    
    async loadCurrentSettings() {
        try {
            const response = await fetch('/api/tts/settings');
            if (response.ok) {
                const settings = await response.json();
                if (settings.success && settings.config) {
                    this.currentConfig = { ...this.currentConfig, ...settings.config };
                    this.applySettingsToUI();
                }
            }
        } catch (error) {
            console.warn('Could not load current settings:', error);
        }
    }
    
    applySettingsToUI() {
        // Update provider selection
        const providerRadio = document.getElementById(`provider-${this.currentConfig.provider}`);
        if (providerRadio) {
            providerRadio.checked = true;
        }
        
        // Update sliders
        document.getElementById('volume-slider').value = this.currentConfig.volume;
        document.getElementById('rate-slider').value = this.currentConfig.rate;
        document.getElementById('stability-slider').value = this.currentConfig.stability;
        document.getElementById('similarity-slider').value = this.currentConfig.similarity_boost;
        
        // Update displays
        document.getElementById('rate-value').textContent = `${this.currentConfig.rate}x`;
        document.getElementById('stability-value').textContent = this.currentConfig.stability.toString();
        document.getElementById('similarity-value').textContent = this.currentConfig.similarity_boost.toString();
    }
    
    async checkConnectionStatus() {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        
        try {
            const response = await fetch('/api/health');
            if (response.ok) {
                statusDot.className = 'status-indicator online';
                statusText.textContent = 'Connected to LAIKA';
            } else {
                throw new Error('Health check failed');
            }
        } catch (error) {
            statusDot.className = 'status-indicator offline';
            statusText.textContent = 'Connection issues';
        }
        
        // Check again in 30 seconds
        setTimeout(() => this.checkConnectionStatus(), 30000);
    }
}

// Export for use in HTML
window.TTSSettings = TTSSettings;
