# Kubelens Mobile Build Guide

This guide explains how to build Kubelens as a mobile application (Android APK / iOS IPA) using Capacitor.

## Architecture Overview

Kubelens supports **TWO deployment modes**:

### 1. **Web Mode** (Docker/Kubernetes)
- Uses Node.js Express server with proxy
- Browser → App Container (port 80) → Proxy → Server Container (port 8080)
- Environment variables handled at runtime

### 2. **Mobile Mode** (Capacitor)
- Pure static files (HTML/CSS/JS)
- No Node.js server (can't run on mobile devices)
- Direct API calls from app to backend server
- API server URL configured at **build time**

## Prerequisites

### For Android:
- ✅ Node.js 18+ and npm
- ✅ Android Studio (latest stable version)
- ✅ Java JDK 17+
- ✅ Android SDK (API 33+)

### For iOS:
- ✅ macOS with Xcode 14+
- ✅ CocoaPods (`sudo gem install cocoapods`)
- ✅ iOS 13.0+ target

## Setup

### 1. Install Capacitor Dependencies

```bash
cd src/app
npm install
```

Capacitor dependencies are already added in `package.json`:
- `@capacitor/core`
- `@capacitor/cli`
- `@capacitor/android`
- `@capacitor/ios`
- `@capacitor/splash-screen`

### 2. Configure API Server URL

**IMPORTANT**: Before building for mobile, you MUST configure the API server URL.

Create or edit `.env.mobile`:

```bash
# Example for development
VITE_API_SERVER_URL=http://192.168.1.100:8080

# Example for staging
VITE_API_SERVER_URL=https://api-staging.kubelens.app

# Example for production
VITE_API_SERVER_URL=https://api.kubelens.app
```

⚠️ **Notes:**
- For local testing, use your computer's LAN IP (not `localhost` or `127.0.0.1`)
- For production, use HTTPS with a valid SSL certificate
- The mobile app will make direct API calls to this URL

### 3. Initialize Capacitor (First Time Only)

If you haven't initialized Capacitor yet:

```bash
npm run cap:init
```

Follow the prompts:
- App name: `Kubelens`
- App ID: `app.kubelens` (reverse domain format)
- Web directory: `dist`

This creates `capacitor.config.ts` (already configured).

## Building for Android

### Step 1: Build Mobile Version

```bash
npm run build:mobile
```

This command:
1. Compiles TypeScript
2. Builds with Vite using `mobile` mode
3. Reads `.env.mobile` for configuration
4. Outputs to `dist/` directory

### Step 2: Add Android Platform (First Time Only)

```bash
npm run cap:add:android
```

This creates `android/` directory with Android Studio project.

### Step 3: Sync Web Assets to Android

```bash
npm run cap:sync
```

Or for Android only:
```bash
npx cap sync android
```

### Step 4: Open in Android Studio

```bash
npm run cap:open:android
```

Or:
```bash
npx cap open android
```

### Step 5: Build APK

In Android Studio:
1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Wait for build to complete
3. APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

For **release build** (signed APK for Google Play):
1. **Build → Generate Signed Bundle / APK**
2. Select **APK**
3. Create or select keystore
4. Configure signing
5. Select **release** build variant

### Quick Command (Dev Build)

```bash
# Build and open in Android Studio
npm run mobile:android

# Or build, sync, and run on connected device/emulator
npm run cap:run:android
```

## Building for iOS

### Step 1: Build Mobile Version

```bash
npm run build:mobile
```

### Step 2: Add iOS Platform (First Time Only)

```bash
npm run cap:add:ios
```

### Step 3: Sync Web Assets to iOS

```bash
npm run cap:sync
```

Or for iOS only:
```bash
npx cap sync ios
```

### Step 4: Open in Xcode

```bash
npm run cap:open:ios
```

Or:
```bash
npx cap open ios
```

### Step 5: Build IPA

In Xcode:
1. Select your development team
2. Select target device/simulator
3. **Product → Archive** (for release)
4. Follow distribution wizard

### Quick Command (Dev Build)

```bash
# Build and open in Xcode
npm run mobile:ios

# Or build, sync, and run on connected device/simulator
npm run cap:run:ios
```

## npm Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run build:mobile` | Build app for mobile with `.env.mobile` config |
| `npm run cap:init` | Initialize Capacitor (first time only) |
| `npm run cap:add:android` | Add Android platform |
| `npm run cap:add:ios` | Add iOS platform |
| `npm run cap:sync` | Sync web assets to all platforms |
| `npm run cap:open:android` | Open Android project in Android Studio |
| `npm run cap:open:ios` | Open iOS project in Xcode |
| `npm run cap:run:android` | Build, sync, and run on Android |
| `npm run cap:run:ios` | Build, sync, and run on iOS |
| `npm run mobile:android` | Build and open Android project |
| `npm run mobile:ios` | Build and open iOS project |

## Testing Mobile Build Locally

### Option 1: Android Emulator
1. Open Android Studio
2. **Tools → Device Manager**
3. Create/start an emulator
4. Run `npm run cap:run:android`

### Option 2: Physical Device (Android)
1. Enable **Developer Options** on your Android device
2. Enable **USB Debugging**
3. Connect device via USB
4. Run `npm run cap:run:android`
5. Select your device from the list

### Option 3: iOS Simulator
1. Open Xcode
2. Select simulator from device menu
3. Run `npm run cap:run:ios`

### Option 4: Physical Device (iOS)
1. Connect iPhone/iPad via USB
2. Select device in Xcode
3. Configure signing & capabilities
4. Run the app

## Configuration Files

### `capacitor.config.ts`
Main Capacitor configuration:
```typescript
{
  appId: 'app.kubelens',
  appName: 'Kubelens',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  }
}
```

### `.env.mobile`
Mobile-specific environment variables (loaded at build time):
```bash
VITE_API_SERVER_URL=https://api.kubelens.app
VITE_APP_VERSION=1.0.0
```

### `src/config/env.ts`
Runtime configuration that detects platform:
- Returns `/api/v1` for web (uses proxy)
- Returns `VITE_API_SERVER_URL` for mobile (direct calls)

## Troubleshooting

### API calls failing on mobile

**Symptom**: Network errors, 404, or connection refused

**Solutions**:
1. Check `.env.mobile` has correct `VITE_API_SERVER_URL`
2. Ensure backend server is accessible from mobile device
3. For local testing, use LAN IP not `localhost`
4. Check firewall rules allow connections
5. Verify HTTPS certificate is valid (for production)

### CORS errors

**Symptom**: CORS policy errors in console

**Solution**: Configure backend server to allow requests from mobile app origin:
```go
// In backend server
cors.AllowOrigins = []string{
  "capacitor://localhost",
  "https://kubelens.app",
}
```

### App crashes on startup

**Symptom**: App closes immediately after opening

**Solutions**:
1. Check Android Studio Logcat / Xcode Console for errors
2. Verify all Capacitor plugins are installed
3. Rebuild with `npm run mobile:android` or `npm run mobile:ios`
4. Clear build cache and rebuild

### WebSocket connections not working

**Symptom**: Real-time features (terminal, logs) don't work

**Solution**: Ensure WebSocket URL is configured correctly in `src/config/env.ts`:
```typescript
// For mobile
return apiUrl.replace(/^http/, 'ws') + '/api/v1/ws'
```

### Build size too large

**Symptom**: APK/IPA over 100MB

**Solutions**:
1. Use ProGuard/R8 for Android (release build)
2. Enable code splitting in `vite.config.ts`
3. Optimize images and assets
4. Remove unused dependencies

## Deployment

### Android (Google Play Store)

1. **Generate signed APK/AAB:**
   ```bash
   npm run build:mobile
   npx cap sync android
   ```
   Then in Android Studio:
   - Build → Generate Signed Bundle / APK
   - Select **Android App Bundle** (AAB) for Play Store

2. **Upload to Play Console:**
   - https://play.google.com/console
   - Create app listing
   - Upload AAB file
   - Complete store listing
   - Submit for review

### iOS (App Store)

1. **Archive in Xcode:**
   ```bash
   npm run build:mobile
   npx cap sync ios
   npx cap open ios
   ```
   Then in Xcode:
   - Product → Archive
   - Distribute App → App Store Connect
   - Upload

2. **Submit to App Store:**
   - https://appstoreconnect.apple.com
   - Create app record
   - Complete app information
   - Submit for review

## Best Practices

### 1. **Separate API URLs by Environment**

Use different `.env` files:
```bash
# .env.mobile.development
VITE_API_SERVER_URL=http://192.168.1.100:8080

# .env.mobile.staging
VITE_API_SERVER_URL=https://api-staging.kubelens.app

# .env.mobile.production
VITE_API_SERVER_URL=https://api.kubelens.app
```

### 2. **Always Use HTTPS in Production**

Never ship mobile apps with HTTP URLs in production:
- App stores may reject HTTP connections
- User data will be exposed
- Modern browsers block mixed content

### 3. **Test on Real Devices**

Emulators/simulators don't always behave like real devices:
- Test on multiple Android versions
- Test on different screen sizes
- Test on both Android and iOS

### 4. **Handle Network Failures Gracefully**

Mobile networks are unreliable:
- Show loading states
- Display error messages
- Implement retry logic
- Cache data when possible

### 5. **Monitor App Performance**

Use tools like:
- Firebase Crashlytics
- Sentry
- Android Vitals
- Xcode Instruments

## Migration Path

If you need to update the mobile app after changing the API:

1. **Update API server** (backend)
2. **Update web app** (frontend for web)
3. **Build new mobile version**:
   ```bash
   npm run build:mobile
   npx cap sync
   ```
4. **Test thoroughly**
5. **Submit to app stores**
6. **Wait for approval** (can take days/weeks)
7. **Users update app**

⚠️ **Important**: Always maintain backward compatibility in your API to support older mobile app versions that users haven't updated yet.

## Support

For issues or questions:
- Check Capacitor docs: https://capacitorjs.com/docs
- GitHub Issues: https://github.com/your-org/kubelens/issues
- Community: https://discord.gg/your-server

