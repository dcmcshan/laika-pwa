/**
 * LAIKA WebRTC Connection Manager
 * Handles peer-to-peer connections with NAT traversal using STUN/TURN
 */

class LAIKAWebRTCConnection {
    constructor() {
        this.socket = null;
        this.peerConnection = null;
        this.dataChannel = null;
        this.isConnected = false;
        this.clientId = this.generateClientId();
        this.currentRoomId = null;
        this.iceServers = [];
        
        // Configuration - Cloud signaling servers with fallback
        this.signalingServers = [
            // Primary: Cloud signaling server for worldwide access
            'wss://srv-d2i8v5jipnbc738sta8g.onrender.com/socket.io/',
            
            // Fallback: Local network signaling server
            'ws://192.168.86.29:9999/socket.io/',
            
            // Fallback: localhost for development
            'ws://localhost:9999/socket.io/'
        ];
        this.currentSignalingServerIndex = 0;
        this.connectionTimeout = 30000; // 30 seconds
        
        // Event handlers
        this.onDeviceDiscovered = null;
        this.onConnectionEstablished = null;
        this.onConnectionLost = null;
        this.onDataReceived = null;
        this.onError = null;
        
        // State
        this.availableDevices = new Map();
        this.connectionState = 'disconnected';
        
        console.log('WebRTC Connection Manager initialized', this.clientId);
    }
    
    generateClientId() {
        return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }
    
    async initialize() {
        try {
            console.log('🌐 Initializing WebRTC connection...');
            await this.connectToSignalingServer();
            return true;
        } catch (error) {
            console.error('WebRTC initialization failed:', error);
            if (this.onError) this.onError(error);
            return false;
        }
    }
    
    connectToSignalingServer() {
        return new Promise((resolve, reject) => {
            this.tryNextSignalingServer(resolve, reject);
        });
    }
    
