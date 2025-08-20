/**
 * LAIKA SLAM Map Interface
 * Interactive mapping and navigation with real-time SLAM data
 */

class LAIKASLAMMap {
    constructor() {
        this.isConnected = false;
        this.slamActive = false;
        this.navigationMode = 'manual';
        
        // Canvas and rendering
        this.canvas = null;
        this.ctx = null;
        this.canvasWidth = 800;
        this.canvasHeight = 600;
        
        // Map state
        this.mapData = {
            occupancyGrid: null,
            resolution: 0.05, // meters per pixel
            width: 0,
            height: 0,
            origin: { x: 0, y: 0, theta: 0 }
        };
        
        // Robot state
        this.robotPose = { x: 0, y: 0, theta: 0 };
        this.robotSpeed = 0;
        this.robotPath = [];
        this.plannedPath = [];
        this.waypoints = [];
        
        // View state
        this.viewTransform = {
            x: 0,
            y: 0,
            scale: 1.0,
            minScale: 0.1,
            maxScale: 10.0
        };
        
        // Layer visibility
        this.layers = {
            occupancy: true,
            obstacles: true,
            freespace: true,
            unknown: false,
            path: true,
            lidar: false
        };
        
        // Navigation state
        this.isNavigating = false;
        this.isExploring = false;
        this.currentWaypoint = null;
        
        // SLAM statistics
        this.slamStats = {
            mapCoverage: 0,
            loopClosures: 0,
            landmarkCount: 0,
            scanRate: 0,
            mapQuality: 'Unknown'
        };
        
        // WebSocket connection
        this.ws = null;
        
        // Interaction state
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
        this.isFullscreen = false;
        
        this.init();
    }

    async init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.updateUI();
        this.startStatusUpdates();
        this.startRenderLoop();
        
        // Attempt to connect to API
        await this.connectToAPI();
        
