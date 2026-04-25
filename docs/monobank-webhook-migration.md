# Monobank: міграція з polling на webhook

> Status: **Rolled out** (2026-04-25). Усі 3 треки змерджено в `main`, env Railway виставлено, smoke-тест на проді пройдено (webhook-доставка ~2 с після транзакції). Default фіче-флагу `mono_webhook` → `true` цим PR-ом. Cleanup legacy polling — окремим PR після кількох днів observability.

## TL;DR

Зараз Monobank-інтеграція повністю **client-side polling**: токен живе у браузері (`finyk_token` / `finyk_token_remembered`), web дзвонить `/api/mono` (тонкий проксі) на `api.monobank.ua/personal/{client-info,statement}`. `/personal/statement` лімітований **1 req/60 s/token** глобально, тому ми тримаємо per-token чергу (`enqueueStatementCall`), per-page retry на `Retry-After`, 60 s TTL-cache на сервері і pagination з safety cap. Це працює, але:

- Кожен page-load + window-focus з'їдає rate-limit. Користувачі з ≥2 UAH-рахунками гарантовано ловлять 429.
- Немає near-realtime: транзакція з'являється у Sergeant тільки після того, як юзер зайде у вкладку.
- Немає persistence — DB не знає про Mono-транзакції; історія тримається у `localStorage` snapshot-ах + RQ кеші.
- Push-нотіфікації про нову транзакцію неможливі: серверу нема звідки знати про неї.

Monobank Personal API підтримує **webhook** (`POST /personal/webhook`, поле `webHookUrl` у `client-info`). Перехід дає near-realtime, прибирає 429-проблему, відкриває push-нотіфікації, спрощує web-код. Поле `webHookUrl` уже є у типах (`packages/api-client/src/endpoints/mono.ts:41`), але ніколи не встановлювалося.

## Поточна архітектура (baseline)

```
[browser] localStorage(finyk_token)
   │
   ├── useMonobank() ──► useQuery(monoApi.clientInfo)         ──► /api/mono?path=/personal/client-info ──► api.monobank.ua
   │
   └── useMonoStatements(token, accounts)
         │
         └── useQueries({ enqueueStatementCall(token, ...) }) ──► /api/mono?path=/personal/statement/{acc}/{from}/{to}
                                                                        │
                                                                        ├── apps/server/src/modules/mono.ts (proxy)
                                                                        └── apps/server/src/lib/bankProxy.ts (timeout/retry/breaker/60s TTL cache)
```

Ключові файли:

- `apps/server/src/modules/mono.ts` — handler `/api/mono` (path whitelist, делегує у `bankProxyFetch`).
- `apps/server/src/lib/bankProxy.ts` — transport (15 s timeout, 5xx retry+jitter, breaker 5 fails / 30 s, TTL cache 60 s).
- `packages/api-client/src/endpoints/mono.ts` — `clientInfo`, `statement` (pagination 500/page, max 20 pages, 429 retry-after).
- `apps/web/src/modules/finyk/hooks/useMonobank.ts` — оркестратор: client-info + statements + snapshot fallback + connect/disconnect/refresh/fetchMonth.
- `apps/web/src/modules/finyk/hooks/useMonoStatements.ts` — RQ-reader поточного місяця + `enqueueStatementCall` (per-token serial queue).
- `apps/web/src/core/settings/FinykSection.tsx` — UX підключення токена.
- БД: **жодних** Mono-табличок, лише generic `module_data (user_id, module, data jsonb)`.

## Цільова архітектура

```
[browser] (без токена в storage)
   │
   ├── POST /api/mono/connect  { token }      ──► server: encrypt+store, register webhook на api.monobank.ua
   │
   ├── GET  /api/mono/accounts                ──► DB: mono_account[]
   ├── GET  /api/mono/transactions?from&to    ──► DB: mono_transaction[] (real-time, без 60 s rate-limit)
   └── GET  /api/mono/sync-state              ──► { webhook_active, last_event_at, last_backfill_at }

[Monobank] ──► POST /api/mono/webhook/:userSecret  ──► insert mono_transaction (UPSERT by mono_tx_id),
                                                         update mono_account.balance,
                                                         (опц.) emit web-push
```

DB схема (нова міграція `008_mono_integration.sql`):

