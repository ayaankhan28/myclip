const WebSocket = require('ws');
const http = require('http');

class SignalingServer {
    constructor() {
        this.rooms = {}; // {room_code: {peer_id: websocket}}
        this.wss = null;
        this.server = null;
    }

    async start(port = 8080) {
        return new Promise((resolve, reject) => {
            // Create HTTP server
            this.server = http.createServer();

            // Create WebSocket server (don't bind to server yet)
            this.wss = new WebSocket.Server({ noServer: true });

            this.wss.on('connection', (ws) => {
                this.handleConnection(ws);
            });

            // Handle HTTP upgrade for /ws path
            this.server.on('upgrade', (request, socket, head) => {
                if (request.url === '/ws') {
                    this.wss.handleUpgrade(request, socket, head, (ws) => {
                        this.wss.emit('connection', ws, request);
                    });
                } else {
                    console.log(`[SignalingServer] Rejected connection to ${request.url}`);
                    socket.destroy();
                }
            });

            this.server.listen(port, '0.0.0.0', () => {
                console.log(`[SignalingServer] Started on 0.0.0.0:${port}`);
                resolve();
            });

            this.server.on('error', (error) => {
                console.error('[SignalingServer] Error:', error);
                reject(error);
            });
        });
    }

    async stop() {
        return new Promise((resolve) => {
            if (this.wss) {
                this.wss.close(() => {
                    console.log('[SignalingServer] WebSocket server closed');
                });
            }

            if (this.server) {
                this.server.close(() => {
                    console.log('[SignalingServer] HTTP server closed');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    handleConnection(ws) {
        let roomCode = null;
        let peerId = null;

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());

                if (data.type === 'join') {
                    roomCode = data.code;
                    peerId = data.peerId || this.generatePeerId();

                    if (!this.rooms[roomCode]) {
                        this.rooms[roomCode] = {};
                    }

                    // Get list of existing peers
                    const existingPeers = Object.keys(this.rooms[roomCode]);

                    // Add this peer to room
                    this.rooms[roomCode][peerId] = ws;

                    // Send joined confirmation with peer list
                    ws.send(JSON.stringify({
                        type: 'joined',
                        code: roomCode,
                        myId: peerId,
                        peers: existingPeers,
                        peerCount: Object.keys(this.rooms[roomCode]).length
                    }));

                    console.log(`[SignalingServer] Peer ${peerId.substring(0, 8)}... joined room ${roomCode}. Total peers: ${Object.keys(this.rooms[roomCode]).length}`);

                    // Notify all existing peers about new peer
                    existingPeers.forEach((existingPeerId) => {
                        const existingWs = this.rooms[roomCode][existingPeerId];
                        if (existingWs && existingWs.readyState === WebSocket.OPEN) {
                            existingWs.send(JSON.stringify({
                                type: 'peer_joined',
                                peerId: peerId
                            }));
                        }
                    });
                } else if (data.type === 'offer' || data.type === 'answer' || data.type === 'ice') {
                    // Route message to specific peer
                    const targetPeerId = data.targetPeer;
                    if (roomCode && this.rooms[roomCode] && this.rooms[roomCode][targetPeerId]) {
                        const targetWs = this.rooms[roomCode][targetPeerId];
                        if (targetWs.readyState === WebSocket.OPEN) {
                            // Add fromPeer to the message
                            data.fromPeer = peerId;
                            targetWs.send(JSON.stringify(data));
                        }
                    }
                }
            } catch (error) {
                console.error('[SignalingServer] Error handling message:', error);
            }
        });

        ws.on('close', () => {
            // Handle disconnection
            if (roomCode && this.rooms[roomCode] && peerId) {
                delete this.rooms[roomCode][peerId];
                console.log(`[SignalingServer] Peer ${peerId.substring(0, 8)}... left room ${roomCode}. Remaining peers: ${Object.keys(this.rooms[roomCode]).length}`);

                // Notify remaining peers
                Object.keys(this.rooms[roomCode]).forEach((remainingPeerId) => {
                    const remainingWs = this.rooms[roomCode][remainingPeerId];
                    if (remainingWs && remainingWs.readyState === WebSocket.OPEN) {
                        remainingWs.send(JSON.stringify({
                            type: 'peer_left',
                            peerId: peerId
                        }));
                    }
                });

                // Clean up empty room
                if (Object.keys(this.rooms[roomCode]).length === 0) {
                    delete this.rooms[roomCode];
                }
            }
        });

        ws.on('error', (error) => {
            console.error('[SignalingServer] WebSocket error:', error);
        });
    }

    generatePeerId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 11);
        return `peer-${timestamp}-${random}`;
    }
}

module.exports = SignalingServer;
