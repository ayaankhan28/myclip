import notifee, { AndroidImportance } from '@notifee/react-native';
import { Platform } from 'react-native';

class BackgroundService {
    constructor() {
        this.isServiceRunning = false;
    }

    async start() {
        if (Platform.OS !== 'android') return;
        if (this.isServiceRunning) return;

        try {
            // Create a channel
            const channelId = await notifee.createChannel({
                id: 'clipboard_sync_service',
                name: 'Clipboard Sync Service',
                importance: AndroidImportance.LOW, // Low importance to minimize intrusion
            });

            // Display a notification
            await notifee.displayNotification({
                id: 'foreground-service',
                title: 'Clipboard Sync Active',
                body: 'Monitoring clipboard changes in background...',
                android: {
                    channelId,
                    asForegroundService: true, // This is key!
                    ongoing: true, // User can't dismiss it
                    pressAction: {
                        id: 'default',
                    },
                    actions: [
                        {
                            title: 'Stop Sync',
                            pressAction: {
                                id: 'stop',
                            },
                        },
                    ],
                },
            });

            this.isServiceRunning = true;
            console.log('[Background] Foreground service started');
        } catch (error) {
            console.error('[Background] Failed to start foreground service:', error);
        }
    }

    async stop() {
        if (Platform.OS !== 'android') return;
        if (!this.isServiceRunning) return;

        try {
            await notifee.stopForegroundService();
            this.isServiceRunning = false;
            console.log('[Background] Foreground service stopped');
        } catch (error) {
            console.error('[Background] Failed to stop foreground service:', error);
        }
    }
}

export default new BackgroundService();
