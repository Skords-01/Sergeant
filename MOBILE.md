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
pnpm build:web                                 # → apps/server/dist
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
pnpm build:web                                 # → apps/server/dist

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
