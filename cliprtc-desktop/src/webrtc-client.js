const SimplePeer = require('simple-peer');
const WebSocket = require('ws');
const EventEmitter = require('events');
const wrtc = require('@roamhq/wrtc');

class WebRTCClient extends EventEmitter {
    constructor() {
        super();
        this.peers = {}; // {peer_id: SimplePeer instance}
        this.ws = null;
        this.myPeerId = null;
    }

    async connect(roomCode, serverURL) {
        return new Promise((resolve, reject) => {
            const wsURL = serverURL.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws';

            this.ws = new WebSocket(wsURL);

            this.ws.on('open', () => {
                console.log('[WebRTC] Connected to signaling server');

                // Generate peer ID
                this.myPeerId = this.generatePeerId();

                // Join room
                this.ws.send(JSON.stringify({
                    type: 'join',
                    code: roomCode,
                    peerId: this.myPeerId
                }));

                resolve();
            });

            this.ws.on('message', (message) => {
                this.handleSignalingMessage(JSON.parse(message.toString()));
            });

            this.ws.on('error', (error) => {
                console.error('[WebRTC] WebSocket error:', error);
                reject(error);
            });

            this.ws.on('close', () => {
                console.log('[WebRTC] Disconnected from signaling server');
            });
        });
    }

    async handleSignalingMessage(data) {
        try {
            if (data.type === 'joined') {
                const myId = data.myId;
                const existingPeers = data.peers || [];

                console.log(`[WebRTC] Joined room. My ID: ${myId.substring(0, 8)}..., Peers: ${existingPeers.length}`);

                if (existingPeers.length === 0) {
                    console.log('[WebRTC] Waiting for peers...');
                } else {
                    console.log(`[WebRTC] Found ${existingPeers.length} peer(s)!`);
                    // Create connections to existing peers
                    for (const peerId of existingPeers) {
                        const shouldInitiate = this.myPeerId < peerId;
                        if (shouldInitiate) {
                            this.createPeer(peerId, true);
                        }
                    }
                }
            } else if (data.type === 'peer_joined') {
                const peerId = data.peerId;
                console.log(`[WebRTC] Peer ${peerId.substring(0, 8)}... joined`);

                // Use peer ID comparison to determine who initiates
                const shouldInitiate = this.myPeerId < peerId;
                if (shouldInitiate) {
                    console.log(`[WebRTC] Creating connection to ${peerId.substring(0, 8)}...`);
                    this.createPeer(peerId, true);
                } else {
                    console.log(`[WebRTC] Waiting for connection from ${peerId.substring(0, 8)}...`);
                }
            } else if (data.type === 'offer') {
                const fromPeer = data.fromPeer;
                if (!this.peers[fromPeer]) {
                    this.createPeer(fromPeer, false);
                }
                // Signal the offer to the peer
                this.peers[fromPeer].signal(data.sdp);
            } else if (data.type === 'answer') {
                const fromPeer = data.fromPeer;
                if (this.peers[fromPeer]) {
                    this.peers[fromPeer].signal(data.sdp);
                }
            } else if (data.type === 'ice') {
                const fromPeer = data.fromPeer;
                if (this.peers[fromPeer] && data.candidate) {
                    // Match the format we send out (see line 148)
                    // We send: { type: 'ice', targetPeer: X, candidate: <full ice object> }
                    // So when receiving, we should extract and use the same format
                    this.peers[fromPeer].signal({
                        type: 'candidate',
                        candidate: data.candidate
                    });
                }
            } else if (data.type === 'peer_left') {
                const peerId = data.peerId;
                console.log(`[WebRTC] Peer ${peerId.substring(0, 8)}... left`);
                this.removePeer(peerId);
            }
        } catch (error) {
            console.error('[WebRTC] Error handling signaling message:', error);
        }
    }

    createPeer(peerId, initiator) {
        if (this.peers[peerId]) {
            return;
        }

        console.log(`[WebRTC] Creating peer connection to ${peerId.substring(0, 8)}... (initiator: ${initiator})`);

        const peer = new SimplePeer({
            initiator: initiator,
            trickle: true,
            wrtc: wrtc,  // Add WebRTC support for Node.js
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            }
        });

        this.peers[peerId] = peer;

        // Handle signaling data
        peer.on('signal', (data) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                // Determine message type based on data structure
                let messageType;
                if (data.type === 'offer') {
                    messageType = 'offer';
                } else if (data.type === 'answer') {
                    messageType = 'answer';
                } else if (data.candidate) {
                    messageType = 'ice';
                } else {
                    return; // Unknown signal type
                }

                this.ws.send(JSON.stringify({
                    type: messageType,
                    targetPeer: peerId,
                    [messageType === 'ice' ? 'candidate' : 'sdp']: data
                }));
            }
        });

        // Handle connection
        peer.on('connect', () => {
            console.log(`[WebRTC] ✓ Connected to peer ${peerId.substring(0, 8)}...!`);
            console.log(`[WebRTC] Total connections: ${this.getConnectedCount()}`);
            this.emit('connectionCountChanged', this.getConnectedCount());
        });

        // Handle incoming data
        peer.on('data', (data) => {
            this.emit('message', data.toString(), peerId);
        });

        // Handle errors
        peer.on('error', (err) => {
            console.error(`[WebRTC] Error with peer ${peerId.substring(0, 8)}...:`, err.message);
        });

        // Handle close
        peer.on('close', () => {
            console.log(`[WebRTC] Connection closed with peer ${peerId.substring(0, 8)}...`);
            this.removePeer(peerId);
        });
    }

    broadcastMessage(message) {
        let sentCount = 0;
        Object.values(this.peers).forEach((peer) => {
            if (peer.connected) {
                peer.send(message);
                sentCount++;
            }
        });
        return sentCount;
    }

    getConnectedCount() {
        let count = 0;
        Object.values(this.peers).forEach((peer) => {
            if (peer.connected) {
                count++;
            }
        });
        return count;
    }

    removePeer(peerId) {
        if (this.peers[peerId]) {
            this.peers[peerId].destroy();
            delete this.peers[peerId];
            this.emit('connectionCountChanged', this.getConnectedCount());
        }
    }

    async close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        Object.values(this.peers).forEach((peer) => {
            peer.destroy();
        });

        this.peers = {};
        this.emit('connectionCountChanged', 0);
    }

    generatePeerId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 11);
        return `peer-${timestamp}-${random}`;
    }
}

module.exports = WebRTCClient;
