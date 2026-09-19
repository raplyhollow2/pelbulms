# Pelbu LMS Android app

Native Android SDK app (`applicationId`: `bt.pelbu.lms`) that loads the Pelbu LMS site in a system WebView.

## Versioning

Source of truth: [`version.properties`](./version.properties)

| Field | Meaning |
| --- | --- |
| `VERSION_NAME` | User-facing semver (`1.2.3`) — GitHub tag `android-v1.2.3` |
| `VERSION_CODE` | Monotonic integer — **must increase** for every installable update |

Bump locally:

```bash
./scripts/bump-version.sh patch   # 1.0.0 → 1.0.1 (code +1)
./scripts/bump-version.sh minor   # 1.0.1 → 1.1.0
./scripts/bump-version.sh major   # 1.1.0 → 2.0.0
./scripts/bump-version.sh set 1.4.0
```

Or run **Actions → Build Android APK** and choose `patch` / `minor` / `major` (or an explicit version). The workflow:

1. Bumps `version.properties` and commits it
2. Builds a signed release APK
3. Publishes GitHub Release `android-vX.Y.Z` with `pelbu-lms-X.Y.Z.apk` (+ alias `pelbu-lms.apk`)
4. Refreshes floating tag `android-latest` for older docs

The website `/download` page always serves the **highest** `android-v*` release.

## Local debug build

```bash
cd android
./gradlew assembleDebug
```

Debug APK: `android/app/build/outputs/apk/debug/`.

## Signed release (manual / CI)

1. Create a keystore once: `android/scripts/create-release-keystore.sh`
2. GitHub → Settings → Secrets → Actions:
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
3. Actions → **Build Android APK** → Run workflow
4. `/download` picks up the new `android-v*` release automatically

## Digital Asset Links

After the first signed build, put the keystore SHA-256 in Vercel env `ANDROID_CERT_SHA256` so `/.well-known/assetlinks.json` verifies the app.
