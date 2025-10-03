// WebSocket client for real-time updates

class WebSocketManager {
    constructor() {
        this.socket = null;
        this.reconnectInterval = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.isConnected = false;
    }

    /**
     * Initialize WebSocket connection
     */
    init() {
        this.connect();
        console.log('WebSocket manager initialized');
    }

    /**
     * Connect to WebSocket server
     */
    connect() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws`;
            
            this.socket = new WebSocket(wsUrl);
            
            this.socket.onopen = () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
                // Subscribe to updates
                this.subscribe(['weather', 'dispersion', 'receptors']);
                
                // Clear reconnection interval
                if (this.reconnectInterval) {
                    clearInterval(this.reconnectInterval);
                    this.reconnectInterval = null;
                }
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(event);
            };

            this.socket.onclose = () => {
                console.log('WebSocket disconnected');
                this.isConnected = false;
                this.attemptReconnect();
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
            };

        } catch (error) {
            console.error('Error connecting to WebSocket:', error);
            this.attemptReconnect();
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);

            switch (data.type) {
                case 'weather_update':
                    this.handleWeatherUpdate(data.payload);
                    break;
                    
                case 'dispersion_update':
                    this.handleDispersionUpdate(data.payload);
                    break;
                    
                case 'receptor_impact':
                    this.handleReceptorImpact(data.payload);
                    break;
                    
                case 'system_status':
                    this.handleSystemStatus(data.payload);
                    break;
                    
                default:
                    console.log('Unknown message type:', data.type);
            }

        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    /**
     * Handle weather updates
     */
    handleWeatherUpdate(weather) {
        console.log('Weather update received:', weather);
        
        // Update UI weather display
        if (window.UI && window.UI.isInitialized) {
            window.UI.updateWeatherDisplay(weather);
        }

        // Trigger recalculation if there's an active release
        if (window.UI && window.UI.currentRelease) {
            this.requestDispersionUpdate(window.UI.currentRelease.id);
        }
    }

    /**
     * Handle dispersion calculation updates
     */
    handleDispersionUpdate(calculation) {
        console.log('Dispersion update received:', calculation);
        
        // Update map display
        if (window.MapManager && window.MapManager.isInitialized) {
            window.MapManager.displayPlume(calculation);
        }

        // Update receptor impacts
        if (window.UI && window.UI.isInitialized && calculation.receptor_impacts) {
            window.UI.updateReceptorImpacts(calculation.receptor_impacts);
        }
    }

    /**
     * Handle receptor impact updates
     */
    handleReceptorImpact(impact) {
        console.log('Receptor impact received:', impact);
        
        // Show notification for high-risk impacts
        if (impact.risk_level === 'high' || impact.risk_level === 'critical') {
            if (window.UI && window.UI.isInitialized) {
                window.UI.showToast(
                    `High risk impact at ${impact.receptor_name}: ${Utils.formatConcentration(impact.concentration)}`,
                    'warning'
                );
            }
        }
    }

    /**
     * Handle system status updates
     */
    handleSystemStatus(status) {
        console.log('System status:', status);
        
        if (status.error && window.UI && window.UI.isInitialized) {
            window.UI.showToast(status.error, 'error');
        }
    }

    /**
     * Subscribe to update types
     */
    subscribe(types) {
        if (this.isConnected && Array.isArray(types)) {
            const message = {
                type: 'subscribe',
                payload: { types }
            };
            this.send(message);
        }
    }

    /**
     * Request dispersion update
     */
    requestDispersionUpdate(releaseId) {
        if (this.isConnected) {
            const message = {
                type: 'request_update',
                payload: { release_id: releaseId }
            };
            this.send(message);
        }
    }

    /**
     * Send message to server
     */
    send(message) {
        if (this.isConnected && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not connected, cannot send message');
        }
    }

    /**
     * Attempt to reconnect
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        if (this.reconnectInterval) {
            return; // Already attempting to reconnect
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
        
        console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        this.reconnectInterval = setTimeout(() => {
            this.reconnectInterval = null;
            this.connect();
        }, delay);
    }

    /**
     * Disconnect WebSocket
     */
    disconnect() {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }

        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }

        this.isConnected = false;
        console.log('WebSocket disconnected');
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            readyState: this.socket ? this.socket.readyState : null
        };
    }
}

// Create global WebSocket instance
window.WebSocketManager = new WebSocketManager();