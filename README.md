# chuchPlayer (Expo Edition) 📺

A fresh Expo build of the Android TV IPTV player. This project focuses on a TV-first experience with playlist management, channel browsing, and video playback powered by `expo-av`.

## Features

- 📺 IPTV playback with M3U/M3U8 playlists
- 🎮 Android TV remote navigation with focus states
- 🔍 Channel search and category filters
- 📂 Playlist management stored via AsyncStorage
- ⚙️ Configurable settings (autoplay, theme toggle)
- 💾 Favorites support (API ready)
- 🧩 Custom Expo config plugin for Android TV leanback launcher

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start the project

```bash
# start the Expo dev server
npm start

# or launch directly in the browser (UI testing)
npm run web
```

Expo will open a Dev Tools window where you can choose:
- `a` – launch on Android (emulator or device)
- `w` – open in the browser
- Scan the QR code with Expo Go (phone/tablet)

> **Tip:** Web mode is great for UI development. Video playback uses `expo-av`, so a native build is required for streaming tests.

## Android TV Development Build

Expo Go does not support Android TV. To test on actual hardware:

1. Install EAS CLI (once):
   ```bash
   npm install -g eas-cli
   ```
2. Login and configure the project:
   ```bash
   eas login
   eas build:configure
   ```
3. Create a development build for Android:
   ```bash
   eas build --platform android --profile development
   ```
4. Install the APK on your Android TV device and start the dev client:
   ```bash
   npx expo start --dev-client
   ```

## Project Structure

```
chuchPlayerExpo/
├── App.tsx                       # Root component, wraps navigator
├── app.json                      # Expo configuration + TV plugin
├── expo-plugins/android-tv.js    # Adds leanback launcher + TV features
├── index.ts                      # Expo entry point
├── src/
│   ├── components/               # Focusable UI building blocks
│   ├── navigation/               # Stack navigator setup
│   ├── screens/                  # Home, Channels, Player, Settings
│   ├── types/                    # Shared TypeScript types
│   └── utils/                    # M3U parser + AsyncStorage helpers
└── tsconfig.json
```

## Key Libraries

- [`expo-av`](https://docs.expo.dev/versions/latest/sdk/av/) – video playback
- [`@react-navigation/native`](https://reactnavigation.org/) – navigation
- [`@react-native-async-storage/async-storage`](https://react-native-async-storage.github.io/async-storage/) – local storage
- [`react-native-gesture-handler`](https://docs.swmansion.com/react-native-gesture-handler/) – focusable pressables

All dependencies are added via `expo install` to ensure SDK compatibility.

## M3U Playlist Sample

Use any M3U/M3U8 URL that provides stream URLs. Example entry:

```
#EXTM3U
#EXTINF:-1 tvg-id="channel1" tvg-name="Example Channel" tvg-logo="http://example.com/logo.png" group-title="News",Example Channel
http://example.com/stream.m3u8
```

## Troubleshooting

- **Playlist fails to load**: Ensure the URL returns a valid M3U playlist.
- **Video doesn’t play on web**: Expected. Use Android build for playback testing.
- **Focus issues on TV**: Check `FocusableItem.tsx` for focus styling and events.
- **Need more diagnostics**: Enable Expo’s development menu (`Ctrl+D` or `Cmd+D`).

## Next Steps / Ideas

- Favorites UI & filtering
- EPG integration
- Multiple audio/subtitle tracks
- Picture-in-picture support (Android TV)

Enjoy building with Expo! 🎉

