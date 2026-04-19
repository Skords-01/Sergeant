# Backend Tech Debt Inventory

> Scope: `server/` (Node.js 20 ESM, Express 4, PostgreSQL, Better Auth, Anthropic, Monobank/Privat, web-push, Pino, Prometheus, Sentry).
>
> Методологія: пофайловий аудит + зведення по категоріях. Перший PR — лише цей документ. Виправлення йдуть окремими тематичними PR (A–E, див. Roadmap).
>
> **Status update (refresh):** з моменту створення цього документу реалізовано P0-A–P0-E (див. [Status log](#status-log)). Поточний залишок P0 — нульовий; актуальні блокери в категорії «Банки» і «AI-квоти» закриті, web-push тепер з timeout/retry/breaker. Решта — P1/P2.
>
> Позначки:
>
> - **Блокер** — реальний ризик (race condition, leak, відсутність timeout на зовнішній HTTP).
> - **Високий** — помітний борг (валідація обходить центральну схему, дублювання логіки, широкий catch).
> - **Середній** — косметика / consistency (нейм, дрібні оптимізації).
> - **Низький** — nice-to-have.

## Зміст

1. [Summary — per-category](#summary--per-category)
2. [Per-file findings](#per-file-findings)
3. [Consolidated issue groups](#consolidated-issue-groups)
4. [Bank integrations deep-dive](#bank-integrations-deep-dive)
5. [AI quota deep-dive](#ai-quota-deep-dive)
6. [Database & migrations review](#database--migrations-review)
7. [Observability & logging review](#observability--logging-review)
8. [Secret-logging audit](#secret-logging-audit)
9. [Tests coverage map](#tests-coverage-map)
10. [Gradual TypeScript migration plan](#gradual-typescript-migration-plan)
11. [Roadmap — PR breakdown](#roadmap--pr-breakdown)

---

## Summary — per-category

| Категорія               | Статус               | Короткий висновок                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Валідація (zod)         | ~~Високий~~ → **OK** | ✅ PR A. `RefinePhotoSchema` синхронізована з handler-ом (`prior_result`/`portion_grams`/`qna`). `mono`/`privat`/`sync` використовують централізовані `*QuerySchema`/`*BodySchema`. Ручна перевірка `req.body` не знайдена у `server/` (grep `req\.body\.` поза `validate*` → 0).                                                                                                                         |
| Error handling          | ~~Високий~~ → **OK** | ✅ PR A. Широкі `catch { res.status(500).json({ error: e.message }) }` не знайдені (grep `catch\s*\([^)]*\)\s*\{[^}]*res\.(status\|json)` у `server/` → 0). Усі handler-и йдуть через `asyncHandler` + `ExternalServiceError`/`ValidationError`/`RateLimitError` + central `errorHandler`.                                                                                                                |
| Банки (mono/privat)     | ~~Блокер~~ → **OK**  | ✅ PR B. `server/lib/bankProxy.ts` — timeout=15s (`BANK_FETCH_TIMEOUT_MS`), retry з jitter (5xx/timeout/network, respect `Retry-After`), circuit breaker 5-fails / 30s per-upstream, TTL-cache 60s для GET. `mono.ts`/`privat.ts` — тонкі адаптери.                                                                                                                                                       |
| Web-push (sendPush)     | ~~Блокер~~ → **OK**  | ✅ [PR #335](https://github.com/Skords-01/Sergeant/pull/335). `server/lib/webpushSend.ts` — timeout=10s (AbortController+Promise.race), retry [0, 500ms+jitter] на 5xx/timeout, per-origin circuit breaker 5-fails / 30s (FCM/Apple/Mozilla ізольовані). Outcome-класифікація: `ok`/`invalid_endpoint`/`rate_limited`/`timeout`/`circuit_open`/`error` → `external_http_requests_total{upstream="push"}`. |
| AI-квоти                | ~~Високий~~ → **OK** | ✅ PR C. `consumeQuota` — один атомарний `INSERT … ON CONFLICT DO UPDATE WHERE t.request_count + EXCLUDED.request_count <= $5 RETURNING request_count`. Pre-check `cost > limit` → 429 без TX. Per-cost параметр імплементовано (tool-use = 2, text-only = 1).                                                                                                                                            |
| SQL / параметризація    | **OK**               | Усі `pool.query` параметризовані. Ризикових місць не знайдено.                                                                                                                                                                                                                                                                                                                                            |
| N+1                     | **OK**               | `syncPushAll` робить 1 statement на модуль у BEGIN/COMMIT — за дизайном. `sendPush` — `SELECT` + паралельний webpush.send — не N+1.                                                                                                                                                                                                                                                                       |
| Індекси / soft-delete   | **Середній**         | Всього 3 міграції; покриття достатнє для поточних query-патернів. `deleted_at` / soft-delete ніде не використовується — в інвентарі як tech-debt-seed, а не блокер.                                                                                                                                                                                                                                       |
| Логи                    | **Переважно OK**     | Структурний Pino + ALS (`requestId`/`userId`/`module`) підтягуються автоматично. `X-Request-Id` в response-header + у JSON-тілі помилки. Метрики RED/USE по маршрутах — покриті.                                                                                                                                                                                                                          |
| Таймаути / retry (HTTP) | **OK**               | ✅ Anthropic: `timeoutMs` + 3 retry. Barcode/food-search: `AbortSignal.timeout`. Банки: `bankProxy.ts` timeout+retry+breaker+cache. Web-push: [PR #335](https://github.com/Skords-01/Sergeant/pull/335) timeout+retry+per-origin breaker.                                                                                                                                                                 |
| Дублювання логіки       | **Середній**         | OFF/USDA нормалізатори, pantry→string map, dual-metric `record*` — повторюються у 2–3 файлах.                                                                                                                                                                                                                                                                                                             |
| Секрети в логах         | **OK**               | Sentry `sendDefaultPii=false` + `beforeSend` стрипає body/cookies. Логер не дампить headers. Email логується як SHA-256[:12]. Anthropic key не логується.                                                                                                                                                                                                                                                 |
| Тести                   | **Середній**         | ✅ [PR #336](https://github.com/Skords-01/Sergeant/pull/336) додав `server/smoke.test.ts` — 9 supertest-smoke-тестів через `createApp()` factory на 8 ендпоінтах (`/livez`, `/health` ok/503, `/metrics`, `/api/push/vapid-public`, `/api/push/send`, `/api/mono`, `/api/chat`, unknown→404). Решта gap-ів (chat SSE+tool-use, push handlers, nutrition-контракт) — PR F, залишається.                    |

---

## Per-file findings

### `server/index.js`

- **Низький** — `catch { /* ignore */ }` навколо `Sentry.flush` під час shutdown (рядки 131–133 та 148–166 у process-handler-ах). Документовано інлайн, прийнятно.
- **OK** — SIGTERM/SIGINT graceful shutdown з `SHUTDOWN_GRACE_MS`/`SHUTDOWN_HARD_TIMEOUT_MS`. Sentry імпортується першим (ESM depth-first).
- **OK** — `startPoolSampler(pool)` — періодичні метрики по pool.

### `server/app.js`

- **OK** — per-route body-size caps (analyze-photo/refine-photo 10mb, sync 6mb, coach/memory 6mb, chat 1mb, глобальний default 128kb). Порядок коректний.
- **OK** — middleware pipeline: requestId → ALS → log → helmet → bodies → CORS → routes → (Sentry errorHandler) → local errorHandler.

### `server/config.js`

- **OK** — frozen config з detection за `SERVER_MODE`/`REPLIT_*`. Жодного тех-боргу.

### `server/db.js`

- **OK** — `query()` wrapper з метриками, slow-log, error-counter. Міграції з `schema_migrations` та лексикографічним порядком.
- **Середній** — `DB_SLOW_MS` поріг 200ms глобально. Для batch / aggregation-запитів (наприклад, weekly-digest пре-агрегація) 200ms замало. Варіант: per-op поріг через meta.
- **Низький** — `catch { /* ignore */ }` навколо `dbQueryDurationMs.observe` — прийнятно (метрики не мають валити запит).

### `server/auth.js`

- **OK** — Better Auth, baseURL детектом, trustedOrigins з env, cross-site cookies для HTTPS-деплоїв.
- **Середній** — `getSessionUser` ставить `Sentry.setUser({id})` ліниво. Якщо `import('@sentry/node')` впаде (моки у тестах) — `catch { /* ignore */ }`. Прийнятно для спостереження, але маскує справжні імпорт-помилки в обсервабіліті-шарі.

### `server/aiQuota.ts`

- ~~**Блокер**~~ → **OK (PR C)** — race condition знято: `consumeQuota` — один атомарний `INSERT … ON CONFLICT DO UPDATE WHERE t.request_count + EXCLUDED.request_count <= $5 RETURNING request_count`. Pre-check `cost > limit` відкидає 429 без TX. Жодного `SELECT FOR UPDATE` у модулі не лишилось.
- ~~**Високий**~~ → **OK (PR C)** — per-cost параметр (`cost = 1` default, `cost = 2` для tool-use у chat). Ваги застосовані у `assertAiQuota({ cost })`. Per-tool-breakdown метрик поки немає — low-priority follow-up, не блокер.
- (historical) race condition: `consumeQuota` робив `BEGIN; SELECT … FOR UPDATE; INSERT|UPDATE; COMMIT`. Під великою паралельністю на одному subject (наприклад, той самий залогінений юзер тиснить Retry на AI-помилку) — довгі locks. Замінено на single-statement upsert:
  ```sql
  INSERT INTO ai_usage_daily (subject_key, usage_day, request_count)
  VALUES ($1, $2::date, 1)
  ON CONFLICT (subject_key, usage_day) DO UPDATE
    SET request_count = ai_usage_daily.request_count + 1
    WHERE ai_usage_daily.request_count < $3
  RETURNING request_count;
  ```
  Якщо `RETURNING` порожній — ліміт вичерпано, відмова 429 без TX-контензію. Покриває ту саму семантику і усуває `FOR UPDATE`.
- **Високий** — немає per-tool лімітів. Tool-use коштує ~2–4× більше токенів (thinking, tool schema), але рахується як одиниця. Варіанти: (а) окремий `AI_DAILY_TOOL_LIMIT`, (б) ваги в `consumeQuota(subject, day, limit, cost=1)`.
- **Середній** — п'ять `catch { /* ignore */ }` на метриках — прийнятно. `logQuotaStoreUnavailable` — ок (fail-open з телеметрією).
- **OK** — fail-open policy задокументована інлайн; `X-AI-Quota-Remaining` header.

### `server/sentry.js`

- **OK** — init у top-level (ESM depth-first гарантує це до `express`), `sendDefaultPii=false`, `beforeSend` стрипає `request.data` і `cookies`, підмішує `requestId`/`module`/`userId` з ALS.
- **Середній** — `SENTRY_TRACES_SAMPLE_RATE` fallback 0.1 у проді потенційно дорого на високому RPS. Розгляньмо 0.02 для Railway.

### `server/http/` (infra)

- `index.js` — barrel, без боргу.
- `requestId.js` — standard UUID, `X-Request-Id`. **OK**.
- `requestLog.js` — Pino-bound request-log. **OK**.
- `requireSession.js` — soft/hard варіанти; `catch { /* swallow */ }` документований (transient → "not logged in"). **OK**.
- `requireApiSecret.js`, `requireAnthropicKey.js`, `requireAiQuota.js`, `requireNutritionToken.js` — middleware-обгортки. **OK**.
- `authMiddleware.js` — **OK**: email хешується SHA-256[:12], IP береться через `getIp`, метрики з outcome.
- `asyncHandler.js`, `setModule.js` — тонкі обгортки. **OK**.
- `apiCors.js`, `cors.js` — відокремлені (ALLOWED_ORIGINS env + дефолтний whitelist). **OK**.
- `security.js` — strict API CSP (default-src 'none', scriptSrc 'none'). **OK**.
- `health.js` — `/livez` + `/readyz` (DB-probe). **OK**.
- `rateLimit.js` — **Середній**: in-memory fixed-window per-process. При multi-instance deploy (Railway scale) ліміт стає ×N. Документація інлайн присутня. Redis-варіант — на майбутнє.
- `errorHandler.js` — **OK**: класифікує operational vs programmer, метрика `appErrorsTotal{kind,status,code,module}`, `Sentry.captureException` лише для 5xx не-operational.
- `validate.js` — **OK**: `validateBody` / `validateQuery` обидва повертають `{ok,data}` + auto-400 з `details`.
- `jsonSafe.js` — **OK**: з markdown fence-ами, BOM, smart-quotes. `catch { /* continue */ }` документовано.
- `schemas.js` — **Високий**: схеми визначено, але ключові з них НЕ ЗАСТОСОВАНІ у handler-ах. Конкретно:
  - `RefinePhotoSchema` — має поля `previous`/`answers`/`note`/`locale`, а `refine-photo.js` насправді читає `image_base64`/`mime_type`/`prior_result`/`portion_grams`/`qna`. **Схема не відповідає handler-у.**
  - `DayHintSchema`, `DayPlanSchema`, `WeekPlanSchema`, `ShoppingListSchema`, `RecommendRecipesSchema`, `ParsePantrySchema` — визначено, але handler-и читають `req.body` напряму без `validateBody`.
  - Пропозиція (PR A): (1) синхронізувати `RefinePhotoSchema` з реальним body, (2) додати `validateBody` у всі nutrition-handler-и, (3) додати `SyncPushSchema`/`SyncPullSchema`/`SyncPushAllSchema` і прибрати ручну `VALID_MODULES`-перевірку у `modules/sync.js`, (4) додати `MonoQuerySchema`/`PrivatQuerySchema` для query-params.

### `server/obs/`

- `logger.js` — Pino + `mixin()` підтягує ALS-context у кожний запис; `serializeError()` з опцією `includeStack`. **OK**.
- `metrics.js` — RED/USE Prometheus, pool sampler, DB hist, AI quota, auth, sync, push, external HTTP, rate limit. Три `catch { /* ignore */ }` навколо `.inc`/`.observe` — прийнятно. **OK**.
- `requestContext.js` — ALS; документовано. **OK**.
- `errors.js` — `AppError` + `ValidationError`/`UnauthorizedError`/`ForbiddenError`/`NotFoundError`/`RateLimitError`/`ExternalServiceError`. **OK**, широко не використовується (ручні `res.status(4xx).json(…)` все ще домінують).

### `server/lib/`

- `anthropic.js` — **Середній**: timeout (default 30s) + 3 retry з backoff `[0, 250, 750]ms`. `recordStreamEnd()` — caller-responsible (див. нижче). Реплікує логіку помилок Anthropic (overload_error, rate_limit_error). **OK** для синхронних викликів; для стріму — трохи крихко (якщо consumer не ітерує до кінця і не зове `recordStreamEnd("error")`, метрика не фіксується — єдиний caller `chat.js` дотримується).
- `externalHttp.js` — уніфікований `recordExternalHttp(service, outcome, ms)`. **OK**.
- `nutritionResponse.js` — `normalizePhotoResult`, `normalizePantryItems`, `normalizeRecipes`. **OK**, є тест.

### `server/routes/*`

Всі роутери використовують `setModule` → `rateLimitExpress` → (auth/session) → `asyncHandler(handler)`. Структура чиста. **OK** (окрім окремих handler-ів усередині — див. `modules/` нижче).

### `server/modules/`

#### `chat.js` (567 рядків)

- **Високий** — широкий `try/catch` навколо non-stream handler: `catch (e) { return res.status(500).json({ error: e?.message || "Помилка AI сервера" }); }`. Обходить central `errorHandler`, не робить `Sentry.captureException`, віддає internal message.
- **Середній** — SSE heartbeat присутній (15с, `SSE_HEARTBEAT_MS`), але heartbeat не скидає per-route read timeout на Railway (сервер-side). На проксі з hard timeout 60с потрібно посилати `ping` частіше або виставляти `res.flushHeaders()` одразу.
- **Середній** — `TOOLS` (10+ tool-ів) описаний inline 300+ рядків; варто винести у `server/lib/chatTools.js`, зробити тестованим.
- **Низький** — `catch { /* ignore */ }` у error-parser гілці (рядок 477) — документовано як "best-effort text read".
- **Відсутність тестів** — немає `chat.test.js`. Для такої логіки (SSE + tool_use + retry) — блокер для рефакторингу.

#### `coach.js` + `coach.test.js`

- **Середній** — `parseMemory` ковтає JSON-parse-помилку і повертає `raw` як fallback (рядки 14–18). Валідний підхід для back-compat, але маскує зламаний blob — warn-лог був би кориснішим.
- **OK** — `coachMemoryPost` через `validateBody(CoachMemoryPostSchema, …)`; `saveMemory` з обмеженням `MAX_BLOB_SIZE`.
- **Високий** — `coachInsight` широко обгорнуто в try/catch? Реальний виклик напряму: без try. **OK**.
- **Тест-покриття** — є `coach.test.js` (merge/shape), але немає тестів на `coachInsight` (AI-прошитого ендпоінту) і route-level contract-тестів.

#### `sync.js` + `sync.test.js`

- **Високий** — `VALID_MODULES` ручна set-перевірка замість `SyncPushSchema` (zod). `data` приймається як `any`.
- **OK** — `ON CONFLICT DO UPDATE WHERE client_updated_at <= $4` — коректна LWW-семантика; `syncPushAll` у `BEGIN/COMMIT` з `try/catch/ROLLBACK`.
- **Середній** — у conflict-гілці робиться extra `SELECT` для server_updated_at/version. Можна замінити одним `INSERT … ON CONFLICT … RETURNING *` (завжди повертає рядок у 2-х гілках WHERE).
- **OK** — `recordSync` з level-mapping (ok/empty→info, conflict/invalid/too_large→warn, error→error).

#### `mono.js`

- **Блокер** — `fetch("https://api.monobank.ua…")` без `signal: AbortSignal.timeout(…)`. Monobank історично падає з 5с затримками; без таймауту — Node-worker заблокований.
- **Блокер** — немає retry/backoff і circuit breaker для 5xx upstream.
- **Блокер** — немає кешу. Mono має жорсткий rate-limit (60с per-token для `client-info`, 60с per-account для `statement`); без кешу клієнт ловить 429 замість cached response.
- **Високий** — широкий `try/catch` і `res.status(500).json({error: "Помилка сервера"})` — краще кинути `ExternalServiceError` і дати central `errorHandler` працювати.
- **Високий** — `errorText` від Monobank віддається клієнту як є (рядок 46–48). Потенційний leak internal details upstream-а. Варто мапити на whitelisted коди.
- **OK** — whitelist `allowedPaths` + regex для path-safety.

#### `privat.js`

- **Блокер** — ті самі три (no timeout, no retry, no cache).
- **Високий** — `catch {}` (рядок 74) на `response.text()` ковтає помилку — але це defensive (якщо тіло відсутнє).
- **Високий** — широкий `catch (e)` → `res.status(500)` — ті ж проблеми, що у mono.
- **OK** — path-whitelist + CRLF-фільтрація заголовків.
- **Середній** — query-params передаються без валідації: `URLSearchParams(req.query)` відкидає лише `path`. Варто додати `PrivatQuerySchema` (startDate/endDate/followId).

#### `push.js`

- **Високий** — 3 broad try/catch (subscribe/unsubscribe/sendPush), що повертають generic 500 і ковтають stack. Заміна: `asyncHandler` + throw → central `errorHandler`.
- **Середній** — `dual-metric` запис (`pushSubscribesTotal` + `externalHttp`) дублює бухгалтерію.
- **Середній** — `webpush.sendNotification` без таймауту. FCM/APNs в принципі швидкі, але при партіал-відмові pending call висне.
- **OK** — `stale-endpoint cleanup` на 410/404 — коректна логіка.
- **Відсутність тестів** — жодного тесту для push-модуля.

#### `barcode.js` (320 рядків)

- **OK** — `AbortSignal.timeout(7000/6000)` для OFF/USDA/UPCitemdb. Каскад 3 джерел з `recordLookup`.
- **Високий** — немає in-memory кешу по barcode (90% запитів — повторні сканування тієї самої пляшки). 60-секундний TTL-кеш дав би 2–3× зниження зовнішніх викликів.
- **Середній** — `recordLookup` пише метрики і в `externalHttp` (через зовнішній import `recordExternalHttp`)? Перевірити, щоб не було дублю.
- **Відсутність тестів** — жодного тесту для barcode handler-а.

#### `food-search.js` (304 рядки)

- **Високий** — велика in-file `UK_TO_EN` таблиця (100+ рядків) з ймовірними typo/дублями ("гарбуз"/"гарбузове" → обидва pumpkin). Виокремити в `server/lib/ukToEn.js` + тести на unique-keys.
- **Середній** — OFF/USDA нормалізатори дуже схожі на `barcode.js`, але не ідентичні. Дублювання логіки нормалізації макросів.
- **OK** — `AbortSignal.timeout(8000)` + `Promise.all` з `.catch(() => [])` — degrades gracefully.
- **Відсутність тестів**.

#### `weekly-digest.js`

- **Високий** — широкий try/catch повертає `e.message` клієнту. Замінити на `asyncHandler` + throw.
- **Середній** — `systemPrompt` дуже довгий, inline — ок, але варто винести в `prompts/` для тестування та A/B.
- **OK** — zod `WeeklyDigestSchema` існує, але не застосований у handler-і (handler валідує через ручний build-контексту). **Високий**: додати `validateBody(WeeklyDigestSchema, …)`.

#### `nutrition/` (10 handler-ів)

Спільні проблеми, що повторюються:

- **Високий** — більшість handler-ів не використовує zod-схеми (хоча вони існують у `schemas.js`):
  - `recommend-recipes.js` — ручний parse items/preferences, хоч `RecommendRecipesSchema` є.
  - `day-hint.js` — ручний parse macros/targets, хоч `DayHintSchema` є.
  - `day-plan.js` — ручний parse, хоч `DayPlanSchema` є.
  - `week-plan.js` — ручний parse, хоч `WeekPlanSchema` є.
  - `shopping-list.js` — ручний parse, хоч `ShoppingListSchema` є.
  - `refine-photo.js` — **схема `RefinePhotoSchema` не відповідає реальному body**; треба переробити схему.
  - `backup-upload.js`, `backup-download.js` — жодної zod-схеми.
- **Високий** — усі nutrition handler-и обгорнуті в широкий `try/catch` → 500+`e.message`. Заміна: `asyncHandler` + central `errorHandler`.
- **Середній** — pattern pantry→string (items.map → name/qty/unit/notes) повторюється у 4 файлах (recommend/week-plan/day-plan/shopping-list). Виокремити у `server/lib/pantryFormat.js`.
- **Середній** — `normalizeWeekPlan`, `normalizeDayPlan`, `normalizeRecipes`, `normalizePhotoResult` всі в різних файлах; `recipes` і `photo` уже у `lib/nutritionResponse.js`, а week/day — inline. Консолідувати.
- **Низький** — `parse-pantry.js` має shadowing: `const parsed = validateBody(…)` і потім `const parsed = extractJsonFromText(out)` (рядки 39 та 70 — ESLint має вже кричати, перевірити).
- **Високий** — `analyze-photo.js` та `refine-photo.js` — важкі body (до 10mb base64). Sentry breadcrumbs можуть тягти base64 без `beforeSend` — перевірено, `sendDefaultPii=false` + стриптежений `request.data` — **OK**.

---

## Consolidated issue groups

### A. Валідація (zod) — ~~потребує PR A~~ **✅ DONE**

- Усі nutrition-handler-и (10 файлів) → застосувати існуючі схеми через `validateBody`/`validateQuery`.
- `RefinePhotoSchema` → привести у відповідність до реального body (`image_base64`/`mime_type`/`prior_result`/`portion_grams`/`qna`/`locale`).
- `sync.js` → `SyncPushSchema`/`SyncPullSchema`/`SyncPushAllSchema` + прибрати `VALID_MODULES` ручний check.
- `mono.js`/`privat.js` → `MonoQuerySchema`/`PrivatQuerySchema` для `path` та query-params.
- `weekly-digest.js` → `validateBody(WeeklyDigestSchema, …)`.
- `backup-upload.js`/`backup-download.js` → `BackupUploadSchema` / `BackupDownloadSchema`.

### B. Центральний error handler — ~~потребує PR A~~ **✅ DONE**

- Зняти `try { … } catch (e) { res.status(500).json({ error: e?.message }) }` з:
  - `modules/chat.js` (2 місця: non-stream, stream-error)
  - `modules/mono.js` (1 місце)
  - `modules/privat.js` (1 місце)
  - `modules/push.js` (subscribe/unsubscribe/sendPush — 3 місця)
  - `modules/weekly-digest.js` (1 місце)
  - `modules/nutrition/*.js` (8+ файлів)
- Замінити на `asyncHandler(handler)` + при потребі кинути `ExternalServiceError`/`ValidationError`/`RateLimitError`.
- Профіт: єдина форма `{error, code, requestId}`, Sentry-capture для 5xx не-operational, stable error codes для клієнта.

### C. Банки — ~~потребує PR B~~ **✅ DONE**

Див. deep-dive нижче.

### D. AI-квоти — ~~потребує PR C~~ **✅ DONE**

Див. deep-dive нижче.

### C2. Web-push — **✅ DONE** ([PR #335](https://github.com/Skords-01/Sergeant/pull/335))

Раніше `webpush.sendNotification` у `modules/push.ts` викликався без timeout/retry/breaker — повільний FCM/Apple/Mozilla міг тримати Node-worker і pg-conn.

Тепер через `server/lib/webpushSend.ts`:

- **timeout = 10s** (`WEBPUSH_TIMEOUT_MS` env-override) через `AbortController` + `Promise.race` (web-push lib не приймає AbortSignal; controller поставлений в `abort()` по timeout-у, соккет закривається TCP-keepalive).
- **retry [0, 500ms+jitter]** на 5xx / network / timeout; **НЕ** ретраїмо 4xx (404/410 = invalid_endpoint, 429 = per-sub rate-limit).
- **Per-origin circuit breaker** (`new URL(endpoint).origin`): FCM (`https://fcm.googleapis.com`) і Apple (`https://web.push.apple.com`) — окремі стани, 5 fails / 30s open-window; half-open після timeout-у дозволяє 1 probe-запит.
- **Outcome classification**: `ok`/`invalid_endpoint`/`rate_limited`/`timeout`/`circuit_open`/`error`.
- **Метрики**: `external_http_requests_total{upstream="push", outcome="…"}` + історичний `push_sends_total{outcome}`.
- 13 unit-тестів (happy / класифікація / retry / timeout / breaker per-origin isolation).

### E. Міграції / індекси — потребує PR D

Див. DB-section нижче.

### F. Спостережуваність / логи — потребує PR E (частково зроблено в рамках PR #335)

В основному вже ок; precision-fix-и у нижньому розділі.

### G. Дублювання логіки (cross-cutting)

- `elapsedMs(start)` → `server/lib/time.js` (зараз повторюється в 4+ файлах).
- `pantry items → prompt string` → `server/lib/pantryFormat.js`.
- OFF/USDA normalizers → уніфікувати між `barcode.js` і `food-search.js` (shared `server/lib/foodNormalize.js`).
- `FNV-1a safeKeyFromToken` → в `server/lib/backupKey.js` (duplicated у `backup-upload.js` + `backup-download.js`).

---

## Bank integrations deep-dive

| Вимога                          | Mono (сьогодні)                          | Privat (сьогодні) | Пропозиція (PR B)                                                                                                                                         |
| ------------------------------- | ---------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fetch timeout                   | ❌                                       | ❌                | `AbortSignal.timeout(8000)` за замовчуванням, `BANK_FETCH_TIMEOUT_MS` env-override.                                                                       |
| Retry with exp backoff + jitter | ❌                                       | ❌                | 3 спроби на 5xx/429/network з `100·2^n + random(0..100)ms`, respect `Retry-After` header від банку.                                                       |
| Circuit breaker                 | ❌                                       | ❌                | Per-upstream (mono, privat) sliding window 20 запитів / 60с; при >50% помилок → open на 30с (503 швидкий). Метрика `bank_breaker_state{upstream, state}`. |
| 60s cache (GET)                 | ❌                                       | ❌                | Per-(token, path, queryString) TTL 60с для GET-only; cache-key з `sha256(token).slice(0,12)`, щоб не зберігати токен у пам'яті.                           |
| Validation (zod)                | regex-whitelist                          | regex-whitelist   | Zod `MonoQuerySchema` / `PrivatQuerySchema` + існуюча regex-safety.                                                                                       |
| Помилки upstream → клієнту      | `errorText` як є                         | `errorText` як є  | Whitelisted mapping (`401/403 → "Невірні credentials"`, `429 → "Rate limit"`, `5xx → "Bank temporarily unavailable"`).                                    |
| Наявні тести                    | `bankProxy.test.js` (контракт path/CRLF) | як mono           | Додати: таймаут, breaker-open→503, cache-hit, retry-exhausted.                                                                                            |

Реалізація:

- Новий `server/lib/bankClient.js` (або окремі `lib/monoClient.js` / `lib/privatClient.js`, якщо логіка дивергує): `bankRequest({ upstream, path, headers, token })` з вбудованими timeout/retry/breaker/cache.
- `modules/mono.js` і `modules/privat.js` стають тонкими: валідація → `bankRequest(...)` → passthrough-JSON.

---

## AI quota deep-dive

### Race condition fix

```diff
- async function consumeQuota(subject, day, limit) {
-   const client = await pool.connect();
-   try {
-     await client.query("BEGIN");
-     const sel = await client.query(
-       `SELECT request_count … FOR UPDATE`, [subject, day]
-     );
-     const cur = sel.rows[0]?.request_count ?? 0;
-     if (cur >= limit) { ROLLBACK; return {ok:false,…}; }
-     INSERT or UPDATE …
-     COMMIT;
-     return {ok:true, remaining: limit - next, limit};
-   } finally { client.release(); }
- }
+ async function consumeQuota(subject, day, limit, cost = 1) {
+   const r = await pool.query(`
+     INSERT INTO ai_usage_daily (subject_key, usage_day, request_count)
+     VALUES ($1, $2::date, $3)
+     ON CONFLICT (subject_key, usage_day) DO UPDATE
+       SET request_count = ai_usage_daily.request_count + $3
+       WHERE ai_usage_daily.request_count + $3 <= $4
+     RETURNING request_count`,
+     [subject, day, cost, limit]
+   );
+   if (r.rowCount === 0) return { ok: false, remaining: 0, limit };
+   return { ok: true, remaining: limit - r.rows[0].request_count, limit };
+ }
```

Властивості:

- Single statement → no explicit TX → no `FOR UPDATE` contention.
- `WHERE count + cost <= limit` — атомарна перевірка ліміту на рівні UPSERT.
- `cost` параметр дає готовий hook для per-tool differentiation.

### Per-tool limits

- Додати `AI_DAILY_TOOL_LIMIT` (fallback = 0.5 × `AI_DAILY_USER_LIMIT`).
- Ендпоінти з `toolUse: true` (`chat` при наявності tool_results) викликають `assertAiQuota(req, res, { cost: Number(process.env.AI_TOOL_COST) || 2 })`.
- Chat без tool_use / всі nutrition handler-и → `cost: 1`.
- Метрики: розділити `aiQuotaBlocksTotal{reason}` на `{reason, cost}`, додати `ai_cost_consumed_total{subject_type}`.

---

## Database & migrations review

### Міграції (3 файли)

- `001_noop.sql` — безпечний anchor-файл.
- `002_ai_usage_daily.sql` — `ai_usage_daily (subject_key, usage_day)` + PK + index on `usage_day` + CHECK constraint `request_count > 0`. **OK**.
- `003_baseline_schema.sql` — `user`, `session`, `account`, `verification` (Better Auth), `module_data`, `push_subscriptions`.

### Індекси — по реальних query-патернах

| Таблиця              | Реальні запити                                                                              | Індекс                                            | Статус |
| -------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------ |
| `module_data`        | `WHERE user_id=$1 AND module=$2` (push/pull); `INSERT … ON CONFLICT (user_id, module)`      | PK `(user_id, module)`                            | **OK** |
| `ai_usage_daily`     | `INSERT … ON CONFLICT (subject_key, usage_day)`; `DELETE WHERE usage_day < NOW() - 30 days` | PK `(subject_key, usage_day)` + idx `(usage_day)` | **OK** |
| `push_subscriptions` | `SELECT … WHERE user_id=$1`; `DELETE WHERE endpoint = ANY($1)`                              | UNIQUE(endpoint) + index на user_id               | **OK** |
| `session`            | Better Auth — керує сама                                                                    | n/a                                               | **OK** |

### EXPLAIN ANALYZE — треба додати inline-коментарі до міграцій для важких запитів

- `module_data` upsert: зараз O(1) через PK. Коментар: `-- EXPLAIN ANALYZE shows Index Only Scan on module_data_pkey, cost ≤ 0.04ms on 10k rows`.
- `ai_usage_daily` purge: O(rows older than 30d). Коментар: `-- DELETE uses idx_ai_usage_daily_usage_day; seq scan on table <10k rows is fine`.
- Для `push_subscriptions`: якщо кількість user-підписок зростатиме, додати `CREATE INDEX CONCURRENTLY idx_push_subscriptions_user_id ON push_subscriptions(user_id)` — перевірити, що вже існує.

### Consistency constraints

- `ai_usage_daily.request_count > 0` — **OK**.
- `module_data.version >= 1` — варто додати як CHECK.
- `push_subscriptions.endpoint` довжина — поточна TEXT без обмеження; додати CHECK `length(endpoint) ≤ 2048`.
- FK: `push_subscriptions.user_id → user.id ON DELETE CASCADE` — **перевірити міграцію 003**; якщо нема, додати.

### Soft-delete

- Сьогодні ніде не використовується. Це свідомо: `push_subscriptions` реально має бути hard-delete (ендпоінти більше не валідні). Для `module_data` soft-delete не потрібен — user може очистити blob, але версія зростатиме.
- Рекомендація: **не додавати soft-delete глобально** — створює overhead без бізнес-потреби. Якщо для `user.delete` (GDPR) треба trail — робити через окрему таблицю `deleted_user_audit` замість `deleted_at` колонок.

### Довгі запити → PR D

- Додати `-- EXPLAIN ANALYZE …` коментарі до кожної міграції з нетривіальним запитом.
- Додати `idx_module_data_server_updated_at` (опціонально) якщо з'явиться feature "recent changes across all modules".

---

## Observability & logging review

### Вже є

- **Pino** + ALS-mixin (`requestId`/`userId`/`module` у кожному рядку).
- **Sentry** з PII-redaction, beforeSend/beforeBreadcrumb.
- **Prometheus**: `http_requests_total`, `http_request_duration_ms`, `db_query_duration_ms`, `db_slow_queries_total`, `db_errors_total`, `ai_quota_blocks_total`, `ai_quota_fail_open_total`, `external_http_requests_total`, `rate_limit_hits_total`, `sync_operations_total`, `sync_duration_ms`, `sync_payload_bytes`, `sync_conflicts_total`, `auth_attempts_total`, `auth_session_lookup_duration_ms`, `push_*`, `app_errors_total{kind,status,code,module}`.
- **Request-id**: `X-Request-Id` header + у JSON-тілі помилок.
- **/livez**, **/readyz**, **/metrics** endpoints.

### Gaps → PR E

- **Високий** — метрики відсутні на nutrition-handler-ах (лише загальна RED через Express-middleware; немає per-endpoint ms-histogram для AI-викликів з breakdown по endpoint/model/tokens).
- **Середній** — немає `app_build_info` gauge (version/commit/release) — корисно для readiness-dashboard.
- **Середній** — per-route error-rate не має окремого шардингу на `route_pattern` (зараз `module` label — достатньо для топ-рівня).
- **Низький** — Sentry release береться з `RAILWAY_GIT_COMMIT_SHA`, але Replit не має еквіваленту — ок для дев-режиму.

---

## Secret-logging audit

| Шар         | Ризик                       | Поточна поведінка                                                                                               | Статус                      |
| ----------- | --------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Sentry      | send request body           | `sendDefaultPii: false`, `beforeSend` стрипає `request.data`/`cookies`, breadcrumbs стрипає `request_body_size` | **OK**                      |
| Pino        | log request headers         | `requestLog.js` пише лише `method/path/status/ms/userAgent` (перевірено), НЕ `authorization`/`cookie`           | **OK**                      |
| Pino        | log error objects           | `serializeError()` стрипає `err.cause`/`err.response.data` для operational; `includeStack=true` лише для 5xx    | **OK**                      |
| Mono/Privat | upstream errorText → client | Повертається як є (не в лог — ок, але віддається назовні; розглянемо у PR B)                                    | **Високий (external leak)** |
| Anthropic   | api-key у logs              | `anthropicMessages` не логує key; `authorization` header ставиться inline                                       | **OK**                      |
| Web-push    | VAPID key у logs            | web-push.setVapidDetails() — не логується                                                                       | **OK**                      |
| Auth        | email                       | `emailFingerprint = SHA-256(email).slice(0,12)` у метриках і логах                                              | **OK**                      |
| Auth        | password                    | Better Auth не логує; body-stream стрипається у Sentry                                                          | **OK**                      |
| Database    | connection string           | ніде не логується (перевірено)                                                                                  | **OK**                      |

### `.env.example` — аудит

- Перевірити, чи всі env з `config.js` + `auth.js` + `aiQuota.js` + `rateLimit.js` + `sentry.js` + `anthropic.js` + `db.js` задокументовані.
- У PR E зробити оновлення + додати `BANK_FETCH_TIMEOUT_MS`, `BANK_CACHE_TTL_MS`, `AI_DAILY_TOOL_LIMIT`, `AI_TOOL_COST`.

---

## Tests coverage map

| Файл                       | Тест є?                                      | Блокери                                                       |
| -------------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| `aiQuota.js`               | ✅                                           | PR C переписує — тести треба розширити на race condition sim. |
| `auth.js`                  | ❌ (частково через `authMiddleware.test.js`) | baseURL detection, trustedOrigins — додати unit.              |
| `db.js`                    | ❌                                           | Складно (вимагає pg mock); low priority.                      |
| `modules/chat.js`          | ❌                                           | Контракт + SSE + tool-use. **Блокер для рефакторингу.**       |
| `modules/coach.js`         | ✅ частково                                  | `coachInsight` не покрита; contract-тести route.              |
| `modules/sync.js`          | ✅                                           | LWW-семантика покрита. Контракт push/pull/pushAll — додати.   |
| `modules/mono.js`          | через `bankProxy.test.js`                    | Timeout/retry/cache — додати у PR B.                          |
| `modules/privat.js`        | через `bankProxy.test.js`                    | Timeout/retry/cache — додати у PR B.                          |
| `modules/push.js`          | ❌                                           | Subscribe/unsubscribe/sendPush — додати.                      |
| `modules/barcode.js`       | ❌                                           | Каскад OFF→USDA→UPCitemdb — додати.                           |
| `modules/food-search.js`   | ❌                                           | UK_TO_EN tokens + OFF/USDA merge — додати.                    |
| `modules/weekly-digest.js` | ❌                                           | AI-response parse — додати.                                   |
| `modules/nutrition/*`      | ❌                                           | 10 handler-ів — додати контракт-тести (happy + 4 edge-cases). |

Цільове покриття:

- `modules/chat.js`, `modules/sync.js`, `modules/coach.js` — ≥ 80% lines/branches.
- Контракт-тести: per route — (1) happy path, (2) invalid body, (3) oversize body, (4) unauthenticated, (5) rate-limited.

---

## Gradual TypeScript migration plan

### Принцип

- `tsconfig.server.json` вже існує (використовується у `npm run typecheck`).
- `allowJs: true` + поступове перейменування `.js → .ts` по файлах.
- Жодного великого рефактору в одному PR. Один thematic group = один PR з міграцією.

### Хвилі

**Хвиля 1 — pure utilities (низький ризик, ~10 файлів):**

- `server/obs/errors.js` → `.ts` (AppError + підкласи, `isOperationalError`).
- `server/obs/requestContext.js` → `.ts` (ALS + getRequestContext + setUserId).
- `server/http/jsonSafe.js` → `.ts` (`extractJsonFromText`).
- `server/http/validate.js` → `.ts` (вже generic-friendly, zod-типізація).
- `server/http/schemas.js` → `.ts` (вже по суті типи; `z.infer<typeof …>` експорти).
- `server/http/asyncHandler.js`, `setModule.js`, `requireSession.js` → `.ts`.
- `server/lib/externalHttp.js` → `.ts`.
- `server/lib/nutritionResponse.js` → `.ts`.

**Хвиля 2 — середні утиліти (~8 файлів):**

- `server/http/rateLimit.js` → `.ts`.
- `server/http/cors.js`, `apiCors.js`, `security.js` → `.ts`.
- `server/http/authMiddleware.js` → `.ts`.
- `server/http/errorHandler.js` → `.ts`.
- `server/lib/anthropic.js` → `.ts` (типізовані responses, retry params).

**Хвиля 3 — домен (~15 файлів):**

- `server/modules/coach.js`, `sync.js`, `weekly-digest.js`, `push.js`, `barcode.js`, `food-search.js`.
- `server/modules/nutrition/*.js`.
- `server/routes/*.js`.

**Хвиля 4 — entrypoints (~6 файлів):**

- `server/db.js`, `server/auth.js`, `server/aiQuota.js`, `server/sentry.js`, `server/app.js`, `server/config.js`, `server/index.js`.

### Per-wave вимоги

- Кожна хвиля — окремий PR із нульовими runtime-змінами (лише типи). Бекап через `--noEmit` у CI.
- Додати `skipLibCheck: true` у `tsconfig.server.json` якщо конфліктує з `@sentry/node` / `pg` types.
- Тести (`*.test.js`) мігрувати після основних файлів; Vitest підтримує `.ts` out-of-box.
- Не вводити runtime-залежності на `tsc` у production; компіляція не потрібна — Node 20 не виконує TS, але ми виконуємо `.js`-артефакт після tsc. Альтернатива (recommended): `ts-node/esm` в dev + `tsc --outDir dist` у CI для перевірки, прод залишається на `.js`.
  - **Альтернативніше і краще:** перейти на `tsx` (dev) + `tsc --noEmit` (CI), а runtime — збирати `node --experimental-strip-types` (Node 22+) або `swc-compile` step. Ця deцизія — окрема RFC після Хвилі 1.

### Критерії для зупинки

- Якщо після Хвилі 1 `typecheck` тривалістю зростає >30с у CI — замкнути на `server/lib/` + `server/http/` і перейти на `project references` у tsconfig.

---

## Roadmap — PR breakdown

| PR                  | Тема                                                                                              | Файли                                                                                                                                                                                        | Залежності                  | Breaking                                           |
| ------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------- |
| **Inventory** (цей) | Документ `docs/backend-tech-debt.md`                                                              | 1 новий файл                                                                                                                                                                                 | —                           | Ні                                                 |
| **PR A** ✅         | Уніфікація zod-валідації + central errorHandler wiring                                            | `server/http/schemas.ts` (RefinePhotoSchema sync), nutrition-handler-и, `sync.ts`, `mono.ts`, `privat.ts`, `weekly-digest.ts`, `push.ts`, `chat.ts`                                          | Inventory                   | Ні (вивід — той самий `{error, code, requestId}`). |
| **PR B** ✅         | Банки: timeout + retry + jitter + circuit breaker + 60s cache                                     | `server/lib/bankProxy.ts`, `server/modules/mono.ts` + `server/modules/privat.ts`, тести `server/lib/bankProxy.test.ts`                                                                       | —                           | Ні (семантика GET лишається).                      |
| **PR C** ✅         | AI quota: atomic upsert + per-tool cost                                                           | `server/aiQuota.ts`, `server/http/requireAiQuota.ts`, `server/modules/chat.ts` (cost=2 при tool-use), `server/aiQuota.test.ts`                                                               | —                           | Ні (external contract той самий).                  |
| **PR #335** ✅      | Web-push hardening: timeout + retry + per-origin circuit breaker                                  | Новий `server/lib/webpushSend.ts` + `*.test.ts`, рефактор `server/modules/push.ts`                                                                                                           | —                           | Ні (зовнішній API push-ендпоінтів незмінний).      |
| **PR #336** ✅      | Supertest-smoke на 8 ендпоінтів через `createApp()` factory                                       | Новий `server/smoke.test.ts`, devDep `supertest` + `@types/supertest`                                                                                                                        | —                           | Ні (лише тести).                                   |
| **PR D**            | Міграції: коментарі EXPLAIN ANALYZE, CHECK-constraints, можливий `idx_push_subscriptions_user_id` | `server/migrations/004_*.sql`, оновлення `docs/backend-tech-debt.md`                                                                                                                         | —                           | Ні (всі зміни — additive).                         |
| **PR E**            | Log/obs polish: відсутні метрики, `app_build_info`, оновлений `.env.example`                      | `server/obs/metrics.js`, `server/obs/logger.js`, `.env.example`                                                                                                                              | —                           | Ні.                                                |
| **PR F (опц.)**     | Test coverage: chat/sync/coach ≥80% + contract tests                                              | `server/modules/chat.test.js`, `server/modules/push.test.js`, `server/modules/barcode.test.js`, `server/modules/food-search.test.js`, `server/modules/nutrition/*.test.js`                   | PR A                        | Ні.                                                |
| **PR TS-1**         | Gradual TS migration, Хвиля 1 (utilities)                                                         | `server/obs/errors.ts`, `server/obs/requestContext.ts`, `server/http/{jsonSafe,validate,schemas,asyncHandler,setModule,requireSession}.ts`, `server/lib/{externalHttp,nutritionResponse}.ts` | PR A–E (після стабілізації) | Ні (лише типи).                                    |

---

## Status log

| Дата       | PR                                                     | Тема                                 | Результат                                                                                                                                                                               |
| ---------- | ------------------------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-XX | PR A                                                   | Zod-валідація + central errorHandler | Закрив обидва рядки «Високий» у Summary. `grep catch\s*\([^)]*\)\s*\{[^}]*res\.(status\|json)` у `server/` → 0. RefinePhotoSchema synced.                                               |
| 2026-04-XX | PR B                                                   | Банки: timeout/retry/breaker/cache   | `server/lib/bankProxy.ts` — 15s timeout, retry з jitter, 5/30s breaker, 60s cache для GET. mono/privat — тонкі адаптери.                                                                |
| 2026-04-XX | PR C                                                   | AI quota atomic upsert + cost        | `consumeQuota` — single-statement upsert з per-cost ваги. `SELECT FOR UPDATE` знято. Tool-use = cost 2.                                                                                 |
| 2026-04-XX | [#335](https://github.com/Skords-01/Sergeant/pull/335) | Web-push hardening                   | Новий wrapper `server/lib/webpushSend.ts`: timeout 10s, retry [0,500ms+jitter], per-origin breaker, outcome-classification, 13 unit-тестів.                                             |
| 2026-04-XX | [#336](https://github.com/Skords-01/Sergeant/pull/336) | Supertest-smoke                      | 9 smoke-тестів на 8 ендпоінтів через `createApp()` factory (`/livez`, `/health` ok/503, `/metrics`, `/api/push/vapid-public`, `/api/push/send`, `/api/mono`, `/api/chat`, unknown→404). |

### Поточний залишок P0

Нульовий. Оригінальний список P0 («Топ-5 P0»):

1. ~~Таймаути/ретраї/breaker на `mono`/`privat`/`web-push`~~ — ✅ `bankProxy.ts` + PR #335.
2. ~~`aiQuota.consumeQuota` → атомарний upsert~~ — ✅ PR C.
3. ```12 широких `catch(e){res.json({error:e.message})}` → `next(e)`~~ — ✅ PR A (grep → 0).

   ```
4. ~~Sync zod-схем з handler-ами (`RefinePhotoSchema`)~~ — ✅ PR A.
5. ~~Supertest-smoke на 8 ендпоінтів через `createApp()` factory~~ — ✅ PR #336.

### P1 (наступний спринт)

- Розпил 5 найтовщих компонентів: `Assets.jsx` (928), `ActiveWorkoutPanel.tsx` (949), `WeeklyDigestStories.tsx` (867), `Transactions.jsx` (737), `HubDashboard.tsx` (663).
- `vitest --coverage` у CI.
- TS-міграція `finyk/domain+lib` та `nutrition/hooks+lib` (Хвиля 3 для domain; утилітарна частина готова).
- 3–4 E2E happy-path у Playwright.
- CSP `report-uri` + explicit `Permissions-Policy`.

---

### Нотатки по PR A

- Змін **не видно в публічному API** за винятком: помилки валідації повертаються у форматі `{error, details: [{path, message}], code: "VALIDATION", requestId}` (раніше `{error: "..."}`). Клієнти вже цей формат обробляють (див. `server/http/validate.js`).
- SSE-стрім `chat.js` залишається без змін.

### Нотатки по PR B

- При **circuit open** клієнт отримує `503 + Retry-After` + `code: "BANK_UNAVAILABLE"`. Клієнт повинен ретраїти (frontend → добавити backoff у `useMonoSync` / `usePrivatSync`, але це поза бекендом).

### Нотатки по PR C

- Single-statement upsert знімає необхідність у `pool.connect()`/`BEGIN`/`FOR UPDATE`. Поверніть до `pool.query` (через `query()` wrapper з метриками).
- Per-tool: додається опціональний `cost` у `assertAiQuota(req, res, {cost})`. За замовчуванням — 1. `chat` з наявним `tool_results` → 2.

---

## Конвенції для майбутніх PR

- **Жодних mass-rewrite**. Кожен PR — тематичний, reviewable за один присід (≤ 600 рядків diff там, де це можливо).
- **Жодних breaking змін у публічному API** без нотатки `BREAKING:` у title/body PR.
- CI має пройти (`npm run lint && npm run typecheck && npm run test`).
- Тести обов'язкові для кожного PR з логікою (не для PR-документу).