```sql
CREATE TABLE mono_connection (
  user_id              TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  token_ciphertext     BYTEA NOT NULL,           -- AES-GCM (key з MONO_TOKEN_ENC_KEY env)
  token_iv             BYTEA NOT NULL,
  token_tag            BYTEA NOT NULL,
  token_fingerprint    TEXT NOT NULL,            -- sha256(token), для логів/дедупу
  webhook_secret       TEXT NOT NULL UNIQUE,     -- per-user random 32 byte hex; частина URL
  webhook_registered_at TIMESTAMPTZ,
  last_event_at        TIMESTAMPTZ,
  last_backfill_at     TIMESTAMPTZ,
  status               TEXT NOT NULL DEFAULT 'pending',  -- pending|active|invalid|disconnected
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mono_account (
  user_id          TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  mono_account_id  TEXT NOT NULL,
  send_id          TEXT,
  type             TEXT,
  currency_code    INT NOT NULL,
  cashback_type    TEXT,
  masked_pan       TEXT[],
  iban             TEXT,
  balance          BIGINT,                       -- minor units; може бути NULL до першого webhook/backfill
  credit_limit     BIGINT,
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, mono_account_id)
);

CREATE TABLE mono_transaction (
  user_id          TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  mono_account_id  TEXT NOT NULL,
  mono_tx_id       TEXT NOT NULL,
  time             TIMESTAMPTZ NOT NULL,         -- з epoch seconds в payload
  amount           BIGINT NOT NULL,
  operation_amount BIGINT NOT NULL,
  currency_code    INT NOT NULL,
  mcc              INT,
  original_mcc     INT,
  hold             BOOLEAN,
  description      TEXT,
  comment          TEXT,
  cashback_amount  BIGINT,
  commission_rate  BIGINT,
  balance          BIGINT,
  receipt_id       TEXT,
  invoice_id       TEXT,
  counter_edrpou   TEXT,
  counter_iban     TEXT,
  counter_name     TEXT,
  raw              JSONB NOT NULL,
  source           TEXT NOT NULL,                -- 'webhook' | 'backfill'
  received_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, mono_tx_id),
  FOREIGN KEY (user_id, mono_account_id) REFERENCES mono_account(user_id, mono_account_id) ON DELETE CASCADE
);

CREATE INDEX mono_tx_user_time_idx ON mono_transaction(user_id, time DESC);
CREATE INDEX mono_tx_user_account_time_idx ON mono_transaction(user_id, mono_account_id, time DESC);
```

