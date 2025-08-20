/**
 * LAIKA Chat Interface
 * Real-time conversation with LAIKA's AI brain
 */

class LAIKAChat {
    constructor() {
        this.websocket = null;
        this.isConnected = false;
        this.isRecording = false;
        this.currentPersonality = 'companion';
        this.messageHistory = [];
        
        this.initializeElements();
        this.setupEventListeners();
        this.connectToLAIKA();
        this.loadChatHistory();
    }

    initializeElements() {
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendButton');
        this.voiceButton = document.getElementById('voiceButton');
        this.personalitySelector = document.getElementById('personalitySelector');
        this.connectionIndicator = document.getElementById('connectionIndicator');
        this.connectionText = document.getElementById('connectionText');
    }

    setupEventListeners() {
        // Send button
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Enter key to send (Shift+Enter for new line)
        this.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.chatInput.addEventListener('input', () => {
            this.chatInput.style.height = 'auto';
            this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + 'px';
        });

        // Voice input
        this.voiceButton.addEventListener('click', () => this.toggleVoiceInput());

        // Personality selector
        this.personalitySelector.addEventListener('change', (e) => {
            this.currentPersonality = e.target.value;
            this.sendSystemMessage(`Switched to ${e.target.value} personality mode`);
        });

        // Page visibility for connection management
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.reconnectIfNeeded();
            }
        });
    }

    async connectToLAIKA() {
        try {
            // Try WebSocket connection to LAIKA
            const wsUrl = this.getWebSocketUrl();
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('Connected to LAIKA');
                this.updateConnectionStatus(true);
                this.sendSystemMessage('Connected to LAIKA\'s AI brain');
            };

            this.websocket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.websocket.onclose = () => {
                console.log('Disconnected from LAIKA');
                this.updateConnectionStatus(false);
                this.scheduleReconnect();
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus(false);
            };

        } catch (error) {
            console.error('Failed to connect to LAIKA:', error);
            this.updateConnectionStatus(false);
            this.scheduleReconnect();
        }
    }

    getWebSocketUrl() {
        // Try different connection methods based on environment
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'ws://localhost:8765';
        } else if (hostname.includes('laika')) {
            return `ws://${hostname}:8765`;
        } else {
            // Fallback to current host
            return `ws://${hostname}:8765`;
        }
    }

    updateConnectionStatus(connected) {
        this.isConnected = connected;
        
        if (connected) {
            this.connectionIndicator.className = 'status-indicator connected';
            this.connectionText.textContent = 'Connected';
        } else {
            this.connectionIndicator.className = 'status-indicator disconnected';
            this.connectionText.textContent = 'Disconnected';
        }
    }

    scheduleReconnect() {
        setTimeout(() => {
            if (!this.isConnected) {
                console.log('Attempting to reconnect...');
                this.connectToLAIKA();
            }
        }, 3000);
    }

    reconnectIfNeeded() {
        if (!this.isConnected || !this.websocket || this.websocket.readyState === WebSocket.CLOSED) {
            this.connectToLAIKA();
        }
    }

    sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        // Add user message to chat
        this.addMessage('user', message);
        
        // Clear input
        this.chatInput.value = '';
        this.chatInput.style.height = 'auto';

        // Show typing indicator
        this.showTypingIndicator();

        // Send to LAIKA
        this.sendToLAIKA(message);
    }

    sendQuickMessage(message) {
        this.chatInput.value = message;
        this.sendMessage();
    }

    async sendToLAIKA(message) {
        try {
            if (this.isConnected && this.websocket) {
                // Send via WebSocket
                const payload = {
                    type: 'chat_message',
                    message: message,
                    personality: this.currentPersonality,
                    timestamp: new Date().toISOString(),
                    user_id: this.getUserId()
                };
                
                this.websocket.send(JSON.stringify(payload));
            } else {
                // Fallback to HTTP API
                await this.sendViaHTTP(message);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            this.hideTypingIndicator();
            this.addMessage('system', 'Failed to send message. Please check connection.');
        }
    }

    async sendViaHTTP(message) {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    personality: this.currentPersonality,
                    user_id: this.getUserId()
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.handleMessage(data);
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('HTTP request failed:', error);
            this.hideTypingIndicator();
            this.addMessage('system', 'Connection error. Trying to reconnect...');
            this.scheduleReconnect();
        }
    }

    handleMessage(data) {
        this.hideTypingIndicator();
        
        switch (data.type) {
            case 'chat_response':
                this.addMessage('laika', data.message, data.metadata);
                break;
            case 'system_message':
                this.addMessage('system', data.message);
                break;
            case 'error':
                this.addMessage('system', `Error: ${data.message}`);
                break;
            default:
                console.log('Unknown message type:', data);
        }
    }

    addMessage(sender, text, metadata = {}) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${sender}`;

        const timestamp = new Date().toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        let avatarIcon;
        switch (sender) {
            case 'user':
                avatarIcon = '👤';
                break;
            case 'laika':
                avatarIcon = '🐕';
                break;
            case 'system':
                avatarIcon = '⚙️';
                break;
            default:
                avatarIcon = '💬';
        }

        messageElement.innerHTML = `
            <div class="message-avatar">${avatarIcon}</div>
            <div class="message-content">
                <div class="message-bubble">
                    <p class="message-text">${this.formatMessage(text)}</p>
                </div>
                <div class="message-meta">
                    <span>${timestamp}</span>
                    ${metadata.confidence ? `<span>Confidence: ${Math.round(metadata.confidence * 100)}%</span>` : ''}
                    ${metadata.processing_time ? `<span>${metadata.processing_time}ms</span>` : ''}
                </div>
            </div>
        `;

        this.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
        
        // Save to history
        this.messageHistory.push({
            sender,
            text,
            timestamp: new Date().toISOString(),
            metadata
        });
        this.saveChatHistory();
    }

    formatMessage(text) {
        // Basic markdown-like formatting
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code style="background: rgba(0,255,255,0.2); padding: 2px 4px;">$1</code>')
            .replace(/\n/g, '<br>');
    }

    showTypingIndicator() {
        const existingIndicator = document.querySelector('.typing-indicator');
        if (existingIndicator) return;

        const typingElement = document.createElement('div');
        typingElement.className = 'message laika';
        typingElement.innerHTML = `
            <div class="message-avatar">🐕</div>
            <div class="typing-indicator">
                <span style="color: var(--atomic-pink); font-family: 'Orbitron', monospace; font-size: 12px; font-weight: 700;">LAIKA is thinking...</span>
                <div class="typing-dots">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        `;

        this.chatMessages.appendChild(typingElement);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = document.querySelector('.message:has(.typing-indicator)');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }, 100);
    }

    // Voice Input Methods
    async toggleVoiceInput() {
        if (this.isRecording) {
            this.stopVoiceInput();
        } else {
            this.startVoiceInput();
        }
    }

    async startVoiceInput() {
        try {
            if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                alert('Speech recognition not supported in this browser');
                return;
            }

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onstart = () => {
                this.isRecording = true;
                this.voiceButton.classList.add('recording');
                this.voiceButton.innerHTML = '🔴';
                this.addMessage('system', 'Listening... Speak now!');
            };

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                this.chatInput.value = transcript;
                this.sendMessage();
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.addMessage('system', `Voice input error: ${event.error}`);
                this.stopVoiceInput();
            };

            this.recognition.onend = () => {
                this.stopVoiceInput();
            };

            this.recognition.start();

        } catch (error) {
            console.error('Voice input failed:', error);
            this.addMessage('system', 'Voice input not available');
        }
    }

    stopVoiceInput() {
        if (this.recognition) {
            this.recognition.stop();
        }
        
        this.isRecording = false;
        this.voiceButton.classList.remove('recording');
        this.voiceButton.innerHTML = '🎤';
    }

    // Utility Methods
    getUserId() {
        let userId = localStorage.getItem('laika_user_id');
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('laika_user_id', userId);
        }
        return userId;
    }

    saveChatHistory() {
        try {
            const historyToSave = this.messageHistory.slice(-50); // Keep last 50 messages
            localStorage.setItem('laika_chat_history', JSON.stringify(historyToSave));
        } catch (error) {
            console.error('Failed to save chat history:', error);
        }
    }

    loadChatHistory() {
        try {
            const saved = localStorage.getItem('laika_chat_history');
            if (saved) {
                const history = JSON.parse(saved);
                
                // Clear welcome message
                this.chatMessages.innerHTML = '';
                
                // Restore messages
                history.forEach(msg => {
                    this.addMessageFromHistory(msg);
                });
                
                this.messageHistory = history;
                this.scrollToBottom();
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
        }
    }

    addMessageFromHistory(msg) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${msg.sender}`;

        const timestamp = new Date(msg.timestamp).toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        let avatarIcon;
        switch (msg.sender) {
            case 'user':
                avatarIcon = '👤';
                break;
            case 'laika':
                avatarIcon = '🐕';
                break;
            case 'system':
                avatarIcon = '⚙️';
                break;
            default:
                avatarIcon = '💬';
        }

        messageElement.innerHTML = `
            <div class="message-avatar">${avatarIcon}</div>
            <div class="message-content">
                <div class="message-bubble">
                    <p class="message-text">${this.formatMessage(msg.text)}</p>
                </div>
                <div class="message-meta">
                    <span>${timestamp}</span>
                    ${msg.metadata?.confidence ? `<span>Confidence: ${Math.round(msg.metadata.confidence * 100)}%</span>` : ''}
                    ${msg.metadata?.processing_time ? `<span>${msg.metadata.processing_time}ms</span>` : ''}
                </div>
            </div>
        `;

        this.chatMessages.appendChild(messageElement);
    }

    sendSystemMessage(message) {
        this.addMessage('system', message);
    }

    // Clear chat history
    clearHistory() {
        if (confirm('Clear all chat history?')) {
            this.messageHistory = [];
            this.chatMessages.innerHTML = `
                <div class="welcome-message">
                    <span class="welcome-icon">🐕</span>
                    <h3 style="color: var(--atomic-cyan); font-family: 'Orbitron', monospace; margin-bottom: 15px;">
                        Chat Cleared!
                    </h3>
                    <p>Start a new conversation with LAIKA.</p>
                </div>
            `;
            localStorage.removeItem('laika_chat_history');
        }
    }
}

// Global functions for quick actions
function sendQuickMessage(message) {
    if (window.laikaChat) {
        window.laikaChat.sendQuickMessage(message);
    }
}

// Initialize chat when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.laikaChat = new LAIKAChat();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K to clear chat
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            window.laikaChat.clearHistory();
        }
        
        // Escape to stop voice input
        if (e.key === 'Escape' && window.laikaChat.isRecording) {
            window.laikaChat.stopVoiceInput();
        }
    });
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LAIKAChat;
}
