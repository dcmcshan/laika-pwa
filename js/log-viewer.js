/**
 * LAIKA Log Viewer Component
 * Comprehensive log viewing with filtering, search, and live updates
 */

class LAIKALogViewer {
    constructor() {
        this.logs = [];
        this.filteredLogs = [];
        this.filters = {
            level: null,
            category: null,
            search: '',
            limit: 100
        };
        this.availableCategories = [];
        this.availableLevels = [];
        this.isLiveMode = false;
        this.eventSource = null;
        this.autoScroll = true;
        this.updateInterval = null;
    }

    async initialize() {
        console.log('Initializing LAIKA Log Viewer...');
        await this.loadLogs();
        this.setupUI();
        this.startAutoUpdate();
    }

    async loadLogs() {
        try {
            const params = new URLSearchParams();
            if (this.filters.level) params.append('level', this.filters.level);
            if (this.filters.category) params.append('category', this.filters.category);
            if (this.filters.search) params.append('search', this.filters.search);
            params.append('limit', this.filters.limit);

            const response = await fetch(`http://localhost:5001/api/system/logs?${params}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.logs = data.logs;
                    this.filteredLogs = data.logs;
                    this.availableCategories = data.filters.available_categories;
                    this.availableLevels = data.filters.available_levels;
                    this.renderLogs();
                    this.updateFilterOptions();
                }
            }
        } catch (error) {
            console.error('Failed to load logs:', error);
        }
    }

    setupUI() {
        // Find or create log viewer container
        let logContainer = document.getElementById('logViewerContainer');
        if (!logContainer) {
            logContainer = document.createElement('div');
            logContainer.id = 'logViewerContainer';
            logContainer.className = 'log-viewer-container';
            
            // Add to control page
            const controlPage = document.getElementById('controlPage');
            if (controlPage) {
                controlPage.appendChild(logContainer);
            }
        }

        logContainer.innerHTML = `
            <div class="control-section">
                <h3 class="section-title">📋 System Logs & Monitoring</h3>
                
                <!-- Log Controls -->
                <div class="log-controls">
                    <div class="log-filters">
                        <select id="levelFilter" class="log-filter-select">
                            <option value="">All Levels</option>
                        </select>
                        
                        <select id="categoryFilter" class="log-filter-select">
                            <option value="">All Categories</option>
                        </select>
                        
                        <input type="text" id="searchFilter" class="log-search-input" 
                               placeholder="Search logs..." value="${this.filters.search}">
                        
                        <select id="limitFilter" class="log-filter-select">
                            <option value="50">50 logs</option>
                            <option value="100" selected>100 logs</option>
                            <option value="200">200 logs</option>
                            <option value="500">500 logs</option>
                        </select>
                    </div>
                    
                    <div class="log-actions">
                        <button id="refreshLogsBtn" class="control-button">
                            <span class="control-icon">🔄</span>
                            <span class="control-label">Refresh</span>
                        </button>
                        
                        <button id="clearLogsBtn" class="control-button">
                            <span class="control-icon">🗑️</span>
                            <span class="control-label">Clear</span>
                        </button>
                        
                        <button id="exportLogsBtn" class="control-button">
                            <span class="control-icon">📥</span>
                            <span class="control-label">Export</span>
                        </button>
                        
                        <button id="liveModeBtn" class="control-button ${this.isLiveMode ? 'active' : ''}">
                            <span class="control-icon">${this.isLiveMode ? '⏸️' : '▶️'}</span>
                            <span class="control-label">${this.isLiveMode ? 'Stop Live' : 'Live Mode'}</span>
                        </button>
                    </div>
                </div>
                
                <!-- Log Statistics -->
                <div class="log-stats">
                    <div class="stat-item">
                        <span class="stat-label">Total Logs:</span>
                        <span class="stat-value" id="totalLogsCount">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Filtered:</span>
                        <span class="stat-value" id="filteredLogsCount">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Errors:</span>
                        <span class="stat-value error" id="errorLogsCount">0</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Warnings:</span>
                        <span class="stat-value warning" id="warningLogsCount">0</span>
                    </div>
                </div>
                
                <!-- Log Display -->
                <div class="log-display" id="logDisplay">
                    <div class="log-placeholder">
                        Loading logs...
                    </div>
                </div>
                
                <!-- Command History -->
                <div class="command-history-section">
                    <h4 class="subsection-title">🎮 Recent Commands</h4>
                    <div class="command-history" id="commandHistory">
                        <div class="command-placeholder">No commands executed yet</div>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Filter controls
        document.getElementById('levelFilter').addEventListener('change', (e) => {
            this.filters.level = e.target.value || null;
            this.applyFilters();
        });

        document.getElementById('categoryFilter').addEventListener('change', (e) => {
            this.filters.category = e.target.value || null;
            this.applyFilters();
        });

        document.getElementById('searchFilter').addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.debounceSearch();
        });

        document.getElementById('limitFilter').addEventListener('change', (e) => {
            this.filters.limit = parseInt(e.target.value);
            this.loadLogs();
        });

        // Action buttons
        document.getElementById('refreshLogsBtn').addEventListener('click', () => {
            this.loadLogs();
        });

        document.getElementById('clearLogsBtn').addEventListener('click', () => {
            this.clearLogs();
        });

        document.getElementById('exportLogsBtn').addEventListener('click', () => {
            this.exportLogs();
        });

        document.getElementById('liveModeBtn').addEventListener('click', () => {
            this.toggleLiveMode();
        });
    }

