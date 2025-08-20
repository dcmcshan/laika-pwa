/**
 * Cursor AI Chat Interface
 * Dedicated interface for Cursor AI integration with LAIKA PWA
 */

class CursorChat {
    constructor() {
        // API configuration
        this.apiBaseUrl = this.getApiBaseUrl();
        this.currentSessionId = null;
        this.sessions = new Map();
        this.isConnected = false;
        
        // UI elements
        this.elements = {
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            welcomeScreen: document.getElementById('welcomeScreen'),
            chatMessages: document.getElementById('chatMessages'),
            chatInputArea: document.getElementById('chatInputArea'),
            chatInput: document.getElementById('chatInput'),
            sendBtn: document.getElementById('sendBtn'),
            sessionsList: document.getElementById('sessionsList')
        };
        
        // Initialize
        this.initializeEventListeners();
        this.checkApiStatus();
        this.loadSessions();
    }
    
    getApiBaseUrl() {
        const hostname = window.location.hostname;
        const port = window.location.port;
        
        // Use the same server as the PWA (port 5000)
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:5000';
        } else if (port && port !== '80' && port !== '443') {
            return `${window.location.protocol}//${hostname}:5000`;
        } else {
            return `${window.location.protocol}//${hostname}:5000`;
        }
    }
    
    initializeEventListeners() {
        // Send message on Enter (Shift+Enter for new line)
        this.elements.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Auto-resize textarea
        this.elements.chatInput.addEventListener('input', () => {
            this.elements.chatInput.style.height = 'auto';
            this.elements.chatInput.style.height = Math.min(this.elements.chatInput.scrollHeight, 120) + 'px';
        });
        
        // Send button
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        
        // Page visibility handling
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.checkApiStatus();
            }
        });
    }
    
    async checkApiStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/cursor/status`);
            const status = await response.json();
            
            this.isConnected = response.ok && status.cursor_available;
            this.updateConnectionStatus(this.isConnected, status);
            
        } catch (error) {
            console.error('Failed to check API status:', error);
            this.isConnected = false;
            this.updateConnectionStatus(false, { error: error.message });
        }
    }
    
    updateConnectionStatus(connected, status = {}) {
        if (connected) {
            this.elements.statusIndicator.className = 'status-indicator connected';
            this.elements.statusText.textContent = 'Connected to Cursor AI';
        } else {
            this.elements.statusIndicator.className = 'status-indicator';
            this.elements.statusText.textContent = status.error ? `Error: ${status.error}` : 'Disconnected';
        }
    }
    
    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }
    
    createNewSession() {
        const sessionId = this.generateSessionId();
        const session = {
            id: sessionId,
            name: `Session ${this.sessions.size + 1}`,
            messages: [],
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };
        
        this.sessions.set(sessionId, session);
        this.switchToSession(sessionId);
        this.updateSessionsList();
        this.saveSessions();
    }
    
    switchToSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            console.error('Session not found:', sessionId);
            return;
        }
        
        this.currentSessionId = sessionId;
        
        // Update UI
        this.showChatInterface();
        this.renderMessages();
        this.updateSessionsList();
        
        // Focus input
        this.elements.chatInput.focus();
    }
    
    showChatInterface() {
        this.elements.welcomeScreen.style.display = 'none';
        this.elements.chatMessages.style.display = 'flex';
        this.elements.chatInputArea.style.display = 'block';
    }
    
    showWelcomeScreen() {
        this.elements.welcomeScreen.style.display = 'flex';
        this.elements.chatMessages.style.display = 'none';
        this.elements.chatInputArea.style.display = 'none';
        this.currentSessionId = null;
        this.updateSessionsList();
    }
    
    async sendMessage(messageText = null) {
        if (!this.currentSessionId) {
            this.createNewSession();
        }
        
        const message = messageText || this.elements.chatInput.value.trim();
        if (!message) return;
        
        // Clear input
        if (!messageText) {
            this.elements.chatInput.value = '';
            this.elements.chatInput.style.height = 'auto';
        }
        
        // Add user message to session
        const userMessage = {
            id: this.generateMessageId(),
            role: 'user',
            content: message,
            timestamp: new Date().toISOString()
        };
        
        const session = this.sessions.get(this.currentSessionId);
        session.messages.push(userMessage);
        session.lastActivity = new Date().toISOString();
        
        // Update UI
        this.renderMessages();
        this.showTypingIndicator();
        this.elements.sendBtn.disabled = true;
        
        try {
            // Send to API
            const response = await fetch(`${this.apiBaseUrl}/cursor/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: this.currentSessionId,
                    message: message,
                    context: this.getContextForMessage()
                })
            });
            
            const result = await response.json();
            
            if (result.success && result.message) {
                // Add assistant response to session
                session.messages.push(result.message);
                session.lastActivity = new Date().toISOString();
                
                // Update session name based on first message if needed
                if (session.messages.length === 2 && session.name.startsWith('Session ')) {
                    session.name = this.generateSessionName(message);
                }
            } else {
                // Add error message
                const errorMessage = {
                    id: this.generateMessageId(),
                    role: 'assistant',
                    content: result.error || 'Sorry, I encountered an error processing your message.',
                    timestamp: new Date().toISOString(),
                    metadata: { error: true }
                };
                session.messages.push(errorMessage);
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            
            // Add error message
            const errorMessage = {
                id: this.generateMessageId(),
                role: 'assistant',
                content: `Connection error: ${error.message}. Please check your connection and try again.`,
                timestamp: new Date().toISOString(),
                metadata: { error: true }
            };
            session.messages.push(errorMessage);
        }
        
        // Update UI
        this.hideTypingIndicator();
        this.renderMessages();
        this.updateSessionsList();
        this.saveSessions();
        this.elements.sendBtn.disabled = false;
    }
    
    generateMessageId() {
        return 'msg_' + Math.random().toString(36).substr(2, 9);
    }
    
    generateSessionName(firstMessage) {
        // Generate a meaningful session name from the first message
        const words = firstMessage.split(' ').slice(0, 4);
        let name = words.join(' ');
        if (name.length > 25) {
            name = name.substring(0, 25) + '...';
        }
        return name || 'New Session';
    }
    
    getContextForMessage() {
        // Provide context about the current environment
        return {
            project_path: '/home/pi/LAIKA',
            current_file: window.location.pathname,
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent,
            page_url: window.location.href
        };
    }
    
    renderMessages() {
        if (!this.currentSessionId) return;
        
        const session = this.sessions.get(this.currentSessionId);
        if (!session) return;
        
        this.elements.chatMessages.innerHTML = '';
        
        session.messages.forEach(message => {
            this.addMessageToUI(message);
        });
        
        this.scrollToBottom();
    }
    
    addMessageToUI(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.role}`;
        messageElement.dataset.messageId = message.id;
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const avatar = message.role === 'user' ? '👤' : '🤖';
        const isError = message.metadata?.error;
        
        messageElement.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-content">
                <div class="message-text ${isError ? 'error' : ''}">${this.formatMessageContent(message.content)}</div>
                <div class="message-meta">
                    ${timestamp}
                    ${message.metadata?.model ? `• ${message.metadata.model}` : ''}
                    ${isError ? '• Error' : ''}
                </div>
            </div>
        `;
        
        this.elements.chatMessages.appendChild(messageElement);
    }
    
    formatMessageContent(content) {
        // Basic markdown-like formatting
        return content
            .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>');
    }
    
    showTypingIndicator() {
        const typingElement = document.createElement('div');
        typingElement.className = 'message assistant typing';
        typingElement.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span>Cursor AI is thinking...</span>
                    <div class="typing-dots">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            </div>
        `;
        
        this.elements.chatMessages.appendChild(typingElement);
        this.scrollToBottom();
    }
    
    hideTypingIndicator() {
        const typingElement = this.elements.chatMessages.querySelector('.message.typing');
        if (typingElement) {
            typingElement.remove();
        }
    }
    
    scrollToBottom() {
        setTimeout(() => {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }, 100);
    }
    
    updateSessionsList() {
        this.elements.sessionsList.innerHTML = '';
        
        // Sort sessions by last activity
        const sortedSessions = Array.from(this.sessions.values())
            .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
        
        sortedSessions.forEach(session => {
            const sessionElement = document.createElement('div');
            sessionElement.className = 'session-item';
            if (session.id === this.currentSessionId) {
                sessionElement.classList.add('active');
            }
            
            const messageCount = session.messages.length;
            const lastActivity = new Date(session.lastActivity).toLocaleDateString();
            
            sessionElement.innerHTML = `
                <span>💬</span>
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${session.name}
                    </div>
                    <div style="font-size: 11px; color: var(--vscode-text-dim);">
                        ${messageCount} messages • ${lastActivity}
                    </div>
                </div>
            `;
            
            sessionElement.addEventListener('click', () => {
                this.switchToSession(session.id);
            });
            
            // Right-click context menu for deletion
            sessionElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (confirm(`Delete session "${session.name}"?`)) {
                    this.deleteSession(session.id);
                }
            });
            
            this.elements.sessionsList.appendChild(sessionElement);
        });
        
        // Show welcome screen if no sessions
        if (this.sessions.size === 0) {
            this.showWelcomeScreen();
        }
    }
    
    deleteSession(sessionId) {
        this.sessions.delete(sessionId);
        
        if (this.currentSessionId === sessionId) {
            // Switch to another session or show welcome screen
            const remainingSessions = Array.from(this.sessions.keys());
            if (remainingSessions.length > 0) {
                this.switchToSession(remainingSessions[0]);
            } else {
                this.showWelcomeScreen();
            }
        }
        
        this.updateSessionsList();
        this.saveSessions();
    }
    
    saveSessions() {
        try {
            const sessionsData = Array.from(this.sessions.entries());
            localStorage.setItem('cursor_chat_sessions', JSON.stringify(sessionsData));
        } catch (error) {
            console.error('Failed to save sessions:', error);
        }
    }
    
    loadSessions() {
        try {
            const saved = localStorage.getItem('cursor_chat_sessions');
            if (saved) {
                const sessionsData = JSON.parse(saved);
                this.sessions = new Map(sessionsData);
                this.updateSessionsList();
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
        }
    }
    
    clearAllSessions() {
        if (confirm('Clear all chat sessions? This cannot be undone.')) {
            this.sessions.clear();
            this.showWelcomeScreen();
            this.updateSessionsList();
            this.saveSessions();
        }
    }
}

// Global functions for quick actions
function sendQuickMessage(message) {
    if (window.cursorChat) {
        window.cursorChat.sendMessage(message);
    }
}

function createNewSession() {
    if (window.cursorChat) {
        window.cursorChat.createNewSession();
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.cursorChat = new CursorChat();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + N for new session
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            createNewSession();
        }
        
        // Ctrl/Cmd + K to clear all sessions
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            window.cursorChat.clearAllSessions();
        }
    });
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CursorChat;
}
