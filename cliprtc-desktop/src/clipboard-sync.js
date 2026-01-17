const { clipboard } = require('electron');
const crypto = require('crypto');

class ClipboardSync {
    constructor() {
        this.webrtcClient = null;
        this.lastClipboardHash = null;
        this.monitorInterval = null;
        this.isRunning = false;
    }

    start(webrtcClient) {
        if (this.isRunning) {
            console.log('[ClipboardSync] Already running');
            return;
        }

        this.webrtcClient = webrtcClient;
        this.isRunning = true;

        // Listen for incoming clipboard messages
        this.webrtcClient.on('message', (message, fromPeer) => {
            this.handleMessage(message, fromPeer);
        });

        // Start monitoring clipboard
        this.startMonitoring();
        console.log('[ClipboardSync] Started monitoring clipboard');
    }

    stop() {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        this.isRunning = false;
        this.webrtcClient = null;
        console.log('[ClipboardSync] Stopped');
    }

    startMonitoring() {
        // Check clipboard every 500ms
        this.monitorInterval = setInterval(() => {
            this.checkClipboard();
        }, 500);
    }

    checkClipboard() {
        try {
            const current = clipboard.readText();

            if (current) {
                const currentHash = this.getClipboardHash(current);

                if (currentHash !== this.lastClipboardHash) {
                    this.lastClipboardHash = currentHash;
                    const preview = current.length > 50 ? current.substring(0, 50) + '...' : current;
                    console.log(`[ClipboardSync] Syncing: ${preview}`);
                    this.broadcastClipboard(current, currentHash);
                }
            }
        } catch (error) {
            console.error('[ClipboardSync] Error checking clipboard:', error);
        }
    }

    broadcastClipboard(content, contentHash) {
        const message = JSON.stringify({
            type: 'clipboard',
            content: content,
            hash: contentHash
        });

        const sentCount = this.webrtcClient.broadcastMessage(message);
        if (sentCount > 0) {
            console.log(`[ClipboardSync] Sent to ${sentCount} peer(s)`);
        }
    }

    handleMessage(message, fromPeer) {
        try {
            const data = JSON.parse(message);

            if (data.type === 'clipboard') {
                const content = data.content;
                const contentHash = data.hash;

                if (contentHash !== this.lastClipboardHash) {
                    this.lastClipboardHash = contentHash;
                    clipboard.writeText(content);
                    const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
                    console.log(`[ClipboardSync] Received from ${fromPeer.substring(0, 8)}...: ${preview}`);
                }
            }
        } catch (error) {
            // Not JSON or error parsing
            console.error('[ClipboardSync] Error handling message:', error);
        }
    }

    getClipboardHash(text) {
        return crypto.createHash('md5').update(text, 'utf8').digest('hex');
    }
}

module.exports = ClipboardSync;
