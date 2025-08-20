/**
 * LAIKA Gamepad Navigation System
 * Provides full interface navigation via gamepad - tiles, pages, selection, and back navigation
 */

class LAIKAGamepadNavigation {
    constructor() {
        this.currentTileIndex = 0;
        this.navigationMode = 'tile_grid'; // 'tile_grid', 'page_view', 'menu_select'
        this.gridPosition = { row: 0, col: 0 };
        this.navigationHistory = ['home'];
        this.currentPage = 'home';
        this.lastNavigationTime = 0;
        this.navigationDelay = 200; // ms
        
        // Tile grid configuration
        this.tiles = [
            // Row 0
            { id: 'chat', name: 'Chat with LAIKA', url: 'chat.html', position: { row: 0, col: 0 }, icon: '💬' },
            { id: 'pipeline', name: 'Pipeline Debug', url: 'conversation.html', position: { row: 0, col: 1 }, icon: '🔍' },
            { id: 'dashboard', name: 'Sensor Dashboard', url: 'dashboard.html', position: { row: 0, col: 2 }, icon: '📊' },
            
            // Row 1
            { id: 'camera', name: 'Camera View', url: 'camera.html', position: { row: 1, col: 0 }, icon: '📹' },
            { id: 'slam', name: 'SLAM Map', url: 'slam.html', position: { row: 1, col: 1 }, icon: '🗺️' },
            { id: 'music', name: 'Music & Audio', url: '#', position: { row: 1, col: 2 }, icon: '🎵' },
            
            // Row 2
            { id: 'control', name: 'Robot Control', url: 'control.html', position: { row: 2, col: 0 }, icon: '🎮' },
            { id: 'settings', name: 'Settings', url: '#', position: { row: 2, col: 1 }, icon: '⚙️' },
            { id: 'about', name: 'About LAIKA', url: '#', position: { row: 2, col: 2 }, icon: '🤖' }
        ];
        
        this.gridLayout = this.buildGridLayout();
        this.gridDimensions = this.calculateGridDimensions();
        
        // Visual feedback elements
        this.highlightOverlay = null;
        this.navigationIndicator = null;
        
        this.init();
    }
    
    init() {
        console.log('🎮 LAIKA Gamepad Navigation initialized');
        this.createNavigationUI();
        this.setupEventListeners();
        this.highlightCurrentTile();
    }
    
    buildGridLayout() {
        const layout = {};
        this.tiles.forEach((tile, index) => {
            const key = `${tile.position.row},${tile.position.col}`;
            layout[key] = index;
        });
        return layout;
    }
    
    calculateGridDimensions() {
        const maxRow = Math.max(...this.tiles.map(tile => tile.position.row));
        const maxCol = Math.max(...this.tiles.map(tile => tile.position.col));
        return { rows: maxRow + 1, cols: maxCol + 1 };
    }
    
