# CLAUDE.md

This file provides guidance to AI coding agents working with this repository.

## Quick Start

**Prerequisites**: Node.js 18+, Expo CLI (`npm install -g expo-cli`)

### Development Commands

```bash
# Install dependencies
npm install

# Start Expo dev server (choose platform at prompt: a=Android, w=Web, i=iOS)
npm start

# Web development (fastest for UI testing, no video playback)
npm run web

# Android emulator/device (supports all ABIs including arm64-v8a / x86_64)
npm run android

# Build for Android TV (requires EAS CLI)
eas build --platform android --profile development

# Build Fire TV release APK (32-bit armeabi-v7a only, ~42MB)
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME=~/Library/Android/sdk
export PATH="$ANDROID_HOME/platform-tools:$PATH"
cd android && ./gradlew assembleRelease -PfiretvBuild -PreactNativeArchitectures=armeabi-v7a

# Build standard release APK (all architectures, larger)
cd android && ./gradlew assembleRelease

# Install and launch on connected device/emulator
adb install -r app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.chuchplayer/.MainActivity

# Upload to Fire Stick via FTP
curl -T app/build/outputs/apk/release/app-release.apk ftp://10.0.0.150:3721/app-release.apk
```

### ABI / Size Notes

- `gradle.properties` sets `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64` (all archs for emulator compatibility)
- `-PfiretvBuild` activates `ndk { abiFilters "armeabi-v7a" }` and strips non-32-bit `.so` files from the APK
- `-PreactNativeArchitectures=armeabi-v7a` strips React Native's own pre-built libs for other archs
- Together these shrink the Fire TV APK to ~42MB (vs 150MB+ without)
- **Never apply these restrictions without `-PfiretvBuild`** — the emulator uses arm64-v8a and will crash with `librealm.so` not found

### Expo Development Build (for Android TV)

The project uses Expo's development client for TV testing:

```bash
eas login
eas build:configure
eas build --platform android --profile development
npx expo start --dev-client --android
```

## Project Architecture

### Core Structure

