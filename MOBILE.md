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
| JDK               | 17 (Temurin)      | required by Capacitor 7 / AGP 8                               |
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

Both jobs run `pnpm build:web` → `cap sync <platform>` → native build
with no signing. Signed / release builds are out of scope for these
workflows and will be added in a separate PR alongside the corresponding
secrets.

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
