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
        
        this.sensorData = {
            battery: { level: 85, voltage: 7.4, current: 2.1, charging: false },
            temperature: { cpu: 42, battery: 35, motor: 45, ambient: 22 },
            performance: { cpu: 25, memory: 60, storage: 45, uptime: '2d 14h', processes: 42 },
            network: { signal: -45, ssid: 'LAIKA_Network', ip: '192.168.1.100', download: 25.4, upload: 12.1, latency: 15 },
            imu: { orientation: 'N 15°', pitch: 2.1, roll: -0.8, acceleration: 9.8, gyroscope: 0.02, magnetometer: 45.2 },
            servos: this.generateServoData()
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
        try {
            const wsUrl = this.getWebSocketUrl();
            this.websocket = new WebSocket(wsUrl);
            
            this.websocket.onopen = () => {
                console.log('Dashboard connected to LAIKA');
                this.isConnected = true;
                this.requestInitialData();
            };

            this.websocket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.websocket.onclose = () => {
                console.log('Dashboard disconnected from LAIKA');
                this.isConnected = false;
                this.scheduleReconnect();
            };

            this.websocket.onerror = (error) => {
                console.error('Dashboard WebSocket error:', error);
                this.isConnected = false;
            };

        } catch (error) {
            console.error('Failed to connect dashboard to LAIKA:', error);
            this.isConnected = false;
            this.scheduleReconnect();
        }
    }

    getWebSocketUrl() {
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'ws://localhost:8765';
        } else if (hostname.includes('laika')) {
            return `ws://${hostname}:8765`;
        } else {
            return `ws://${hostname}:8765`;
        }
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

    requestInitialData() {
        if (this.isConnected && this.websocket) {
            const request = {
                type: 'dashboard_request',
                data_types: ['battery', 'temperature', 'performance', 'network', 'imu', 'servos'],
                timestamp: new Date().toISOString()
            };
            
            this.websocket.send(JSON.stringify(request));
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'dashboard_data':
                this.updateSensorData(data.data);
                break;
            case 'battery_update':
                this.updateBatteryData(data.data);
                break;
            case 'temperature_update':
                this.updateTemperatureData(data.data);
                break;
            case 'performance_update':
                this.updatePerformanceData(data.data);
                break;
            case 'network_update':
                this.updateNetworkData(data.data);
                break;
            case 'imu_update':
                this.updateIMUData(data.data);
                break;
            case 'servo_update':
                this.updateServoData(data.data);
                break;
            default:
                console.log('Unknown dashboard message type:', data);
        }
        
        this.updateLastUpdateTime();
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
        
        // Update battery metrics
        this.updateElement('batteryVoltage', `${battery.voltage.toFixed(1)}`);
        this.updateElement('batteryCurrent', `${battery.current.toFixed(1)}`);
        this.updateElement('batteryRuntime', `${this.calculateRuntime(battery.level)}`);
        this.updateElement('chargingStatus', battery.charging ? 'Charging' : 'Not Connected');
        
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
        
        // Update temperature values with color coding
        this.updateElement('cpuTemp', `${temp.cpu}`, this.getTempClass(temp.cpu));
        this.updateElement('batteryTemp', `${temp.battery}`, this.getTempClass(temp.battery));
        this.updateElement('motorTemp', `${temp.motor}`, this.getTempClass(temp.motor));
        this.updateElement('ambientTemp', `${temp.ambient}`, this.getTempClass(temp.ambient));
        
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
        
        // Update performance metrics
        this.updateElement('cpuUsage', `${perf.cpu}`);
        this.updateElement('memoryUsage', `${perf.memory}`);
        this.updateElement('storageUsage', `${perf.storage}`);
        this.updateElement('uptime', perf.uptime);
        this.updateElement('processes', perf.processes);
        
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
        
        // Update network metrics
        this.updateElement('wifiSignal', `${network.signal}`, this.getSignalClass(network.signal));
        this.updateElement('wifiSSID', network.ssid);
        this.updateElement('ipAddress', network.ip);
        this.updateElement('downloadSpeed', `${network.download.toFixed(1)}`);
        this.updateElement('uploadSpeed', `${network.upload.toFixed(1)}`);
        this.updateElement('latency', `${network.latency}`);
        
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
        
        // Update IMU values
        this.updateElement('orientation', imu.orientation);
        this.updateElement('pitch', `${imu.pitch.toFixed(1)}`);
        this.updateElement('roll', `${imu.roll.toFixed(1)}`);
        this.updateElement('acceleration', `${imu.acceleration.toFixed(1)}`);
        this.updateElement('gyroscope', `${imu.gyroscope.toFixed(3)}`);
        this.updateElement('magnetometer', `${imu.magnetometer.toFixed(1)}`);
        
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
        const servos = [];
        for (let i = 1; i <= 12; i++) {
            servos.push({
                id: i,
                position: 1500 + (Math.random() - 0.5) * 200,
                temperature: 30 + Math.random() * 25,
                load: Math.random() * 60,
                healthy: true
            });
        }
        return servos;
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
                <div class="servo-temp">${servo.temperature.toFixed(1)}°C</div>
                <div class="servo-load">${servo.load.toFixed(0)}%</div>
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
                this.requestInitialData();
            } else {
                // Simulate data updates when not connected
                this.simulateDataUpdates();
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
            this.requestInitialData();
        } else {
            this.simulateDataUpdates();
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
