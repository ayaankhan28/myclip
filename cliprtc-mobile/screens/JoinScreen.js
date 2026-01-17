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
import { isValidRoomCode, isValidIP } from '../utils/helpers';

const JoinScreen = ({ navigation }) => {
    const [hostIP, setHostIP] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [status, setStatus] = useState('Enter details to connect');
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [connected, setConnected] = useState(false);
    const [joining, setJoining] = useState(false);
    const [signalingService] = useState(new SignalingService());
    const [webrtcService] = useState(new WebRTCService(signalingService));

    useEffect(() => {
        return () => {
            webrtcService.close();
            signalingService.close();
        };
    }, []);

    const handleJoin = async () => {
        // Validate inputs
        if (!hostIP.trim()) {
            Alert.alert('Error', 'Please enter host IP address');
            return;
        }

        if (!isValidRoomCode(roomCode)) {
            Alert.alert('Error', 'Please enter a valid 6-digit room code');
            return;
        }

        setJoining(true);

        try {
            // Connect to signaling server
            const serverUrl = `ws://${hostIP}:8080`;
            setStatus('Connecting to server...');
            await signalingService.connect(serverUrl, roomCode);

            // Initialize WebRTC as non-initiator
            await webrtcService.initialize(false);

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

            setStatus('Waiting for connection...');
        } catch (error) {
            console.error('Join error:', error);
            Alert.alert('Error', 'Failed to connect. Make sure the host IP and code are correct.');
            setStatus('Error: ' + error.message);
            setJoining(false);
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
                <Text style={styles.title}>Join Mode</Text>
            </View>

            {!joining ? (
                <View style={styles.formContainer}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Host IP Address</Text>
                        <TextInput
                            style={styles.input}
                            value={hostIP}
                            onChangeText={setHostIP}
                            placeholder="e.g., 192.168.1.100 or localhost"
                            placeholderTextColor="#666"
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="url"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Room Code</Text>
                        <TextInput
                            style={[styles.input, styles.codeInput]}
                            value={roomCode}
                            onChangeText={setRoomCode}
                            placeholder="000000"
                            placeholderTextColor="#666"
                            keyboardType="number-pad"
                            maxLength={6}
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.joinButton}
                        onPress={handleJoin}
                    >
                        <Text style={styles.joinButtonText}>Connect</Text>
                    </TouchableOpacity>

                    <Text style={styles.hint}>
                        Get the host IP and room code from the host device
                    </Text>
                </View>
            ) : (
                <>
                    <View style={styles.infoCard}>
                        <Text style={styles.connectedTo}>Connected to: {hostIP}</Text>
                        <Text style={styles.statusText}>{status}</Text>
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
                                style={styles.messageInput}
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
                </>
            )}
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
        color: '#10b981',
        fontSize: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    formContainer: {
        padding: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: '#888',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 8,
        padding: 15,
        color: '#fff',
        fontSize: 16,
    },
    codeInput: {
        fontSize: 24,
        letterSpacing: 8,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    joinButton: {
        backgroundColor: '#10b981',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    joinButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    hint: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        marginTop: 15,
    },
    infoCard: {
        backgroundColor: '#1a1a1a',
        margin: 20,
        padding: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    connectedTo: {
        fontSize: 14,
        color: '#888',
        marginBottom: 8,
    },
    statusText: {
        fontSize: 16,
        color: '#10b981',
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
        backgroundColor: '#10b981',
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
    messageInput: {
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
        backgroundColor: '#10b981',
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

export default JoinScreen;
