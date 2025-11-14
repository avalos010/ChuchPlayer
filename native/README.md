# Native Android Module - EPG Ingestion

This folder contains the Kotlin native module for background EPG (Electronic Program Guide) ingestion.

## Structure

```
native/android/src/main/java/com/chuchplayer/epg/
├── EpgIngestionModule.kt    # Main module that handles XML parsing in background thread
└── EpgIngestionPackage.kt   # React Native package registration
```

## How It Works

1. **Background Processing**: The module runs XML parsing in a Kotlin coroutine on a background thread (IO dispatcher), keeping the JS thread free.

2. **XML Parsing**: Uses Android's XmlPullParser to stream-parse large XMLTV files efficiently.

3. **Channel Matching**: Matches EPG channel IDs to your playlist channels using:
   - `tvgId` (highest priority)
   - Channel `id`
   - Channel `name` (lowest priority)

4. **Time Filtering**: Only processes programs within a 12-hour window (12 hours before, 36 hours after current time).

5. **Progress Events**: Emits progress events to JS every 1000 programs processed.

## Integration

The module is automatically included in the Android build via `android/app/build.gradle`:

```gradle
sourceSets {
    main {
        java {
            srcDirs += ['../../native/android/src/main/java']
        }
    }
}
```

The package is registered in `MainApplication.kt`:

```kotlin
import com.chuchplayer.epg.EpgIngestionPackage

// In getPackages():
add(EpgIngestionPackage())
```

## Dependencies

- `okhttp3:okhttp:4.12.0` - HTTP client for fetching XML
- `kotlinx-coroutines-android:1.7.3` - Coroutines for background processing

## Usage from JavaScript

See `src/services/nativeEpgIngestion.ts` for the JS bridge. The module is automatically used when available on Android, falling back to inline ingestion on other platforms.

