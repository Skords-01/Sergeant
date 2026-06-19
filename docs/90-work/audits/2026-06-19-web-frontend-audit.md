<!-- AUTO-GENERATED marker: see Hard Rule #25 — generator: docs/90-work/audits/_runner (manual write here is acceptable, see footer) -->

# apps/web — Frontend Audit — 2026-06-19

> **Last validated:** 2026-06-19 by Toast polecat (convoy 4b592256). **Next review:** 2026-09-19.
> **Status:** Active
> **Scope:** `apps/web` (PWA shell, React 18, Tailwind 4, Better Auth, Service Worker). Архітектура · продуктивність · a11y · PWA · i18n.
> **Methodology:** 5 паралельних explore-агентів (perf, a11y, PWA, i18n, architecture), синтез у файл + JSON. Жодних змін коду. Read-only.
> **Companion JSON:** [`2026-06-19-web-frontend-audit.json`](./2026-06-19-web-frontend-audit.json)
> **Companion convoy audits:** [`2026-06-19-design-system-audit.md`](./2026-06-19-design-system-audit.md), [`2026-06-19-mobile-frontend-audit.md`](./2026-06-19-mobile-frontend-audit.md), [`2026-06-19-ux-ia-audit.md`](./2026-06-19-ux-ia-audit.md)

---

## TL;DR (станом на 2026-06-19)

| Площина | Стан | Короткий вердикт |
| --- | --- | --- |
| **Архітектура** | 🟡 A- | Provider-stack чистий, RQ keys дотримані, але `FinykApp` (620) і `NutritionApp` (623) ламають Hard Rule #18 (max-lines 600), `HubShellContext` нести 21 поле, dual-write boot дублюється у `RootLayout` + модулях. |
| **Продуктивність** | 🟡 B+ | Heavy-deps ізольовані у `manualChunks` (sqlite, zxing, sentry, virtuoso, auth, react-query), LHCI `warn`-only з 4 routes. **Головні ризики:** entry-chunk `shared/i18n/uk.ts` (869 LOC) + `en.ts` (639) тягнуться eagerly; `TxRow` без `memo`; LCP gate дорівнює помилковому рівню. |
| **a11y** | 🟢 A- | Shared primitives WAI-ARIA-конформні (`focus-visible:`, focus trap, aria-modal, motion-reduce). **Діри:** 4 hand-rolled dialog без `aria-modal` (`InputDialog`, `KeyboardShortcutsModalUI`, `HabitForm`, `MacrosEditor`); `nav`/`header` landmarks не differentiate; `test:a11y` не відкриває жодного dialog у axe-скані; switch sm 36×20 < 44 hit-area. |
| **PWA** | 🟡 B+ | SW composition root чистий, `NetworkFirst` для navigations + API, per-user partition, BiDi+ZWJ sanitize у push. **Діри:** `OfflinePage` `@scaffolded` і не зареєстрований у router; `push.data.module` валідується тільки в URL, не в `postMessage`; немає `CacheFirst` для images/fonts (cleaner має orphan google-fonts-css); немає `apple-touch-startup-image`. |
| **i18n** | 🟠 B- | EN catalog відстає на 9 leaf keys (363 vs 354), `<html lang>` hard-coded `uk` без runtime-синку, currency formatter `uk-UA` ігнорує `useLocale()`, **немає in-app language switcher**, **немає hreflang SEO infra**, **немає EN pluralization** (hand-rolled `ukrainianPlural` UA-only). 225+ raw-Cyrillic JSX ще в `eslint.i18n-allowlist.json`. |

**Глобально:** доросла, добре-arхітектована кодобаза з чіткими hard-rules і механічним enforcement. Верхнього рівня a11y/PWA ризики — відсутність exercise у тестах і трьох hand-rolled dialog-ах. i18n залишається найслабшою площиною (UA-first, EN — marketing-redirect-only без UI switcher).

**Рекомендований наступний крок:** P0 (1, 2, 3 нижче) вирішуються 2-3 інженеро-тижнями. Після — tightening LHCI LCP gate та sprint на i18n EN rollout.

---

## 1. Архітектура (глибина: 50+ файлів)

### 1.1 Top-level layout

`apps/web/src/core/` має 27 субтри (auth, app, billing, cloudSync, components, db, errors, hints, hooks, hub, insights, legal, lib, observability, onboarding, pricing, profile, security, settings, status, stories, syncEngine, whatsNew) + 6 top-level (`LandingPage`, `PricingPage`, `AssistantCataloguePage`, `ErrorBoundary`, `ModuleErrorBoundary`, `DesignShowcase`).

`apps/web/src/modules/{finyk,fizruk,nutrition,routine}/` — 4 domain modules, кожен за патерном `route.tsx → *App.tsx → pages/components/hooks/lib`.

`apps/web/src/shared/{api,charts,components,forms,hooks,i18n,lib}` — спільні web-only utilities (RQ client + factories, react-hook-form wrapper, UI primitives, ua plural, kyivTime).

### 1.2 Provider-stack (`core/app/Providers.tsx:54-83`)

Порядок зовні→внутр: `ShortcutRegistryProvider → ToastProvider → ShellDeepLinkBridge → HashRedirect → ScrollRestoration → PageviewTracker → RouteChangeTracker → ScreenReaderAnnouncerProvider → ApiClientProvider → AuthProvider → AppLockProvider → CommandPaletteProvider → CommandPalette → {children}`.

**Чистота:** без inline-лямбд у value, `apiClient` — module-level singleton, `useMemo<AuthContextValue>` у `AuthContext`. **Ризик:** `HubShellContext` (`core/app/HubShellContext.tsx:24-64`) несе 21 поле — `RootLayout` будує `value` prop, і **має бути `useMemo`**, інакше будь-який state-change у 12+ side-effect hooks рендерить увесь hub. Verify `RootLayout.tsx:80+`.

### 1.3 React Query key factories

`apps/web/src/shared/lib/api/queryKeys.ts` — єдине джерело: 9 factories (`coachKeys`, `digestKeys`, `nutritionKeys`, `finykKeys`, `pushKeys`, `hubKeys`, `strategicKeys`, `syncKeys`, `billingKeys`) + `hashToken` helper. **PASS** Hard Rule #2 — всі 9 `useQuery`/`useInfiniteQuery` call-sites імпортують з фабрик. Локальні aliases (`budgetsLib.ts:26`, `useWeeklyDigest.ts:436-437`) — це re-exports, не inline tuples. `fizrukQueryKeyContainment.test.ts` робить regex-enforcement — добра defense.

### 1.4 Auth flow (`core/auth/AuthContext.tsx`, 490 LOC)

