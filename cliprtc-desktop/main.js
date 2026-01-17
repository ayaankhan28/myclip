const { app, Tray, Menu, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const SignalingServer = require('./src/signaling-server');
const WebRTCClient = require('./src/webrtc-client');
const ClipboardSync = require('./src/clipboard-sync');
const StateManager = require('./src/state-manager');
const { generateRoomCode, getLocalIP } = require('./src/config');

let tray = null;
let signalingServer = null;
let webrtcClient = null;
let clipboardSync = null;
let stateManager = null;
let joinWindow = null;
let qrcodeWindow = null;

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // Focus on the tray or show a notification
        if (tray) {
            tray.displayBalloon({
                title: 'ClipRTC',
                content: 'Application is already running in system tray'
            });
        }
    });
}

app.whenReady().then(() => {
    initializeApp();
});

app.on('window-all-closed', (e) => {
    // Prevent app from quitting when all windows are closed
    e.preventDefault();
});

app.on('before-quit', async () => {
    await cleanup();
});

function initializeApp() {
    stateManager = new StateManager();
    clipboardSync = new ClipboardSync();

    // Create system tray
    createTray();

    // Listen to state changes
    stateManager.on('stateChanged', updateTrayMenu);

    console.log('[ClipRTC] Application started');
}

function createTray() {
    const { nativeImage } = require('electron');
    const fs = require('fs');

    // Use a simple icon (you can replace with custom icon)
    const iconPath = path.join(__dirname, 'build', 'tray-icon.png');

    let trayIcon;
    if (fs.existsSync(iconPath)) {
        trayIcon = nativeImage.createFromPath(iconPath);
        // Resize for tray (22x22 is ideal for macOS)
        trayIcon = trayIcon.resize({ width: 22, height: 22 });
        // Use template mode for macOS (auto-adapts to dark/light mode)
        if (process.platform === 'darwin') {
            trayIcon.setTemplateImage(true);
        }
    } else {
        // Create a simple fallback
        console.warn('[Tray] Icon not found, using empty icon');
        trayIcon = nativeImage.createEmpty();
    }

    tray = new Tray(trayIcon);
    tray.setToolTip('ClipRTC - Clipboard Sync');

    updateTrayMenu();

    // Show a notification to help users find the app
    setTimeout(() => {
        if (tray) {
            tray.displayBalloon({
                title: 'ClipRTC Started',
                content: 'ClipRTC is running in your system tray. Click the icon to get started!'
            });
        }
    }, 1000);
}

function updateTrayMenu() {
    const state = stateManager.getState();
    const menu = [];

    if (state.mode === 'idle') {
        menu.push(
            { label: '🟢 Start Host Mode', click: startHostMode },
            { label: '🔵 Join Room...', click: showJoinDialog },
            { type: 'separator' }
        );
    } else if (state.mode === 'host') {
        menu.push(
            { label: `📡 Hosting Room: ${state.roomCode}`, enabled: false },
            { label: `🌐 Server IP: ${state.serverIP}:8080`, enabled: false },
            { label: `👥 Connected Peers: ${state.connectedPeers}`, enabled: false },
            { label: '📋 Copy Connection Info', click: copyConnectionInfo },
            { label: '📱 Show QR Code', click: showQRCode },
            { type: 'separator' },
            { label: '🛑 Stop Hosting', click: stopMode }
        );
    } else if (state.mode === 'join') {
        menu.push(
            { label: `📡 Connected to Room: ${state.roomCode}`, enabled: false },
            { label: `👥 Connected Peers: ${state.connectedPeers}`, enabled: false },
            { type: 'separator' },
            { label: '🛑 Disconnect', click: stopMode }
        );
    }

    menu.push(
        { label: 'About', click: showAbout },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
    );

    const contextMenu = Menu.buildFromTemplate(menu);
    tray.setContextMenu(contextMenu);
}

async function startHostMode() {
    try {
        console.log('[Host] Starting host mode...');

        // Start signaling server
        signalingServer = new SignalingServer();
        await signalingServer.start();

        const localIP = await getLocalIP();
        console.log(`[Host] Server started on ${localIP}:8080`);

        // Generate room code
        const roomCode = generateRoomCode();

        // Start WebRTC client
        webrtcClient = new WebRTCClient();
        await webrtcClient.connect(roomCode, 'http://127.0.0.1:8080');

        // Start clipboard sync
        clipboardSync.start(webrtcClient);

        // Update state
        stateManager.setState({
            mode: 'host',
            roomCode: roomCode,
            serverIP: localIP
        });

        // Listen for connection updates
        webrtcClient.on('connectionCountChanged', (count) => {
            stateManager.updateConnectedPeers(count);
        });

        // Show notification
        tray.displayBalloon({
            title: 'ClipRTC - Host Mode',
            content: `Server IP: ${localIP}:8080\nRoom Code: ${roomCode}\n\nShare these details with others to connect!`
        });

        console.log(`[Host] Room Code: ${roomCode}`);
        console.log(`[Host] Server IP: ${localIP}:8080`);
        console.log(`[Host] Share this info with others to connect!`);
    } catch (error) {
        console.error('[Host] Error starting host mode:', error);
        dialog.showErrorBox('Error', `Failed to start host mode: ${error.message}`);
        await stopMode();
    }
}

