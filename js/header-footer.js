/**
 * LAIKA PWA Header & Footer Management System
 * Provides shared header and footer components for all pages
 */

class LAIKAHeaderFooter {
    constructor() {
        this.currentPage = this.getCurrentPageName();
        this.connectionStatus = 'disconnected';
        this.batteryLevel = 85;
        this.wifiStatus = 'connected';
        this.timeUpdateInterval = null;
        this.statusUpdateInterval = null;
        
        this.init();
    }
    
    init() {
        this.createHeader();
        this.createFooter();
        this.setupEventListeners();
        this.startTimeUpdates();
        this.startStatusUpdates();
        this.updateActiveNavItem();
        
        console.log('LAIKA Header/Footer system initialized');
    }
    
    getCurrentPageName() {
        const path = window.location.pathname;
        const filename = path.split('/').pop() || 'index.html';
        return filename.replace('.html', '') || 'home';
    }
    
    createHeader() {
        // Remove existing header if present
        const existingHeader = document.querySelector('.laika-header');
        if (existingHeader) {
            existingHeader.remove();
        }
        
        const header = document.createElement('header');
        header.className = 'laika-header header-slide-in';
        header.innerHTML = `
            <a href="index.html" class="header-brand">
                <span class="brand-icon">🐕</span>
                <span>LAIKA</span>
            </a>
            
            <nav class="header-nav">
                <ul class="nav-menu" id="navMenu">
                    <li class="nav-item">
                        <a href="index.html" class="nav-link" data-page="home">
                            <span class="nav-icon">🏠</span>
                            <span>Home</span>
                        </a>
                    </li>
                    <li class="nav-item">
                        <span class="nav-link disabled" data-page="chat" title="Coming Soon">
                            <span class="nav-icon">💬</span>
                            <span>Chat</span>
                        </span>
                    </li>
                    <li class="nav-item">
                        <span class="nav-link disabled" data-page="dashboard" title="Coming Soon">
                            <span class="nav-icon">📊</span>
                            <span>Dashboard</span>
                        </span>
                    </li>
                    <li class="nav-item">
                        <span class="nav-link disabled" data-page="camera" title="Coming Soon">
                            <span class="nav-icon">📹</span>
                            <span>Camera</span>
                        </span>
                    </li>
                    <li class="nav-item">
                        <span class="nav-link disabled" data-page="control" title="Coming Soon">
                            <span class="nav-icon">🎮</span>
                            <span>Control</span>
                        </span>
                    </li>
                    <li class="nav-item">
                        <span class="nav-link disabled" data-page="slam" title="Coming Soon">
                            <span class="nav-icon">🗺️</span>
                            <span>Map</span>
                        </span>
                    </li>
                </ul>
                
                <button class="menu-toggle" id="menuToggle">
                    <span>☰</span>
                </button>
            </nav>
        `;
        
        // Insert header at the beginning of body
        document.body.insertBefore(header, document.body.firstChild);
    }
    
    createFooter() {
        // Remove existing footer if present
        const existingFooter = document.querySelector('.laika-footer');
        if (existingFooter) {
            existingFooter.remove();
        }
        
        const footer = document.createElement('footer');
        footer.className = 'laika-footer footer-slide-in';
        footer.innerHTML = `
            <div class="footer-status">
                <div class="status-item connection-status" id="connectionStatus">
                    <div class="status-indicator" id="connectionIndicator"></div>
                    <span id="connectionText">Offline</span>
                </div>
                
                <div class="status-item battery-status" id="batteryStatus">
                    <span>⚡</span>
                    <span id="batteryText">85%</span>
                </div>
                
                <div class="status-item" id="wifiStatus">
                    <span>📡</span>
                    <span id="wifiText">WiFi</span>
                </div>
                
                <div class="status-item" id="systemStatus">
                    <div class="status-indicator online"></div>
                    <span>System OK</span>
                </div>
            </div>
            
            <div class="time-display" id="timeDisplay">
                --:--
            </div>
        `;
        
        // Append footer to body
        document.body.appendChild(footer);
    }
    
