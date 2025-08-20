/**
 * LAIKA Logs Viewer
 * Real-time log streaming with filtering and analysis
 */

class LAIKALogs {
    constructor() {
        this.isConnected = false;
        this.isPaused = false;
        this.autoScroll = true;
        this.logs = [];
        this.filteredLogs = [];
        this.maxLogs = 1000; // Keep last 1000 logs in memory
        this.logRate = 0;
        this.lastLogTime = Date.now();
        this.logCounts = {
            total: 0,
            error: 0,
            warning: 0,
            info: 0,
            debug: 0,
            trace: 0
        };
        
        // Filter settings
        this.filters = {
            search: '',
            levels: new Set(['error', 'warning', 'info', 'debug', 'trace']),
            source: ''
        };
        
        // WebSocket connection
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.updateUI();
        this.startStatusUpdates();
        
        // Attempt to connect
        await this.connectWebSocket();
        
        console.log('📋 LAIKA Logs viewer initialized');
    }

    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.applyFilters();
        });

        // Level filter buttons
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const level = e.target.dataset.level;
                if (this.filters.levels.has(level)) {
                    this.filters.levels.delete(level);
                    e.target.classList.remove('active');
                } else {
                    this.filters.levels.add(level);
                    e.target.classList.add('active');
                }
                this.applyFilters();
            });
        });

        // Source filter dropdown
        document.getElementById('sourceFilter').addEventListener('change', (e) => {
            this.filters.source = e.target.value;
            this.applyFilters();
        });

        // Action buttons
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportLogs());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearLogs());

        // Auto-scroll toggle
        document.getElementById('autoScrollToggle').addEventListener('click', () => this.toggleAutoScroll());

        // Logs display scroll detection
        const logsDisplay = document.getElementById('logsDisplay');
        logsDisplay.addEventListener('scroll', () => {
            const { scrollTop, scrollHeight, clientHeight } = logsDisplay;
            const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
            
            if (!isAtBottom && this.autoScroll) {
                // User scrolled up, disable auto-scroll
                this.autoScroll = false;
                this.updateAutoScrollToggle();
            } else if (isAtBottom && !this.autoScroll) {
                // User scrolled to bottom, enable auto-scroll
                this.autoScroll = true;
                this.updateAutoScrollToggle();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Page visibility for performance optimization
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseUpdates();
                this.stopPolling();
            } else {
                this.resumeUpdates();
                if (this.isConnected) {
                    this.startRealTimePolling();
                }
            }
        });
    }

    async connectWebSocket() {
        // For ngrok environment, use SocketIO through the main tunnel
        if (window.location.hostname.includes('ngrok')) {
            console.log('🌐 Detected ngrok environment - using SocketIO through main tunnel');
            this.connectSocketIO();
            return;
        }
        
        const wsUrls = [
            `ws://${window.location.hostname}:8765/logs`,
            'ws://laika.local:8765/logs',
            'ws://localhost:8765/logs'
        ];

        for (const url of wsUrls) {
            try {
                console.log(`🔗 Attempting WebSocket connection to ${url}`);
                
                this.ws = new WebSocket(url);
                
                this.ws.onopen = () => {
                    console.log('✅ WebSocket connected to LAIKA log service');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    this.updateConnectionStatus();
                    
                    // Request initial logs
                    this.sendMessage({
                        type: 'request-logs',
                        count: 100 // Get last 100 logs
                    });
                };

                this.ws.onmessage = (event) => {
                    this.handleWebSocketMessage(JSON.parse(event.data));
                };

                this.ws.onclose = () => {
                    console.log('📡 WebSocket disconnected');
                    this.isConnected = false;
                    this.updateConnectionStatus();
                    
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        setTimeout(() => this.reconnect(), 3000);
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);
                };

                // Wait for connection
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 3000);
                    this.ws.onopen = () => {
                        clearTimeout(timeout);
                        resolve();
                    };
                    this.ws.onerror = () => {
                        clearTimeout(timeout);
                        reject(new Error('Connection failed'));
                    };
                });

                break; // Success, exit loop

            } catch (error) {
                console.log(`❌ Failed to connect to ${url}:`, error.message);
                this.ws = null;
                
                if (url === wsUrls[wsUrls.length - 1]) {
                    console.log('🔄 All WebSocket connections failed, trying HTTP API...');
                    await this.loadRealLogs();
                }
            }
        }
    }

    connectSocketIO() {
        // Check if SocketIO is available
        if (typeof io === 'undefined') {
            console.error('❌ SocketIO not available - loading from CDN...');
            this.loadSocketIOAndConnect();
            return;
        } else {
            this.initializeSocketIO();
        }
    }

    initializeSocketIO() {
        try {
            console.log('🔗 Connecting to LAIKA logs via SocketIO...');
            
            // Connect to the current origin (ngrok tunnel) with proper Engine.IO version
            this.socket = io(window.location.origin, {
                transports: ['polling', 'websocket'],
                upgrade: true,
                rememberUpgrade: true,
                forceNew: true,
                // Explicitly specify Engine.IO version 4 for compatibility
                query: {
                    EIO: '4'
                },
                timeout: 10000
            });

            this.socket.on('connect', () => {
                console.log('✅ SocketIO connected to LAIKA logs');
                this.isConnected = true;
                this.updateConnectionStatus();
                
                // Send initial handshake
                this.socket.emit('logs_connected', {
                    client_id: 'logs_interface',
                    timestamp: Date.now()
                });
                
                // Request initial logs
                this.socket.emit('request_logs', {
                    count: 100
                });
            });

            this.socket.on('disconnect', () => {
                console.log('📡 SocketIO disconnected');
                this.isConnected = false;
                this.updateConnectionStatus();
                setTimeout(() => this.reconnect(), 3000);
            });

            this.socket.on('logs_response', (data) => {
                console.log('📋 Logs response:', data);
            });

            this.socket.on('log_batch', (data) => {
                console.log('📋 Received log batch:', data.logs.length, 'logs');
                if (data.logs && Array.isArray(data.logs)) {
                    data.logs.forEach(log => this.addLogEntry(log, false));
                    this.applyFilters();
                    this.updateUI();
                }
            });

            this.socket.on('log_entry', (data) => {
                console.log('📋 New log entry:', data);
                if (data.log) {
                    this.addLogEntry(data.log);
                }
            });

            this.socket.on('error_response', (data) => {
                console.error('❌ SocketIO logs error:', data);
                if (data.type === 'log_error') {
                    this.updateConnectionStatus();
                }
            });

        } catch (error) {
            console.error('❌ SocketIO initialization failed:', error);
            this.isConnected = false;
            this.updateConnectionStatus();
        }
    }

    loadSocketIOAndConnect() {
        // Load SocketIO from CDN if not available
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
        script.onload = () => {
            console.log('✅ SocketIO loaded from CDN');
            this.initializeSocketIO();
        };
        script.onerror = () => {
            console.error('❌ Failed to load SocketIO from CDN');
            // Fall back to HTTP polling
            this.loadRealLogs();
        };
        document.head.appendChild(script);
    }

    sendMessage(message) {
        if (this.socket && this.socket.connected) {
            // Using SocketIO
            console.log('📋 Sending message via SocketIO:', message);
            if (message.type === 'request-logs') {
                this.socket.emit('request_logs', {
                    count: message.count || 100,
                    level: message.level,
                    since: message.since
                });
            }
        } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Using WebSocket
            console.log('📋 Sending message via WebSocket:', message);
            this.ws.send(JSON.stringify(message));
        } else {
            console.log('📡 No connection available, message queued');
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'log-entry':
                this.addLogEntry(data.log);
                break;
            case 'log-batch':
                data.logs.forEach(log => this.addLogEntry(log, false));
                this.applyFilters();
                this.updateUI();
                break;
            case 'log-stats':
                this.updateLogStats(data.stats);
                break;
            case 'error':
                console.error('❌ Log service error:', data.message);
                break;
            default:
                console.log('📦 Unknown message type:', data.type);
        }
    }

    addLogEntry(logData, shouldUpdate = true) {
        if (this.isPaused) return;

        const logEntry = {
            id: logData.id || Date.now() + Math.random(),
            timestamp: new Date(logData.timestamp || Date.now()),
            level: logData.level || 'info',
            source: logData.source || 'unknown',
            message: logData.message || '',
            metadata: logData.metadata || {}
        };

        // Add to logs array
        this.logs.unshift(logEntry);
        
        // Keep only last maxLogs entries
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }

        // Update counts
        this.logCounts.total++;
        this.logCounts[logEntry.level]++;

        // Calculate log rate
        const now = Date.now();
        if (now - this.lastLogTime < 1000) {
            this.logRate++;
        } else {
            this.logRate = 1;
            this.lastLogTime = now;
        }

        if (shouldUpdate) {
            this.applyFilters();
            this.updateUI();
        }
    }

    applyFilters() {
        this.filteredLogs = this.logs.filter(log => {
            // Level filter
            if (!this.filters.levels.has(log.level)) {
                return false;
            }

            // Source filter
            if (this.filters.source && log.source !== this.filters.source) {
                return false;
            }

            // Search filter
            if (this.filters.search) {
                try {
                    const regex = new RegExp(this.filters.search, 'gi');
                    const searchText = `${log.message} ${log.source}`;
                    if (!regex.test(searchText)) {
                        return false;
                    }
                } catch (e) {
                    // Invalid regex, fall back to simple string search
                    const searchText = `${log.message} ${log.source}`.toLowerCase();
                    if (!searchText.includes(this.filters.search.toLowerCase())) {
                        return false;
                    }
                }
            }

            return true;
        });

        this.renderLogs();
        this.updateStats();
    }

    renderLogs() {
        const logsDisplay = document.getElementById('logsDisplay');
        
        if (this.filteredLogs.length === 0) {
            logsDisplay.innerHTML = `
                <div class="empty-logs">
                    <i class="fas fa-filter"></i>
                    <span>No logs match current filters</span>
                    <small>Try adjusting your search or filter criteria</small>
                </div>
            `;
            return;
        }

        const logsHTML = this.filteredLogs.map(log => this.renderLogEntry(log)).join('');
        logsDisplay.innerHTML = logsHTML;

        // Auto-scroll to bottom if enabled
        if (this.autoScroll) {
            logsDisplay.scrollTop = logsDisplay.scrollHeight;
        }
    }

    renderLogEntry(log) {
        const timestamp = log.timestamp.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const message = this.highlightSearchTerms(this.escapeHtml(log.message));

        return `
            <div class="log-entry" data-level="${log.level}">
                <div class="log-timestamp">${timestamp}</div>
                <div class="log-level ${log.level}">${log.level}</div>
                <div class="log-source">${log.source}</div>
                <div class="log-message">${message}</div>
            </div>
        `;
    }

    highlightSearchTerms(text) {
        if (!this.filters.search) return text;

        try {
            const regex = new RegExp(`(${this.escapeRegex(this.filters.search)})`, 'gi');
            return text.replace(regex, '<span class="highlight">$1</span>');
        } catch (e) {
            return text;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.log('📡 WebSocket not connected, message queued');
        }
    }

    // Control Methods
    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pauseBtn');
        const icon = pauseBtn.querySelector('i');
        const text = pauseBtn.querySelector('i').nextSibling;
        
        if (this.isPaused) {
            icon.className = 'fas fa-play';
            pauseBtn.innerHTML = '<i class="fas fa-play"></i> Resume';
        } else {
            icon.className = 'fas fa-pause';
            pauseBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';
        }
    }

    exportLogs() {
        const exportData = {
            timestamp: new Date().toISOString(),
            filters: this.filters,
            logs: this.filteredLogs
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
            type: 'application/json' 
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `laika-logs-${new Date().toISOString().slice(0, 19)}.json`;
        a.click();
        URL.revokeObjectURL(url);

        // Visual feedback
        const exportBtn = document.getElementById('exportBtn');
        const originalHTML = exportBtn.innerHTML;
        exportBtn.innerHTML = '<i class="fas fa-check"></i> Exported';
        setTimeout(() => {
            exportBtn.innerHTML = originalHTML;
        }, 2000);
    }

    clearLogs() {
        if (confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
            this.logs = [];
            this.filteredLogs = [];
            this.logCounts = {
                total: 0,
                error: 0,
                warning: 0,
                info: 0,
                debug: 0,
                trace: 0
            };
            
            this.renderLogs();
            this.updateStats();
            
            // Send clear command to server
            this.sendMessage({
                type: 'clear-logs'
            });
        }
    }

    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        this.updateAutoScrollToggle();
        
        if (this.autoScroll) {
            const logsDisplay = document.getElementById('logsDisplay');
            logsDisplay.scrollTop = logsDisplay.scrollHeight;
        }
    }

    updateAutoScrollToggle() {
        const toggle = document.getElementById('autoScrollToggle');
        toggle.classList.toggle('active', this.autoScroll);
    }

    updateStats() {
        document.getElementById('totalLogs').textContent = this.logCounts.total;
        document.getElementById('errorCount').textContent = this.logCounts.error;
        document.getElementById('warningCount').textContent = this.logCounts.warning;
        document.getElementById('filteredCount').textContent = this.filteredLogs.length;
        document.getElementById('logRate').textContent = `${this.logRate}/sec`;
    }

    updateUI() {
        this.updateStats();
        this.updateConnectionStatus();
    }

    updateConnectionStatus() {
        const indicator = document.getElementById('connectionIndicator');
        const status = document.getElementById('connectionStatus');
        
        if (this.isConnected) {
            indicator.classList.add('connected');
            status.textContent = 'Connected';
        } else {
            indicator.classList.remove('connected');
            status.textContent = 'Disconnected';
        }
    }

    handleKeyboard(event) {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT') return;
        
        switch (event.key) {
            case ' ':
                event.preventDefault();
                this.togglePause();
                break;
            case 'c':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.clearLogs();
                }
                break;
            case 's':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.exportLogs();
                }
                break;
            case '/':
                event.preventDefault();
                document.getElementById('searchInput').focus();
                break;
            case 'Escape':
                document.getElementById('searchInput').blur();
                break;
            case 'End':
                event.preventDefault();
                const logsDisplay = document.getElementById('logsDisplay');
                logsDisplay.scrollTop = logsDisplay.scrollHeight;
                break;
            case 'Home':
                event.preventDefault();
                document.getElementById('logsDisplay').scrollTop = 0;
                break;
        }
    }

    startStatusUpdates() {
        // Update time
        setInterval(() => {
            const now = new Date();
            document.getElementById('currentTime').textContent = 
                now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }, 1000);
        
        // Simulate battery updates
        setInterval(() => {
            const battery = Math.max(20, 85 + Math.sin(Date.now() / 10000) * 5);
            document.getElementById('batteryLevel').textContent = `${Math.round(battery)}%`;
        }, 5000);

        // Reset log rate counter
        setInterval(() => {
            this.logRate = 0;
            this.updateStats();
        }, 1000);
    }

    pauseUpdates() {
        this.isPaused = true;
    }

    resumeUpdates() {
        this.isPaused = false;
    }

    async loadRealLogs() {
        console.log('📋 Loading real system logs...');
        
        try {
            // Use HTTP API for logs since we're on ngrok
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/api/system/logs?limit=100`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.logs) {
                    console.log(`✅ Loaded ${data.logs.length} real log entries`);
                    
                    // Clear existing logs and add real ones
                    this.logs = [];
                    this.logCounts = { total: 0, error: 0, warning: 0, info: 0, debug: 0, trace: 0 };
                    
                    data.logs.forEach(log => {
                        this.addLogEntry(log, false);
                    });
                    
                    this.applyFilters();
                    this.updateUI();
                    
                    // Start polling for new logs
                    this.startRealTimePolling();
                } else {
                    throw new Error('Invalid response format');
                }
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Failed to load real logs:', error);
            this.showError(`Failed to load system logs: ${error.message}`);
        }
    }

    startRealTimePolling() {
        // Clear any existing polling interval
        if (this.logPollingInterval) {
            clearInterval(this.logPollingInterval);
        }
        
        // Poll for new logs every 2 seconds
        this.logPollingInterval = setInterval(async () => {
            if (this.isPaused) return;
            
            try {
                const baseUrl = window.location.origin;
                const lastTimestamp = this.logs.length > 0 ? this.logs[0].timestamp : null;
                const params = lastTimestamp ? `?since=${encodeURIComponent(lastTimestamp)}` : '?limit=10';
                
                const response = await fetch(`${baseUrl}/api/system/logs${params}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.logs && data.logs.length > 0) {
                        data.logs.forEach(log => {
                            this.addLogEntry(log, false);
                        });
                        this.applyFilters();
                        this.updateUI();
                    }
                }
            } catch (error) {
                console.error('❌ Error polling for new logs:', error);
            }
        }, 2000);
    }

    stopPolling() {
        if (this.logPollingInterval) {
            clearInterval(this.logPollingInterval);
            this.logPollingInterval = null;
        }
    }

    showError(message) {
        const logsDisplay = document.getElementById('logsDisplay');
        logsDisplay.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
                <button onclick="window.laikaLogs.loadRealLogs()" class="retry-button">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }

    async reconnect() {
        if (!this.isConnected) {
            this.reconnectAttempts++;
            console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            await this.connectWebSocket();
        }
    }
}

// Initialize logs viewer when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.laikaLogs = new LAIKALogs();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.laikaLogs && window.laikaLogs.ws) {
        window.laikaLogs.ws.close();
    }
});
