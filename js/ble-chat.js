/**
 * LAIKA BLE Chat Interface
 * Enables conversational chat with LAIKA via Bluetooth Low Energy
 */

class LAIKABLEChat {
    constructor() {
        this.device = null;
        this.server = null;
        this.chatService = null;
        this.messageCharacteristic = null;
        this.responseCharacteristic = null;
        this.historyCharacteristic = null;
        this.isConnected = false;
        this.conversationHistory = [];
        
        // BLE UUIDs for LAIKA Chat Service
        this.CHAT_SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
        this.CHAT_MESSAGE_CHAR_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';
        this.CHAT_RESPONSE_CHAR_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';
        this.CHAT_HISTORY_CHAR_UUID = '0000fff4-0000-1000-8000-00805f9b34fb';
        
        // Event handlers
        this.onMessageReceived = null;
        this.onConnectionChanged = null;
        this.onError = null;
        
        console.log('LAIKA BLE Chat initialized');
    }
    
    async scanForChatService() {
        try {
            console.log('🔍 Scanning for LAIKA Chat service...');
            
            if (!navigator.bluetooth) {
                throw new Error('Web Bluetooth not supported');
            }
            
            // Request device with chat service
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { namePrefix: 'LAIKA' },
                    { services: [this.CHAT_SERVICE_UUID] }
                ],
                optionalServices: [this.CHAT_SERVICE_UUID]
            });
            
            console.log('📱 Found LAIKA chat device:', this.device.name);
            
            // Add disconnect listener
            this.device.addEventListener('gattserverdisconnected', () => {
                console.log('📵 LAIKA chat disconnected');
                this.handleDisconnection();
            });
            
            return this.device;
            
        } catch (error) {
            console.error('❌ BLE chat scan failed:', error);
            if (this.onError) this.onError(error);
            throw error;
        }
    }
    
    async connectToChatService() {
        try {
            if (!this.device) {
                throw new Error('No device selected');
            }
            
            console.log('🔗 Connecting to LAIKA chat service...');
            
            // Connect to GATT server
            this.server = await this.device.gatt.connect();
            console.log('✅ Connected to GATT server');
            
            // Get chat service
            this.chatService = await this.server.getPrimaryService(this.CHAT_SERVICE_UUID);
            console.log('✅ Found chat service');
            
            // Get characteristics
            this.messageCharacteristic = await this.chatService.getCharacteristic(this.CHAT_MESSAGE_CHAR_UUID);
            this.responseCharacteristic = await this.chatService.getCharacteristic(this.CHAT_RESPONSE_CHAR_UUID);
            
            try {
                this.historyCharacteristic = await this.chatService.getCharacteristic(this.CHAT_HISTORY_CHAR_UUID);
            } catch (e) {
                console.log('History characteristic not available');
            }
            
            // Set up response notifications
            await this.responseCharacteristic.startNotifications();
            this.responseCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
                this.handleResponseReceived(event);
            });
            
            this.isConnected = true;
            console.log('✅ LAIKA BLE chat connected');
            
            if (this.onConnectionChanged) {
                this.onConnectionChanged(true);
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ BLE chat connection failed:', error);
            if (this.onError) this.onError(error);
            throw error;
        }
    }
    
    async sendMessage(message) {
        try {
            if (!this.isConnected || !this.messageCharacteristic) {
                throw new Error('Not connected to LAIKA chat service');
            }
            
            console.log(`💬 Sending message: "${message}"`);
            
            // Convert message to bytes
            const encoder = new TextEncoder();
            const messageBytes = encoder.encode(message);
            
            // Send message via BLE
            await this.messageCharacteristic.writeValue(messageBytes);
            
            // Add to local conversation history
            this.conversationHistory.push({
                timestamp: new Date().toISOString(),
                type: 'user',
                message: message
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to send message:', error);
            if (this.onError) this.onError(error);
            throw error;
        }
    }
    
    handleResponseReceived(event) {
        try {
            const decoder = new TextDecoder();
            const response = decoder.decode(event.target.value);
            
            console.log(`🤖 LAIKA response: "${response}"`);
            
            // Add to conversation history
            this.conversationHistory.push({
                timestamp: new Date().toISOString(),
                type: 'laika',
                message: response
            });
            
            // Trigger callback
            if (this.onMessageReceived) {
                this.onMessageReceived({
                    type: 'response',
                    message: response,
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (error) {
            console.error('❌ Error handling response:', error);
            if (this.onError) this.onError(error);
        }
    }
    
    async getConversationHistory() {
        try {
            if (this.historyCharacteristic) {
                const historyData = await this.historyCharacteristic.readValue();
                const decoder = new TextDecoder();
                const historyJson = decoder.decode(historyData);
                return JSON.parse(historyJson);
            }
            
            // Return local history if remote not available
            return this.conversationHistory;
            
        } catch (error) {
            console.error('❌ Failed to get history:', error);
            return this.conversationHistory;
        }
    }
    
    handleDisconnection() {
        this.isConnected = false;
        this.device = null;
        this.server = null;
        this.chatService = null;
        this.messageCharacteristic = null;
        this.responseCharacteristic = null;
        this.historyCharacteristic = null;
        
        if (this.onConnectionChanged) {
            this.onConnectionChanged(false);
        }
    }
    
    async disconnect() {
        try {
            if (this.server) {
                await this.server.disconnect();
            }
            this.handleDisconnection();
            console.log('📵 Disconnected from LAIKA chat');
        } catch (error) {
            console.error('❌ Disconnect error:', error);
        }
    }
    
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            deviceName: this.device ? this.device.name : null,
            conversationCount: this.conversationHistory.length
        };
    }
    
    clearConversationHistory() {
        this.conversationHistory = [];
        console.log('🗑️ Conversation history cleared');
    }
}

// Export for use in other modules
window.LAIKABLEChat = LAIKABLEChat;