    setupEventListeners() {
        // Mobile menu toggle
        const menuToggle = document.getElementById('menuToggle');
        const navMenu = document.getElementById('navMenu');
        
        if (menuToggle && navMenu) {
            menuToggle.addEventListener('click', () => {
                navMenu.classList.toggle('active');
                const isOpen = navMenu.classList.contains('active');
                menuToggle.innerHTML = isOpen ? '<span>✕</span>' : '<span>☰</span>';
            });
        }
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            if (navMenu && !e.target.closest('.header-nav')) {
                navMenu.classList.remove('active');
                if (menuToggle) {
                    menuToggle.innerHTML = '<span>☰</span>';
                }
            }
        });
        
        // Navigation link clicks
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                // Close mobile menu
                if (navMenu) {
                    navMenu.classList.remove('active');
                }
                if (menuToggle) {
                    menuToggle.innerHTML = '<span>☰</span>';
                }
            });
        });
        
        // Listen for LAIKA connection events
        window.addEventListener('laika-connection-changed', (e) => {
            this.updateConnectionStatus(e.detail.status, e.detail.deviceName);
        });
        
        window.addEventListener('laika-battery-changed', (e) => {
            this.updateBatteryStatus(e.detail.level);
        });
        
        window.addEventListener('laika-wifi-changed', (e) => {
            this.updateWifiStatus(e.detail.status, e.detail.ssid);
        });
    }
    
    updateActiveNavItem() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            const page = link.getAttribute('data-page');
            if (page === this.currentPage || 
                (this.currentPage === 'index' && page === 'home')) {
                link.classList.add('active');
            }
        });
    }
    
    startTimeUpdates() {
        const updateTime = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            const timeDisplay = document.getElementById('timeDisplay');
            if (timeDisplay) {
                timeDisplay.textContent = timeString;
            }
        };
        
        updateTime();
        this.timeUpdateInterval = setInterval(updateTime, 1000);
    }
    
    startStatusUpdates() {
        // Update status periodically
        this.statusUpdateInterval = setInterval(() => {
            this.checkSystemStatus();
        }, 5000);
        
        // Initial status check
        this.checkSystemStatus();
    }
    
    async checkSystemStatus() {
        // Try to get status from LAIKA if connected
        try {
            if (window.app && window.app.isConnected) {
                // Update connection status
                this.updateConnectionStatus('connected', 
                    window.app.currentDevice?.name || 'LAIKA');
                
                // Try to get battery status
                if (window.app.connectionType === 'network') {
                    await this.fetchNetworkStatus();
                }
            } else {
                this.updateConnectionStatus('disconnected');
            }
        } catch (error) {
            console.debug('Status check failed:', error);
        }
    }
    
    async fetchNetworkStatus() {
        try {
            if (window.app && window.app.serverUrl) {
                const response = await fetch(`${window.app.serverUrl}/api/status`, {
                    timeout: 2000
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.battery) {
                        this.updateBatteryStatus(data.battery.level);
                    }
                    if (data.wifi) {
                        this.updateWifiStatus(
                            data.wifi.connected ? 'connected' : 'disconnected',
                            data.wifi.ssid
                        );
                    }
                }
            }
        } catch (error) {
            console.debug('Network status fetch failed:', error);
        }
    }
    
    updateConnectionStatus(status, deviceName = null) {
        this.connectionStatus = status;
        const connectionStatus = document.getElementById('connectionStatus');
        const connectionIndicator = document.getElementById('connectionIndicator');
        const connectionText = document.getElementById('connectionText');
        
        if (!connectionStatus || !connectionIndicator || !connectionText) return;
        
        connectionStatus.className = `status-item connection-status ${status}`;
        connectionIndicator.className = `status-indicator ${status === 'connected' ? 'online' : status === 'connecting' ? 'warning' : 'offline'}`;
        
        switch (status) {
            case 'connected':
                connectionText.textContent = deviceName ? `${deviceName}` : 'Connected';
                break;
            case 'connecting':
                connectionText.textContent = 'Connecting...';
                break;
            case 'disconnected':
            default:
                connectionText.textContent = 'Offline';
                break;
        }
    }
    
    updateBatteryStatus(level) {
        this.batteryLevel = level;
        const batteryStatus = document.getElementById('batteryStatus');
        const batteryText = document.getElementById('batteryText');
        
        if (!batteryStatus || !batteryText) return;
        
        batteryText.textContent = `${level}%`;
        
        // Update battery status class
        batteryStatus.className = 'status-item battery-status';
        if (level < 20) {
            batteryStatus.classList.add('critical');
        } else if (level < 50) {
            batteryStatus.classList.add('low');
        }
    }
    
    updateWifiStatus(status, ssid = null) {
        this.wifiStatus = status;
        const wifiText = document.getElementById('wifiText');
        
        if (!wifiText) return;
        
        switch (status) {
            case 'connected':
                wifiText.textContent = ssid ? ssid : 'WiFi';
                break;
            case 'disconnected':
                wifiText.textContent = 'No WiFi';
                break;
            default:
                wifiText.textContent = 'WiFi';
                break;
        }
    }
    
    updateSystemStatus(status, message = 'System OK') {
        const systemStatus = document.getElementById('systemStatus');
        if (!systemStatus) return;
        
        const indicator = systemStatus.querySelector('.status-indicator');
        const text = systemStatus.querySelector('span');
        
        if (indicator) {
            indicator.className = `status-indicator ${status}`;
        }
        if (text) {
            text.textContent = message;
        }
    }
    
    // Public methods for external use
    showConnectionStatus(status, deviceName) {
        this.updateConnectionStatus(status, deviceName);
    }
    
    showBatteryLevel(level) {
        this.updateBatteryStatus(level);
    }
    
    showWifiStatus(status, ssid) {
        this.updateWifiStatus(status, ssid);
    }
    
    showSystemMessage(status, message) {
        this.updateSystemStatus(status, message);
    }
    
    // Cleanup method
    destroy() {
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
        }
        
        const header = document.querySelector('.laika-header');
        const footer = document.querySelector('.laika-footer');
        
        if (header) header.remove();
        if (footer) footer.remove();
    }
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if not already present
    if (!window.laikaHeaderFooter) {
        window.laikaHeaderFooter = new LAIKAHeaderFooter();
    }
});

// Export for manual initialization if needed
window.LAIKAHeaderFooter = LAIKAHeaderFooter;