- **App.tsx**: Root component, sets up GestureHandler, SafeArea, Toast, and data refresh scheduler
- **src/navigation/**: React Navigation stack setup (AppNavigator.tsx)
- **src/screens/**: Main screens (PlayerScreen, SettingsScreen, etc.)
- **src/components/**: Reusable UI components (FocusableItem for TV navigation, ChannelListItem, etc.)
- **src/store/**: Zustand state stores (usePlayerStore, useUIStore, useEPGStore, etc.)
- **src/hooks/**: Custom React hooks for features (EPG management, keyboard nav, video playback, etc.)
- **src/services/**: Business logic services (nativeEpgIngestion.ts bridges to Kotlin module)
- **src/database/**: Realm database layer (epgDatabase.ts handles EPG data persistence)
- **src/utils/**: Utilities (M3U/Xtream parsers, XML parsing, AsyncStorage helpers)
- **native/android/**: Kotlin native modules (EPG, player, playlist parser)

### Key Feature Domains

**State Management (Zustand)**:
- `usePlayerStore`: Channel, playback state (playing, loading, error), volume, playlist
- `useUIStore`: UI visibility (EPG overlay, settings, channel list, groups panel, etc.), focus management
- `useEPGStore`: Current program info
- `useRefreshStore`: Background sync scheduling
- `useMultiScreenStore`: Multi-window support state

**EPG System**:
- Realm database (schema v3) stores programs; `@Index` on `playlistId`, `channelId`, `start`, `end`
- Native Kotlin module (`native/android/src/main/java/com/chuchplayer/epg/`) parses XMLTV in background thread
- `nativeEpgIngestion.ts` bridges JavaScript to native module
- `epgParser.ts` handles fallback XML parsing on non-Android platforms
- Background sync via `useDataRefreshScheduler` hook
- **Cold-boot guard**: `useEPGManagement` writes last ingest `{ sig, ts }` to AsyncStorage; on app open, if signature matches and age < 4h, programs are loaded from Realm only (no network round-trip)
- **EpgGridView.kt**: 72h catchup window, `cursorMs` for time-selection, `EPG_CATCHUP_SELECT` event builds Xtream timeshift URLs

**Playlist Support**:
- M3U format: Parsed with `m3uParser.ts`
- Xtream Codes format: Parsed with `xtreamParser.ts`
- Channels stored with playlist (id, name, url, logo, tvgId, group)
- AsyncStorage persists playlists

**Video Playback**:
- `ExoPlayerModule.kt` + `ExoPlayerViewManager.kt`: Native Media3/ExoPlayer with `PlayerView` surface for hardware-accelerated rendering
- `ExoPlayerHolder` singleton shares the ExoPlayer instance between the module (JS API) and the view manager (rendering surface)
- Buffer config: `minBufferMs=1s, maxBufferMs=30s` → 1-2s stream start
- Cross-protocol redirects enabled: `DefaultHttpDataSource.Factory().setAllowCrossProtocolRedirects(true)`
- `ExoPlayerVideoView.tsx` wraps the native view; `useExoPlayerPlayback.ts` bridges JS state
- `PlayerVideoStage.tsx` selects `ExoPlayerVideoView` on Android, `expo-av` fallback on web/iOS
- Multi-screen: `MultiExoPlayerView.kt` / `MultiExoPlayerViewManager.kt` — each tile has its own self-contained ExoPlayer + OkHttp (follows cross-protocol redirects)

**Native View Modules** (`native/android/src/main/java/com/chuchplayer/`):
- `player/ExoPlayerModule.kt`: JS-callable module (loadSource, play, pause, stop, seek)
- `player/ExoPlayerViewManager.kt`: Renders `PlayerView` surface; attaches to `ExoPlayerHolder`
- `player/MultiExoPlayerView.kt`: Self-contained player+view per multi-screen tile
- `player/MultiExoPlayerViewManager.kt`: `@ReactProp` bridge for source/playing/volume
- `epg/ChannelListView.kt`: Custom canvas channel list with D-pad chrome navigation
- `epg/ChannelListViewManager.kt`: Props bridge including `focusTrigger` for re-focus
- `epg/SideEpgView.kt`: Native side EPG guide with logos and descriptions
- `epg/EpgGridView.kt`: Full EPG grid with 72h window and catchup
- `epg/GroupsRailView.kt`: Groups/playlists panel with D-pad navigation
- All registered in `MainApplication.kt`

## Performance Optimizations

### Part A: Native ExoPlayer (Instant Stream Start)
- `ExoPlayerModule.kt` + `ExoPlayerHolder` + `ExoPlayerViewManager.kt`: Proper PlayerView rendering surface
- Buffer config: `minBufferMs=1s, maxBufferMs=30s`
- Methods: `loadSource`, `play`, `pause`, `stop`, `seek`, `preloadSource`
- Events: `PLAYER_STATE_CHANGED`, `PLAYER_ERROR`, `PLAYER_PROGRESS`
- JS bridge: `ExoPlayerVideoView.tsx`, `useExoPlayerPlayback.ts`
- **Result:** Streams start in 1-2s; hardware-accelerated video surface (no stutter)

### Part B: Kotlin M3U Parser (Large Playlist Support)
- `PlaylistParserModule.kt`: Streaming line-by-line parser, runs on `Dispatchers.IO`
- Extracts M3U attributes: `tvg-id`, `tvg-name`, `tvg-logo`, `group-title`
- **Result:** 10k+ channel playlists parse without UI freeze

### Part C: JavaScript Rendering Optimizations
1. **Channel Switch Speed** (`useChannelNavigation.ts`): No artificial sleeps
2. **Playback Updates** (`useVideoPlayback.ts`): Batch Zustand updates
3. **Settings Cache** (`useVideoPlayback.ts`): Cache `getSettings()` to skip AsyncStorage on video load
4. **ChannelListItem Memo** (`ChannelListItem.tsx`): `React.memo` prevents re-renders
5. **Image Caching**: `expo-image` for persistent disk caching
6. **EPG Grid** (`EPGGridView.tsx`): `loadedIds` state→ref, O(1) `channelIndexMap`
7. **Focus Styles** (`FocusableItem.tsx`): Memoize `styleArray`
8. **Channel List** (`ChannelListPanel.tsx`): Stabilize `renderChannelItem` deps with ref
9. **Status Updates** (`PlayerScreen.tsx`): `progressUpdateIntervalMillis={1000}`

### Styling & Theme

**NativeWind + Tailwind CSS**:
- `global.css` imported in App.tsx (imports Tailwind directives)
- Metro bundler configured in `metro.config.js` with NativeWind transformer
- Babel preset includes `jsxImportSource: "nativewind"`
- Dark theme hardcoded in components (`bg-dark`, `text-white`, etc.)
- Use `className` prop on components (not `style` for Tailwind classes)

**Theme utilities** (`src/theme/themes.ts`):
- `withAlpha(hex, alpha)` → `#RRGGBBAA` for React Native styles
- `withAlphaAndroid(hex, alpha)` → `#AARRGGBB` for Android `Color.parseColor`
- Used for semi-transparent panels (channel list, groups panel)

**Cache Clearing**: If styles don't appear after changes: `npx expo start --clear`

## Android TV / Fire TV Specifics

### Keyboard Navigation
- `react-native-keyevent` intercepts key events at Activity level (fires before native view dispatch)
- `useKeyboardNavigation` hook maps remote keys
- `FocusableItem` component provides focus states and press handling
- **Important**: Only one `KeyEvent.onKeyDownListener` can be active at a time; each panel registers its own and removes it on unmount
- Native canvas views (`ChannelListView`, `GroupsRailView`, `SideEpgView`) handle D-pad in `onKeyDown` and return `true` to consume
- `ChannelListView.onKeyDown` handles ALL navigation (UP/DOWN/CENTER/LEFT) when mounted; JS KeyEvent listener is disabled when native list is active (`useNativeList = true`) to avoid double-firing

### ChannelListView D-Pad Chrome Navigation
The native channel list has a "chrome mode" for navigating tabs/search/groups via D-pad:
- `chromeItem = -1`: list mode (channels)
- `chromeItem = 0`: Groups button
- `chromeItem = 1`: Search bar
- `chromeItem = 2/3/4`: All / Fav / Recent tabs
- From list: **UP at row 0** → enter chrome at active tab
- In chrome: **LEFT/RIGHT** cycles tabs; **UP** moves toward Groups; **DOWN** returns to list; **CENTER** activates
- Focused chrome item draws a white border highlight

### ChannelListView Row Layout
- Row height: 80dp
- Shows: channel name (bold) → current program title → progress bar → start–end time
- Falls back to "Live TV" / "Catchup available" if no EPG data
- Program data (`programTitle`, `programStart`, `programEnd`) is injected into channels JSON by `NativeChannelList.tsx` via `getCurrentProgram` prop
- Name maxWidth reserves badge space only for the current (LIVE) channel

### Focus Re-acquisition After Groups Panel Closes
- When `GroupsRailView` fires `GROUPS_RAIL_CLOSE` (DPAD_RIGHT), `ChannelListPanel` detects the `showGroupsPlaylists: true→false` transition and increments `nativeListFocusTrigger`
- `NativeChannelList` passes `focusTrigger` prop to the native view; `ChannelListViewManager.setFocusTrigger` calls `view.post { requestFocus() }`
- Backdrops in both `ChannelListPanel` and `GroupsPlaylistsPanel` have `focusable={false}` to prevent them from stealing D-pad focus

### Logo Loading
All three native EPG canvas views (`ChannelListView`, `SideEpgView`, `EpgGridView`) use OkHttp with `followRedirects(true)` and `followSslRedirects(true)`. This was needed because many IPTV providers serve logos via http→https redirects that `java.net.URL` refuses to follow.

### Panel Transparency
- `ChannelListPanel` and `GroupsPlaylistsPanel` use `withAlpha(theme.bg, 0.8)` for their container background so the video shows through
- Backdrops are `backgroundColor: 'transparent'`
- Native views inside panels use `withAlphaAndroid(theme.bg, 0)` (fully transparent) so the panel's React Native background is the only visible layer

## Build Configuration

- **`android/app/build.gradle`**:
  - `-PfiretvBuild` activates `ndk { abiFilters "armeabi-v7a" }` and `packagingOptions.jniLibs.excludes` for arm64/x86
  - Without `-PfiretvBuild`: all ABIs included (needed for emulator)
  - `media3-exoplayer`, `media3-exoplayer-hls`, `media3-datasource`, `media3-ui` all at `1.8.0`
  - `sourceSets.main.java.srcDirs` includes `../../native/android/src/main/java`
- **`android/gradle.properties`**:
  - `reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64` (full list for emulator)
  - Override per-build with `-PreactNativeArchitectures=armeabi-v7a` for Fire TV
- **`tsconfig.json`**: Strict mode, extends Expo base config
- **`metro.config.js`**: Configured for NativeWind + Tailwind
- **`babel.config.js`**: Expo preset with NativeWind JSX source

## Known Constraints & Capabilities

### Platform-Specific Behavior
1. **Web Platform**:
   - Video playback uses `expo-av` (limited support)
   - M3U parser uses JS version (no Kotlin parser)
   - ExoPlayer unavailable (uses `expo-av` fallback)
   - Native canvas views (`ChannelListView`, etc.) not available
2. **Android Platform** (Optimized):
   - ExoPlayer with hardware-accelerated `PlayerView` surface
   - Native canvas channel list/EPG views with full D-pad navigation
   - Kotlin M3U parser for large playlists
   - Realm database for EPG persistence
3. **iOS Platform**:
   - Realm database available
   - M3U parser uses JS version
   - `expo-av` for video playback

### Database & Persistence
- **Realm Database**: Native binding only; wrapped in `Platform.OS` checks
- **EPG Background Sync**: WorkManager on Android
- **AsyncStorage**: Playlist metadata, settings, last-watched channel

## Debugging & Common Issues

**Emulator crash: `couldn't find DSO to load: librealm.so`**:
- Caused by running an APK built with `-PfiretvBuild` on an arm64-v8a emulator
- Fix: use `npm run android` (debug build, all ABIs) or `./gradlew assembleRelease` (no `-PfiretvBuild`)

**Video not playing ("Source error")**:
- `DefaultHttpDataSource` must have `setAllowCrossProtocolRedirects(true)` — already set in `ExoPlayerModule.kt`
- Custom user-agents rejected by some IPTV panels — do NOT add a custom user-agent
- ExoPlayer methods (`pause`, `stop`, `seek`) must run on Main thread — wrapped in `scope.launch { }` in `ExoPlayerModule.kt`

**Module Resolution Errors** (e.g., "#realm.node" from web bundler):
- Caused by importing native-only modules on web
- Wrap imports in `Platform.OS !== 'web'` checks

**Styles Not Appearing**:
- Clear Metro cache: `rm -rf node_modules/.cache && npx expo start --clear`

**Focus Issues on TV**:
- `ChannelListView` calls `requestFocus()` in `onAttachedToWindow` and via `focusTrigger` prop
- Backdrops must have `focusable={false}` or they steal D-pad focus when overlapping views unmount
- Only ONE `KeyEvent.onKeyDownListener` can be registered at a time

**Playlist Loading Fails**:
- Ensure M3U/Xtream URL returns valid format
- Check AsyncStorage permissions on Android

## Performance Notes

- EPG parsing delegates to Kotlin background thread (doesn't block JS)
- M3U parsing streams large files without loading them fully into memory
- NativeWind/Tailwind compiled at build time, not runtime
- Native canvas views (channel list, EPG grid, side guide) avoid React Native layout overhead for smooth scrolling and D-pad response
