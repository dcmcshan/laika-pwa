/**
 * LAIKA Behavior Tree Editor
 * Manages behavior tree editing and Groot2 integration
 */

class BehaviorTreeEditor {
    constructor() {
        this.isConnected = false;
        this.behaviorTreeActive = false;
        this.xmlContent = '';
        this.socket = null;
        
        this.initializeUI();
        this.setupEventListeners();
        this.connectToServer();
    }
    
    initializeUI() {
        // Initialize XML editor with default content
        this.xmlContent = document.getElementById('xmlEditor').value;
        
        // Update status indicators
        this.updateStatus('sttStatus', false, 'Inactive');
        this.updateStatus('llmStatus', false, 'Inactive');
        this.updateStatus('actStatus', false, 'Inactive');
        this.updateStatus('ttsStatus', false, 'Inactive');
        this.updateStatus('behaviorStatus', false, 'Inactive');
        
        this.log('🌳 Behavior Tree Editor initialized');
    }
    
    setupEventListeners() {
        // XML editor change event
        document.getElementById('xmlEditor').addEventListener('input', (e) => {
            this.xmlContent = e.target.value;
            this.log('📝 XML content updated');
        });
        
        // Auto-save XML changes
        let saveTimeout;
        document.getElementById('xmlEditor').addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                this.autoSaveXML();
            }, 2000);
        });
    }
    
    connectToServer() {
        try {
            // Connect to PWA server via SocketIO
            if (typeof io !== 'undefined') {
                this.socket = io();
                
                this.socket.on('connect', () => {
                    this.isConnected = true;
                    this.log('🔗 Connected to LAIKA server');
                    this.updateStatus('behaviorStatus', true, 'Connected');
                });
                
                this.socket.on('disconnect', () => {
                    this.isConnected = false;
                    this.log('🔌 Disconnected from server');
                    this.updateStatus('behaviorStatus', false, 'Disconnected');
                });
                
                this.socket.on('pipeline_status', (data) => {
                    this.updatePipelineStatus(data);
                });
                
                this.socket.on('behavior_event', (data) => {
                    this.handleBehaviorEvent(data);
                });
                
                // Real-time behavior tree monitoring
                this.socket.on('behavior_tree_status', (data) => {
                    this.updateGroot2Visualization(data);
                });
                
                this.socket.on('node_status_update', (data) => {
                    this.updateNodeStatus(data);
                });
                
            } else {
                this.log('⚠️ SocketIO not available - using fallback');
            }
        } catch (error) {
            this.log(`❌ Connection error: ${error}`, 'error');
        }
    }
    
    updatePipelineStatus(data) {
        // Update pipeline status indicators
        if (data.stt) {
            this.updateStatus('sttStatus', data.stt.active, data.stt.status);
        }
        if (data.llm) {
            this.updateStatus('llmStatus', data.llm.active, data.llm.status);
        }
        if (data.act) {
            this.updateStatus('actStatus', data.act.active, data.act.status);
        }
        if (data.tts) {
            this.updateStatus('ttsStatus', data.tts.active, data.tts.status);
        }
    }
    
    handleBehaviorEvent(data) {
        const eventType = data.type;
        const message = data.message;
        
        switch (eventType) {
            case 'behavior_started':
                this.log(`🌳 Behavior started: ${message}`, 'behavior');
                break;
            case 'behavior_completed':
                this.log(`✅ Behavior completed: ${message}`, 'behavior');
                break;
            case 'behavior_failed':
                this.log(`❌ Behavior failed: ${message}`, 'error');
                break;
            case 'injection':
                this.log(`💉 Behavior injection: ${message}`, 'behavior');
                break;
            default:
                this.log(`📋 Behavior event: ${message}`);
        }
    }
    
    updateStatus(elementId, isActive, status) {
        const element = document.getElementById(elementId);
        if (element) {
            const statusElement = element.querySelector('p');
            if (statusElement) {
                statusElement.textContent = status;
            }
            
            if (isActive) {
                element.classList.add('active');
            } else {
                element.classList.remove('active');
            }
        }
    }
    
    startBehaviorTree() {
        if (!this.isConnected) {
            this.log('❌ Not connected to server', 'error');
            return;
        }
        
        this.behaviorTreeActive = true;
        this.log('🌳 Starting behavior tree...');
        
        // Send start command to server
        if (this.socket) {
            this.socket.emit('start_behavior_tree', {
                xml: this.xmlContent
            });
        }
        
        this.updateStatus('behaviorStatus', true, 'Active');
    }
    
    stopBehaviorTree() {
        this.behaviorTreeActive = false;
        this.log('🛑 Stopping behavior tree...');
        
        // Send stop command to server
        if (this.socket) {
            this.socket.emit('stop_behavior_tree');
        }
        
        this.updateStatus('behaviorStatus', false, 'Stopped');
    }
    
    loadBehaviorTree() {
        // Create file input for loading XML
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xml';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target.result;
                    document.getElementById('xmlEditor').value = content;
                    this.xmlContent = content;
                    this.log(`📂 Loaded behavior tree: ${file.name}`);
                };
                reader.readAsText(file);
            }
        };
        
        input.click();
    }
    
    saveBehaviorTree() {
        // Create download link for XML
        const blob = new Blob([this.xmlContent], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'laika_behavior_tree.xml';
        a.click();
        URL.revokeObjectURL(url);
        
        this.log('💾 Behavior tree saved');
    }
    
    exportToGroot2() {
        // Export XML to Groot2 format
        const groot2XML = this.convertToGroot2Format(this.xmlContent);
        
        // Create download link
        const blob = new Blob([groot2XML], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'laika_behavior_tree_groot2.xml';
        a.click();
        URL.revokeObjectURL(url);
        
        this.log('📤 Exported to Groot2 format');
        
        // Open Groot2 if available
        this.openGroot2(groot2XML);
    }
    
    importFromGroot2() {
        // Create file input for importing from Groot2
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xml';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const content = e.target.result;
                    const convertedXML = this.convertFromGroot2Format(content);
                    document.getElementById('xmlEditor').value = convertedXML;
                    this.xmlContent = convertedXML;
                    this.log(`📥 Imported from Groot2: ${file.name}`);
                };
                reader.readAsText(file);
            }
        };
        
        input.click();
    }
    
    convertToGroot2Format(xml) {
        // Convert our XML format to Groot2 format
        // This is a simplified conversion - in practice, you'd need more sophisticated XML parsing
        return xml.replace(/<BehaviorTree/g, '<BehaviorTree xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"')
                  .replace(/<Action ID=/g, '<Action ID=')
                  .replace(/<Condition ID=/g, '<Condition ID=');
    }
    
    convertFromGroot2Format(xml) {
        // Convert Groot2 format to our format
        return xml.replace(/xmlns:xsi="[^"]*"/g, '')
                  .replace(/xsi:schemaLocation="[^"]*"/g, '');
    }
    
    openGroot2(xmlContent) {
        // Try to open Groot2 application
        // This would typically involve launching the Groot2 application
        // For now, we'll just show a message
        this.log('🎨 Groot2 export ready - open Groot2 application to load the file');
        
        // Optionally, try to launch Groot2 via protocol handler
        try {
            window.open(`groot2://open?file=${encodeURIComponent(xmlContent)}`);
        } catch (e) {
            this.log('⚠️ Could not launch Groot2 automatically');
        }
    }
    
    updateGroot2Visualization(data) {
        // Update Groot2 visualization with real-time data
        const { treeStatus, activeNodes, nodeStates } = data;
        
        // Update the Groot2 container with real-time visualization
        const groot2Container = document.querySelector('.groot2-container');
        if (groot2Container) {
            this.renderRealTimeTree(groot2Container, treeStatus, activeNodes, nodeStates);
        }
        
        this.log(`🌳 Tree status: ${treeStatus}`, 'behavior');
    }
    
    updateNodeStatus(data) {
        // Update individual node status
        const { nodeId, status, result, timestamp } = data;
        
        // Update node visualization
        this.updateNodeVisualization(nodeId, status, result);
        
        this.log(`📊 Node ${nodeId}: ${status} (${result})`, 'behavior');
    }
    
    renderRealTimeTree(container, treeStatus, activeNodes, nodeStates) {
        // Create real-time tree visualization
        container.innerHTML = `
            <div style="padding: 20px; color: #00ff41;">
                <h3>🌳 Real-time Behavior Tree</h3>
                <div style="margin-bottom: 10px;">
                    <strong>Status:</strong> <span style="color: ${treeStatus === 'running' ? '#00ff41' : '#ff0040'}">${treeStatus}</span>
                </div>
                <div style="margin-bottom: 10px;">
                    <strong>Active Nodes:</strong> ${activeNodes.length}
                </div>
                <div style="max-height: 400px; overflow-y: auto;">
                    ${this.renderNodeStates(nodeStates)}
                </div>
            </div>
        `;
    }
    
    renderNodeStates(nodeStates) {
        return nodeStates.map(node => {
            const statusColor = this.getStatusColor(node.status);
            const resultColor = this.getResultColor(node.result);
            
            return `
                <div style="margin: 5px 0; padding: 5px; border-left: 3px solid ${statusColor}; background: rgba(0,255,65,0.1);">
                    <strong>${node.id}</strong>
                    <span style="color: ${statusColor};">[${node.status}]</span>
                    <span style="color: ${resultColor};">(${node.result})</span>
                    ${node.message ? `<br><small>${node.message}</small>` : ''}
                </div>
            `;
        }).join('');
    }
    
    getStatusColor(status) {
        switch (status) {
            case 'running': return '#00ff41';
            case 'success': return '#00ff41';
            case 'failure': return '#ff0040';
            case 'idle': return '#ffaa00';
            default: return '#666';
        }
    }
    
    getResultColor(result) {
        switch (result) {
            case 'SUCCESS': return '#00ff41';
            case 'FAILURE': return '#ff0040';
            case 'RUNNING': return '#00aaff';
            default: return '#666';
        }
    }
    
    updateNodeVisualization(nodeId, status, result) {
        // Update specific node in the visualization
        const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (nodeElement) {
            const statusColor = this.getStatusColor(status);
            const resultColor = this.getResultColor(result);
            
            nodeElement.style.borderLeftColor = statusColor;
            nodeElement.querySelector('.node-status').style.color = statusColor;
            nodeElement.querySelector('.node-result').style.color = resultColor;
        }
    }
    
    startRealTimeMonitoring() {
        // Start real-time monitoring with Groot2
        this.log('📡 Starting real-time behavior tree monitoring...');
        
        if (this.socket) {
            this.socket.emit('start_real_time_monitoring', {
                enabled: true,
                updateInterval: 100 // 100ms updates
            });
        }
        
        // Update Groot2 container to show real-time mode
        const groot2Container = document.querySelector('.groot2-container');
        if (groot2Container) {
            groot2Container.innerHTML = `
                <div style="padding: 20px; color: #00ff41; text-align: center;">
                    <h3>🌳 Real-time Monitoring Active</h3>
                    <p>Behavior tree execution is being monitored in real-time</p>
                    <div style="margin: 20px 0;">
                        <div class="status-indicator status-active"></div>
                        <span>Live updates enabled</span>
                    </div>
                    <p><small>Node status and execution flow will appear here</small></p>
                </div>
            `;
        }
    }
    
    stopRealTimeMonitoring() {
        // Stop real-time monitoring
        this.log('📡 Stopping real-time behavior tree monitoring...');
        
        if (this.socket) {
            this.socket.emit('start_real_time_monitoring', {
                enabled: false
            });
        }
        
        // Reset Groot2 container
        const groot2Container = document.querySelector('.groot2-container');
        if (groot2Container) {
            groot2Container.innerHTML = `
                <div class="groot2-placeholder">
                    <div>
                        <h3>🌳 Groot2 Integration</h3>
                        <p>Visual behavior tree editor</p>
                        <p>Click "Export to Groot2" to open in Groot2</p>
                        <p>Or use the XML editor above</p>
                    </div>
                </div>
            `;
        }
    }
    
    triggerBehavior(behaviorName) {
        if (!this.isConnected) {
            this.log('❌ Not connected to server', 'error');
            return;
        }
        
        this.log(`🎯 Triggering behavior: ${behaviorName}`);
        
        // Send behavior trigger to server
        if (this.socket) {
            this.socket.emit('trigger_behavior', {
                behavior: behaviorName,
                timestamp: Date.now()
            });
        }
    }
    
    autoSaveXML() {
        // Auto-save XML to localStorage
        try {
            localStorage.setItem('laika_behavior_tree_xml', this.xmlContent);
            this.log('💾 Auto-saved XML to localStorage');
        } catch (e) {
            this.log('⚠️ Could not auto-save XML', 'warning');
        }
    }
    
    loadAutoSavedXML() {
        // Load auto-saved XML from localStorage
        try {
            const saved = localStorage.getItem('laika_behavior_tree_xml');
            if (saved) {
                document.getElementById('xmlEditor').value = saved;
                this.xmlContent = saved;
                this.log('📂 Loaded auto-saved XML');
            }
        } catch (e) {
            this.log('⚠️ Could not load auto-saved XML', 'warning');
        }
    }
    
    clearLog() {
        const logArea = document.getElementById('logArea');
        logArea.innerHTML = '<div class="log-entry log-info">🗑️ Log cleared</div>';
    }
    
    log(message, type = 'info') {
        const logArea = document.getElementById('logArea');
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        logArea.appendChild(logEntry);
        logArea.scrollTop = logArea.scrollHeight;
        
        // Keep only last 100 log entries
        const entries = logArea.querySelectorAll('.log-entry');
        if (entries.length > 100) {
            entries[0].remove();
        }
    }
}