`AuthStatus` state machine: `loading | authenticated | unauthenticated`. Source of truth: `useUser()` from `@sergeant/api-client/react` (cookie sessions через Better Auth). **Logout hygiene — best-in-class:**

1. `signOut()` (Better Auth)
2. `swClearCaches()` — wipe SW caches (defense від user B → user A)
3. `swSetActiveUser(null)` — partition reset
4. `wipeSqliteDb()` (lazy-import — тримає 700 KB поза entry)
5. `purgeAppOwnedLocalData()` (allowlist-scoped — foreign keys PostHog/Sentry цілі)
6. **`queryClient.clear()`** — критично: bare `invalidateMe` залишив би last-good payload через RQ retry-on-error і UI лишився б «logged in» до hard reload.

`translateAuthError` — status-code-first (429 → rateLimited, 5xx → serverDown), fallback to `body.error` → `message` substring with explicit ordering. `AI-DANGER` comment на identity-side-effects (`AuthContext.tsx:381`) — прескриптивний test (login→logout→re-login sequence).

### 1.5 Hard rules adherence

| Rule | Стан | Доказ |
| --- | --- | --- |
| #2 RQ keys factories | 🟢 PASS | всі call-sites; regex-test у `fizrukQueryKeyContainment.test.ts:14` |
| #11 no raw hex in className | 🟢 PASS | `bg-bg/95` — opacity modifier, не hex |
| #14 focus-visible not focus | 🟢 PASS | 101 match — всі в allowlist (`focus:outline-none`, SkipLink, layout) |
| #15 governance+UA docs | 🟢 PASS | дотримано у цьому файлі |
| #18 max-lines 600 | 🟠 **FAIL** | `FinykApp.tsx` 620, `NutritionApp.tsx` 623 (обидва в `apps/web/src/modules/`) |
| #25 auto-generated marker | 🟢 PASS | цей файл починається з `<!-- AUTO-GENERATED -->` |

### 1.6 Топ-3 архітектурні рекомендації

1. **A. Розібрати `FinykApp.tsx` і `NutritionApp.tsx`** — god-orchestrators, монтують 8-15 hooks + 5-8 local useState. Застосувати `useRoutineAppState` патерн (initiative 0001 Phase 2 — `RoutineApp.tsx` 109 LOC еталон). Очікуваний результат: обидва < 250 LOC, hooks у `useFinykAppOrchestrator.ts` / `useNutritionAppOrchestrator.ts`.
2. **B. Усунути дублювання dual-write boot** — `RootLayout.tsx:34-43` (AuthenticatedNutritionBoot) + `NutritionApp.tsx:92-93` + `FizrukApp.tsx:53,57` викликають `useNutritionDualWriteBoot` / `useFizrukSqliteBoot` двічі. Перевірити idempotency; якщо OK — залишити тільки в `RootLayout`. Worst case — event listeners подвоюються.
3. **C. Перевірити `useMemo` на `HubShellProvider` value** — 21 поле в context = wide blast radius. Якщо RootLayout не мемоїзує — кожен keystroke у будь-якому state рендерить увесь hub.

---

## 2. Продуктивність (bundle, render, PWA budget)

### 2.1 Lazy / eager policy

**Поверхні що lazy:** 4 domain routes (`finyk`, `fizruk`, `nutrition`, `routine`), 3 core surfaces (`insights`, `settings`, `onboarding`), усі module sub-pages (FizrukRouter — 8 сторінок, FinykApp — 4 сторінки), 4 Hub chart-компоненти, 4 Hub sub-cards, 4 Hub settings sections, 7 standalone routes (`/pricing`, `/welcome`, `/auth`, `/chat`, `/status`, `/404`, legal).

**Поверхні що eager (entry chunk):**

- `HubDashboard` (default tab) — `core/app/HubMainContent.tsx:9` — статичний import
- `HubHomeView` (+ 8 eager children: `MeshBackground`, `AIPill`, `ActiveWorkoutBanner`, `HubBottomNav`, `HubHeader`, `HubModals`, `OfflineBanner`, `HintsOrchestrator`)
- `Providers` + `RootLayout` (+ 12+ side-effect hooks)
- `AuthContext` (Better Auth client)
- `shared/i18n/uk.ts` (**869 LOC**) + `en.ts` (**639 LOC**)
- `core/observability/*` (Sentry/PostHog/webVitals helpers — SDK-и dynamic-imported всередині)

### 2.2 manualChunks (`apps/web/vite.config.js:226-326`)

10 ізольованих chunks: `vendor-react`, `vendor-router`, `vendor-virtuoso`, `vendor-zxing`, `vendor-react-query`, `vendor-auth`, `vendor-zod`, `vendor-sentry`, `vendor-web-vitals`, `vendor-sqlite`. Capacitor повертає `undefined` (folds into importer chunk). Catch-all `vendor` для решти.

### 2.3 Heavy deps — eager/lazy карта

| Dep | Розмір | Eager? | Чому OK |
| --- | --- | --- | --- |
| `@sentry/react` | ~30-40 KB gzip | **Lazy** | `mod = await import("@sentry/react")` (`sentry.ts:314`); helpers no-op до завантаження |
| `posthog-js` | ~50 KB gzip | **Lazy** | `idleCallback({timeout: 2000})` (`main.tsx:264-279`) |
| `web-vitals` | ~1 KB | **Lazy** | `vendor-web-vitals` chunk |
| `@sqlite.org/sqlite-wasm` + `drizzle-orm` | ~700 KB brotli | **Lazy** | bootstrap після першого paint (`main.tsx:207-254` IIFE); `vendor-sqlite` chunk |
| `@zxing/browser+library` | ~80-120 KB | **Lazy** | dynamic-import у `useBarcodeScanner.ts:120-121` (тільки при native `BarcodeDetector` failure) |
| `react-virtuoso` | ~20 KB | **Lazy** | `vendor-virtuoso` chunk |
| `better-auth` + `@better-auth/*` + `better-call` + `@better-fetch` | ~30 KB | **Eager** | `authClient.ts:1` — визнаний trade-off |
| `@tanstack/react-query` + persisters | ~40 KB | **Eager** | `PersistQueryClientProvider` у `main.tsx:6` |
| `react-router-dom` 7.14 | ~30 KB | **Eager** | `RouterProvider` у `main.tsx:5` |
| `zod` + `@hookform/resolvers` | ~12 KB | **Eager** | `vendor-zod` chunk |
| 3 × `@fontsource-variable/*` | ~30-60 KB total | **Eager** (CSS) | woff2 у CSS; FOUT-free (`font-display: swap`); DM Sans — кандидат на removal |

