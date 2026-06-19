# Mobile frontend audit — `apps/mobile` (Expo 52 + RN 0.76)

> **Last validated:** 2026-06-19 by Maple (Gastown polecat `9de6c57e`), convoy `36eed96a`. **Next review:** 2026-09-17.

> **Date:** 2026-06-19
> **Author:** Maple (Gastown polecat `9de6c57e`), convoy `36eed96a`
> **Scope:** `apps/mobile/**` only. No `apps/mobile-shell/**` (Capacitor) and no shared packages. No code changes — read-only audit.
> **Surface signal:** Touches `apps/mobile/**` → `sergeant-mobile-expo`. Cross-references: root `AGENTS.md`, `apps/mobile/AGENTS.md`, ADR-0052, storage-roadmap PR #065/#066.

---

## 1. Executive summary

`apps/mobile` is a **substantial, well-structured Expo 52 + React Native 0.76 app** that already mirrors most of the Sergeant web surface (auth, hub, finyk, fizruk, nutrition, routine, HubChat, HubSearch, HubReports, deep links, push, voice). The codebase shows a clear migration arc from a Capacitor shell to native RN, with an explicit `apps/mobile` + `apps/mobile-shell` split and a single source of truth for design tokens.

**Strengths (kept short — the audit focuses on debt):**

- Consistent Expo Router file-based layout with route-group boundaries (`(auth)`, `(tabs)`, modal `<Stack.Screen>` for `settings` / `assistant` / `hub-*`).
- Storage layer is **deliberately encrypted** (MMKV with a SecureStore-derived key) and the React tree is gated on bootstrap completion — eliminates the plaintext-vs-encrypted race.
- Sync engine has a **defence-in-depth error boundary** (class boundary inside `GestureHandlerRootView` + segment-level `ErrorBoundary` export) so provider throws cannot reach Expo Router's red-box.
- React Query persistence is wired with a `shouldDehydrateQueryForPersistMobile` allow-list to keep auth/me out of MMKV.
- `Jest` config is well-tuned for memory (`maxWorkers: 50%`, `workerIdleMemoryLimit: 512MB`) and the custom `moduleNameMapper` + `transformIgnorePatterns` is justified inline (worth its own comment line about the `design-tokens` `exports` quirk).
- E2E (Detox) suite spans 16 files, 4 modules (finyk, fizruk, nutrition, routine), hub UX smoke, offline-sync, deep-link, auth flows. Detox config plugin is conditionally registered so production IPAs are unaffected.
- Domain invariants (Kyiv time, kopiykas as `number`, Better Auth opaque user IDs) are surfaced in `AGENTS.md` and respected in the source.

**Top concerns (prioritised):**

1. **Module-size discipline is already broken at 12 files.** Hard Rule #18 caps `apps/web` and `apps/server` at 600 LOC; `apps/mobile` is not in scope, but the same anti-pattern has spread. `HubDashboard.tsx` is **593 LOC**, `sqliteReader.ts` **582 LOC**, `HabitForm.tsx` **579 LOC**, `TransactionsPage.tsx` **560 LOC**, `Workouts.tsx` **558 LOC**, `fizrukDualWriteState.ts` **557 LOC**, `FloatingActionButton.tsx` **553 LOC**, `storage.ts` **550 LOC**, `BudgetsPage.tsx` **544 LOC**, `AddMealSheet.tsx` **519 LOC**, `residualImport.ts` **514 LOC**, `BodyAtlas.tsx` **508 LOC**.
2. **Dual-write layer is duplicated 4×.** `src/modules/{routine,fizruk,nutrition,finyk}/lib/dualWrite/{adapter,index}.ts` is the same adapter shape with module-specific import paths. The repo already extracts `makeDualWriteKvStore` for the storage layer (`storage.ts:115`); the same pattern should be lifted into `@sergeant/shared` so the four modules call a single helper.
3. **No bundle-size or runtime-perf budget for `apps/mobile`.** The root `AGENTS.md` enforces JS/CSS budgets and LHCI on `apps/web`, but `apps/mobile` has no EAS bundle-size gate, no FlashList usage outside `finyk` (4 hits), and only 20 `FlashList` references vs 157 plain `ScrollView` usages.
4. **NativeWind + design-tokens have a fragile compile-time coupling.** `global.css` declares semantic tokens as space-separated RGB triplets so opacity modifiers work; the `tailwind.config.js` re-wraps `@sergeant/design-tokens/tailwind-preset` and requires `sucrase/register/ts` in `app.config.ts` to load `withAndroidShortcuts.ts`. Two design-token source files (`tokens.js`, `mobile.js`) need explicit `transformIgnorePatterns` holes and `moduleNameMapper` redirects or 13 unrelated mobile suites cascade-fail. The same `moduleNameMapper` redirects ship in `jest.config.js` — change one, forget the other, tests cascade-fail.
5. **No DOM-leak lint rule at mobile level.** `eslint.config.js` re-exports the root manifest; the AGENTS.md claims "ESLint catches the most obvious — but better to check in feature-cycle" (paraphrased). Given 0 hits of `import { document } from …` / `import { window }` in the current tree, the rule is doing its job, but there is no explicit per-package guard documented in the AGENTS.