// Global functions for button clicks
let behaviorEditor;

function startBehaviorTree() {
    if (behaviorEditor) {
        behaviorEditor.startBehaviorTree();
    }
}

function stopBehaviorTree() {
    if (behaviorEditor) {
        behaviorEditor.stopBehaviorTree();
    }
}

function loadBehaviorTree() {
    if (behaviorEditor) {
        behaviorEditor.loadBehaviorTree();
    }
}

function saveBehaviorTree() {
    if (behaviorEditor) {
        behaviorEditor.saveBehaviorTree();
    }
}

function exportToGroot2() {
    if (behaviorEditor) {
        behaviorEditor.exportToGroot2();
    }
}

function importFromGroot2() {
    if (behaviorEditor) {
        behaviorEditor.importFromGroot2();
    }
}

function triggerBehavior(behaviorName) {
    if (behaviorEditor) {
        behaviorEditor.triggerBehavior(behaviorName);
    }
}

function clearLog() {
    if (behaviorEditor) {
        behaviorEditor.clearLog();
    }
}

function startRealTimeMonitoring() {
    if (behaviorEditor) {
        behaviorEditor.startRealTimeMonitoring();
    }
}

function stopRealTimeMonitoring() {
    if (behaviorEditor) {
        behaviorEditor.stopRealTimeMonitoring();
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('🌳 Initializing LAIKA Behavior Tree Editor...');
    behaviorEditor = new BehaviorTreeEditor();
    
    // Load auto-saved XML
    setTimeout(() => {
        behaviorEditor.loadAutoSavedXML();
    }, 1000);
});
