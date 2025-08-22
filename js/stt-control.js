/**
 * LAIKA STT Control Panel
 * Interfaces with LAIKA's ROS2 STT system for configuration and monitoring
 */

// Global variables
let sttSubscription = null;
let isConnected = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    log('🎤 Initializing LAIKA STT Control Panel...', 'info');
    initializeSTTControl();
});

async function initializeSTTControl() {
    try {
        // Wait for ROS2 bridge to be available
        await waitForROS2Bridge();
        
        // Subscribe to STT results
        subscribeToSTTResults();
        
        // Load current configuration
        await loadCurrentConfiguration();
        
        // Update status
        updateStatus('ready', 'Connected to LAIKA STT');
        
        log('✅ STT Control Panel initialized successfully', 'success');
        
    } catch (error) {
        log(`❌ Failed to initialize STT control: ${error.message}`, 'error');
        updateStatus('error', 'Connection Failed');
    }
}

async function waitForROS2Bridge() {
    return new Promise((resolve, reject) => {
        const maxAttempts = 30; // 30 seconds
        let attempts = 0;
        
        const checkBridge = () => {
            attempts++;
            
            if (typeof window.ros2Bridge !== 'undefined' && window.ros2Bridge.isAvailable()) {
                isConnected = true;
                resolve();
            } else if (attempts >= maxAttempts) {
                reject(new Error('ROS2 bridge not available after 30 seconds'));
            } else {
                setTimeout(checkBridge, 1000);
            }
        };
        
        checkBridge();
    });
}

function subscribeToSTTResults() {
    if (!window.ros2Bridge || !window.ros2Bridge.isAvailable()) {
        log('⚠️ ROS2 bridge not available, cannot subscribe to STT results', 'warning');
        return;
    }
    
    try {
        // Subscribe to LAIKA's STT result topic
        sttSubscription = window.ros2Bridge.subscribe('/vocal_detect/asr_result', 'std_msgs/msg/String', (msg) => {
            const transcript = msg.data;
            if (transcript && transcript.trim()) {
                addTranscriptEntry(transcript);
                log(`🎤 STT Result: "${transcript}"`, 'success');
            }
        });
        
        log('✅ Subscribed to LAIKA STT results', 'success');
        
    } catch (error) {
        log(`❌ Failed to subscribe to STT results: ${error.message}`, 'error');
    }
}

async function loadCurrentConfiguration() {
    if (!window.ros2Bridge || !window.ros2Bridge.isAvailable()) {
        log('⚠️ ROS2 bridge not available, cannot load configuration', 'warning');
        return;
    }
    
    try {
        // Get current STT node parameters
        const wakeWord = await window.ros2Bridge.getParameter('/stt_node', 'awake_word');
        const enableWakeup = await window.ros2Bridge.getParameter('/stt_node', 'enable_wakeup');
        const primaryProvider = await window.ros2Bridge.getParameter('/stt_node', 'stt_primary_provider');
        const fallbackOrder = await window.ros2Bridge.getParameter('/stt_node', 'stt_fallback_order');
        const enableElevenlabs = await window.ros2Bridge.getParameter('/stt_node', 'enable_elevenlabs_stt');
        
        // Update UI with current values
        document.getElementById('currentWakeWord').textContent = wakeWord || 'LAIKA';
        document.getElementById('currentWakeDetection').textContent = enableWakeup ? 'Enabled' : 'Disabled';
        document.getElementById('currentSTTProvider').textContent = `${primaryProvider} (Primary)`;
        document.getElementById('currentFallbackOrder').textContent = fallbackOrder ? fallbackOrder.join(' → ') : 'openai_whisper → local_whisper → elevenlabs';
        
        // Update form inputs
        document.getElementById('wakeWordInput').value = wakeWord || 'LAIKA';
        document.getElementById('enableWakeDetection').checked = enableWakeup !== false;
        document.getElementById('sttPrioritySelect').value = primaryProvider || 'openai_realtime';
        
        log('✅ Loaded current STT configuration', 'success');
        
    } catch (error) {
        log(`⚠️ Could not load current configuration: ${error.message}`, 'warning');
        // Use defaults
        document.getElementById('currentWakeWord').textContent = 'LAIKA';
        document.getElementById('currentWakeDetection').textContent = 'Enabled';
        document.getElementById('currentSTTProvider').textContent = 'openai_realtime (Primary)';
        document.getElementById('currentFallbackOrder').textContent = 'openai_whisper → local_whisper → elevenlabs';
    }
}