Each section below links evidence to file:line where possible. Recommendations are **P0–P3** to mirror the design-system-audit convention.

---

## 2. Inventory

### 2.1 Tree shape

| Path                          | Files (ts/tsx) | LOC (prod) | Notes |
| ----------------------------- | -------------- | ---------- | ----- |
| `apps/mobile/app/**`          | 46             | ~2 200     | Expo Router tree (root layout + auth/tabs groups + 5 modal screens). |
| `apps/mobile/src/api`         | 2              | small      | `apiClient.ts`, `apiUrl.ts`. |
| `apps/mobile/src/auth`        | 4              | small      | `authClient.ts`, `e2eAuthMock.ts`, 2 test files. |
| `apps/mobile/src/components`  | 2              | small      | Re-exports only; UI primitives live under `components/ui/*` (38 files). |
| `apps/mobile/src/core`        | 15 (top-level) | large      | Error boundaries, onboarding, dashboard, hub, settings, syncEngine, theme, db. |
| `apps/mobile/src/features`    | 0 (top-level) | n/a        | Subdirs `push/`, `analytics/` (PushRegistrar, AnalyticsIdentityBridge). |
| `apps/mobile/src/hooks`       | 6              | small      | `useReduceMotion`, `useScreenReader`, `useTabBadges`, `useVisualKeyboardInset`, index, test. |
| `apps/mobile/src/lib`         | 17 (top-level) | large      | `storage.ts` 550, `useDeepLinks.ts`, `storageEncryption`, `haptic`, `fileDownload`, `fileImport`, `voice/`, `observability/`. |
| `apps/mobile/src/modules`     | 0 (top-level) | very large | `finyk` 12 256, `fizruk` 14 960, `nutrition` 9 166, `routine` 6 235. |
| `apps/mobile/src/observability` | 1            | small      | `IdentityBridge.tsx`. |
| `apps/mobile/src/providers`   | 1              | small      | `QueryProvider.tsx`. |
| `apps/mobile/src/sync`        | 1 (top-level) | small      | Re-export; `hook/useSyncStatus.ts`, `persister/mmkvPersister.ts`. |
| **Totals (src/)**             | **600**        | **~76 800 (incl. tests)** / **~55 000 prod** | Prod = 470 files; tests = 130 files. |

> Tests/prod ratio: 130 / 470 ≈ **27.7 %** — healthy for a ported RN app. The voice sub-package has 2 test files for 2 source files (100 %). The `core/` subdir has dedicated `*.test.tsx` for nearly every class component (OnboardingWizard, ErrorBoundary, ModuleErrorBoundary, SegmentErrorBoundary, SyncStatusIndicator, useBackToExit, useDeepLinks, several dashboard panels).

### 2.2 Stack

- **Expo 52** + **React Native 0.76.9** + **Expo Router 4** + **NativeWind 4** (CSS-interop, `nativewind/babel`).
- React 18.3.1, React Native Web 0.19 (web target is `metro`, `output: "static"`).
- **Storage:** MMKV (encrypted, post-bootstrap) + `expo-secure-store` for auth token. SQLite (`expo-sqlite` 15.1.4) for module stores.
- **State / data:** `@tanstack/react-query` 5.99 + `react-query-persist-client` 5.99, persisted via `mmkvPersister`.
- **Observability:** `@sentry/react-native` 6.10, PostHog (mobile transport via `lib/observability/posthog.ts`).
- **Auth:** `better-auth` 1.6.14 + `@better-auth/expo` 1.6.14.
- **Voice:** `expo-speech-recognition` 1.1.1 + `expo-speech` 13.0.1.
- **Lists:** `@shopify/flash-list` 1.7.3 (only used in 4 files, all under `finyk/pages/Transactions`). Everything else is `ScrollView` (157 occurrences).
- **E2E:** Detox (`.detoxrc.js` + `@config-plugins/detox`).
- **Build:** EAS 14.x; `runtimeVersion: { policy: "sdkVersion" }`, `newArchEnabled: true`.

### 2.3 Build / runtime features (from `app.config.ts`)

- iOS Universal Links + Android `autoVerify: true` App Links for two hosts (`sergeant.vercel.app`, `sergeant.2dmanager.com.ua`).
- iOS 3D-Touch / Android long-press shortcuts (3 each, UA labels) — co-ordinated with the Capacitor shell.
- iOS permissions: `NSSpeechRecognitionUsageDescription`, `NSMicrophoneUsageDescription`, `UIBackgroundModes: [remote-notification]`, `UIApplicationShortcutItems`.
- Android permissions: `RECORD_AUDIO`; intent-filters for `sergeant://` (custom scheme) and HTTPS hosts.
- Plugins: `expo-router`, `expo-secure-store`, `expo-notifications`, `expo-camera` (with `cameraPermission` UA), `expo-image-picker` (UA), `expo-splash-screen`, `expo-speech-recognition` (with `microphonePermission`/`speechRecognitionPermission` UA + `androidSpeechServicePackages`), `@sentry/react-native/expo`, conditional `@config-plugins/detox` for `EXPO_PUBLIC_E2E=1` or `E2E_BUILD=1`.
- Typed routes: `experiments.typedRoutes: true`.

