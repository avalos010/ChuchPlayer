---
name: project-auto-update
description: Self-hosted APK auto-updater via GitHub Releases — architecture, files, and release workflow
metadata:
  type: project
---

Self-hosted APK updater implemented (no Expo dependency). Checks version on launch, prompts user, downloads and installs.

**Why:** User wants automatic in-app updates without Expo OTA; app is sideloaded Android TV APK hosted on GitHub Releases.

**How to apply:** When touching update logic, follow this architecture. Release flow is tag-driven.

## Key files
- `native/android/.../updater/AppUpdaterModule.kt` — Kotlin module: downloads APK, emits progress, triggers install intent
- `native/android/.../updater/AppUpdaterPackage.kt` — registers module
- `android/app/src/main/res/xml/updater_file_paths.xml` — FileProvider paths
- `src/services/appUpdater.ts` — JS bridge; VERSION_URL points to raw.githubusercontent.com/avalos010/ChuchPlayer/main/version.json
- `src/hooks/useAppUpdater.ts` — checks on mount, silent on failure; states: idle/checking/available/downloading/error
- `src/components/AppUpdateDialog.tsx` — TV-friendly dialog with progress bar
- `App.tsx` — wired in via useAppUpdater
- `version.json` — repo root; updated automatically by CI on each release
- `.github/workflows/release.yml` — tag-triggered release workflow

## Release workflow
Push a tag: `git tag v1.1.0 && git push origin v1.1.0`
CI builds signed APK → creates GitHub Release → commits updated version.json to main.

## GitHub Secrets required
ANDROID_KEYSTORE_BASE64, ANDROID_STORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD

## versionCode scheme
Tag v1.2.3 → versionCode = 1*10000 + 2*100 + 3 = 10203