async function saveConfiguration() {
    if (!window.ros2Bridge || !window.ros2Bridge.isAvailable()) {
        log('❌ ROS2 bridge not available', 'error');
        return;
    }
    
    try {
        const wakeWord = document.getElementById('wakeWordInput').value.trim();
        const enableWakeup = document.getElementById('enableWakeDetection').checked;
        const sttPriority = document.getElementById('sttPrioritySelect').value;
        
        if (!wakeWord) {
            log('❌ Wake word cannot be empty', 'error');
            return;
        }
        
        log('💾 Saving STT configuration...', 'info');
        
        // Set STT node parameters
        await window.ros2Bridge.setParameter('/stt_node', 'awake_word', wakeWord);
        await window.ros2Bridge.setParameter('/stt_node', 'enable_wakeup', enableWakeup);
        await window.ros2Bridge.setParameter('/stt_node', 'stt_primary_provider', sttPriority);
        
        // Update current configuration display
        document.getElementById('currentWakeWord').textContent = wakeWord;
        document.getElementById('currentWakeDetection').textContent = enableWakeup ? 'Enabled' : 'Disabled';
        document.getElementById('currentSTTProvider').textContent = `${sttPriority} (Primary)`;
        
        log('✅ STT configuration saved successfully', 'success');
        
        // Show success message
        updateStatus('ready', 'Configuration Saved');
        
    } catch (error) {
        log(`❌ Failed to save configuration: ${error.message}`, 'error');
        updateStatus('error', 'Save Failed');
    }
}

async function resetConfiguration() {
    if (!window.ros2Bridge || !window.ros2Bridge.isAvailable()) {
        log('❌ ROS2 bridge not available', 'error');
        return;
    }
    
    try {
        log('🔄 Resetting STT configuration to defaults...', 'info');
        
        // Reset to default values
        const defaultWakeWord = 'LAIKA';
        const defaultEnableWakeup = true;
        
        // Set default parameters
        await window.ros2Bridge.setParameter('/stt_node', 'awake_word', defaultWakeWord);
        await window.ros2Bridge.setParameter('/stt_node', 'enable_wakeup', defaultEnableWakeup);
        await window.ros2Bridge.setParameter('/stt_node', 'stt_primary_provider', 'openai_realtime');
        
        // Update UI
        document.getElementById('wakeWordInput').value = defaultWakeWord;
        document.getElementById('enableWakeDetection').checked = defaultEnableWakeup;
        document.getElementById('sttPrioritySelect').value = 'openai_realtime';
        
        document.getElementById('currentWakeWord').textContent = defaultWakeWord;
        document.getElementById('currentWakeDetection').textContent = 'Enabled';
        document.getElementById('currentSTTProvider').textContent = 'openai_realtime (Primary)';
        
        log('✅ STT configuration reset to defaults', 'success');
        updateStatus('ready', 'Configuration Reset');
        
    } catch (error) {
        log(`❌ Failed to reset configuration: ${error.message}`, 'error');
        updateStatus('error', 'Reset Failed');
    }
}

async function testSTT() {
    if (!window.ros2Bridge || !window.ros2Bridge.isAvailable()) {
        log('❌ ROS2 bridge not available', 'error');
        return;
    }
    
    try {
        log('🎤 Testing STT system...', 'info');
        updateStatus('processing', 'Testing STT...');
        
        // Call STT test service if available
        try {
            await window.ros2Bridge.callService('/stt_node/test_stt', 'std_srvs/srv/Trigger', {});
            log('✅ STT test initiated', 'success');
        } catch (serviceError) {
            log('⚠️ STT test service not available, testing via wake word', 'warning');
            
            // Alternative: enable wake detection temporarily for testing
            const wasEnabled = document.getElementById('enableWakeDetection').checked;
            if (!wasEnabled) {
                await window.ros2Bridge.setParameter('/stt_node', 'enable_wakeup', true);
                log('🎤 Wake detection enabled for testing. Say "LAIKA" to test STT.', 'info');
                
                // Revert after 10 seconds
                setTimeout(async () => {
                    await window.ros2Bridge.setParameter('/stt_node', 'enable_wakeup', wasEnabled);
                    log('🔄 Wake detection restored to previous state', 'info');
                }, 10000);
            } else {
                log('🎤 Wake detection already enabled. Say "LAIKA" to test STT.', 'info');
            }
        }
        
        updateStatus('ready', 'Test Complete');
        
    } catch (error) {
        log(`❌ STT test failed: ${error.message}`, 'error');
        updateStatus('error', 'Test Failed');
    }
}

