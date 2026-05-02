# Changelog

> **Last validated:** 2026-05-02 by @Skords-01. **Next review:** 2026-07-31.
> **Status:** Active

Усі помітні зміни проєкту документуються тут.

Формат — [Keep a Changelog](https://keepachangelog.com/uk/1.1.0/),
версіювання — [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Автоматизація:** проєкт використовує Conventional Commits + commitlint.
> Наступний крок — підключити автоматичну генерацію changelog
> (наприклад, `changesets` або `conventional-changelog-cli`).

## [Unreleased]

### Fixed

- **Railway: hub-api Docker-build падав на `Could not resolve "@sergeant/db-schema/pg"`.**
  Після того як `apps/server` отримав залежність від workspace-пакета
  `@sergeant/db-schema` (Drizzle ORM wiring), `Dockerfile.api` залишився
  без оновлення: ні `packages/db-schema/package.json`, ні самих джерел
  не копіювалось у builder-стейдж, у `pnpm install` не було
  `--filter @sergeant/db-schema...`, а `tsc -p tsconfig.build.json`
  для db-schema не виконувався до серверного `pnpm build`. Як
  наслідок, кожен Railway-deploy main-гілки падав на esbuild-resolve
  в `apps/server/src/modules/waitlist/waitlistService.ts:5`. Старий
  образ продовжував обслуговувати трафік, нові міграції/код — ні,
  а юзер на `/sign-in` отримував 5xx (тепер рендериться як
  «Сервер тимчасово недоступний» завдяки фіксу translateAuthError).
  Тепер builder копіює `packages/db-schema` повністю, ставить його
  у `pnpm install --filter`, виконує `pnpm --filter @sergeant/db-schema build`
  до `pnpm build` сервера; runtime отримує лише `package.json`-маніфест
  (esbuild bundle уже містить db-schema).
- **Auth: «Помилка входу» без деталей при rate-limit / 5xx.** На сторінці
  входу після кількох невдалих спроб (або 500-серверної помилки) юзер
  бачив generic рядок `Помилка входу` замість осмисленого повідомлення.
  Корінь — два бекенд-респонси (`apps/server/src/http/errorHandler.ts`
  і `apps/server/src/http/rateLimit.ts`) повертали тільки поле `error`,
  тоді як Better Auth client (`better-fetch`) читає `message` при
  десеріалізації не-2xx body, тож на фронт приходило
  `result.error.message === undefined`. Тепер обидва респонси дублюють
  значення в полях `error` **та** `message` (back-compat). Паралельно
  переписав `translateAuthError` у `apps/web/src/core/auth/AuthContext.tsx`
  — тепер мапимо за стабільним Better Auth `error.code`
  (`INVALID_EMAIL_OR_PASSWORD`, `USER_ALREADY_EXISTS`, `RATE_LIMIT`,
  `INTERNAL`, …), а не парсимо англійський `message` regex-ами. Це
  заодно виправило фальш-збіг `/invalid email/i` усередині
  `"Invalid email or password"`, через який юзер з неправильним
  паролем бачив «Невірний формат email.».

### Added

- **AI memory: retrieval layer (PR3 of ADR-0028).** Завершує цикл pgvector
  AI memory після foundation (PR1) і ingestion (PR2). Додає три entry-points:
  (a) HubChat tool `recall_memory` — Anthropic-асистент може explicit-but
  попросити top-K схожих memories через нову async-action гілку
  (`ASYNC_CHAT_ACTION_NAMES` whitelist у
  `apps/web/src/core/lib/chatActions/serverActions.ts` — щоб не ламати sync-tests
  інших tool-ів). (b) `POST /api/ai-memory/recall` — sync read-path
  (`apps/server/src/modules/ai-memory/recallRoute.ts`), 401 без сесії, 503 при
  `AI_MEMORY_ENABLED=false` / `MissingVoyageApiKeyError` / `VoyageHttpError(5xx)`,
  400 на невалідний payload (empty query, oversized, top_k>50, unknown source).
  (c) RAG-injection у `/api/chat` (`ragContext.buildRagContext()`) — implicit
  augmentation на першому турі (НЕ на tool-result-турі) з top-K
  `AI_MEMORY_RAG_TOP_K=4`, timeout 1500ms, graceful no-op на будь-яку помилку
  щоб Anthropic-call ніколи не валився через RAG. Master-flag `AI_MEMORY_ENABLED`
  лишається керівником: при `false` обидві гілки no-op-лять без HTTP-викликів
  до Voyage/БД. `recall_memory` додано у `ASSISTANT_CAPABILITIES` (єдиний
  source-of-truth для tool-ів) → автоматично потрапляє у "Пам'ять"-список
  SYSTEM_PROMPT, тому `SYSTEM_PROMPT_VERSION` піднято з `v6` до `v7`. Доку оновлено
  у [`docs/integrations/voyage-pgvector.md`](./docs/integrations/voyage-pgvector.md)
  і [`docs/adr/0028-pgvector-ai-memory.md`](./docs/adr/0028-pgvector-ai-memory.md).

- **CI: container image scan (Trivy).** Новий workflow
  `.github/workflows/container-scan.yml` збирає `Dockerfile.api` і
  сканує отриманий образ на CVE рівнів CRITICAL/HIGH; SARIF
  завантажується в GitHub Code Scanning (`category: trivy-image`) і
  доступний як артефакт. Тригери: PR (на зміни Dockerfile / serverside
  пакетів), push to main, schedule (04:00 UTC) і workflow_dispatch.
  Триаж — див. [`docs/security/container-scan.md`](./docs/security/container-scan.md).

### Changed

- **Web: strict TS rollout — Phase 2.** `apps/web/tsconfig.strict.json`
  розширено з `src/shared/**` до 10 директорій
  (`src/shared`, `src/test`, `src/core/{auth, cloudSync, components,
hints, hooks, observability, pricing, profile}`). Cross-file
  SpeechRecognition type-collision між `useSpeech.ts` та
  `VoiceMicButton.tsx` виправлено зняттям глобальної
  `declare global Window` augmentation на користь приватного
  `WindowWithSpeech` cast у `useSpeech.ts`. Жодних змін у runtime-коді,
  лише типи + один тестовий null-guard у
  `useCloudSync.behavior.test.ts`. Деталі — у
  [`docs/tech-debt/frontend.md`](./docs/tech-debt/frontend.md) §11.
