// WebRTC service for peer-to-peer connection
import {
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
} from 'react-native-webrtc';

class WebRTCService {
    constructor(signalingService) {
        this.signalingService = signalingService;
        this.peerConnection = null;
        this.dataChannel = null;
        this.isInitiator = false;
        this.onMessageCallback = null;
        this.onConnectionStateCallback = null;

        // ICE servers configuration
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ],
        };
    }

    /**
     * Initialize WebRTC peer connection
     */
    async initialize(isInitiator = false) {
        this.isInitiator = isInitiator;

        // Create peer connection
        this.peerConnection = new RTCPeerConnection(this.configuration);

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('[WebRTC] Sending ICE candidate');
                this.signalingService.send({
                    type: 'ice',
                    candidate: {
                        candidate: event.candidate.candidate,
                        sdpMid: event.candidate.sdpMid,
                        sdpMLineIndex: event.candidate.sdpMLineIndex,
                    },
                });
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('[WebRTC] Connection state:', state);
            if (this.onConnectionStateCallback) {
                this.onConnectionStateCallback(state);
            }
        };

        // If initiator, create data channel
        if (isInitiator) {
            this.createDataChannel();
        } else {
            // If not initiator, wait for data channel
            this.peerConnection.ondatachannel = (event) => {
                console.log('[WebRTC] Data channel received');
                this.dataChannel = event.channel;
                this.setupDataChannel();
            };
        }

        // Setup signaling handlers
        this.setupSignalingHandlers();
    }

    /**
     * Create data channel (initiator only)
     */
    createDataChannel() {
        this.dataChannel = this.peerConnection.createDataChannel('chat');
        this.setupDataChannel();
        console.log('[WebRTC] Data channel created');
    }

    /**
     * Setup data channel event handlers
     */
    setupDataChannel() {
        this.dataChannel.onopen = () => {
            console.log('[WebRTC] Data channel opened');
            if (this.onConnectionStateCallback) {
                this.onConnectionStateCallback('connected');
            }
        };

        this.dataChannel.onmessage = (event) => {
            console.log('[WebRTC] Message received:', event.data);
            if (this.onMessageCallback) {
                this.onMessageCallback(event.data);
            }
        };

        this.dataChannel.onclose = () => {
            console.log('[WebRTC] Data channel closed');
        };
    }

    /**
     * Setup signaling message handlers
     */
    setupSignalingHandlers() {
        // Handle peer joined
        this.signalingService.on('peer_joined', async () => {
            if (this.isInitiator) {
                console.log('[WebRTC] Peer joined, creating offer');
                await this.createOffer();
            }
        });

        // Handle offer
        this.signalingService.on('offer', async (data) => {
            console.log('[WebRTC] Received offer');
            await this.handleOffer(data.sdp);
        });

        // Handle answer
        this.signalingService.on('answer', async (data) => {
            console.log('[WebRTC] Received answer');
            await this.handleAnswer(data.sdp);
        });

        // Handle ICE candidate
        this.signalingService.on('ice', async (data) => {
            if (data.candidate) {
                console.log('[WebRTC] Received ICE candidate');
                const candidate = new RTCIceCandidate({
                    candidate: data.candidate.candidate,
                    sdpMid: data.candidate.sdpMid,
                    sdpMLineIndex: data.candidate.sdpMLineIndex,
                });
                await this.peerConnection.addIceCandidate(candidate);
            }
        });
    }

    /**
     * Create and send offer
     */
    async createOffer() {
        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            this.signalingService.send({
                type: 'offer',
                sdp: {
                    type: offer.type,
                    sdp: offer.sdp,
                },
            });
        } catch (error) {
            console.error('[WebRTC] Create offer error:', error);
        }
    }

    /**
     * Handle received offer
     */
    async handleOffer(sdp) {
        try {
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(sdp)
            );

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);

            this.signalingService.send({
                type: 'answer',
                sdp: {
                    type: answer.type,
                    sdp: answer.sdp,
                },
            });
        } catch (error) {
            console.error('[WebRTC] Handle offer error:', error);
        }
    }

    /**
     * Handle received answer
     */
    async handleAnswer(sdp) {
        try {
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(sdp)
            );
        } catch (error) {
            console.error('[WebRTC] Handle answer error:', error);
        }
    }

    /**
     * Send message through data channel
     */
    sendMessage(message) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(message);
            return true;
        }
        console.warn('[WebRTC] Data channel not ready');
        return false;
    }

    /**
     * Set message callback
     */
    onMessage(callback) {
        this.onMessageCallback = callback;
    }

    /**
     * Set connection state callback
     */
    onConnectionState(callback) {
        this.onConnectionStateCallback = callback;
    }

    /**
     * Close connection
     */
    close() {
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        if (this.peerConnection) {
            this.peerConnection.close();
        }
    }
}

export default WebRTCService;
