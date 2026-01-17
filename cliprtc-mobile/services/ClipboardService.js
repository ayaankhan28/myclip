import * as Clipboard from 'expo-clipboard';
import CryptoJS from 'crypto-js';


class ClipboardService {
    constructor(webrtcService) {
        this.webrtcService = webrtcService;
        this.lastClipboardHash = null;
        this.monitorInterval = null;
        this.onClipboardChangeCallback = null;
    }

    getHash(text) {
        return CryptoJS.MD5(text).toString();
    }

    async startMonitoring() {
        console.log('[Clipboard] Monitoring started...');

        this.monitorInterval = setInterval(async () => {
            try {
                const current = await Clipboard.getStringAsync();

                if (current) {
                    const currentHash = this.getHash(current);

                    if (currentHash !== this.lastClipboardHash) {
                        this.lastClipboardHash = currentHash;
                        const preview = current.length > 50 ? current.substring(0, 50) + '...' : current;
                        console.log('[Clipboard] Syncing:', preview);
                        this.broadcastClipboard(current, currentHash);

                        if (this.onClipboardChangeCallback) {
                            this.onClipboardChangeCallback(current);
                        }
                    }
                }
            } catch (error) {
                console.error('[Clipboard Error]:', error);
            }
        }, 500); // Check every 500ms
    }

    broadcastClipboard(content, hash) {
        const message = JSON.stringify({
            type: 'clipboard',
            content: content,
            hash: hash
        });

        const sent = this.webrtcService.broadcastMessage(message);
        if (sent) {
            const peerCount = this.webrtcService.getConnectedPeerCount();
            console.log(`[Clipboard] Sent to ${peerCount} peer(s)`);
        }
    }

    async handleClipboard(data) {
        const { content, hash } = data;

        if (hash !== this.lastClipboardHash) {
            this.lastClipboardHash = hash;
            await Clipboard.setStringAsync(content);
            const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
            console.log('[Clipboard] Received:', preview);

            if (this.onClipboardChangeCallback) {
                this.onClipboardChangeCallback(content);
            }
        }
    }

    onClipboardChange(callback) {
        this.onClipboardChangeCallback = callback;
    }

    stopMonitoring() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            console.log('[Clipboard] Monitoring stopped');
        }
    }
}

export default ClipboardService;
