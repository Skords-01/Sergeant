# `@sergeant/mobile` — Detox E2E

First-wave Detox E2E harness for the mobile app, paired with the Фінік
module port (Phase 4 of `docs/react-native-migration.md`, §8 + §13 Q8).

## Running locally

```bash
# One-off: prebuild the native projects. Detox drives binaries produced
# by the Expo development profile, so the same output is shared with
# `expo run:ios` / `expo run:android`.
pnpm --filter @sergeant/mobile exec expo prebuild --clean

# iOS (macOS only)
pnpm --filter @sergeant/mobile e2e:build:ios
pnpm --filter @sergeant/mobile e2e:test:ios

# Android (macOS / Linux, AVD booted beforehand)
pnpm --filter @sergeant/mobile e2e:build:android
pnpm --filter @sergeant/mobile e2e:test:android
```

The launcher sets `EXPO_PUBLIC_E2E=1` (see `.detoxrc.js` +
`apps/mobile/app/(tabs)/_layout.tsx`) which bypasses the Better Auth
gate so the tab layout renders without a live session. The flag has **no
effect** in release binaries — Metro only inlines `EXPO_PUBLIC_*` values
when they are present at bundle time, and the production EAS profile
does not set them.

## Adding a test

1. Create a new `*.e2e.ts` under `apps/mobile/e2e/` — `jest.config.js`
   picks it up automatically.
2. Reuse `helpers.ts` for the common `tapWhenVisible` / `waitForVisibleById`
   patterns so failure messages stay actionable.
3. Prefer matching by `testID` (or `accessibilityLabel` for rows that
   are naturally unique by label). Do **not** rely on amount / date
   text — localisation varies per device locale and flakes CI.
4. If a new DOM surface needs a test hook, add the `testID` in the
   component file; don't mutate rendered DOM inside the suite.

## CI

The iOS lane runs in `.github/workflows/detox-ios.yml` on macOS runners.
Android CI is intentionally deferred — see the migration plan §9 for
rationale and next steps.
