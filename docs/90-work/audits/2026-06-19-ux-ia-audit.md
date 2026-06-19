# UX-аудит та Information Architecture (2026-06-19)

> **Last validated:** 2026-06-19 by @shadow-polecat-9de6c57e. **Next review:** 2026-09-17.
> **Status:** Active

> **Cross-refs:**
> [`2026-05-06-ux-roast-pr-plan.md`](./2026-05-06-ux-roast-pr-plan.md) — попередній UX execution tracker (21/41 PR-ів змерджено, 20 outstanding) ·
> [`2026-05-13-consolidated-page-audit.md`](./2026-05-13-consolidated-page-audit.md) — зведений page-audit з 255 знахідками (burn-down активний) ·
> [`2026-05-13-page-audit-02-hub-dashboard.md`](./archive/2026-05-13-page-audit-02-hub-dashboard.md) — hub dashboard specifics (F1 raw-key, F7 bento, F23 storage) ·
> [`2026-06-08-codebase-cleanup-audit.md`](./2026-06-08-codebase-cleanup-audit.md) — 4 founder-decisions, dead-code / tombstones ·
> [`2026-06-11-fable5-independent-audit.md`](./2026-06-11-fable5-independent-audit.md) — 10-вимірний незалежний аудит (ws-10/12/13 P1 outstanding) ·
> [`2026-05-06-ux-roast.md`](./archive/2026-05-06-ux-roast.md) — джерельна UX-прожарка (39 знахідок post-onboarding) ·
> [`docs/05-design/design/design-system.md`](../../05-design/design/design-system.md) — канон дизайн-системи ·
> [`docs/05-design/design/unified-bottom-nav.md`](../../05-design/design/unified-bottom-nav.md) — bottom-nav патерн ·
> [`docs/05-design/design/empty-states.md`](../../05-design/design/empty-states.md) — empty-state tier-и ·
> [`docs/05-design/design/module-accent.md`](../../05-design/design/module-accent.md) — модуль-акценти ·
> [`apps/web/src/core/app/StandaloneRoutes.tsx`](../../../apps/web/src/core/app/StandaloneRoutes.tsx) — канон standalone surface-ів ·
> [`apps/web/src/core/app/router.tsx`](../../../apps/web/src/core/app/router.tsx) — Phase-2 path-based router (initiative 0006).

**Мета:** комплексний зріз UX-зрілості та Information Architecture продукту Sergeant станом на 2026-06-19. Покриває hub shell, 4 модулі (Фінік / Фізрук / Харчування / Рутина), HubSettings (12 секцій у 3 групах), standalone surface-и (auth, chat, assistant, status, legal, pricing), bottom-nav патерни, deep-link / hash-redirect стан, findability / search, onboarding cold-start path, та tone-of-voice.

**Не входить:** code-level performance (→ LHCI gates), visual design (→ design-system), безпека (→ security-audit), backend API contract (→ server-api), mobile-релізи (→ mobile-audit). Цей аудит читає IA, не виправляє.

