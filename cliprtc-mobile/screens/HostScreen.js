import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import SignalingService from '../services/SignalingService';
import WebRTCService from '../services/WebRTCService';
import { generateRoomCode } from '../utils/helpers';

const HostScreen = ({ navigation }) => {
    const [roomCode, setRoomCode] = useState('');
    const [status, setStatus] = useState('Initializing...');
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [connected, setConnected] = useState(false);
    const [signalingService] = useState(new SignalingService());
    const [webrtcService] = useState(new WebRTCService(signalingService));

    useEffect(() => {
        initializeHost();

        return () => {
            webrtcService.close();
            signalingService.close();
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

            // Initialize WebRTC as initiator
            await webrtcService.initialize(true);

            // Setup message handler
            webrtcService.onMessage((message) => {
                setMessages((prev) => [...prev, { text: message, sender: 'peer' }]);
            });

            // Setup connection state handler
            webrtcService.onConnectionState((state) => {
                if (state === 'connected') {
                    setStatus('Connected!');
                    setConnected(true);
                } else if (state === 'disconnected' || state === 'failed') {
                    setStatus('Connection lost');
                    setConnected(false);
                } else {
                    setStatus(`Status: ${state}`);
                }
            });

            setStatus('Waiting for peer...');
        } catch (error) {
            console.error('Host initialization error:', error);
            Alert.alert('Error', 'Failed to initialize host. Make sure the Python server is running on localhost:8080');
            setStatus('Error: ' + error.message);
        }
    };

    const sendMessage = () => {
        if (!inputMessage.trim()) return;

        if (webrtcService.sendMessage(inputMessage)) {
            setMessages((prev) => [...prev, { text: inputMessage, sender: 'you' }]);
            setInputMessage('');
        } else {
            Alert.alert('Error', 'Not connected yet');
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
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
                <Text style={styles.hint}>
                    Share this code with the peer to connect
                </Text>
            </View>

            <View style={styles.chatContainer}>
                <Text style={styles.chatTitle}>Messages</Text>
                <ScrollView style={styles.messageList}>
                    {messages.length === 0 ? (
                        <Text style={styles.emptyText}>No messages yet</Text>
                    ) : (
                        messages.map((msg, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.message,
                                    msg.sender === 'you' ? styles.myMessage : styles.peerMessage,
                                ]}
                            >
                                <Text style={styles.messageSender}>
                                    {msg.sender === 'you' ? 'You' : 'Peer'}
                                </Text>
                                <Text style={styles.messageText}>{msg.text}</Text>
                            </View>
                        ))
                    )}
                </ScrollView>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={inputMessage}
                        onChangeText={setInputMessage}
                        placeholder="Type a message..."
                        placeholderTextColor="#666"
                        editable={connected}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, !connected && styles.sendButtonDisabled]}
                        onPress={sendMessage}
                        disabled={!connected}
                    >
                        <Text style={styles.sendButtonText}>Send</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
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
    hint: {
        fontSize: 12,
        color: '#666',
    },
    chatContainer: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        margin: 20,
        marginTop: 0,
        borderRadius: 12,
        padding: 15,
    },
    chatTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 10,
    },
    messageList: {
        flex: 1,
        marginBottom: 10,
    },
    emptyText: {
        color: '#666',
        textAlign: 'center',
        marginTop: 20,
    },
    message: {
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        maxWidth: '80%',
    },
    myMessage: {
        backgroundColor: '#6366f1',
        alignSelf: 'flex-end',
    },
    peerMessage: {
        backgroundColor: '#333',
        alignSelf: 'flex-start',
    },
    messageSender: {
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.6)',
        marginBottom: 4,
    },
    messageText: {
        fontSize: 14,
        color: '#fff',
    },
    inputContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    input: {
        flex: 1,
        backgroundColor: '#0a0a0a',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        padding: 12,
        color: '#fff',
        fontSize: 14,
    },
    sendButton: {
        backgroundColor: '#6366f1',
        paddingHorizontal: 20,
        borderRadius: 8,
        justifyContent: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#333',
    },
    sendButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});

export default HostScreen;
