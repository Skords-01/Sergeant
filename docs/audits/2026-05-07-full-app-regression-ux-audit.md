# Sergeant — full regression + UX audit (2026-05-07)

> **Last validated:** 2026-05-07 by Codex. **Next review:** 2026-08-05.
> **Status:** Active

Audit-only прохід виконано проти `origin/main @ 316ef626` на гілці `codex/full-app-regression-ux-audit`. Мета — не виправляти код, а відтворити поточний стан регресій, тестових воріт, PWA/UX coverage і скласти чергу наступних PR. Єдина tracked-зміна цього проходу — цей документ.

## Environment snapshot

| Поле           | Значення                                                             |
| -------------- | -------------------------------------------------------------------- |
| Workspace      | `C:\Users\dmytr\Documents\New project 2`                             |
| Branch         | `codex/full-app-regression-ux-audit`                                 |
| Base           | `origin/main @ 316ef626`                                             |
| Git baseline   | `git status -sb` чистий перед аудитом                                |
| Node           | `v25.9.0`                                                            |
| pnpm           | `9.15.1`                                                             |
| Repo target    | Node `20.x`; локальні engine warnings очікувані                      |
| Disk           | ~329 MB free на старті, ~151 MB після web build/Playwright artifacts |
| Sergeant skill | `sergeant-bugfix-and-regression`                                     |

Локальне середовище має два важливі обмеження: Node 25 замість Node 20 і критично малий вільний диск. Через це heap OOM/tooling failures нижче не треба автоматично читати як runtime-регресії продукту, але вони блокують чесний локальний release-gate.

## TL;DR severity map

| Severity | Surface                 | Висновок                                                                                                                                                           | Наступна дія                                                                |
| -------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| P0       | Web runtime             | Новий P0 boot crash не відтворився: `@sergeant/web build` зелений, `vite-browser-external:node:` не з'явився.                                                      | Лишити як verified-closed, не патчити в цьому PR.                           |
| P1       | Web test gate           | Full Vitest падає на storage/localStorage shim: `localStorage.clear is not a function`, `storage.setItem is not a function`; це ламає багато shared/module тестів. | Окремий PR для web test setup/storage mocks.                                |
| P1       | Mobile test gate        | `TransactionsPage.test.tsx` має 21/21 failures через відсутній `ApiClientProvider`.                                                                                | Окремий PR для mobile test wrapper/provider.                                |
| P2       | Mobile reliability      | Full mobile Jest завершується Node heap OOM; перед OOM є async `act()`/analytics log leaks.                                                                        | Спершу ізолювати failing suites, потім стабілізувати full pass під Node 20. |
| P2       | PWA/a11y/visual tooling | Playwright a11y/visual не доходить до UI: відсутній `chromium_headless_shell-1217`; smoke config на Windows падає на webServer `) was unexpected at this time`.    | Відновити browser install і Windows-safe webServer command.                 |
| P2       | Web build performance   | Build зелений, але є oversized chunks і ineffective dynamic import для `ProfilePage`.                                                                              | Performance hygiene PR після P1 gates.                                      |
| P3       | Local tooling           | `pnpm lint` падає heap OOM на `@sergeant/web`/`mobile-shell` під Node 25; фактичних lint findings не отримано.                                                     | Повторити під Node 20 або з контрольованим heap/disk.                       |

## Command matrix

