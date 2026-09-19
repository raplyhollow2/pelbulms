# Pelbu LMS Android app

Native Android SDK app (`applicationId`: `bt.pelbu.lms`) that loads the Pelbu LMS site in a system WebView. It is a real APK built with the Android Gradle Plugin — not a Play Store listing, and not an auto-published release.

## What this is

- Kotlin + AndroidX + official Android WebView
- `targetSdk` 36, HTTPS-only network config, Play Protect-safe permission set
- Camera, photos, microphone, and notifications requested **once on first launch** (Android cannot grant dangerous permissions at install after API 23)
- Google / Facebook / Apple sign-in opens Chrome Custom Tabs so Google will not block OAuth inside a WebView
- APK is produced only when someone **manually** runs the GitHub Action

Do **not** add SMS, contacts, call-log, or unused location permissions. Play Protect treats those as malware signals.

## Local debug build

```bash
cd android
./gradlew assembleDebug
```

The debug APK is at `android/app/build/outputs/apk/debug/`.

## Signed release APK (manual)

1. Create a keystore once: `android/scripts/create-release-keystore.sh`
2. Add GitHub Actions secrets:
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
3. GitHub → Actions → **Build Android APK** → **Run workflow**
4. The workflow uploads the APK as an artifact and, if you leave “Publish GitHub Release” on, attaches it to the `android-latest` GitHub Release
5. The website download page (`/download`) serves that APK — there is **no** Google Play upload step

## Digital Asset Links

After the first signed build, copy the keystore SHA-256 into Vercel env `ANDROID_CERT_SHA256` so `https://pelbu.bt/.well-known/assetlinks.json` verifies the app. That lets Android open pelbu.bt links in the APK and keeps Play Protect/Chrome from treating it as an unverified wrapper.
