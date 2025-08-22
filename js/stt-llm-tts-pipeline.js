/**
 * LAIKA STT-LLM-TTS Pipeline Controller
 * Handles the complete conversational AI pipeline with transcript history
 */

class STTLLMTTSPipeline {
    constructor() {
        this.transcriptHistory = [];
        this.conversationHistory = [];
        this.isConnected = false;
        this.autoRefresh = true;
        this.refreshInterval = null;
        this.socket = null;
        
        // Pipeline status
        this.pipelineStatus = {
            stt_running: false,
            llm_running: false,
            tts_available: false
        };
        
        this.initialize();
    }

    async initialize() {
        console.log('🎯 Initializing LAIKA STT-LLM-TTS Pipeline...');
        
        this.setupEventListeners();
        this.connectToServer();
        await this.loadTranscriptHistory();
        this.startAutoRefresh();
        
        console.log('✅ Pipeline initialized');
    }

    setupEventListeners() {
        // Auto-refresh toggle
        const autoRefreshCheckbox = document.getElementById('auto-refresh');
        if (autoRefreshCheckbox) {
            autoRefreshCheckbox.addEventListener('change', (e) => {
                this.autoRefresh = e.target.checked;
                if (this.autoRefresh) {
                    this.startAutoRefresh();
                } else {
                    this.stopAutoRefresh();
                }
            });
        }

        // TTS input handling
        const ttsInput = document.getElementById('tts-input');
        if (ttsInput) {
            ttsInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.speakText();
                }
            });
        }

        // Control buttons
        const refreshBtn = document.querySelector('button[onclick="refreshConversations()"]');
        if (refreshBtn) {
            refreshBtn.onclick = () => this.refreshConversations();
        }

        const clearBtn = document.querySelector('button[onclick="clearConversations()"]');
        if (clearBtn) {
            clearBtn.onclick = () => this.clearConversations();
        }

        // TTS speak button
        const speakBtn = document.getElementById('tts-speak-btn');
        if (speakBtn) {
            speakBtn.onclick = () => this.speakText();
        }
    }

    connectToServer() {
        try {
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('🔗 Connected to STT-LLM-TTS pipeline');
                this.isConnected = true;
                this.updateStatus('Connected to pipeline service');
            });
            
            this.socket.on('stt_response', (data) => {
                this.handleSTTResponse(data);
            });
            
            this.socket.on('llm_response', (data) => {
                this.handleLLMResponse(data);
            });
            
            this.socket.on('tts_response', (data) => {
                this.handleTTSResponse(data);
            });
            
            this.socket.on('disconnect', () => {
                console.log('🔌 Disconnected from pipeline');
                this.isConnected = false;
                this.updateStatus('Disconnected from pipeline service');
            });
            
        } catch (error) {
            console.error('Failed to connect to pipeline:', error);
            this.updateStatus('Failed to connect to pipeline service');
        }
    }

    async loadTranscriptHistory() {
        try {
            const response = await fetch('/api/stt/history?limit=100');
            const data = await response.json();
            
            if (data.success && data.history) {
                this.transcriptHistory = data.history;
                console.log(`📝 Loaded ${data.history.length} transcript entries`);
                this.updateStatus(`Loaded ${data.history.length} transcript entries`);
            }
        } catch (error) {
            console.error('Error loading transcript history:', error);
        }
    }

    handleSTTResponse(data) {
        if (data.type === 'transcript') {
            // Add to transcript history
            this.transcriptHistory.unshift({
                id: data.history_id || Date.now(),
                text: data.text,
                provider: data.provider,
                timestamp: data.timestamp,
                datetime: new Date().toISOString()
            });
            
            // Keep only last 100 entries
            if (this.transcriptHistory.length > 100) {
                this.transcriptHistory = this.transcriptHistory.slice(0, 100);
            }
            
            // Update display
            this.updateTranscriptDisplay();
            this.updatePipelineStatus({ stt_running: true });
            
            console.log(`📝 STT: "${data.text}"`);
        }
    }

    handleLLMResponse(data) {
        if (data.type === 'response') {
            // Add to conversation history
            this.conversationHistory.unshift({
                id: Date.now(),
                type: 'assistant',
                content: data.text,
                timestamp: data.timestamp || new Date().toISOString(),
                meta: {
                    llm_success: true,
                    model: data.model || 'unknown'
                }
            });
            
            this.updateConversationDisplay();
            this.updatePipelineStatus({ llm_running: true });
            
            console.log(`🤖 LLM: "${data.text}"`);
        }
    }

    handleTTSResponse(data) {
        if (data.type === 'speak') {
            this.updatePipelineStatus({ tts_available: true });
            console.log(`🔊 TTS: "${data.text}"`);
        }
    }

    updateTranscriptDisplay() {
        const feed = document.getElementById('conversation-feed');
        if (!feed) return;

        if (this.transcriptHistory.length === 0) {
            feed.innerHTML = `
                <div class="empty-state">
                    <h2>🎤 STT-LLM-TTS Pipeline Ready</h2>
                    <p>Speak to LAIKA or use the TTS input below to see the pipeline in action!</p>
                    <div class="pipeline-status">
                        <div class="status-item">
                            <span class="status-dot ${this.pipelineStatus.stt_running ? 'active' : 'inactive'}"></span>
                            <span>STT: ${this.pipelineStatus.stt_running ? 'Listening' : 'Ready'}</span>
                        </div>
                        <div class="status-item">
                            <span class="status-dot ${this.pipelineStatus.llm_running ? 'active' : 'inactive'}"></span>
                            <span>LLM: ${this.pipelineStatus.llm_running ? 'Processing' : 'Ready'}</span>
                        </div>
                        <div class="status-item">
                            <span class="status-dot ${this.pipelineStatus.tts_available ? 'active' : 'inactive'}"></span>
                            <span>TTS: ${this.pipelineStatus.tts_available ? 'Available' : 'Ready'}</span>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // Create transcript entries with timestamps
        const transcriptEntries = this.transcriptHistory.map(entry => {
            const timestamp = new Date(entry.datetime).toLocaleTimeString();
            return `
                <div class="transcript-entry">
                    <div class="transcript-header">
                        <span class="transcript-time">🕐 ${timestamp}</span>
                        <span class="transcript-provider">🔧 ${this.formatProviderName(entry.provider)}</span>
                    </div>
                    <div class="transcript-text">"${entry.text}"</div>
                </div>
            `;
        });

        feed.innerHTML = transcriptEntries.join('');
    }

    updateConversationDisplay() {
        // This would show the full conversation including LLM responses
        // For now, we'll focus on transcripts
        this.updateTranscriptDisplay();
    }

    updatePipelineStatus(status) {
        this.pipelineStatus = { ...this.pipelineStatus, ...status };
        
        // Update status indicators
        const sttStatus = document.getElementById('stt-status');
        const llmStatus = document.getElementById('llm-status');
        const ttsStatus = document.getElementById('tts-status');

        if (sttStatus) sttStatus.className = `status-dot ${this.pipelineStatus.stt_running ? 'active' : 'inactive'}`;
        if (llmStatus) llmStatus.className = `status-dot ${this.pipelineStatus.llm_running ? 'active' : 'inactive'}`;
        if (ttsStatus) ttsStatus.className = `status-dot ${this.pipelineStatus.tts_available ? 'active' : 'inactive'}`;
    }

    async refreshConversations() {
        try {
            // Load latest transcript history
            await this.loadTranscriptHistory();
            this.updateTranscriptDisplay();
            
            // Update pipeline status
            this.updatePipelineStatus({
                stt_running: this.transcriptHistory.length > 0,
                llm_running: this.conversationHistory.length > 0,
                tts_available: true
            });
            
        } catch (error) {
            console.error('Error refreshing conversations:', error);
        }
    }

    async clearConversations() {
        try {
            // Clear transcript history
            const response = await fetch('/api/stt/history/clear', {
                method: 'POST'
            });
            
            if (response.ok) {
                this.transcriptHistory = [];
                this.conversationHistory = [];
                this.updateTranscriptDisplay();
                this.updateStatus('Conversation history cleared');
            }
        } catch (error) {
            console.error('Error clearing conversations:', error);
        }
    }

    async speakText() {
        const input = document.getElementById('tts-input');
        const button = document.getElementById('tts-speak-btn');
        const translateSelect = document.getElementById('translate-select');
        
        if (!input || !button) return;
        
        const text = input.value.trim();
        if (!text) return;
        
        // Disable button and show speaking state
        button.disabled = true;
        button.classList.add('speaking');
        button.innerHTML = '🔊 Speaking...';
        
        try {
            const requestBody = {
                text: text,
                voice: 'alloy',
                speed: 1.0
            };
            
            // Add translation if selected
            const translateTo = translateSelect.value;
            if (translateTo) {
                requestBody.translate_to = translateTo;
            }
            
            const response = await fetch('/api/tts/speak', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });
            
            const result = await response.json();
            
            if (result.success) {
                let successMessage = `✅ LAIKA said: "${result.text}"`;
                
                if (result.translated) {
                    successMessage = `✅ Translated (${result.translation_direction}) and spoke: "${result.text}"`;
                    if (result.original_text !== result.text) {
                        successMessage += `\n📝 Original: "${result.original_text}"`;
                    }
                }
                
                const langEmoji = result.detected_language === 'ru' ? '🇷🇺' : '🇺🇸';
                successMessage += `\n${langEmoji} Detected: ${result.detected_language === 'ru' ? 'Russian' : 'English'}`;
                
                this.showTTSStatus(successMessage, 'success');
                input.value = '';
                
                // Refresh to show the TTS in the pipeline
                setTimeout(() => {
                    this.refreshConversations();
                }, 1000);
            } else {
                this.showTTSStatus(`❌ TTS Error: ${result.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('TTS request failed:', error);
            this.showTTSStatus(`❌ Network Error: ${error.message}`, 'error');
        }
        
        // Reset button state
        button.disabled = false;
        button.classList.remove('speaking');
        button.innerHTML = '🗣️ Speak';
    }

    showTTSStatus(message, type) {
        const status = document.getElementById('tts-status-message');
        if (status) {
            status.textContent = message;
            status.className = `tts-status show ${type}`;
            
            if (type === 'success' || type === 'error') {
                setTimeout(() => {
                    status.classList.remove('show');
                }, 5000);
            }
        }
    }

    updateStatus(message) {
        console.log(`📊 Status: ${message}`);
    }

    startAutoRefresh() {
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(() => {
            this.refreshConversations();
        }, 3000); // Refresh every 3 seconds
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
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
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 Initializing LAIKA STT-LLM-TTS Pipeline...');
    window.pipeline = new STTLLMTTSPipeline();
});

// Global functions for backward compatibility
function refreshConversations() {
    if (window.pipeline) {
        window.pipeline.refreshConversations();
    }
}

function clearConversations() {
    if (window.pipeline) {
        window.pipeline.clearConversations();
    }
}

function speakText() {
    if (window.pipeline) {
        window.pipeline.speakText();
    }
}