| Команда                                                                                                                            | Результат    | Нотатки                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| `git fetch origin --prune`                                                                                                         | Pass         | Remote оновлено перед branch switch.                                                 |
| `git switch -c codex/full-app-regression-ux-audit origin/main`                                                                     | Pass         | Чистий audit branch від `origin/main`.                                               |
| `pnpm install --frozen-lockfile`                                                                                                   | Pass         | Лише expected Node engine warnings.                                                  |
| `pnpm format:check`                                                                                                                | Pass         | Prettier зелений.                                                                    |
| `pnpm lint:env-single-source`                                                                                                      | Pass         | Env single source зелений.                                                           |
| `pnpm --filter @sergeant/web typecheck`                                                                                            | Pass         | `tsc` app + service worker зелені.                                                   |
| `pnpm --filter @sergeant/mobile typecheck`                                                                                         | Pass         | Mobile typecheck зелений.                                                            |
| `pnpm --filter @sergeant/server typecheck`                                                                                         | Pass         | Server typecheck зелений.                                                            |
| `pnpm --filter @sergeant/console typecheck`                                                                                        | Pass         | Console typecheck зелений.                                                           |
| `pnpm --filter @sergeant/server test`                                                                                              | Pass         | `128` files, `1661` passed, `17` skipped.                                            |
| `pnpm --filter @sergeant/web build`                                                                                                | Pass         | PWA build зелений; node/fs browser leak не відтворився.                              |
| `pnpm --filter @sergeant/web exec vitest run --reporter=dot --maxWorkers=1`                                                        | Fail         | P1 web storage shim failures.                                                        |
| `pnpm --filter @sergeant/mobile exec jest --runInBand`                                                                             | Fail         | Node heap OOM після ~426s; перед тим real TransactionsPage provider failures.        |
| `pnpm --filter @sergeant/mobile exec jest src/modules/finyk/pages/Transactions/TransactionsPage.test.tsx --runInBand`              | Fail         | 21/21 failures, `useApiClient must be used inside <ApiClientProvider>`.              |
| `pnpm --filter @sergeant/mobile exec jest src/core/OnboardingWizard.test.tsx src/lib/__tests__/identifyTraits.test.ts --runInBand` | Pass         | 17 tests passed; попередня onboarding/identifyTraits зона на main виглядає закритою. |
| `pnpm --filter @sergeant/web test:a11y`                                                                                            | Tooling fail | Build проходить, Playwright не має Chromium executable.                              |
| `pnpm --filter @sergeant/web test:visual`                                                                                          | Tooling fail | 56 visual cases не стартують через той самий missing Chromium.                       |
| `pnpm --filter @sergeant/web exec playwright test --config playwright.smoke.config.ts --project chromium`                          | Tooling fail | webServer не стартує на Windows: `) was unexpected at this time`.                    |
| `pnpm --filter @sergeant/web exec playwright test --config playwright.smoke.config.ts --project mobile-safari`                     | Tooling fail | Та сама webServer помилка; mobile Safari coverage не отримано.                       |
| `pnpm lint`                                                                                                                        | Tooling fail | ESLint worker OOM на Node 25, не дійшло до змістовних lint findings.                 |

## Findings

### P1 — Web Vitest storage shim ламає shared/module тести

**Affected surface:** `apps/web/src/shared/lib/storage/**`, `apps/web/src/shared/lib/modules/crossModulePrompt.test.ts`, `apps/web/src/modules/routine/**`, `apps/web/src/modules/finyk/**`.

**Repro:** `pnpm --filter @sergeant/web exec vitest run --reporter=dot --maxWorkers=1`.

**Actual:** багато тестів падають на `TypeError: localStorage.clear is not a function`, `window.localStorage.clear is not a function`, `storage.setItem is not a function`. `crossModulePrompt` додатково не зберігає suppression state: очікується `true`, отримує `false`, або навпаки для toast path.

**Expected:** test environment має Storage-compatible mock з `getItem`, `setItem`, `removeItem`, `clear`, `key`, `length`; storage-dependent тести ізольовані між кейсами.

**Evidence:** `src/shared/lib/ui/perf.test.ts`, `src/shared/lib/storage/createModuleStorage.test.ts`, `src/shared/lib/storage/storage.test.ts`, `src/shared/lib/storage/storageManager.test.ts`, `src/shared/lib/storage/storageQuota.test.ts`, `src/shared/lib/storage/weeklyDigestStorage.test.ts`, `src/modules/routine/components/settings/TagsSection.test.tsx`, `src/modules/finyk/hooks/useMonobankWebhook.test.tsx`.

**Likely owner/path:** `apps/web/src/test/setup*`, storage mocks, `apps/web/src/shared/lib/storage/**`.

