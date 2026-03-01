# Eco-DMS Mobile App

React Native mobile application built with Expo for cross-platform development.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- For Android: Android Studio with Android SDK
- For iOS: iPhone with Expo Go app installed

### Installation

```bash
cd apps/mobile
npm install
```

## 📱 Running the App

### Method 1: Testing on iPhone (via QR Code)

1. Install **Expo Go** app on your iPhone from the App Store
2. Make sure your iPhone and computer are on the same WiFi network
3. Start the development server:
   ```bash
   npm start
   ```
4. Scan the QR code displayed in the terminal with your iPhone camera
5. The app will open in Expo Go

**Alternative (if QR code doesn't work):**
```bash
npm start -- --tunnel
```
This creates a tunnel that works even if devices are on different networks.

### Method 2: Testing on Android Emulator (Windows)

#### Setup Android Emulator (First Time Only)

1. **Install Android Studio:**
   - Download from: https://developer.android.com/studio
   - During installation, make sure to install Android SDK, Android SDK Platform, and Android Virtual Device

2. **Setup Environment Variables:**
   - Open System Environment Variables
   - Add these to your PATH:
     ```
     C:\Users\YourUsername\AppData\Local\Android\Sdk\platform-tools
     C:\Users\YourUsername\AppData\Local\Android\Sdk\emulator
     ```

3. **Create Virtual Device:**
   - Open Android Studio
   - Go to: Tools → Device Manager
   - Click "Create Device"
   - Select a phone (e.g., Pixel 5)
   - Download and select a system image (e.g., Android 13 - API 33)
   - Click Finish

#### Run on Android Emulator

1. Start Android Emulator from Android Studio's Device Manager, OR:
   ```bash
   # List available emulators
   emulator -list-avds
   
   # Start specific emulator
   emulator -avd Pixel_5_API_33
   ```

2. In a separate terminal, start the Expo app:
   ```bash
   npm run android
   ```

The app will automatically install and run on the emulator.

### Method 3: Web Browser (For Quick Testing)

```bash
npm run web
```

## 🧪 Testing the App

Once the app is running on your device:

1. You should see "🌱 Eco-DMS Mobile Test App"
2. Platform information will be displayed
3. Tap the "Run Tests" button
4. Verify all tests pass with green checkmarks

**Expected Results:**
- ✅ Platform detection (iOS/Android)
- ✅ Platform version
- ✅ React Native working
- ✅ State management working
- ✅ Touch events working

## 🛠️ Development Commands

```bash
# Start development server
npm start

# Start with tunnel (for testing across networks)
npm start -- --tunnel

# Start on Android
npm run android

# Start on iOS (requires Mac)
npm run ios

# Start on web
npm run web

# Clear cache and restart
npm start -- --clear
```

## 📋 Troubleshooting

### Android Emulator Issues

**Problem: "adb: command not found"**
- Solution: Add Android SDK platform-tools to your PATH

**Problem: Emulator is slow**
- Solution 1: Enable hardware acceleration (HAXM for Intel, WHPX for AMD)
- Solution 2: Increase RAM allocation in AVD settings (4GB+)

**Problem: Metro bundler connection failed**
- Solution: Run `adb reverse tcp:8081 tcp:8081`

### iPhone/iOS Issues

**Problem: QR code not working**
- Solution 1: Ensure both devices are on same WiFi network
- Solution 2: Use tunnel mode: `npm start -- --tunnel`
- Solution 3: Manually type the connection URL in Expo Go app

**Problem: "Couldn't connect to Metro"**
- Solution: Check firewall settings or try tunnel mode

### General Issues

**Problem: "Port 8081 already in use"**
```bash
# Kill existing Metro bundler
npx kill-port 8081
# or on Windows:
Get-Process node | Stop-Process -Force
```

**Problem: Changes not reflecting**
```bash
npm start -- --clear
```

## 📁 Project Structure

```
apps/mobile/
├── App.tsx              # Main app component
├── app.json            # Expo configuration
├── package.json        # Dependencies
├── tsconfig.json       # TypeScript config
├── assets/             # Images and icons
└── README.md           # This file
```

## 🔧 Configuration

### app.json
- App name, icon, splash screen configuration
- Platform-specific settings (iOS/Android)
- Bundle identifiers

### package.json
- Dependencies (React Native, Expo)
- Scripts for running on different platforms

## 📦 Technologies Used

- **React Native**: Cross-platform mobile framework
- **Expo**: Development platform for universal apps
- **TypeScript**: Type-safe JavaScript
- **React 19**: UI library

## 🎯 Next Steps

Once you've verified the app works on both platforms:

1. Add navigation (React Navigation)
2. Integrate with backend API
3. Add authentication
4. Implement core features
5. Add platform-specific optimizations

## 📝 Notes

- This is a test app to verify the setup works correctly
- iOS testing requires Expo Go app (no Mac or Xcode needed)
- Android testing can be done via emulator on Windows
- For production builds, you'll need EAS Build or native compilation

## 🆘 Get Help

- Expo Documentation: https://docs.expo.dev
- React Native Documentation: https://reactnative.dev
- Troubleshooting: https://docs.expo.dev/troubleshooting/
