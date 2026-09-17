# ChuchPlayer

A high-performance Android TV IPTV player built with Expo and React Native. Kotlin modules keep playlist ingestion and guide rendering off the JavaScript thread, while the app supports live TV, movies, and TV series from M3U and Xtream providers.

## Features

- **Native ExoPlayer** — Direct Media3 integration, 1s min buffer (vs 15s default), streams start in 1-2 seconds
- **Instant Channel Switching** — Zero artificial delays, single-call Zustand state updates, memoized renders
- **Android TV Remote** — Full D-pad navigation with spatial focus management, TV-native FocusableItem components
- **Focused-Channel EPG Guide** — Side panel shows current/next programs per channel; D-pad right enters the guide, up/down scrolls through program history; past programs shown for catchup channels
- **Catchup / Timeshift** — Native EPG grid detects catchup-enabled channels, builds Xtream timeshift URLs, plays past programs directly
- **Channel List Panel** — 60% transparent sliding panel with search, tabs (All / Favorites / Recent), group filter, and D-pad left to open groups
- **EPG Grid (Kotlin Canvas)** — Native Android canvas-drawn guide requests only focused and visible channel rows, keeps stale results from replacing fresh data, and shows a loading state while the guide is still ingesting
- **M3U / Xtream Codes** — Kotlin streaming M3U parser handles 10k+ channels without JS thread freeze; Xtream playlists include live channels, movies, series, seasons, and episodes
- **Unified VOD Catalog** — Browse movies and TV series together, filter by genre, then select a season and episode before playback
- **Smart EPG Caching** — Realm DB indexes `playlistId`, `channelId`, `start`, and `end`; AsyncStorage avoids unnecessary cold-boot ingestion and progressive updates make new guide data visible as it arrives
- **Chunked Playlist Storage** — Large live, movie, and series catalogs are stored in chunks so local persistence stays reliable on large provider accounts
- **Disk-Cached Logos** — `expo-image` with `cachePolicy="disk"` for instant logo rendering on re-open
- **Material Icons** — `@expo/vector-icons` MaterialCommunityIcons throughout the player overlay
- **Web Player** — Companion web UI with Playwright e2e tests
- **Web Xtream Proxy** — Metro proxies provider APIs, XMLTV, HLS, and VOD through `/api/xtream` during local web development to avoid browser CORS and mixed-content failures
- **Large Web Playlists** — Channel and VOD payloads use IndexedDB on web instead of the browser's small `localStorage` quota

## Quick Start

```bash
corepack enable
pnpm install
pnpm start          # Expo dev server (a=Android, w=Web, i=iOS)
pnpm web            # Web only (fastest for UI work, no video playback)
pnpm android        # Android emulator/device
```

The Xtream web proxy is attached to the Expo Metro development server. Static web exports must be hosted behind a server that mounts `server/xtreamProxy.js` at `/api/xtream`; a static file host alone cannot proxy provider traffic.

## Building for Android TV

```bash
# Arm64 release APK for an Android TV emulator/device (requires JDK 17 + Android SDK)
export JAVA_HOME="/path/to/jdk-17"
export ANDROID_HOME="$HOME/Library/Android/sdk"
cd android
./gradlew --no-daemon :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
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
│   ├── screens/VodCatalogScreen.tsx # Unified movie and TV-series catalog
│   ├── screens/VodSeriesScreen.tsx  # Season and episode browser
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
| `PlaylistParserModule` | Line-by-line M3U parsing and Xtream live, movie, series, and episode ingestion on `Dispatchers.IO` |
| `EpgIngestionModule` | XMLTV parser → Realm DB, background WorkManager sync, indexed program queries |
| `EpgGridView` | Native Canvas EPG grid that prioritizes focused/visible rows, supports catchup selection, and emits focus updates to React Native |

## EPG Caching Strategy

1. **Cold boot** — AsyncStorage is checked first. If the playlist signature is still fresh, programs load from Realm without another network ingest.
2. **Cache hit** — Realm metadata matches the active playlist, so the guide is served immediately and refreshed only when stale.
3. **Cache miss or refresh** — Kotlin fetches and parses XMLTV in the background, writes Realm batches, and notifies the UI as data becomes available.
4. **Visible guide rows first** — The native grid queries focused and on-screen channels rather than waiting for the entire channel list; it displays `Loading guide…` until data arrives.
5. **Background refresh** — WorkManager schedules periodic re-syncs using the configured guide interval.

## Running Tests

```bash
# Unit tests (Jest)
pnpm test --runInBand

# E2E tests (Playwright — requires web server running)
pnpm web &
pnpm exec playwright test
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Styles not appearing | `npx expo start --clear` to bust Metro cache |
| `#realm.node` on web | Realm imports must be guarded by `Platform.OS !== 'web'` |
| EPG says `Loading guide…` | Initial XMLTV ingestion is still running; keep the guide open and visible rows will populate progressively |
| EPG not loading | Check the playlist EPG URL in Settings, then use **Refresh Now** to start a new ingest |
| Focus issues on TV | Check `FocusableItem` and verify keyboard nav hooks are firing |
| Large playlist freeze | Use native build — Kotlin parser runs on IO thread, JS parser is for web only |
| Missing movies or TV shows | Refresh the playlist in Settings; Xtream provider credentials must expose the corresponding catalog |