REST-контракти (фінальні; інші треки до них прив'язуються):

| Метод | Шлях                                        | Auth                         | Призначення                                                                                              |
| ----- | ------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| POST  | `/api/mono/connect`                         | session                      | `{ token }` → encrypt, store, register webhook, відповідь `{ status, accountsCount }`.                   |
| POST  | `/api/mono/disconnect`                      | session                      | unregister webhook (`POST /personal/webhook { webHookUrl: "" }`), wipe `mono_connection`.                |
| GET   | `/api/mono/sync-state`                      | session                      | `{ status, webhookActive, lastEventAt, lastBackfillAt, accountsCount }`.                                 |
| GET   | `/api/mono/accounts`                        | session                      | `MonoAccount[]` з DB.                                                                                    |
| GET   | `/api/mono/transactions?from&to&accountId?` | session                      | `MonoTransactionDto[]`, sorted by `time DESC`. Pagination через `?limit&cursor` (cursor = `time:tx_id`). |
| POST  | `/api/mono/backfill`                        | session                      | re-trigger backfill (rate-limited на server-side).                                                       |
| POST  | `/api/mono/webhook/:secret`                 | **публічний**, secret у path | Monobank delivery. Валідуємо `secret` → `mono_connection.webhook_secret`, idempotent UPSERT, 200.        |

Конверти JSON: лишаємо існуючий формат `{ data: ... }` / прямо масив, як у `mono.ts` зараз.

## Розбиття на 3 паралельні треки

Залежність між треками — **тільки REST/DB контракти вище**. Спочатку треба зафіксувати їх (Track 1, перший PR — лише міграція БД + index.d.ts типи + порожні handler-stubs з 501). Після того Tracks 2+3 стартують паралельно.

### Track A — Backend: DB, webhook receiver, token storage, register/unregister

**Scope:**

1. Нова міграція `apps/server/src/migrations/008_mono_integration.sql` (схема вище) + `008_mono_integration.down.sql`.
2. `apps/server/src/modules/mono/crypto.ts` — AES-256-GCM helper над `process.env.MONO_TOKEN_ENC_KEY` (32 байти hex). Валідація env у `apps/server/src/config/env.ts` (зараз там же `BANK_FETCH_TIMEOUT_MS` тощо).
3. `apps/server/src/modules/mono/connection.ts` — `connectMono(userId, token)`: викликає `/personal/client-info`, генерує `webhook_secret = randomBytes(32).hex`, `POST /personal/webhook { webHookUrl: ${PUBLIC_BASE_URL}/api/mono/webhook/${secret} }`, на success — UPSERT у `mono_connection` + UPSERT акаунтів у `mono_account`. `disconnectMono` — зворотне.
4. `apps/server/src/modules/mono/webhook.ts` — Express handler `POST /api/mono/webhook/:secret`. Валідує `secret`, парсить payload (`{ type: 'StatementItem', data: { account, statementItem } }`), idempotent UPSERT в `mono_transaction`, оновлює `mono_account.balance` і `mono_connection.last_event_at`. Відповідь **завжди 200** після запису (Monobank ретраїть на не-2xx). Без зайвих зовнішніх викликів у hot path. Метрики: `mono_webhook_received_total{status}`, `mono_webhook_duration_seconds`.
5. Public endpoint registration: `apps/server/src/index.ts` (або де там роутер) — `app.post("/api/mono/webhook/:secret", ...)` без `requireSession`, з body-size cap (наприклад 32 KB), без CORS-обмежень.
6. Тести:
   - `modules/mono/webhook.test.ts` — вірний secret → 200 + DB row; невірний secret → 404; повтор з тим же `mono_tx_id` → ідемпотентний UPSERT; невалідний JSON → 400.
   - `modules/mono/connection.test.ts` — connect/disconnect, mock `bankProxyFetch`.
7. Логи: `pino` з `userId`, `requestId`, `monoAccountId`. **Жодного токена/secret у логах** (фінгерпринт ок).
8. Документація: оновити `.env.example` (`MONO_TOKEN_ENC_KEY`, `PUBLIC_BASE_URL`) + `docs/backend-tech-debt.md` (Bank integrations deep-dive).

**Deliverable:** PR `feat(mono): webhook receiver + persistent connection storage` з міграцією, handler-ами, тестами. Cutover за feature flag `MONO_WEBHOOK_ENABLED` (default `false` поки Tracks B/C не вимергані).

**Acceptance:**

- `pnpm test --filter @sergeant/server` зелений.
- Локально: `curl -X POST localhost:3000/api/mono/connect -H "Cookie: ..." -d '{"token":"<personal token>"}'` → 200, у Monobank webHookUrl видно через `GET /personal/client-info`. Тестова транзакція (карткою на 1 грн) прилітає у `mono_transaction`.

---

### Track B — Backfill, нові read-endpoints, видалення polling

**Scope:**

1. `apps/server/src/modules/mono/backfill.ts` — на `connect` (з Track A) і за `POST /api/mono/backfill` тягне останні 31 день через `bankProxyFetch` (`/personal/statement/{acc}/{from}/{to}`). Послідовно по акаунтах, з 60 s pacing між акаунтами/сторінками; pagination до 20 сторінок як зараз. Idempotent UPSERT у `mono_transaction` (source `'backfill'`). Гард: один backfill-job на user (advisory lock у Postgres або in-memory Map → Redis у майбутньому). Після успіху — `mono_connection.last_backfill_at = NOW()`.
2. `apps/server/src/modules/mono/read.ts` — handler-и `GET /api/mono/accounts`, `GET /api/mono/transactions`, `GET /api/mono/sync-state`. Pagination cursor-based. Schema через `zod` у `apps/server/src/http/schemas.ts`.
3. Видалити з `packages/api-client/src/endpoints/mono.ts` всю pagination/retry-after логіку для `statement`. Залишити `clientInfo` (admin/connect flow). Додати нові: `accounts`, `transactions`, `syncState`, `connect`, `disconnect`, `backfill`.
4. Видалити з web `enqueueStatementCall`, `useMonoStatements` (старий) — переписати у `useMonoTransactions(rangeFrom, rangeTo)` поверх нового endpoint. RQ stale-while-revalidate, `refetchOnWindowFocus: true`. Поки feature flag вимкнений — старий код залишається; перемикач у `useMonobank.ts`.
5. Видалити `tokenStatementQueues`, `MONO_STATEMENT_PAGE_SIZE`/`MAX_PAGES` після cleanup.
6. Тести:
   - `modules/mono/backfill.test.ts` — overlap webhook+backfill дає 1 row (UPSERT), pacing 60 s mock-ом часу.
   - `modules/mono/read.test.ts` — фільтри `from/to/accountId`, cursor pagination.
   - `apps/web/.../useMonoTransactions.test.tsx` — RQ кеш, refetch on focus.
7. `apps/server/src/modules/sync.ts` — якщо є залежність від Mono в загальній sync-точці, синхронізувати.

**Deliverable:** PR `feat(mono): DB-backed reads + backfill, drop client polling`. Має проходити **тільки після Track A merge** (залежить від `mono_*` таблиць).

**Acceptance:**

- `useMonoTransactions` повертає ті ж транзакції, що й колишній `useMonoStatements` для тестового user-а (snapshot test з фікстурою).
- Бенчмарк: 100 paint-ів сторінки `/finyk` → 0 викликів `/personal/statement` (тільки якщо webhook активний).

---

### Track C — Frontend connect flow, settings UX, push, cleanup

**Scope:**

1. `apps/web/src/core/settings/FinykSection.tsx` — переписати connect: токен НЕ зберігається у браузері. На submit → `monoApi.connect(token)` (новий endpoint), на success — invalidate `finykKeys.monoSyncState`. Додати section "Webhook status: active / pending / error", "Last update: 2 хв тому", кнопку "Re-sync (backfill)".
2. Клієнтська міграція токенів: при першому завантаженні якщо `finyk_token`/`finyk_token_remembered` є в storage — auto-POST на `/api/mono/connect`, потім `removeItem`. Після успіху — single "Migrated to webhook" toast (analytics event).
3. `apps/web/src/modules/finyk/hooks/useMonobank.ts` — переписати `connect/disconnect/refresh/fetchMonth` поверх нових endpoint-ів. Видалити `INFO_CACHE_KEY`, `CACHE_KEY`, `LAST_GOOD_KEY`, snapshot fallback (тепер DB є джерелом істини, snapshot потрібен лише для offline — обговорити).
4. `apps/web/src/modules/finyk/FinykApp.tsx` — підключити новий хук, прибрати ручні refresh-and-pray патерни.
5. Видалити з `apps/web/src/shared/lib/storageManager.ts` ключі Mono-токенів. Чистка `apps/web/src/index.css` (якщо там є щось специфічне).
6. UI tests: `useMonobank`, `FinykSection` — vitest + RTL.
7. **Push-нотіфікації — out of scope цього треку**, окремим PR після cutover. Гачок під push (`onTransactionPersisted`) у Track A залишити, але без виклику `webpushSend`.

**Deliverable:** PR `feat(mono): server-side token + webhook UX`. Залежить від Track A (для connect endpoint) і Track B (для read endpoints).

**Acceptance:**

- Після logout/login токен не треба вводити заново (бо тепер у БД).
- На новому пристрої — після login токен підтягується автоматично, транзакції відображаються миттєво з DB.
- Аудит у DevTools: жодних викликів `api.monobank.ua` через `/api/mono?path=/personal/statement/...` від сторінок `/finyk`/`/hub`.

---

## Залежності та порядок робіт

```
Track A (PR1, PR2)
   │
   ├── PR1: міграція БД + порожні endpoint-stubs (501) + зафіксовані типи
   │       (далі Tracks B+C можуть стартувати, бо DTO/contract відомі)
   │
   └── PR2: реальні webhook receiver, connect, disconnect, backfill caller
                      │
                      ├── Track B: backfill + DB reads + drop polling   ─┐
                      │                                                   ├─► cutover (feature flag → on)
                      └── Track C: connect UX, push, cleanup            ─┘
```

PR1 (тільки схема + DTO) має смерджитись першим — це розблоковує B+C паралельно.

## Ризики

1. **HTTPS обов'язково:** Monobank delivery ходить тільки на публічний HTTPS URL. У проді — Railway (`https://sergeant-production.up.railway.app`); на dev — тунель (див. секцію «Dev tunnel»). Replit dev URL також HTTPS і працює.
2. **Webhook secret in URL:** Monobank не підтримує custom HTTP-заголовків у webhook delivery, тому secret кладемо у path. Random 32 байти hex → перебір нерелевантний; ротуємо при reconnect.
3. **Race webhook ↔ backfill:** PK `(user_id, mono_tx_id)` + `INSERT ... ON CONFLICT DO UPDATE` робить це безпечним.
4. **Token rotation:** при connect новим токеном — спочатку `disconnect` старого (skip errors), потім `connect` нового. Якщо у юзера є кілька клієнтів Monobank на тому ж токені — Personal API дозволяє рівно 1 webhookUrl, наша логіка це фіксить.
5. **Migration of existing users:** auto-migrate при першому запуску web (Track C). Користувачі без UA-сесії на сервері (поки що такі є?) — звичайний UX підключення.
6. **Webhook delivery failures:** Monobank ретраїть невдачі ~1 год; якщо наш сервер впав довше — після recovery робимо `backfill` (Track B). `last_event_at` старіше за поріг (наприклад 24 год) → автоматичний backfill крон-ом (опц., можна не у MVP).
7. **Кодогенерація `webHookUrl` у `client-info`:** `MonoClientInfo.webHookUrl` уже є; тести підтвердять, що актуальне поле повертається.
8. **GDPR / Privacy:** токен зберігається encrypted; raw payload транзакцій — JSONB. У PR-ах додати запис у `docs/backend-tech-debt.md` про data retention.
9. **Rate-limit на `/personal/webhook` setup:** Monobank ставить `1 req/60 s` на загальні endpoint-и; якщо webhook setup провалиться — повторюємо raз через 60 с, далі юзер бачить `pending` у UI.

## Хост вебхука

Webhook-доставка має йти **напряму у Railway**, не через Vercel-фронт. Vercel `middleware.ts` уміє проксіювати `/api/*` на Railway, але:

- Vercel Edge має ліміт body / timeout, який невигідно ризикувати на сторонньому трафіку.
- Зайвий хоп = вища latency = більше шансів повторної доставки.
- Webhook URL має бути стабільним; Railway URL стабільніший за Vercel preview.

Отже:

- Production: `PUBLIC_API_BASE_URL=https://sergeant-production.up.railway.app` (Railway env).
- Vercel env лишається без змін (`BACKEND_URL` уже вказує туди).
- Webhook URL, який реєструємо у Monobank: `${PUBLIC_API_BASE_URL}/api/mono/webhook/${secret}`.

## Dev tunnel

Для локального тестування webhook:

```bash
# варіант 1 — Cloudflare Tunnel (без реєстрації)
brew install cloudflared    # або apt-get install cloudflared / scoop install cloudflared
cloudflared tunnel --url http://localhost:3000
# скопіювати https://...trycloudflare.com у PUBLIC_API_BASE_URL

# варіант 2 — ngrok
ngrok http 3000
# скопіювати https://....ngrok-free.app у PUBLIC_API_BASE_URL
```

Після старту тунеля:

```bash
export PUBLIC_API_BASE_URL=https://abc-123.trycloudflare.com
pnpm --filter @sergeant/server dev
# і у web-секції налаштувань Finyk підключити Mono token — server зареєструє webHookUrl
```

Додати у `docs/railway-vercel.md` посилання на цю секцію та згадати у `.env.example`.

## Cutover plan

1. PR1 (Track A: schema + stubs) → merge → деплой міграції.
2. PR2 (Track A: real handlers за фічфлагом `MONO_WEBHOOK_ENABLED=false`) → merge.
3. Tracks B+C паралельно.
4. Smoke на prod з тестовим юзером (фічфлаг `MONO_WEBHOOK_ENABLED=true` тільки для нього).
5. 24 год спостереження за `mono_webhook_received_total` і error-rate.
6. Якщо ОК — фічфлаг на всіх; видаляємо старий polling-код у наступному PR.

## Status log

| Дата       | PR    | Track   | Результат                                                                                                                                                                                             |
| ---------- | ----- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-25 | #695  | —       | План змерджено.                                                                                                                                                                                       |
| 2026-04-25 | #697  | A.PR1   | DB-міграція `008_mono_integration.sql` + DTO стаби.                                                                                                                                                   |
| 2026-04-25 | #699  | A.PR2   | Webhook receiver, AES-GCM шифрування токена, connect/disconnect.                                                                                                                                      |
| 2026-04-25 | #700  | B       | DB-backed `/api/mono/{accounts,transactions,sync-state,backfill}`, backfill 31д, `useMonoTransactions`.                                                                                               |
| 2026-04-25 | #702  | C       | Frontend connect flow, settings UX, auto token migration.                                                                                                                                             |
| 2026-04-25 | (ops) | cutover | Виставлено `MONO_WEBHOOK_ENABLED=true`, `MONO_TOKEN_ENC_KEY`, `PUBLIC_API_BASE_URL` на Railway. Міграцію 008 застосовано вручну на проді (див. PR #704 — фікс білда). Smoke-тест webhook delivery ОК. |
| 2026-04-25 | #704  | ops     | Fix: `build.mjs` тепер копіює `src/migrations/*.sql` у `dist-server/migrations` (раніше Pre-Deploy job мовчки no-op-ив).                                                                              |
| 2026-04-25 | (TBD) | rollout | `mono_webhook` default → `true`, прибрано `experimental`.                                                                                                                                             |
| TBD        | TBD   | cleanup | Видалено `useMonobankLegacy`, `enqueueStatementCall`, `useMonoStatements`, snapshot fallback, ключі `finyk_token*`.                                                                                   |
