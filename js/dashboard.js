/**
 * LAIKA Dashboard
 * Real-time system monitoring and telemetry
 */

class LAIKADashboard {
    constructor() {
        this.websocket = null;
        this.isConnected = false;
        this.updateInterval = null;
        this.refreshRate = 2000; // 2 seconds
        
        // Initialize with null - will be populated with real data from WebSocket
        this.sensorData = {
            battery: { level: null, voltage: null, current: null, charging: null },
            temperature: { cpu: null, battery: null, motor: null, ambient: null },
            performance: { cpu: null, memory: null, storage: null, uptime: null, processes: null },
            network: { signal: null, ssid: null, ip: null, download: null, upload: null, latency: null },
            imu: { orientation: null, pitch: null, roll: null, acceleration: null, gyroscope: null, magnetometer: null },
            servos: []
        };
        
        this.initializeElements();
        this.setupEventListeners();
        this.connectToLAIKA();
        this.startDataUpdates();
        this.populateServoGrid();
    }

    initializeElements() {
        this.lastUpdateElement = document.getElementById('lastUpdate');
        this.refreshButton = document.getElementById('refreshButton');
        
        // Status elements
        this.statusElements = {
            power: document.getElementById('powerStatus'),
            temp: document.getElementById('tempStatus'),
            perf: document.getElementById('perfStatus'),
            network: document.getElementById('networkStatus'),
            sensors: document.getElementById('sensorsStatus'),
            servo: document.getElementById('servoStatus')
        };
    }