**Suggested fix direction:** централізувати web Vitest storage shim і заборонити тестам підміняти `localStorage` partial object без full Storage API. Додати regression test, який явно перевіряє `localStorage.clear`/`setItem` перед запуском storage suites.

### P1 — Mobile TransactionsPage tests без ApiClientProvider

**Affected surface:** `apps/mobile/src/modules/finyk/pages/Transactions/TransactionsPage.test.tsx`.

**Repro:** `pnpm --filter @sergeant/mobile exec jest src/modules/finyk/pages/Transactions/TransactionsPage.test.tsx --runInBand`.

**Actual:** `Test Suites: 1 failed`, `Tests: 21 failed`. Корінь однаковий: `useApiClient must be used inside <ApiClientProvider>. Create an ApiClient with createApiClient() and wrap the tree.`

**Expected:** TransactionsPage test wrapper має відтворювати runtime provider tree або мокати API client на рівні shared render helper.

**Evidence:** stack через `packages/api-client/src/react/context.tsx:32`, `useUser`, `apps/mobile/src/modules/finyk/lib/transactionsStore.ts:359`, `TransactionsPage.tsx:91`, test render helper `TransactionsPage.test.tsx:91`.

**Likely owner/path:** `apps/mobile/src/modules/finyk/pages/Transactions/TransactionsPage.test.tsx`, mobile test utils/provider wrapper.

**Suggested fix direction:** додати `ApiClientProvider` у mobile render helper для Finyk pages або створити module-local wrapper з test client. Це виглядає як test harness regression, не доведений runtime crash.

### P2 — Full mobile Jest нестабільний через heap OOM і async leaks

**Affected surface:** `apps/mobile` Jest.

**Repro:** `pnpm --filter @sergeant/mobile exec jest --runInBand`.

**Actual:** процес завершується `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`. Перед fatal видно `Animated(View) inside a test was not wrapped in act(...)` і `Cannot log after tests are done` для analytics/hint events.

**Expected:** full mobile Jest має завершуватись або падати на конкретних suites без процесного OOM.

**Likely owner/path:** mobile test setup, HubDashboard/hints tests, analytics mock lifecycle.

**Suggested fix direction:** після P1 provider fix повторити full Jest під Node 20; якщо OOM лишиться, запускати suite bisect і закрити async timers/logging leaks.

### P2 — Playwright a11y/visual coverage заблокований локальним browser install

**Affected surface:** `apps/web/tests/a11y/**`, visual QA, PWA smoke.

**Repro:** `pnpm --filter @sergeant/web test:a11y`, `pnpm --filter @sergeant/web test:visual`.

**Actual:** тести не доходять до сторінок. Playwright шукає `C:\Users\dmytr\AppData\Local\ms-playwright\chromium_headless_shell-1217\chrome-headless-shell-win64\chrome-headless-shell.exe` і просить `pnpm exec playwright install`.

**Expected:** a11y/visual matrix має запускатись для welcome, hub, finyk, fizruk, routine, nutrition у light/dark і mobile/tablet/desktop viewports.

**Evidence artifacts:** `apps/web/test-results/**/error-context.md`, `apps/web/test-results/**/trace.zip` містять tooling error, не UI screenshots.

**Suggested fix direction:** відновити Playwright browsers у CI/local cache. Через локальний диск ~151 MB free не запускати browser install у цьому audit pass.

### P2 — Playwright smoke webServer command не Windows-safe

**Affected surface:** `apps/web/playwright.smoke.config.ts` або пов'язаний webServer command.

**Repro:** `pnpm --filter @sergeant/web exec playwright test --config playwright.smoke.config.ts --project chromium`.

**Actual:** `Process from config.webServer was not able to start. Exit code: 1`, webServer stderr: `) was unexpected at this time.`

**Expected:** smoke webServer має стартувати на Windows PowerShell/cmd або мати documented Windows fallback.

**Suggested fix direction:** перевірити shell syntax у `webServer.command`; якщо там POSIX grouping/env assignment, замінити на `cross-env`/Node wrapper.

