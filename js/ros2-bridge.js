/**
 * ROS2 Bridge for LAIKA STT Integration
 * Provides WebSocket connection to ROS2 nodes for STT functionality
 */

class ROS2Bridge {
    constructor() {
        this.connected = false;
        this.ws = null;
        this.subscriptions = new Map();
        this.parameterCache = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        
        // ROS2 WebSocket server URL (adjust as needed)
        this.wsUrl = 'ws://localhost:9090'; // Default rosbridge_server port
        
        this.init();
    }
    
    async init() {
        try {
            await this.connect();
            this.setupEventHandlers();
        } catch (error) {
            console.error('Failed to initialize ROS2 bridge:', error);
        }
    }
    
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.wsUrl);
                
                this.ws.onopen = () => {
                    console.log('✅ Connected to ROS2 bridge');
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    resolve();
                };
                
                this.ws.onclose = () => {
                    console.log('❌ Disconnected from ROS2 bridge');
                    this.connected = false;
                    this.handleReconnect();
                };
                
                this.ws.onerror = (error) => {
                    console.error('ROS2 bridge connection error:', error);
                    reject(error);
                };
                
                this.ws.onmessage = (event) => {
                    this.handleMessage(JSON.parse(event.data));
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect to ROS2 bridge (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
                this.connect().catch(error => {
                    console.error('Reconnection failed:', error);
                });
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }
    
    setupEventHandlers() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page hidden - could disconnect to save resources
            } else {
                // Page visible - ensure connection
                if (!this.connected) {
                    this.connect();
                }
            }
        });
        
        // Handle page unload
        window.addEventListener('beforeunload', () => {
            if (this.ws) {
                this.ws.close();
            }
        });
    }
    
    handleMessage(data) {
        try {
            if (data.op === 'publish') {
                // Handle published messages
                const topic = data.topic;
                const msg = data.msg;
                
                if (this.subscriptions.has(topic)) {
                    const callback = this.subscriptions.get(topic);
                    callback(msg);
                }
            } else if (data.op === 'service_response') {
                // Handle service responses
                console.log('Service response:', data);
            } else if (data.op === 'set_parameter_response') {
                // Handle parameter set responses
                console.log('Parameter set response:', data);
            } else if (data.op === 'get_parameter_response') {
                // Handle parameter get responses
                console.log('Parameter get response:', data);
            }
        } catch (error) {
            console.error('Error handling ROS2 message:', error);
        }
    }
    
    sendMessage(message) {
        if (this.connected && this.ws) {
            this.ws.send(JSON.stringify(message));
        } else {
            throw new Error('ROS2 bridge not connected');
        }
    }
    
    // Subscribe to a ROS2 topic
    subscribe(topic, messageType, callback) {
        const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const message = {
            op: 'subscribe',
            id: subscriptionId,
            topic: topic,
            type: messageType
        };
        
        this.sendMessage(message);
        this.subscriptions.set(topic, callback);
        
        return subscriptionId;
    }
    
    // Unsubscribe from a ROS2 topic
    unsubscribe(subscriptionId) {
        const message = {
            op: 'unsubscribe',
            id: subscriptionId
        };
        
        this.sendMessage(message);
    }
    
    // Get a ROS2 parameter
    async getParameter(nodeName, parameterName) {
        return new Promise((resolve, reject) => {
            const requestId = `get_param_${Date.now()}`;
            
            const message = {
                op: 'get_parameter',
                id: requestId,
                node: nodeName,
                name: parameterName
            };
            
            // Set up response handler
            const originalHandler = this.ws.onmessage;
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.op === 'get_parameter_response' && data.id === requestId) {
                    this.ws.onmessage = originalHandler;
                    resolve(data.value);
                }
            };
            
            this.sendMessage(message);
            
            // Timeout after 5 seconds
            setTimeout(() => {
                this.ws.onmessage = originalHandler;
                reject(new Error('Parameter get timeout'));
            }, 5000);
        });
    }
    
    // Set a ROS2 parameter
    async setParameter(nodeName, parameterName, value) {
        return new Promise((resolve, reject) => {
            const requestId = `set_param_${Date.now()}`;
            
            const message = {
                op: 'set_parameter',
                id: requestId,
                node: nodeName,
                name: parameterName,
                value: value
            };
            
            // Set up response handler
            const originalHandler = this.ws.onmessage;
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.op === 'set_parameter_response' && data.id === requestId) {
                    this.ws.onmessage = originalHandler;
                    resolve(data.result);
                }
            };
            
            this.sendMessage(message);
            
            // Timeout after 5 seconds
            setTimeout(() => {
                this.ws.onmessage = originalHandler;
                reject(new Error('Parameter set timeout'));
            }, 5000);
        });
    }
    
    // Publish to a ROS2 topic
    publish(topic, messageType, message) {
        const messageId = `pub_${Date.now()}`;
        
        const data = {
            op: 'publish',
            id: messageId,
            topic: topic,
            type: messageType,
            msg: message
        };
        
        this.sendMessage(data);
    }
    
    // Call a ROS2 service
    async callService(serviceName, serviceType, request) {
        return new Promise((resolve, reject) => {
            const requestId = `srv_${Date.now()}`;
            
            const message = {
                op: 'call_service',
                id: requestId,
                service: serviceName,
                type: serviceType,
                args: request
            };
            
            // Set up response handler
            const originalHandler = this.ws.onmessage;
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.op === 'service_response' && data.id === requestId) {
                    this.ws.onmessage = originalHandler;
                    resolve(data.values);
                }
            };
            
            this.sendMessage(message);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                this.ws.onmessage = originalHandler;
                reject(new Error('Service call timeout'));
            }, 10000);
        });
    }
    
    // Check if bridge is available
    isAvailable() {
        return this.connected;
    }
    
    // Get connection status
    getStatus() {
        return {
            connected: this.connected,
            reconnectAttempts: this.reconnectAttempts,
            subscriptions: this.subscriptions.size
        };
    }
}

// Initialize ROS2 bridge when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Create global ROS2 bridge instance
    window.ros2Bridge = new ROS2Bridge();
    
    // Add status indicator to page
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'ros2-status';
    statusIndicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 5px 10px;
        border-radius: 5px;
        font-size: 12px;
        font-weight: bold;
        z-index: 1000;
        background: rgba(0, 0, 0, 0.8);
        color: #ff4444;
        border: 1px solid #ff4444;
    `;
    statusIndicator.textContent = 'ROS2: Disconnected';
    document.body.appendChild(statusIndicator);
    
    // Update status periodically
    setInterval(() => {
        if (window.ros2Bridge) {
            const status = window.ros2Bridge.getStatus();
            const indicator = document.getElementById('ros2-status');
            
            if (status.connected) {
                indicator.style.background = 'rgba(0, 0, 0, 0.8)';
                indicator.style.color = '#00ff00';
                indicator.style.borderColor = '#00ff00';
                indicator.textContent = `ROS2: Connected (${status.subscriptions} subs)`;
            } else {
                indicator.style.background = 'rgba(0, 0, 0, 0.8)';
                indicator.style.color = '#ff4444';
                indicator.style.borderColor = '#ff4444';
                indicator.textContent = `ROS2: Disconnected (${status.reconnectAttempts}/${window.ros2Bridge.maxReconnectAttempts})`;
            }
        }
    }, 1000);
});