> **Update 2026-06-19 (this audit):** Скоупить серію попередніх page-audit-ів у єдиний IA-зріз. 23 P0-P3 знахідки, з них **7 P0** (дві критичні IA-проблеми + п'ять UX-блокерів), **9 P1**, **7 P2**. Cross-cutting перевірено на 2026-06-19 — рівно ті самі path-контракти, що й у Phase-2 router, без drift.

---

## 📋 Зміст

1. [Методологія та scope](#методологія-та-scope)
2. [Information Architecture map](#information-architecture-map)
3. [Hub shell (Головна / Звіти / Профіль / Налаштування)](#hub-shell)
4. [Module IA — Фінік / Фізрук / Харчування / Рутина](#module-ia)
5. [Standalone surfaces](#standalone-surfaces)
6. [Settings IA — 3 групи × 12 секцій](#settings-ia)
7. [Navigation patterns & deep-link контракт](#navigation-patterns--deep-link-контракт)
8. [Findability & search](#findability--search)
9. [Onboarding cold-start path](#onboarding-cold-start-path)
10. [Tone of voice & copy consistency](#tone-of-voice--copy-consistency)
11. [Accessibility — IA-зріз](#accessibility--ia-зріз)
12. [P0 / P1 / P2 знахідки](#p0--p1--p2-знахідки)
13. [Рекомендації — пріоритезована дорожня карта](#рекомендації--пріоритезована-дорожня-карта)
14. [Додатки](#додатки)

---

## Методологія та scope

**Підхід:** static-читання коду + cross-ref із попередніми аудитами. Прочитано **47 файлів** у `apps/web/src/core/app/`, `apps/web/src/core/hub/`, `apps/web/src/modules/{finyk,fizruk,nutrition,routine}/`, `apps/web/src/shared/i18n/` + `docs/05-design/*`. Перевірено контракти: router → standalone-routes → module-routers → bottom-nav → settings-page.

**Метрика знахідок:** кожна проблема отримує P0/P1/P2/P3 + score `{critical | high | medium | low}` + owner (per `apps/web/AGENTS.md`).

| Tier    | Score      | Критерій                                                                 |
| ------- | ---------- | ------------------------------------------------------------------------ |
| **P0**  | critical   | Юзер не може виконати ключову дію, або IA порушує hard-rule              |
| **P1**  | high       | Юзер витрачає ≥ 1 зайвий крок; або суттєва UX-проблема                    |
| **P2**  | medium     | Polish; невеликий додатковий крок; або copy-issue                         |
| **P3**  | low        | Nice-to-have; cosmetic                                                   |

**Кількісні лічильники (стан на 2026-06-19):**

| Поверхня                | Top-level pages | Sub-tabs | Standalone |
| ----------------------- | --------------- | -------- | ---------- |
| Hub shell               | 4 (Головна / Звіти / Профіль / Налаштування) | — | — |
| Фінік                   | 5 (Огляд / Операції / Планування / Аналітика / Активи) | 0 | — |
| Фізрук                  | 8 (Дашборд / Atlas / Workouts / Progress / Measurements / Programs / Body / Exercise) | 0 | — |
| Харчування              | 4 (Start / Pantry / Log / Menu) | 4 (`pantry/{items,shopping}`, `menu/{plan,recipes}`) | — |
| Рутина                  | 2 (Calendar / Stats) | 0 | — |
| HubSettings (групи)     | 3 (Загальні / Розділи / Додатково) | 12 секцій | — |
| Standalone              | — | — | 11 paths (`/`, `/sign-in`, `/login`, `/signin`, `/auth`, `/reset-password`, `/profile`, `/design`, `/pricing`, `/legal/{privacy,terms,cookies,offer}`, `/status`, `/assistant`, `/chat`, `/welcome`) |
| Module-totals           | **19 top-level pages** | 4 sub-tabs | **11 standalone** |

---

## Information Architecture map

> Top-level URL inventory з path-based phase-2 router (`apps/web/src/core/app/router.tsx`).

```
/                          Hub home (Головна)         [path-based or landing depending on auth/onboarding state]
/finyk                     Фінік (FinykApp)
  /finyk/overview            Огляд
  /finyk/transactions        Операції
  /finyk/budgets             Планування  (legacy /payments → тут)
  /finyk/analytics           Аналітика
  /finyk/assets              Активи
/fizruk                    Фізрук (FizrukApp)
  /fizruk/dashboard          Дашборд
  /fizruk/atlas              Atlas
  /fizruk/workouts           Тренування
  /fizruk/progress           Прогрес
  /fizruk/measurements       Заміри
  /fizruk/programs           Програми
  /fizruk/body               Тіло
  /fizruk/exercise           Вправа  (detail)
/nutrition                 Харчування (NutritionApp)
  /nutrition/start            Start (default; legacy /products → /pantry, /plan + /recipes → /menu, /shop → /pantry)
  /nutrition/pantry           Комора
    /nutrition/pantry/items     Items
    /nutrition/pantry/shopping  Shopping
  /nutrition/log              Щоденник
  /nutrition/menu             Меню
    /nutrition/menu/plan        Plan
    /nutrition/menu/recipes     Recipes
/routine                   Рутина (RoutineApp)
  /routine/calendar           Календар (default)
  /routine/stats              Статистика
/insights                  Звіти (HubReports; legacy `/?tab=reports` redirect)
/settings                  Налаштування (HubSettingsPage)
  /settings?group=general     Загальні   (Дашборд, Загальні, Підписка, Нагадування, AI-дайджести, Асистент)
  /settings?group=modules     Розділи    (Рутина, Фізрук, Фінік, Харчування)
  /settings?group=advanced    Додатково  (Конфіденційність, PWA, Експорт, Експериментальні)
/onboarding                Welcome (cold-start surface; legacy landing-path)

# Standalone
/                          landing page (anon, fresh, no data)         [per StandaloneRoutes render guard]
/sign-in                   Auth (Better Auth)
  /login, /signin, /auth    → 301 → /sign-in
/reset-password            Magic-link landing
/profile                   → 301 → /?tab=profile (legacy deep-link)
/design                    Internal styleguide (DEV-only; → 404 у production)
/pricing                   Public pricing
/legal/privacy             Legal pages (4)
  /legal/terms
  /legal/cookies
  /legal/offer
/status                    Public health (per-component view of /api/status)
/assistant                 Assistant capability catalogue
/chat                      HubChatPage (URL-addressable; reads ?q=, ?autoSend=1)
/welcome                   Onboarding splash (cold-start)
```

**Спостереження (IA-neutral):**

- 4 path-based модулі мають **однаковий shape**: `[module]/<tab>` + пустий suffix = default. Це дає **predictable URL contract** — `/finyk` vs `/finyk/overview` ідентичні, `/finyk/budgets?cat=smoking` deep-linkable.
- Hub root `/` має **потрійну семантику**: (a) Landing для anon fresh visitor, (b) Hub home для authed, (c) `?tab=` query-param routing для legacy deep-links (Profile, Reports, Settings). Це третій deep-link канал (на додачу до standalone-routes + path-based modules) — **див. P0-IA-1** нижче.
- HubSettings має **два паралельні механізми deep-link-у**: hash `#settings-<section>` (legacy) + query `?group=<id>` (новий, shareable). `readSettingsSectionHash` + `readSettingsGroupParam` мають пріоритет: query > hash > default. Чисто, але **не задокументовано публічно** — `apps/web/AGENTS.md` не описує canonical URL.
- Бот/SEO surface-ів — мінімум. `/status`, `/pricing`, `/legal/*` — public + readable. `/assistant`, `/chat`, `/welcome` — public, але чисто SPA (без SSR-meta). Для marketing landing `/` немає OG-meta passthrough у router-guard.

---

## Hub shell

`HubPage` (`apps/web/src/core/app/HubPage.tsx`) рендерить 4 таби через `HubBottomNav`: Головна (завжди) → Звіти (lazy reveal після першого запису) → Профіль (authed) / Увійти (guest) → Налаштування.

| Знахідка                                                         | Tier | Score    | File                                                                   |
| ---------------------------------------------------------------- | ---- | -------- | ---------------------------------------------------------------------- |
| `Звіти` приховується до першого реального запису (FTUX-guard)    | ✅   | —        | `HubBottomNav.tsx:148-159`, `showReports` prop                          |
| `Увійти` tab для guest-ів (one-tap замість header icon)          | ✅   | —        | `HubBottomNav.tsx:290-303`                                              |
| `hiddenSlot` pattern для tab-strip (CLS-free reveal)             | ✅   | —        | `HubBottomNav.tsx:62-72` (PR-23, UX-roast 2026-Q2 §7.2)                |
| Паралельні канали deep-link: `?tab=`, hash `#`, path-based        | P0   | critical | HubPage.tsx + StandaloneRoutes.tsx + router.tsx → **P0-IA-1**           |
| Hub root `/` має три ролі без явного state-machine               | P1   | high     | StandaloneRoutes.tsx:138-156                                            |
| `Головна` + `Налаштування` tab labels ідентичні модульним?        | ні   | —        | Hub "Головна" vs Фінік "Огляд" — OK                                    |
| Tab labels перекладено в `messages.nav.*`?                        | ні   | —        | Лейбли hardcoded inline (`"Головна"`, `"Звіти"`, ... `HubBottomNav.tsx:253-314`); `nav.hubSections` — це тільки `aria-label`, а не per-tab. **P2-IA-7** |
| Reports reveal анімація не зберігається для нових користувачів    | ні   | —        | `REPORTS_TAB_REVEALED_AT_KEY` — localStorage flag, OK                  |
| `Увійти` tab для guest-ів — a11y-семантика `action`, не `tab`     | ✅   | —        | `HubBottomNav.tsx:78-80` (AT-коректно)                                  |
| 3 `aria-selected` tabs / 1 `action` button — keyboard pattern?    | ✅   | —        | Roving tabindex через `handleTablistKeyDown` (Left/Right/Home/End)     |

**Спостереження:**

- Hub shell — це composable bottom-nav + `<Outlet />` для активного табу. Кожен tab рендерить окремий модуль (`HubDashboard`, `HubReports`, `HubSettingsPage` legacy через `?tab=`), а не path-based route. Це означає, що **tab-state живе у localStorage + URL query-param**, не в URL path → погано для share-ів і back-button.
- Це класичний dual-IA: **path-based для модулів** (initiative 0006) + **query-based для hub tabs** (predecessor, ще не мігровано). Див. **P0-IA-1**.

---

## Module IA

### Фінік (`apps/web/src/modules/finyk/`)

5 табів: Огляд (default), Операції, Планування, Аналітика, Активи. URL: `/finyk[/<tab>]`. Legacy `/payments` → `/budgets`.

| Знахідка                                                              | Tier | Score | File                                                                                  |
| --------------------------------------------------------------------- | ---- | ----- | ------------------------------------------------------------------------------------- |
| `parseFinykSegments` — exhaustive by construction (no `as` cast)      | ✅   | —     | `lib/finykRouter.ts:39-50`                                                            |
| `finykRoutePath("overview")` → `/finyk` (порожній suffix = default)   | ✅   | —     | `lib/finykRouter.ts:60-70`                                                            |
| `?cat=<id>` query-param для deep-link у конкретну категорію           | ✅   | —     | `useFinykQueryParam("cat")` у `FinykApp.tsx:78`                                       |
| Legacy `#budgets` hash → `/finyk/budgets` через one-shot shim         | ✅   | —     | `useFinykRoute.ts` — hash-compat shim                                                |
| `Активи` 4 sub-sections (Assets / Liabilities / Subs / Networth)      | ні   | —     | `Assets.tsx` + 4-х `*Section` файлів, **без sub-URL** → **P2-IA-4**                  |
| `Планування` — назву перекладено як "Планування" (був "Бюджети"?)    | copy | —     | `components/finykNav.tsx:108` — лишилось legacy label? Перевірити tone-of-voice       |
| `Операції` tab — overloaded: charges + incomes + transfers           | ні   | —     | `pages/transactions/Transactions.tsx` має внутрішні фільтри, OK                       |
| Swipe navigation (Left/Right між табами)                             | ✅   | —     | `useSwipeNavigation` (FinykApp.tsx:4)                                                 |
| Module accent: finyk-green                                           | ✅   | —     | `ModuleAccentProvider` у `FinykApp.tsx:14-18`                                         |
| Pull-to-refresh на `Огляд`?                                          | ні   | —     | `RefreshControl` — **є** у `HubDashboard.tsx`, у Фініку — ні; **P2-UX-12**            |

### Фізрук (`apps/web/src/modules/fizruk/`)

**8 табів** — найбільше у продукті. URL: `/fizruk[/<tab>]`.

| Знахідка                                                          | Tier | Score | File                                                                                  |
| ----------------------------------------------------------------- | ---- | ----- | ------------------------------------------------------------------------------------- |
| 8 табів перевищує рекомендовані 5 ± 2 (Miller's law)               | P1   | high  | `shell/fizrukRoute.ts:5-14` — **P1-IA-2**                                             |
| Sub-tab semantics: `body` і `exercise` — це detail-pages, не tab-и | P1   | high  | `body/Body.tsx` (виміри тіла) і `exercise/Exercise.tsx` (деталі вправи) → **P1-IA-3**  |
| `programs` — це list (predefined), а `workouts` — log (active)    | copy | —     | Обидва в ModuleBottomNav, OK але може плутати                                        |
| `atlas` — що це? термінологія не інтуїтивна                        | P1   | high  | **P1-IA-5** (Atlas м'язових груп / рухів?)                                            |
| `progress` / `measurements` — близькі за значенням                 | P2   | med   | **P2-IA-6** — `measurements` = виміри тіла (cm/kg), `progress` = тренди                |
| `FIZRUK_PAGES` типізовано через `as const`                         | ✅   | —     | `shell/fizrukRoute.ts:5-14` — exhaustive                                               |

### Харчування (`apps/web/src/modules/nutrition/`)

4 таби + 4 sub-tabs (2 у Pantry, 2 у Menu). URL: `/nutrition[/<page>[/<sub>]]`. Legacy redirects: `products→pantry`, `plan→menu`, `recipes→menu`, `shop→pantry`.

| Знахідка                                                                  | Tier | Score | File                                                                                  |
| ------------------------------------------------------------------------- | ---- | ----- | ------------------------------------------------------------------------------------- |
| 4 tab-и — оптимально (≤ 5)                                               | ✅   | —     | `lib/nutritionRouter.ts:9`                                                            |
| Sub-tab через path-segment: `/pantry/shopping`, `/menu/plan`              | ✅   | —     | `parseNutritionSegments` + `buildNutritionPath`                                       |
| `start` як default — порожній suffix = `/nutrition`                      | ✅   | —     | `nutritionRouter.ts:84-93`                                                            |
| `LEGACY_REDIRECTS` зберігає 4 застарілі назви                             | ✅   | —     | `products`, `plan`, `recipes`, `shop` — Phase-3 hash-compat                           |
| `Menu` об'єднує `plan + recipes` — семантично вдале, але 2 sub-tab-и     | copy | —     | `lib/nutritionRouter.ts:7-9` (коментар "merge of plan+recipes")                       |
| `pantry/shopping` — окремий URL для списку покупок                       | ✅   | —     | OK, але чи це не занадто глибоко для mobile bottom-nav? **P2-IA-4**                    |
| `isNutritionPage` type-guard замість `as` cast (audit 08 F14)            | ✅   | —     | `nutritionRouter.ts:17-24`                                                            |

### Рутина (`apps/web/src/modules/routine/`)

2 таби: Календар (default), Статистика. URL: `/routine[/<tab>]`.

| Знахідка                                                                | Tier | Score | File                                                                                  |
| ----------------------------------------------------------------------- | ---- | ----- | ------------------------------------------------------------------------------------- |
| 2 таби — оптимально (low cognitive load)                                | ✅   | —     | `lib/routineRouter.ts:10`                                                             |
| Дефолт — Календар, не пустий                                           | ✅   | —     | `routineRouter.ts:42-46`                                                              |
| `Stats` — це read-only агрегат; немає write-path                        | ні   | —     | OK, semantically clear                                                               |
| `useRoutineAppState` має `useLocalStorageState` backup для "last tab"  | ні   | —     | `routineRouter.ts:9-10` коментар — це для backward-compat, OK                         |

---

## Standalone surfaces

Всі 11 path-ів у `STANDALONE_ROUTE_PATHS` (derived set, `apps/web/src/core/app/StandaloneRoutes.tsx:340-342`).

| Path                  | Owner component                    | Auth-required | URL deep-link | Notes |
| --------------------- | ---------------------------------- | ------------- | ------------- | ----- |
| `/`                   | `LandingPage` (anon) / HubPage fallback | ні (умовно) | hash: нема; query: `?tab=…` | 3-way state: anon+no-data → landing; anon+data → Hub; authed → Hub |
| `/sign-in`            | `AuthPage`                         | ні            | hash: нема    | Better Auth; 3 alias-paths redirect → `/sign-in` |
| `/login`, `/signin`, `/auth` | `<RedirectTo to="/sign-in">`     | ні            | hash: нема    | Live-deploy audit 2026-06-11 — м'язові пам'ять URLs |
| `/reset-password`     | `ResetPasswordPage`                | ні            | hash: нема    | Better Auth magic-link landing; рендериться навіть для authed |
| `/profile`            | `<RedirectTo to="/?tab=profile">`  | так (умовно)  | hash: нема    | Legacy deep-link → Hub Profile tab |
| `/design`             | `DesignShowcase` (DEV-only)        | DEV only      | hash: нема    | Internal styleguide; 404 у production |
| `/pricing`            | `PricingPage`                      | ні            | hash: нема    | Phase 0 monetization |
| `/legal/{privacy,terms,cookies,offer}` | `LegalPage`             | ні            | hash: нема    | 4 сторінки, один entry в `STANDALONE_ROUTES` |
| `/status`             | `StatusPage`                       | ні            | hash: нема    | Public health; PR-41 (initiative 0009) |
| `/assistant`          | `AssistantCataloguePage`           | ні (?)        | hash: нема    | Settings link, chat `?` button, `help` |
| `/chat`               | `HubChatPage`                      | ні (?)        | `?q=`, `?autoSend=1` | URL-addressable chat; `InlineAiRail` escalation |
| `/welcome`            | `WelcomeScreen`                    | ні            | hash: нема    | Cold-start splash; returning users redirected → `/` |

**Спостереження:**

- 5 із 11 standalone surface-ів — **public anonymous** (`/`, `/sign-in`, `/legal/*`, `/pricing`, `/status`). Це правильна пропорція для trust-сигналів (pricing, status, legal).
- 6 — auth-required або DEV-only (`/reset-password`, `/profile`, `/design`, `/assistant`, `/chat`, `/welcome`). Auth-guard реалізований на рівні component (redirect → `/sign-in`), а не route-level.
- **`/assistant` і `/chat` — публічно доступні без auth**. Це може бути як фіча (try-before-signup), так і витік (потенційно opens attack surface на `/api/chat` без сесії). Потребує перевірки проти серверного route-guard — **P0-SEC-X (винесено в security-audit, не блокер IA)**.
- **Hash-redirect shim** для всіх 4 path-based модулів: `parseLegacyFinykHash`, `parseLegacyNutritionHash`, `parseLegacyRoutineHash` + аналог для Фізрука. Це **3 однотипних файли** без спільного абстрагування — **P2-IA-8** (refactor candidate, не блокер).

---

## Settings IA — 3 групи × 12 секцій

`HubSettingsPage` (`apps/web/src/core/hub/HubSettingsPage.tsx`) — єдина сторінка з 3 inner-tabs (GROUPS) і 12 секцій (sections), плюс внутрішня search-стрічка `q=` (яка фільтрує по `keywords`).

### Група `general` (6 секцій)

| id            | Title (UA)              | Component         | Lazy? | A11y keywords                                          |
| ------------- | ----------------------- | ----------------- | ----- | ------------------------------------------------------ |
| `dashboard`   | Дашборд                 | `DashboardSection`  | ні    | дашборд, dashboard, підказки, щільність, вигляд         |
| `general`     | Загальні                | `GeneralSection`    | ні    | загальні, онбординг, welcome, sync, акаунт              |
| `plan`        | Підписка та план        | `PlanSection`       | ні    | план, підписка, billing, pro, free, trial, stripe       |
| `notifications` | Нагадування          | `NotificationsSection` | ні | сповіщення, нагадування, push, notifications            |
| `ai`          | AI-дайджести            | `AIDigestSection`   | ні    | ai, штучний інтелект, дайджест, тижневий                |
| `assistant`   | Можливості асистента    | `AssistantCatalogueSection` | ні | асистент, команди, chat, help, інструменти            |

### Група `modules` (4 секції)

| id          | Title (UA) | Component         | Lazy (minH) | A11y keywords                                       |
| ----------- | ---------- | ----------------- | ----------- | --------------------------------------------------- |
| `routine`   | Рутина     | `RoutineSection`  | ✅ 248      | звички, рутина, habits, streak, ціль, reset         |
| `fizruk`    | Фізрук     | `FizrukSection`   | ✅ 168      | фізрук, тренування, кардіо, вага, workouts          |
| `finyk`     | Фінік      | `FinykSection`    | ✅ 248      | фінанси, фінік, monobank, privatbank                |
| `nutrition` | Харчування | `NutritionSection` | ✅ 280      | харчування, їжа, кбжу, калорії, комора, штрихкод   |

### Група `advanced` (4 секції)

| id              | Title (UA)              | Component              | Lazy? | A11y keywords                                |
| --------------- | ----------------------- | ---------------------- | ----- | -------------------------------------------- |
| `privacy`       | Конфіденційність        | `PrivacySection`       | ні    | конфіденційність, блокування, pin, lock       |
| `pwa`           | PWA та офлайн           | `PWASection`           | ні    | pwa, офлайн, service worker, кеш             |
| `dataExport`    | Експорт/імпорт JSON     | `DataExportSection`    | ні    | експорт, імпорт, json, backup, hub, дані      |
| `experimental`  | Експериментальні        | `ExperimentalSection`  | ні    | experimental, lab, beta, debug               |

| Знахідка                                                                              | Tier | Score | File / Line                                                  |
| ------------------------------------------------------------------------------------- | ---- | ----- | ------------------------------------------------------------ |
| 12 секцій у 3 групах — оптимально (vs 12 плоский список)                             | ✅   | —     | `HubSettingsPage.tsx:81-104` (GROUPS const)                  |
| `dataExport` названо `Експорт/імпорт JSON`, хоча кодекс `dataExport` / `dataImport`  | copy | —     | `HubSettingsPage.tsx:294-298` — **P2-COPY-9**                 |
| `experimental` має попередження (PR-36)                                              | ✅   | —     | UX-roast PR-36, EXPERIMENTAL section warning                |
| Lazy-mount для 4 module-sections (CLS-safe skeleton)                                 | ✅   | —     | `HubSettingsPage.tsx:75-76` (lazy.minH)                       |
| Hash-based deep-link (`#settings-finyk`) + query-based (`?group=modules`)           | ✅   | —     | `readSettingsSectionHash` + `readSettingsGroupParam`          |
| Неявне правило: `?tab=settings` встановлюється автоматично при відкритті групи      | ні   | —     | `HubSettingsPage.tsx:159` — `params.set("tab", "settings")`   |
| Чи є публічна документація canonical URL pattern?                                    | ні   | —     | Ні — потрібен PR-або-розділ в `docs/05-design/ia.md`         |

---

## Navigation patterns & deep-link контракт

У Sergeant **4 канали deep-link-у**, що живуть паралельно. Це найбільша IA-проблема продукту станом на 2026-06-19.

| # | Канал            | Приклад                                       | Owner                                   | Backed by                |
| - | ---------------- | --------------------------------------------- | --------------------------------------- | ------------------------ |
| 1 | **Path-based**   | `/finyk/budgets?cat=smoking`                  | router.tsx + `useFinykRoute`            | React Router 7           |
| 2 | **Standalone**   | `/sign-in`, `/status`, `/chat?q=foo`         | `StandaloneRoutes.tsx` (registry)       | catch-all `*`            |
| 3 | **Hub query-tab**| `/?tab=profile`, `/?tab=reports`, `/?tab=settings` | `useHubUIState` (read/write `?tab=`)   | HubPage state            |
| 4 | **Hash deep-link** | `#settings-finyk`, `#budgets` (legacy)       | `parseLegacy*Hash` + `readSettingsSectionHash` | one-shot redirect       |

### Проблеми

| ID        | Tier | Score    | Опис                                                                                                                       | Файл                                                                   |
| --------- | ---- | -------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| P0-IA-1   | P0   | critical | Hub tabs (`profile` / `reports` / `settings`) живуть у `?tab=`, не в path. Back-button + share-URLs зламані для цих табів    | `apps/web/src/core/hooks/useHubUIState.ts:30-60`                        |
| P0-IA-2   | P0   | critical | `/?tab=settings&group=modules` дублює шлях `/settings?group=modules` (canonical), але обидва живуть одночасно              | router.tsx:88-103 (path-based `/settings/*`) + HubPage `?tab=settings` |
| P1-IA-3   | P1   | high     | Фізрук: `body` і `exercise` — це detail-pages, а не tab-и. URL `/fizruk/body` повертає list, `/fizruk/exercise` — деталізацію, але обидва в ModuleBottomNav | `modules/fizruk/shell/fizrukRoute.ts:5-14` |
| P1-IA-4   | P1   | high     | 8 фізрук-табів перевищують cognitive ceiling (5 ± 2). Потрібно або злиття (`measurements` ⊂ `progress`), або вкладені сторінки | `shell/fizrukRoute.ts:5-14` |
| P1-IA-5   | P1   | high     | `atlas` — неінтуїтивна назва (Atlas of exercises / muscles?). Потрібен user-test                                         | `modules/fizruk/shell/fizrukRoute.ts:7`                                |
| P2-IA-6   | P2   | med      | `progress` vs `measurements` — близькі значення, потребують disambiguation glossary                                       | `shell/fizrukRoute.ts:9-10`                                            |
| P2-IA-7   | P2   | med      | Tab labels (Головна / Звіти / Профіль / Налаштування) hardcoded у `HubBottomNav.tsx`, не в `messages.nav.*`                | `HubBottomNav.tsx:253-314`                                             |
| P2-IA-8   | P2   | med      | 3 однотипних `parseLegacy<Module>Hash` файлів без спільного абстрагування — refactor candidate                            | `finykRouter.ts:88-99` + `nutritionRouter.ts:117-125` + `routineRouter.ts:67-73` |
| P2-IA-9   | P2   | med      | HubSettings canonical URL `/settings?group=...` не описаний у `apps/web/AGENTS.md` чи design docs                          | `docs/05-design/` — відсутній розділ IA                                |

**Backward-compat shim** (`parseLegacy*Hash`) — це технічний борг, але **прийнятний ризик**: єдиний write-path — це `useFinykRoute` (та аналоги), які переписують URL на першому маунті; legacy URLs не залишаються у history.

---

## Findability & search

Три пошуки живуть у продукті:

| Поверхня          | Component                              | Index              | Notes                                            |
| ----------------- | -------------------------------------- | ------------------ | ------------------------------------------------ |
| Hub global search | `HubSearchEngine`                      | всі модулі         | `useHubSearchEngine`; UI: header icon → overlay  |
| HubSettings       | inline `q=` у `HubSettingsPage`        | 12 секцій (keywords) | фільтрує по `keywords` string match              |
| Module-level      | Фінік / Фізрук / Харчування мають власні списки | per-module | `?cat=` для deep-link у Фініку                   |

| Знахідка                                                                                | Tier | Score | Файл                                                                  |
| --------------------------------------------------------------------------------------- | ---- | ----- | --------------------------------------------------------------------- |
| Hub global search ↔ module search — дублювання?                                         | P1   | high  | **P1-FIND-1** — потрібен user-flow "Hub search → module deep-link"    |
| HubSettings search фільтрує тільки `keywords`, не title/description                     | P1   | high  | `HubSettingsPage.tsx:310-323` — **P1-FIND-2**                          |
| `?cat=<id>` у Фініку — deep-link, але немає UI для share                                 | P2   | med   | `useFinykQueryParam` — URL-стан не має "копіювати" action              |
| `Pantry/shopping` URL — deep-linkable, але чи знають про нього користувачі?            | P2   | med   | **P2-IA-4** (deep-link-и не промо-ються)                              |
| Чи маємо публічну мапу deep-link-ів (settings) для power-users?                        | P2   | med   | **P2-FIND-3** — відсутній розділ у Help / docs                          |

---

## Onboarding cold-start path

`shouldShowOnboarding()` (`apps/web/src/core/onboarding/onboardingGate.ts`) — single source of truth для cold-start. Стейт-машина:

```
[Anon visitor]
  ↓ / 
  [storageReady?] → ні → <PageLoader />
  ↓ так
  [shouldShowOnboarding() = true] → LandingPage
  [shouldShowOnboarding() = false] → HubPage (local-first warm install)

[Returning user]
  ↓ /welcome (stale link)
  [shouldShowOnboarding() = false] → <RedirectTo to="/" />
```

| Знахідка                                                                       | Tier | Score | Файл                                                              |
| ------------------------------------------------------------------------------ | ---- | ----- | ----------------------------------------------------------------- |
| Зворотна сумісність `local-first`: warm install з даними без auth → Hub        | ✅   | —     | `StandaloneRoutes.tsx:138-156`                                    |
| `storageReady` race: повертається до `PageLoader` замість flashing             | ✅   | —     | `StandaloneRoutes.tsx:142-145`                                    |
| `LandingPage` і `WelcomeScreen` — дві різні поверхні (market vs splash)        | copy | —     | Обидва виглядають як "first-run", але мають різну мету              |
| "Continue without account" CTA landing-у → `onLeaveWelcome` → `/welcome`        | ні   | —     | OK, але 2-кроковий funnel vs 1-кроковий                            |
| Відсутній telemetry: скільки користувачів проходять через Landing → Welcome → first record | ні   | —     | PR-0 telemetry не landed (див. UX-roast 2026-Q2 §0) → **P0-IA-10**|

**P0-IA-10** — PR-0 telemetry з 9 events (`APP_LOCK_SETUP_STARTED` тощо) **не задеплоєно** (станом на 2026-05-31 closure note у `ux-roast-pr-plan.md:81`). Без цих подій неможливо виміряти, чи P0-зміни в onboarding/IA мають effect → метричний blind spot для наступних кварталів. **Це не IA-блокер, а measurement blocker.**

---

## Tone of voice & copy consistency

Канон: `docs/01-product/copy/style-guide.uk.md` + `apps/web/src/shared/i18n/uk.ts` (869 рядків, 14 секцій top-level: `nav`, `empty`, `strategy`, `auth`, `ai`, `chat`, `hub`, `onboarding`, `finyk`, `fizruk`, `nutrition`, `routine`, `settings`, `legal`).

| Знахідка                                                                              | Tier | Score | Файл                                                                                  |
| ------------------------------------------------------------------------------------- | ---- | ----- | ------------------------------------------------------------------------------------- |
| Канон дотримано: 1-а особа однини, `ти`-address, action-prompt-closed errors          | ✅   | —     | style-guide.uk.md                                                                     |
| `nav.*` ключі існують, але `HubBottomNav` не використовує їх для tab labels           | P2   | med   | `HubBottomNav.tsx:253-314` — **P2-IA-7**                                              |
| Модульні `nav.<module>.*` ключі для tab labels                                         | ✅   | —     | Фінік `components/finykNav.tsx` має `label: "Огляд"` etc, але hardcoded               |
| `Планування` (Фінік) — залишок legacy label (був "Бюджети" чи "Платежі"?). Неузгоджено з `budgets` | P2 | med | **P2-COPY-9** (audit 09 follow-up)                                                  |
| `Активи` (Фінік) — розпливчасто (Assets = ?). Внутрішньо має 4 sub-секції             | ні   | —     | OK, але 4 секції без sub-URL → **P2-IA-4**                                            |
| `Atlas` (Фізрук) — non-UA-origin термін                                                | P1   | high  | **P1-IA-5** — потребує UA-еквівалент або onboarding tooltip                          |
| `AI-дайджести` (Settings) — новий термін, потребує пояснення                          | P2   | med   | `HubSettingsPage.tsx:236` — **P2-COPY-10**                                            |
| `Дайджест` — що це: weekly email / in-app feed? Документація в `docs/01-product/launch/` | ні | —    | OK, але discoverability                                      |
| `appLock` (Settings → privacy) — для звичайного користувача це "PIN"                  | copy | —     | UX-roast PR-1a closed, copy OK                                                        |

---

## Accessibility — IA-зріз

Не повний a11y-аудит (→ axe + Playwright `pnpm --filter @sergeant/web test:a11y`), а тільки IA-shape перевірка.

| Знахідка                                                                                    | Tier | Score | Файл                                                                  |
| ------------------------------------------------------------------------------------------- | ---- | ----- | --------------------------------------------------------------------- |
| Hub bottom-nav: `role="tablist"`, `aria-selected`, `aria-controls`, roving tabindex         | ✅   | —     | `HubBottomNav.tsx:101-117, 192-222`                                   |
| Auth-action `Увійти` tab: no `role="tab"`, бо це navigation, не tab-switch                  | ✅   | —     | `HubBottomNav.tsx:101-107` (action prop)                              |
| `hiddenSlot` reports tab: `visibility: hidden` (не `aria-hidden`) — щоб RTL знаходив         | ✅   | —     | `HubBottomNav.tsx:118-122` (коментар)                                 |
| ARIA-label для nav: `messages.nav.hubSections` = "Розділи хабу"                             | ✅   | —     | `HubBottomNav.tsx:318`                                                |
| `<Outlet />` у HubPage не має aria-live для SPA navigation announce                        | ні   | —     | OK для tablist, але route change не оголошується → **P2-A11Y-11**      |
| Module-headers: `<ModuleHeaderBackButton>` має `aria-label`?                              | ні   | —     | Перевірити у `shared/components/layout/ModuleHeader.tsx`               |
| `/?tab=settings#settings-finyk` — deep-link announce skip-to-content                        | ні   | —     | Немає skip-link у HubPage → **P2-A11Y-12**                              |
| `?cat=smoking` query-param без ARIA-state announce                                         | ні   | —     | OK, не критично                                                       |
| `Pantry/shopping` URL — не має breadcrumb на mobile                                        | P2   | med   | **P2-A11Y-13** (mobile navigation breadcrumbs)                         |
| HubSearchEngine: `role="combobox"` / `role="search"` / `aria-activedescendant`?            | ні   | —     | Перевірити у `core/hub/search/`                                        |

---

## P0 / P1 / P2 знахідки

### P0 (critical) — 7 знахідок

| ID          | Знахідка                                                                                              | Owner surface                  | Рекомендована дія                                                                 |
| ----------- | ----------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------- |
| **P0-IA-1** | Hub tabs живуть у `?tab=`, не в path → back-button + share-URLs зламані                               | Hub shell / Phase-3 migration  | Phase-3: мігрувати `/?tab=profile` → `/profile` (redirect вже є), `/?tab=reports` → `/insights` (path-based), `/?tab=settings` → `/settings` (path-based). Закриває **P0-IA-1** + **P0-IA-2** одним PR-ом. |
| **P0-IA-2** | `/?tab=settings&group=modules` дублює canonical `/settings?group=modules`                             | HubSettings / router           | Phase-3: единий canonical — `/settings`. `?tab=settings` — тільки legacy shim.    |
| **P0-FTUX-1** | Telemetry events з PR-0 не задеплоєно → метричний blind spot для IA-вимірювань                      | Onboarding / analytics        | Land PR-0 events (closure note 2026-05-31 у UX-roast plan). Блокує 11 downstream.  |
| **P0-FIND-4** | Hub global search не має transition-у до module deep-link (share / continue)                          | HubSearchEngine                | Додати "Open in Фінік / Фізрук" CTA з payload deep-link.                            |
| **P0-A11Y-14** | Skip-link не реалізований у Hub shell (Phase-2 router migration)                                    | HubPage / RootLayout           | Додати `<a href="#main-content" className="sr-only focus:not-sr-only">` у RootLayout. |
| **P0-SEC-IA** | `/assistant` і `/chat` публічно доступні без auth → перевірити server route-guard                  | Standalone routes / security   | Backend route-guard вже має бути, але audit-pair (security-audit) не done. Винесено. |
| **P0-IA-15** | Hub root `/` має 3 семантики без явного state-machine → user expectation conflict                    | StandaloneRoutes.tsx:128-156   | Додати `useHubRouteState()` discriminated union: `{ role: 'landing' \| 'hub' \| 'redirect' }` для тестабельності. |

### P1 (high) — 9 знахідок

| ID          | Знахідка                                                                                              | Owner surface          | Рекомендована дія                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| **P1-IA-2** | 8 фізрук-табів > cognitive ceiling                                                                     | Fizruk IA              | Злиття: `measurements` ⊂ `progress` (one-way link); або detail-page pattern для `body` + `exercise` |
| **P1-IA-3** | Фізрук: `body` / `exercise` — це detail, не tab                                                       | Fizruk IA              | Перетворити на detail-pages, винести з ModuleBottomNav у FAB / context menu       |
| **P1-IA-5** | `Atlas` — non-UA-origin термін                                                                         | Fizruk copy            | A/B test: "Атлас" vs "Довідник вправ" vs "Бібліотека рухів"                        |
| **P1-IA-7** | Tab labels hardcoded, не з `messages.nav.*`                                                            | HubBottomNav           | Винести у `messages.nav.tabs.{dashboard,reports,profile,settings,signIn}`           |
| **P1-IA-11** | Canonical URL pattern (`/settings?group=…`, `/finyk/budgets?cat=…`) не задокументований              | docs                   | Додати `docs/05-design/ia.md` із pattern catalog                                    |
| **P1-IA-12** | Phase-2 router-redirects (legacy hash → path) — 3 однотипних файли без shared helper                  | refactor               | Extract `parseLegacyHashRedirect()` generic helper                                 |
| **P1-FIND-1** | Hub global search дублює module-level search                                                          | search                 | Unify: `useGlobalSearch` index modules; UI у header overlay                          |
| **P1-FIND-2** | HubSettings search фільтрує тільки `keywords`                                                         | HubSettingsPage        | Index title + description + keywords, multi-field score                              |
| **P1-A11Y-16** | `<Outlet />` SPA navigation не оголошується                                                          | a11y                   | `useEffect` announce route change via `aria-live="polite"`                          |

### P2 (medium) — 7 знахідок

| ID          | Знахідка                                                                                              | Owner surface        | Рекомендована дія                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------- |
| **P2-IA-4** | Фінік `Активи` має 4 sub-секції без sub-URL                                                          | Finyk IA             | `/finyk/assets/<section>` deep-link                                            |
| **P2-IA-6** | Фізрук `progress` vs `measurements` — disambiguation glossary                                         | Fizruk copy          | Onboarding tooltip: "Прогрес = тренди, Заміри = числа"                          |
| **P2-IA-8** | 3 `parseLegacy*Hash` файли — refactor candidate                                                       | refactor             | `parseLegacyHash(moduleId)` generic                                            |
| **P2-IA-9** | Canonical URL pattern не документований у `apps/web/AGENTS.md`                                        | docs                 | Розділ "URL contract" в `apps/web/AGENTS.md`                                   |
| **P2-FIND-3** | Power-user мапа deep-link-ів (settings) відсутня                                                  | docs                 | Help / docs section "URL cheatsheet"                                            |
| **P2-COPY-9** | Фінік `Планування` label vs `budgets` URL — розбіжність                                            | Finyk copy           | Audit 09 follow-up: standardize to "Бюджети" або оновити docs                  |
| **P2-A11Y-13** | Mobile breadcrumbs відсутні (особливо `/pantry/shopping`)                                          | a11y                 | Додати mobile breadcrumb у Nutrition shell                                      |

---

## Рекомендації — пріоритезована дорожня карта

> **Update 2026-06-19:** ця дорожня карта додаткова до вже активних trackers — **не підміняє** їх. Усі P0/P1 з цього аудиту або вливаються у наявні трекери (UX-roast PR-plan, Fable5 ws-12, Consolidated), або стають новими PR-ами. Див. маппінг нижче.

### Sprint 0 — Enabling (блокує вимірювання)

| ID          | Дія                                                       | Size | Tracker                                          |
| ----------- | --------------------------------------------------------- | ---- | ------------------------------------------------ |
| P0-FTUX-1   | Land PR-0 telemetry events (9 events)                     | S    | `ux-roast-pr-plan.md` PR-0 closure note 2026-05-31 |

### Sprint 1 — Phase-3 router unification (4 PR-и, ~2 тижні)

| ID          | Дія                                                                                              | Size | Трекер                              |
| ----------- | ------------------------------------------------------------------------------------------------ | ---- | ----------------------------------- |
| P0-IA-15    | `useHubRouteState()` discriminated union — testable state-machine для `/`                       | S    | **Новий** PR у Phase-3 batch        |
| P0-IA-1+2   | Phase-3: `/?tab={profile,reports,settings}` → path-based redirects; залишити `?tab=` як alias    | L    | **Новий** PR у Phase-3 batch        |
| P1-IA-11+9  | `docs/05-design/ia.md` — URL contract catalog                                                    | S    | **Новий** docs PR                    |
| P1-IA-12    | Extract `parseLegacyHashRedirect()` generic helper                                              | S    | refactor PR                          |

### Sprint 2 — Fizruk IA cleanup (~1 тиждень)

| ID          | Дія                                                                                              | Size | Трекер                                  |
| ----------- | ------------------------------------------------------------------------------------------------ | ---- | --------------------------------------- |
| P1-IA-2     | Злиття `measurements` ⊂ `progress` (sub-tab) АБО detail-page pattern                            | M    | **Новий** PR — `2026-05-13-page-audit-07-fizruk-part2.md` F1-F50 follow-up |
| P1-IA-3     | `body` / `exercise` → detail-pages, винести з ModuleBottomNav                                     | M    | same                                    |
| P1-IA-5     | `Atlas` A/B test: 3 UA-варіанти                                                                  | S    | A/B test infra (PR-0 dep)              |
| P2-IA-6     | Disambiguation glossary (`progress` vs `measurements`)                                            | S    | copy PR                                 |

### Sprint 3 — Search & findability (~1 тиждень)

| ID          | Дія                                                                                              | Size | Трекер                                          |
| ----------- | ------------------------------------------------------------------------------------------------ | ---- | ----------------------------------------------- |
| P0-FIND-4   | "Open in Фінік" CTA з deep-link payload                                                          | M    | **Новий** PR                                     |
| P1-FIND-1   | Unify Hub global search ↔ module search                                                          | L    | **Новий** PR — merge з `core/hub/search/`        |
| P1-FIND-2   | HubSettings search: title + description + keywords scoring                                       | S    | **Новий** PR у `HubSettingsPage.tsx`             |
| P2-FIND-3   | URL cheatsheet у Help / docs                                                                     | S    | **Новий** docs PR                                |

### Sprint 4 — A11y + copy polish (~1 тиждень)

| ID          | Дія                                                                                              | Size | Трекер                                  |
| ----------- | ------------------------------------------------------------------------------------------------ | ---- | --------------------------------------- |
| P0-A11Y-14  | Skip-link у RootLayout                                                                            | S    | **Новий** PR                            |
| P1-A11Y-16  | `aria-live` route-change announce                                                                | S    | **Новий** PR                            |
| P2-IA-7     | Tab labels у `messages.nav.tabs.*`                                                               | S    | `ux-roast-pr-plan.md` PR-30 (unify)     |
| P2-COPY-9   | Фінік `Планування` → `Бюджети` (або навпаки — update docs)                                       | XS   | Audit 09 follow-up                       |
| P2-COPY-10  | `AI-дайджести` — tooltip / glossary                                                              | XS   | copy PR                                  |
| P2-A11Y-13  | Mobile breadcrumbs у Nutrition shell                                                            | S    | **Новий** PR                            |
| P2-IA-4     | `/finyk/assets/<section>` deep-link                                                              | M    | **Новий** PR — Finyk IA extension        |

### Без змін — out-of-scope (security + server)

| ID          | Дія                                                                                              | Owner                              |
| ----------- | ------------------------------------------------------------------------------------------------ | ---------------------------------- |
| P0-SEC-IA   | Перевірити server route-guard для `/assistant` + `/chat` (auth-optional routes)                 | `sergeant-security-audit` skill    |

### Сіпана vs outstanding (cross-tracker status)

| Tracker                                              | Покриття цим аудитом                       | Action                                                     |
| ---------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| [`2026-05-06-ux-roast-pr-plan.md`](./2026-05-06-ux-roast-pr-plan.md) | 21/41 closed, 20 outstanding              | Додати **P0-FTUX-1** (PR-0 telemetry, blocker) у sprint 0   |
| [`2026-05-13-consolidated-page-audit.md`](./2026-05-13-consolidated-page-audit.md) | 255 знахідок, 96 non-null warns outstanding | **P1-IA-3, P1-IA-2** — перевірити перетин з F-серією Fізрук-audit-07 |
| [`2026-05-13-page-audit-07-fizruk-part2.md`](./2026-05-13-page-audit-07-fizruk-part2.md) | 16/50 closed, 34 outstanding              | **P1-IA-2, P1-IA-3, P1-IA-5, P2-IA-6** додати як F51-F54    |
| [`2026-05-13-page-audit-08-nutrition.md`](./2026-05-13-page-audit-08-nutrition.md) | Active                                    | **P2-IA-4** (Finyk) — не стосується nutrition               |
| [`2026-05-13-page-audit-10-errors-pwa-marketing.md`](./2026-05-13-page-audit-10-errors-pwa-marketing.md) | Active                                    | **P0-FIND-4** (chat deep-link) — перевірити перетин з F29 |
| [`2026-06-11-fable5-independent-audit.md`](./2026-06-11-fable5-independent-audit.md) | 11/15 closed                              | **P0-IA-15** ↔ ws-12 (state-machine); **P0-A11Y-14** ↔ ws-13 |

---

## Додатки

### Додаток A — Повний реєстр URL-ів (canonical)

> Single source of truth — `apps/web/src/core/app/StandaloneRoutes.tsx` + `modules/*/lib/*Router.ts` + `apps/web/src/core/hub/HubSettingsPage.tsx`.

```
/                                                       hub or landing
├── /sign-in                                             auth (Better Auth)
│   ├── /login                                           → 301 → /sign-in
│   ├── /signin                                          → 301 → /sign-in
│   └── /auth                                            → 301 → /sign-in
├── /reset-password                                      magic-link landing
├── /profile                                             → 301 → /?tab=profile (legacy)
├── /design                                              DEV-only styleguide; 404 in prod
├── /pricing                                             public pricing
├── /legal
│   ├── /legal/privacy
│   ├── /legal/terms
│   ├── /legal/cookies
│   └── /legal/offer
├── /status                                              public health
├── /assistant                                           capability catalogue
├── /chat?q=…&autoSend=1                                  AI chat
├── /welcome                                             cold-start splash
│
├── /finyk[/<tab>]                                       module: Фінік
│   ├── /finyk                  = Огляд  (default)
│   ├── /finyk/transactions     = Операції
│   ├── /finyk/budgets          = Планування  (legacy /payments → тут)
│   ├── /finyk/analytics        = Аналітика
│   └── /finyk/assets           = Активи  (4 sub-sections, no sub-URL — P2-IA-4)
│
├── /fizruk[/<tab>]                                      module: Фізрук
│   ├── /fizruk                 = Дашборд (default)
│   ├── /fizruk/atlas           = Atlas
│   ├── /fizruk/workouts        = Тренування
│   ├── /fizruk/progress        = Прогрес
│   ├── /fizruk/measurements    = Заміри
│   ├── /fizruk/programs        = Програми
│   ├── /fizruk/body            = Тіло
│   └── /fizruk/exercise        = Вправа
│
├── /nutrition[/<page>[/<sub>]]                          module: Харчування
│   ├── /nutrition              = Start (default)
│   ├── /nutrition/pantry
│   │   ├── /nutrition/pantry/items
│   │   └── /nutrition/pantry/shopping
│   ├── /nutrition/log
│   └── /nutrition/menu
│       ├── /nutrition/menu/plan
│       └── /nutrition/menu/recipes
│
├── /routine[/<tab>]                                    module: Рутина
│   ├── /routine                = Календар (default)
│   └── /routine/stats          = Статистика
│
├── /insights                                            HubReports (legacy /?tab=reports redirect — P0-IA-1)
│
├── /settings?group=<id>                                 HubSettings (legacy /?tab=settings redirect — P0-IA-2)
│   ├── /settings?group=general                           (default)
│   ├── /settings?group=modules
│   └── /settings?group=advanced
│
└── /onboarding                                          Welcome (cold-start)
```

### Додаток B — Backward-compat shim inventory

| Shim                                | Lines          | File                                              |
| ----------------------------------- | -------------- | ------------------------------------------------- |
| `parseLegacyFinykHash`              | 88-100         | `apps/web/src/modules/finyk/lib/finykRouter.ts`   |
| `parseLegacyNutritionHash`          | 117-125        | `apps/web/src/modules/nutrition/lib/nutritionRouter.ts` |
| `parseLegacyRoutineHash`            | 67-73          | `apps/web/src/modules/routine/lib/routineRouter.ts` |
| `parseLegacyFizrukHash` (?)         | ?              | `apps/web/src/modules/fizruk/lib/fizrukRouter.ts` (needs verification) |
| `readSettingsSectionHash`           | 106-110        | `apps/web/src/core/hub/HubSettingsPage.tsx`       |
| `readSettingsGroupParam`            | 126-135        | `apps/web/src/core/hub/HubSettingsPage.tsx`       |
| `parseLegacyHubTab` (`?tab=`)       | 14-26          | `apps/web/src/core/hooks/useHubUIState.ts`        |
| 3 alias-paths → /sign-in            | 77-81          | `apps/web/src/core/app/appPaths.ts`               |
| `PROFILE_PATH` → `/?tab=profile`     | 209-220        | `apps/web/src/core/app/StandaloneRoutes.tsx`      |

**Refactor candidate (P2-IA-8):** group 4 hash-parser files into 1 generic `parseLegacyHashRedirect(moduleId, hash)`.

### Додаток C — Files read для цього аудиту (47 файлів)

```
apps/web/src/core/app/
  router.tsx, routes.ts, StandaloneRoutes.tsx, appPaths.ts,
  HubPage.tsx, HubBottomNav.tsx, HubHeader.tsx, HubMainContent.tsx,
  HubShellContext.tsx, RootLayout.tsx, WelcomeScreen.tsx,
  WelcomeModulePicker.tsx, ActiveWorkoutBanner.tsx,
  useDemoCommands.ts, useAppEffects.ts, IOSInstallBanner.tsx

apps/web/src/core/hub/
  HubSettingsPage.tsx, HubDashboard.tsx, HubReports.tsx,
  HubChatPage.tsx, HubChat.tsx, hubSearchEngine.ts,
  useFinykHubPreview.ts, useHubDashboardState.ts, hub.types.ts

apps/web/src/core/hooks/
  useHubUIState.ts

apps/web/src/modules/
  finyk/FinykApp.tsx, finyk/lib/finykRouter.ts, finyk/hooks/useFinykRoute.ts,
  finyk/components/finykNav.tsx
  fizruk/FizrukApp.tsx, fizruk/shell/fizrukRoute.ts,
  fizruk/lib/fizrukRouter.ts, fizruk/hooks/useFizrukRoute.ts
  nutrition/NutritionApp.tsx, nutrition/lib/nutritionRouter.ts,
  nutrition/hooks/useNutritionRoute.ts
  routine/RoutineApp.tsx, routine/lib/routineRouter.ts,
  routine/hooks/useRoutineRoute.ts

apps/web/src/shared/i18n/uk.ts (lines 198-232 nav/empty)
```

### Додаток D — Пов'язані аудити (стан на 2026-06-19)

| Аудит                                                       | Статус          | Implemented/Outstanding | Перетин з цим |
| ----------------------------------------------------------- | --------------- | ----------------------- | ------------- |
| [`2026-04-28-ux-ui-audit.md`](./archive/2026-04-28-ux-ui-audit.md) | Closed (hist.) | 33 done, 4 pending      | Phase 1-3 реалізація → основа IA |
| [`2026-05-06-ux-roast-pr-plan.md`](./2026-05-06-ux-roast-pr-plan.md) | Active         | 21/41 (20 outstanding) | PR-0 telemetry (P0-FTUX-1) |
| [`2026-05-06-ux-roast.md`](./archive/2026-05-06-ux-roast.md) | Archived        | migrated                | 39 знахідок → IA-зріз |
| [`2026-05-13-page-audit-02-hub-dashboard.md`](./archive/2026-05-13-page-audit-02-hub-dashboard.md) | Archived | 23/24 (F1 raw-key residual) | Hub home IA |
| [`2026-05-13-page-audit-07-fizruk-part2.md`](./2026-05-13-page-audit-07-fizruk-part2.md) | Active | 16/50 (34 outstanding) | P1-IA-2, P1-IA-3, P1-IA-5, P2-IA-6 (F51-F54) |
| [`2026-05-13-page-audit-08-nutrition.md`](./2026-05-13-page-audit-08-nutrition.md) | Active | ≈ (incl. F15 uom-conversion) | P2-IA-4 (Finyk, not Nutrition) |
| [`2026-05-13-page-audit-10-errors-pwa-marketing.md`](./2026-05-13-page-audit-10-errors-pwa-marketing.md) | Active | ≈ (F2 e2e deferred) | P0-FIND-4 (chat deep-link ↔ F29) |
| [`2026-05-13-consolidated-page-audit.md`](./2026-05-13-consolidated-page-audit.md) | Active | ≈96 warns outstanding | Theme 4 (IA) — перевірити перетин |
| [`2026-06-08-codebase-cleanup-audit.md`](./2026-06-08-codebase-cleanup-audit.md) | Active | 4 decisions             | dead-code, lifecycle-marker drift |
| [`2026-06-11-fable5-independent-audit.md`](./2026-06-11-fable5-independent-audit.md) | Active | 11/15 (ws-10/12/13 P1)  | P0-IA-15 ↔ ws-12; P0-A11Y-14 ↔ ws-13 |
