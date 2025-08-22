/**
 * LAIKA Voice Manager
 * Handles downloading, caching, and managing offline voices for all TTS providers
 */

class VoiceManager {
    constructor() {
        this.voices = {
            elevenlabs: [],
            openai: [],
            piper: []
        };
        this.downloadQueue = [];
        this.isDownloading = false;
        
        // Default voice configurations
        this.defaultVoices = {
            elevenlabs: {
                id: 'GN4wbsbejSnGSa1AzjH5',
                name: 'Ekaterina',
                accent: 'Russian',
                gender: 'Female',
                age: 'Young Adult',
                use_case: 'Conversational',
                model: 'eleven_multilingual_v2',
                stability: 0.5,
                similarity_boost: 0.75
            },
            openai: {
                id: 'alloy',
                name: 'Alloy',
                description: 'Balanced and versatile',
                model: 'tts-1'
            },
            piper: {
                id: 'joe',
                name: 'Joe (English Male)',
                language: 'en-US',
                quality: 'medium'
            }
        };
        
        this.initializeVoiceManager();
    }

    async initializeVoiceManager() {
        console.log('🎵 Initializing Voice Manager...');
        
        // Load cached voices
        await this.loadCachedVoices();
        
        // Pre-populate with default voices
        this.populateDefaultVoices();
        
        console.log('✅ Voice Manager initialized');
    }

    async loadCachedVoices() {
        try {
            // Load from localStorage
            const cached = localStorage.getItem('laika_cached_voices');
            if (cached) {
                const parsed = JSON.parse(cached);
                this.voices = { ...this.voices, ...parsed };
                console.log('📦 Loaded cached voices:', Object.keys(this.voices).map(k => `${k}: ${this.voices[k].length}`));
            }
        } catch (error) {
            console.error('❌ Failed to load cached voices:', error);
        }
    }

    populateDefaultVoices() {
        // Add default voices if not already present
        if (!this.voices.elevenlabs.find(v => v.voice_id === this.defaultVoices.elevenlabs.id)) {
            this.voices.elevenlabs.unshift(this.defaultVoices.elevenlabs);
        }
        
        if (!this.voices.openai.find(v => v.id === this.defaultVoices.openai.id)) {
            this.voices.openai.unshift(this.defaultVoices.openai);
        }
        
        if (!this.voices.piper.find(v => v.id === this.defaultVoices.piper.id)) {
            this.voices.piper.unshift(this.defaultVoices.piper);
        }
    }