### 2.4 EAS profiles (`eas.json`)

Three profiles, all `internal` distribution except `production` (which targets `store` with `autoIncrement`).

| Profile       | distribution | channel      | iOS resource | Android buildType |
| ------------- | ------------ | ------------ | ------------ | ----------------- |
| development   | internal     | development  | m-medium sim | apk               |
| preview       | internal     | preview      | m-medium sim | apk               |
| production    | store        | production   | m-medium     | app-bundle        |

---

## 3. Architecture & boundaries

### 3.1 Provider stack (`app/_layout.tsx`)

Order is intentional and commented:

```
GestureHandlerRootView        (must be outermost so its native binding cannot detach)
  SafeAreaProvider
    RootErrorBoundary          (class boundary; catches provider throws)
      QueryProvider            (PersistQueryClientProvider + MMKV persister)
        ApiClientProvider
          IdentityBridge
          ToastProvider
            ColorSchemeBridge
            DynamicStatusBar
            RootShell          (useDeepLinks + useBackToExit + <Stack>)
            ToastContainer
            PushRegistrar
            AnalyticsIdentityBridge
```

Bootstrap order in `useEffect`:
1. `initObservability()` (Sentry only — no MMKV touch).
2. `bootstrapEncryptedStorage()` → after resolve, `initPostHog()` (PostHog needs encrypted MMKV).
3. `SplashScreen.hideAsync()`.
4. `bootstrapMobileKvStore()` (fire-and-forget; SQLite warm-cache).
5. `bootSyncEngineWriter({ captureException })` (fire-and-forget; v2 writer).

The `storageReady` gate is correct: the React tree renders `null` until step 2 finishes, which is what prevents the plaintext/encrypted race.

**Concerns:**

- Side-effect imports (`@/lib/haptic`, `@/lib/fileDownload`, `@/lib/fileImport`, `@/hooks/useVisualKeyboardInset`) are module-level so they bind on first `import` of `_layout.tsx`. This is fine for a single entry point, but it makes the boot order implicit for any future test that imports `RootLayout` (would not have these adapters registered).
- `installE2EAuthMock()` runs at **module load** (top-level call) — it is conditional on `EXPO_PUBLIC_E2E_REAL_AUTH=1` so it inlines to a no-op in production. This is correct, but the comment notes the failure mode is "30-second network timeout before redirect to sign-in" if the mock isn't installed before `useUser` mounts — worth keeping the order.
- `bootSyncEngineWriter({ captureException })` is passed an inline `captureException: captureError` adapter. There is a comment that it "internally .catch-es boot failures" — there is no test that proves the catch path. Recommend a unit test for the boot-failure path.

### 3.2 Routing topology

```
app/_layout.tsx                 (Stack with headerShown:false; six modal screens + (auth) + (tabs))
app/(auth)/                     (sign-in, sign-up, forgot-password, onboarding, index)
app/(auth)/_layout.tsx          (gates via useUser; modal slide_from_bottom)
app/(tabs)/                     (Hub, Finyk, Fizruk, Routine, Nutrition)
app/(tabs)/_layout.tsx          (Tabs; auth gate; onboarding overlay; tab badges)
app/(tabs)/<module>/*           (Stack per module; ~ 3–10 screens each)
app/{settings,assistant,hub-chat,hub-search,hub-reports}.tsx   (modals)
app/auth/callback.tsx           (OAuth callback)
app/+not-found.tsx
```

The Hub modal screens (chat, search, reports) and `settings` / `assistant` are mounted as siblings of `(tabs)` so they push over the tabs without unmounting the tab state. This is the right shape for an in-app hub pattern.

**Concerns:**

- No `not-found.tsx` per module — only the global `+not-found.tsx`. A bad link to `/(tabs)/fizruk/typo` will land on the global fallback instead of a fizruk-specific "screen moved" hint.
- `app/(tabs)/fizruk/_layout.tsx` switches `headerShown: false` because it draws its own headers, but the comment lives in the **tabs** layout, not the **fizruk** layout. Future maintainers editing fizruk will not see the rationale unless they read the tabs layout. Minor.
- The auth callback `app/auth/callback.tsx` is a separate `Stack.Screen` outside `(auth)`. Routing here is correct (`options={{ headerShown: false }}` matches the OAuth PKCE pattern) but the rationale is not documented in the route file.

### 3.3 Cross-package surface

Mobile imports from these workspace packages (per `tsconfig.json` paths):

- `@sergeant/shared` — `lib/voice`, `lib/haptic` (via side-effect), `lib/fileDownload`, `lib/fileImport`, `lib/storageKeys`, `lib/visualKeyboardInset` (via side-effect).
- `@sergeant/api-client` — `useUser`, `ApiClientProvider`.
- `@sergeant/design-tokens` — `tailwind-preset`, `tokens`, `mobile`.
- `@sergeant/db-schema` — `sqlite` + `migrate/runner` + `migrate/sqlite`.
- 4 domain packages: `finyk-domain`, `fizruk-domain`, `nutrition-domain`, `routine-domain`.
- `@sergeant/insights` — coach/Hub integrations.

