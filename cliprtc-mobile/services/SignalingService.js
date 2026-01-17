// WebSocket signaling service for WebRTC connection

class SignalingService {
    constructor() {
        this.ws = null;
        this.messageHandlers = {};
    }

    /**
     * Connect to signaling server
     */
    connect(serverUrl, roomCode) {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(`${serverUrl}/ws`);

                // Generate unique peer ID
                this.peerId = `peer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                this.ws.onopen = () => {
                    console.log('[Signaling] Connected to server');
                    // Join room with peer ID
                    this.send({
                        type: 'join',
                        code: roomCode,
                        peerId: this.peerId
                    });
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('[Signaling] Received:', data.type);

                        // Call registered handlers
                        if (this.messageHandlers[data.type]) {
                            this.messageHandlers[data.type](data);
                        }
                    } catch (error) {
                        console.error('[Signaling] Parse error:', error);
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('[Signaling] WebSocket error:', error);
                    reject(error);
                };

                this.ws.onclose = () => {
                    console.log('[Signaling] Connection closed');
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Register message handler
     */
    on(messageType, handler) {
        this.messageHandlers[messageType] = handler;
    }

    /**
     * Send message to signaling server
     */
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            console.log('[Signaling] Sent:', data.type);
        } else {
            console.error('[Signaling] WebSocket not ready');
        }
    }

    /**
     * Close connection
     */
    close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

export default SignalingService;
