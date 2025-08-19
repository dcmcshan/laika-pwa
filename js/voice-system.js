/**
 * LAIKA PWA Voice System
 * Speech-to-Text (STT) and Text-to-Speech (TTS) using LAIKA's voice configuration
 * Supports ElevenLabs TTS and Web Speech API/OpenAI Whisper STT
 */

class LAIKAVoiceSystem {
    constructor() {
        // Voice configuration matching LAIKA's settings
        this.config = {
            // ElevenLabs TTS Configuration (same as LAIKA)
            elevenlabs: {
                voice_id: "GN4wbsbejSnGSa1AzjH5", // Ekaterina voice (multilingual)
                model: "eleven_turbo_v2_5",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                    style: 0.0,
                    use_speaker_boost: true
                }
            },
            
            // STT Configuration
            stt: {
                provider: "web_speech", // web_speech, openai_whisper
                language: "en-US",
                continuous: false,
                interim_results: true
            },
            
            // Audio settings
            audio: {
                sample_rate: 44100,
                format: "mp3"
            }
        };
        
        // State
        this.isListening = false;
        this.isSpeaking = false;
        this.recognition = null;
        this.synthesis = null;
        this.currentUtterance = null;
        
        // Event handlers
        this.onSpeechRecognized = null;
        this.onSpeechStart = null;
        this.onSpeechEnd = null;
        this.onTTSStart = null;
        this.onTTSEnd = null;
        this.onError = null;
        
        // Initialize components
        this.initializeTTS();
        this.initializeSTT();
        
