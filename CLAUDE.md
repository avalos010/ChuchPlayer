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
- `expo-av` for streaming (works on native, limited on web)
- Video ref managed in `usePlayerStore`
- ResizeMode, volume, playback state controlled via store actions
- Player controls wired through keyboard navigation

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

**Native Module**:
- Kotlin module automatically included in Android build
- Registered in `MainApplication.kt` (built by EAS)
- Handles XML parsing in background, emits progress events
- Falls back to inline parsing if native unavailable

**Plugins**:
- `expo-plugins/android-tv.js`: Adds leanback launcher intent
- `plugins/withKeyEvent.js`: Integrates react-native-keyevent
- `expo-plugins/withNativeEpgIngestion.js`: Registers Kotlin EPG module

## TypeScript & Build Configuration

- **tsconfig.json**: Strict mode, extends Expo base config
- **metro.config.js**: Configured for NativeWind + Tailwind
- **babel.config.js**: Expo preset with NativeWind JSX source

## Known Constraints

1. **Web Platform**: Video playback (`expo-av`) is native-only; web build won't play video but is great for UI testing
2. **Realm Database**: Native binding only; Realm import wrapped in Platform.OS check to prevent web bundler errors
3. **EPG Background Sync**: Uses `expo-background-fetch` on native; not supported on web
4. **Android TV Only**: Native Kotlin EPG module is Android-specific; fallback to JS parsing on other platforms

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
