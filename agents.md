# Agents

This file documents how AI agents are used in development, what they can do autonomously, and where human review is expected.

## Development Workflow

The developer reviews all changes. The agent proposes edits, builds, and installs for testing — nothing is committed or pushed without explicit approval.

### Typical Session

1. Developer describes a feature or bug in plain language
2. Agent reads relevant source files to understand context
3. Agent proposes and makes targeted edits
4. Agent triggers a Gradle release build in the background
5. On build success, agent installs APK on the connected device via `adb`
6. Developer tests on device and gives feedback
7. Agent iterates, developer approves and pushes when satisfied

## What the Agent Does

- Edits TypeScript, Kotlin, and config files
- Runs Gradle builds and `adb install`
- Reads build output and diagnoses compile errors
- Proposes commits — developer reviews diff and approves before any `git push`

## What Always Requires Developer Approval

- Every `git push` — agent never pushes without being told to
- Commits — developer reviews the staged diff before confirming
- Dependency additions
- Any destructive operation (Realm schema migrations, file deletions)

## Agent Constraints (from CLAUDE.md)

- No comments unless the WHY is non-obvious
- No error handling for impossible cases
- No feature flags or backwards-compat shims
- Prefer editing existing files over creating new ones
- No half-finished implementations

## Key Decisions Made by Agent

| Decision | Rationale |
|----------|-----------|
| Use `React.memo` comparator on `ChannelListItem` | Prevents FlashList re-renders on unrelated state changes |
| Move focus tracking to refs in `ChannelListPanel` | D-pad focus changes were causing FlashList to re-render all visible items |
| `FocusableItem` per program row in EPG side panel | Lets Android TV spatial navigation move focus right into the panel naturally; KeyEvent hacks fighting the native focus system |
| AsyncStorage cold-boot guard in `useEPGManagement` | All staleness guards were in-memory refs, resetting to null on every cold boot and triggering a full Realm query on every app open |
| Realm schema v3 with `@Index` on `playlistId`, `channelId`, `start`, `end` | EPG `queryPrograms` was doing full-table scans; indexes bring it to an indexed range scan |
| `deleteRealmIfMigrationNeeded` for schema changes | EPG data is always re-fetchable; migration complexity not worth it for a cache |
| Single `FlashList` for channel list (not two synchronized lists) | A separate `ScrollView` for EPG data rendered all N rows at once, destroying performance on large playlists |
| Native `ExoPlayerViewManager` creates a `PlayerView` surface | The previous approach tried to set a Surface directly on the MediaSession; `PlayerView` is the correct Media3 surface container that handles the SurfaceView lifecycle and attaches automatically |
| `ExoPlayerHolder` singleton links `ExoPlayerModule` to `ExoPlayerViewManager` | Both need the same ExoPlayer instance but are instantiated by different React Native manager paths; a singleton avoids a second ExoPlayer being created for the view |
| Per-instance `MultiExoPlayerView` (not shared holder) | Multi-screen tiles each need an independent player with separate buffers; sharing the main player singleton would interrupt the primary stream |
| OkHttp with `followRedirects(true)` + `followSslRedirects(true)` for logo loading | Many IPTV providers serve logo URLs via http→https redirects; `java.net.URL` silently refuses cross-protocol redirects, leaving all logos blank |
| `focusTrigger` prop incremented on groups panel close | When `GroupsRailView` unmounts, Android `FocusFinder` could transfer focus to the backdrop `TouchableOpacity`; incrementing an integer prop signals the native channel list to call `requestFocus()` on itself |
| `focusable={false}` on backdrop `TouchableOpacity` in panel overlays | Prevents D-pad focus from landing on a transparent full-screen touchable instead of the visible panel content when an overlay unmounts |
| `-PfiretvBuild` Gradle property gates ABI restrictions | `ndk { abiFilters "armeabi-v7a" }` and `packagingOptions excludes` shrink the Fire TV APK to ~42MB but break arm64 emulator builds; the conditional flag lets the same codebase serve both |
| `reactNativeArchitectures` stays at all four ABIs in `gradle.properties` | Changing it globally to `armeabi-v7a` caused `librealm.so` not-found crash on arm64-v8a emulator; pass it per-build via CLI flag instead |
| `chromeItem` integer state for D-pad chrome navigation in `ChannelListView` | The channel list is a single canvas `View` with no sub-views, so Android's spatial navigation can't visit drawn tabs/buttons naturally; `chromeItem` tracks which drawn element has virtual focus and routes D-pad events accordingly |
| Canvas row EPG data injected via `channelsJson` from JS | Passing `programTitle`/`programStart`/`programEnd` through the existing channels JSON prop avoids a separate native event channel; `getCurrentProgram` is called in `NativeChannelList.tsx` during memo computation |
| JS `KeyEvent` listener disabled when `useNativeList = true` | `ChannelListView.onKeyDown` and `KeyEvent.onKeyDownListener` both fire for UP/DOWN/CENTER; the JS listener must be suppressed or every key fires twice (once in canvas view, once in JS) |
| `withAlpha` (#RRGGBBAA) and `withAlphaAndroid` (#AARRGGBB) in `themes.ts` | React Native and Android `Color.parseColor` use opposite byte order for alpha; having both helpers prevents silent color errors when passing values to native canvas drawing code |

## Spawning Sub-Agents

The agent can spawn specialized sub-agents via the `Agent` tool:

- `Explore` — fast read-only codebase search (used for symbol lookup, finding files)
- `Plan` — architectural design before implementation
- `general-purpose` — multi-step research tasks

Sub-agents are used when a task requires broad codebase exploration that would bloat the main context window. For targeted edits the main agent acts directly.
