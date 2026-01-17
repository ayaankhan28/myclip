# ClipRTC Mobile

A simple React Native Expo mobile app for WebRTC peer-to-peer connections with 6-digit room codes.

## Features

- **Host Mode**: Create a room with a 6-digit code
- **Join Mode**: Connect to a room using host IP and code
- **Real-time Messaging**: Send and receive messages via WebRTC data channels
- **Modern UI**: Clean, dark-themed interface
- **Web-based**: Uses browser's native WebRTC API (works in Expo Go web)

## Prerequisites

- Node.js and npm installed
- Expo CLI (`npm install -g expo-cli`)
- Python signaling server running (from the main `cliprtc` project)

## Installation

```bash
npm install
```

## Running the App

### For Android (Recommended)

Since this app uses `react-native-webrtc`, you need a **development build** (not Expo Go):

```bash
# Build and run on Android
npx expo run:android
```

This will build the app with native WebRTC support and install it on your device/emulator.

**See [ANDROID_BUILD.md](./ANDROID_BUILD.md) for detailed Android setup instructions.**

### For Web

```bash
npm start
# Then press 'w' to open in browser
```

### For iOS

```bash
# Build and run on iOS
npx expo run:ios
```

## Usage

### Host Mode

1. Start the Python signaling server on your computer:
   ```bash
   cd ../
   python main.py --host
   ```

2. Open the mobile app and tap "Host"
3. The app will display a 6-digit room code
4. Share this code with the peer you want to connect with

### Join Mode

1. Make sure the host has started their session
2. Get the host's IP address and room code
3. Open the mobile app and tap "Join"
4. Enter the host IP address (e.g., `192.168.1.100`)
5. Enter the 6-digit room code
6. Tap "Connect"

## Architecture

- **SignalingService**: WebSocket client for connecting to the Python signaling server
- **WebRTCService**: Handles WebRTC peer connections and data channels
- **Screens**:
  - `ModeSelection`: Choose between Host and Join modes
  - `HostScreen`: Display room code and chat interface
  - `JoinScreen`: Input form and chat interface

## Network Configuration

The app connects to the signaling server via WebSocket:
- **Host mode**: Connects to `ws://localhost:8080`
- **Join mode**: Connects to `ws://<host-ip>:8080`

Make sure:
1. The Python signaling server is running
2. Devices are on the same network
3. Firewall allows port 8080

## Troubleshooting

### "WebRTC native module not found" Error

You need to use a **development build** instead of Expo Go:

```bash
npx expo run:android  # For Android
npx expo run:ios      # For iOS
```

See [ANDROID_BUILD.md](./ANDROID_BUILD.md) for detailed instructions.

### Connection Issues

- Verify the Python server is running: `python main.py --host`
- Check that both devices/browsers are accessible to each other
- Ensure the host IP address is correct
- Try using `localhost` if testing on the same machine

### WebRTC Not Working

- Make sure you're using a development build (not Expo Go)
- Check console/logcat for errors
- Verify STUN servers are accessible
- Ensure WebSocket connection is established first

## Technologies

- **React Native + Expo**: Mobile framework
- **react-native-webrtc**: WebRTC implementation for native platforms
- **Expo Development Build**: Custom native build with WebRTC support
- **React Navigation**: Screen navigation
- **WebSocket**: Signaling protocol

## Future Enhancements

- [ ] Clipboard synchronization
- [ ] File sharing
- [ ] Multiple peer support
- [ ] Network discovery (mDNS/Bonjour)
- [ ] Persistent connection history
