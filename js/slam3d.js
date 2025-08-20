/**
 * LAIKA 3D Textured SLAM Map Interface
 * Interactive 3D mapping with camera textures and real-time SLAM data
 */

class LAIKA3DSLAMMap {
    constructor() {
        this.isConnected = false;
        this.slamActive = false;
        this.navigationMode = 'manual';
        
        // Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.container = null;
        
        // 3D Map state
        this.mapMesh = null;
        this.textureMaterial = null;
        this.textureCanvas = null;
        this.textureContext = null;
        this.mapGeometry = null;
        
        // Map data
        this.mapData = {
            occupancyGrid: null,
            resolution: 0.05,
            width: 0,
            height: 0,
            origin: { x: 0, y: 0, theta: 0 }
        };
        
        // Robot state
        this.robotPose = { x: 0, y: 0, theta: 0 };
        this.robotMesh = null;
        this.robotPath = [];
        this.pathLine = null;
        this.waypoints = [];
        this.waypointMeshes = [];
        
        // Texture mapping
        this.textureData = new Map(); // Store texture info per map cell
        this.cameraImages = new Map(); // Store captured images
        
        // Navigation state
        this.isNavigating = false;
        this.currentWaypoint = null;
        this.navigationTarget = null;
        
        // WebSocket connection
        this.ws = null;
        
        // Interaction state
        this.selectedWaypoint = null;
        this.isAddingWaypoint = false;
        
        this.init();
    }

    async init() {
        this.setupContainer();
        this.setupThreeJS();
        this.setupEventListeners();
        this.setupUI();
        await this.connectWebSocket();
        this.animate();
    }

    setupContainer() {
        this.container = document.getElementById('slam3DContainer') || document.getElementById('mapCanvas').parentElement;
        if (!this.container) {
            console.error('❌ 3D SLAM container not found');
            return;
        }
        
        // Clear existing content
        this.container.innerHTML = '';
        
        // Create 3D canvas container
        const canvas3D = document.createElement('div');
        canvas3D.id = 'slam3DCanvas';
        canvas3D.style.width = '100%';
        canvas3D.style.height = '100%';
        canvas3D.style.position = 'relative';
        this.container.appendChild(canvas3D);
        
        this.container = canvas3D;
    }