async function refreshStatus() {
    if (!window.ros2Bridge || !window.ros2Bridge.isAvailable()) {
        log('❌ ROS2 bridge not available', 'error');
        updateStatus('error', 'Not Connected');
        return;
    }
    
    try {
        log('🔄 Refreshing STT status...', 'info');
        updateStatus('processing', 'Refreshing...');
        
        // Reload configuration
        await loadCurrentConfiguration();
        
        // Check if STT node is running
        try {
            await window.ros2Bridge.getParameter('/stt_node', 'enable_wakeup');
            updateStatus('ready', 'STT System Active');
            log('✅ STT system is running', 'success');
        } catch (error) {
            updateStatus('error', 'STT Node Not Found');
            log('❌ STT node not found or not responding', 'error');
        }
        
    } catch (error) {
        log(`❌ Status refresh failed: ${error.message}`, 'error');
        updateStatus('error', 'Refresh Failed');
    }
}

function addTranscriptEntry(text) {
    const transcriptArea = document.getElementById('transcriptArea');
    
    // Remove placeholder
    const placeholder = transcriptArea.querySelector('[style*="opacity: 0.5"]');
    if (placeholder) placeholder.remove();
    
    // Create new entry
    const entry = document.createElement('div');
    entry.className = 'transcript-entry';
    entry.innerHTML = `<strong>[${new Date().toLocaleTimeString()}]</strong> ${text}`;
    transcriptArea.appendChild(entry);
    
    // Auto-scroll to bottom
    transcriptArea.scrollTop = transcriptArea.scrollHeight;
}

function clearTranscript() {
    const transcriptArea = document.getElementById('transcriptArea');
    transcriptArea.innerHTML = '<div style="opacity: 0.5; text-align: center; padding: 20px;">STT results will appear here...</div>';
    log('🗑️ Transcript cleared', 'info');
}

function copyTranscript() {
    const transcriptArea = document.getElementById('transcriptArea');
    const entries = transcriptArea.querySelectorAll('.transcript-entry');
    const text = Array.from(entries).map(entry => entry.textContent.replace(/^\[.*?\]\s*/, '')).join('\n');
    
    if (text) {
        navigator.clipboard.writeText(text).then(() => {
            log('📋 Transcript copied to clipboard', 'success');
        }).catch(err => {
            log(`❌ Failed to copy transcript: ${err}`, 'error');
        });
    } else {
        log('⚠️ No transcript to copy', 'warning');
    }
}

function updateStatus(status, text) {
    const indicator = document.getElementById('sttStatus');
    const statusText = document.getElementById('sttStatusText');
    
    // Remove all status classes
    indicator.className = 'status-indicator';
    indicator.classList.add(`status-${status}`);
    statusText.textContent = text;
}

function log(message, type = 'info') {
    const logArea = document.getElementById('systemLog');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    
    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
    
    // Also log to console
    console.log(`[STT Control] ${message}`);
}

function clearLog() {
    document.getElementById('systemLog').innerHTML = '';
    log('🗑️ System log cleared', 'info');
}

function exportLog() {
    const logArea = document.getElementById('systemLog');
    const logText = Array.from(logArea.children).map(entry => entry.textContent).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laika-stt-log-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    
    log('📄 System log exported', 'success');
}

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (sttSubscription && window.ros2Bridge) {
        try {
            window.ros2Bridge.unsubscribe(sttSubscription);
        } catch (error) {
            console.error('Error unsubscribing from STT:', error);
        }
    }
});
