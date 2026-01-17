# Building for Android

Since this app uses `react-native-webrtc`, it requires a **custom development build** (not Expo Go).

## Quick Start (Recommended)

### Option 1: Build Locally with Android Studio

1. **Install Android Studio** and set up Android SDK
2. **Build the development client**:
   ```bash
   npx expo run:android
   ```

This will:
- Build the native Android app with WebRTC support
- Install it on your connected device/emulator
- Start the Metro bundler

### Option 2: Use EAS Build (Cloud Build)

1. **Install EAS CLI**:
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo**:
   ```bash
   eas login
   ```

3. **Configure EAS**:
   ```bash
   eas build:configure
   ```

4. **Build for Android**:
   ```bash
   eas build --profile development --platform android
   ```

5. **Install the APK** on your device when build completes

6. **Start the dev server**:
   ```bash
   npx expo start --dev-client
   ```

## Why Development Build?

- **Expo Go** doesn't support native modules like `react-native-webrtc`
- **Development Build** includes all native dependencies
- Works just like Expo Go but with your custom native code

## Testing

Once the development build is installed:

1. **Start Python server** (on your computer):
   ```bash
   cd ..
   python main.py --host
   ```

2. **Start Expo dev server**:
   ```bash
   npx expo start --dev-client
   ```

3. **Open app** on your Android device (it should auto-connect to Metro)

4. **Test the connection**:
   - Use Host mode on one device
   - Use Join mode on another
   - Enter your computer's IP address (e.g., `192.168.1.100`)

## Troubleshooting

### "No development build found"
- Make sure you've built and installed the development build first
- Run `npx expo run:android` to build locally

### "Metro bundler not connecting"
- Ensure your device and computer are on the same network
- Try shaking the device and selecting "Settings" → "Change Bundle Location"
- Enter your computer's IP manually

### Build errors
- Make sure Android SDK is properly installed
- Check that `ANDROID_HOME` environment variable is set
- Try cleaning: `cd android && ./gradlew clean && cd ..`