        console.log('🎤 LAIKA Voice System initialized with ElevenLabs configuration');
    }
    
    initializeTTS() {
        // Initialize Text-to-Speech
        if ('speechSynthesis' in window) {
            this.synthesis = window.speechSynthesis;
            console.log('✅ Web Speech Synthesis available');
        } else {
            console.warn('⚠️ Web Speech Synthesis not supported');
        }
    }
    
    initializeSTT() {
        // Initialize Speech-to-Text
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            // Configure recognition
            this.recognition.continuous = this.config.stt.continuous;
            this.recognition.interimResults = this.config.stt.interim_results;
            this.recognition.lang = this.config.stt.language;
            
            // Set up event handlers
            this.setupSTTEventHandlers();
            
            console.log('✅ Web Speech Recognition available');
        } else {
            console.warn('⚠️ Web Speech Recognition not supported');
        }
    }
    
    setupSTTEventHandlers() {
        if (!this.recognition) return;
        
        this.recognition.onstart = () => {
            console.log('🎤 Speech recognition started');
            this.isListening = true;
            if (this.onSpeechStart) this.onSpeechStart();
        };
        
        this.recognition.onend = () => {
            console.log('🎤 Speech recognition ended');
            this.isListening = false;
            if (this.onSpeechEnd) this.onSpeechEnd();
        };
        
        this.recognition.onresult = (event) => {
            let transcript = '';
            let isFinal = false;
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                transcript += result[0].transcript;
                if (result.isFinal) {
                    isFinal = true;
                }
            }
            
            console.log(`🎤 Speech recognized: "${transcript}" (final: ${isFinal})`);
            
            if (this.onSpeechRecognized) {
                this.onSpeechRecognized({
                    transcript: transcript.trim(),
                    isFinal: isFinal,
                    confidence: event.results[event.resultIndex][0].confidence
                });
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('🎤 Speech recognition error:', event.error);
            this.isListening = false;
            if (this.onError) this.onError(event.error);
        };
    }
    
    async startListening() {
        try {
            if (!this.recognition) {
                throw new Error('Speech recognition not available');
            }
            
            if (this.isListening) {
                console.log('Already listening...');
                return;
            }
            
            console.log('🎤 Starting speech recognition...');
            this.recognition.start();
            
        } catch (error) {
            console.error('Failed to start listening:', error);
            if (this.onError) this.onError(error);
            throw error;
        }
    }
    
    stopListening() {
        try {
            if (this.recognition && this.isListening) {
                console.log('🎤 Stopping speech recognition...');
                this.recognition.stop();
            }
        } catch (error) {
            console.error('Failed to stop listening:', error);
        }
    }
    
    async speak(text, useElevenLabs = true) {
        try {
            console.log(`🔊 Speaking: "${text}"`);
            
            if (this.isSpeaking) {
                this.stopSpeaking();
            }
            
            // Try ElevenLabs TTS first if available
            if (useElevenLabs && await this.isElevenLabsAvailable()) {
                return await this.speakWithElevenLabs(text);
            } else {
                return await this.speakWithWebSpeech(text);
            }
            
        } catch (error) {
            console.error('Failed to speak:', error);
            if (this.onError) this.onError(error);
            throw error;
        }
    }
    
    async speakWithElevenLabs(text) {
        try {
            console.log('🔊 Using ElevenLabs TTS (LAIKA voice)...');
            
            // Make request to LAIKA's API for ElevenLabs TTS
            const response = await fetch('/api/voice/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: text,
                    provider: 'elevenlabs',
                    voice_config: this.config.elevenlabs
                })
            });
            
            if (response.ok) {
                const audioBlob = await response.blob();
                return await this.playAudioBlob(audioBlob);
            } else {
                console.warn('ElevenLabs TTS failed, falling back to Web Speech');
                return await this.speakWithWebSpeech(text);
            }
            
        } catch (error) {
            console.warn('ElevenLabs TTS error, falling back to Web Speech:', error);
            return await this.speakWithWebSpeech(text);
        }
    }
    
    async speakWithWebSpeech(text) {
        return new Promise((resolve, reject) => {
            try {
                if (!this.synthesis) {
                    reject(new Error('Speech synthesis not available'));
                    return;
                }
                
                console.log('🔊 Using Web Speech Synthesis...');
                
                const utterance = new SpeechSynthesisUtterance(text);
                
                // Configure utterance to match LAIKA's voice as closely as possible
                const voices = this.synthesis.getVoices();
                const preferredVoice = voices.find(voice => 
                    voice.name.toLowerCase().includes('female') ||
                    voice.name.toLowerCase().includes('woman') ||
                    voice.gender === 'female'
                ) || voices.find(voice => voice.lang.startsWith('en'));
                
                if (preferredVoice) {
                    utterance.voice = preferredVoice;
                    console.log(`Using voice: ${preferredVoice.name}`);
                }
                
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.volume = 0.8;
                
                utterance.onstart = () => {
                    console.log('🔊 TTS started');
                    this.isSpeaking = true;
                    this.currentUtterance = utterance;
                    if (this.onTTSStart) this.onTTSStart();
                };
                
                utterance.onend = () => {
                    console.log('🔊 TTS ended');
                    this.isSpeaking = false;
                    this.currentUtterance = null;
                    if (this.onTTSEnd) this.onTTSEnd();
                    resolve();
                };
                
                utterance.onerror = (event) => {
                    console.error('🔊 TTS error:', event.error);
                    this.isSpeaking = false;
                    this.currentUtterance = null;
                    reject(new Error(event.error));
                };
                
                this.synthesis.speak(utterance);
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    async playAudioBlob(audioBlob) {
        return new Promise((resolve, reject) => {
            try {
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                
                audio.onloadstart = () => {
                    console.log('🔊 ElevenLabs audio loading...');
                    this.isSpeaking = true;
                    if (this.onTTSStart) this.onTTSStart();
                };
                
                audio.onended = () => {
                    console.log('🔊 ElevenLabs audio ended');
                    this.isSpeaking = false;
                    URL.revokeObjectURL(audioUrl);
                    if (this.onTTSEnd) this.onTTSEnd();
                    resolve();
                };
                
                audio.onerror = (error) => {
                    console.error('🔊 ElevenLabs audio error:', error);
                    this.isSpeaking = false;
                    URL.revokeObjectURL(audioUrl);
                    reject(error);
                };
                
                audio.play();
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    stopSpeaking() {
        try {
            if (this.synthesis && this.synthesis.speaking) {
                console.log('🔊 Stopping Web Speech Synthesis');
                this.synthesis.cancel();
            }
            
            if (this.currentUtterance) {
                this.currentUtterance = null;
            }
            
            this.isSpeaking = false;
            
        } catch (error) {
            console.error('Failed to stop speaking:', error);
        }
    }
    
    async isElevenLabsAvailable() {
        try {
            // Check if LAIKA's TTS endpoint is available
            const response = await fetch('/api/voice/tts', {
                method: 'HEAD'
            });
            return response.ok;
        } catch {
            return false;
        }
    }
    
    async sendVoiceMessage(text) {
        try {
            console.log(`💬 Sending voice message to LAIKA: "${text}"`);
            
            // Send to LAIKA's chat API
            const response = await fetch('/api/chat/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: text,
                    use_voice: true
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('💬 LAIKA response:', result.laika_response);
                
                // Speak LAIKA's response
                if (result.laika_response) {
                    await this.speak(result.laika_response);
                }
                
                return result;
            } else {
                throw new Error('Failed to send voice message');
            }
            
        } catch (error) {
            console.error('Voice message failed:', error);
            throw error;
        }
    }
    
    getAvailableVoices() {
        if (this.synthesis) {
            return this.synthesis.getVoices();
        }
        return [];
    }
    
    getStatus() {
        return {
            isListening: this.isListening,
            isSpeaking: this.isSpeaking,
            hasSTT: !!this.recognition,
            hasTTS: !!this.synthesis,
            elevenLabsAvailable: false // Will be updated async
        };
    }
    
    // Voice command patterns matching LAIKA's wake words
    isWakeWord(text) {
        const wakeWords = [
            'hey laika',
            'hi laika', 
            'hello laika',
            'laika'
        ];
        
        const lowerText = text.toLowerCase();
        return wakeWords.some(wake => lowerText.includes(wake));
    }
    
    // Language detection for multilingual support
    detectLanguage(text) {
        // Simple heuristic language detection
        const russianChars = /[а-я]/i;
        if (russianChars.test(text)) {
            return 'ru';
        }
        return 'en';
    }
    
    setLanguage(language) {
        if (this.recognition) {
            this.recognition.lang = language;
            console.log(`🌐 Language set to: ${language}`);
        }
    }
}

// Export for use in other modules
window.LAIKAVoiceSystem = LAIKAVoiceSystem;




