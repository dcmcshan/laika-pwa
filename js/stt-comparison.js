// STT Comparison JavaScript
// Global variables
let mediaRecorder = null;
let audioChunks = [];
let audioBlob = null;
let isRecording = false;
let recordingStartTime = null;
let timerInterval = null;
let audioContext = null;
let analyser = null;
let microphone = null;
let animationId = null;

// STT provider configurations
const STT_PROVIDERS = {
    web_speech: {
        name: 'Web Speech API',
        endpoint: null,  // Uses browser API
        type: 'browser'
    },
    whisper_local: {
        name: 'Whisper (Local)',
        endpoint: '/api/stt/whisper/local',
        type: 'local'
    },
    openai_whisper: {
        name: 'OpenAI Whisper',
        endpoint: '/api/stt/openai/whisper',
        type: 'cloud'
    },
    openai_realtime: {
        name: 'OpenAI Realtime',
        endpoint: '/api/stt/openai/realtime',
        type: 'cloud'
    },
    elevenlabs: {
        name: 'ElevenLabs STT',
        endpoint: '/api/stt/elevenlabs',
        type: 'cloud'
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeAudioContext();
    updateProviderSelection();
    loadLaikaSTTConfig();
});

// Initialize audio context and visualizer
async function initializeAudioContext() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const canvas = document.getElementById('visualizer');
        const canvasContext = canvas.getContext('2d');
        
        // Style the canvas
        canvasContext.strokeStyle = '#00ffff';
        canvasContext.lineWidth = 2;
    } catch (error) {
        console.error('Failed to initialize audio context:', error);
    }
}

// Toggle recording
async function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

// Start recording
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Initialize MediaRecorder with better quality settings
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
            ? 'audio/webm;codecs=opus' 
            : 'audio/webm';
            
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: mimeType,
            audioBitsPerSecond: 128000
        });
        
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            audioBlob = new Blob(audioChunks, { type: mimeType });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audioPlayer = document.getElementById('audioPlayer');
            audioPlayer.src = audioUrl;
            audioPlayer.style.display = 'block';
            document.getElementById('audioControls').style.display = 'flex';
        };
        
        // Start recording
        mediaRecorder.start();
        isRecording = true;
        
        // Update UI
        const recordBtn = document.getElementById('recordBtn');
        const recordBtnText = document.getElementById('recordBtnText');
        recordBtn.classList.add('recording');
        recordBtnText.textContent = 'STOP';
        
        // Start timer
        recordingStartTime = Date.now();
        document.getElementById('timer').style.display = 'block';
        startTimer();
        
        // Start visualizer
        startVisualizer(stream);
        
    } catch (error) {
        console.error('Error starting recording:', error);
        alert('Failed to access microphone. Please check permissions.');
    }
}

// Stop recording
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;
        
        // Update UI
        const recordBtn = document.getElementById('recordBtn');
        const recordBtnText = document.getElementById('recordBtnText');
        recordBtn.classList.remove('recording');
        recordBtnText.textContent = 'RECORD';
        
        // Stop timer
        stopTimer();
        
        // Stop visualizer
        stopVisualizer();
    }
}

// Timer functions
function startTimer() {
    timerInterval = setInterval(updateTimer, 100);
}

function updateTimer() {
    const elapsed = Date.now() - recordingStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const displaySeconds = seconds % 60;
    
    const timer = document.getElementById('timer');
    timer.textContent = `${minutes.toString().padStart(2, '0')}:${displaySeconds.toString().padStart(2, '0')}`;
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// Visualizer functions
function startVisualizer(stream) {
    if (!audioContext) return;
    
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    
    const canvas = document.getElementById('visualizer');
    const canvasContext = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function draw() {
        animationId = requestAnimationFrame(draw);
        
        analyser.getByteFrequencyData(dataArray);
        
        canvasContext.fillStyle = 'rgba(0, 0, 0, 0.2)';
        canvasContext.fillRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * canvas.height;
            
            const r = 0;
            const g = 255;
            const b = 255;
            
            canvasContext.fillStyle = `rgb(${r},${g},${b})`;
            canvasContext.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            
            x += barWidth + 1;
        }
    }
    
    draw();
}

