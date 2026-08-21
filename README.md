# ChuchPlayer

A high-performance Android TV IPTV player built with Expo and React Native. Native Kotlin modules deliver near-instant stream starts, smooth EPG scrolling, and support for 10k+ channel playlists.

## Features

- **Native ExoPlayer** — Direct Media3 integration, 1s min buffer (vs 15s default), streams start in 1-2 seconds
- **Instant Channel Switching** — Zero artificial delays, single-call Zustand state updates, memoized renders
- **Android TV Remote** — Full D-pad navigation with spatial focus management, TV-native FocusableItem components
- **Focused-Channel EPG Guide** — Side panel shows current/next programs per channel; D-pad right enters the guide, up/down scrolls through program history; past programs shown for catchup channels
- **Catchup / Timeshift** — Native EPG grid detects catchup-enabled channels, builds Xtream timeshift URLs, plays past programs directly
- **Channel List Panel** — 60% transparent sliding panel with search, tabs (All / Favorites / Recent), group filter, and D-pad left to open groups
- **EPG Grid (Kotlin Canvas)** — Native Android canvas-drawn EPG, 72-hour catchup window, cursor-based time selection, accent color theming
- **M3U / Xtream Codes** — Kotlin streaming M3U parser handles 10k+ channels without JS thread freeze; Xtream API support
- **Smart EPG Caching** — Realm DB with indexes on `playlistId`, `channelId`, `start`, `end`; AsyncStorage cold-boot guard skips network re-ingest within 4 hours
- **Disk-Cached Logos** — `expo-image` with `cachePolicy="disk"` for instant logo rendering on re-open
- **Material Icons** — `@expo/vector-icons` MaterialCommunityIcons throughout the player overlay
- **Web Player** — Companion web UI with Playwright e2e tests
- **Web Xtream Proxy** — Metro proxies provider APIs, XMLTV, HLS, and VOD through `/api/xtream` during local web development to avoid browser CORS and mixed-content failures
- **Large Web Playlists** — Channel and VOD payloads use IndexedDB on web instead of the browser's small `localStorage` quota

## Quick Start

```bash
npm install
npm start          # Expo dev server (a=Android, w=Web, i=iOS)
npm run web        # Web only (fastest for UI work, no video playback)
npm run android    # Android emulator/device
```

The Xtream web proxy is attached to the Expo Metro development server. Static web exports must be hosted behind a server that mounts `server/xtreamProxy.js` at `/api/xtream`; a static file host alone cannot proxy provider traffic.

## Building for Android TV

```bash
# Release APK (requires Android Studio / SDK)
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME=~/Library/Android/sdk
cd android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

```bash
# EAS development build (for Expo dev client)
eas login && eas build:configure
eas build --platform android --profile development
npx expo start --dev-client
```

## Project Structure

```
ChuchPlayer/
├── App.tsx                          # Root: GestureHandler, SafeArea, Toast, refresh scheduler
├── src/
│   ├── screens/PlayerScreen.tsx     # Main player screen, wires all hooks and overlays
│   ├── components/player/           # ChannelInfoBar, ChannelListPanel, EPGGridView, EPGOverlay …
│   ├── components/webPlayer/        # Web-only player components
│   ├── hooks/                       # useEPGManagement, useChannelNavigation, useVideoPlayback …
│   ├── store/                       # Zustand stores (player, UI, EPG, refresh, multi-screen)
│   ├── database/                    # Realm EPG database (native) / IndexedDB (web)
│   ├── services/                    # nativeEpgIngestion.ts — JS↔Kotlin bridge
│   └── utils/                       # M3U / Xtream parsers, AsyncStorage helpers
├── native/android/src/main/java/com/chuchplayer/
│   ├── epg/                         # EpgIngestionModule.kt, EpgGridView.kt, RealmModels.kt
│   ├── player/                      # ExoPlayerModule.kt, ExoPlayerViewManager.kt
│   └── playlist/                    # PlaylistParserModule.kt
├── tests/
│   ├── e2e/                         # Playwright web player tests
│   └── …
└── src/hooks/__tests__/             # Jest unit tests
```

## Native Modules (Kotlin)

| Module | Purpose |
|--------|---------|
| `ExoPlayerModule` | Direct Media3/ExoPlayer with 1s min buffer, `loadSource`, `preloadSource`, playback events |
| `PlaylistParserModule` | Line-by-line streaming M3U parser on `Dispatchers.IO`, no JS thread block |
| `EpgIngestionModule` | XMLTV parser → Realm DB, background WorkManager sync, `queryPrograms` with indexes |
| `EpgGridView` | Native Canvas EPG grid, 72h catchup window, cursor time-selection, `EPG_CATCHUP_SELECT` event |

## EPG Caching Strategy

1. **Cold boot** — AsyncStorage checked first. If last ingest matches the playlist signature and is < 4 hours old, programs are loaded from Realm only (no network).
2. **Cache hit** — Realm metadata signature matches: serve from DB, skip re-ingest if < 4 hours stale.
3. **Cache miss** — Kotlin background thread fetches + parses XMLTV, writes to Realm in 2000-record batches, updates AsyncStorage timestamp.
4. **Background refresh** — WorkManager schedules periodic re-sync every 4 hours.

## Running Tests

```bash
# Unit tests (Jest)
npm test

# E2E tests (Playwright — requires web server running)
npm run web &
npx playwright test
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Styles not appearing | `npx expo start --clear` to bust Metro cache |
| `#realm.node` on web | Realm imports must be guarded by `Platform.OS !== 'web'` |
| EPG not loading | Check EPG URL in playlist settings; first open after install triggers full ingest |
| Focus issues on TV | Check `FocusableItem` and verify keyboard nav hooks are firing |
| Large playlist freeze | Use native build — Kotlin parser runs on IO thread, JS parser is for web only |
