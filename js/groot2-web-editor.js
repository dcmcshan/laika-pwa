/**
 * Groot2 Web Editor - LAIKA Behavior Tree Editor
 * A simplified web-based visual behavior tree editor
 */

class Groot2WebEditor {
    constructor() {
        this.canvas = document.getElementById('groot2Canvas');
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.selectedNode = null;
        this.draggedNode = null;
        this.zoom = 1;
        this.pan = { x: 0, y: 0 };
        this.isDragging = false;
        
        this.nodeTypes = {
            'sequence': { name: 'Sequence', color: '#00FFFF', icon: '⟳' },
            'selector': { name: 'Selector', color: '#FF6B35', icon: '?' },
            'parallel': { name: 'Parallel', color: '#FF1B8D', icon: '∥' },
            'action': { name: 'Action', color: '#00FF00', icon: '▶' },
            'condition': { name: 'Condition', color: '#0080FF', icon: '◯' }
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadDefaultTree();
        this.startRenderLoop();
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        
        // Drag and drop from palette
        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.canvas.style.cursor = 'copy';
        });
        
        this.canvas.addEventListener('dragleave', () => {
            this.canvas.style.cursor = 'grab';
        });
        
        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            this.canvas.style.cursor = 'grab';
            const nodeType = e.dataTransfer.getData('text/plain');
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left - this.pan.x) / this.zoom;
            const y = (e.clientY - rect.top - this.pan.y) / this.zoom;
            this.addNode(nodeType, x, y);
        });
        
        // Setup palette drag events
        document.querySelectorAll('.palette-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.type);
                item.style.opacity = '0.5';
            });
            
            item.addEventListener('dragend', () => {
                item.style.opacity = '1';
            });
        });
    }
    
    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.pan.x) / this.zoom;
        const y = (e.clientY - rect.top - this.pan.y) / this.zoom;
        
        const clickedNode = this.getNodeAt(x, y);
        
        if (clickedNode) {
            this.selectedNode = clickedNode;
            this.draggedNode = clickedNode;
            this.isDragging = true;
        } else {
            this.selectedNode = null;
            this.isDragging = true;
            this.canvas.style.cursor = 'grabbing';
        }
    }
    
    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.pan.x) / this.zoom;
        const y = (e.clientY - rect.top - this.pan.y) / this.zoom;
        
        if (this.isDragging && this.draggedNode) {
            this.draggedNode.x = x - 60;
            this.draggedNode.y = y - 30;
        } else if (this.isDragging && !this.draggedNode) {
            this.pan.x += e.movementX;
            this.pan.y += e.movementY;
        }
    }
    
    onMouseUp(e) {
        this.isDragging = false;
        this.draggedNode = null;
        this.canvas.style.cursor = 'grab';
    }
    
    onWheel(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom = Math.max(0.1, Math.min(3, this.zoom * zoomFactor));
    }
    
    getNodeAt(x, y) {
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const node = this.nodes[i];
            if (x >= node.x && x <= node.x + 120 &&
                y >= node.y && y <= node.y + 60) {
                return node;
            }
        }
        return null;
    }
    
    addNode(type, x, y) {
        const node = {
            id: 'node_' + Math.random().toString(36).substr(2, 9),
            type: type,
            x: x,
            y: y,
            name: this.nodeTypes[type] ? this.nodeTypes[type].name : type,
            status: 'idle'
        };
        
        this.nodes.push(node);
        return node;
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Apply zoom and pan
        this.ctx.save();
        this.ctx.translate(this.pan.x, this.pan.y);
        this.ctx.scale(this.zoom, this.zoom);
        
        // Draw grid
        this.drawGrid();
        
        // Draw connections first (behind nodes)
        this.drawConnections();
        
        // Draw nodes on top
        this.drawNodes();
        
        this.ctx.restore();
    }
    
    drawGrid() {
        const gridSize = 20;
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    drawNodes() {
        this.nodes.forEach(node => {
            const nodeInfo = this.nodeTypes[node.type];
            const color = nodeInfo ? nodeInfo.color : '#00FFFF';
            const icon = nodeInfo ? nodeInfo.icon : '●';
            
            // Node background
            this.ctx.fillStyle = node === this.selectedNode ? 'rgba(0, 255, 255, 0.3)' : '#141420';
            this.ctx.fillRect(node.x, node.y, 120, 60);
            
            // Node border
            this.ctx.strokeStyle = node === this.selectedNode ? '#00FFFF' : color;
            this.ctx.lineWidth = node === this.selectedNode ? 3 : 2;
            this.ctx.strokeRect(node.x, node.y, 120, 60);
            
            // Node icon
            this.ctx.fillStyle = color;
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(icon, node.x + 60, node.y + 20);
            
            // Node name
            this.ctx.fillStyle = '#E0FFFF';
            this.ctx.font = '10px Orbitron';
            this.ctx.fillText(node.name, node.x + 60, node.y + 40);
            
            // Status indicator
            if (node.status !== 'idle') {
                this.ctx.fillStyle = this.getStatusColor(node.status);
                this.ctx.beginPath();
                this.ctx.arc(node.x + 110, node.y + 10, 5, 0, 2 * Math.PI);
                this.ctx.fill();
            }
        });
    }
    
    getStatusColor(status) {
        switch(status) {
            case 'running': return '#00FFFF';
            case 'success': return '#00FF00';
            case 'failure': return '#FF1B8D';
            default: return '#80C0C0';
        }
    }
    
    drawConnections() {
        this.ctx.strokeStyle = 'var(--atomic-cyan)';
        this.ctx.lineWidth = 2;
        
        // Draw connections between nodes based on their positions
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            
            // Find children (nodes below this one)
            const children = this.nodes.filter(n => 
                n.y > node.y && 
                Math.abs(n.x - node.x) < 200 && 
                n.y < node.y + 150
            );
            
            children.forEach(child => {
                this.drawConnection(node, child);
            });
        }
    }
    
    drawConnection(from, to) {
        const startX = from.x + 60; // Center of source node
        const startY = from.y + 60; // Bottom of source node
        const endX = to.x + 60;     // Center of target node
        const endY = to.y;          // Top of target node
        
        // Draw connection line
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(startX, startY + 20);
        this.ctx.lineTo(endX, endY - 20);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        
        // Draw arrow
        this.ctx.fillStyle = 'var(--atomic-cyan)';
        this.ctx.beginPath();
        this.ctx.moveTo(endX - 5, endY - 5);
        this.ctx.lineTo(endX + 5, endY - 5);
        this.ctx.lineTo(endX, endY);
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    startRenderLoop() {
        const render = () => {
            this.render();
            requestAnimationFrame(render);
        };
        render();
    }
    
    loadDefaultTree() {
        // Create a simple default tree
        this.addNode('selector', 400, 50);
        this.addNode('sequence', 200, 200);
        this.addNode('sequence', 600, 200);
        this.addNode('action', 100, 350);
        this.addNode('action', 300, 350);
        this.addNode('action', 500, 350);
        this.addNode('action', 700, 350);
    }
    
    resetView() {
        this.zoom = 1;
        this.pan = { x: 0, y: 0 };
    }
    
    saveTree() {
        const treeData = {
            nodes: this.nodes,
            metadata: {
                name: 'LAIKA Behavior Tree',
                version: '1.0',
                created: new Date().toISOString()
            }
        };
        
        const blob = new Blob([JSON.stringify(treeData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'laika_behavior_tree.json';
        a.click();
        URL.revokeObjectURL(url);
    }
    
    loadTree() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const treeData = JSON.parse(e.target.result);
                        this.nodes = treeData.nodes || [];
                    } catch (error) {
                        console.error('Error loading tree:', error);
                        alert('Error loading behavior tree file');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
    
    executeTree() {
        console.log('Executing behavior tree...');
        // Simulate tree execution
        this.simulateExecution();
    }
    
    toggleMonitoring() {
        console.log('Toggling tree monitoring...');
    }
    
    simulateExecution() {
        // Simple simulation of tree execution
        const root = this.nodes.find(n => n.type === 'selector');
        if (root) {
            root.status = 'running';
            setTimeout(() => {
                root.status = 'success';
                this.simulateChildExecution(root);
            }, 1000);
        }
    }
    
    simulateChildExecution(parent) {
        // Find children (simplified)
        const children = this.nodes.filter(n => 
            n.y > parent.y && Math.abs(n.x - parent.x) < 200
        );
        
        children.forEach((child, index) => {
            setTimeout(() => {
                child.status = 'running';
                setTimeout(() => {
                    child.status = Math.random() > 0.5 ? 'success' : 'failure';
                }, 500);
            }, index * 200);
        });
    }
}

// Initialize the editor when the page loads
let groot2Editor;
document.addEventListener('DOMContentLoaded', () => {
    groot2Editor = new Groot2WebEditor();
});