This is the correct shape. No mobile code reaches into `apps/web/**` (verified by grep — 0 hits). The "no DOM leakage" gotcha from `apps/mobile/AGENTS.md` is observed in practice.

### 3.4 Storage architecture

- **Non-sensitive JSON blobs** → MMKV (encrypted post-bootstrap, via `id: "sergeant.mobile.v1.enc"`).
- **Auth token** → `expo-secure-store` (via `@better-auth/expo`).
- **Encryption key** → 32-byte random, in `expo-secure-store`.
- **Module stores (per module)** → SQLite (`expo-sqlite`), accessed via a warm-cache `Map` populated at boot. PR #065 ships a dual-write layer (SQLite primary + MMKV mirror) for canary rollback. PR #066 will drop the mirror.
- **Query cache** → MMKV, gated by `shouldDehydrateQueryForPersistMobile` (excludes auth/me/coach/sync/balance).
- **Onboarding "done" flag** → MMKV, exposed by `@sergeant/shared` `getOnboardingStore` (read by tabs layout + OnboardingWizard).

The two-rung priority ladder (`resolveStore` in `src/lib/storage.ts:150`) is well-documented and the `makeDualWriteKvStore` factory is the **right pattern** to reuse — it currently lives in `apps/mobile`, not in `@sergeant/shared`. See § 6 for the recommendation to lift it.

### 3.5 Sync engine