    async downloadElevenLabsVoices(apiKey) {
        if (!apiKey) {
            throw new Error('ElevenLabs API key required');
        }

        try {
            console.log('📥 Downloading ElevenLabs voices...');
            
            const response = await fetch('https://api.elevenlabs.io/v1/voices', {
                headers: {
                    'xi-api-key': apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const voices = data.voices || [];
            
            // Process and store voices
            this.voices.elevenlabs = voices.map(voice => ({
                voice_id: voice.voice_id,
                name: voice.name,
                labels: voice.labels || {},
                category: voice.category,
                description: voice.description,
                preview_url: voice.preview_url,
                available_for_tiers: voice.available_for_tiers,
                settings: voice.settings,
                sharing: voice.sharing,
                high_quality_base_model_ids: voice.high_quality_base_model_ids,
                safety_control: voice.safety_control,
                safety_labels: voice.safety_labels,
                voice_verification: voice.voice_verification
            }));

            // Cache voices
            this.cacheVoices();
            
            console.log(`✅ Downloaded ${voices.length} ElevenLabs voices`);
            return this.voices.elevenlabs;
            
        } catch (error) {
            console.error('❌ Failed to download ElevenLabs voices:', error);
            throw error;
        }
    }

    async downloadOpenAIVoices(apiKey) {
        if (!apiKey) {
            throw new Error('OpenAI API key required');
        }

        try {
            console.log('📥 Downloading OpenAI voices...');
            
            // OpenAI TTS has predefined voices
            const voices = [
                { id: 'alloy', name: 'Alloy', description: 'Balanced and versatile' },
                { id: 'echo', name: 'Echo', description: 'Clear and articulate' },
                { id: 'fable', name: 'Fable', description: 'Narrative and engaging' },
                { id: 'onyx', name: 'Onyx', description: 'Deep and resonant' },
                { id: 'nova', name: 'Nova', description: 'Bright and energetic' },
                { id: 'shimmer', name: 'Shimmer', description: 'Smooth and melodic' }
            ];

            this.voices.openai = voices;
            this.cacheVoices();
            
            console.log(`✅ Downloaded ${voices.length} OpenAI voices`);
            return this.voices.openai;
            
        } catch (error) {
            console.error('❌ Failed to download OpenAI voices:', error);
            throw error;
        }
    }

    async downloadPiperVoices() {
        try {
            console.log('📥 Loading Piper voices...');
            
            // Piper voices are typically local files
            const voices = [
                { id: 'joe', name: 'Joe (English Male)', language: 'en-US', quality: 'medium' },
                { id: 'amy', name: 'Amy (English Female)', language: 'en-US', quality: 'medium' },
                { id: 'russian', name: 'Russian Voice', language: 'ru-RU', quality: 'medium' }
            ];

            this.voices.piper = voices;
            this.cacheVoices();
            
            console.log(`✅ Loaded ${voices.length} Piper voices`);
            return this.voices.piper;
            
        } catch (error) {
            console.error('❌ Failed to load Piper voices:', error);
            throw error;
        }
    }

    cacheVoices() {
        try {
            localStorage.setItem('laika_cached_voices', JSON.stringify(this.voices));
            console.log('💾 Voices cached to localStorage');
        } catch (error) {
            console.error('❌ Failed to cache voices:', error);
        }
    }

    getVoices(provider) {
        return this.voices[provider] || [];
    }

    getVoice(provider, voiceId) {
        const voices = this.getVoices(provider);
        return voices.find(v => v.voice_id === voiceId || v.id === voiceId);
    }

    getDefaultVoice(provider) {
        return this.defaultVoices[provider];
    }

    searchVoices(provider, searchTerm) {
        const voices = this.getVoices(provider);
        const searchLower = searchTerm.toLowerCase();
        
        return voices.filter(voice => {
            const name = voice.name?.toLowerCase() || '';
            const id = (voice.voice_id || voice.id || '').toLowerCase();
            const description = voice.description?.toLowerCase() || '';
            const accent = voice.labels?.accent?.toLowerCase() || '';
            const gender = voice.labels?.gender?.toLowerCase() || '';
            const age = voice.labels?.age?.toLowerCase() || '';
            const useCase = voice.labels?.use_case?.toLowerCase() || '';
            
            return name.includes(searchLower) || 
                   id.includes(searchLower) || 
                   description.includes(searchLower) ||
                   accent.includes(searchLower) ||
                   gender.includes(searchLower) ||
                   age.includes(searchLower) ||
                   useCase.includes(searchLower);
        });
    }

    async downloadVoiceSample(provider, voiceId, apiKey) {
        // This would download a sample audio file for the voice
        // Implementation depends on the provider
        console.log(`🎵 Downloading sample for ${provider} voice: ${voiceId}`);
        
        // For now, return a placeholder
        return {
            provider,
            voiceId,
            sampleUrl: null,
            status: 'not_implemented'
        };
    }

    clearCache() {
        try {
            localStorage.removeItem('laika_cached_voices');
            this.voices = { elevenlabs: [], openai: [], piper: [] };
            this.populateDefaultVoices();
            console.log('🗑️ Voice cache cleared');
        } catch (error) {
            console.error('❌ Failed to clear cache:', error);
        }
    }

    getCacheInfo() {
        const totalVoices = Object.values(this.voices).reduce((sum, voices) => sum + voices.length, 0);
        const cacheSize = localStorage.getItem('laika_cached_voices')?.length || 0;
        
        return {
            totalVoices,
            cacheSize: `${(cacheSize / 1024).toFixed(2)} KB`,
            providers: Object.keys(this.voices).map(provider => ({
                name: provider,
                count: this.voices[provider].length
            }))
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceManager;
} else {
    window.VoiceManager = VoiceManager;
}
