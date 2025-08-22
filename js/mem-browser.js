/**
 * LAIKA MEM Browser - Memory Management Interface
 * Optimized for Pi5 performance
 */

class MEMBrowser {
    constructor() {
        this.memApiUrl = 'http://localhost:8082/api/memory';
        this.cameraStream = null;
        this.currentImage = null;
        this.recognitionCount = 0;
        this.autoRefresh = false;
        this.refreshInterval = null;
        
        this.initialize();
    }
    
    async initialize() {
        console.log('🧠 Initializing MEM Browser...');
        
        // Load initial data
        await this.loadMemoryStatus();
        await this.loadConversations();
        await this.loadImageMemory();
        await this.loadPersistentMemory();
        
        // Start auto-refresh (every 10 seconds for Pi5 efficiency)
        this.startAutoRefresh();
        
        console.log('✅ MEM Browser initialized');
    }
    
    // Memory Status Management
    async loadMemoryStatus() {
        try {
            const response = await fetch(`${this.memApiUrl}/status`);
            const data = await response.json();
            
            if (data.success) {
                this.updateMemoryStats(data.status);
            }
        } catch (error) {
            console.error('❌ Error loading memory status:', error);
            this.updateMemoryStats({
                conversation_memory: { count: 0 },
                image_memory: { count: 0 },
                persistent_memory: { count: 0 }
            });
        }
    }
    
    updateMemoryStats(status) {
        document.getElementById('conv-count').textContent = status.conversation_memory?.count || 0;
        document.getElementById('image-count').textContent = status.image_memory?.count || 0;
        document.getElementById('persistent-count').textContent = status.persistent_memory?.count || 0;
        document.getElementById('recognition-count').textContent = this.recognitionCount;
    }
    
    // Conversation Memory
    async loadConversations() {
        try {
            const response = await fetch(`${this.memApiUrl}/conversation?limit=20`);
            const data = await response.json();
            
            if (data.success) {
                this.updateConversationList(data.conversations);
            } else {
                this.showEmptyState('conversation-list', 'No conversations yet');
            }
        } catch (error) {
            console.error('❌ Error loading conversations:', error);
            this.showEmptyState('conversation-list', 'Failed to load conversations');
        }
    }
    
    updateConversationList(conversations) {
        const container = document.getElementById('conversation-list');
        
        if (!conversations || conversations.length === 0) {
            this.showEmptyState('conversation-list', 'No conversations yet');
            return;
        }
        
        container.innerHTML = conversations.map(conv => `
            <div class="memory-item">
                <div class="memory-content">
                    <strong>Human:</strong> ${this.truncateText(conv.user_input, 100)}
                </div>
                ${conv.assistant_response ? `
                <div class="memory-content">
                    <strong>LAIKA:</strong> ${this.truncateText(conv.assistant_response, 100)}
                </div>
                ` : ''}
                <div class="memory-meta">
                    <span class="memory-timestamp">${this.formatTimestamp(conv.timestamp)}</span>
                    <span>${conv.context || 'general'}</span>
                </div>
            </div>
        `).join('');
    }
    
    // Image Memory
    async loadImageMemory() {
        try {
            const response = await fetch(`${this.memApiUrl}/image`);
            const data = await response.json();
            
            if (data.success) {
                this.updateImageMemoryList(data);
            } else {
                this.showEmptyState('image-memory-list', 'No image memory available');
            }
        } catch (error) {
            console.error('❌ Error loading image memory:', error);
            this.showEmptyState('image-memory-list', 'Failed to load image memory');
        }
    }
    
    updateImageMemoryList(data) {
        const container = document.getElementById('image-memory-list');
        
        if (!data.image_count || data.image_count === 0) {
            this.showEmptyState('image-memory-list', 'No images in memory');
            return;
        }
        
        container.innerHTML = `
            <div class="memory-item">
                <div class="memory-content">
                    <strong>Images in Memory:</strong> ${data.image_count}
                </div>
                <div class="memory-meta">
                    <span>Max: ${data.max_images}</span>
                    <span>Available: ${data.available ? 'Yes' : 'No'}</span>
                </div>
            </div>
        `;
    }
    