function stopVisualizer() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    // Clear the canvas
    const canvas = document.getElementById('visualizer');
    const canvasContext = canvas.getContext('2d');
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
}

// Playback controls
function playRecording() {
    const audioPlayer = document.getElementById('audioPlayer');
    if (audioPlayer.paused) {
        audioPlayer.play();
        document.getElementById('playBtnText').textContent = '⏸️ Pause';
    } else {
        audioPlayer.pause();
        document.getElementById('playBtnText').textContent = '▶️ Play';
    }
}

function downloadRecording() {
    if (audioBlob) {
        const url = URL.createObjectURL(audioBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `laika-stt-recording-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

function clearRecording() {
    audioBlob = null;
    audioChunks = [];
    document.getElementById('audioPlayer').src = '';
    document.getElementById('audioPlayer').style.display = 'none';
    document.getElementById('audioControls').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('timer').textContent = '00:00';
}

// Provider selection
function updateProviderSelection() {
    document.querySelectorAll('.config-item input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const configItem = this.closest('.config-item');
            if (this.checked) {
                configItem.classList.add('selected');
            } else {
                configItem.classList.remove('selected');
            }
        });
        
        // Initialize selected state
        if (checkbox.checked) {
            checkbox.closest('.config-item').classList.add('selected');
        }
    });
}

// Process with all selected STT providers
async function processWithAllSTT() {
    if (!audioBlob) {
        alert('Please record audio first');
        return;
    }
    
    // Get selected providers
    const selectedProviders = [];
    document.querySelectorAll('.config-item input[type="checkbox"]:checked').forEach(checkbox => {
        const provider = checkbox.closest('.config-item').dataset.provider;
        selectedProviders.push(provider);
    });
    
    if (selectedProviders.length === 0) {
        alert('Please select at least one STT provider');
        return;
    }
    
    // Show results section
    document.getElementById('resultsSection').style.display = 'block';
    const resultsGrid = document.getElementById('resultsGrid');
    resultsGrid.innerHTML = '';
    
    // Process with each provider in parallel for better performance
    const promises = selectedProviders.map(provider => {
        const resultCard = createResultCard(provider);
        resultsGrid.appendChild(resultCard);
        return processWithProvider(provider, resultCard);
    });
    
    await Promise.allSettled(promises);
}

// Create result card for a provider
function createResultCard(provider) {
    const config = STT_PROVIDERS[provider];
    const card = document.createElement('div');
    card.className = 'result-card';
    card.id = `result-${provider}`;
    card.innerHTML = `
        <h3>
            <span>${config.name}</span>
            <span class="status-badge status-pending">Pending</span>
        </h3>
        <div class="result-content">
            <div style="opacity: 0.5; text-align: center;">Waiting to process...</div>
        </div>
        <div class="result-meta">
            <span>Type: ${config.type}</span>
            <span class="processing-time"></span>
        </div>
    `;
    return card;
}

// Process audio with a specific provider
async function processWithProvider(provider, resultCard) {
    const config = STT_PROVIDERS[provider];
    const statusBadge = resultCard.querySelector('.status-badge');
    const resultContent = resultCard.querySelector('.result-content');
    const processingTime = resultCard.querySelector('.processing-time');
    
    // Update status to processing
    statusBadge.className = 'status-badge status-processing';
    statusBadge.textContent = 'Processing';
    resultContent.innerHTML = '<div style="opacity: 0.7;">Processing audio...</div>';
    
    const startTime = Date.now();
    
    try {
        let transcript = '';
        
        if (provider === 'web_speech') {
            // Use Web Speech API with audio playback workaround
            transcript = await processWithWebSpeech();
        } else {
            // Use server endpoint
            transcript = await processWithServerSTT(config.endpoint, provider);
        }
        
        // Update result
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        statusBadge.className = 'status-badge status-success';
        statusBadge.textContent = 'Complete';
        resultContent.innerHTML = `<div style="color: #00ff00;">${transcript || 'No transcript generated'}</div>`;
        processingTime.textContent = `Time: ${elapsed}s`;
        
    } catch (error) {
        // Update error state
        statusBadge.className = 'status-badge status-error';
        statusBadge.textContent = 'Error';
        resultContent.innerHTML = `<div style="color: #ff4444;">Error: ${error.message}</div>`;
        processingTime.textContent = `Failed`;
        console.error(`Error processing with ${config.name}:`, error);
    }
}

// Process with Web Speech API
async function processWithWebSpeech() {
    return new Promise((resolve, reject) => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            reject(new Error('Web Speech API not supported in this browser'));
            return;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        
        let transcript = '';
        
        recognition.onresult = (event) => {
            transcript = event.results[0][0].transcript;
            const confidence = event.results[0][0].confidence;
            resolve(`${transcript} (confidence: ${(confidence * 100).toFixed(1)}%)`);
        };
        
        recognition.onerror = (event) => {
            if (event.error === 'no-speech') {
                resolve('No speech detected');
            } else {
                reject(new Error(`Speech recognition error: ${event.error}`));
            }
        };
        
        recognition.onend = () => {
            if (!transcript) {
                resolve('No speech detected or recognition ended without results');
            }
        };
        
        // Note: Web Speech API requires real-time audio input
        // We can't directly process the recorded blob
        // This is a limitation that should be noted in the UI
        resolve('Web Speech API requires real-time input. Please use live recording mode for this provider.');
    });
}

// Process with server-based STT
async function processWithServerSTT(endpoint, provider) {
    // Convert webm to wav if needed for better compatibility
    const formData = new FormData();
    
    if (provider === 'whisper_local' || provider === 'openai_whisper') {
        // These services might prefer WAV format
        const wavBlob = await convertToWav(audioBlob);
        formData.append('audio', wavBlob, 'audio.wav');
    } else {
        formData.append('audio', audioBlob, 'audio.webm');
    }
    
    // Add provider-specific parameters
    formData.append('provider', provider);
    
    const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(error || `Server returned ${response.status}`);
    }
    
    const result = await response.json();
    return result.transcript || result.text || result.result || '';
}

// Convert audio blob to WAV format (simplified version)
async function convertToWav(blob) {
    // This is a placeholder - in production, you'd use a library like lamejs or audiobuffer-to-wav
    // For now, return the original blob
    console.log('WAV conversion not implemented, using original format');
    return blob;
}

// LAIKA STT configuration
async function loadLaikaSTTConfig() {
    try {
        const response = await fetch('/api/laika/stt/config');
        if (response.ok) {
            const config = await response.json();
            document.getElementById('laikaSTTProvider').value = config.provider || 'web_speech';
            console.log('Loaded LAIKA STT config:', config);
        }
    } catch (error) {
        console.error('Failed to load LAIKA STT config:', error);
    }
}

async function saveLaikaSTTConfig() {
    const provider = document.getElementById('laikaSTTProvider').value;
    const statusDiv = document.getElementById('laikaConfigStatus');
    
    try {
        statusDiv.innerHTML = '<span style="color: #ffaa00;">Saving configuration...</span>';
        
        const response = await fetch('/api/laika/stt/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                provider: provider,
                timestamp: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            statusDiv.innerHTML = '<span style="color: #00ff00;">✅ Configuration saved successfully!</span>';
            console.log('LAIKA STT config saved:', result);
            
            // Clear status message after 3 seconds
            setTimeout(() => {
                statusDiv.innerHTML = '';
            }, 3000);
        } else {
            throw new Error(`Server returned ${response.status}`);
        }
    } catch (error) {
        statusDiv.innerHTML = `<span style="color: #ff4444;">❌ Failed to save: ${error.message}</span>`;
        console.error('Failed to save LAIKA STT config:', error);
    }
}

function updateLaikaSTTProvider() {
    const provider = document.getElementById('laikaSTTProvider').value;
    const config = STT_PROVIDERS[provider];
    console.log(`Selected LAIKA STT provider: ${config.name}`);
}

// Audio player event listeners
document.addEventListener('DOMContentLoaded', function() {
    const audioPlayer = document.getElementById('audioPlayer');
    if (audioPlayer) {
        audioPlayer.addEventListener('ended', () => {
            document.getElementById('playBtnText').textContent = '▶️ Play';
        });
    }
});