        console.log('🗺️ LAIKA SLAM Map initialized');
    }

    setupCanvas() {
        this.canvas = document.getElementById('mapCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set initial canvas size
        this.resizeCanvas();
        
        // Handle resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        this.canvasWidth = rect.width;
        this.canvasHeight = rect.height;
        
        this.canvas.width = this.canvasWidth;
        this.canvas.height = this.canvasHeight;
        
        // Center the view
        this.viewTransform.x = this.canvasWidth / 2;
        this.viewTransform.y = this.canvasHeight / 2;
    }

    setupEventListeners() {
        // Map controls
        document.getElementById('zoomInBtn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoomOut());
        document.getElementById('centerBtn').addEventListener('click', () => this.centerOnRobot());
        document.getElementById('fullscreenBtn').addEventListener('click', () => this.toggleFullscreen());

        // Layer toggles
        document.querySelectorAll('.layer-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const layer = e.currentTarget.dataset.layer;
                this.toggleLayer(layer);
            });
        });

        // Navigation controls
        document.getElementById('navigateBtn').addEventListener('click', () => this.toggleNavigationMode());
        document.getElementById('explorerBtn').addEventListener('click', () => this.toggleExploreMode());
        document.getElementById('homeBtn').addEventListener('click', () => this.returnHome());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopNavigation());

        // Map actions
        document.getElementById('saveMapBtn').addEventListener('click', () => this.saveMap());
        document.getElementById('loadMapBtn').addEventListener('click', () => this.loadMap());
        document.getElementById('exportMapBtn').addEventListener('click', () => this.exportMap());
        document.getElementById('clearMapBtn').addEventListener('click', () => this.clearMap());

        // Canvas interactions
        this.setupCanvasInteractions();

        // Mobile panel toggle
        const panelToggle = document.getElementById('panelToggle');
        if (panelToggle) {
            panelToggle.addEventListener('click', () => this.togglePanel());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    setupCanvasInteractions() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));

        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));

        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    async connectToAPI() {
        const apiUrls = [
            `${window.location.protocol}//${window.location.hostname}:8081/api/slam`,
            `${window.location.protocol}//${window.location.hostname}/api/slam`,
            'http://laika.local:8081/api/slam',
            'http://localhost:8081/api/slam'
        ];

        for (const baseUrl of apiUrls) {
            try {
                console.log(`🔗 Attempting API connection to ${baseUrl}`);
                
                // Test connection with health check
                const response = await fetch(`${baseUrl}/health`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        this.apiBaseUrl = baseUrl;
                        this.isConnected = true;
                        console.log('✅ Connected to LAIKA SLAM API');
                        this.updateConnectionStatus();
                        
                        // Start polling for data
                        this.startDataPolling();
                        return;
                    }
                }
            } catch (error) {
                console.log(`❌ Failed to connect to ${baseUrl}:`, error.message);
            }
        }
        
        console.log('🔄 All API connection attempts failed');
        this.isConnected = false;
        this.updateConnectionStatus();
        setTimeout(() => this.reconnect(), 5000);
    }
    
    startDataPolling() {
        // Poll for data updates every 500ms
        this.dataPollingInterval = setInterval(async () => {
            if (!this.isConnected) return;
            
            try {
                // Get map data
                await this.fetchMapData();
                
                // Get robot status
                await this.fetchRobotStatus();
                
                // Get SLAM stats
                await this.fetchSLAMStats();
                
            } catch (error) {
                console.error('❌ Data polling error:', error);
                // Don't disconnect on single error, just log it
            }
        }, 500);
        
        console.log('📊 Started data polling');
    }
    
    async fetchMapData() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/map`);
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    this.updateMapData(result.data);
                }
            }
        } catch (error) {
            console.debug('Map data fetch error:', error);
        }
    }
    
    async fetchRobotStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/robot_status`);
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    this.updateRobotPose(result.data.pose);
                }
            }
        } catch (error) {
            console.debug('Robot status fetch error:', error);
        }
    }
    
    async fetchSLAMStats() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/status`);
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    this.updateSLAMStats(result.data);
                    this.slamActive = result.data.is_mapping || result.data.is_exploring;
                }
            }
        } catch (error) {
            console.debug('SLAM stats fetch error:', error);
        }
    }
    
    async apiCall(endpoint, method = 'GET', data = null) {
        try {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            if (data && method !== 'GET') {
                options.body = JSON.stringify(data);
            }
            
            const response = await fetch(`${this.apiBaseUrl}${endpoint}`, options);
            return await response.json();
            
        } catch (error) {
            console.error(`❌ API call error (${endpoint}):`, error);
            return { success: false, error: error.message };
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'map-update':
                this.updateMapData(data.map);
                break;
            case 'robot-pose':
                this.updateRobotPose(data.pose);
                break;
            case 'path-update':
                this.updatePlannedPath(data.path);
                break;
            case 'slam-stats':
                this.updateSLAMStats(data.stats);
                break;
            case 'navigation-status':
                this.updateNavigationStatus(data.status);
                break;
            case 'lidar-scan':
                this.updateLidarScan(data.scan);
                break;
            case 'error':
                console.error('❌ SLAM error:', data.message);
                break;
            default:
                console.log('📦 Unknown message type:', data.type);
        }
    }

    updateMapData(mapData) {
        this.mapData = {
            ...this.mapData,
            ...mapData
        };
        
        // Convert occupancy grid if provided
        if (mapData.data) {
            this.mapData.occupancyGrid = new Uint8Array(mapData.data);
        }
        
        console.log('🗺️ Map data updated:', this.mapData);
    }

    updateRobotPose(pose) {
        this.robotPose = pose;
        this.updateRobotMarker();
        this.updateUI();
    }

    updatePlannedPath(path) {
        this.plannedPath = path;
    }

    updateSLAMStats(stats) {
        this.slamStats = { ...this.slamStats, ...stats };
        this.updateStatsDisplay();
    }

    updateNavigationStatus(status) {
        this.navigationMode = status.mode;
        this.isNavigating = status.navigating;
        this.isExploring = status.exploring;
        this.updateUI();
    }

    updateLidarScan(scan) {
        this.currentLidarScan = scan;
    }

    // Legacy method - now handled by API calls
    sendMessage(message) {
        console.warn('⚠️ sendMessage called - use API calls instead');
    }

    // Rendering methods
    startRenderLoop() {
        const render = () => {
            this.renderMap();
            requestAnimationFrame(render);
        };
        requestAnimationFrame(render);
    }

    renderMap() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        // Save context state
        this.ctx.save();
        
        // Apply view transform
        this.ctx.translate(this.viewTransform.x, this.viewTransform.y);
        this.ctx.scale(this.viewTransform.scale, this.viewTransform.scale);
        
        // Render layers
        if (this.layers.occupancy && this.mapData.occupancyGrid) {
            this.renderOccupancyGrid();
        }
        
        if (this.layers.path && this.plannedPath.length > 0) {
            this.renderPlannedPath();
        }
        
        if (this.layers.lidar && this.currentLidarScan) {
            this.renderLidarScan();
        }
        
        // Render robot trail
        this.renderRobotPath();
        
        // Restore context
        this.ctx.restore();
    }

    renderOccupancyGrid() {
        if (!this.mapData.occupancyGrid) return;
        
        const { width, height, resolution, origin } = this.mapData;
        const grid = this.mapData.occupancyGrid;
        
        // Create image data
        const imageData = this.ctx.createImageData(width, height);
        const data = imageData.data;
        
        for (let i = 0; i < grid.length; i++) {
            const pixel = i * 4;
            const value = grid[i];
            
            if (value === -1) {
                // Unknown space - gray
                if (this.layers.unknown) {
                    data[pixel] = 51;     // R
                    data[pixel + 1] = 51; // G
                    data[pixel + 2] = 51; // B
                    data[pixel + 3] = 255; // A
                } else {
                    data[pixel + 3] = 0; // Transparent
                }
            } else if (value === 0) {
                // Free space - light gray
                if (this.layers.freespace) {
                    data[pixel] = 136;     // R
                    data[pixel + 1] = 136; // G
                    data[pixel + 2] = 136; // B
                    data[pixel + 3] = 100; // A (semi-transparent)
                } else {
                    data[pixel + 3] = 0; // Transparent
                }
            } else {
                // Occupied space - red
                if (this.layers.obstacles) {
                    data[pixel] = 255;     // R
                    data[pixel + 1] = 68;  // G
                    data[pixel + 2] = 68;  // B
                    data[pixel + 3] = 200; // A
                } else {
                    data[pixel + 3] = 0; // Transparent
                }
            }
        }
        
        // Draw image data
        this.ctx.putImageData(imageData, origin.x, origin.y);
    }

    renderPlannedPath() {
        if (this.plannedPath.length < 2) return;
        
        this.ctx.strokeStyle = '#ffaa00';
        this.ctx.lineWidth = 3 / this.viewTransform.scale;
        this.ctx.lineCap = 'round';
        this.ctx.setLineDash([5, 5]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.plannedPath[0].x, this.plannedPath[0].y);
        
        for (let i = 1; i < this.plannedPath.length; i++) {
            this.ctx.lineTo(this.plannedPath[i].x, this.plannedPath[i].y);
        }
        
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    renderRobotPath() {
        if (this.robotPath.length < 2) return;
        
        this.ctx.strokeStyle = '#00d9ff';
        this.ctx.lineWidth = 2 / this.viewTransform.scale;
        this.ctx.lineCap = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.robotPath[0].x, this.robotPath[0].y);
        
        for (let i = 1; i < this.robotPath.length; i++) {
            this.ctx.lineTo(this.robotPath[i].x, this.robotPath[i].y);
        }
        
        this.ctx.stroke();
    }

    renderLidarScan() {
        if (!this.currentLidarScan) return;
        
        const scan = this.currentLidarScan;
        const robotX = this.robotPose.x;
        const robotY = this.robotPose.y;
        const robotTheta = this.robotPose.theta;
        
        this.ctx.strokeStyle = '#00ff88';
        this.ctx.lineWidth = 1 / this.viewTransform.scale;
        
        for (let i = 0; i < scan.ranges.length; i++) {
            const range = scan.ranges[i];
            if (range < scan.range_min || range > scan.range_max) continue;
            
            const angle = scan.angle_min + i * scan.angle_increment + robotTheta;
            const endX = robotX + range * Math.cos(angle);
            const endY = robotY + range * Math.sin(angle);
            
            this.ctx.beginPath();
            this.ctx.moveTo(robotX, robotY);
            this.ctx.lineTo(endX, endY);
            this.ctx.stroke();
        }
    }

    updateRobotMarker() {
        const marker = document.getElementById('robotMarker');
        if (!marker) return;
        
        const screenPos = this.worldToScreen(this.robotPose.x, this.robotPose.y);
        
        marker.style.left = `${screenPos.x}px`;
        marker.style.top = `${screenPos.y}px`;
        marker.style.setProperty('--robot-heading', `${this.robotPose.theta * 180 / Math.PI}deg`);
        
        // Add to robot path
        this.robotPath.push({ x: this.robotPose.x, y: this.robotPose.y });
        if (this.robotPath.length > 1000) {
            this.robotPath = this.robotPath.slice(-500); // Keep last 500 points
        }
    }

    // Coordinate transformations
    worldToScreen(worldX, worldY) {
        const screenX = (worldX * this.viewTransform.scale) + this.viewTransform.x;
        const screenY = (worldY * this.viewTransform.scale) + this.viewTransform.y;
        return { x: screenX, y: screenY };
    }

    screenToWorld(screenX, screenY) {
        const worldX = (screenX - this.viewTransform.x) / this.viewTransform.scale;
        const worldY = (screenY - this.viewTransform.y) / this.viewTransform.scale;
        return { x: worldX, y: worldY };
    }

    // Navigation methods
    toggleNavigationMode() {
        const btn = document.getElementById('navigateBtn');
        
        if (this.navigationMode === 'click-to-navigate') {
            this.navigationMode = 'manual';
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fas fa-location-arrow"></i> Click to Navigate';
        } else {
            this.navigationMode = 'click-to-navigate';
            btn.classList.add('active');
            btn.innerHTML = '<i class="fas fa-times"></i> Cancel Navigate';
        }
        
        this.updateUI();
    }

    async toggleExploreMode() {
        const btn = document.getElementById('explorerBtn');
        
        if (this.isExploring) {
            // Stop exploration
            const result = await this.apiCall('/exploration/stop', 'POST');
            if (result.success) {
                this.isExploring = false;
                btn.classList.remove('active');
                btn.innerHTML = '<i class="fas fa-search"></i> Explore Mode';
                console.log('✅ Exploration stopped');
            } else {
                console.error('❌ Failed to stop exploration:', result.error);
            }
        } else {
            // Start exploration
            const result = await this.apiCall('/exploration/start', 'POST');
            if (result.success) {
                this.isExploring = true;
                btn.classList.add('active');
                btn.innerHTML = '<i class="fas fa-stop"></i> Stop Exploring';
                console.log('✅ Exploration started');
            } else {
                console.error('❌ Failed to start exploration:', result.error);
            }
        }
    }

    async returnHome() {
        const result = await this.apiCall('/navigation', 'POST', {
            waypoint_name: 'Home'
        });
        
        if (result.success) {
            console.log('✅ Returning home');
        } else {
            console.error('❌ Failed to return home:', result.error);
        }
    }

    async stopNavigation() {
        const result = await this.apiCall('/navigation/stop', 'POST');
        
        if (result.success) {
            this.isNavigating = false;
            this.isExploring = false;
            
            // Reset button states
            document.getElementById('navigateBtn').classList.remove('active');
            document.getElementById('explorerBtn').classList.remove('active');
            
            this.updateUI();
            console.log('✅ Navigation stopped');
        } else {
            console.error('❌ Failed to stop navigation:', result.error);
        }
    }

    navigateToPoint(worldX, worldY) {
        const waypoint = { x: worldX, y: worldY, theta: 0 };
        
        this.sendMessage({
            type: 'navigate-to-pose',
            pose: waypoint
        });
        
        // Add waypoint marker
        this.addWaypointMarker(worldX, worldY);
        
        this.isNavigating = true;
        this.updateUI();
    }

    addWaypointMarker(worldX, worldY) {
        const overlay = document.getElementById('mapOverlay');
        const marker = document.createElement('div');
        marker.className = 'waypoint-marker';
        
        const screenPos = this.worldToScreen(worldX, worldY);
        marker.style.left = `${screenPos.x}px`;
        marker.style.top = `${screenPos.y}px`;
        
        overlay.appendChild(marker);
        
        // Remove after navigation completes
        setTimeout(() => {
            if (marker.parentNode) {
                marker.parentNode.removeChild(marker);
            }
        }, 30000);
    }

    // Map control methods
    zoomIn() {
        this.viewTransform.scale = Math.min(this.viewTransform.maxScale, this.viewTransform.scale * 1.5);
        this.updateMapInfo();
    }

    zoomOut() {
        this.viewTransform.scale = Math.max(this.viewTransform.minScale, this.viewTransform.scale / 1.5);
        this.updateMapInfo();
    }

    centerOnRobot() {
        const screenPos = this.worldToScreen(this.robotPose.x, this.robotPose.y);
        
        this.viewTransform.x = this.canvasWidth / 2 - (this.robotPose.x * this.viewTransform.scale);
        this.viewTransform.y = this.canvasHeight / 2 - (this.robotPose.y * this.viewTransform.scale);
        
        this.updateRobotMarker();
    }

    toggleFullscreen() {
        const container = document.querySelector('.map-container');
        
        if (!this.isFullscreen) {
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            }
            this.isFullscreen = true;
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
            this.isFullscreen = false;
        }
    }

    toggleLayer(layerName) {
        this.layers[layerName] = !this.layers[layerName];
        
        const toggle = document.querySelector(`[data-layer="${layerName}"]`);
        const switchEl = toggle.querySelector('.toggle-switch');
        
        if (this.layers[layerName]) {
            toggle.classList.add('active');
            switchEl.classList.add('active');
        } else {
            toggle.classList.remove('active');
            switchEl.classList.remove('active');
        }
    }

    // Canvas interaction handlers
    onMouseDown(e) {
        this.isDragging = true;
        this.lastMousePos = { x: e.offsetX, y: e.offsetY };
    }

    onMouseMove(e) {
        if (this.isDragging) {
            const deltaX = e.offsetX - this.lastMousePos.x;
            const deltaY = e.offsetY - this.lastMousePos.y;
            
            this.viewTransform.x += deltaX;
            this.viewTransform.y += deltaY;
            
            this.lastMousePos = { x: e.offsetX, y: e.offsetY };
            this.updateRobotMarker();
        }
    }

    onMouseUp(e) {
        this.isDragging = false;
    }

    onWheel(e) {
        e.preventDefault();
        
        const mouseX = e.offsetX;
        const mouseY = e.offsetY;
        
        const zoom = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(this.viewTransform.minScale, 
                         Math.min(this.viewTransform.maxScale, this.viewTransform.scale * zoom));
        
        if (newScale !== this.viewTransform.scale) {
            this.viewTransform.x = mouseX - (mouseX - this.viewTransform.x) * (newScale / this.viewTransform.scale);
            this.viewTransform.y = mouseY - (mouseY - this.viewTransform.y) * (newScale / this.viewTransform.scale);
            this.viewTransform.scale = newScale;
            
            this.updateRobotMarker();
            this.updateMapInfo();
        }
    }

    onCanvasClick(e) {
        if (this.navigationMode === 'click-to-navigate') {
            const worldPos = this.screenToWorld(e.offsetX, e.offsetY);
            this.navigateToPoint(worldPos.x, worldPos.y);
        }
    }

    onTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.onMouseDown({ offsetX: touch.clientX, offsetY: touch.clientY });
        }
    }

    onTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && this.isDragging) {
            const touch = e.touches[0];
            this.onMouseMove({ offsetX: touch.clientX, offsetY: touch.clientY });
        }
    }

    onTouchEnd(e) {
        e.preventDefault();
        this.onMouseUp(e);
    }

    // Map management
    async saveMap() {
        const result = await this.apiCall('/map/save', 'POST', {
            name: `map_${Date.now()}`
        });
        
        if (result.success) {
            console.log('✅ Map saved');
        } else {
            console.error('❌ Failed to save map:', result.error);
        }
    }

    async loadMap() {
        // Refresh current map data
        await this.fetchMapData();
    }

    exportMap() {
        // Export map as image
        const link = document.createElement('a');
        link.download = `laika_map_${new Date().toISOString().slice(0, 19)}.png`;
        link.href = this.canvas.toDataURL();
        link.click();
    }

    async clearMap() {
        if (confirm('Are you sure you want to clear the current map? This action cannot be undone.')) {
            // For now, just clear local data - would need API endpoint for full clear
            this.robotPath = [];
            this.plannedPath = [];
            this.waypoints = [];
            
            console.log('🗑️ Local map data cleared');
        }
    }

    // UI updates
    updateUI() {
        document.getElementById('navigationMode').textContent = 
            this.navigationMode.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        document.getElementById('robotSpeed').textContent = `${this.robotSpeed.toFixed(1)} m/s`;
        
        this.updateMapInfo();
    }

    updateMapInfo() {
        document.getElementById('mapScale').textContent = `1:${Math.round(100 / this.viewTransform.scale)}`;
        document.getElementById('robotPosition').textContent = 
            `${this.robotPose.x.toFixed(1)}, ${this.robotPose.y.toFixed(1)}`;
        document.getElementById('robotHeading').textContent = 
            `${Math.round(this.robotPose.theta * 180 / Math.PI)}°`;
    }

    updateStatsDisplay() {
        document.getElementById('mapCoverage').textContent = `${this.slamStats.mapCoverage}%`;
        document.getElementById('loopClosures').textContent = this.slamStats.loopClosures;
        document.getElementById('landmarkCount').textContent = this.slamStats.landmarkCount;
        document.getElementById('scanRate').textContent = `${this.slamStats.scanRate} Hz`;
        document.getElementById('mapQuality').textContent = this.slamStats.mapQuality;
    }

    updateConnectionStatus() {
        const indicator = document.getElementById('connectionIndicator');
        const status = document.getElementById('connectionStatus');
        const slamStatus = document.getElementById('slamStatus');
        
        if (this.isConnected) {
            indicator.classList.add('connected');
            status.textContent = 'Connected';
            slamStatus.textContent = this.slamActive ? 'SLAM Active' : 'SLAM Ready';
        } else {
            indicator.classList.remove('connected');
            status.textContent = 'Disconnected';
            slamStatus.textContent = 'SLAM Inactive';
        }
    }

    togglePanel() {
        const panel = document.getElementById('controlPanel');
        panel.classList.toggle('expanded');
    }

    handleKeyboard(event) {
        switch (event.key) {
            case '+':
            case '=':
                event.preventDefault();
                this.zoomIn();
                break;
            case '-':
                event.preventDefault();
                this.zoomOut();
                break;
            case 'c':
                event.preventDefault();
                this.centerOnRobot();
                break;
            case 'f':
                event.preventDefault();
                this.toggleFullscreen();
                break;
            case 'Escape':
                event.preventDefault();
                this.stopNavigation();
                break;
            case 's':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.saveMap();
                }
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
        
        // Update robot speed (simulated)
        setInterval(() => {
            if (this.isNavigating || this.isExploring) {
                this.robotSpeed = 0.3 + Math.random() * 0.7;
            } else {
                this.robotSpeed = 0;
            }
            this.updateUI();
        }, 500);
    }

    // Cleanup method
    cleanup() {
        if (this.dataPollingInterval) {
            clearInterval(this.dataPollingInterval);
            this.dataPollingInterval = null;
        }
        
        console.log('🧹 SLAM interface cleaned up');
    }

    async reconnect() {
        if (!this.isConnected) {
            console.log('🔄 Attempting to reconnect...');
            await this.connectToAPI();
        }
    }
}

// Initialize SLAM map when page loads
// Add mock data method to LAIKASLAMMap prototype
LAIKASLAMMap.prototype.showMockMapData = function() {
    console.log('📊 Loading mock SLAM data for testing...');
    
    // Create a simple test map
    const width = 200;
    const height = 200;
    const mapData = new Array(width * height).fill(0);
    
    // Add some walls around the edges
    for (let i = 0; i < width * height; i++) {
        const x = i % width;
        const y = Math.floor(i / width);
        
        if (x < 5 || x >= width - 5 || y < 5 || y >= height - 5) {
            mapData[i] = 100; // Wall
        } else if (Math.random() < 0.05) {
            mapData[i] = 100; // Random obstacles
        } else {
            mapData[i] = 0; // Free space
        }
    }
    
    // Update map data
    this.mapData = {
        occupancyGrid: mapData,
        width: width,
        height: height,
        resolution: 0.05,
        origin: { x: -5, y: -5, theta: 0 }
    };
    
    // Set robot pose
    this.robotPose = { x: 0, y: 0, theta: 0 };
    
    // Add some test waypoints
    this.waypoints = [
        { id: 'wp1', name: 'Home', x: 0, y: 0, description: 'Starting position' },
        { id: 'wp2', name: 'Corner A', x: 2, y: 2, description: 'Test waypoint' },
        { id: 'wp3', name: 'Corner B', x: -2, y: 2, description: 'Another waypoint' }
    ];
    
    // Render the map
    this.renderMap();
    this.updateRobotMarker();
    this.renderWaypoints();
    
    console.log('✅ Mock SLAM data loaded - you should see a test map!');
};

document.addEventListener('DOMContentLoaded', () => {
    window.laikaSLAM = new LAIKASLAMMap();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.laikaSLAM) {
        window.laikaSLAM.cleanup();
    }
});
