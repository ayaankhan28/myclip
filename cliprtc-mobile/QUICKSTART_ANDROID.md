# Quick Start Guide - Android

## ✅ What's Been Done

Your app is now configured for Android with:
- ✅ `react-native-webrtc` installed
- ✅ Android permissions added (Camera, Microphone, Internet)
- ✅ Metro bundler configured
- ✅ Development build setup

## 🚀 How to Run on Android

### Option 1: Quick Build (Recommended)

```bash
npx expo run:android
```

This single command will:
1. Build the native Android app with WebRTC
2. Install it on your connected device/emulator
3. Start the Metro bundler
4. Launch the app

**Requirements:**
- Android Studio installed
- Android device connected OR emulator running
- USB debugging enabled (for physical device)

### Option 2: Cloud Build (If you don't have Android Studio)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure
eas build:configure

# Build APK
eas build --profile development --platform android

# After build completes, download and install the APK
# Then start dev server:
npx expo start --dev-client
```

## 📱 Testing Steps

1. **Start Python server** (on your computer):
   ```bash
   cd ..
   python main.py --host
   ```

2. **Build and run Android app**:
   ```bash
   npx expo run:android
   ```

3. **Test the app**:
   - Tap "Host" to create a room
   - Note the 6-digit code
   - On another device, tap "Join"
   - Enter your computer's IP (e.g., `192.168.1.100`)
   - Enter the 6-digit code
   - Start messaging!

## 🔧 Troubleshooting

### "Android SDK not found"
Install Android Studio and set up Android SDK

### "No devices found"
- Connect your Android device via USB
- Enable USB debugging in Developer Options
- OR start an Android emulator

### "Build failed"
```bash
# Clear cache and rebuild
cd android
./gradlew clean
cd ..
npx expo run:android
```

## 📚 More Details

See [ANDROID_BUILD.md](./ANDROID_BUILD.md) for comprehensive instructions.