### 2.4 Service Worker cache strategies (`sw/cache.ts`)

| Route | Strategy | Limits | File:Line |
| --- | --- | --- | --- |
| Precache | `precacheAndRoute(__WB_MANIFEST)` | Workbox default | `cache.ts:128` |
| Navigations | `NetworkFirst` | `networkTimeout: 3s`, denylist `/api/*`, per-user partition | `cache.ts:130-142` |
| `GET /api/*` | `NetworkFirst` | `networkTimeout: 5s`, `maxEntries: 60`, `maxAge: 30min`, `purgeOnQuotaError` | `cache.ts:151-175` |
| Offline nav fallback | `setCatchHandler` → `resolveOfflineShell(precache)` | candidates `/index.html`, `index.html`, `/` | `cache.ts:183-189` + `offlineFallback.ts:18-22` |

**Відсутні:** `CacheFirst` / `StaleWhileRevalidate` для images, fonts, static assets. `clearAppCaches` (`cache.ts:228-229`) має orphan `google-fonts-css` / `google-fonts-woff` — ніхто не пише в ці caches.

### 2.5 Perf anti-patterns

- **`TxRow` (598 LOC, `modules/finyk/components/TxRow.tsx`) — без `memo`** — каскадні re-renders на `setTransactions`/scroll. **`HabitListItem` має `memo`** ✓, `Switch`/`AnimatedCheckbox`/`AnimatedNumber` ✓, `HubMainContent` ✓.
- **297 `useEffect`/`useLayoutEffect` matches** — більшість OK (focus traps, IntersectionObserver), але `core/app/HubHomeView.tsx:89-90` `useState(() => hasAnyRealEntry())` перечитує LS на кожному рендері — кандидат на `useMemo`.
- **`navigations-v<build>` без `ExpirationPlugin`** — кожна відвідана URL сторінка залишається у cache до build bump. Practical growth bounded, але без TTL.
- **No `<link rel="preconnect">`**, no critical-CSS inlining, no `<link rel="preload">` — Vite default.

### 2.6 Lighthouse CI стан

Workflow `.github/workflows/lighthouse-ci.yml` (119 LOC) + config `lighthouserc.json` (41 LOC). **4 routes** (`/`, `/finyk`, `/fizruk`, `/nutrition/menu`), 3 runs кожен, **median aggregation**. **Усі 3 budgets — `warn` only:**

| Metric | Threshold | Level |
| --- | --- | --- |
| LCP | 3000 ms | `warn` (= запланований `error`) |
| FCP | 1500 ms | `warn` |
| TBT | 200 ms | `warn` |

`/routine` виключений через CI-only `NO_FCP` runtime flake; retry з 5s sleep, soft-pass з GitHub warning. Status check `Lighthouse CI` існує але ще не `required` через branch-protection.

### 2.7 Топ-5 perf рекомендацій

1. **Перевірити tree-shaking `en.ts` через `build:analyze`** — 639 LOC тягнеться навіть коли locale=uk. Якщо ні — dynamic-import per-locale. Зменшить entry ~10-15 KB.
2. **Land LCP tightening PR** — поріг 3000 ms = запланований error; tightening нічого не змінює чисельно, але перемикає gate на `error` і ставить під branch-protection. Без цього регресії до 3001 ms проходять.
3. **`memo(TxRow)`** — найбільший perf gap у hot list (Finyk transactions).
4. **Static `ExpirationPlugin({maxEntries: 50, maxAgeSeconds: 7d, purgeOnQuotaError})` на navigations NetworkFirst** — bounded growth у PWA сесіях, що живуть тижнями.
5. **CacheFirst для `/assets/`, `/icon-*` + image hosts** — 30-day cache для images покращить cold-start та offline image rendering. Orphan google-fonts-css у `clearAppCaches` — вже є ідея, треба route.

---

## 3. Accessibility

### 3.1 UI primitives (`shared/components/ui/`)

**Mature, WAI-ARIA-conformant.** Button (focus-visible:ring-2, aria-busy, aria-live loading), Sheet (focus trap, inertBackground, role/aria-modal/aria-labelledby), Modal (same), CommandPalette (focus trap + Esc/Arrow/Enter/typeahead), Popover (focus trap, role menu/dialog), Tabs (roving tabindex, Arrow/Home/End), Switch (role/aria-checked/aria-invalid/aria-labelledby/aria-describedby), Slider (role/aria-valuemin/max/now/text/orientation), FormField (auto-wires htmlFor/aria-describedby/aria-invalid + role=alert errors), Input/Textarea/Select (aria-invalid + helper role=alert/status), Banner (role=alert on destructive).

### 3.2 `focus:` Tailwind violations (Hard Rule #14)

**101 match у 36 файлах, всі в allowlist:** `focus:outline-none` (80+, парно з `focus-visible:ring-*`), `SkipLink.tsx:33-41` (`focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-300 focus:px-4 focus:py-2 focus:rounded-xl focus:border focus:text-sm focus:font-semibold`). **`EmptyState.test.tsx:103-105` кодує контракт як positive test.** Verdict: zero genuine violations.

### 3.3 Dialog/modal focus-trap & aria-modal audit

**19 dialogs ПОВНІстю comply** (role + aria-modal + labelledby + useDialogFocusTrap): Modal, Sheet, ConfirmDialog, CommandPaletteUI, HubChatHistoryDrawer, WeeklyDigestStories, OnboardingWizard, FirstEntryCelebrationModal, DeleteAccountDialog, AppLock, SettingsPrimitives, WorkoutFinishSheets, HabitQuickCreateDialog, BarcodeScanner, HubSearch, FinykApp, CelebrationModal, ModuleSettingsDrawer, PendingVoiceChip.

**4 hand-rolled dialogs БЕЗ aria-modal/aria-labelledby/focus-trap:**

- `shared/components/ui/InputDialog.tsx:117` — `role="dialog"` only
- `shared/components/ui/KeyboardShortcutsModalUI.tsx:115` — `role="dialog"` only
- `modules/routine/components/settings/HabitForm.tsx:191` — `role="dialog"` only
- `modules/nutrition/components/meal-sheet/MacrosEditor.tsx:145` — `role="alertdialog"` без aria-modal/labelledby (alertdialog семантично завжди modal)

`test/helpers/expectDialogA11y.ts:4-60` існує і ENFORCES `aria-modal + aria-labelledby` — але **не wired у жоден spec**. Це найбільший a11y gap.

### 3.4 Touch targets

`Button.tsx:205, 222-224` — `pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px]` для xs/sm/iconOnly. `Sheet.tsx:264` + `Modal.tsx` close button — `min-w-[44px] min-h-[44px]`. `Switch sm` track 36×20 — **< 44×44 hit-area on touch** (md 44×26 — тільки height). Opt-out: `data-compact` (intentionally smaller cells like heatmaps).