### P2 — Web build зелений, але має performance/build warnings

**Affected surface:** `apps/web` bundle.

**Repro:** `pnpm --filter @sergeant/web build`.

**Actual:** build проходить, але Vite попереджає про chunks >500 KB (`index`, `vendor`, `vendor-zxing`) і `INEFFECTIVE_DYNAMIC_IMPORT`: `src/core/profile/ProfilePage.tsx` dynamic import у `useRoutePrefetch.ts` не code-split'иться, бо також є static import через `src/core/profile/index.ts`.

**Expected:** релізний build зелений без P0 browser-external warnings; performance warnings не блокують release, але мають власну чергу.

**Suggested fix direction:** після тестових P1 окремо розібрати chunking, ProfilePage import graph і lazy route boundaries.

## Surface coverage

### Web shell / PWA

Build-level PWA coverage зелений: `manifest.webmanifest`, service worker і assets збираються. Ручний browser UX matrix (`1440x900`, `768x1024`, `390x844`, `320x700`) не був чесно виконаний через missing Playwright browser і малий диск; screenshots/visual diffs не створені як evidence продуктового UI.

### Auth / onboarding

Automated smoke через Playwright не стартував. Targeted mobile onboarding suites зелені: `OnboardingWizard.test.tsx` і `identifyTraits.test.ts` разом дали `17 passed`. Reset password screen входить у web build chunks, але ручний browser flow не підтверджений.

### Hub / modules / HubChat

Runtime browser flows для Hub, Finyk, Fizruk, Routine, Nutrition, HubChat не пройдені в цьому локальному середовищі через Playwright/browser blocker. Unit/integration рівень показує два реальні gate-ризики: web storage test harness і mobile Finyk Transactions provider wrapper.

### API / infra baseline

`@sergeant/server test` зелений: `128` test files, `1661` tests passed, `17` skipped. Негативні auth/env/push logs у server output виглядають очікуваними тестовими сценаріями, бо suite завершився pass.

### Native mobile sanity

`@sergeant/mobile typecheck` зелений. Full Jest не зелений через поєднання real TransactionsPage failures і локального OOM. Targeted onboarding/identifyTraits зелені, тому попередній audit item для onboarding async/identifyTraits не відтворився на цьому `main`.

## Decision-complete follow-up PR queue

1. **P1 Web test gate:** виправити Vitest storage/localStorage shim. Acceptance: `pnpm --filter @sergeant/web exec vitest run --reporter=dot --maxWorkers=1` проходить або лишає тільки незалежні documented failures.
2. **P1 Mobile Finyk test wrapper:** додати `ApiClientProvider`/test API client для `TransactionsPage`. Acceptance: targeted `TransactionsPage.test.tsx` зелений.
3. **P2 Mobile Jest reliability:** після provider fix повторити `pnpm --filter @sergeant/mobile exec jest --runInBand` під Node 20; закрити OOM/async `act()`/analytics leaks.
4. **P2 Playwright tooling:** відновити Chromium browser install у локальному/CI середовищі і виправити Windows smoke webServer syntax. Acceptance: `test:a11y`, `test:visual`, chromium smoke стартують і доходять до сторінок.
5. **P2 Manual UX pass:** після Playwright tooling повторити повну viewport/theme матрицю з screenshots для Auth, Hub, Finyk, Fizruk, Routine, Nutrition, HubChat.
6. **P2/P3 Web performance:** розібрати oversized chunks і ineffective `ProfilePage` dynamic import після того, як test gates знову зелені.
7. **P3 Local lint reproducibility:** повторити `pnpm lint` під Node 20 із достатнім диском; якщо все одно OOM, розбити turbo lint або підняти memory envelope.

## What not to fix in this audit PR

- Не змінювати product code без окремого implementation request.
- Не запускати `pnpm exec playwright install` на цій машині до звільнення диску: browser download значно більший за доступні ~151 MB.
- Не класифікувати Node 25 engine warnings як app regression; CI target лишається Node 20.
