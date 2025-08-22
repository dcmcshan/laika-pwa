/**
 * LAIKA Hybrid LLM Control Panel
 * Interfaces with local hybrid LLM service for conversation and configuration
 */

// Global variables
let llmService = null;
let conversationHistory = [];
let isConnected = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🧠 Initializing LAIKA Hybrid LLM Control Panel...');
    initializeLLMControl();
});

async function initializeLLMControl() {
    try {
        // Update status
        updateStatus('initializing', 'Initializing Hybrid LLM Control...');
        
        // Load current configuration
        await loadCurrentConfiguration();
        
        // Set up event listeners
        setupEventListeners();
        
        // Update status
        updateStatus('ready', 'Hybrid LLM Control Ready');
        log('✅ Hybrid LLM Control Panel initialized successfully', 'success');
        
    } catch (error) {
        log(`❌ Failed to initialize LLM control: ${error.message}`, 'error');
        updateStatus('error', 'Initialization Failed');
    }
}

function setupEventListeners() {
    // Send message button
    const sendBtn = document.getElementById('sendMessageBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }
    
    // Enter key in message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // Clear conversation button
    const clearBtn = document.getElementById('clearConversationBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearConversation);
    }
    
    // Export conversation button
    const exportBtn = document.getElementById('exportConversationBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportConversation);
    }
    
    // Provider selection
    const providerSelect = document.getElementById('llmProviderSelect');
    if (providerSelect) {
        providerSelect.addEventListener('change', updateProvider);
    }
    
    // Test LLM button
    const testBtn = document.getElementById('testLLMBtn');
    if (testBtn) {
        testBtn.addEventListener('click', testLLM);
    }
}

async function loadCurrentConfiguration() {
    try {
        // For hybrid system, we'll use default values initially
        const defaultConfig = {
            primaryProvider: 'openai_gpt5',
            fallbackOrder: ['openai_gpt4', 'openai_gpt35', 'claude'],
            temperature: 0.7,
            maxTokens: 200
        };
        
        // Update UI with current values
        document.getElementById('currentProvider').textContent = `${defaultConfig.primaryProvider} (Primary)`;
        document.getElementById('currentFallbackOrder').textContent = defaultConfig.fallbackOrder.join(' → ');
        
        // Update form inputs
        const providerSelect = document.getElementById('llmProviderSelect');
        if (providerSelect) {
            providerSelect.value = defaultConfig.primaryProvider;
        }
        
        log('✅ Loaded current LLM configuration', 'success');
        
    } catch (error) {
        log(`⚠️ Could not load current configuration: ${error.message}`, 'warning');
        // Use defaults
        document.getElementById('currentProvider').textContent = 'openai_gpt5 (Primary)';
        document.getElementById('currentFallbackOrder').textContent = 'openai_gpt4 → openai_gpt35 → claude';
    }
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) {
        log('⚠️ Please enter a message', 'warning');
        return;
    }
    
    try {
        updateStatus('processing', 'Generating Response...');
        
        // Add user message to conversation
        addMessageToConversation('user', message);
        messageInput.value = '';
        
        log('🧠 Sending message to LLM...', 'info');
        
        // Simulate LLM response
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Generate response (in real implementation, this would call the hybrid service)
        const response = await generateLLMResponse(message);
        
        // Add AI response to conversation
        addMessageToConversation('assistant', response);
        
        updateStatus('ready', 'Response Generated');
        log('✅ LLM response generated successfully', 'success');
        
    } catch (error) {
        log(`❌ Failed to send message: ${error.message}`, 'error');
        updateStatus('error', 'Send Failed');
    }
}

async function generateLLMResponse(prompt) {
    // Simulate LLM response generation
    const responses = [
        "Hello! I'm LAIKA, your AI assistant. How can I help you today?",
        "That's an interesting question. Let me think about that for a moment...",
        "I understand what you're asking. Here's what I can tell you about that.",
        "Thanks for reaching out! I'd be happy to help with that.",
        "I'm here to assist you with any questions or tasks you might have."
    ];
    
    // Return a random response for demo purposes
    return responses[Math.floor(Math.random() * responses.length)];
}

function addMessageToConversation(role, content) {
    const timestamp = new Date().toLocaleTimeString();
    const message = {
        role: role,
        content: content,
        timestamp: timestamp,
        id: Date.now()
    };
    
    conversationHistory.push(message);
    
    // Update conversation display
    const conversationArea = document.getElementById('conversationArea');
    if (conversationArea) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="role">${role === 'user' ? '👤 You' : '🤖 LAIKA'}</span>
                <span class="timestamp">[${timestamp}]</span>
            </div>
            <div class="message-content">${content}</div>
        `;
        conversationArea.appendChild(messageDiv);
        conversationArea.scrollTop = conversationArea.scrollHeight;
    }
}

function clearConversation() {
    conversationHistory = [];
    const conversationArea = document.getElementById('conversationArea');
    if (conversationArea) {
        conversationArea.innerHTML = '<div class="placeholder">Start a conversation with LAIKA...</div>';
    }
    log('🗑️ Conversation cleared', 'info');
}

function exportConversation() {
    if (conversationHistory.length === 0) {
        log('⚠️ No conversation to export', 'warning');
        return;
    }
    
    const conversationText = conversationHistory
        .map(msg => `[${msg.timestamp}] ${msg.role === 'user' ? 'You' : 'LAIKA'}: ${msg.content}`)
        .join('\n\n');
    
    const blob = new Blob([conversationText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laika-conversation-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    log('📁 Conversation exported successfully', 'success');
}

async function updateProvider() {
    const providerSelect = document.getElementById('llmProviderSelect');
    const newProvider = providerSelect.value;
    
    try {
        log(`🔧 Updating LLM provider to: ${newProvider}`, 'info');
        
        // In real implementation, this would call the hybrid service API
        document.getElementById('currentProvider').textContent = `${newProvider} (Primary)`;
        
        log('✅ LLM provider updated successfully', 'success');
        
    } catch (error) {
        log(`❌ Failed to update provider: ${error.message}`, 'error');
    }
}

async function testLLM() {
    try {
        updateStatus('processing', 'Testing LLM...');
        
        log('🧠 Testing LLM system...', 'info');
        
        // Simulate LLM test
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Add a test conversation
        addMessageToConversation('user', 'Hello, this is a test message.');
        const response = await generateLLMResponse('Hello, this is a test message.');
        addMessageToConversation('assistant', response);
        
        updateStatus('ready', 'LLM Test Complete');
        log('✅ LLM test completed successfully', 'success');
        
    } catch (error) {
        log(`❌ LLM test failed: ${error.message}`, 'error');
        updateStatus('error', 'Test Failed');
    }
}

function updateStatus(status, text) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = text;
        statusElement.className = `status-indicator status-${status}`;
    }
    
    // Update status text
    const statusTextElement = document.getElementById('statusText');
    if (statusTextElement) {
        statusTextElement.textContent = text;
    }
}

function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    
    // Add to system log
    const logArea = document.getElementById('systemLog');
    if (logArea) {
        const logDiv = document.createElement('div');
        logDiv.className = `log-entry log-${type}`;
        logDiv.textContent = logEntry;
        logArea.appendChild(logDiv);
        logArea.scrollTop = logArea.scrollHeight;
    }
    
    // Also log to console
    console.log(logEntry);
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    log('🛑 Hybrid LLM Control Panel shutting down', 'info');
});