    createNavigationUI() {
        // Create highlight overlay
        this.highlightOverlay = document.createElement('div');
        this.highlightOverlay.className = 'gamepad-navigation-highlight';
        this.highlightOverlay.style.cssText = `
            position: fixed;
            border: 3px solid #00ffff;
            border-radius: 12px;
            background: rgba(0, 255, 255, 0.1);
            pointer-events: none;
            z-index: 10000;
            transition: all 0.3s ease;
            box-shadow: 
                0 0 20px rgba(0, 255, 255, 0.6),
                inset 0 0 20px rgba(0, 255, 255, 0.2);
            display: none;
        `;
        document.body.appendChild(this.highlightOverlay);
        
        // Create navigation indicator
        this.navigationIndicator = document.createElement('div');
        this.navigationIndicator.className = 'gamepad-navigation-indicator';
        this.navigationIndicator.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 15px;
            background: rgba(0, 0, 0, 0.9);
            border: 2px solid #00ffff;
            border-radius: 10px;
            color: #00ffff;
            padding: 10px 15px;
            font-family: 'Orbitron', monospace;
            font-size: 12px;
            font-weight: 700;
            z-index: 1000;
            min-width: 180px;
            text-align: center;
            box-shadow: 
                0 0 15px rgba(0, 255, 255, 0.4),
                inset 0 0 15px rgba(0, 255, 255, 0.1);
            backdrop-filter: blur(5px);
            display: none;
        `;
        this.navigationIndicator.innerHTML = `
            <div style="margin-bottom: 5px;">🎮 Navigation Mode</div>
            <div style="font-size: 10px; opacity: 0.8;">D-Pad: Navigate | A: Select | B: Back</div>
        `;
        document.body.appendChild(this.navigationIndicator);
    }
    
    setupEventListeners() {
        // Listen for gamepad events from the main controller
        window.addEventListener('gamepadnavigation', (event) => {
            this.handleNavigationInput(event.detail.button, event.detail.pressed);
        });
        
        // Listen for page changes
        window.addEventListener('pagechange', (event) => {
            this.handlePageChange(event.detail.page);
        });
        
        // Show navigation indicator when gamepad is connected
        window.addEventListener('gamepadconnected', () => {
            this.showNavigationMode(true);
        });
        
        window.addEventListener('gamepaddisconnected', () => {
            this.showNavigationMode(false);
        });
    }
    
    handleNavigationInput(button, pressed) {
        if (!pressed) return false;
        
        // Check navigation timing
        const currentTime = Date.now();
        if (currentTime - this.lastNavigationTime < this.navigationDelay) {
            return true;
        }
        
        let handled = false;
        
        if (this.navigationMode === 'tile_grid') {
            handled = this.handleTileNavigation(button);
        } else if (this.navigationMode === 'page_view') {
            handled = this.handlePageNavigation(button);
        }
        
        if (handled) {
            this.lastNavigationTime = currentTime;
        }
        
        return handled;
    }
    
    handleTileNavigation(button) {
        const currentTile = this.tiles[this.currentTileIndex];
        const currentPos = currentTile.position;
        
        switch (button) {
            case 'dpad_up':
            case 'hat_yu':
                return this.navigateGrid(-1, 0);
                
            case 'dpad_down':
            case 'hat_yd':
                return this.navigateGrid(1, 0);
                
            case 'dpad_left':
            case 'hat_xl':
                return this.navigateGrid(0, -1);
                
            case 'dpad_right':
            case 'hat_xr':
                return this.navigateGrid(0, 1);
                
            case 'A':
            case 'cross':
                return this.selectCurrentTile();
                
            case 'B':
            case 'circle':
                return this.navigateBack();
                
            case 'Y':
            case 'triangle':
                return this.navigateHome();
                
            default:
                return false;
        }
    }
    
    handlePageNavigation(button) {
        switch (button) {
            case 'B':
            case 'circle':
                return this.navigateBack();
                
            case 'Y':
            case 'triangle':
                return this.navigateHome();
                
            case 'X':
            case 'square':
                // Show page menu (if available)
                this.showPageMenu();
                return true;
                
            default:
                return false;
        }
    }
    
    navigateGrid(rowDelta, colDelta) {
        const currentTile = this.tiles[this.currentTileIndex];
        const newRow = Math.max(0, Math.min(this.gridDimensions.rows - 1, currentTile.position.row + rowDelta));
        const newCol = Math.max(0, Math.min(this.gridDimensions.cols - 1, currentTile.position.col + colDelta));
        
        const newKey = `${newRow},${newCol}`;
        if (newKey in this.gridLayout) {
            this.currentTileIndex = this.gridLayout[newKey];
            this.gridPosition = { row: newRow, col: newCol };
            this.highlightCurrentTile();
            
            console.log(`🎯 Navigated to: ${this.tiles[this.currentTileIndex].name}`);
            return true;
        }
        
        return false;
    }
    
    selectCurrentTile() {
        const currentTile = this.tiles[this.currentTileIndex];
        console.log(`🎯 Selecting tile: ${currentTile.name}`);
        
        if (currentTile.url && currentTile.url !== '#') {
            // Navigate to URL
            if (currentTile.url.startsWith('http')) {
                window.open(currentTile.url, '_blank');
            } else {
                this.navigateToPage(currentTile.url);
            }
            return true;
        }
        
        return false;
    }
    
    navigateToPage(url) {
        console.log(`🔗 Navigating to: ${url}`);
        
        // Add to history
        const pageId = url.replace('.html', '');
        if (!this.navigationHistory.includes(pageId)) {
            this.navigationHistory.push(pageId);
        }
        
        this.currentPage = pageId;
        this.navigationMode = 'page_view';
        
        // Trigger page navigation
        if (typeof showPage === 'function') {
            showPage(pageId);
        } else {
            window.location.href = url;
        }
        
        this.updateNavigationUI();
    }
    
    navigateBack() {
        if (this.navigationHistory.length > 1) {
            this.navigationHistory.pop(); // Remove current page
            const previousPage = this.navigationHistory[this.navigationHistory.length - 1];
            
            console.log(`🔙 Going back to: ${previousPage}`);
            
            if (previousPage === 'home') {
                this.navigateHome();
            } else {
                this.navigateToPage(previousPage + '.html');
            }
            return true;
        } else {
            return this.navigateHome();
        }
    }
    
    navigateHome() {
        console.log('🏠 Navigating to home');
        
        this.currentPage = 'home';
        this.navigationMode = 'tile_grid';
        this.navigationHistory = ['home'];
        
        // Show home page
        if (typeof showPage === 'function') {
            showPage('home');
        } else {
            window.location.href = 'index.html';
        }
        
        this.highlightCurrentTile();
        this.updateNavigationUI();
        return true;
    }
    
    highlightCurrentTile() {
        if (this.navigationMode !== 'tile_grid') {
            this.highlightOverlay.style.display = 'none';
            return;
        }
        
        const currentTile = this.tiles[this.currentTileIndex];
        
        // Find the corresponding DOM element
        const tileElements = document.querySelectorAll('.nav-card');
        let targetElement = null;
        
        // Try to find by href or data attributes
        tileElements.forEach(element => {
            const href = element.getAttribute('href');
            const dataPage = element.getAttribute('data-page');
            
            if ((href && href.includes(currentTile.id)) || 
                (dataPage && dataPage === currentTile.id) ||
                (href === currentTile.url)) {
                targetElement = element;
            }
        });
        
        if (targetElement) {
            const rect = targetElement.getBoundingClientRect();
            
            this.highlightOverlay.style.display = 'block';
            this.highlightOverlay.style.left = `${rect.left - 5}px`;
            this.highlightOverlay.style.top = `${rect.top - 5}px`;
            this.highlightOverlay.style.width = `${rect.width + 10}px`;
            this.highlightOverlay.style.height = `${rect.height + 10}px`;
            
            // Add pulsing animation
            this.highlightOverlay.style.animation = 'gamepad-pulse 2s infinite';
            
            // Scroll into view if needed
            targetElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'center'
            });
        }
    }
    
    handlePageChange(pageId) {
        this.currentPage = pageId;
        
        if (pageId === 'home') {
            this.navigationMode = 'tile_grid';
            this.highlightCurrentTile();
        } else {
            this.navigationMode = 'page_view';
            this.highlightOverlay.style.display = 'none';
        }
        
        this.updateNavigationUI();
    }
    
    showNavigationMode(show) {
        this.navigationIndicator.style.display = show ? 'block' : 'none';
        
        if (show && this.navigationMode === 'tile_grid') {
            this.highlightCurrentTile();
        } else {
            this.highlightOverlay.style.display = 'none';
        }
    }
    
    updateNavigationUI() {
        if (this.navigationMode === 'tile_grid') {
            this.navigationIndicator.innerHTML = `
                <div style="margin-bottom: 5px;">🎮 Tile Navigation</div>
                <div style="font-size: 10px; opacity: 0.8;">D-Pad: Navigate | A: Select | Y: Home</div>
            `;
        } else if (this.navigationMode === 'page_view') {
            this.navigationIndicator.innerHTML = `
                <div style="margin-bottom: 5px;">📄 Page View</div>
                <div style="font-size: 10px; opacity: 0.8;">B: Back | Y: Home | X: Menu</div>
            `;
        }
    }
    
    showPageMenu() {
        // Show page-specific menu (to be implemented per page)
        console.log('📋 Showing page menu');
        
        // Trigger page menu event
        const event = new CustomEvent('showpagemenu', {
            detail: { page: this.currentPage }
        });
        window.dispatchEvent(event);
    }
    
    getCurrentTile() {
        return this.tiles[this.currentTileIndex];
    }
    
    getNavigationState() {
        return {
            mode: this.navigationMode,
            currentTile: this.currentTileIndex,
            currentPage: this.currentPage,
            gridPosition: this.gridPosition,
            history: [...this.navigationHistory]
        };
    }
}

// Add CSS animations
const navigationStyles = document.createElement('style');
navigationStyles.textContent = `
    @keyframes gamepad-pulse {
        0%, 100% { 
            box-shadow: 
                0 0 20px rgba(0, 255, 255, 0.6),
                inset 0 0 20px rgba(0, 255, 255, 0.2);
        }
        50% { 
            box-shadow: 
                0 0 30px rgba(0, 255, 255, 1),
                inset 0 0 30px rgba(0, 255, 255, 0.4);
        }
    }
    
    .gamepad-navigation-highlight {
        animation: gamepad-pulse 2s infinite;
    }
    
    /* Responsive adjustments */
    @media (max-width: 768px) {
        .gamepad-navigation-indicator {
            bottom: 60px !important;
            right: 10px !important;
            font-size: 11px !important;
            min-width: 160px !important;
        }
    }
`;
document.head.appendChild(navigationStyles);

// Initialize navigation when DOM is ready
let laikaGamepadNavigation = null;

document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for other components to initialize
    setTimeout(() => {
        laikaGamepadNavigation = new LAIKAGamepadNavigation();
        window.laikaGamepadNavigation = laikaGamepadNavigation; // Make globally accessible
    }, 1000);
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LAIKAGamepadNavigation;
}