    tryNextSignalingServer(resolve, reject) {
        if (this.currentSignalingServerIndex >= this.signalingServers.length) {
            reject(new Error('All signaling servers failed'));
            return;
        }
        
        const serverUrl = this.signalingServers[this.currentSignalingServerIndex];
        console.log(`🔄 Trying signaling server ${this.currentSignalingServerIndex + 1}/${this.signalingServers.length}: ${serverUrl}`);
        
        try {
            // Use Socket.IO for signaling
            this.socket = io(serverUrl.replace('/socket.io/', ''), {
                transports: ['websocket', 'polling'],
                timeout: 10000
            });
            
            // Set connection timeout
            const connectionTimeout = setTimeout(() => {
                if (this.socket) {
                    this.socket.disconnect();
                    console.warn(`⏰ Timeout connecting to ${serverUrl}, trying next...`);
                    this.currentSignalingServerIndex++;
                    this.tryNextSignalingServer(resolve, reject);
                }
            }, 10000);
            
            this.socket.on('connect', () => {
                clearTimeout(connectionTimeout);
                console.log(`✅ Connected to signaling server: ${serverUrl}`);
                this.registerClient();
                resolve();
            });
            
            this.socket.on('connect_error', (error) => {
                clearTimeout(connectionTimeout);
                console.warn(`❌ Failed to connect to ${serverUrl}:`, error.message);
                this.currentSignalingServerIndex++;
                this.tryNextSignalingServer(resolve, reject);
            });
            
            this.socket.on('connected', (data) => {
                    console.log('Signaling server ready:', data.sid);
                    this.iceServers = data.ice_servers || [];
                    resolve();
                });
                
                this.socket.on('registration_success', (data) => {
                    console.log('Client registration successful:', data.client_id);
                    this.clientId = data.client_id;
                    this.iceServers = data.ice_servers || [];
                    this.updateAvailableDevices(data.available_devices || []);
                });
                
                this.socket.on('device_online', (data) => {
                    console.log('Device came online:', data.device_id);
                    this.availableDevices.set(data.device_id, {
                        ...data.device_info,
                        device_id: data.device_id,
                        connection_type: data.connection_type,
                        online: true
                    });
                    if (this.onDeviceDiscovered) {
                        this.onDeviceDiscovered(this.availableDevices.get(data.device_id));
                    }
                });
                
                this.socket.on('device_offline', (data) => {
                    console.log('Device went offline:', data.device_id);
                    if (this.availableDevices.has(data.device_id)) {
                        this.availableDevices.delete(data.device_id);
                    }
                });
                
                this.socket.on('connection_request_sent', (data) => {
                    console.log('Connection request sent to device:', data.device_id);
                    this.currentRoomId = data.room_id;
                    this.iceServers = data.ice_servers || this.iceServers;
                    this.setupWebRTCConnection();
                });
                
                this.socket.on('webrtc_offer', (data) => {
                    console.log('Received WebRTC offer');
                    this.handleWebRTCOffer(data.offer);
                });
                
                this.socket.on('webrtc_answer', (data) => {
                    console.log('Received WebRTC answer');
                    this.handleWebRTCAnswer(data.answer);
                });
                
                this.socket.on('ice_candidate', (data) => {
                    console.log('Received ICE candidate');
                    this.handleICECandidate(data.candidate);
                });
                
                this.socket.on('connection_success', (data) => {
                    console.log('✅ WebRTC connection established');
                    this.connectionState = 'connected';
                    this.isConnected = true;
                    if (this.onConnectionEstablished) {
                        this.onConnectionEstablished();
                    }
                });
                
                this.socket.on('error', (data) => {
                    console.error('Signaling error:', data.message);
                    if (this.onError) this.onError(new Error(data.message));
                });
                
                this.socket.on('disconnect', () => {
                    console.log('Disconnected from signaling server');
                    this.handleDisconnection();
                });
                
                // Connection timeout
                setTimeout(() => {
                    if (!this.socket.connected) {
                        reject(new Error('Signaling server connection timeout'));
                    }
                }, 10000);
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    registerClient() {
        if (this.socket && this.socket.connected) {
            this.socket.emit('register_client', {
                client_id: this.clientId,
                client_info: {
                    type: 'pwa_client',
                    user_agent: navigator.userAgent,
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
    
    updateAvailableDevices(devices) {
        this.availableDevices.clear();
        devices.forEach(deviceId => {
            this.availableDevices.set(deviceId, {
                device_id: deviceId,
                online: true,
                connection_type: 'webrtc'
            });
        });
    }
    
    async connectToDevice(deviceId) {
        try {
            console.log(`🔗 Connecting to device: ${deviceId}`);
            
            if (!this.socket || !this.socket.connected) {
                throw new Error('Not connected to signaling server');
            }
            
            if (!this.availableDevices.has(deviceId)) {
                throw new Error('Device not available');
            }
            
            this.connectionState = 'connecting';
            
            // Request connection through signaling server
            this.socket.emit('request_connection', {
                device_id: deviceId,
                client_id: this.clientId
            });
            
            return true;
            
        } catch (error) {
            console.error('Connection request failed:', error);
            if (this.onError) this.onError(error);
            return false;
        }
    }
    
    setupWebRTCConnection() {
        try {
            console.log('🔧 Setting up WebRTC connection...');
            
            // Create peer connection with ICE servers
            const config = {
                iceServers: this.iceServers,
                iceCandidatePoolSize: 10
            };
            
            this.peerConnection = new RTCPeerConnection(config);
            
            // Create data channel
            this.dataChannel = this.peerConnection.createDataChannel('laika-control', {
                ordered: true
            });
            
            this.setupDataChannel(this.dataChannel);
            
            // Handle incoming data channel
            this.peerConnection.ondatachannel = (event) => {
                console.log('Received data channel');
                this.setupDataChannel(event.channel);
            };
            
            // Handle ICE candidates
            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate && this.currentRoomId) {
                    console.log('Sending ICE candidate');
                    this.socket.emit('ice_candidate', {
                        room_id: this.currentRoomId,
                        candidate: event.candidate
                    });
                }
            };
            
            // Handle connection state changes
            this.peerConnection.onconnectionstatechange = () => {
                console.log('Connection state:', this.peerConnection.connectionState);
                
                if (this.peerConnection.connectionState === 'connected') {
                    this.isConnected = true;
                    this.connectionState = 'connected';
                    this.socket.emit('connection_established', {
                        room_id: this.currentRoomId
                    });
                } else if (this.peerConnection.connectionState === 'failed' || 
                          this.peerConnection.connectionState === 'disconnected') {
                    this.handleDisconnection();
                }
            };
            
            // Create and send offer
            this.createOffer();
            
        } catch (error) {
            console.error('WebRTC setup failed:', error);
            if (this.onError) this.onError(error);
        }
    }
    
    async createOffer() {
        try {
            console.log('Creating WebRTC offer...');
            
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
            });
            
            await this.peerConnection.setLocalDescription(offer);
            
            // Send offer through signaling server
            this.socket.emit('webrtc_offer', {
                room_id: this.currentRoomId,
                offer: offer
            });
            
        } catch (error) {
            console.error('Failed to create offer:', error);
            if (this.onError) this.onError(error);
        }
    }
    
    async handleWebRTCOffer(offer) {
        try {
            console.log('Handling WebRTC offer...');
            
            if (!this.peerConnection) {
                this.setupWebRTCConnection();
            }
            
            await this.peerConnection.setRemoteDescription(offer);
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            // Send answer through signaling server
            this.socket.emit('webrtc_answer', {
                room_id: this.currentRoomId,
                answer: answer
            });
            
        } catch (error) {
            console.error('Failed to handle offer:', error);
            if (this.onError) this.onError(error);
        }
    }
    
    async handleWebRTCAnswer(answer) {
        try {
            console.log('Handling WebRTC answer...');
            await this.peerConnection.setRemoteDescription(answer);
        } catch (error) {
            console.error('Failed to handle answer:', error);
            if (this.onError) this.onError(error);
        }
    }
    
    async handleICECandidate(candidate) {
        try {
            if (this.peerConnection) {
                await this.peerConnection.addIceCandidate(candidate);
            }
        } catch (error) {
            console.error('Failed to add ICE candidate:', error);
        }
    }
    
    setupDataChannel(channel) {
        channel.onopen = () => {
            console.log('✅ Data channel opened');
            this.dataChannel = channel;
            this.isConnected = true;
        };
        
        channel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Received data:', data);
                if (this.onDataReceived) {
                    this.onDataReceived(data);
                }
            } catch (error) {
                console.error('Failed to parse received data:', error);
            }
        };
        
        channel.onclose = () => {
            console.log('Data channel closed');
            this.handleDisconnection();
        };
        
        channel.onerror = (error) => {
            console.error('Data channel error:', error);
            if (this.onError) this.onError(error);
        };
    }
    
    sendCommand(command, params = {}) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected || !this.dataChannel || this.dataChannel.readyState !== 'open') {
                reject(new Error('Not connected to device'));
                return;
            }
            
