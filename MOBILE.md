# Mobile builds — local dev commands

> Short operator-oriented reference for the Capacitor shell
> (`@sergeant/mobile-shell`). For the design rationale, plugin list, and
> history of the shell, read
> [`apps/mobile-shell/README.md`](apps/mobile-shell/README.md). For the
> Expo / React Native app (`@sergeant/mobile`) see
> [`apps/mobile/README.md`](apps/mobile/README.md) and
> [`docs/mobile.md`](docs/mobile.md).

The Capacitor shell wraps the existing `@sergeant/web` Vite bundle as a
native Android/iOS app. The web bundle lands in `apps/server/dist` — the
shell reads it from there via `webDir: "../server/dist"` in
[`apps/mobile-shell/capacitor.config.ts`](apps/mobile-shell/capacitor.config.ts).

> Shell білдить web-бандл через
> `pnpm --filter @sergeant/mobile-shell build:web`, який делегує до
> `@sergeant/web build:capacitor` (`VITE_TARGET=capacitor`). Цей варіант
> вимикає `vite-plugin-pwa`, тому `sw.js`, `manifest.webmanifest` і
> `virtual:pwa-register` chunk **не** потрапляють у `apps/server/dist`
> — native WebView їх все одно ігнорує. Для web-деплою (Vercel) і далі
> використовується root `pnpm build:web`, PWA поведінка без змін.

## Prerequisites

| Tool              | Version           | Notes                                                         |
| ----------------- | ----------------- | ------------------------------------------------------------- |
| Node.js           | 20.x (see .nvmrc) | `nvm install 20 && nvm use 20`                                |
| pnpm              | 9.15.1            | `corepack enable && corepack prepare pnpm@9.15.1 --activate`  |
| JDK               | 21 (Temurin)      | required by Capacitor 7.6+ (compiles to VERSION_21) / AGP 8   |
| Android SDK       | API 35            | `compileSdk=35`, `minSdk=23` (Android Studio or `sdkmanager`) |
| Xcode + CocoaPods | latest stable     | macOS only, iOS only                                          |

## Android — debug APK

The `android/` folder is already committed, so no scaffolding is needed.

```bash
# from repo root
pnpm install --frozen-lockfile
# `mobile-shell#build:web` делегує до `@sergeant/web build:capacitor`
# (`VITE_TARGET=capacitor`), який вимикає `vite-plugin-pwa` — shell не
# тягне `sw.js` / `manifest.webmanifest` / `virtual:pwa-register` chunk.
# Для чистого web-деплою все ще використовується root `pnpm build:web`.
pnpm --filter @sergeant/mobile-shell build:web # → apps/server/dist
pnpm --filter @sergeant/mobile-shell exec cap sync android
cd apps/mobile-shell/android
./gradlew assembleDebug                        # → app/build/outputs/apk/debug/
```

Install on a connected device:

```bash
./gradlew installDebug
```

Open in Android Studio (for breakpoint debugging / emulator control):

```bash
pnpm --filter @sergeant/mobile-shell open:android
```

`pnpm --filter @sergeant/mobile-shell build:android` is a convenience
alias for `pnpm build:web && pnpm --filter @sergeant/mobile-shell sync android`.

## iOS — Simulator debug build

`apps/mobile-shell/ios/` is intentionally **not** committed — it is
regenerated on first use via `cap add ios` (which runs `pod install`
under the hood). Requires macOS + Xcode + CocoaPods.

```bash
# from repo root
pnpm install --frozen-lockfile
# Capacitor-варіант web-бандла (без `vite-plugin-pwa`).
pnpm --filter @sergeant/mobile-shell build:web # → apps/server/dist

cd apps/mobile-shell
pnpm exec cap add ios                          # first time only — scaffolds ios/
pnpm exec cap sync ios                         # subsequent syncs

# Run in Simulator from Xcode
pnpm exec cap open ios

# …or build from CLI without Xcode UI
cd ios/App
xcodebuild \
  -workspace App.xcworkspace \
  -scheme App \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  build
