import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Alert,
} from 'react-native';
import SignalingService from '../services/SignalingService';
import WebRTCService from '../services/WebRTCService';
import ClipboardService from '../services/ClipboardService';
import BackgroundService from '../services/BackgroundService';
import { generateRoomCode } from '../utils/helpers';

const HostScreen = ({ navigation }) => {
    const [roomCode, setRoomCode] = useState('');
    const [status, setStatus] = useState('Initializing...');
    const [connectedPeers, setConnectedPeers] = useState(0);
    const [totalPeers, setTotalPeers] = useState(0);
    const [lastClipboard, setLastClipboard] = useState('');
    const [clipboardHistory, setClipboardHistory] = useState([]);
    const [signalingService] = useState(new SignalingService());
    const [webrtcService] = useState(new WebRTCService(signalingService));
    const [clipboardService] = useState(new ClipboardService(webrtcService));

    useEffect(() => {
        initializeHost();

        return () => {
            clipboardService.stopMonitoring();
            webrtcService.close();
            signalingService.close();
            BackgroundService.stop();
        };
    }, []);

    const initializeHost = async () => {
        try {
            // Generate room code
            const code = generateRoomCode();
            setRoomCode(code);

            // Connect to signaling server (localhost for now)
            setStatus('Connecting to server...');
            await signalingService.connect('ws://localhost:8080', code);

            // Setup signaling handler for joined event
            signalingService.on('joined', async (data) => {
                const { myId, peers, peerCount } = data;
                console.log('[Host] Joined room. My ID:', myId, 'Existing peers:', peers);

                // Initialize WebRTC with our peer ID and existing peers
                await webrtcService.initialize(myId, peers);

                setTotalPeers(peerCount - 1); // Exclude self
                setStatus(peers.length > 0 ? `Connected to ${peers.length} peer(s)` : 'Waiting for peers...');
            });

            // Setup clipboard message handler
            webrtcService.onMessage((data, fromPeer) => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === 'clipboard') {
                        clipboardService.handleClipboard(parsed);
                    }
                } catch (e) {
                    // Not JSON
                }
            });

            // Setup clipboard change callback
            clipboardService.onClipboardChange((content) => {
                const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
                setLastClipboard(preview);
                setClipboardHistory(prev => [{ content: preview, time: new Date() }, ...prev.slice(0, 9)]);
            });

            // Setup peer count handler
            webrtcService.onPeerCount((connected, total) => {
                setConnectedPeers(connected);
                setTotalPeers(total);
                if (connected === 0) {
                    setStatus('Waiting for peers...');
                    clipboardService.stopMonitoring();
                    BackgroundService.stop();
                } else if (connected === total) {
                    setStatus(`Clipboard sync active with ${connected} peer(s)`);
                    // Start clipboard monitoring when connected
                    clipboardService.startMonitoring();
                    BackgroundService.start();
                } else {
                    setStatus(`Connecting... (${connected}/${total})`);
                }
            });

        } catch (error) {
            console.error('Host initialization error:', error);
            Alert.alert('Error', 'Failed to initialize host. Make sure the Python server is running on localhost:8080');
            setStatus('Error: ' + error.message);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Host Mode</Text>
            </View>

            <View style={styles.infoCard}>
                <Text style={styles.label}>Room Code:</Text>
                <Text style={styles.roomCode}>{roomCode || '------'}</Text>
                <Text style={styles.statusText}>{status}</Text>
                <Text style={styles.peerCount}>
                    {connectedPeers} / {totalPeers} peers connected
                </Text>
                <Text style={styles.hint}>
                    Share this code with others to sync clipboards
                </Text>
            </View>

            <View style={styles.clipboardContainer}>
                <Text style={styles.clipboardTitle}>📋 Clipboard Sync</Text>

                {connectedPeers === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>Waiting for devices to connect...</Text>
                        <Text style={styles.emptySubtext}>Clipboard sync will start automatically</Text>
                    </View>
                ) : (
                    <>
                        {lastClipboard ? (
                            <View style={styles.lastClipboardCard}>
                                <Text style={styles.lastClipboardLabel}>Last Synced:</Text>
                                <Text style={styles.lastClipboardText}>{lastClipboard}</Text>
                            </View>
                        ) : (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyText}>Copy something to sync!</Text>
                            </View>
                        )}

                        {clipboardHistory.length > 0 && (
                            <View style={styles.historySection}>
                                <Text style={styles.historyTitle}>Recent History</Text>
                                <ScrollView style={styles.historyList}>
                                    {clipboardHistory.map((item, index) => (
                                        <View key={index} style={styles.historyItem}>
                                            <Text style={styles.historyText}>{item.content}</Text>
                                            <Text style={styles.historyTime}>
                                                {item.time.toLocaleTimeString()}
                                            </Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
        paddingTop: 50,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        paddingBottom: 10,
    },
    backButton: {
        marginRight: 15,
    },
    backButtonText: {
        color: '#6366f1',
        fontSize: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    infoCard: {
        backgroundColor: '#1a1a1a',
        margin: 20,
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    label: {
        fontSize: 14,
        color: '#888',
        marginBottom: 8,
    },
    roomCode: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#6366f1',
        letterSpacing: 4,
        marginBottom: 12,
    },
    statusText: {
        fontSize: 16,
        color: '#10b981',
        marginBottom: 8,
    },
    peerCount: {
        fontSize: 14,
        color: '#888',
        marginBottom: 8,
    },
    hint: {
        fontSize: 12,
        color: '#666',
    },
    clipboardContainer: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        margin: 20,
        marginTop: 0,
        borderRadius: 12,
        padding: 15,
    },
    clipboardTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 15,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        marginBottom: 8,
    },
    emptySubtext: {
        color: '#444',
        fontSize: 14,
    },
    lastClipboardCard: {
        backgroundColor: '#0a0a0a',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 15,
    },
    lastClipboardLabel: {
        fontSize: 12,
        color: '#888',
        marginBottom: 8,
    },
    lastClipboardText: {
        fontSize: 14,
        color: '#fff',
        lineHeight: 20,
    },
    historySection: {
        flex: 1,
    },
    historyTitle: {
        fontSize: 14,
        color: '#888',
        marginBottom: 10,
    },
    historyList: {
        flex: 1,
    },
    historyItem: {
        backgroundColor: '#0a0a0a',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#222',
    },
    historyText: {
        fontSize: 13,
        color: '#ccc',
        marginBottom: 4,
    },
    historyTime: {
        fontSize: 11,
        color: '#666',
    },
});

export default HostScreen;
