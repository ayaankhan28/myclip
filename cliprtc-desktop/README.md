# ClipRTC Desktop

Cross-platform WebRTC clipboard synchronization desktop application for macOS and Windows.

## Features

✅ **WebRTC Mesh Networking** - Direct peer-to-peer connections between all devices  
✅ **Automatic Clipboard Sync** - Copy on one device, paste on another instantly  
✅ **Host & Join Modes** - Host creates a room, others join with a 6-digit code  
✅ **System Tray App** - Runs quietly in the background  
✅ **Multi-Peer Support** - Connect multiple devices simultaneously  
✅ **Cross-Platform** - Works on macOS and Windows  

## Installation

### From Source

1. **Clone the repository**
   ```bash
   cd cliprtc-desktop
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the application**
   ```bash
   npm start
   ```

### Building Installers

**For macOS:**
```bash
npm run build:mac
```

**For Windows:**
```bash
npm run build:win
```

**For both platforms:**
```bash
npm run build:all
```

The installers will be created in the `dist/` directory.

## Usage

### Host Mode

1. Click the system tray icon
2. Select **"Start Host Mode"**
3. A 6-digit room code will be generated
4. Share this code with other devices
5. Your clipboard is now syncing!

### Join Mode

1. Click the system tray icon
2. Select **"Join Room..."**
3. Enter the host's IP address (e.g., `192.168.1.100`)
4. Enter the 6-digit room code
5. Click **"Connect"**
6. Your clipboard is now syncing!

## How It Works

1. **Signaling Server**: In host mode, a WebSocket server runs on port 8080 to coordinate peer connections
2. **WebRTC Connections**: Peers establish direct WebRTC data channels for clipboard data
3. **Clipboard Monitoring**: The app monitors your clipboard every 500ms for changes
4. **Hash-Based Sync**: MD5 hashes prevent duplicate syncs and loops
5. **Mesh Network**: All peers connect to each other directly (not through the host)

## Network Requirements

- **Host Mode**: Port 8080 must be accessible to other devices
- **Firewall**: You may need to allow incoming connections on port 8080
- **Same Network**: Devices should be on the same local network (or use port forwarding for remote connections)

## Troubleshooting

### macOS Clipboard Permissions

On macOS, you may need to grant accessibility permissions:
1. Go to **System Preferences** → **Security & Privacy** → **Privacy**
2. Select **Accessibility**
3. Add ClipRTC to the list of allowed apps

### Connection Issues

- Verify the host's IP address is correct
- Check that port 8080 is not blocked by firewall
- Ensure all devices are on the same network
- Try using `localhost` if testing on the same machine

### Clipboard Not Syncing

- Check that peers are connected (look at the peer count in the tray menu)
- Verify clipboard monitoring is working (check console logs)
- Try copying different types of content (plain text works best)

## Architecture

```
cliprtc-desktop/
├── main.js                    # Electron main process
├── src/
│   ├── signaling-server.js    # WebSocket signaling server
│   ├── webrtc-client.js       # WebRTC peer connection manager
│   ├── clipboard-sync.js      # Clipboard monitoring & sync
│   ├── state-manager.js       # Application state management
│   ├── config.js              # Configuration utilities
│   └── windows/
│       └── join-dialog.html   # Join room dialog
├── build/                     # App icons
└── package.json
```

## Technologies

- **Electron** - Cross-platform desktop framework
- **wrtc** - WebRTC implementation for Node.js
- **ws** - WebSocket server and client
- **clipboardy** - Cross-platform clipboard access

## License

MIT

## Credits

Based on the ClipRTC Python implementation with WebRTC mesh networking.
