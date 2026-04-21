# `@sergeant/mobile` — Detox E2E

Detox E2E harness for the mobile app (Phase 4 of
`docs/react-native-migration.md`, §8 + §13 Q8).

## Suites

| Suite                         | Scope                                                                      |
| ----------------------------- | -------------------------------------------------------------------------- |
| `finyk-manual-expense.e2e.ts` | Фінік Overview → Transactions → add manual expense → row visible.          |
| `finyk-transactions.e2e.ts`   | Фінік Transactions period filter (prev-month / next-month chevrons).       |
| `routine-smoke.e2e.ts`        | Рутина → Settings → add daily habit → Calendar → toggle today → ✓ visible. |

All three rely on the shared `helpers.ts` primitives
(`tapWhenVisible`, `waitForVisibleById`, `byId`) and the same
`EXPO_PUBLIC_E2E=1` auth-bypass launch flag. Suites run sequentially
with `maxWorkers: 1` so MMKV state is deterministic across `it()`
blocks — each suite seeds its own row rather than relying on another
suite's leftovers.

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

Two parallel workflows share the same suite set:

- **iOS** — `.github/workflows/detox-ios.yml`, `macos-14` runner,
  iPhone 15 simulator. Runs on `pull_request` + `push` to `main` when
  mobile-scoped paths change; `workflow_dispatch` also supported.
- **Android** — `.github/workflows/detox-android.yml`, `ubuntu-latest`
  with KVM acceleration and the `reactivecircus/android-emulator-runner`
  action driving a Pixel_5_API_34 AVD (matches the `emulator` device
  in `.detoxrc.js`). Caches the pnpm store, Gradle dependency graph,
  and AVD snapshot to keep cold-start time under control.

Both workflows upload `apps/mobile/.detox-artifacts` on failure (logs

- screenshots, enabled in `.detoxrc.js > artifacts`) so the run can be
  diagnosed without retrying.
