# AI-coding improvements roadmap

**Статус:** in progress. Створено 2026-04-25 з ідей розмови про вайб-кодинг. Останнє оновлення: 2026-04-25 (Tier 1 + частина Tier 2 закриті, див. таблицю прогресу нижче).
**Скоуп:** репо-конвенції, playbooks, code markers, testing/preview infra. Це **не** про конкретні фічі продукту — це про **інфраструктуру для AI-агентів** (Devin, Cursor, Claude Code), які пишуть код у Sergeant.
**Принцип:** менший variance результатів + більше контексту в репо = швидше і якісніше виходять PR-и від AI.

---

## Прогрес (2026-04-25)

| Блок                                     | Статус         | PR                                                     | Notes                                                                                 |
| ---------------------------------------- | -------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1. `AGENTS.md` + repo-rules              | ✅ done        | [#714](https://github.com/Skords-01/Sergeant/pull/714) | + `.github/PULL_REQUEST_TEMPLATE.md` із секцією «How AI-tested this PR».              |
| 2. Playbooks (4 шаблони)                 | ⏳ pending     | —                                                      | Не зачіпали поки що.                                                                  |
| 3. Code markers + ESLint rule            | ✅ done        | [#715](https://github.com/Skords-01/Sergeant/pull/715) | Правило `sergeant-design/ai-marker-syntax` (warn) + 20 unit-тестів + реальні маркери. |
| 4. Vercel paid + preview-on-PR           | 🟡 not started | —                                                      | Потребує credentials/upgrade від мейнтейнера ($20/міс).                               |
| 5. Playwright E2E enabled on PR          | ✅ done        | [#717](https://github.com/Skords-01/Sergeant/pull/717) | Видалено блокуючий `needs: check`, додано Postgres service + кешування браузерів.     |
| 6. Visual regression (Argos / Chromatic) | ⏳ pending     | —                                                      | Залежить від блоку 5 (зроблено) і стабільного Vercel preview.                         |
| 7. Storybook                             | ⏳ pending     | —                                                      | Не зачіпали поки що.                                                                  |
| 8. Snapshot tests для server serializers | ✅ done        | [#718](https://github.com/Skords-01/Sergeant/pull/718) | Покрито `accountsHandler` + `transactionsHandler`; всі bigint-поля вже мали coercion. |

Додатково з `dev-stack-roadmap.md`: **Knip + depcheck** — ✅ done у [#716](https://github.com/Skords-01/Sergeant/pull/716) (видалено 6 файлів, 4 unused exports, 2 stale eslint entries).

---

## TL;DR

| #     | Блок                                                  | Effort   | Impact     | Залежності | Статус         |
| ----- | ----------------------------------------------------- | -------- | ---------- | ---------- | -------------- |
| **1** | `AGENTS.md` + repo-rules                              | пів дня  | висок      | —          | ✅ done (#714) |
| **2** | Playbooks (4 шаблони)                                 | 1 день   | висок      | блок 1     | ⏳ pending     |
| **3** | Code markers (`AI-NOTE`, `AI-DANGER`, `AI-GENERATED`) | пів дня  | середн     | —          | ✅ done (#715) |
| **4** | Vercel paid + preview-on-PR                           | 1 година | дуже висок | $20/міс    | 🟡 not started |
| **5** | Playwright E2E enabled on PR                          | 1 день   | висок      | блок 4     | ✅ done (#717) |
| **6** | Visual regression (Argos / Chromatic)                 | пів дня  | середн     | блок 5     | ⏳ pending     |
| **7** | Storybook                                             | 2 дні    | середн     | —          | ⏳ pending     |
| **8** | Snapshot tests для server-side serializers            | пів дня  | висок      | —          | ✅ done (#718) |

**Рекомендована черговість:** 4 → 1 → 3 → 8 → 2 → 5 → 6 → 7.
Логіка: 4 (Vercel) знімає найбільший денний pain. 1+3 — швидкі низько-ризикові wins. 8 — захист від класу регресій типу bigint→string (#708). 2 формалізує повторювані задачі. 5+6+7 — більш дорогі infra-інвестиції.

**Реальний порядок виконання (2026-04-25):** 1 → 8 → 5 → 3 (паралельно з Knip/depcheck). 4 (Vercel paid) пропущено через відсутність credentials — це створило rate-limit на preview deploy у CI блоку 5, але smoke-тести запускаються проти локально стартанутого Vite preview всередині CI job-а, тому сам блок 5 розблокувати вдалося.

---

# Блок 1. Repo-level rule-файли ✅ implemented (#714)

## 1.1. `AGENTS.md` (новий файл у корені репо)

**Статус:** ✅ створено у [PR #714](https://github.com/Skords-01/Sergeant/pull/714). Файл живе у `/AGENTS.md`. Факти верифіковані проти реального стану репо (pnpm 9, Turbo, 4 apps, 9 packages, RQ keys factories `finykKeys`/`hubKeys`/`nutritionKeys`/`coachKeys`/`digestKeys`/`pushKeys` у `apps/web/src/shared/lib/queryKeys.ts`, міграції 001–008). Має бути reviewed quarterly (last-reviewed-line у самому файлі).

**Що це:** конвенція Anthropic / Cursor / Devin — markdown-файл у корені репо з правилами **тільки для AI-агентів**. Усі сучасні coding-AI його читають автоматично.

**Структура (приклад для Sergeant):**

```markdown
# Agents in Sergeant

## Repo overview

- pnpm 9 + Turborepo monorepo, Node 20, TS 6
- Apps: web (Vite + React 18 SPA), server (Express + PG + Better Auth), mobile (Expo), mobile-shell (Capacitor)
- Packages: @sergeant/shared, @sergeant/api-client, 4× domain packages

## Hard rules (do not break)

1. **DB types**: `pg`-driver returns `bigint` as **string**. Завжди коерсити в `number` у serializer-і (див. #708).
2. **RQ keys**: тільки через `finykKeys.*` / `hubKeys.*` / `nutritionKeys.*`. Ніколи не пиши hardcoded `["finyk", ...]`.
3. **API contract**: при зміні response-shape у `apps/server/src/modules/*` обов'язково онови типи в `packages/api-client/src/endpoints/*` І додай test.
4. **SQL міграції**: порядкові, без gaps, обов'язково entry в `schema_migrations`. Файли `apps/server/src/migrations/NNN_*.sql`. Pre-deploy job копіює їх через `apps/server/build.mjs` (виправлено в #704).
5. **Feature flags**: при додаванні флагу — onov`docs/feature-flags.md` (якщо є) і додай тест на default branch.
6. **Conventional Commits**: `feat(scope):`, `fix(scope):`, `docs(scope):`, `chore(scope):`. Scope — назва пакета без `@sergeant/` prefix.
7. **No force push to main/master.** Force-with-lease на feature-branch ОК.
8. **Pre-commit hooks** через Husky — не skip-уй (`--no-verify` заборонено).

## Soft rules (preferred)

- Branch naming: `devin/<unix-ts>-<short-area>-<desc>`. Приклад: `devin/1777137234-mono-bigint-coercion`.
- Тести поряд з кодом: `foo.ts` + `foo.test.ts` у тій самій папці (Vitest).
- Імпорти через path aliases (`@shared/*`, `@finyk/*`), а не relative `../../../`.
- Dependency-bumps — окремі PR-и (не змішуй з фічами).
- Видаляєш файл — спочатку `grep` його імпортів по всьому монорепо.

## Verification before PR

- `pnpm lint` — has to be green.
- `pnpm typecheck` — has to be green.
- `pnpm --filter <package> exec vitest run <path>` — для зачеплених тестів.
- При зміні DB / API: `apps/server` тести зелені.
- При зміні UI: візьми screenshot, додай у PR description.

## Deployment

- Frontend: Vercel (preview-deploy на кожен PR; на free tier іноді rate-limit-ить).
- Backend: Railway через `Dockerfile.api`. Pre-deploy: `pnpm db:migrate`. Health: `/health`.
- Migrations потребують `MIGRATE_DATABASE_URL` env (= public DB URL).

## Pre-existing flaky tests (не блокують merge)

- `apps/mobile/src/core/OnboardingWizard.test.tsx`
- `apps/mobile/src/core/dashboard/WeeklyDigestFooter.test.tsx`
- `apps/mobile/src/core/settings/HubSettingsPage.test.tsx`

Ці три падають на main, не зважай якщо твій PR не торкає `apps/mobile`.

## Test users

- `I3BUW5atld8oOHM7lpFEJBIInpW1hzv7` — головний test user, 6 Monobank-акаунтів, ~2246 ₴ на UAH-картках.

## See also

- `docs/monobank-roadmap.md`
- `docs/monobank-webhook-migration.md`
- `docs/frontend-tech-debt.md`, `docs/backend-tech-debt.md`
```

**Перевірка:** AI відкриває репо → читає `AGENTS.md` → не повторює помилки які я ловив у попередніх PR-ах.

---

## 1.2. `.cursor/rules/*.md` (опціонально)

Якщо хтось у команді користує **Cursor IDE** — Cursor читає `.cursor/rules/<name>.mdc` файли з frontmatter:

```yaml
---
description: Database serializer rules
globs:
  - "apps/server/src/modules/**/*.ts"
alwaysApply: false
---
When writing Postgres serializers in this directory:
  - Coerce bigint columns to numbers via `toNumberOrNull(...)`.
  - ...
```

Це же саме що `AGENTS.md`, але **scoped** до конкретних файлів. Для Sergeant корисно зробити 3-4:

- `db-serializers.mdc` (apps/server/src/modules/\*\*)
- `react-query.mdc` (apps/web/src/\**/*hook*.ts*)
- `migrations.mdc` (apps/server/src/migrations/\*\*)
- `domain-packages.mdc` (packages/\*-domain/src/\*\*)

**Не обов'язково** — `AGENTS.md` покриває більшість випадків. Але якщо у команді є Cursor-юзери — зручно.

---

## 1.3. Перевірка та maintenance

`AGENTS.md` має staleness-проблему: правила застарівають разом з кодом. Контрзаходи:

- **CODEOWNERS-style** — у самому `AGENTS.md` секція «Last reviewed: 2026-XX-XX. Reviewer: @username». Раз на квартал перевіряти.
- **GitHub Action** на лінк-чек у markdown (link-rot prevention).
- При закритті PR з permanent-зміною (нова DB-table, новий env var) — додати правило в `AGENTS.md`. Можна сформулювати як обов'язкову колонку в PR template-і: «Чи треба оновити `AGENTS.md`? [yes/no/n/a]».

---

# Блок 2. Playbooks (повторювані задачі)

## 2.1. Що таке playbook

JSON / markdown recipe для **типової задачі** з фіксованим протоколом виконання. Devin підтримує `playbook-<uuid>` — імпортуються через UI, потім викликаються типу «зроби playbook X для модуля Y». Скорочують variance і кожна нова сесія не вигадує колесо.

## 2.2. Кандидати playbook-ів для Sergeant

### `add-monobank-event-handler.md`

**Тригер:** «додай новий тип Monobank webhook event» / «обробляти ще один тип статусу транзакції».

**Кроки:**

1. Знайти DTO в `apps/server/src/modules/mono/types.ts`. Додати новий case.
2. Оновити zod-schema у `http/schemas.ts`.
3. Додати handler-гілку в `webhook.ts`.
4. Оновити migration якщо нове поле в БД (новий файл `NNN_mono_*.sql`).
5. Тест-кейс у `webhook.test.ts` (вкладений payload + assert щодо БД-стану).
6. Інтегрувати в `read.ts` (serialize нового поля з coerce).
7. Onov`monobank-webhook-migration.md`.

### `hotfix-prod-regression.md`

**Тригер:** «прод впав / користувач скаржиться».

**Кроки:**

1. Підтвердити symptom (curl prod / Sentry / Railway logs).
2. Локалізувати через grep + git log.
3. Створити hotfix-branch з main: `devin/<ts>-hotfix-<desc>`.
4. Мінімальний diff (без "while we're here" рефакторингу).
5. Test repro у Vitest.
6. PR + fast-track CI (skip flaky тести explicit-но).
7. Merge → spostet 30 хв.
8. Postmortem-нотатка в `docs/postmortems/YYYY-MM-DD-*.md`.

### `add-feature-flag.md`

**Тригер:** «зробити X за фіче-флагом».

**Кроки:**

1. Додати entry в `apps/web/src/core/lib/featureFlags.ts` з `defaultValue: false`, `experimental: true`.
2. Documenent в `docs/feature-flags.md` (створити якщо нема): name, owner, expires, rollout-plan.
3. Розгалуження в коді через `useFlag("name")`.
4. Тест на обидва branch-и (on/off).
5. PR. У описі: критерії rollout (default → true), critical metric для моніторингу.

### `bump-dep-safely.md`

**Тригер:** «оновити X до версії Y».

**Кроки:**

1. `pnpm up <pkg> --recursive` (або точніше `--filter`).
2. `pnpm install` → проміж test з'їде в lockfile-diff?
3. `pnpm build && pnpm test` локально.
4. Прочитати CHANGELOG між старою/новою версією — breaking changes?
5. Screenshot key-pages якщо UI-залежний пакет.
6. PR з list breaking changes у description.

### `cleanup-dead-code.md`

**Тригер:** «видали X і всі його використання».

**Кроки:**

1. `grep -rn "<symbol>"` по монорепо.
2. Видалити імплементацію + усі імпорти.
3. Видалити тести та fixtures.
4. Чи покривав цей код feature-flag? Якщо так — видалити флаг теж.
5. Чи покривала цей код документація? Update.
6. `pnpm lint && pnpm typecheck && pnpm test`.
7. PR з summary рядків видалених.

## 2.3. Як їх запустити

Два варіанти:

- **A.** Зберегти як `.md` файли в `docs/playbooks/*.md`. AI читає їх коли triggered. Простіше, але без GUI.
- **B.** Імпортувати у Devin webapp через `Playbooks` секцію — вони отримають `playbook-<uuid>` і можна викликати з чату «follow playbook X».

Рекомендую починати з **A** (markdown в репо). Якщо команда буде активно використовувати — мігрувати у B.

---

# Блок 3. Code markers (структуровані коментарі) ✅ implemented

## 3.1. Маркери що варто впровадити

### `// AI-NOTE: <text>`

Підказка для майбутнього AI-агента. Це **не** TODO для людини — це контекстна інформація.

```ts
// AI-NOTE: This serializer must coerce bigint→number; see docs/AGENTS.md rule #1
function toRow(r: DbRow): ApiRow { ... }
```

### `// AI-DANGER: <text>`

Зони підвищеного ризику — AI повинен запросити підтвердження перед зміною.

```ts
// AI-DANGER: changing this will break webhook secret validation. Coordinate with secret-rotation flow.
const validateSignature = (payload, secret) => { ... }
```

### `// AI-GENERATED: <generator>`

Файл генерується. Не редагуй вручну — онови генератор.

```ts
// AI-GENERATED: from packages/api-client/src/codegen.ts. Do not edit.
export const ENDPOINTS = { ... };
```

### `// AI-LEGACY: <expires-date>`

Тимчасовий код що буде видалений. Допомагає cleanup-PR-ам.

```ts
// AI-LEGACY: expires 2026-06-01. Auto-migrates `finyk_token` from localStorage to server.
function migrateLegacyToken() { ... }
```

## 3.2. Lint-rule ✅ implemented

ESLint-rule `sergeant-design/ai-marker-syntax` додано у `eslint-plugins/sergeant-design/index.js`. Підключено в `eslint.config.js` як `"warn"`. Unit-тести: `eslint-plugins/sergeant-design/__tests__/ai-marker-syntax.test.mjs`.

Можна (опціонально) додати ESLint-rule яка валідує синтаксис маркерів — щоб не було typo-варіацій (`AI-NOTES`, `AINOTE`, `AI_NOTE`). Custom плагін `eslint-plugins/sergeant-design/` вже є — додати правило туди.

```js
// eslint-plugins/sergeant-design/rules/ai-marker.js
module.exports = {
  meta: { type: "suggestion", schema: [] },
  create(context) {
    return {
      Program() {
        const sourceCode = context.getSourceCode();
        const text = sourceCode.getText();
        const malformed = text
          .match(/\/\/\s*AI[_\s]?(NOTES?|DANGERS?|GENERATED|LEGACY)/gi)
          ?.filter((m) => !m.match(/^\/\/ AI-(NOTE|DANGER|GENERATED|LEGACY):/));
        if (malformed?.length) {
          context.report({ message: `Malformed AI marker: ${malformed[0]}` });
        }
      },
    };
  },
};
```

## 3.3. Convention для PR template ✅ implemented (#714)

**Статус:** ✅ `.github/PULL_REQUEST_TEMPLATE.md` створено у [PR #714](https://github.com/Skords-01/Sergeant/pull/714) з секціями `How AI-tested this PR` і `AGENTS.md updated?`.

Доповнити `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## How AI-tested this PR

- [ ] Manual smoke (which flow?): ...
- [ ] Vitest passes: ...
- [ ] No new `AI-DANGER` markers added without justification.

## AGENTS.md updated?

- [ ] Yes — link to changed line(s)
- [ ] No — no new permanent rules
```

Цей блок дає видимість «що саме AI перевірив» і змушує бути конкретним.

## 3.4. JSDoc convention

Існуючі JSDoc-теги що допомагають AI:

- `@since v.X.Y` — для cleanup tracking.
- `@deprecated <reason>` — кандидати на видалення (видно у IDE strikethrough).
- `@experimental` — попередження.
- `@throws {ApiError}` — щоб AI знав edge cases.

Додати до style guide: великі функції (>50 рядків) обов'язково мають JSDoc.

---

# Блок 4. Testing & preview infra

Найбільш expensive частина roadmap-а, але саме тут найбільший AI-multiplier.

## 4.1. Vercel paid plan ($20/міс)

**Pain:** на free tier preview-deploy постійно ловить «Deployment rate limited — retry in 24 hours» (бачив у #705, #708, #709). Без preview AI не може візуально валідувати фронт-зміни — все іде через blind merge.

**Cost:** $20 USD / місяць.

**Win:** preview-deploy на кожен PR → AI робить screenshot → attach у PR description → user перевіряє візуально перед merge. Економія 1+ година на тиждень мінімум.

**Альтернатива (free):** self-host preview через Railway. Але:

- Більше setup-work (preview-environment per PR, webhook між GitHub і Railway).
- Cold-start ~30 сек.
- Не вирішує rate-limit на головному preview-домені.

Рекомендую paid Vercel.

## 4.2. Playwright E2E на PR ✅ implemented (#717)

**Статус:** ✅ enabled у [PR #717](https://github.com/Skords-01/Sergeant/pull/717).

**Root cause skipped-стану:** job `Smoke E2E (Playwright)` мав `needs: check`, який не виконувався на більшості PR. Виправлено: dependency знято, додано PostgreSQL service container, Playwright browser caching, явний старт Vite preview-сервера всередині job-а (щоб обійти Vercel free-tier rate-limit). Доданий smoke-тест: `apps/web/tests/smoke/dashboard-health.spec.ts`. Job тепер біжить на КОЖЕН PR і завантажує `playwright-report` як artifact.

**Caveat:** оскільки Vercel preview rate-limit-иться (free tier), тести працюють проти локального preview, а НЕ проти Vercel deployment. Це достатньо для catastrophic-regression detection, але не покриває edge-cases SSR/Vercel-specific behavior. Для цього треба блок 4.1 (Vercel paid).

**Поточний стан:** у вас уже є job `Smoke E2E (Playwright)` у CI workflow, але він `skipped` (бачу в pr_checks #708). Чому skipped — треба з'ясувати (можливо `if: ...` condition не виконується для всіх PR).

**Рекомендований happy-path test set:**

1. Login → Dashboard → бачимо віджети без помилок у console.
2. Finyk → connect Monobank token (mock) → бачимо балансу > 0.
3. Routine → створити habit → відмітити виконання сьогодні.
4. Settings → toggle feature flag → бачимо ефект.
5. Logout → login again → state preserved.

**Інфраструктура:**

- Playwright-server бере preview-URL з Vercel (потребує блок 4.1).
- Test-user fixture в isolated test-DB (не торкаємо prod).

**Win:** будь-яка catastrophic регресія (crash на login, blank page, 500 на головному API) ловиться в CI до merge.

## 4.3. Visual regression (Argos / Chromatic / Percy)

**Що це:** на кожен PR робить screenshot key-сторінок і порівнює з baseline. Visual diff показує `pixel-diff: 12.3% — see attached`.

**Кандидати інструментів:**

- **Argos** — open-source, free для < 5K screenshots/міс. Інтеграція через `@argos-ci/playwright`.
- **Chromatic** — paid, інтегрований з Storybook. $149/міс.
- **Percy** — BrowserStack-owned, 5K screenshots free.

Argos рекомендую — найкращий fit для open-source workflow.

**Налаштування:**

1. `pnpm add -D @argos-ci/playwright`.
2. У Playwright tests: `await argosScreenshot(page, 'dashboard');`.
3. CI step: `npx argos upload`.
4. PR check: візуальний diff inline.

**Win:** AI робить CSS-зміну — якщо випадково розламав інший компонент, baseline diff це ловить. Без цього такі регресії вилазять у user-bug-reports тижнями пізніше.

## 4.4. Storybook

**Чому:** AI може будувати компонент в isolation, без запуску повного додатку. Швидше iterations + ловить пропси-edge-cases.

**Setup для Sergeant:**

- `pnpm add -D @storybook/react-vite @storybook/addon-essentials`.
- `pnpm storybook init` у `apps/web` (Vite preset).
- Stories для key-компонентів: `Card`, `Modal`, `Form`, `Hub*Section`.
- Декоратор з QueryClient + ThemeProvider (для працездатності хуків).

**Альтернатива:** **Histoire** (Vite-native, легший за Storybook). Якщо команда не використовує Storybook ніде ще — Histoire може бути швидшим стартом.

**Cost:** ~2 робочих дні на initial setup + ~10 хв на новий story.

**Win:** AI prototypes UI-компонент за 5 хв замість 30. Visual regression (4.3) автоматично покриває всі stories.

## 4.5. Snapshot tests для server-side serializers ✅ implemented (#718)

**Статус:** ✅ покрито у [PR #718](https://github.com/Skords-01/Sergeant/pull/718) — `accountsHandler` і `transactionsHandler` у `apps/server/src/modules/mono/read.ts`. Snapshot-файл: `apps/server/src/modules/mono/__snapshots__/read.test.ts.snap`. Бонус: під час review перевірено всі bigint-колонки → coercion вже на місці (новий клас регресій #708 не знайдений). JSDoc на `toNumberOrNull` розширено.

**Контекст:** баг #708 (bigint→string) виглядав так: API повернув правильні значення, але типи не відповідали контракту. Unit-тест на shape ловить це.

**Імплементація:**

```ts
// apps/server/src/modules/mono/read.test.ts
it("accountsHandler response shape matches snapshot", async () => {
  queryMock.mockResolvedValueOnce({
    rows: [
      /* fixture */
    ],
  });
  const res = makeRes();
  await accountsHandler(makeReq(), res);
  expect(res.body).toMatchSnapshot();
});
```

При зміні shape — snapshot треба explicit-но оновити (`vitest -u`), що змусить автора подивитись на diff і подумати «чи не зламаю я цим клієнт?».

**Win:** клас регресій типу #708 неможливий у принципі — diff snapshot-у б'є по очах в CI.

**Cost:** годин 4-6 на покриття всіх endpoint-ів `/api/*`.

---

# Блок 5. Метрики successу

Якщо впровадити блоки 1-7, як зрозуміти що це допомогло?

| Метрика                                    | Baseline (зараз) | Target (через 3 міс) |
| ------------------------------------------ | ---------------- | -------------------- |
| Time-to-PR (chat → open)                   | ~30 хв           | ~15 хв               |
| CI-fail-rate першої спроби                 | ~50%             | ~20%                 |
| % PR-ів від AI які revert-нули             | ~5%              | ~2%                  |
| Recurring bugs (regressions of fixed bugs) | n/a              | track                |
| AGENTS.md staleness (дні з last review)    | n/a              | < 90                 |

Інструмент: можна писати ці метрики у `docs/ai-metrics.md` раз на тиждень руками. Або PostHog (якщо там tracked).

---

# Implementation order (concrete checklist)

1. [~] **Tier 1 (тиждень 1):** 3/4 done
   - [ ] Vercel paid plan upgrade — потребує credentials від мейнтейнера
   - [x] `AGENTS.md` створення з розділами вище — [#714](https://github.com/Skords-01/Sergeant/pull/714)
   - [x] PR template update з блоком «How AI-tested» — [#714](https://github.com/Skords-01/Sergeant/pull/714)
   - [x] Snapshot tests для `apps/server/src/modules/mono/read.ts` (accountsHandler + transactionsHandler) — [#718](https://github.com/Skords-01/Sergeant/pull/718)
2. [~] **Tier 2 (тиждень 2-3):** 2/3 done
   - [x] AI markers convention + ESLint rule — [#715](https://github.com/Skords-01/Sergeant/pull/715)
   - [ ] Playbooks `hotfix-prod`, `add-feature-flag`, `cleanup-dead-code`
   - [x] Activate Playwright E2E на PR — [#717](https://github.com/Skords-01/Sergeant/pull/717)
3. [ ] **Tier 3 (місяць 2):**
   - [ ] Argos візуальна регресія
   - [ ] Storybook (або Histoire) для shared components
   - [ ] Knowledge notes для прод-environment, тест-юзерів, flaky tests
4. [ ] **Maintenance:**
   - [ ] Quarterly `AGENTS.md` review reminder (next due: 2026-07-25)
   - [ ] Monthly metrics check

---

# Відкриті питання

1. Чи команда хоче інвестувати $20/міс у Vercel? (блок 4.1) — без цього багато наступних кроків мають слабший ROI.
2. Який E2E-фреймворк? Playwright уже є у CI — продовжуємо. Якщо хочемо щось одне на web+mobile — рекомендував би **Detox** для mobile + Playwright для web (вже так і є).
3. Storybook vs Histoire? Якщо ніхто не використовував Storybook — Histoire дешевше.
4. Маркери — як часто перевіряти, чи `AI-LEGACY` дати закінчилися? Окремий cron-script у CI?

---

# Session log

## 2026-04-25 — інфра-спринт (8 PR, 4 з 8 блоків закрито)

| PR                                                     | Що                                                                       | Блок          |
| ------------------------------------------------------ | ------------------------------------------------------------------------ | ------------- |
| [#714](https://github.com/Skords-01/Sergeant/pull/714) | `AGENTS.md` + PR template "How AI-tested"                                | 1             |
| [#715](https://github.com/Skords-01/Sergeant/pull/715) | AI markers + ESLint rule `sergeant-design/ai-marker-syntax`              | 3             |
| [#716](https://github.com/Skords-01/Sergeant/pull/716) | Knip + depcheck + cleanup (бонус з `dev-stack-roadmap` #2)               | (bonus)       |
| [#717](https://github.com/Skords-01/Sergeant/pull/717) | Activate Playwright E2E на PR                                            | 4.2 / dev #12 |
| [#718](https://github.com/Skords-01/Sergeant/pull/718) | Snapshot tests `accountsHandler` + `transactionsHandler`                 | 4.5 / dev #10 |
| [#719](https://github.com/Skords-01/Sergeant/pull/719) | Оновлення roadmap-ів зі статусом                                         | (meta)        |
| [#720](https://github.com/Skords-01/Sergeant/pull/720) | Fix `vitest.base.ts` ESM bug (розблокувало `pnpm test` для всіх пакетів) | (infra)       |
| [#721](https://github.com/Skords-01/Sergeant/pull/721) | Renovate config (заміна Dependabot, dev-stack #7)                        | (bonus)       |

### Що з блоків 1-8 цього документа залишилось

| Блок | Статус             | Наступний крок                                                                                       |
| ---- | ------------------ | ---------------------------------------------------------------------------------------------------- |
| 1    | ✅ done            | Quarterly review reminder (next due: 2026-07-25)                                                     |
| 2    | ⏳ pending         | Створити 4 playbook-и (`hotfix-prod`, `add-feature-flag`, `cleanup-dead-code`, `add-domain-package`) |
| 3    | ✅ done            | Додавати маркери поступово при роботі з legacy-кодом                                                 |
| 4    | 🟡 not started     | Потребує credentials мейнтейнера ($20/міс Vercel Pro)                                                |
| 5    | ✅ done            | Workflow: Smoke E2E (#717). Visual regression (Argos) — далі                                         |
| 6    | ⏳ pending         | Argos / Chromatic — після стабільного preview deploy (блок 4)                                        |
| 7    | ⏳ pending         | Storybook або Histoire — окрема велика задача                                                        |
| 8    | ✅ done (частково) | Покриті 2 endpoint-и Mono. Решта endpoint-ів — поступово                                             |

### Bonus відкриття під час спринту

- **`vitest.base.ts` ESM bug ([#720](https://github.com/Skords-01/Sergeant/pull/720))** — `pnpm test` був повністю зламаний на main з commit `dab67bdc`. Native Node ESM loader не вміє резолвити `.ts` через package exports. Конвертовано у `.js` з JSDoc-типами. Це регресія яку б ловив CI з блоку 4.5, якби він був повністю налаштований до того.
- **AGENTS.md без prettier ([#719](https://github.com/Skords-01/Sergeant/pull/719))** — фідбек для майбутніх AI-сесій що створюють docs: завжди прогнати `prettier --write` перед commit-ом.

### Метрики (з блоку 5 цього документа) — оновлення

| Метрика                                 | Baseline (до сесії)   | Зараз                                                                        |
| --------------------------------------- | --------------------- | ---------------------------------------------------------------------------- |
| Time-to-PR (chat → open)                | ~30 хв                | без замірів (потребує телеметрії)                                            |
| CI-fail-rate першої спроби              | n/a (CI був зламаний) | потребує спостереження кілька PR-ів                                          |
| % PR-ів від AI які revert-нули          | n/a                   | 0 / 8 за цей спринт                                                          |
| Recurring bugs                          | n/a                   | track via [#708](https://github.com/Skords-01/Sergeant/issues/708) reference |
| AGENTS.md staleness (дні з last review) | n/a                   | 0 (last review: 2026-04-25)                                                  |

---

# Поза скоупом цього документа

- Knowledge notes (це окремо — вже згадано у попередньому повідомленні чату).
- MCP-інтеграції (Sentry, Linear, PostHog — окрема дискусія).
- Schedules (cron-задачі у Devin) — окремо.
- Метрики тelемerры в Datadog/Prometheus — інший roadmap.