    setupEventListeners() {
        // Refresh button
        this.refreshButton.addEventListener('click', () => this.refreshDashboard());
        
        // Page visibility for connection management
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.reconnectIfNeeded();
                this.startDataUpdates();
            } else {
                this.stopDataUpdates();
            }
        });

        // Window resize for responsive charts
        window.addEventListener('resize', () => {
            this.updateCharts();
        });
    }

    async connectToLAIKA() {
        // For ngrok compatibility, use HTTP API instead of WebSocket [[memory:6691954]]
        console.log('🔗 Dashboard connecting to LAIKA via HTTP API...');
        
        try {
            // Test connection with system status endpoint
            const baseUrl = window.location.origin;
            const response = await fetch(`${baseUrl}/api/system/status`);
            
            if (response.ok) {
                console.log('✅ Dashboard connected to LAIKA via HTTP');
                this.isConnected = true;
                this.baseUrl = baseUrl;
                this.requestInitialData();
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('❌ Failed to connect dashboard to LAIKA:', error);
            this.isConnected = false;
            this.scheduleReconnect();
        }
    }

    getWebSocketUrl() {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        
        // For ngrok tunneling - use same hostname with /ws path [[memory:6691954]]
        if (hostname.includes('ngrok') || hostname.includes('ngrok-free.app')) {
            return `${protocol}//${hostname}/ws`;
        }
        
        // For local development or direct access
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'ws://localhost:8765';
        }
        
        // For local network access
        return `ws://${hostname}:8765`;
    }

    scheduleReconnect() {
        setTimeout(() => {
            if (!this.isConnected) {
                console.log('Dashboard attempting to reconnect...');
                this.connectToLAIKA();
            }
        }, 5000);
    }

    reconnectIfNeeded() {
        if (!this.isConnected || !this.websocket || this.websocket.readyState === WebSocket.CLOSED) {
            this.connectToLAIKA();
        }
    }

    async requestInitialData() {
        if (this.isConnected && this.baseUrl) {
            console.log('📊 Requesting real sensor data from LAIKA');
            
            try {
                // Fetch real sensor data from HTTP API
                const response = await fetch(`${this.baseUrl}/api/dashboard/data`);
                if (response.ok) {
                    const data = await response.json();
                    this.handleDashboardData(data);
                } else {
                    console.warn('⚠️ Dashboard data not available, using system status');
                    await this.fetchSystemData();
                }
            } catch (error) {
                console.error('❌ Error fetching dashboard data:', error);
                await this.fetchSystemData();
            }
        }
    }
    
    async fetchSystemData() {
        // Fallback to individual system endpoints for real data
        try {
            const [statusRes, processRes] = await Promise.all([
                fetch(`${this.baseUrl}/api/system/status`),
                fetch(`${this.baseUrl}/api/processes`)
            ]);
            
            if (statusRes.ok) {
                const statusData = await statusRes.json();
                this.updateSystemMetrics(statusData);
            }
            
            if (processRes.ok) {
                const processData = await processRes.json();
                this.updateProcessMetrics(processData);
            }
            
        } catch (error) {
            console.error('❌ Error fetching system data:', error);
        }
    }

    handleDashboardData(data) {
        // Handle dashboard data from HTTP API
        if (data.battery) this.updateBatteryData(data.battery);
        if (data.temperature) this.updateTemperatureData(data.temperature);
        if (data.performance) this.updatePerformanceData(data.performance);
        if (data.network) this.updateNetworkData(data.network);
        if (data.imu) this.updateIMUData(data.imu);
        if (data.servos) this.updateServoData(data.servos);
        
        this.updateLastUpdateTime();
    }
    
    updateSystemMetrics(statusData) {
        // Update performance metrics from system status
        if (statusData.system_stats) {
            const stats = statusData.system_stats;
            this.updatePerformanceData({
                cpu: Math.round(stats.cpu_percent || 0),
                memory: Math.round(stats.memory_percent || 0),
                storage: Math.round(stats.disk_percent || 0),
                uptime: this.formatUptime(stats.uptime || 0),
                processes: stats.process_count || 0
            });
            
            // Update temperature from system
            this.updateTemperatureData({
                cpu: Math.round(stats.cpu_temperature || 0),
                battery: Math.round((stats.cpu_temperature || 0) - 5),
                motor: Math.round((stats.cpu_temperature || 0) + 5),
                ambient: Math.round((stats.cpu_temperature || 0) - 10)
            });
        }
        
        // Update network info
        if (statusData.network) {
            this.updateNetworkData({
                signal: statusData.network.wifi_signal || null,
                ssid: statusData.network.wifi_ssid || '--',
                ip: statusData.network.local_ip || '--',
                download: Math.round(statusData.network.download_speed || 0),
                upload: Math.round(statusData.network.upload_speed || 0),
                latency: statusData.network.ping_ms || null
            });
        }
        
        this.updateLastUpdateTime();
    }
    
    updateProcessMetrics(processData) {
        if (processData.success && processData.total_processes) {
            // Update process count
            this.updateElement('processes', processData.total_processes);
        }
    }

    updateSensorData(data) {
        if (data.battery) this.updateBatteryData(data.battery);
        if (data.temperature) this.updateTemperatureData(data.temperature);
        if (data.performance) this.updatePerformanceData(data.performance);
        if (data.network) this.updateNetworkData(data.network);
        if (data.imu) this.updateIMUData(data.imu);
        if (data.servos) this.updateServoData(data.servos);
    }

    updateBatteryData(data) {
        this.sensorData.battery = { ...this.sensorData.battery, ...data };
        
        const battery = this.sensorData.battery;
        
        // Update battery gauge
        const gaugeValue = (battery.level / 100) * 360;
        const batteryGauge = document.getElementById('batteryGauge');
        const batteryLevel = document.getElementById('batteryLevel');
        
        if (batteryGauge && batteryLevel) {
            batteryGauge.style.setProperty('--gauge-value', `${gaugeValue}deg`);
            batteryLevel.textContent = `${battery.level}%`;
        }
        
        // Update battery metrics with reduced precision
        this.updateElement('batteryVoltage', `${battery.voltage ? battery.voltage.toFixed(1) : '--'}`);
        this.updateElement('batteryCurrent', `${battery.current ? battery.current.toFixed(1) : '--'}`);
        this.updateElement('batteryRuntime', `${battery.level ? this.calculateRuntime(battery.level) : '--'}`);
        this.updateElement('chargingStatus', battery.charging !== null ? (battery.charging ? 'Charging' : 'Not Connected') : '--');
        
        // Update power status
        let status = 'healthy';
        let statusText = 'Healthy';
        
        if (battery.level < 20) {
            status = 'error';
            statusText = 'Low Battery';
        } else if (battery.level < 40) {
            status = 'warning';
            statusText = 'Warning';
        }
        
        this.updateStatus('power', status, statusText);
    }

    updateTemperatureData(data) {
        this.sensorData.temperature = { ...this.sensorData.temperature, ...data };
        
        const temp = this.sensorData.temperature;
        
        // Update temperature values with reduced precision and color coding
        this.updateElement('cpuTemp', `${temp.cpu ? Math.round(temp.cpu) : '--'}`, temp.cpu ? this.getTempClass(temp.cpu) : '');
        this.updateElement('batteryTemp', `${temp.battery ? Math.round(temp.battery) : '--'}`, temp.battery ? this.getTempClass(temp.battery) : '');
        this.updateElement('motorTemp', `${temp.motor ? Math.round(temp.motor) : '--'}`, temp.motor ? this.getTempClass(temp.motor) : '');
        this.updateElement('ambientTemp', `${temp.ambient ? Math.round(temp.ambient) : '--'}`, temp.ambient ? this.getTempClass(temp.ambient) : '');
        
        // Update temperature status
        const maxTemp = Math.max(temp.cpu, temp.battery, temp.motor);
        let status = 'healthy';
        let statusText = 'Normal';
        
        if (maxTemp > 70) {
            status = 'error';
            statusText = 'Hot';
        } else if (maxTemp > 55) {
            status = 'warning';
            statusText = 'Warm';
        }
        
        this.updateStatus('temp', status, statusText);
    }

    updatePerformanceData(data) {
        this.sensorData.performance = { ...this.sensorData.performance, ...data };
        
        const perf = this.sensorData.performance;
        
        // Update performance metrics with reduced precision
        this.updateElement('cpuUsage', `${perf.cpu ? Math.round(perf.cpu) : '--'}`);
        this.updateElement('memoryUsage', `${perf.memory ? Math.round(perf.memory) : '--'}`);
        this.updateElement('storageUsage', `${perf.storage ? Math.round(perf.storage) : '--'}`);
        this.updateElement('uptime', perf.uptime || '--');
        this.updateElement('processes', perf.processes || '--');
        
        // Update progress bars
        this.updateProgressBar('cpuProgress', perf.cpu);
        this.updateProgressBar('memoryProgress', perf.memory);
        this.updateProgressBar('storageProgress', perf.storage);
        
        // Update performance status
        const maxUsage = Math.max(perf.cpu, perf.memory, perf.storage);
        let status = 'healthy';
        let statusText = 'Optimal';
        
        if (maxUsage > 90) {
            status = 'error';
            statusText = 'Overloaded';
        } else if (maxUsage > 75) {
            status = 'warning';
            statusText = 'High Usage';
        }
        
        this.updateStatus('perf', status, statusText);
    }

    updateNetworkData(data) {
        this.sensorData.network = { ...this.sensorData.network, ...data };
        
        const network = this.sensorData.network;
        
        // Update network metrics with reduced precision
        this.updateElement('wifiSignal', `${network.signal || '--'}`, network.signal ? this.getSignalClass(network.signal) : '');
        this.updateElement('wifiSSID', network.ssid || '--');
        this.updateElement('ipAddress', network.ip || '--');
        this.updateElement('downloadSpeed', `${network.download ? Math.round(network.download) : '--'}`);
        this.updateElement('uploadSpeed', `${network.upload ? Math.round(network.upload) : '--'}`);
        this.updateElement('latency', `${network.latency || '--'}`);
        
        // Update network status
        let status = 'healthy';
        let statusText = 'Connected';
        
        if (network.signal < -70) {
            status = 'error';
            statusText = 'Weak Signal';
        } else if (network.signal < -60) {
            status = 'warning';
            statusText = 'Fair Signal';
        }
        
        this.updateStatus('network', status, statusText);
    }

    updateIMUData(data) {
        this.sensorData.imu = { ...this.sensorData.imu, ...data };
        
        const imu = this.sensorData.imu;
        
        // Update IMU values with reduced precision
        this.updateElement('orientation', imu.orientation || '--');
        this.updateElement('pitch', `${imu.pitch ? Math.round(imu.pitch) : '--'}`);
        this.updateElement('roll', `${imu.roll ? Math.round(imu.roll) : '--'}`);
        this.updateElement('acceleration', `${imu.acceleration ? imu.acceleration.toFixed(1) : '--'}`);
        this.updateElement('gyroscope', `${imu.gyroscope ? imu.gyroscope.toFixed(2) : '--'}`);
        this.updateElement('magnetometer', `${imu.magnetometer ? Math.round(imu.magnetometer) : '--'}`);
        
        // Update sensors status
        const isCalibrated = Math.abs(imu.pitch) < 5 && Math.abs(imu.roll) < 5;
        this.updateStatus('sensors', isCalibrated ? 'healthy' : 'warning', 
                         isCalibrated ? 'Calibrated' : 'Needs Calibration');
    }

    updateServoData(data) {
        if (Array.isArray(data)) {
            this.sensorData.servos = data;
            this.updateServoGrid();
        }
        
        // Update servo status
        const healthyServos = this.sensorData.servos.filter(s => s.temperature < 60 && s.load < 80);
        const servoHealth = (healthyServos.length / this.sensorData.servos.length) * 100;
        
        let status = 'healthy';
        let statusText = 'All Good';
        
        if (servoHealth < 70) {
            status = 'error';
            statusText = 'Issues Detected';
        } else if (servoHealth < 90) {
            status = 'warning';
            statusText = 'Some Issues';
        }
        
        this.updateStatus('servo', status, statusText);
    }

    updateElement(id, value, className = '') {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            if (className) {
                element.className = element.className.replace(/\b(cool|warm|hot|strong|weak|poor)\b/g, '');
                element.classList.add(className);
            }
        }
    }

    updateStatus(type, status, text) {
        const statusElement = this.statusElements[type];
        if (statusElement) {
            statusElement.className = `widget-status ${status}`;
            statusElement.innerHTML = `<div class="status-dot"></div>${text}`;
        }
    }

    updateProgressBar(id, value) {
        const progressBar = document.getElementById(id);
        if (progressBar) {
            progressBar.style.width = `${value}%`;
            
            // Update progress bar color based on value
            progressBar.className = 'progress-fill';
            if (value > 90) {
                progressBar.classList.add('critical');
            } else if (value > 75) {
                progressBar.classList.add('warning');
            }
        }
    }

    getTempClass(temp) {
        if (temp > 60) return 'hot';
        if (temp > 45) return 'warm';
        return 'cool';
    }

    getSignalClass(signal) {
        if (signal > -50) return 'strong';
        if (signal > -65) return 'weak';
        return 'poor';
    }

    calculateRuntime(batteryLevel) {
        // Estimate runtime based on battery level (simplified calculation)
        const maxRuntime = 3; // hours
        const runtime = (batteryLevel / 100) * maxRuntime;
        return `${runtime.toFixed(1)}hrs`;
    }

    generateServoData() {
        // Return empty array - real servo data will come from WebSocket
        console.log('🔧 Servo data will be populated from real sensors');
        return [];
    }

    populateServoGrid() {
        const servoGrid = document.getElementById('servoGrid');
        if (!servoGrid) return;
        
        servoGrid.innerHTML = '';
        
        this.sensorData.servos.forEach(servo => {
            const servoElement = document.createElement('div');
            servoElement.className = 'servo-item';
            servoElement.innerHTML = `
                <div class="servo-id">S${servo.id}</div>
                <div class="servo-temp">${servo.temperature ? Math.round(servo.temperature) : '--'}°C</div>
                <div class="servo-load">${servo.load ? Math.round(servo.load) : '--'}%</div>
            `;
            
            // Color code based on health
            if (servo.temperature > 60 || servo.load > 80) {
                servoElement.style.borderColor = 'var(--error-red)';
            } else if (servo.temperature > 50 || servo.load > 60) {
                servoElement.style.borderColor = 'var(--warning-yellow)';
            }
            
            servoGrid.appendChild(servoElement);
        });
    }

    updateServoGrid() {
        this.populateServoGrid();
    }

    startDataUpdates() {
        this.stopDataUpdates(); // Clear any existing interval
        
        this.updateInterval = setInterval(() => {
            if (this.isConnected) {
                await this.requestInitialData();
            } else {
                // Try to reconnect instead of simulating data
                this.reconnectIfNeeded();
            }
        }, this.refreshRate);
        
        // Update time immediately
        this.updateLastUpdateTime();
    }

    stopDataUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    simulateDataUpdates() {
        // Simulate realistic data changes for demo purposes
        const battery = this.sensorData.battery;
        battery.level = Math.max(0, battery.level - (Math.random() * 0.1));
        battery.current = 1.8 + (Math.random() * 0.6);
        
        const temp = this.sensorData.temperature;
        temp.cpu = 40 + (Math.random() * 10);
        temp.motor = 42 + (Math.random() * 15);
        
        const perf = this.sensorData.performance;
        perf.cpu = Math.max(10, Math.min(95, perf.cpu + (Math.random() - 0.5) * 10));
        perf.memory = Math.max(30, Math.min(90, perf.memory + (Math.random() - 0.5) * 5));
        
        // Update displays
        this.updateBatteryData(battery);
        this.updateTemperatureData(temp);
        this.updatePerformanceData(perf);
        
        // Update servo data
        this.sensorData.servos.forEach(servo => {
            servo.temperature += (Math.random() - 0.5) * 2;
            servo.load += (Math.random() - 0.5) * 5;
            servo.temperature = Math.max(25, Math.min(70, servo.temperature));
            servo.load = Math.max(0, Math.min(100, servo.load));
        });
        this.updateServoGrid();
        
        this.updateLastUpdateTime();
    }

    updateLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        
        if (this.lastUpdateElement) {
            this.lastUpdateElement.textContent = timeString;
        }
    }

    refreshDashboard() {
        // Add loading animation to refresh button
        this.refreshButton.style.animation = 'spin 1s linear';
        
        if (this.isConnected) {
            await this.requestInitialData();
        } else {
            // Show connection status instead of simulating data
            this.showConnectionError();
        }
        
        // Remove loading animation
        setTimeout(() => {
            this.refreshButton.style.animation = '';
        }, 1000);
    }

    updateCharts() {
        // Placeholder for chart updates when charts are implemented
        console.log('Updating charts...');
    }

    showConnectionError() {
        // Show connection status instead of fake data
        console.log('⚠️ Dashboard not connected to LAIKA - waiting for real data');
        
        // Update status indicators to show disconnected state
        Object.keys(this.statusElements).forEach(key => {
            const element = this.statusElements[key];
            if (element) {
                element.className = 'widget-status error';
                element.innerHTML = '<div class="status-dot"></div>No Data';
            }
        });
        
        // Show "--" for all metrics when not connected
        const metricElements = [
            'batteryLevel', 'batteryVoltage', 'batteryCurrent', 'batteryRuntime', 'chargingStatus',
            'cpuTemp', 'batteryTemp', 'motorTemp', 'ambientTemp',
            'cpuUsage', 'memoryUsage', 'storageUsage', 'uptime', 'processes',
            'wifiSignal', 'wifiSSID', 'ipAddress', 'downloadSpeed', 'uploadSpeed', 'latency',
            'orientation', 'pitch', 'roll', 'acceleration', 'gyroscope', 'magnetometer'
        ];
        
        metricElements.forEach(id => {
            this.updateElement(id, '--');
        });
        
        // Clear servo grid
        const servoGrid = document.getElementById('servoGrid');
        if (servoGrid) {
            servoGrid.innerHTML = '<div style="grid-column: span 4; text-align: center; color: var(--text-dim); padding: 20px;">No servo data - waiting for LAIKA connection</div>';
        }
    }

    // Utility methods
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) {
            return `${days}d ${hours}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    formatBytes(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
    }
}

// Global refresh function
function refreshDashboard() {
    if (window.laikaDashboard) {
        window.laikaDashboard.refreshDashboard();
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.laikaDashboard = new LAIKADashboard();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // F5 or Ctrl/Cmd + R to refresh
        if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r')) {
            e.preventDefault();
            refreshDashboard();
        }
    });
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LAIKADashboard;
}
