// WebRTC service for multi-peer mesh network connections
import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
} from 'react-native-webrtc';

class WebRTCService {
    constructor(signalingService) {
        this.signalingService = signalingService;
        this.peerConnections = new Map(); // Map<peerId, {pc, dataChannel}>
        this.myPeerId = null;
        this.onMessageCallback = null;
        this.onPeerCountCallback = null;

        // ICE servers configuration
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
        };
    }

    /**
     * Initialize WebRTC service with peer ID
     */
    async initialize(myPeerId, existingPeers = []) {
        this.myPeerId = myPeerId;
        console.log(`[WebRTC] Initialized with peer ID: ${myPeerId}`);
        console.log(`[WebRTC] Existing peers:`, existingPeers);

        // Setup signaling handlers
        this.setupSignalingHandlers();

        // Create connections to all existing peers
        for (const peerId of existingPeers) {
            // Use peer ID comparison to determine who initiates
            // Lower peer ID initiates the connection
            const shouldInitiate = myPeerId < peerId;
            console.log(`[WebRTC] ${shouldInitiate ? 'Initiating' : 'Waiting for'} connection with ${peerId}`);
            await this.createPeerConnection(peerId, shouldInitiate);
        }

        this.updatePeerCount();
    }

    /**
     * Create a peer connection for a specific peer
     */
    async createPeerConnection(peerId, isInitiator) {
        if (this.peerConnections.has(peerId)) {
            console.log(`[WebRTC] Connection to ${peerId} already exists`);
            return;
        }

        console.log(`[WebRTC] Creating connection to peer ${peerId} (initiator: ${isInitiator})`);

        const pc = new RTCPeerConnection(this.configuration);
        const peerInfo = { pc, dataChannel: null, isInitiator };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log(`[WebRTC] Sending ICE candidate to ${peerId}`);
                this.signalingService.send({
                    type: 'ice',
                    targetPeer: peerId,
                    candidate: {
                        candidate: event.candidate.candidate,
                        sdpMid: event.candidate.sdpMid,
                        sdpMLineIndex: event.candidate.sdpMLineIndex,
                    },
                });
            }
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            console.log(`[WebRTC] Connection to ${peerId} state:`, state);

            if (state === 'connected') {
                console.log(`[WebRTC] ✓ Connected to peer ${peerId}`);
                this.updatePeerCount();
            } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                console.log(`[WebRTC] ✗ Disconnected from peer ${peerId}`);
                this.removePeer(peerId);
            }
        };

        // If initiator, create data channel
        if (isInitiator) {
            const dataChannel = pc.createDataChannel('chat');
            peerInfo.dataChannel = dataChannel;
            this.setupDataChannel(peerId, dataChannel);
            console.log(`[WebRTC] Data channel created for ${peerId}`);
        } else {
            // If not initiator, wait for data channel
            pc.ondatachannel = (event) => {
                console.log(`[WebRTC] Data channel received from ${peerId}`);
                peerInfo.dataChannel = event.channel;
                this.setupDataChannel(peerId, event.channel);
            };
        }

        this.peerConnections.set(peerId, peerInfo);

        // If initiator, create and send offer
        if (isInitiator) {
            await this.createOffer(peerId);
        }
    }

    /**
     * Setup data channel event handlers
     */
    setupDataChannel(peerId, dataChannel) {
        dataChannel.onopen = () => {
            console.log(`[WebRTC] Data channel opened with ${peerId}`);
            this.updatePeerCount();
        };

        dataChannel.onmessage = (event) => {
            console.log(`[WebRTC] Message from ${peerId}:`, event.data);
            if (this.onMessageCallback) {
                this.onMessageCallback(event.data, peerId);
            }
        };

        dataChannel.onclose = () => {
            console.log(`[WebRTC] Data channel closed with ${peerId}`);
        };
    }

    /**
     * Setup signaling message handlers
     */
    setupSignalingHandlers() {
        // Handle new peer joined
        // Handle new peer joined
        this.signalingService.on('peer_joined', async (data) => {
            const { peerId } = data;
            console.log(`[WebRTC] New peer joined: ${peerId}`);

            // Check who should initiate
            const shouldInitiate = this.myPeerId < peerId;
            console.log(`[WebRTC] ${shouldInitiate ? 'Initiating' : 'Waiting for'} connection with ${peerId}`);

            await this.createPeerConnection(peerId, shouldInitiate);
        });

        // Handle offer
        this.signalingService.on('offer', async (data) => {
            const { fromPeer, sdp } = data;
            console.log(`[WebRTC] Received offer from ${fromPeer}`);

            // Create peer connection if it doesn't exist
            if (!this.peerConnections.has(fromPeer)) {
                await this.createPeerConnection(fromPeer, false);
            }

            await this.handleOffer(fromPeer, sdp);
        });

        // Handle answer
        this.signalingService.on('answer', async (data) => {
            const { fromPeer, sdp } = data;
            console.log(`[WebRTC] Received answer from ${fromPeer}`);
            await this.handleAnswer(fromPeer, sdp);
        });

        // Handle ICE candidate
        this.signalingService.on('ice', async (data) => {
            const { fromPeer, candidate } = data;
            if (candidate && this.peerConnections.has(fromPeer)) {
                console.log(`[WebRTC] Received ICE candidate from ${fromPeer}`);
                const peerInfo = this.peerConnections.get(fromPeer);
                const iceCandidate = new RTCIceCandidate({
                    candidate: candidate.candidate,
                    sdpMid: candidate.sdpMid,
                    sdpMLineIndex: candidate.sdpMLineIndex,
                });
                await peerInfo.pc.addIceCandidate(iceCandidate);
            }
        });

        // Handle peer left
        this.signalingService.on('peer_left', (data) => {
            const { peerId } = data;
            console.log(`[WebRTC] Peer left: ${peerId}`);
            this.removePeer(peerId);
        });
    }

    /**
     * Create and send offer to a peer
     */
    async createOffer(peerId) {
        try {
            const peerInfo = this.peerConnections.get(peerId);
            if (!peerInfo) return;

            const offer = await peerInfo.pc.createOffer();
            await peerInfo.pc.setLocalDescription(offer);

            this.signalingService.send({
                type: 'offer',
                targetPeer: peerId,
                sdp: {
                    type: offer.type,
                    sdp: offer.sdp,
                },
            });
        } catch (error) {
            console.error(`[WebRTC] Create offer error for ${peerId}:`, error);
        }
    }

    /**
     * Handle received offer from a peer
     */
    async handleOffer(peerId, sdp) {
        try {
            const peerInfo = this.peerConnections.get(peerId);
            if (!peerInfo) return;

            await peerInfo.pc.setRemoteDescription(new RTCSessionDescription(sdp));

            const answer = await peerInfo.pc.createAnswer();
            await peerInfo.pc.setLocalDescription(answer);

            this.signalingService.send({
                type: 'answer',
                targetPeer: peerId,
                sdp: {
                    type: answer.type,
                    sdp: answer.sdp,
                },
            });
        } catch (error) {
            console.error(`[WebRTC] Handle offer error from ${peerId}:`, error);
        }
    }

    /**
     * Handle received answer from a peer
     */
    async handleAnswer(peerId, sdp) {
        try {
            const peerInfo = this.peerConnections.get(peerId);
            if (!peerInfo) return;

            await peerInfo.pc.setRemoteDescription(new RTCSessionDescription(sdp));
        } catch (error) {
            console.error(`[WebRTC] Handle answer error from ${peerId}:`, error);
        }
    }

    /**
     * Broadcast message to all connected peers
     */
    broadcastMessage(message) {
        let sentCount = 0;

        for (const [peerId, peerInfo] of this.peerConnections) {
            if (peerInfo.dataChannel && peerInfo.dataChannel.readyState === 'open') {
                peerInfo.dataChannel.send(message);
                sentCount++;
            }
        }

        console.log(`[WebRTC] Broadcast message to ${sentCount} peers`);
        return sentCount > 0;
    }

    /**
     * Remove a peer connection
     */
    removePeer(peerId) {
        const peerInfo = this.peerConnections.get(peerId);
        if (peerInfo) {
            if (peerInfo.dataChannel) {
                peerInfo.dataChannel.close();
            }
            if (peerInfo.pc) {
                peerInfo.pc.close();
            }
            this.peerConnections.delete(peerId);
            console.log(`[WebRTC] Removed peer ${peerId}`);
            this.updatePeerCount();
        }
    }

    /**
     * Update peer count callback
     */
    updatePeerCount() {
        const connectedCount = Array.from(this.peerConnections.values()).filter(
            (info) => info.dataChannel && info.dataChannel.readyState === 'open'
        ).length;

        console.log(`[WebRTC] Connected peers: ${connectedCount}/${this.peerConnections.size}`);

        if (this.onPeerCountCallback) {
            this.onPeerCountCallback(connectedCount, this.peerConnections.size);
        }
    }

    /**
     * Set message callback
     */
    onMessage(callback) {
        this.onMessageCallback = callback;
    }

    /**
     * Set peer count callback
     */
    onPeerCount(callback) {
        this.onPeerCountCallback = callback;
    }

    /**
     * Get connected peer count
     */
    getConnectedPeerCount() {
        return Array.from(this.peerConnections.values()).filter(
            (info) => info.dataChannel && info.dataChannel.readyState === 'open'
        ).length;
    }

    /**
     * Close all connections
     */
    close() {
        for (const [peerId, peerInfo] of this.peerConnections) {
            if (peerInfo.dataChannel) {
                peerInfo.dataChannel.close();
            }
            if (peerInfo.pc) {
                peerInfo.pc.close();
            }
        }
        this.peerConnections.clear();
        console.log('[WebRTC] All connections closed');
    }
}

export default WebRTCService;
