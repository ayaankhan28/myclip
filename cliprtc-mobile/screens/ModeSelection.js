import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const ModeSelection = ({ navigation }) => {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>ClipRTC Mobile</Text>
                <Text style={styles.subtitle}>WebRTC Peer-to-Peer Connection</Text>
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.button, styles.hostButton]}
                    onPress={() => navigation.navigate('Host')}
                >
                    <Text style={styles.buttonText}>🎯 Host</Text>
                    <Text style={styles.buttonSubtext}>Create a room</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.joinButton]}
                    onPress={() => navigation.navigate('Join')}
                >
                    <Text style={styles.buttonText}>🔗 Join</Text>
                    <Text style={styles.buttonSubtext}>Connect to a room</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Choose a mode to start connecting
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 60,
    },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#888',
    },
    buttonContainer: {
        gap: 20,
    },
    button: {
        padding: 30,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    hostButton: {
        backgroundColor: '#6366f1',
    },
    joinButton: {
        backgroundColor: '#10b981',
    },
    buttonText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    buttonSubtext: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    footer: {
        marginTop: 60,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 14,
        color: '#666',
    },
});

export default ModeSelection;