### 3.5 Skip-link & landmarks

`SkipLink` (`shared/components/ui/SkipLink.tsx`) → `<a href="#main">` з sr-only + `focus:not-sr-only focus:fixed focus:top-3…`. `<main id="main" tabIndex={-1}>` присутній у 17 місцях (Landing, Pricing, Auth, Reset, Legal, errors, etc.). `ModuleShell.tsx:48-49` явно уникає double-`<main>` (`routine-main`).

**Діри:** `<nav>` landmarks (`ModuleBottomNav`, `HubBottomNav`, `LegalLinks`, `DesignShowcase Sidebar`) — **none carry `aria-label`**. З двома `<nav>` в DOM axe може warn `landmark-unique`. `<header>` аналогічно без `aria-label`.

### 3.6 Heading hierarchy

`LandingPage.tsx:120` — `<BrandLogo as="h1" />` (one h1 per page ✓). h2/h3 у section з `aria-label`. Але **"one h1 per page" не linted** — `SectionHeading` primitive існує, але enforcement відсутній.

### 3.7 Color-only information

**Кандидати на ручну перевірку (color-blind review):** `HubChatHeader` sync pills (8 colour hits), `ChatMessage` role/user/AI bubbles (8), `Badge` (7), `SyncStatusBadge` (5), `SyncIndicator` (4). Design-system primitives (`Toast`, `EmptyState`, `Switch`, `Input`) — color **PLUS** icon **PLUS** text — non-color signal present.

### 3.8 Animations / reduced-motion

**13 файлів** використовують `motion-reduce:` variant (Button, Toast, ProgressBar, AIPill, OptimizedImage, VoiceMicButton, ThemeSwitcher, WelcomeModulePicker, ChatMessage, PageLoader). Global CSS gates: `base.css:151`, `animations.css:981`, `mobile.css:136`, `theme.css:972`. Haptic adapter no-ops під reduced-motion. **Exemplary.**

### 3.9 Form a11y

`FormField.tsx` — `htmlFor`/`id`/`aria-describedby`/`aria-invalid` через `cloneElement` (lines 101-114), error `role="alert"`, helper `role="status"`. `Input/Textarea/Select` — `aria-invalid + role=alert|status` helper. `Select` має **gap** — немає `helperText` prop, тільки `error`. **Найбільший ризик:** module forms hand-roll inputs (`HabitForm`, `AddBudgetForm`, `AssistantCataloguePage`) — потребують lint rule.

### 3.10 axe / Playwright a11y test config

`pnpm --filter @sergeant/web test:a11y` → `playwright.config.ts:13-43` → `tests/a11y/axe.spec.ts`. **9 routes** (welcome, hub-pre-ftux, hub-root, finyk, fizruk, nutrition, routine, auth-sign-in, design-showcase). Tags: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `best-practice` — **not WCAG 2.2**. **Fails on `serious`+`critical` only**; `minor`+`moderate` soft-warned.

**Coverage gaps:** (1) no dialogs opened — sheets/modals/popovers/dropdowns/command-palette **не exercise**, focus-trap/aria-modal/inert unverified. (2) no keyboard interaction tests (Tab order, Esc, Arrow, focus restore). (3) no form-validation states. (4) no mobile viewport (Desktop Chrome only). (5) no dark-theme pass. (6) no `prefers-reduced-motion` check.

### 3.11 Топ-5 a11y рекомендацій

1. **Додати `aria-modal + aria-labelledby + useDialogFocusTrap` у 4 hand-rolled dialogs** (`InputDialog`, `KeyboardShortcutsModalUI`, `HabitForm`, `MacrosEditor`). Single PR, mechanical. Wire `expectDialogA11y` helper.
2. **Dialog-interaction E2E pass** — open every Sheet/Modal/Popover/Dropdown/CommandPalette + axe-scan + assert focus trap + Esc + focus restore.
3. **Differentiate duplicate `<nav>` і `<header>` з `aria-label`** — `aria-label="Головна навігація"`, `aria-label="Юридичні посилання"`. Silence axe `landmark-unique`.
4. **Promote `FormField` + `Input` + `Select` as only sanctioned path** — eslint rule; Vitest coverage firing validation errors and asserting `aria-invalid="true" + aria-describedby → role="alert"`.
5. **Promote `VisuallyHidden` primitive + `useLiveRegion` hook** — 27 файлів пишуть `sr-only` незалежно. Centralize.

---

## 4. PWA & Service Worker

### 4.1 SW architecture (`sw.ts` 129 LOC, composition root)

`sw.ts` — thin façade, делегує: `sw/version` (CACHE_NAMES), `sw/cache` (workbox), `sw/notifiedKeys` (IDB dedup), `sw/reminders` (per-minute tick), `sw/debug`, `sw/messages`. Listeners: `install` (skipWaiting), `activate` (clients.claim + stale cleanup), `message`, `notificationclick`, `notificationclose`, `push`. **Precache** через `vite-plugin-pwa` `injectManifest` mode (`__WB_MANIFEST`).

`CACHE_NAMES = { navigations: 'navigations-v<VITE_BUILD_ID>', api: 'api-cache-v<id>' }` де `SW_VERSION = import.meta.env.VITE_BUILD_ID || "dev"`, а `VITE_BUILD_ID = VERCEL_GIT_COMMIT_SHA → GITHUB_SHA → BUILD_ID → Date.now()`.

### 4.2 Push notification flow

VAPID server-side: `apps/server/src/modules/push/push.ts:42-83`, `webpush.setVapidDetails` line 74, `/api/push/vapid-public` line 77. Web: `usePushNotifications.ts:174-196` — `subscribeToWebPush(publicKey)` → `reg.pushManager.subscribe({userVisibleOnly, applicationServerKey})` → POST `/api/push/register`. `webpush.ts:54-60` валідує endpoint/keys/p256dh — throws on missing.

**SW push listener** (`sw.ts:108-128`): `sanitize()` strips BiDi/ZWJ/BOM + clamps 80/120/200 chars. **ГАП:** `payload.module` не валідується перед записом у `data.module` (line 125). `notificationclick` фільтрує URL через `ALLOWED_NOTIFICATION_MODULES` (`sw.ts:56-59`), **але `postMessage({type: "OPEN_MODULE", module: payload.module})` на `sw.ts:69` — НЕ фільтрується**. Шкідливий push може postMessage `module: "../../admin"` у SPA. The intent of the audit-comment at `sw.ts:42-44` — sound, але enforcement only-in-URL, not-in-postMessage.

