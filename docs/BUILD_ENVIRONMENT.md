# Required build environment

This documents exactly what a developer or CI runner needs to build and run
KaydBooks natively. Written from what this project's `package.json` /
`app.json` actually declare, and from the real, reproducible failure this
repo hit trying to build inside a sandboxed environment without full
internet access (see `docs/PHASE_1_6_1_7_NOTES.md` for that log) — not
guessed.

## Toolchain

| Tool | Required version | Why |
|---|---|---|
| Node.js | 18+ (tested on 22.22.2) | Metro/Expo CLI |
| npm | 10+ | lockfile format |
| JDK | **17** (not 21, not 11) | `@react-native/gradle-plugin`'s own Gradle toolchain pins 17; a machine with only a newer or older JDK on `PATH` will fail at `:gradle-plugin:settings-plugin:compileKotlin` before your app code ever compiles. `sudo apt-get install openjdk-17-jdk-headless` on Debian/Ubuntu, or install via your platform's package manager / sdkman, then `export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which javac))))` or point Android Studio at it directly. |
| Android SDK | Platform 35 (compileSdk), Build-Tools matching, Platform-Tools (`adb`) | Installed via Android Studio's SDK Manager, or `sdkmanager` from the command-line tools package. `ANDROID_HOME`/`ANDROID_SDK_ROOT` must be set. |
| Gradle | 8.13 (via the wrapper — do not install a separate Gradle) | Already pinned in `android/gradle/wrapper/gradle-wrapper.properties` once you run `expo prebuild`; the wrapper downloads it automatically given network access. |
| Expo CLI | via `npx expo` (no global install needed) | This repo pins its own via `expo` in `package.json`. |
| Xcode + CocoaPods | macOS only, for iOS | Not obtainable outside macOS — there is no substitute. |

## Network access this build genuinely requires

Confirmed by reproducing the failure, not assumed:

- `https://services.gradle.org` — Gradle distribution download.
- `https://dl.google.com` — the Android Gradle Plugin and every
  `com.android.*`/`androidx.*` Maven artifact. **A build environment that
  blocks this host cannot complete `./gradlew :app:assembleDebug`,
  regardless of any other configuration.** This is the exact wall this
  project's own sandboxed CI attempt hit.
- `https://repo1.maven.org` (Maven Central) — most other JVM dependencies.
- `https://registry.npmjs.org` — JS dependencies.

If you're running this in a network-restricted CI runner or corporate
proxy, confirm `dl.google.com` is reachable before debugging anything
else — an AGP resolution failure that looks like a dependency problem is
very often this.

## Building

```bash
npm install
npx expo prebuild --clean --platform android   # regenerates android/ (gitignored)
cd android
./gradlew clean
./gradlew :app:assembleDebug
# APK lands at android/app/build/outputs/apk/debug/app-debug.apk
```

For a real device test rather than just a compiled APK:

```bash
adb devices          # confirm the device is authorized
npx expo run:android # builds AND installs AND launches on the connected device
```

iOS, on macOS only:

```bash
npx expo prebuild --clean --platform ios
cd ios && pod install && cd ..
npx expo run:ios
```

## Environment variables (`.env`, see `.env.example`)

| Variable | Where it's used | Never |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `services/supabase.js` | — safe to ship, it's just a hostname |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `services/supabase.js` | put the **service_role** key here — this variable ends up in the compiled app bundle on every user's device |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function runtime only (`supabase secrets set`), auto-provided by Supabase | ship to any client, commit to any file, or reference from `EXPO_PUBLIC_*` |
| `APPLE_SHARED_SECRET`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_PACKAGE_NAME` | Edge Function runtime only | commit; set via `supabase secrets set` |

## Supabase project setup

1. Create a project (a **dedicated staging project**, never your
   production one, while testing).
2. Run `database/schema.sql`, then
   `supabase/migrations/003_authorization_and_schema_fixes.sql`, then
   `supabase/migrations/004_bookmarks_notes_and_read_listen_sync.sql`, in
   that order, in the SQL editor.
3. Set the `books` storage bucket to **private** (Dashboard → Storage →
   books → bucket settings).
4. Promote your own test account to `super_admin` — see the runbook at the
   bottom of `database/SCHEMA_DRIFT_REPORT.md`.
5. `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... APPLE_SHARED_SECRET=... GOOGLE_SERVICE_ACCOUNT_KEY='...' GOOGLE_PACKAGE_NAME=...`
   then `supabase functions deploy verify-receipt verify-local-payment`.

## Android device setup for manual testing

1. Enable Developer Options + USB debugging on the device.
2. `adb devices` should list it as `device` (not `unauthorized`).
3. `npx expo run:android` builds, installs, and launches in one step.
4. For background-audio/lock-screen testing specifically: play audio, then
   press the physical power button (not just switch apps) — Android
   distinguishes "backgrounded" from "screen off," and this app's
   background-playback claim needs the latter tested, not just the former.