            try {
                const message = {
                    type: 'command',
                    command: command,
                    params: params,
                    timestamp: new Date().toISOString(),
                    id: Math.random().toString(36).substr(2, 9)
                };
                
                this.dataChannel.send(JSON.stringify(message));
                console.log('Sent command:', command);
                resolve({ success: true, command: command });
                
            } catch (error) {
                console.error('Failed to send command:', error);
                reject(error);
            }
        });
    }
    
    getAvailableDevices() {
        return Array.from(this.availableDevices.values());
    }
    
    isDeviceAvailable(deviceId) {
        return this.availableDevices.has(deviceId) && this.availableDevices.get(deviceId).online;
    }
    
    handleDisconnection() {
        this.isConnected = false;
        this.connectionState = 'disconnected';
        this.currentRoomId = null;
        
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.onConnectionLost) {
            this.onConnectionLost();
        }
        
        console.log('WebRTC connection closed');
    }
    
    disconnect() {
        this.handleDisconnection();
        
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        
        console.log('Disconnected from WebRTC system');
    }
    
    getConnectionInfo() {
        return {
            clientId: this.clientId,
            isConnected: this.isConnected,
            connectionState: this.connectionState,
            availableDevices: this.getAvailableDevices(),
            iceServers: this.iceServers,
            currentRoomId: this.currentRoomId
        };
    }
}

// Export for use in other modules
window.LAIKAWebRTCConnection = LAIKAWebRTCConnection;