    updateFilterOptions() {
        // Update level filter
        const levelFilter = document.getElementById('levelFilter');
        levelFilter.innerHTML = '<option value="">All Levels</option>';
        this.availableLevels.forEach(level => {
            const option = document.createElement('option');
            option.value = level;
            option.textContent = level;
            if (level === this.filters.level) option.selected = true;
            levelFilter.appendChild(option);
        });

        // Update category filter
        const categoryFilter = document.getElementById('categoryFilter');
        categoryFilter.innerHTML = '<option value="">All Categories</option>';
        this.availableCategories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
            if (category === this.filters.category) option.selected = true;
            categoryFilter.appendChild(option);
        });
    }

    renderLogs() {
        const logDisplay = document.getElementById('logDisplay');
        if (!logDisplay) return;

        if (this.filteredLogs.length === 0) {
            logDisplay.innerHTML = '<div class="log-placeholder">No logs match the current filters</div>';
            return;
        }

        let html = '';
        this.filteredLogs.forEach(log => {
            const timestamp = new Date(log.timestamp).toLocaleString();
            const levelClass = this.getLevelClass(log.level);
            const categoryIcon = this.getCategoryIcon(log.category);
            
            html += `
                <div class="log-entry ${levelClass}" data-level="${log.level}" data-category="${log.category}">
                    <div class="log-timestamp">${timestamp}</div>
                    <div class="log-level ${levelClass}">${log.level}</div>
                    <div class="log-category">
                        <span class="category-icon">${categoryIcon}</span>
                        <span class="category-name">${log.category}</span>
                    </div>
                    <div class="log-message">${this.highlightSearchTerm(log.message)}</div>
                </div>
            `;
        });

        logDisplay.innerHTML = html;
        
        // Auto-scroll to bottom if enabled
        if (this.autoScroll) {
            logDisplay.scrollTop = logDisplay.scrollHeight;
        }

        this.updateLogStats();
    }

    getLevelClass(level) {
        const classes = {
            'ERROR': 'log-error',
            'WARN': 'log-warning', 
            'WARNING': 'log-warning',
            'INFO': 'log-info',
            'DEBUG': 'log-debug'
        };
        return classes[level] || 'log-info';
    }

    getCategoryIcon(category) {
        const icons = {
            'system': '⚙️',
            'robot': '🤖',
            'camera': '📹',
            'slam': '🗺️',
            'network': '🌐',
            'sensors': '📡',
            'voice': '🎤',
            'ai': '🧠',
            'power': '🔋',
            'pwa': '📱'
        };
        return icons[category] || '📄';
    }

    highlightSearchTerm(message) {
        if (!this.filters.search) return message;
        
        const regex = new RegExp(`(${this.filters.search})`, 'gi');
        return message.replace(regex, '<mark>$1</mark>');
    }

    updateLogStats() {
        const totalCount = this.logs.length;
        const filteredCount = this.filteredLogs.length;
        const errorCount = this.filteredLogs.filter(log => log.level === 'ERROR').length;
        const warningCount = this.filteredLogs.filter(log => ['WARN', 'WARNING'].includes(log.level)).length;

        document.getElementById('totalLogsCount').textContent = totalCount;
        document.getElementById('filteredLogsCount').textContent = filteredCount;
        document.getElementById('errorLogsCount').textContent = errorCount;
        document.getElementById('warningLogsCount').textContent = warningCount;
    }

    applyFilters() {
        this.filteredLogs = this.logs.filter(log => {
            if (this.filters.level && log.level !== this.filters.level) return false;
            if (this.filters.category && log.category !== this.filters.category) return false;
            if (this.filters.search && !log.message.toLowerCase().includes(this.filters.search.toLowerCase())) return false;
            return true;
        });
        
        this.renderLogs();
    }

    debounceSearch() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.applyFilters();
        }, 300);
    }

    async loadCommandHistory() {
        try {
            const response = await fetch('http://localhost:5001/api/system/command-history');
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.renderCommandHistory(data.commands);
                }
            }
        } catch (error) {
            console.error('Failed to load command history:', error);
        }
    }

    renderCommandHistory(commands) {
        const commandHistory = document.getElementById('commandHistory');
        if (!commandHistory) return;

        if (commands.length === 0) {
            commandHistory.innerHTML = '<div class="command-placeholder">No commands executed yet</div>';
            return;
        }

        let html = '';
        commands.slice(0, 10).forEach(cmd => { // Show last 10 commands
            const timestamp = new Date(cmd.timestamp).toLocaleString();
            html += `
                <div class="command-entry">
                    <div class="command-timestamp">${timestamp}</div>
                    <div class="command-name">${cmd.command}</div>
                    <div class="command-params">${JSON.stringify(cmd.params || {})}</div>
                </div>
            `;
        });

        commandHistory.innerHTML = html;
    }

    toggleLiveMode() {
        this.isLiveMode = !this.isLiveMode;
        const btn = document.getElementById('liveModeBtn');
        
        if (this.isLiveMode) {
            btn.classList.add('active');
            btn.innerHTML = '<span class="control-icon">⏸️</span><span class="control-label">Stop Live</span>';
            this.startLiveMode();
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<span class="control-icon">▶️</span><span class="control-label">Live Mode</span>';
            this.stopLiveMode();
        }
    }

    startLiveMode() {
        // Use more frequent polling for live updates
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.updateInterval = setInterval(() => {
            this.loadLogs();
            this.loadCommandHistory();
        }, 2000); // Update every 2 seconds in live mode
    }

    stopLiveMode() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.startAutoUpdate(); // Return to normal update interval
    }

    startAutoUpdate() {
        // Normal update interval (every 10 seconds)
        if (this.updateInterval) clearInterval(this.updateInterval);
        this.updateInterval = setInterval(() => {
            if (!this.isLiveMode) {
                this.loadLogs();
                this.loadCommandHistory();
            }
        }, 10000);
    }

    clearLogs() {
        if (confirm('Clear all displayed logs? This will only clear the display, not the actual log files.')) {
            this.logs = [];
            this.filteredLogs = [];
            this.renderLogs();
        }
    }

    exportLogs() {
        const dataStr = JSON.stringify({
            exported_at: new Date().toISOString(),
            filters_applied: this.filters,
            total_logs: this.logs.length,
            exported_logs: this.filteredLogs
        }, null, 2);
        
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `laika_logs_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.eventSource) {
            this.eventSource.close();
        }
    }
}

// Export for use in other modules
window.LAIKALogViewer = LAIKALogViewer;