`core/syncEngine/` has three files: `netInfoEventTarget.ts`, `singleton.ts`, `syncEngineWriter.ts` (each has a paired `*.test.ts`). The writer is "op-log v2" — per-module dual-write adapters (under `src/modules/*/lib/dualWrite/`) intercept mutations and feed the writer. The cloud-sync v1 path is **sunset** (PR #052c) and the mobile shim is **dropped** (PR #053c), per the in-line comment in `src/lib/storage.ts:269`.

The v2 writer boots lazily after the storage bootstrap, which is the right order (op-log replay reads from the encrypted store). The error-routing through `captureException` is consistent with the rest of the observability layer.

---

## 4. Code health

### 4.1 Module size (Hard Rule #18 analogue)

Hard Rule #18 caps `apps/web/**` and `apps/server/**` at 600 LOC. `apps/mobile` is not in scope, but the same hygiene rule should be extended. Files currently over 500 LOC (12 total — all prod code, no test files):

| File                                                                | LOC |
| ------------------------------------------------------------------- | --: |
| `apps/mobile/src/core/dashboard/HubDashboard.tsx`                   | 593 |
| `apps/mobile/src/modules/fizruk/lib/sqliteReader.ts`                | 582 |
| `apps/mobile/src/modules/routine/pages/Habits/HabitForm.tsx`        | 579 |
| `apps/mobile/src/modules/finyk/pages/Transactions/TransactionsPage.tsx` | 560 |
| `apps/mobile/src/modules/fizruk/pages/Workouts.tsx`                 | 558 |
| `apps/mobile/src/modules/fizruk/lib/fizrukDualWriteState.ts`         | 557 |
| `apps/mobile/src/components/ui/FloatingActionButton.tsx`            | 553 |
| `apps/mobile/src/lib/storage.ts`                                    | 550 |
| `apps/mobile/src/modules/finyk/pages/Budgets/BudgetsPage.tsx`       | 544 |
| `apps/mobile/src/modules/nutrition/components/AddMealSheet.tsx`      | 519 |
| `apps/mobile/src/modules/fizruk/lib/residualImport.ts`               | 514 |
| `apps/mobile/src/components/ui/FizrukBodyTrendCard.tsx` (related)   | n/a (composed of BodyAtlas 508) |
| `apps/mobile/src/modules/fizruk/components/BodyAtlas.tsx`            | 508 |

**The biggest concentration is in `fizruk` (14 960 LOC)**, then `finyk` (12 256), then `nutrition` (9 166), then `routine` (6 235). The `routine` module is the **smallest despite being the root tab** — suggests the other three grew faster than the contract.

**Why this matters here, not just in web:**

- The dual-write adapter for each module is ~50–100 LOC; lifting it to `@sergeant/shared` would reduce 4 modules' per-file size by ~10 % each.
- `storage.ts` is 550 LOC because it carries the entire web mirror (`useLocalStorage`, `createModuleStorage`) plus the mobile-specific two-rung priority ladder. A 5-minute split into `webMirror.ts` + `mobileStorage.ts` would help.
- `FloatingActionButton.tsx` (553 LOC) is a **single UI primitive** — almost certainly should be ≤ 150 LOC; the LOC is in sub-components, gestures, and theme hooks.

### 4.2 Type safety

- `strict: true` + `noUncheckedIndexedAccess: true` is in `tsconfig.json`. **Compliant** with Hard Rule #19.
- `@ts-ignore` / `@ts-expect-error` count: **0**. Good.
- `any` type usage: 14 occurrences (counted by `grep -E ": any\b|<any>|as any"`); mostly in test mocks and a few generic hooks (`useModulePreviews.ts`, `HubChatUtils.ts`, `weeklyDigestStorage.ts`, `ValueProgressBar.tsx`, `QueryProvider.tsx`). No red flag, but worth tracking as a baseline before/after refactors.
- ESLint config (`eslint.config.js`) re-exports the root `packageConfig("../..")` via `eslint.per-package.js`. The diff against the root config is enforced by `pnpm lint:eslint-config-diff`. **Compliant** with the per-package-config pattern.
- The `moduleNameMapper` redirects in `jest.config.js` for `@sergeant/db-schema` (5 subpaths) and `@sergeant/design-tokens` (4 subpaths) total **9 redirects**. These exist because (a) `db-schema` ships a `dist/` artefact but Jest needs the TS source, and (b) `design-tokens` has a broken `exports` map ordering (`.d.ts` before `.js`). Both are **documented inline** with the commit-level rationale — this is exactly the right level of comment density for non-obvious resolver glue.

### 4.3 Console hygiene

- `console.log`: 6 hits (all in error-boundary / observability paths, intentional).
- `console.warn`: 40 hits (mostly in dual-write adapters, `createModuleStorage.reportError`, `storage.ts` JSON.stringify fallback). All routed through a per-module logger. **Acceptable.**
- No `console.error` direct calls (verified — only Sentry's `captureError`/`captureException` is used for errors, which is the right pattern).

### 4.4 Comments & AI markers

- `// TODO`, `// FIXME`, `// HACK`, `// XXX`: 9 hits total across `src/` + `app/`. **Excellent** for a 600-file repo.
- `AI-NOTE` / `AI-CONTEXT` / `AI-DANGER` / `AI-LEGACY`: 2 hits. The repo's ai-marker convention is in place; mobile is just not making heavy use of it (which is fine — AI markers are most useful at the package boundary, which for mobile is `apps/mobile/AGENTS.md` and `core/ErrorBoundary.tsx`).

### 4.5 Side-effect imports

The root layout deliberately imports side-effect-only modules (`@/lib/haptic`, `@/lib/fileDownload`, `@/lib/fileImport`, `@/hooks/useVisualKeyboardInset`) so that the shared contracts from `@sergeant/shared` are bound to the native adapter before any consumer reads `getHaptic()` / `getFileDownload()` / etc. This is **documented inline** and is the right pattern for `app/_layout.tsx`, but it has a side effect: **any test that imports `RootLayout` will register the native adapters.** Consider whether `installE2EAuthMock` should be split into `installE2EAuthMock` (production no-op) and a test-only entrypoint to make this contract explicit.

### 4.6 Deep-link co-ordination

The `UNIVERSAL_LINK_HOSTS` array is a **5-file lock-step** contract:

1. `apps/mobile/app.config.ts:67` — `ios.associatedDomains` + Android `intentFilters`.
2. `apps/mobile/src/lib/deepLinks.ts` — runtime parser allow-list.
3. `apps/mobile-shell/src/index.ts` — `DEEP_LINK_HTTPS_HOSTS`.
4. `apps/web/public/.well-known/apple-app-site-association`.
5. `apps/web/public/.well-known/assetlinks.json`.

The comment in `app.config.ts:55-66` calls this out, but **there is no automated test that asserts all five are in sync**. A drift here would silently break either iOS Universal Link or Android `autoVerify` (and Android would only fail at Play Services verification time, not at build time). See § 6.5 for a recommended `pnpm check:deep-link-hosts` script.

### 4.7 Storage-key parity

`storage.ts` is explicit that "no key prefixing — keys are passed through verbatim, matching the web adapter's behaviour so existing storage-key constants (`apps/web/src/shared/lib/storageKeys.ts`) port unchanged." This is correct for parity but means a key collision in `apps/web/src/shared/lib/storageKeys.ts` would also collide in mobile. The shared contract is in `@sergeant/shared`, so this is fine — but worth noting if a `lib/storageKeys` is ever added back to web-local.

### 4.8 E2E / Detox posture

- 16 E2E files in `apps/mobile/e2e/*`: `auth-flows`, `deep-link`, `finyk-full`, `finyk-manual-expense`, `finyk-transactions`, `fizruk-full`, `fizruk-measurements`, `hub-ux-smoke`, `nutrition-full`, `nutrition-water-barcode`, `offline-sync`, `routine-full`, `routine-smoke`.
- `e2e/README.md` documents the runner.
- Detox config is gated behind `EXPO_PUBLIC_E2E=1` / `E2E_BUILD=1` so production builds don't include the `DetoxActivity`. **Compliant** with the AGENTS.md note.
- GitHub workflow file is `.github/workflows/detox-ios.yml`; Android CI is **not wired** (per migration doc §9). The AGENTS.md E2E command `e2e:test:android` will not be exercised in CI. See § 6.6.

### 4.9 Build / config

- `eas.json` has 3 profiles. `production` is the only `store` target.
- `app.config.ts` is a TypeScript file (replaces the old `app.json`).
- `withAndroidShortcuts` plugin is a local config function. The `sucrase/register/ts` line at the top of `app.config.ts` is **non-obvious and rightly commented** — without it, `./plugins/withAndroidShortcuts` fails to resolve at `expo prebuild` time.
- `check-build-config.ts` script validates `app.config.ts` before EAS build: bundleIdentifier, package, `expo-notifications` in `plugins`, `remote-notification` in `UIBackgroundModes`. **Good** lightweight pre-build gate; the `EXPO_PUBLIC_EAS_UPDATES_URL` block is not asserted (the field exists in the config but the script does not check it).
- `packageManager` is `pnpm@9.15.1` (root `package.json`); `react-native@0.76.9` is pinned in `apps/mobile/package.json`. **No floating versions.**

### 4.10 Theming & NativeWind

- `global.css` mirrors `apps/web/src/index.css` semantic tokens as space-separated RGB triplets. Dark mode uses `.dark` selector (same as web). `tailwind.config.js` re-wraps `@sergeant/design-tokens/tailwind-preset` and sets `darkMode: "class"`.
- `colorScheme` toggling is implemented in `core/settings/GeneralSection.tsx` and bridged via `core/theme/ColorSchemeBridge.tsx`. The `DynamicStatusBar` reads `useColorScheme()` and picks `light` / `dark` accordingly.
- **Concern:** the global `bg-` / `text-` semantic utilities rely on NativeWind's CSS-interop resolving CSS variables **at compile time**. If a runtime `style={{ backgroundColor: ... }}` uses a raw hex, the opacity modifier doesn't work. The `FloatingActionButton` 553-LOC size and `HubDashboard` 593-LOC size are likely repositories of inline-style / className drift — worth scanning with the design-system lint plugins.

---

## 5. Security & privacy

### 5.1 Auth

- Bearer-token flow: `Authorization: Bearer <token>` from Better Auth `set-auth-token` header, captured by `@better-auth/expo` into `expo-secure-store` (Keychain on iOS, Keystore on Android). No cookies. **Compliant** with the overview.md.
- `e2eAuthMock.ts` is gated by `EXPO_PUBLIC_E2E_REAL_AUTH=1` (inlined by Metro at bundle time → no-op in production). **Compliant** with Hard Rule #20 spirit (no test PATs in production).

### 5.2 Storage encryption

- MMKV is encrypted with a SecureStore-derived 32-byte key. The plaintext instance (`id: "sergeant.mobile.v1"`) is loaded synchronously at module-eval time so bundle-phase helpers don't crash; `bootstrapEncryptedStorage()` swaps in the encrypted instance (`id: "sergeant.mobile.v1.enc"`) before the React tree mounts. **Correct design.**
- The `storage.ts:62-67` comment explicitly forbids auth tokens in MMKV ("Auth tokens and other secrets MUST NOT be written through this module"). The bound `expo-secure-store` adapter is loaded via `@better-auth/expo`. **Compliant** with the convention.

### 5.3 Observability

- PostHog `distinct_id` is **only minted after `bootstrapEncryptedStorage()` resolves**, so the persisted id is on the encrypted instance from the first call. The order in `useEffect` (`initObservability()` → `bootstrapEncryptedStorage()` → `initPostHog()`) is correct.
- Sentry is initialised first and never touches MMKV, so the order doesn't conflict.
- `IdentityBridge` reacts to `useUser` transitions and calls `identifyPostHogUser` / `resetPostHog` with a `lastUserIdRef` guard to avoid re-identifying the same user. **Compliant** with the web `AuthContext` pattern.

### 5.4 Push

- `features/push/PushRegistrar` registers a token with `/api/v1/push/register`. The flow uses `expo-notifications` and stores the token in MMKV (non-sensitive). The `app.config.ts` plugin entry `expo-notifications` is required (validated by `check-build-config.ts`).
- iOS `UIBackgroundModes: [remote-notification]` enables silent push. `UIBackgroundModes` is validated by `check-build-config.ts`.

### 5.5 Voice / camera / media permissions

- All three (`expo-camera`, `expo-image-picker`, `expo-speech-recognition`) declare UA permission strings in `app.config.ts`. The iOS Info.plist doubles them as a safety-net (see `app.config.ts:194-202` comment). Android `RECORD_AUDIO` is declared even though the plugin adds it (also a safety-net).
- `expo-camera` is gated to "only when Nutrition is picked" in `PermissionsStep.tsx` per the AGENTS.md / migration doc. **Compliant** with least-privilege.

### 5.6 Deep links

- `parseSergeantUrl` is the runtime allow-list (`src/lib/deepLinks.ts`). The 5-file host list is documented but **not assertion-tested**. See § 6.5.

---

## 6. Recommendations

Priorities mirror the design-system-audit convention (P0 = must-fix before next release, P1 = should-fix this quarter, P2 = nice-to-have, P3 = informational).

### 6.1 P0 — Lift dual-write adapter to `@sergeant/shared` (DRY)

**Evidence:** `apps/mobile/src/lib/storage.ts:115-143` already exports a working `makeDualWriteKvStore(primary, mirror)` factory. The four `src/modules/{routine,fizruk,nutrition,finyk}/lib/dualWrite/{adapter,index}.ts` files each re-implement the same shape with module-specific import paths.

**Action:** Move `makeDualWriteKvStore` (or a `createDualWriteKVStore({ primary, mirror, mirrorWriteErrorReporter })` variant) to `@sergeant/shared/src/storage/dualWrite.ts`. Update the four module adapters to import the shared factory. Estimated saving: 4 × 50–100 LOC + 4 fewer files to drift apart.

**Owner:** `@Skords-01`. Touches shared → spec via `sergeant-monorepo-boundaries` + `sergeant-server-api` (since the storage contract is shared between web and mobile).

### 6.2 P0 — Extend Hard Rule #18 to `apps/mobile`

**Evidence:** 12 files over 500 LOC. `apps/mobile/AGENTS.md` references the root rule set but does not pin a 600-LOC ceiling for mobile. `FizrukBodyTrendCard` and `FizrukBodyAtlas` are 508 LOC; a 600-LOC rule would not catch them yet, but a 400-LOC ceiling would.

**Action:** Either (a) extend Hard Rule #18 to `apps/mobile` with a 600-LOC cap (matching web/server), or (b) split the 12 large files first and then add the rule. The split is a precondition for any extension because the 12 files are already in the tree.

Concrete splits (estimated):
- `HubDashboard.tsx` 593 → `HubDashboard.tsx` (shell) + 3 panels (`TodayFocusCard`, `WeeklyDigestFooter`, `StatusRow` are already separate; the page-level composition + data hook is the bulk).
- `sqliteReader.ts` 582 → typed `readRows<T>` + per-table readers.
- `HabitForm.tsx` 579 → form sections + validation hook.
- `TransactionsPage.tsx` 560 → list + filters + summary header.
- `Workouts.tsx` 558 → list + workout-card + start-handler.
- `fizrukDualWriteState.ts` 557 → state machine + selectors.
- `FloatingActionButton.tsx` 553 → already a primitive; extract the per-variant sub-components.
- `storage.ts` 550 → `webMirror.ts` (useLocalStorage, createModuleStorage) + `mobileStorage.ts` (two-rung ladder + bootstrap) + `flatHelpers.ts` (safeReadLS, safeWriteLS).
- `BudgetsPage.tsx` 544 → list + budget-card.
- `AddMealSheet.tsx` 519 → sheet + form rows.
- `residualImport.ts` 514 → mapper + import strategy.
- `BodyAtlas.tsx` 508 → region + muscle + interactions.

**Owner:** `@Skords-01`. **Verify:** `pnpm --filter @sergeant/mobile lint` and a new `pnpm --filter @sergeant/mobile check:module-size` (analogous to the web gate).

### 6.3 P1 — Mobile bundle-size + runtime budget

**Evidence:** Root `AGENTS.md` enforces JS/CSS budget and LHCI on `apps/web` only. Mobile has no equivalent.

**Action:** Add a "mobile bundle budget" gate:

- Track EAS build artefact size (Android AAB, iOS IPA) over time in the CI workflow.
- Add a Jest-side startup test: render `RootLayout` in isolation, count components mounted on first paint, assert ≤ N (proxies lazy-loading health).
- For lists, expand `FlashList` adoption: 4 hits vs 157 `ScrollView` usages. The `finyk/Transactions` page is the only one using `FlashList`; `Budgets`, `Workouts`, `Measurements`, `Habits`, `Pantry`, `SavedRecipes` would all benefit.

**Owner:** `@Skords-01` + `sergeant-deploy-and-observability`.

### 6.4 P1 — Add a "DOM-leak" per-package lint rule

**Evidence:** `apps/mobile/AGENTS.md` states "ESLint ловить найочевидніше — але краще перевіряти у feature-cycle." There is no explicit `no-restricted-imports` block forbidding `window` / `document` / `localStorage` from `apps/mobile/src/**` in the per-package config.

**Action:** Add to the per-package ESLint config (root side, since `apps/mobile/eslint.config.js` re-exports):

```js
{
  files: ["apps/mobile/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": ["error", {
      paths: [
        { name: "react-native", importNames: ["Dimensions", "PixelRatio"], message: "Use react-native-safe-area-context or useWindowDimensions." },
      ],
    }],
  },
}
```

(rough sketch; the real list should be reviewed against the existing mobile imports).

**Verify:** `pnpm --filter @sergeant/mobile lint`.

### 6.5 P1 — `pnpm check:deep-link-hosts` script

**Evidence:** 5-file host allow-list (`UNIVERSAL_LINK_HOSTS`) is documented but not assertion-tested.

**Action:** Add `tools/scripts/check-deep-link-hosts.mjs` that reads the array from each of the 5 files, asserts they are equal, and is wired into `pnpm check`.

**Owner:** `@Skords-01`.

### 6.6 P1 — Wire Android Detox CI

**Evidence:** `.github/workflows/detox-ios.yml` exists; no `detox-android.yml`. AGENTS.md and the migration doc say it's a "follow-up." `e2e:test:android` is in `package.json` scripts but only runs locally.

**Action:** Add `.github/workflows/detox-android.yml` mirroring the iOS one, with an AVD setup step. Until then, the Android E2E cannot be gated and `e2e:test:android:ci` is dead.

**Owner:** `@Skords-01` + `sergeant-e2e-testing`.

### 6.7 P1 — Hard-rule check: `EXPO_PUBLIC_EAS_UPDATES_URL` in `check-build-config`

**Evidence:** `check-build-config.ts` validates bundle id, package, `expo-notifications` plugin, and `remote-notification` background mode. It does **not** validate `extra.apiBaseUrl` (used by `apiClient.ts`) nor the `updates.url` field for the `production` EAS profile.

**Action:** Add two assertions:
1. `extra.apiBaseUrl` is set for `production` EAS (fail-fast on misconfigured release).
2. `updates.url` is set when `EAS_PROJECT_ID` is set (OTA updates wiring).

**Owner:** `@Skords-01`. Trivial.

### 6.8 P2 — NativeWind runtime class drift scan

**Evidence:** `FloatingActionButton.tsx` (553 LOC) and `HubDashboard.tsx` (593 LOC) likely contain inline styles that bypass the design-token system. There is no per-package rule preventing `style={{ backgroundColor: "#..." }}` or `className="bg-[#fff]"` (Hard Rule #11 spirit, but mobile-local).

**Action:** Add a `sergeant-design/no-arbitrary-hex-in-classname` rule for `apps/mobile/**` (the rule already exists for web). Run via `pnpm --filter @sergeant/mobile lint` to get a baseline.

**Owner:** `@Skords-01` + `sergeant-web-ui`.

### 6.9 P2 — Test the sync-engine boot-failure path

**Evidence:** `app/_layout.tsx:202` calls `bootSyncEngineWriter({ captureException: captureError })` with a comment "fire-and-forget — the singleton internally .catch-es boot failures." There is no test that proves the catch path works.

**Action:** Add `core/syncEngine/singleton.test.ts` case (file already exists) that stubs the SQLite handle to throw on init and asserts the `captureException` is called with the right `scope`.

**Owner:** `@Skords-01`. Low effort, high signal.

### 6.10 P2 — Side-effect imports: surface the contract

**Evidence:** 4 module-level side-effect imports in `app/_layout.tsx` bind native adapters to shared contracts. Any test that imports `RootLayout` will register these adapters globally.

**Action:** Either (a) extract `registerMobileAdapters()` as a named function and call it once in `app/_layout.tsx`, exposing a "is registered" flag for tests to gate on, or (b) document the side-effect behaviour in `apps/mobile/AGENTS.md` under "Testing".

**Owner:** `@Skords-01`. Trivial.

### 6.11 P3 — `react-native-css-interop` upgrade watch

**Evidence:** NativeWind 4.1.23 depends on `react-native-css-interop` and `react-native-css-interop` pulls in `react-native-worklets/plugin` under Babel. The current `babel.config.js` strips the worklets plugin under Jest to avoid a missing-dependency error. This is fine for tests, but it means **Jest tests do not exercise the same Babel pipeline that production uses.** A future `react-native-worklets` major bump could silently break production builds without breaking tests.

**Action:** Track a `// TODO` (or AI-LEGACY marker) in `babel.config.js` for the worklets plugin workaround. Add a "build smoke" CI step that runs `npx expo export` (web target) and asserts the bundle emits, so Babel changes are caught even if Jest doesn't exercise them.

**Owner:** `@Skords-01`.

### 6.12 P3 — Flaky-test gate utilisation

**Evidence:** AGENTS.md notes the `mobile-flaky-verify.yml` workflow (20-run gate) for the T7 flaky-tech-debt item. No update on whether the suite is currently at 20/20 green.

**Action:** Check `.github/workflows/mobile-flaky-verify.yml` last run, and if it is not 20/20 green, prioritise the tech-debt items blocking it. Otherwise, remove the "flaky" tag from the T7 entry in `sprint-roadmap-q2q3-2026.md`.

**Owner:** `@Skords-01`.

---

## 7. Cross-references

- `apps/mobile/AGENTS.md` (sub-tree quick reference).
- `.agents/skills/sergeant-mobile-expo/SKILL.md` (specialist skill).
- `docs/04-governance/adr/0052-mobile-strategy-capacitor-primary.md` (Capacitor=primary, Expo=parallel; ≥18/22 feature-parity rows before any sunset).
- `docs/02-engineering/mobile/overview.md` (API contract).
- `docs/02-engineering/mobile/react-native-migration.md` (Phases 1–10).
- `docs/02-engineering/mobile/capacitor-deep-links.md` (Universal Links, AASA, DAL).
- `docs/02-engineering/mobile/shell.md` (Capacitor shell, separate from this audit).
- `docs/04-governance/governance/rules/18-module-size-discipline-600.md` (Hard Rule #18 — currently web/server only; see § 6.2 for the mobile extension).
- `docs/04-governance/governance/rules/19-strict-mode-flag-canonical.md` (Hard Rule #19 — `noUncheckedIndexedAccess` already enabled in `apps/mobile/tsconfig.json`).
- `docs/04-governance/governance/rules/20-no-openclaw-pats-in-production.md` (Hard Rule #20 — `e2eAuthMock` is gated by `EXPO_PUBLIC_E2E_REAL_AUTH=1` and inlines to no-op in production).

---

## 8. Out of scope

- `apps/mobile-shell/**` (Capacitor wrapper) — separate surface, separate audit if needed.
- `packages/*-domain` — cross-package shape, audited under their owning surface.
- `docs/02-engineering/mobile/**` (overview / migration / shell / deep-links) — these docs are referenced but not re-audited here.
- Any code change. The bead (`26fc6056`) explicitly says "БЕЗ змін коду."