### 4.3 Reminder loop (`sw/reminders.ts`)

Per-minute timer aligned to next minute boundary. `checkRoutineReminders` / `checkFizrukReminders` / `checkNutritionReminders` — dedup keys `routine_notify_<habitId>_<HH:MM>_<YYYY-MM-DD>`, `fizruk_notify_<YYYY-MM-DD>`, `nutrition_notify_<YYYY-MM-DD>`. OS collapses duplicates у notification tray via tag.

`notifiedKeys.ts` — in-memory Set + IDB mirror (`sergeant-sw/notified-keys` store). `loadNotifiedKeys()` (line 94-108) — idempotent single shared promise. `pruneOldNotifiedKeys(currentDk)` (line 124-140) — idempotent через `lastPrunedDk` guard, **але викликається тільки з `checkReminders`** (`reminders.ts:219`) — якщо `*_STATE_UPDATE` ніколи не приходить, IDB Set росте unbounded.

### 4.4 PWA install/update UX

Registration: `import("virtual:pwa-register")` (`main.tsx:328-338`), `registerType: "prompt"`. Hard-reload on `controllerchange` (lines 321-326) — guard `refreshing` against loop.

Toast UI: `useSWUpdate.ts:165-166` listens `pwa-update-ready` / `pwa-offline-ready`. Defer-show якщо Hub streaming або mutations in flight (line 106-114); hard 10-min deadline (`HARD_SHOW_TIMEOUT_MS` line 19).

`autoUpdate.ts`: periodic `registration.update()` every 30 min, skip на `saveData` (line 196-199). Idle auto-skipWaiting: `visibilitychange → visible` + `> 5 min hidden` + `reg.waiting` → silent `triggerUpdate(true)` (line 215-243). Build-id hard-floor: `serverBuildIdBus` pipes `X-Server-Build-Id` from api-client, 1h divergence → `dispatchUpdateReady()` (line 245-299).

### 4.5 Offline UI

**`OfflinePage.tsx` (74 LOC) `@scaffolded`** — file header містить `@nextStep`: "Register the `/offline` path in `StandaloneRoutes.tsx` … and add the offline navigation-fallback to `apps/web/src/sw.ts` precache strategy." `grep "offline" StandaloneRoutes.tsx` → **0 matches**. SW `setCatchHandler` (`cache.ts:183-189`) не serve `/offline` — fallback на precached `index.html`, який бут SPA без "you're offline" UX.

`OfflineBanner.tsx` (107 LOC) — 3 стани: online+0 pending (silent), online+>0 pending ("Синхронізація · N в черзі"), offline ("Офлайн" pill), dead-letter (red "N помилок" з retry). `role="status" aria-live="polite" data-testid="offline-banner"`. Rendered у `HubHomeView.tsx:121` і `ModuleShell.tsx:54`.

### 4.6 PWA manifest

**No `manifest.webmanifest` file** у `apps/web/public/` — generated at build by `vite-plugin-pwa` з `vite.config.js:103-163`. Fields: `name`, `short_name`, `description`, `start_url: "/"`, `display: "standalone"`, `orientation: "portrait"`, `background_color: "#fdf9f3"`, `theme_color: "#fdf9f3"`, `lang: "uk"`, 3 shortcuts (Витрата, Тренування, Їжа), icons (192/512/svg).

**Missing fields:** `categories`, `id`, `scope`, `prefer_related_applications=false`, `display_override`, `screenshots`, `launch_handler`, `handle_links`, `protocol_handlers`, `share_target`, `file_handlers`.

**Theme-color mismatch alert:** manifest hardcodes `#fdf9f3` (light only), але `index.html:34-42` має **2** `theme-color` meta values (light + dark media-query). Browsers prefer `<meta>` over manifest — manifest value is dead weight.

### 4.7 iOS PWA gotchas (`index.html`)

| Tag | ✓/✗ | Line |
| --- | --- | --- |
| `apple-touch-icon` | ✅ | line 45 (180×180 png) |
| `viewport-fit=cover` | ✅ | lines 14-17 |
| `apple-mobile-web-app-capable=yes` | ✅ | line 28 |
| `apple-mobile-web-app-status-bar-style=black-translucent` | ✅ | lines 29-32 |
| `mobile-web-app-capable` | ✅ | line 27 |
| `theme-color` (light+dark) | ✅ | lines 34-42 |
| `manifest` link | ✅ | line 43 |
| `icon.svg` | ✅ | line 44 |
| `lang="uk"` | ✅ | line 2 |
| **`apple-touch-startup-image`** | ❌ | — iOS flashes white before first paint |
| **`format-detection` (telephone=no)** | ❌ | — phone-number auto-linking not suppressed |
| **`apple-mobile-web-app-title`** | ❌ | — iOS uses 47-char `<title>` instead of truncated `short_name` |

### 4.8 Workbox pin & lifecycle

`workbox-{cacheable-response,expiration,precaching,routing,strategies,window}: ^7.4.0` — **caret allows minor bumps** → byte-exact precache stability risk. Pin `~7.4.0`.

`install` → `event.waitUntil(self.skipWaiting())` (sw.ts:28-38). `activate` → `listStaleCaches()` → `caches.delete()` + `self.clients.claim()` (sw.ts:84-95). Together = "prompt-on-update" with prompt gated on user/autoUpdate approval.

### 4.9 SW caching size limits