    setupThreeJS() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0a);
        this.scene.fog = new THREE.Fog(0x0a0a0a, 10, 50);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            this.container.clientWidth / this.container.clientHeight, 
            0.1, 
            1000
        );
        this.camera.position.set(0, 10, 10);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Grid helper
        const gridHelper = new THREE.GridHelper(20, 20, 0x00d9ff, 0x333333);
        this.scene.add(gridHelper);

        // Create texture canvas for map texturing
        this.textureCanvas = document.createElement('canvas');
        this.textureCanvas.width = 512;
        this.textureCanvas.height = 512;
        this.textureContext = this.textureCanvas.getContext('2d');
        
        console.log('✅ Three.js 3D scene initialized');
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Mouse events for waypoint placement
        this.renderer.domElement.addEventListener('click', (event) => this.onCanvasClick(event));
        this.renderer.domElement.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            this.onCanvasRightClick(event);
        });

        // UI controls
        this.setupUIEventListeners();
    }

    setupUIEventListeners() {
        // Mapping controls
        const startMappingBtn = document.getElementById('startMappingBtn');
        if (startMappingBtn) {
            startMappingBtn.addEventListener('click', () => this.startMapping());
        }

        const stopMappingBtn = document.getElementById('stopMappingBtn');
        if (stopMappingBtn) {
            stopMappingBtn.addEventListener('click', () => this.stopMapping());
        }

        // Navigation controls
        const stopNavigationBtn = document.getElementById('stopNavigationBtn');
        if (stopNavigationBtn) {
            stopNavigationBtn.addEventListener('click', () => this.stopNavigation());
        }

        // Texture capture
        const captureTextureBtn = document.getElementById('captureTextureBtn');
        if (captureTextureBtn) {
            captureTextureBtn.addEventListener('click', () => this.requestTexturedScan());
        }

        // View controls
        const resetViewBtn = document.getElementById('resetViewBtn');
        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', () => this.resetView());
        }
    }

    setupUI() {
        // Create 3D-specific UI controls
        const controlsHTML = `
            <div class="slam-3d-controls" style="position: absolute; top: 10px; right: 10px; z-index: 1000;">
                <button id="captureTextureBtn" class="btn-3d" title="Capture Textured Scan">
                    <i class="fas fa-camera"></i> Capture Texture
                </button>
                <button id="resetViewBtn" class="btn-3d" title="Reset 3D View">
                    <i class="fas fa-home"></i> Reset View
                </button>
                <div class="view-info" style="background: rgba(0,0,0,0.8); color: #00d9ff; padding: 5px; margin-top: 5px; border-radius: 3px; font-size: 12px;">
                    <div>Click: Add Waypoint</div>
                    <div>Right-click: Navigate</div>
                    <div>Drag: Rotate View</div>
                </div>
            </div>
        `;
        
        this.container.insertAdjacentHTML('beforeend', controlsHTML);
        
        // Add CSS for 3D controls
        const style = document.createElement('style');
        style.textContent = `
            .btn-3d {
                background: rgba(0, 217, 255, 0.2);
                border: 1px solid #00d9ff;
                color: #00d9ff;
                padding: 8px 12px;
                margin: 2px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            }
            .btn-3d:hover {
                background: rgba(0, 217, 255, 0.4);
                box-shadow: 0 0 10px rgba(0, 217, 255, 0.3);
            }
        `;
        document.head.appendChild(style);
    }

    async connectWebSocket() {
        const wsUrls = [
            `ws://${window.location.hostname}:${window.location.port || 80}/ws/slam`,
            `ws://${window.location.hostname}/ws/slam`,
            'ws://laika.local/ws/slam',
            'ws://localhost/ws/slam'
        ];

        for (const url of wsUrls) {
            try {
                console.log(`🔗 Attempting 3D SLAM WebSocket connection to ${url}`);
                
                this.ws = new WebSocket(url);
                
                this.ws.onopen = () => {
                    console.log('✅ 3D SLAM WebSocket connected to LAIKA service');
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
                    console.log('📡 3D SLAM WebSocket disconnected');
                    this.isConnected = false;
                    this.updateConnectionStatus();
                    setTimeout(() => this.reconnect(), 3000);
                };

                this.ws.onerror = (error) => {
                    console.error('❌ 3D SLAM WebSocket error:', error);
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
            }
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'map-update':
                this.updateMapData(data.data);
                break;
            case 'robot-pose':
                this.updateRobotPose(data.pose || data.data);
                break;
            case 'textured-scan-update':
                this.handleTexturedScan(data.data);
                break;
            case 'waypoints-update':
                this.updateWaypoints(data.data.waypoints);
                break;
            case 'navigation-status':
                this.updateNavigationStatus(data.data);
                break;
            case 'slam-status':
                this.updateSLAMStatus(data.data);
                break;
            case 'error':
                console.error('❌ 3D SLAM error:', data.message);
                break;
            default:
                console.log('📦 Unknown 3D SLAM message type:', data.type);
        }
    }

    updateMapData(mapData) {
        this.mapData = { ...this.mapData, ...mapData };
        this.render3DMap();
        console.log('🗺️ 3D Map data updated');
    }

    render3DMap() {
        if (!this.mapData.data || !this.mapData.width || !this.mapData.height) {
            return;
        }

        // Remove existing map mesh
        if (this.mapMesh) {
            this.scene.remove(this.mapMesh);
            this.mapMesh.geometry.dispose();
            this.mapMesh.material.dispose();
        }

        // Create height-mapped geometry from occupancy grid
        const geometry = new THREE.PlaneGeometry(
            this.mapData.width * this.mapData.resolution,
            this.mapData.height * this.mapData.resolution,
            this.mapData.width - 1,
            this.mapData.height - 1
        );

        // Apply height mapping based on occupancy data
        const vertices = geometry.attributes.position.array;
        for (let i = 0; i < this.mapData.data.length; i++) {
            const occupancy = this.mapData.data[i];
            let height = 0;
            
            if (occupancy > 50) {
                height = 0.5; // Obstacle height
            } else if (occupancy === -1) {
                height = 0.1; // Unknown area slight elevation
            }
            
            // Set Z coordinate (height)
            vertices[i * 3 + 2] = height;
        }
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();

        // Create textured material
        const texture = new THREE.CanvasTexture(this.textureCanvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        const material = new THREE.MeshLambertMaterial({
            map: texture,
            transparent: true,
            opacity: 0.8
        });

        // Create mesh
        this.mapMesh = new THREE.Mesh(geometry, material);
        this.mapMesh.rotation.x = -Math.PI / 2; // Lay flat
        this.mapMesh.position.set(
            this.mapData.origin.x + (this.mapData.width * this.mapData.resolution) / 2,
            0,
            this.mapData.origin.y + (this.mapData.height * this.mapData.resolution) / 2
        );
        this.mapMesh.receiveShadow = true;
        
        this.scene.add(this.mapMesh);
        console.log('✅ 3D map mesh created');
    }

    handleTexturedScan(scanData) {
        if (!scanData.camera_image || !scanData.texture_coordinates) {
            console.log('⚠️ Incomplete textured scan data');
            return;
        }

        // Store the camera image
        const timestamp = scanData.timestamp;
        this.cameraImages.set(timestamp, scanData.camera_image);

        // Apply texture to map regions
        this.applyTextureToMap(scanData);
        
        console.log('✅ Textured scan processed');
    }

    applyTextureToMap(scanData) {
        if (!this.textureContext || !scanData.texture_coordinates) {
            return;
        }

        // Create image from base64 data
        const img = new Image();
        img.onload = () => {
            // Clear texture canvas with dark background
            this.textureContext.fillStyle = '#1a1a1a';
            this.textureContext.fillRect(0, 0, this.textureCanvas.width, this.textureCanvas.height);

            // Apply texture mapping
            for (const coord of scanData.texture_coordinates) {
                // Convert world coordinates to texture coordinates
                const texX = Math.floor((coord.world_x + 10) * 25.6); // Scale to 512px texture
                const texY = Math.floor((coord.world_y + 10) * 25.6);
                
                if (texX >= 0 && texX < 512 && texY >= 0 && texY < 512) {
                    // Sample pixel from camera image
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    
                    const imageData = ctx.getImageData(coord.image_u, coord.image_v, 1, 1);
                    const pixel = imageData.data;
                    
                    // Apply to texture
                    this.textureContext.fillStyle = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
                    this.textureContext.fillRect(texX, texY, 2, 2);
                }
            }

            // Update texture
            if (this.mapMesh && this.mapMesh.material.map) {
                this.mapMesh.material.map.needsUpdate = true;
            }
        };
        
        img.src = 'data:image/jpeg;base64,' + scanData.camera_image;
    }

    updateRobotPose(pose) {
        this.robotPose = pose;
        this.updateRobot3D();
    }

    updateRobot3D() {
        // Remove existing robot mesh
        if (this.robotMesh) {
            this.scene.remove(this.robotMesh);
        }

        // Create robot representation
        const robotGeometry = new THREE.ConeGeometry(0.2, 0.5, 8);
        const robotMaterial = new THREE.MeshLambertMaterial({ color: 0xff0080 });
        this.robotMesh = new THREE.Mesh(robotGeometry, robotMaterial);
        
        this.robotMesh.position.set(
            this.robotPose.x,
            0.25,
            this.robotPose.y
        );
        this.robotMesh.rotation.y = -this.robotPose.theta + Math.PI / 2;
        this.robotMesh.castShadow = true;
        
        this.scene.add(this.robotMesh);
    }

    updateWaypoints(waypoints) {
        // Remove existing waypoint meshes
        this.waypointMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        this.waypointMeshes = [];

        // Add new waypoints
        waypoints.forEach((waypoint, index) => {
            const geometry = new THREE.SphereGeometry(0.15, 16, 16);
            const material = new THREE.MeshLambertMaterial({ 
                color: 0xffaa00,
                emissive: 0x332200
            });
            const mesh = new THREE.Mesh(geometry, material);
            
            mesh.position.set(waypoint.x, 0.15, waypoint.y);
            mesh.userData = waypoint;
            mesh.castShadow = true;
            
            this.scene.add(mesh);
            this.waypointMeshes.push(mesh);
        });

        this.waypoints = waypoints;
        console.log(`✅ Updated ${waypoints.length} waypoints in 3D scene`);
    }

    onCanvasClick(event) {
        if (this.isAddingWaypoint) {
            const point = this.getWorldCoordinatesFromClick(event);
            if (point) {
                this.addWaypoint(point.x, point.z); // Note: z is y in world coordinates
            }
        }
    }

    onCanvasRightClick(event) {
        const point = this.getWorldCoordinatesFromClick(event);
        if (point) {
            this.navigateToPoint(point.x, point.z);
        }
    }

    getWorldCoordinatesFromClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        // Raycast against ground plane
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersect = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersect);

        return intersect;
    }

    addWaypoint(x, y) {
        const waypointData = {
            x: x,
            y: y,
            name: `Waypoint ${this.waypoints.length + 1}`,
            description: 'Added via 3D interface'
        };

        this.sendMessage({
            type: 'add-waypoint',
            data: waypointData
        });
    }

    navigateToPoint(x, y) {
        console.log(`🎯 Navigating to 3D point (${x.toFixed(2)}, ${y.toFixed(2)})`);
        
        this.sendMessage({
            type: 'navigate-to-point',
            point: { x: x, y: y }
        });
    }

    requestTexturedScan() {
        console.log('📸 Requesting textured scan...');
        this.sendMessage({
            type: 'request-textured-scan'
        });
    }

    startMapping() {
        this.sendMessage({ type: 'start-mapping' });
    }

    stopMapping() {
        this.sendMessage({ type: 'stop-mapping' });
    }

    stopNavigation() {
        this.sendMessage({ type: 'stop-navigation' });
    }

    resetView() {
        this.camera.position.set(0, 10, 10);
        this.camera.lookAt(0, 0, 0);
        this.controls.reset();
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('⚠️ WebSocket not connected, cannot send message');
        }
    }

    updateConnectionStatus() {
        // Update UI connection indicator
        const indicator = document.querySelector('.connection-status');
        if (indicator) {
            indicator.textContent = this.isConnected ? 'Connected' : 'Disconnected';
            indicator.className = `connection-status ${this.isConnected ? 'connected' : 'disconnected'}`;
        }
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.controls) {
            this.controls.update();
        }
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    async reconnect() {
        if (!this.isConnected) {
            console.log('🔄 Attempting to reconnect 3D SLAM WebSocket...');
            await this.connectWebSocket();
        }
    }

    updateSLAMStatus(status) {
        // Update UI with SLAM status
        console.log('📊 3D SLAM status updated:', status);
    }

    updateNavigationStatus(status) {
        this.isNavigating = status.active;
        if (status.target) {
            this.navigationTarget = status.target;
        }
        console.log('🧭 3D Navigation status:', status);
    }
}

// Initialize 3D SLAM when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check if Three.js is loaded
    if (typeof THREE === 'undefined') {
        console.error('❌ Three.js not loaded. Please include Three.js library.');
        return;
    }
    
    // Initialize 3D SLAM interface
    window.laika3DSLAM = new LAIKA3DSLAMMap();
    console.log('🚀 LAIKA 3D SLAM interface initialized');
});
