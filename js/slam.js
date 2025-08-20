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
        
        // Attempt to connect
        await this.connectWebSocket();
        
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

    async connectWebSocket() {
        const wsUrls = [
            `ws://${window.location.hostname}/ws/slam`,
            'ws://laika.local/ws/slam',
            'ws://localhost/ws/slam'
        ];

        for (const url of wsUrls) {
            try {
                console.log(`🔗 Attempting WebSocket connection to ${url}`);
                
                this.ws = new WebSocket(url);
                
                this.ws.onopen = () => {
                    console.log('✅ WebSocket connected to LAIKA SLAM service');
                    this.isConnected = true;
                    this.updateConnectionStatus();
                    
                    // Request initial map data
                    this.sendMessage({
                        type: 'request-map',
                        include_robot_pose: true
                    });
                };

                this.ws.onmessage = (event) => {
                    this.handleWebSocketMessage(JSON.parse(event.data));
                };

                this.ws.onclose = () => {
                    console.log('📡 WebSocket disconnected');
                    this.isConnected = false;
                    this.updateConnectionStatus();
                    setTimeout(() => this.reconnect(), 3000);
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
                    console.log('🔄 All connection attempts failed, using simulation mode');
                    this.enableSimulationMode();
                }
            }
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

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.log('📡 WebSocket not connected, message queued');
        }
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

    toggleExploreMode() {
        this.isExploring = !this.isExploring;
        
        const btn = document.getElementById('explorerBtn');
        if (this.isExploring) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="fas fa-stop"></i> Stop Exploring';
            this.sendMessage({ type: 'start-exploration' });
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="fas fa-search"></i> Explore Mode';
            this.sendMessage({ type: 'stop-exploration' });
        }
    }

    returnHome() {
        this.sendMessage({
            type: 'navigate-to-pose',
            pose: { x: 0, y: 0, theta: 0 }
        });
    }

    stopNavigation() {
        this.isNavigating = false;
        this.isExploring = false;
        this.sendMessage({ type: 'cancel-navigation' });
        
        // Reset button states
        document.getElementById('navigateBtn').classList.remove('active');
        document.getElementById('explorerBtn').classList.remove('active');
        
        this.updateUI();
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
    saveMap() {
        this.sendMessage({ type: 'save-map', name: `map_${Date.now()}` });
    }

    loadMap() {
        // For now, just request the current map
        this.sendMessage({ type: 'request-map' });
    }

    exportMap() {
        // Export map as image
        const link = document.createElement('a');
        link.download = `laika_map_${new Date().toISOString().slice(0, 19)}.png`;
        link.href = this.canvas.toDataURL();
        link.click();
    }

    clearMap() {
        if (confirm('Are you sure you want to clear the current map? This action cannot be undone.')) {
            this.sendMessage({ type: 'clear-map' });
            this.robotPath = [];
            this.plannedPath = [];
            this.waypoints = [];
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

    enableSimulationMode() {
        console.log('🎭 Enabling SLAM simulation mode');
        
        // Simulate connection
        setTimeout(() => {
            this.isConnected = true;
            this.slamActive = true;
            this.updateConnectionStatus();
        }, 1000);
        
        // Generate simulated map data
        this.generateSimulatedMap();
        
        // Simulate robot movement
        setInterval(() => {
            this.simulateRobotMovement();
        }, 100);
        
        // Simulate SLAM updates
        setInterval(() => {
            this.simulateSLAMStats();
        }, 2000);
    }

    generateSimulatedMap() {
        const width = 200;
        const height = 200;
        const grid = new Uint8Array(width * height);
        
        // Generate a simple room with obstacles
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                
                // Walls around the edges
                if (x < 5 || x >= width - 5 || y < 5 || y >= height - 5) {
                    grid[i] = 100; // Occupied
                }
                // Some obstacles in the middle
                else if ((x > 50 && x < 70 && y > 80 && y < 120) ||
                         (x > 130 && x < 150 && y > 60 && y < 100)) {
                    grid[i] = 100; // Occupied
                }
                // Free space
                else if (Math.random() > 0.1) {
                    grid[i] = 0; // Free
                }
                // Unknown space
                else {
                    grid[i] = -1; // Unknown
                }
            }
        }
        
        this.mapData = {
            occupancyGrid: grid,
            width: width,
            height: height,
            resolution: 0.05,
            origin: { x: -width/2, y: -height/2, theta: 0 }
        };
    }

    simulateRobotMovement() {
        if (this.isNavigating || this.isExploring) {
            this.robotPose.x += (Math.random() - 0.5) * 0.1;
            this.robotPose.y += (Math.random() - 0.5) * 0.1;
            this.robotPose.theta += (Math.random() - 0.5) * 0.2;
            
            this.updateRobotPose(this.robotPose);
        }
    }

    simulateSLAMStats() {
        this.slamStats.mapCoverage = Math.min(100, this.slamStats.mapCoverage + Math.random() * 2);
        this.slamStats.loopClosures = Math.floor(this.slamStats.mapCoverage / 10);
        this.slamStats.landmarkCount = Math.floor(this.slamStats.mapCoverage / 5);
        this.slamStats.scanRate = 8 + Math.random() * 4;
        
        if (this.slamStats.mapCoverage > 80) {
            this.slamStats.mapQuality = 'Excellent';
        } else if (this.slamStats.mapCoverage > 60) {
            this.slamStats.mapQuality = 'Good';
        } else if (this.slamStats.mapCoverage > 30) {
            this.slamStats.mapQuality = 'Fair';
        } else {
            this.slamStats.mapQuality = 'Poor';
        }
        
        this.updateStatsDisplay();
    }

    async reconnect() {
        if (!this.isConnected) {
            console.log('🔄 Attempting to reconnect...');
            await this.connectWebSocket();
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
    if (window.laikaSLAM && window.laikaSLAM.ws) {
        window.laikaSLAM.ws.close();
    }
});