    // Persistent Memory
    async loadPersistentMemory() {
        try {
            const response = await fetch(`${this.memApiUrl}/persistent`);
            const data = await response.json();
            
            if (data.success) {
                this.updatePersistentMemoryList(data.memory);
            } else {
                this.showEmptyState('persistent-memory-list', 'No persistent memory');
            }
        } catch (error) {
            console.error('❌ Error loading persistent memory:', error);
            this.showEmptyState('persistent-memory-list', 'Failed to load persistent memory');
        }
    }
    
    updatePersistentMemoryList(memory) {
        const container = document.getElementById('persistent-memory-list');
        
        if (!memory || Object.keys(memory).length === 0) {
            this.showEmptyState('persistent-memory-list', 'No persistent memory entries');
            return;
        }
        
        container.innerHTML = Object.entries(memory).map(([key, entry]) => `
            <div class="memory-item">
                <div class="memory-content">
                    <strong>${key}:</strong> ${this.truncateText(JSON.stringify(entry.value), 80)}
                </div>
                <div class="memory-meta">
                    <span class="memory-timestamp">${this.formatTimestamp(entry.updated)}</span>
                </div>
            </div>
        `).join('');
    }
    
    // Camera Management (Pi5 optimized)
    async startCamera() {
        try {
            this.updateRecognitionStatus('processing', 'Starting camera...');
            
            // For Pi5, use a simple image capture approach
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 5 } // Low frame rate for Pi5
                } 
            });
            
            const video = document.createElement('video');
            video.srcObject = stream;
            video.play();
            
            // Capture frame every 5 seconds for Pi5 efficiency
            this.cameraInterval = setInterval(() => {
                this.captureFrame(video);
            }, 5000);
            
            this.cameraStream = stream;
            this.updateRecognitionStatus('idle', 'Camera active - capturing every 5s');
            
        } catch (error) {
            console.error('❌ Error starting camera:', error);
            this.updateRecognitionStatus('error', 'Failed to start camera');
        }
    }
    
    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
            this.cameraStream = null;
        }
        
        if (this.cameraInterval) {
            clearInterval(this.cameraInterval);
            this.cameraInterval = null;
        }
        
        this.updateRecognitionStatus('idle', 'Camera stopped');
    }
    
    captureFrame(video) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        
        // Convert to base64 for storage
        this.currentImage = canvas.toDataURL('image/jpeg', 0.7); // Lower quality for Pi5
        
        // Update camera feed
        document.getElementById('camera-image').src = this.currentImage;
        
        // Process for recognition
        this.processImageForRecognition();
    }
    
    async processImageForRecognition() {
        if (!this.currentImage) return;
        
        try {
            this.updateRecognitionStatus('processing', 'Processing image...');
            
            // For Pi5, we'll simulate recognition since we don't have the full pipeline
            // In a real implementation, this would send the image to the MEM node
            
            // Simulate recognition delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Simulate recognition result
            const simulatedMatch = Math.random() > 0.7; // 30% chance of match
            
            if (simulatedMatch) {
                this.recognitionCount++;
                this.updateRecognitionStatus('match', 'Match found! (simulated)');
                this.updateMemoryStats({
                    conversation_memory: { count: parseInt(document.getElementById('conv-count').textContent) },
                    image_memory: { count: parseInt(document.getElementById('image-count').textContent) },
                    persistent_memory: { count: parseInt(document.getElementById('persistent-count').textContent) }
                });
            } else {
                this.updateRecognitionStatus('idle', 'No match found');
            }
            
        } catch (error) {
            console.error('❌ Error processing image:', error);
            this.updateRecognitionStatus('error', 'Processing failed');
        }
    }
    
    updateRecognitionStatus(status, message) {
        const statusElement = document.getElementById('recognition-status');
        statusElement.className = `recognition-status status-${status}`;
        statusElement.textContent = `Recognition: ${message}`;
    }
    
    // Utility Functions
    showEmptyState(containerId, message) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="empty-state">
                ${message}
            </div>
        `;
    }
    
    truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    formatTimestamp(timestamp) {
        if (!timestamp) return 'Unknown';
        try {
            const date = new Date(timestamp);
            return date.toLocaleString();
        } catch (error) {
            return timestamp;
        }
    }
    
    startAutoRefresh() {
        this.autoRefresh = true;
        this.refreshInterval = setInterval(() => {
            this.loadMemoryStatus();
        }, 10000); // Refresh every 10 seconds for Pi5 efficiency
    }
    
    stopAutoRefresh() {
        this.autoRefresh = false;
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
    
    // Public API Functions
    async refreshMemory() {
        await this.loadMemoryStatus();
        await this.loadConversations();
        await this.loadImageMemory();
        await this.loadPersistentMemory();
    }
    
    async clearMemory() {
        if (!confirm('Are you sure you want to clear all memory? This cannot be undone.')) {
            return;
        }
        
        try {
            const response = await fetch(`${this.memApiUrl}/clear`, { method: 'POST' });
            const data = await response.json();
            
            if (data.success) {
                alert('Memory cleared successfully');
                await this.refreshMemory();
            } else {
                alert('Failed to clear memory');
            }
        } catch (error) {
            console.error('❌ Error clearing memory:', error);
            alert('Error clearing memory');
        }
    }
    
    async captureImage() {
        if (this.currentImage) {
            // Save current image
            const link = document.createElement('a');
            link.download = `laika-mem-${Date.now()}.jpg`;
            link.href = this.currentImage;
            link.click();
        } else {
            alert('No image captured yet. Start the camera first.');
        }
    }
    
    async addCurrentImage() {
        if (!this.currentImage) {
            alert('No image captured yet. Start the camera first.');
            return;
        }
        
        const metadata = prompt('Enter description for this image:');
        if (!metadata) return;
        
        try {
            // In a real implementation, this would send the image to the MEM node
            alert('Image added to memory (simulated)');
        } catch (error) {
            console.error('❌ Error adding image:', error);
            alert('Failed to add image to memory');
        }
    }
    
    async recognizeCurrentImage() {
        if (!this.currentImage) {
            alert('No image captured yet. Start the camera first.');
            return;
        }
        
        await this.processImageForRecognition();
    }
    
    async addPersistentMemory() {
        const key = prompt('Enter memory key:');
        if (!key) return;
        
        const value = prompt('Enter memory value:');
        if (!value) return;
        
        try {
            const response = await fetch(`${this.memApiUrl}/persistent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('Memory added successfully');
                await this.loadPersistentMemory();
            } else {
                alert('Failed to add memory');
            }
        } catch (error) {
            console.error('❌ Error adding persistent memory:', error);
            alert('Error adding memory');
        }
    }
    
    async exportMemory() {
        try {
            const response = await fetch(`${this.memApiUrl}/status`);
            const data = await response.json();
            
            if (data.success) {
                const blob = new Blob([JSON.stringify(data.status, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `laika-mem-export-${Date.now()}.json`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('❌ Error exporting memory:', error);
            alert('Error exporting memory');
        }
    }
}

// Global functions for HTML onclick handlers
let memBrowser;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    memBrowser = new MEMBrowser();
});

// Global functions
function refreshMemory() {
    if (memBrowser) memBrowser.refreshMemory();
}

function clearMemory() {
    if (memBrowser) memBrowser.clearMemory();
}

function startCamera() {
    if (memBrowser) memBrowser.startCamera();
}

function stopCamera() {
    if (memBrowser) memBrowser.stopCamera();
}

function captureImage() {
    if (memBrowser) memBrowser.captureImage();
}

function addCurrentImage() {
    if (memBrowser) memBrowser.addCurrentImage();
}

function recognizeCurrentImage() {
    if (memBrowser) memBrowser.recognizeCurrentImage();
}

function addPersistentMemory() {
    if (memBrowser) memBrowser.addPersistentMemory();
}

function exportMemory() {
    if (memBrowser) memBrowser.exportMemory();
}