```

`pnpm --filter @sergeant/mobile-shell build:ios` runs the web build plus
`cap sync ios` (it does **not** run `cap add ios` — do that once manually
after cloning a fresh machine).

## CI

Two dedicated workflows build the shell on every PR that touches
`apps/mobile-shell/**`, `apps/web/**`, `apps/server/**`, or `packages/**`:

| Workflow                                                                 | Runner          | Output                                                    |
| ------------------------------------------------------------------------ | --------------- | --------------------------------------------------------- |
| [`mobile-shell-android.yml`](.github/workflows/mobile-shell-android.yml) | `ubuntu-latest` | Debug APK uploaded as `sergeant-shell-debug-apk` artifact |
| [`mobile-shell-ios.yml`](.github/workflows/mobile-shell-ios.yml)         | `macos-latest`  | Simulator `.app` (build-only, no artifact)                |

Both debug jobs run `pnpm build:web` → `cap sync <platform>` → native
build with no signing. The signed / release lanes live in dedicated
workflows — see [§ Release — iOS](#release--ios) and
[§ Release — Android](#release--android).

The separate Detox suites (`detox-android.yml`, `detox-ios.yml`) cover
the Expo / React Native app in `apps/mobile/` — they are unrelated to
the Capacitor shell.

## Release — iOS

The release lane lives in
[`mobile-shell-ios-release.yml`](.github/workflows/mobile-shell-ios-release.yml)
on `macos-latest`. It triggers on tag pushes matching `v*` and on
manual `workflow_dispatch`; the PR-time `mobile-shell-ios.yml`
workflow is unchanged.

The job runs an unsigned Simulator fallback (identical to the PR-time
workflow) until all signing secrets below are present. Once they are,
it archives `App.xcarchive`, exports a signed `.ipa` using
[`apps/mobile-shell/ci/ExportOptions.plist`](apps/mobile-shell/ci/ExportOptions.plist)
(rendered with `envsubst`), uploads the IPA as a GitHub artifact
(`sergeant-shell-ipa`, 14 days retention), and ships it to TestFlight
via `apple-actions/upload-testflight-build@v1`.

### Required repo secrets

| Secret                              | Source                                                                                                                                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APPLE_BUILD_CERTIFICATE_BASE64`    | Apple Developer Portal → Certificates, Identifiers & Profiles → **Certificates** → create an **Apple Distribution** cert → download `.cer` → import into Keychain Access → export as `.p12` → `base64 -i ios_distribution.p12 \| pbcopy`.               |
| `APPLE_P12_PASSWORD`                | The password you set when exporting the `.p12` above.                                                                                                                                                                                                   |
| `APPLE_PROVISIONING_PROFILE_BASE64` | _(Optional — only needed if you do not use the ASC API to auto-download.)_ Apple Developer Portal → **Profiles** → create an **App Store** profile for `com.sergeant.shell` → download `.mobileprovision` → `base64 -i sergeant-shell.mobileprovision`. |
| `APPLE_KEYCHAIN_PASSWORD`           | Any strong random string. Generated per-run keychain password (`openssl rand -hex 32`).                                                                                                                                                                 |
| `APP_STORE_CONNECT_API_KEY_ID`      | App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API** → create a key with **App Manager** role → copy the 10-char **Key ID**.                                                                                         |
| `APP_STORE_CONNECT_API_ISSUER_ID`   | Same screen → the **Issuer ID** shown at the top (a UUID). Shared across all keys in the team.                                                                                                                                                          |
| `APP_STORE_CONNECT_API_KEY_BASE64`  | Same screen → download the `.p8` (one-shot, cannot be re-downloaded) → `base64 -i AuthKey_<KEY_ID>.p8`.                                                                                                                                                 |
| `IOS_TEAM_ID`                       | Apple Developer Portal → **Membership** → the 10-character **Team ID**.                                                                                                                                                                                 |

### Optional repo variables (`vars.*`, not secrets)

| Var                             | Default                    | Purpose                                                                                                                                                                      |
| ------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IOS_BUNDLE_ID`                 | `com.sergeant.shell`       | Must match `appId` in `apps/mobile-shell/capacitor.config.ts`.                                                                                                               |
| `IOS_PROVISIONING_PROFILE_NAME` | `Sergeant Shell App Store` | Human-readable name of the App Store profile in the Apple portal. Used as the value of `provisioningProfiles[IOS_BUNDLE_ID]` in `ExportOptions.plist`. NOT the profile UUID. |

### Running the workflow

```bash
# Tag-push (preferred for "this is the release to ship"):
git tag v0.1.0 && git push origin v0.1.0

# Ad-hoc (build-and-test without a tag):
# GitHub → Actions → "Mobile Shell (iOS Release)" → "Run workflow"
# Uncheck "Upload the resulting .ipa to TestFlight" to skip upload and
# just collect the .ipa artifact.
```

After a successful run:

- Download the signed `.ipa` from the run's **Artifacts** section
  (`sergeant-shell-ipa`) for sideloading / manual QA.
- TestFlight processing takes 5–20 min. Add testers: App Store Connect
  → **TestFlight** → pick the build → **Internal** or **External
  Testing** group → **Add Testers by Email**.

### First-run notes

- `apps/mobile-shell/ios/` is intentionally **not** committed. The
  workflow runs `cap add ios` (which also runs `pod install`) on the
  first run and caches `~/.cocoapods` + `ios/App/Pods` for subsequent
  runs via `actions/cache`. This means the first tag-push is slow
  (~10 min extra for Pods resolution); subsequent runs hit the cache.
- The fallback Simulator build has no signing requirements, so this
  PR is safe to merge before secrets land in the repo — the release
  job will just log `::warning::iOS release secrets not configured,
skipping signed build` and build the unsigned `.app` instead.

## Release — Android

The release lane produces **two** artefacts from one workflow run:

| Artefact                     | Gradle task            | When to use                                                                                                                                                                                        |
| ---------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sergeant-shell-release-aab` | `:app:bundleRelease`   | Play Store uploads (`google-github-actions/upload-google-play`, internal track). An `.aab` is **not** installable directly — Play re-splits it into per-device APKs server-side.                   |
| `sergeant-shell-release-apk` | `:app:assembleRelease` | Direct sideload outside Play: `adb install app-release.apk`, file-manager install, QA device farms, ad-hoc demos. A signed `.apk` is what Android's PackageInstaller actually consumes on a phone. |

> Rule of thumb: if the build is going anywhere near Play Store, grab
> the `.aab`. If a human is going to drop it onto a phone via USB or a
> download link, grab the `.apk`. Both come from the same run, share
> the same `versionCode` / `versionName`, and are signed with the same
> key — so you never need to re-run the workflow just to get the other
> format.

Workflow: [`mobile-shell-android-release.yml`](.github/workflows/mobile-shell-android-release.yml).
Triggers:

- `workflow_dispatch` — manual run from the Actions UI (select the
  branch; tags are also supported).
- `push` of a tag matching `v*` (e.g. `v0.1.0-shell.1`) — cut a release
  tag locally with `git tag v0.1.0-shell.1 && git push origin --tags`.

Without the four signing secrets (listed below) the workflow still
runs `:app:bundleRelease :app:assembleRelease` — but the artefacts are
unsigned. That's useful as a CI smoke-test of the release graph
(ProGuard/R8 keep-rules, Capacitor sync, resource shrinking) on PRs
that don't have access to production signing material. Unsigned
artefacts cannot be installed on a real device and cannot be uploaded
to Play — they exist only to validate the Gradle configuration.

### One-time setup — generate a signing keystore

This is a local, one-off step for a maintainer with write access to
GitHub Secrets. The keystore file itself stays OFF the repo — only the
base64 blob and passwords go into GitHub Secrets.

```bash
# 1. Generate a PKCS12 keystore valid for ~27 years (Play recommends
#    ≥2033 expiry for new uploads).
keytool -genkeypair -v \
  -keystore sergeant-shell-release.keystore \
  -alias sergeant-shell \
  -keyalg RSA -keysize 2048 \
  -validity 10000 \
  -storetype PKCS12

# 2. Encode for transport via GitHub Secrets (pasting raw binary into
#    the UI does not survive newline normalization).
base64 -w0 sergeant-shell-release.keystore > sergeant-shell-release.keystore.base64

# 3. Back up the .keystore file + passwords into the team password
#    manager. Losing the keystore means you can never ship an update
#    to the same Play Store listing — Play verifies the signing key
#    matches the first upload forever.
```

### GitHub Secrets — four entries

Add these in **Repo → Settings → Secrets and variables → Actions**:

| Secret                              | Value                                                              |
| ----------------------------------- | ------------------------------------------------------------------ |
| `ANDROID_RELEASE_KEYSTORE_BASE64`   | Contents of `sergeant-shell-release.keystore.base64` (one line).   |
| `ANDROID_RELEASE_KEYSTORE_PASSWORD` | The `-storepass` you picked during `keytool -genkeypair`.          |
| `ANDROID_RELEASE_KEY_ALIAS`         | `sergeant-shell` (or whatever `-alias` you passed to `keytool`).   |
| `ANDROID_RELEASE_KEY_PASSWORD`      | The `-keypass` for the alias (usually same as the store password). |

The workflow decodes the base64 blob into a file on the runner,
exports the four `SERGEANT_RELEASE_*` env vars that
`apps/mobile-shell/android/app/build.gradle` reads, then deletes the
decoded keystore on `post` — the raw keystore never persists on the
runner beyond the single Gradle invocation.

### Triggering a release build

```bash
# Option A — manual, any branch:
#   GitHub → Actions → "Mobile Shell (Android, Release AAB + APK)"
#   → "Run workflow" → pick branch → Run.

# Option B — tag-driven, reproducible:
git tag v0.1.0-shell.1
git push origin v0.1.0-shell.1
# The tag push triggers the same workflow; the artefact pair carries
# the tag's commit SHA in its filename via Gradle's default output
# naming.
```

### Fetching the AAB / APK

After the run completes:

1. GitHub → Actions → "Mobile Shell (Android, Release AAB + APK)" →
   click the run → scroll to **Artifacts**.
2. Download either `sergeant-shell-release-aab.zip` (Play) or
   `sergeant-shell-release-apk.zip` (sideload). Both zips contain a
   single file at the expected Gradle output path.
3. For sideload: `adb install app-release.apk` (device must be
   connected + USB debugging on; uninstall any `com.sergeant.shell`
   debug build first — Android refuses installs when the signing key
   changes).

Play Store upload (`upload-google-play` + service account JSON) is
**not** part of this workflow — it will land in a follow-up PR that
sets up an internal-track workflow + a separate
`ANDROID_PLAY_SERVICE_ACCOUNT_JSON` secret.
