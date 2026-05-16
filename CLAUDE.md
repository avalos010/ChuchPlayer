# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

# Android emulator/device
npm run android

# Build for Android TV (requires EAS CLI)
eas build --platform android --profile development

# Build optimized release APK (no Expo dev server needed)
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_HOME=~/Library/Android/sdk
export PATH="$ANDROID_HOME/platform-tools:$PATH"
cd android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
adb shell am start -n com.chuchplayer/.MainActivity
```

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
- **native/android/**: Kotlin EPG ingestion module for background processing

### Key Feature Domains

**State Management (Zustand)**:
- `usePlayerStore`: Channel, playback state (playing, loading, error), volume, playlist
- `useUIStore`: UI visibility (EPG overlay, settings, etc.), focus management
- `useEPGStore`: Current program info
- `useRefreshStore`: Background sync scheduling
- `useMultiScreenStore`: Multi-window support state

**EPG System**:
- Realm database stores programs and metadata (`epgDatabase.ts`)
- Native Kotlin module (`native/android/src/main/java/com/chuchplayer/epg/`) parses XMLTV in background thread
- `nativeEpgIngestion.ts` bridges JavaScript to native module
- `epgParser.ts` handles fallback XML parsing on non-Android platforms
- Background sync via `useDataRefreshScheduler` hook

**Playlist Support**:
- M3U format: Parsed with `m3uParser.ts`
- Xtream Codes format: Parsed with `xtreamParser.ts`
- Channels stored with playlist (id, name, url, logo, tvgId, group)
- AsyncStorage persists playlists

**Video Playback**:
- ExoPlayer native module for tight buffer control (1s min, 30s max) on Android
- Falls back to `expo-av` on web/iOS
- `useExoPlayerPlayback.ts` hook bridges native player to JS state
- ResizeMode, volume, playback state controlled via store actions
- Player controls wired through keyboard navigation
- Achieves 1-2s stream start (vs 15s default)

## Performance Optimizations (TiviMate-Level Smoothness)

The app implements three layers of optimizations for near-instant channel switching and smooth scrolling:

### Part A: Native ExoPlayer (Instant Stream Start)
- **ExoPlayerModule.kt** (`native/android/src/main/java/com/chuchplayer/player/`): Direct Media3/ExoPlayer integration
- Buffer config: `minBufferMs=1s, maxBufferMs=30s` (TiviMate-style)
- Methods: `loadSource`, `play`, `pause`, `stop`, `seek`, `preloadSource`
- Events: `PLAYER_STATE_CHANGED`, `PLAYER_ERROR`, `PLAYER_PROGRESS`
- JS bridge: `ExoPlayerView.tsx`, `useExoPlayerPlayback.ts`
- **Result:** Streams start in 1-2s instead of 15s default

### Part B: Kotlin M3U Parser (Large Playlist Support)
- **PlaylistParserModule.kt** (`native/android/src/main/java/com/chuchplayer/playlist/`): Streaming line-by-line parser
- Runs on `Dispatchers.IO` (doesn't block JS thread)
- Extracts M3U attributes: `tvg-id`, `tvg-name`, `tvg-logo`, `group-title`
- No full-file memory load (vs JS sync parsing)
- **Result:** 10k+ channel playlists parse instantly without UI freeze

### Part C: JavaScript Rendering Optimizations
1. **Channel Switch Speed** (`useChannelNavigation.ts`): Remove 100ms artificial sleeps
2. **Playback Updates** (`useVideoPlayback.ts`): Batch Zustand updates (2 re-renders → 1)
3. **Settings Cache** (`useVideoPlayback.ts`): Cache `getSettings()` to skip AsyncStorage on video load
4. **ChannelListItem Memo** (`ChannelListItem.tsx`): React.memo prevents re-renders on parent state changes
5. **Image Caching** (4 files): Replace `Image` with `expo-image` for persistent disk caching
6. **EPG Grid** (`EPGGridView.tsx`): `loadedIds` state→ref, O(1) `channelIndexMap` (vs O(n) findIndex)
7. **Focus Styles** (`FocusableItem.tsx`): Memoize `styleArray` to avoid per-render allocations
8. **Channel List** (`ChannelListPanel.tsx`): Stabilize `renderChannelItem` deps with ref
9. **Status Updates** (`PlayerScreen.tsx`): `progressUpdateIntervalMillis={1000}` reduces ticks to 1/sec

**Result:** Eliminates cascade re-renders, instant channel switching, smooth EPG grid scrolling

### Styling & Theme

**NativeWind + Tailwind CSS**:
- `global.css` imported in App.tsx (imports Tailwind directives)
- Metro bundler configured in `metro.config.js` with NativeWind transformer
- Babel preset includes `jsxImportSource: "nativewind"`
- Dark theme hardcoded in components (class names like `bg-dark`, `text-white`)
- Use `className` prop on components (not `style` for Tailwind classes)

**Cache Clearing**: If styles don't appear after changes, run `npx expo start --clear` to clear Metro cache.

### Android TV Features

**Keyboard Navigation**:
- `react-native-keyevent` for TV remote key events
- `useKeyboardNavigation` hook maps remote keys (up, down, left, right, select, back)
- `FocusableItem` component provides focus states and press handling

**Native Modules**:
- Three Kotlin modules automatically included in Android build:
  - **EpgIngestionModule**: XMLTV parsing + Realm storage (background sync)
  - **ExoPlayerModule**: Direct Media3 player with tight buffer config
  - **PlaylistParserModule**: M3U line-by-line parsing on IO thread
- All registered in `MainApplication.kt`
- JS-side bridges in `src/services/nativeEpgIngestion.ts`, `ExoPlayerView.tsx`
- Falls back to JS parsing on web/iOS platforms

**Plugins**:
- `expo-plugins/android-tv.js`: Adds leanback launcher intent
- `plugins/withKeyEvent.js`: Integrates react-native-keyevent
- `expo-plugins/withNativeEpgIngestion.js`: Registers Kotlin EPG module

## TypeScript & Build Configuration

- **tsconfig.json**: Strict mode, extends Expo base config
- **metro.config.js**: Configured for NativeWind + Tailwind
- **babel.config.js**: Expo preset with NativeWind JSX source

## Known Constraints & Capabilities

### Platform-Specific Behavior
1. **Web Platform**: 
   - Video playback uses `expo-av` (limited support)
   - M3U parser uses JS version (no Kotlin parser)
   - ExoPlayer unavailable (uses `expo-av` fallback)
   - Great for UI testing but no video codec support

2. **Android Platform** (Optimized):
   - ExoPlayer native module with 1s buffer (instant starts)
   - Kotlin M3U parser for large playlists (no JS freeze)
   - Realm database for EPG persistence
   - Full performance optimizations enabled

3. **iOS Platform**:
   - Realm database available
   - M3U parser uses JS version
   - `expo-av` for video playback

### Database & Persistence
- **Realm Database**: Native binding only; Realm imports wrapped in Platform.OS checks
- **EPG Background Sync**: Uses `expo-background-fetch` on native; WorkManager on Android
- **AsyncStorage**: For playlist metadata, settings, last-watched channel

## Debugging & Common Issues

**Module Resolution Errors** (e.g., "#realm.node" from web bundler):
- Caused by importing native-only modules on web platform
- Solution: Wrap imports in `Platform.OS !== 'web'` checks or use platform-specific imports

**Styles Not Appearing**:
- Clear Metro cache: `rm -rf node_modules/.cache && npx expo start --clear`
- Verify `metro.config.js` has NativeWind transformer
- Check components use `className` (not `style` for Tailwind)

**Focus Issues on TV**:
- Check `FocusableItem` component styling
- Verify keyboard navigation hooks are firing (use console.log in key handlers)

**Playlist Loading Fails**:
- Ensure M3U/Xtream URL returns valid format
- Check AsyncStorage permissions on Android
- Use debug logging in parser utils

## Performance Notes

- EPG parsing delegates to Kotlin background thread (doesn't block JS)
- AsyncStorage is synchronous in UI thread; EPG operations queued in `epgDatabase.ts`
- M3U parsing streams large files; doesn't load entire playlist into memory
- NativeWind/Tailwind compiled at build time, not runtime
