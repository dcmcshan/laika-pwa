/**
 * LAIKA TTS Settings Controller
 * Handles voice provider selection, API configuration, and voice testing
 */

class TTSSettings {
    constructor() {
        this.currentProvider = 'piper'; // Default to Piper
        this.currentVoice = null;
        this.elevenLabsApiKey = '';
        this.openaiApiKey = '';
        this.voices = {};
        this.audioPlayer = null;
        
        this.initializeEventListeners();
        this.initializeSliders();
        this.loadSettings();
        this.updateUI();
        this.initializeVoiceDropdowns();
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

        // ElevenLabs API key testing
        const testElevenLabsBtn = document.getElementById('test-elevenlabs-api');
        if (testElevenLabsBtn) {
            testElevenLabsBtn.addEventListener('click', () => this.testElevenLabsAPI());
        }

        // OpenAI API key testing
        const testOpenAIBtn = document.getElementById('test-openai-api');
        if (testOpenAIBtn) {
            testOpenAIBtn.addEventListener('click', () => this.testOpenAIAPI());
        }

        // Load voices buttons
        const loadElevenLabsBtn = document.getElementById('load-elevenlabs-voices');
        if (loadElevenLabsBtn) {
            loadElevenLabsBtn.addEventListener('click', () => this.loadElevenLabsVoices());
        }

        const loadOpenAIBtn = document.getElementById('load-openai-voices');
        if (loadOpenAIBtn) {
            loadOpenAIBtn.addEventListener('click', () => this.loadOpenAIVoices());
        }

        // Voice selection dropdowns
        document.querySelectorAll('.voice-dropdown').forEach(dropdown => {
            dropdown.addEventListener('change', (e) => {
                const provider = e.target.id.replace('-voice-dropdown', '');
                this.currentProvider = provider;
                this.currentVoice = e.target.value;
                this.updatePlayButton(e.target.id);
                this.saveSettings();
            });
        });

        // Play buttons
        document.querySelectorAll('.play-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const provider = e.target.id.replace('-play-btn', '');
                this.testVoiceWithProvider(provider);
            });
        });

        // Auto-translate button
        const translateBtn = document.getElementById('translate-button');
        if (translateBtn) {
            translateBtn.addEventListener('click', () => this.autoTranslate());
        }

        // Text area changes for auto-translation
        const englishTextarea = document.getElementById('english-textarea');
        const russianTextarea = document.getElementById('russian-textarea');
        
        if (englishTextarea) {
            englishTextarea.addEventListener('input', () => this.handleTextChange('english'));
        }
        if (russianTextarea) {
            russianTextarea.addEventListener('input', () => this.handleTextChange('russian'));
        }

        // Test buttons
        document.querySelectorAll('.test-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const text = e.target.dataset.text;
                this.testVoiceWithText(text);
            });
        });

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
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                document.getElementById('volume-value').textContent = e.target.value + '%';
                this.updateVolume();
            });
        }

        // Rate slider
        const rateSlider = document.getElementById('rate-slider');
        if (rateSlider) {
            rateSlider.addEventListener('input', (e) => {
                document.getElementById('rate-value').textContent = e.target.value + 'x';
                this.updateRate();
            });
        }

        // Stability slider (ElevenLabs)
        const stabilitySlider = document.getElementById('stability-slider');
        if (stabilitySlider) {
            stabilitySlider.addEventListener('input', (e) => {
                document.getElementById('stability-value').textContent = e.target.value;
                this.updateStability();
            });
        }

        // Similarity slider (ElevenLabs)
        const similaritySlider = document.getElementById('similarity-slider');
        if (similaritySlider) {
            similaritySlider.addEventListener('input', (e) => {
                document.getElementById('similarity-value').textContent = e.target.value;
                this.updateSimilarity();
            });
        }
    }

    initializeVoiceDropdowns() {
        // Initialize Piper voices (pre-populated)
        const piperDropdown = document.getElementById('piper-voice-dropdown');
        if (piperDropdown) {
            console.log('Piper voices initialized');
        }

        // Initialize System voices (pre-populated)
        const systemDropdown = document.getElementById('system-voice-dropdown');
        if (systemDropdown) {
            console.log('System voices initialized');
        }

        // Initialize ElevenLabs and OpenAI voices (will be loaded via API)
        console.log('Voice dropdowns initialized');
        
        // Update play buttons based on current selections
        this.updateVoiceSelection();
    }

    updateUI() {
        // Show/hide provider-specific sections
        const providers = ['elevenlabs', 'openai', 'piper', 'system'];
        providers.forEach(provider => {
            const configSection = document.getElementById(`${provider}-config`);
            const voiceOption = document.querySelector(`[data-provider="${provider}"]`);
            
            if (configSection && voiceOption) {
                if (this.currentProvider === provider) {
                    configSection.style.display = 'block';
                    voiceOption.classList.add('selected');
                } else {
                    configSection.style.display = 'none';
                    voiceOption.classList.remove('selected');
                }
            }
        });

        // Show/hide ElevenLabs-specific controls
        const stabilityControl = document.getElementById('stability-control');
        const similarityControl = document.getElementById('similarity-control');
        
        if (stabilityControl) {
            stabilityControl.style.display = this.currentProvider === 'elevenlabs' ? 'block' : 'none';
        }
        if (similarityControl) {
            similarityControl.style.display = this.currentProvider === 'elevenlabs' ? 'block' : 'none';
        }

        // Update voice selection
        this.updateVoiceSelection();
    }

    updateVoiceSelection() {
        // Enable/disable play buttons based on voice selection
        const providers = ['elevenlabs', 'openai', 'piper', 'system'];
        providers.forEach(provider => {
            const dropdown = document.getElementById(`${provider}-voice-dropdown`);
            const playBtn = document.getElementById(`${provider}-play-btn`);
            
            if (dropdown && playBtn) {
                const hasVoice = dropdown.value && dropdown.value !== '';
                playBtn.disabled = !hasVoice;
            }
        });
    }

    updatePlayButton(dropdownId) {
        const provider = dropdownId.replace('-voice-dropdown', '');
        const playBtn = document.getElementById(`${provider}-play-btn`);
        const dropdown = document.getElementById(dropdownId);
        
        if (playBtn && dropdown) {
            playBtn.disabled = !dropdown.value || dropdown.value === '';
        }
    }

    async testElevenLabsAPI() {
        const apiKeyInput = document.getElementById('elevenlabs-api-key');
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            this.showStatus('Please enter an ElevenLabs API key', 'error');
            return;
        }

        this.showStatus('Testing ElevenLabs API key...', 'info');
        
        try {
            // Use the centralized API key testing endpoint
            const response = await fetch('/api/keys/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ service: 'elevenlabs', api_key: apiKey })
            });

            const data = await response.json();
            
            if (data.success) {
                const testResult = data.test_results.tts;
                if (testResult && testResult.success) {
                    this.elevenLabsApiKey = apiKey;
                    this.showStatus('ElevenLabs API key is valid!', 'success');
                    this.loadElevenLabsVoices();
                    this.saveSettings();
                } else {
                    this.showStatus('Invalid ElevenLabs API key: ' + (testResult?.error || 'Unknown error'), 'error');
                }
            } else {
                this.showStatus('Failed to test API key: ' + data.error, 'error');
            }
        } catch (error) {
            this.showStatus('Failed to test API key: ' + error.message, 'error');
        }
    }

    async testOpenAIAPI() {
        const apiKeyInput = document.getElementById('openai-api-key');
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            this.showStatus('Please enter an OpenAI API key', 'error');
            return;
        }

        this.showStatus('Testing OpenAI API key...', 'info');
        
        try {
            // Use the centralized API key testing endpoint
            const response = await fetch('/api/keys/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ service: 'openai', api_key: apiKey })
            });

            const data = await response.json();
            
            if (data.success) {
                const testResult = data.test_results.llm;
                if (testResult && testResult.success) {
                    this.openaiApiKey = apiKey;
                    this.showStatus('OpenAI API key is valid!', 'success');
                    this.saveSettings();
                } else {
                    this.showStatus('Invalid OpenAI API key: ' + (testResult?.error || 'Unknown error'), 'error');
                }
            } else {
                this.showStatus('Failed to test API key: ' + data.error, 'error');
            }
        } catch (error) {
            this.showStatus('Failed to test API key: ' + error.message, 'error');
        }
    }

    async loadElevenLabsVoices() {
        if (!this.elevenLabsApiKey) {
            this.showStatus('Please configure ElevenLabs API key first', 'error');
            return;
        }

        try {
            const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: {
                    'xi-api-key': this.elevenLabsApiKey
                }
            });

            if (response.ok) {
                const voices = await response.json();
                this.voices.elevenlabs = voices.voices || [];
                this.renderElevenLabsVoices();
                this.showStatus(`Loaded ${this.voices.elevenlabs.length} ElevenLabs voices`, 'success');
            } else {
                this.showStatus('Failed to load ElevenLabs voices', 'error');
            }
        } catch (error) {
            this.showStatus('Failed to load voices: ' + error.message, 'error');
        }
    }

    renderElevenLabsVoices() {
        const dropdown = document.getElementById('elevenlabs-voice-dropdown');
        if (!dropdown) return;

        dropdown.innerHTML = '<option value="">Select a voice...</option>';
        
        if (this.voices.elevenlabs && this.voices.elevenlabs.length > 0) {
            this.voices.elevenlabs.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.voice_id;
                option.textContent = `${voice.name} (${voice.labels?.accent || 'Unknown'})`;
                dropdown.appendChild(option);
            });
        }
    }

    async loadOpenAIVoices() {
        if (!this.openaiApiKey) {
            this.showStatus('Please configure OpenAI API key first', 'error');
            return;
        }

        this.showStatus('Loading OpenAI voices...', 'info');

        try {
            // OpenAI TTS has predefined voices
            const openaiVoices = [
                { id: 'alloy', name: 'Alloy', description: 'Balanced and versatile' },
                { id: 'echo', name: 'Echo', description: 'Clear and articulate' },
                { id: 'fable', name: 'Fable', description: 'Narrative and engaging' },
                { id: 'onyx', name: 'Onyx', description: 'Deep and resonant' },
                { id: 'nova', name: 'Nova', description: 'Bright and energetic' },
                { id: 'shimmer', name: 'Shimmer', description: 'Smooth and melodic' }
            ];

            this.voices.openai = openaiVoices;
            this.renderOpenAIVoices();
            this.showStatus(`Loaded ${openaiVoices.length} OpenAI voices`, 'success');
        } catch (error) {
            this.showStatus('Failed to load OpenAI voices: ' + error.message, 'error');
        }
    }

    renderOpenAIVoices() {
        const dropdown = document.getElementById('openai-voice-dropdown');
        if (!dropdown) return;

        dropdown.innerHTML = '<option value="">Select a voice...</option>';
        
        if (this.voices.openai && this.voices.openai.length > 0) {
            this.voices.openai.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.id;
                option.textContent = `${voice.name} - ${voice.description}`;
                dropdown.appendChild(option);
            });
        }
    }

    async testVoiceWithProvider(provider, voice = null) {
        const textarea = document.getElementById('english-textarea');
        const text = textarea ? textarea.value.trim() : 'Hello, I am LAIKA';
        
        if (!text) {
            this.showStatus('Please enter text to test', 'error');
            return;
        }

        this.testVoiceWithText(text, provider, voice);
    }

    async testVoiceWithText(text, provider = null, voice = null) {
        const selectedProvider = provider || this.currentProvider;
        const selectedVoice = voice || this.currentVoice;
        
        this.showStatus(`Testing ${selectedProvider} TTS...`, 'info');
        
        try {
            // Use the LAIKA TTS endpoint
            const response = await fetch('/api/tts/speak', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    provider: selectedProvider,
                    voice: selectedVoice,
                    volume: document.getElementById('volume-slider')?.value || 70,
                    rate: document.getElementById('rate-slider')?.value || 1.0
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.showStatus(`✅ ${result.message}`, 'success');
            } else {
                this.showStatus(`❌ ${result.error}`, 'error');
            }
        } catch (error) {
            this.showStatus('Failed to test voice: ' + error.message, 'error');
        }
    }

    async autoTranslate() {
        const englishTextarea = document.getElementById('english-textarea');
        const russianTextarea = document.getElementById('russian-textarea');
        
        if (!englishTextarea || !russianTextarea) return;

        const englishText = englishTextarea.value.trim();
        const russianText = russianTextarea.value.trim();

        // Determine which text to translate
        let sourceText, targetTextarea, targetLang;
        
        if (englishText && !russianText) {
            sourceText = englishText;
            targetTextarea = russianTextarea;
            targetLang = 'ru';
        } else if (russianText && !englishText) {
            sourceText = russianText;
            targetTextarea = englishTextarea;
            targetLang = 'en';
        } else {
            // If both have text, translate English to Russian
            sourceText = englishText;
            targetTextarea = russianTextarea;
            targetLang = 'ru';
        }

        if (!sourceText) {
            this.showStatus('Please enter text to translate', 'error');
            return;
        }

        this.showStatus('Translating...', 'info');

        try {
            const response = await fetch('/api/tts/speak', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: sourceText,
                    translate_to: targetLang
                })
            });

            const result = await response.json();
            
            if (result.success && result.translated) {
                targetTextarea.value = result.text;
                this.showStatus('Translation completed!', 'success');
            } else {
                this.showStatus('Translation failed', 'error');
            }
        } catch (error) {
            this.showStatus('Translation error: ' + error.message, 'error');
        }
    }

    handleTextChange(source) {
        // Auto-translate on text change (debounced)
        clearTimeout(this.translateTimeout);
        this.translateTimeout = setTimeout(() => {
            this.autoTranslate();
        }, 1000); // 1 second delay
    }

    updateVolume() {
        const volume = document.getElementById('volume-slider')?.value || 70;
        // Volume control would be applied to audio playback
        console.log('Volume updated:', volume);
    }

    updateRate() {
        const rate = document.getElementById('rate-slider')?.value || 1.0;
        // Rate control would be applied to TTS generation
        console.log('Rate updated:', rate);
    }

    updateStability() {
        const stability = document.getElementById('stability-slider')?.value || 0.5;
        // Stability control for ElevenLabs
        console.log('Stability updated:', stability);
    }

    updateSimilarity() {
        const similarity = document.getElementById('similarity-slider')?.value || 0.75;
        // Similarity control for ElevenLabs
        console.log('Similarity updated:', similarity);
    }

    showStatus(message, type = 'info') {
        const statusElement = document.getElementById('tts-status');
        if (!statusElement) return;

        statusElement.textContent = message;
        statusElement.className = `status-message status-${type}`;
        statusElement.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    }

    loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('laika_tts_settings') || '{}');
            
            this.currentProvider = settings.provider || 'piper';
            this.currentVoice = settings.voice || null;
            this.elevenLabsApiKey = settings.elevenLabsApiKey || '';
            this.openaiApiKey = settings.openaiApiKey || '';

            // Update UI elements
            const providerRadio = document.getElementById(`provider-${this.currentProvider}`);
            if (providerRadio) {
                providerRadio.checked = true;
            }

            // Set API keys
            const elevenLabsInput = document.getElementById('elevenlabs-api-key');
            if (elevenLabsInput) {
                elevenLabsInput.value = this.elevenLabsApiKey;
            }

            const openaiInput = document.getElementById('openai-api-key');
            if (openaiInput) {
                openaiInput.value = this.openaiApiKey;
            }

            // Set voice selections
            if (this.currentVoice) {
                const voiceDropdown = document.getElementById(`${this.currentProvider}-voice-dropdown`);
                if (voiceDropdown) {
                    voiceDropdown.value = this.currentVoice;
                }
            }

            // Set slider values
            const volumeSlider = document.getElementById('volume-slider');
            if (volumeSlider) {
                volumeSlider.value = settings.volume || 70;
                document.getElementById('volume-value').textContent = (settings.volume || 70) + '%';
            }

            const rateSlider = document.getElementById('rate-slider');
            if (rateSlider) {
                rateSlider.value = settings.rate || 1.0;
                document.getElementById('rate-value').textContent = (settings.rate || 1.0) + 'x';
            }

        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    saveSettings() {
        try {
            const settings = {
                provider: this.currentProvider,
                voice: this.currentVoice,
                elevenLabsApiKey: this.elevenLabsApiKey,
                openaiApiKey: this.openaiApiKey,
                volume: document.getElementById('volume-slider')?.value || 70,
                rate: document.getElementById('rate-slider')?.value || 1.0,
                stability: document.getElementById('stability-slider')?.value || 0.5,
                similarity: document.getElementById('similarity-slider')?.value || 0.75
            };

            localStorage.setItem('laika_tts_settings', JSON.stringify(settings));
            this.showStatus('Settings saved!', 'success');
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showStatus('Failed to save settings', 'error');
        }
    }

    resetSettings() {
        if (confirm('Are you sure you want to reset all TTS settings?')) {
            localStorage.removeItem('laika_tts_settings');
            location.reload();
        }
    }

    exportConfig() {
        try {
            const settings = JSON.parse(localStorage.getItem('laika_tts_settings') || '{}');
            const dataStr = JSON.stringify(settings, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = 'laika_tts_config.json';
            link.click();
            
            this.showStatus('Configuration exported!', 'success');
        } catch (error) {
            console.error('Failed to export config:', error);
            this.showStatus('Failed to export configuration', 'error');
        }
    }
}

// Initialize when DOM is loaded
// Global function for API key management (called from HTML)
async function saveApiKey(keyName, inputId) {
    const input = document.getElementById(inputId);
    const apiKey = input.value.trim();
    
    if (!apiKey) {
        if (window.ttsSettings) {
            window.ttsSettings.showStatus('Please enter an API key', 'error');
        }
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
            if (window.ttsSettings) {
                window.ttsSettings.showStatus('API key saved successfully!', 'success');
            }
            // Mask the key in the input field
            input.value = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
        } else {
            if (window.ttsSettings) {
                window.ttsSettings.showStatus('Failed to save API key: ' + data.error, 'error');
            }
        }
    } catch (error) {
        if (window.ttsSettings) {
            window.ttsSettings.showStatus('Error saving API key: ' + error.message, 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    window.ttsSettings = new TTSSettings();
});