function showJoinDialog() {
    if (joinWindow) {
        joinWindow.focus();
        return;
    }

    joinWindow = new BrowserWindow({
        width: 400,
        height: 300,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    joinWindow.loadFile(path.join(__dirname, 'src', 'windows', 'join-dialog.html'));

    joinWindow.on('closed', () => {
        joinWindow = null;
    });
}

async function startJoinMode(serverIP, roomCode) {
    try {
        console.log(`[Join] Connecting to ${serverIP}:8080, Room: ${roomCode}`);

        const serverURL = `http://${serverIP}:8080`;

        // Start WebRTC client
        webrtcClient = new WebRTCClient();
        await webrtcClient.connect(roomCode, serverURL);

        // Start clipboard sync
        clipboardSync.start(webrtcClient);

        // Update state
        stateManager.setState({
            mode: 'join',
            roomCode: roomCode,
            serverIP: serverIP
        });

        // Listen for connection updates
        webrtcClient.on('connectionCountChanged', (count) => {
            stateManager.updateConnectedPeers(count);
        });

        // Show notification
        tray.displayBalloon({
            title: 'ClipRTC - Connected',
            content: `Connected to room ${roomCode}`
        });

        console.log(`[Join] Connected to room ${roomCode}`);

        // Close join window
        if (joinWindow) {
            joinWindow.close();
        }
    } catch (error) {
        console.error('[Join] Error joining room:', error);
        dialog.showErrorBox('Error', `Failed to join room: ${error.message}`);
        await stopMode();
    }
}

async function stopMode() {
    console.log('[App] Stopping current mode...');

    // Stop clipboard sync
    if (clipboardSync) {
        clipboardSync.stop();
    }

    // Close WebRTC connections
    if (webrtcClient) {
        await webrtcClient.close();
        webrtcClient = null;
    }

    // Stop signaling server
    if (signalingServer) {
        await signalingServer.stop();
        signalingServer = null;
    }

    // Reset state
    stateManager.setState({
        mode: 'idle',
        roomCode: null,
        serverIP: null,
        connectedPeers: 0
    });

    console.log('[App] Stopped');
}

async function cleanup() {
    await stopMode();
}

function copyRoomCode() {
    const state = stateManager.getState();
    if (state.roomCode) {
        require('electron').clipboard.writeText(state.roomCode);
        tray.displayBalloon({
            title: 'Room Code Copied',
            content: `Room code ${state.roomCode} copied to clipboard`
        });
    }
}

function copyConnectionInfo() {
    const state = stateManager.getState();
    if (state.roomCode && state.serverIP) {
        const connectionInfo = `Server IP: ${state.serverIP}:8080\nRoom Code: ${state.roomCode}`;
        require('electron').clipboard.writeText(connectionInfo);
        tray.displayBalloon({
            title: 'Connection Info Copied',
            content: 'Server IP and room code copied to clipboard'
        });
    }
}

function showAbout() {
    dialog.showMessageBox({
        type: 'info',
        title: 'About ClipRTC',
        message: 'ClipRTC Desktop',
        detail: 'Version 1.0.0\n\nCross-platform WebRTC clipboard synchronization\n\nBuilt with Electron'
    });
}

function showQRCode() {
    if (qrcodeWindow) {
        qrcodeWindow.focus();
        return;
    }

    const state = stateManager.getState();
    if (state.mode !== 'host') {
        dialog.showMessageBox({
            type: 'warning',
            title: 'Not in Host Mode',
            message: 'QR Code is only available in host mode'
        });
        return;
    }

    qrcodeWindow = new BrowserWindow({
        width: 500,
        height: 650,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        title: 'Connection QR Code'
    });

    qrcodeWindow.loadFile(path.join(__dirname, 'src', 'windows', 'qrcode-window.html'));

    qrcodeWindow.on('closed', () => {
        qrcodeWindow = null;
    });
}

// IPC handlers for join dialog
ipcMain.on('join-room', (event, { serverIP, roomCode }) => {
    startJoinMode(serverIP, roomCode);
});

// IPC handlers for QR code window
ipcMain.on('request-connection-info', (event) => {
    const state = stateManager.getState();
    if (qrcodeWindow) {
        qrcodeWindow.webContents.send('connection-info', {
            roomCode: state.roomCode,
            serverIP: `${state.serverIP}:8080`
        });
    }
});

console.log('[ClipRTC] Main process loaded');