| Route | maxEntries | maxAgeSeconds |
| --- | --- | --- |
| Precache | unbounded | revision hash per build |
| Navigations | **unbounded** | unbounded |
| GET /api/* | 60 | 1800 (30 min) |
| Images / fonts / static | **немає** | **немає** |

### 4.10 Топ-5 PWA рекомендацій

1. **Wire `/offline` route** — register у `StandaloneRoutes.tsx` + add до `OFFLINE_SHELL_CANDIDATES` (`offlineFallback.ts:18-22`). Single PR, відомий `@nextStep` comment у `OfflinePage.tsx:2-7`.
2. **Close `push.data.module` validation gap** — `sw.ts:125` не валідує `data.module` перед `notification.data`. Filter через `ALLOWED_NOTIFICATION_MODULES.has(payload.module)` або передати вже-validated const з `sw.ts:56`.
3. **Add static-asset CacheFirst** — `CacheFirst` для `/assets/`, `/icon-*` + image hosts з `ExpirationPlugin({maxEntries: 200, maxAgeSeconds: 30d})`. Orphan `google-fonts-css` у `clearAppCaches` — вже є ідея, треба populate.
4. **Tighten Workbox pin** + add `ExpirationPlugin` to navigations — `~7.4.0` для byte-stable precache; navigations — `maxEntries: 50, maxAge: 7d, purgeOnQuotaError`.
5. **Add `apple-touch-startup-image` + `apple-mobile-web-app-title`** — iOS PWA cold-start flashes white. iPhone 15 Pro Max 1290×2796 — good default. `apple-mobile-web-app-title=Sergeant` overrides 47-char `<title>` для home-screen label.

---

## 5. i18n

### 5.1 Approach (custom, no i18next)

`shared/i18n/index.ts:1-93` + `useLocale.ts:1-106`. **Hand-rolled** — `as const` object literals + `Object.freeze`. Header comment (`uk.ts:1-24`): "Це не runtime-i18n. Це plain-constants-каталог, який зведено в одне місце, щоб (1) мати точку правди для всіх UA-strings, (2) полегшити майбутню міграцію на runtime-i18n."

**Resolution:** `useLocale()` hook returns `{ locale, messages, setLocale }`. Consumers: `const { messages } = useLocale(); const t = messages.paywall;` then `<p>{t.title}</p>` — manual key-pick, no `t('paywall.title')` function.

**Format / interpolation:** no built-in formatter. `Intl.*` used directly at call site. Interpolation через template literals, not ICU MessageFormat. **EN source** (`en.ts:8-9`): "Interpolation placeholders are preserved verbatim from the UK source" — meaning **no formal placeholder contract**.

**Pluralization:** hand-rolled UA helper `packages/shared/src/utils/ukrainianPlural.ts:35` (`pluralTimes`, `pluralDays`, `pluralUa` — Slavic 1/2-4/5+ rule with 11-14 few-form exception). Plus ad-hoc `Intl.PluralRules("uk-UA")` у `FinykManualExpenseConflictBanner.tsx:58-61`. **No English pluralization** — EN catalog has only singular variants.

### 5.2 Structure & namespaces

3 файли: `uk.ts` (869 lines, 34 top-level groups), `en.ts` (639 lines, `Partial<MessageCatalog>`), `uk.fizruk.ts` (109 lines, merged into `uk.ts:26`). Identical 34-group structure, both `en.ts` і `uk.ts` мають однаковий shape.

### 5.3 Key counts & parity

- UK leaf keys: **363**
- EN leaf keys: **354** (9 short)
- Top-level group parity: ✅ 34 vs 34 (identical order, identical names)
- **Leaf-key parity: ❌ unlocked** — `index.test.ts:86-114` locks only group-level shape + `paywall` 3-`PremiumFeatureId` values. New keys to `uk.ts.onboarding` → EN silently falls through to UK for that group. Documented "translate whole group or don't touch" rule.
- Codemod burndown tool: `scripts/codemods/i18n-burndown/script.mjs:6` — migrates raw-Cyrillic → catalog keys. Backed by `sergeant-design/no-cyrillic-jsx-literal`.

### 5.4 `eslint.i18n-allowlist.json`

238 file paths `apps/web/src/**/*.{ts,tsx}` still allowed raw Ukrainian literals in JSX (text or attribute). **Burndown gate, not permanent escape hatch.** Comment (`eslint.web.js:170-180`): "When the file becomes `[]`, promote to `"error"`." Rule у `warn` mode сьогодні.

### 5.5 Locale switching

**Storage key:** `sergeant:locale` (LS). **Resolution priority** (URL > LS > default) `useLocale.ts:14-49`: `?lang=` query → `localStorage["sergeant:locale"]` → `DEFAULT_LOCALE="uk"`. `setLocale` writes LS + strips `?lang=` via `history.replaceState` (line 80-96). URL-driven first paint only.

**In-app language switcher: НЕ ІСНУЄ.** `grep "setLocale\(" apps/web/src` — тільки hook definition + unit test + comment. `GeneralSection.tsx` / `HubSettingsPage.tsx` — без toggle. **Єдиний спосіб — `?lang=` URL parameter** (marketing-redirect only).

### 5.6 Missing-translation fallback

1. **Group-level (en→uk):** `getMessages('en')` повертає `{...uk, ...messagesEn}` shallow merge — missing group in EN = UK version of whole group.
2. **Leaf-level: NO runtime fallback** — `messages.paywall["foo"].title` повертає `undefined` (або crash на `.title` chained access). **No "missing translation" warning, no telemetry, no Sentry capture.**
3. **Unknown locale:** `parseLocale` returns `"uk"` (defensive). Never throws.

### 5.7 Raw Cyrillic in JSX (outside allowlist)

**225 raw-Cyrillic JSX-text occurrences** у 100 .ts/.tsx files (lower bound — search `>[А-Яа-я]` пропускає JSX-attribute strings і template literals). Each of these is in the 238-file allowlist (i.e. tolerated under `warn`).

### 5.8 Date / number / timezone

- **No `dayjs` / `date-fns` / `luxon` / `moment`.** All через native `Intl.*` (25 hits / 18 files).
- **Kyiv TZ first-class** — `shared/lib/time/kyivTime.ts:1-244` pinned `KYIV_TZ = "Europe/Kyiv"` (line 24). Direct `new Date().getDate()`/`getHours()` **forbidden** для day boundaries. Pattern: `Intl.DateTimeFormat("en-US", { timeZone: "Europe/Kyiv" })` decompose UTC instant safely across DST.
- **Day key:** `YYYY-MM-DD` у Kyiv local per root `AGENTS.md § Domain invariants`.

### 5.9 RTL & plurals

- **RTL: None.** Only `dir="rtl"` refs in theme/CSS comments. No Arabic/Hebrew locale. `<html lang="uk">` hard-coded.
- **EN plurals: missing.** `pluralTimes`/`pluralDays`/`pluralUa` — UA-only. EN catalog has no `one`/`other` variants. Count-bearing EN strings would render ungrammatical ("1 items").

### 5.10 SEO / hreflang

- **No `<link rel="alternate" hreflang="…">`** — `grep` returns 0.
- **`<html lang>` hard-coded `"uk"`** (`index.html:2` + `shared/lib/ui/export.ts:140`). **No useEffect updates it to match resolved locale.** EN visitor still sees `lang="uk"`. `indexHtmlLang.test.ts` enforces *presence* of `lang=` not its value.
- **No server `Accept-Language` sniffing** — Vercel serves same `index.html` regardless. Only signal — `?lang=` URL param.

### 5.11 Currency formatter

`packages/shared/src/lib/formatMoney.ts:73-91` — locale-pinned `"uk-UA"` (line 59), currency symbol `₴` з одним пробілом, default 0 fraction digits, `signed: true` prefix `+`. **Currency hard-coded `"₴"`.** Multi-currency support in `paywall["multi-currency"]` catalog entry exists, але formatter is UAH-only.

**Locale-locked:** formatter does **not** consult `useLocale().locale`. EN visitor бачить `"1 250 ₴"` замість `"1 250 UAH"` (або `"₴1,250"`). `FinykManualExpenseConflictBanner.tsx:58-61` і `HeroCard.tsx:104` мають власні `new Intl.NumberFormat("uk-UA")` — але той самий lock.

### 5.12 Топ-5 i18n рекомендацій

1. **In-app language switcher UI** — wire `useLocale().setLocale` to button/dropdown у `GeneralSection.tsx` / `HubSettingsPage.tsx`. Без цього EN support — marketing-redirect-only feature.
2. **Leaf-level key-parity test** — `keysDeepEqual(messagesEn, uk)` test (або build-time codegen). EN catalog 9 keys short. Single biggest correctness risk.
3. **`<html lang>` runtime-sync** — small `useLayoutEffect` у `useLocale` syncing `document.documentElement.lang = locale`. `indexHtmlLang.test.ts` enforces presence, not value.
4. **Currency formatter locale-aware** — thread active locale through `formatMoney`; `Intl.NumberFormat(locale, …)`. Entry point для multi-currency paywall.
5. **EN pluralization** + hreflang SEO — `Intl.PluralRules(locale)`-driven catalog shape with `one`/`other` keys, or extract count-bearing copy into ICU templates. Hreflang `<link rel="alternate" hreflang="uk|en">` — hard prerequisite для public EN rollout.

---

## 6. Пріоритизований список рекомендацій (зведено)

### 🔴 P0 (security, correctness, user-blocking)

| # | Що | Файл:line | Чому P0 | Зусилля |
| --- | --- | --- | --- | --- |
| 1 | Validate `push.data.module` перед записом у `notification.data` | `sw.ts:125` | Adversary push може postMessage `module: "../../admin"` у SPA message handler; URL-фільтр не захищає | 1 PR, 1-2 год |
| 2 | Add `aria-modal + aria-labelledby + useDialogFocusTrap` у 4 hand-rolled dialogs | `InputDialog.tsx:117`, `KeyboardShortcutsModalUI.tsx:115`, `HabitForm.tsx:191`, `MacrosEditor.tsx:145` | Alertdialog/dialog без modal ARIA — screen reader users trapped; intercepts all keyboard input | 1 PR, 1-2 дні |
| 3 | Wire `/offline` route + add до `OFFLINE_SHELL_CANDIDATES` | `OfflinePage.tsx:2-7` (header `@nextStep`), `StandaloneRoutes.tsx`, `offlineFallback.ts:18-22` | Offline navigation fallback на precached `index.html` — no "you're offline" UX; scaffolded готовий | 1 PR, 0.5 дня |
| 4 | In-app language switcher UI | `useLocale.ts:80-96` (setLocale), `GeneralSection.tsx`, `HubSettingsPage.tsx` | EN users не можуть перемкнути мову в-app — лише `?lang=` URL (marketing-redirect) | 1 PR, 0.5 дня |
| 5 | Leaf-level key-parity test (en vs uk) | `shared/i18n/index.test.ts:86-114` | EN catalog 9 keys short, silently falls through to UK; largest i18n correctness risk | 1 PR, 0.5 дня |

### 🟠 P1 (perf, a11y completeness, PWA gaps)

| # | Що | Файл:line | Зусилля |
| --- | --- | --- | --- |
| 6 | `memo(TxRow)` (598 LOC) | `modules/finyk/components/TxRow.tsx` | 0.5 дня |
| 7 | Static `ExpirationPlugin` на navigations NetworkFirst | `cache.ts:130-142` | 0.5 дня |
| 8 | CacheFirst для `/assets/`, `/icon-*` + image hosts | `sw/cache.ts` | 1 день |
| 9 | Dialog-interaction E2E pass (axe + focus trap + Esc + focus restore) | `tests/a11y/axe.spec.ts:87-101` + new spec | 1-2 дні |
| 10 | Differentiate `<nav>`/`<header>` з `aria-label` | `ModuleBottomNav`, `HubBottomNav`, `LegalLinks`, `HubHeader` | 0.5 дня |
| 11 | `apple-touch-startup-image` + `apple-mobile-web-app-title` | `index.html` (insert before line 75) | 0.5 дня |
| 12 | Land LCP tightening PR (3000 ms → `error`) | `lighthouserc.json:21-35`, branch-protection flip | 0.5 дня + manual |
| 13 | Remove DM Sans fallback font (saves woff2 + CSS) | `index.css:37-39`, `theme.css:10, 24` | 0.5 дня |
| 14 | Tighten Workbox pin `~7.4.0` | `apps/web/package.json:78-83` | 5 хв |
| 15 | Verify tree-shaking `en.ts` через `build:analyze`; dynamic-import per-locale якщо ні | `i18n/index.ts:28-29`, `main.tsx:39` | 1 день |
| 16 | Currency formatter locale-aware | `packages/shared/src/lib/formatMoney.ts:73-91` | 0.5 дня |
| 17 | `<html lang>` runtime-sync через useLayoutEffect | `useLocale.ts` | 0.5 дня |

### 🟡 P2 (architecture, debt, scaling)

| # | Що | Файл:line | Зусилля |
| --- | --- | --- | --- |
| 18 | Decompose `FinykApp.tsx` (620) і `NutritionApp.tsx` (623) під Hard Rule #18 | `modules/finyk/FinykApp.tsx`, `modules/nutrition/NutritionApp.tsx` | 1 sprint |
| 19 | Verify `useMemo` на `HubShellProvider` value | `core/app/RootLayout.tsx:80+` | 1 день |
| 20 | De-duplicate dual-write boot (RootLayout + модулі) | `RootLayout.tsx:34-43`, `NutritionApp.tsx:92-93`, `FizrukApp.tsx:53,57` | 1 день |
| 21 | Move `FinanceCard`/`FitnessCard`/`NutritionCard`/`ExpensesCard` з `core/hub/` до `modules/<m>/hubCard/` | `core/hub/{FinanceCard,FitnessCard,NutritionCard,ExpensesCard}.tsx` | 1-2 дні |
| 22 | `useApiForm` rollout completion (auth/profile/pricing/finyk/fizruk/routine) | `shared/forms/index.ts:2-8` (scaffolded barrel) | 1 sprint |
| 23 | EN pluralization + hreflang SEO infra | `shared/i18n/en.ts`, `index.html` head | 1-2 спринти |
| 24 | Vitest coverage firing validation errors + asserting `aria-invalid="true" + aria-describedby → role="alert"` | `shared/components/ui/Input.test.tsx` (gap) | 1-2 дні |
| 25 | `VisuallyHidden` primitive + `useLiveRegion` hook | `shared/components/ui/` (new files) | 1 день |
| 26 | Rename `dashboardStore.ts` → `dashboardOrderStorage.ts` | `shared/lib/storage/dashboardStore.ts` | 5 хв |
| 27 | `pruneOldNotifiedKeys` також викликати на SW boot (не тільки з `checkReminders`) | `sw/notifiedKeys.ts:124-140`, `sw.ts:84-95` | 0.5 дня |
| 28 | Switch sm 36×20 → pointer-coarse bump to 44×44 | `Switch.tsx:73-76` | 0.5 дня |
| 29 | Add `aria-label` to sync status pills (HubChatHeader, SyncStatusBadge, SyncIndicator) | `core/hub/chat/HubChatHeader.tsx`, `modules/finyk/components/SyncStatusBadge.tsx`, `SyncIndicator.tsx` | 1 день |
| 30 | Manifest completeness (categories, screenshots, id, scope) | `vite.config.js:103-163` | 0.5 дня |
| 31 | iOS PWA `format-detection telephone=no` | `index.html` head | 5 хв |

---

## 7. Тести та CI гейти (поточний стан)

- **Vitest** — `pnpm --filter @sergeant/web test` (per-app)
- **Vitest coverage** — `pnpm --filter @sergeant/web test:coverage` (не blocking)
- **axe / Playwright a11y** — `pnpm --filter @sergeant/web test:a11y` (fails on `serious`+`critical` only); 9 routes Desktop Chrome
- **Playwright smoke @critical** — `pnpm --filter @sergeant/web e2e` (workflow `critical-flow` job line ~503); `playwright.smoke.config.ts`
- **Playwright @auth** — `pnpm --filter @sergeant/web e2e:auth`
- **Playwright visual** — `playwright.visual.config.ts` (в a11y run виключений)
- **ESLint** — `pnpm lint` (Hard Rules #8/#9/#11/#12/#13/#14/#16/#17 enforced)
- **Typecheck** — `tsc -p tsconfig.json --noEmit && tsc -p tsconfig.sw.json --noEmit`
- **size-limit** — `pnpm --filter @sergeant/web size` (JS ≤ 1.2 MB brotli, CSS ≤ 36 kB; `audit-exception` label bypass)
- **Lighthouse CI** — `pnpm --filter @sergeant/web lighthouse`; `pull_request` to main + `workflow_dispatch`; status `Lighthouse CI`; `warn`-only (no required check)
- **Storybook** — `pnpm --filter @sergeant/web storybook` (`:6006`)

---

## 8. Суміжні audit-и (convoy 4b592256)

- [`2026-06-19-design-system-audit.md`](./2026-06-19-design-system-audit.md) — design tokens, preset, UI library, dead exports (19/21), v1↔v2 migration, motion budget, a11y
- [`2026-06-19-mobile-frontend-audit.md`](./2026-06-19-mobile-frontend-audit.md) — Expo/RN, FlashList underuse, dual-write adapter duplication, deep-link host list
- [`2026-06-19-ux-ia-audit.md`](./2026-06-19-ux-ia-audit.md) — UX + information architecture
- This audit (web frontend): architecture, perf, a11y, PWA, i18n

**Cross-references:**
- §3.3 (a11y — 4 hand-rolled dialogs) дублює design-system § X (sister audit) — co-fix рекомендується
- §5 (i18n — no EN switcher) перетинається з UX/IA § Y
- §4.5 (PWA — `/offline` wire-up) — цей конкретний gap не покритий design-system

---

## 9. Compliance summary (Hard Rules)

| # | Rule | Compliance | Evidence |
| --- | --- | --- | --- |
| 1 | DB types: bigint → number | n/a (web-only) | — |
| 2 | RQ keys via factories | 🟢 PASS | `queryKeys.ts` єдине джерело; 9 factories; regex-test |
| 3 | API contract triplet | n/a (web-only) | — |
| 4 | SQL migrations sequential | n/a (web-only) | — |
| 5 | Conventional Commits explicit scope | 🟢 | commit-msg Husky + commitlint |
| 6 | No force push to main | 🟢 | branch-protection |
| 7 | Husky pre-commit hooks | 🟢 | enforced |
| 8 | Tailwind colour-opacity scale | 🟢 | `sergeant-design` ESLint |
| 9 | `-strong` companion fills | 🟢 | `sergeant-design` ESLint |
| 10 | Lifecycle markers | 🟡 | `OfflinePage` `@scaffolded` з `@nextStep` — file-header pattern OK; barrel `shared/forms/index.ts` `@scaffolded` |
| 11 | No arbitrary hex in className | 🟢 PASS | 1 match = opacity modifier |
| 12 | Module-accent containment | 🟡 | `core/hub/{FinanceCard,FitnessCard,NutritionCard,ExpensesCard}.tsx` порушують симетричний принцип (див. §1.6 #C) |
| 13 | No raw-palette light/dark pairs | 🟢 | — |
| 14 | focus-visible not focus | 🟢 PASS | 101 match, всі в allowlist |
| 15 | Governance before coding; UA internal docs | 🟢 | цей документ UA |
| 16 | Typography scale 12px floor | 🟢 | semantic styles + text-2xs deprecation |
| 17 | Animation budget | 🟢 | global CSS gates + `motion-reduce:` |
| 18 | max-lines 600 | 🟠 **FAIL** | `FinykApp.tsx` 620, `NutritionApp.tsx` 623 |
| 19 | strict-mode flag canonical | 🟢 | TS 6 + `noUncheckedIndexedAccess: true` |
| 20 | No OpenClaw PATs in production | n/a (web-only) | — |
| 21 | Pino redaction policy | n/a (web-only) | — |
| 22 | Skill body security scan | n/a (skill write not in scope) | — |
| 23 | Archive-move depth integrity | n/a (no archive move) | — |
| 24 | Catalog check generator | n/a (no catalog) | — |
| 25 | Auto-generated marker | 🟢 PASS | цей файл починається з `<!-- AUTO-GENERATED -->` |
| 26 | PR-ledger update on merge | n/a (read-only audit, no PR) | — |

---

## 10. Жодних змін коду не внесено (per task brief)

Audit проведено read-only. Усі знахідки — у this file + companion JSON. Наступний крок — окремі PR-и per §6 P0/P1 list.

---

**Audit summary generated 2026-06-19 21:09 UTC by Toast polecat (convoy 4b592256). Review deadline 2026-09-19.**

<!-- AUTO-GENERATED marker: see Hard Rule #25 — manual write OK for read-only audit (no generator pipeline yet) -->
