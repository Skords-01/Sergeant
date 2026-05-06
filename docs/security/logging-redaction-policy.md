# Logging redaction policy

> **Last validated:** 2026-05-06 by @Skords-01. **Next review:** 2026-08-04.
> **Status:** Active. Hard Rule #21.

| Поле            | Значення                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **Scope**       | `apps/server/src/**` (server logs) + `apps/server/src/sentry.ts` (Sentry events)               |
| **Sources**     | `apps/server/src/obs/logger.ts` — Pino-redaction, `apps/server/src/sentry.ts` — beforeSend     |
| **Enforcement** | `sergeant-design/no-raw-request-in-logger` (ESLint, error) + Vitest `logger.test.ts`           |
| **Initiative**  | [stack-pulse-2026-05 PR-16](../initiatives/stack-pulse-2026-05/pr-16-pino-redaction-policy.md) |

## TL;DR

1. **Pino redaction is path-based.** Один список `redactPaths` у [`apps/server/src/obs/logger.ts`](../../apps/server/src/obs/logger.ts) — джерело істини. Pino замінює значення за цими шляхами на `[redacted]` ще до того, як рядок потрапляє у `stdout` (а звідти — у Railway / Loki / Grafana).
2. **Sentry redaction is key-based.** `applyBeforeSend` у [`apps/server/src/sentry.ts`](../../apps/server/src/sentry.ts) ходить рекурсивно по `event.extra/contexts/breadcrumbs.data` і маскує значення за іменем ключа — список `redactKeyNames` синхронізований з Pino-paths.
3. **Lint guardrail.** ESLint-rule `sergeant-design/no-raw-request-in-logger` блокує `logger.info(req)`, `{ ...req }`, `{ body: req.body }` — патерни, які обходять path-based redaction.

## Чому path-based редакція потребує lint-guardrail

Pino-redact матчить **літеральні шляхи** (`req.headers.authorization`) або wildcard-шляхи фіксованої глибини (`*.password`). Якщо логер отримує payload з іншою формою, шлях не збігається — і секрет тікає у plaintext:

```ts
// ❌ Direct: shape є `{ headers: {...}, body: {...} }` — без префіксу `req.*`,
// тож redact-path `req.headers.authorization` не спрацьовує.
logger.info(req); // headers.authorization → leaked

// ❌ Spread: ключі піднімаються у root логу.
logger.info({ ...req }); // root.headers.authorization → leaked

// ❌ Re-key: payload змінює форму. `body.password` ≠ `req.body.password`.
logger.info({ body: req.body }); // body.password → leaked
```

ESLint-rule [`sergeant-design/no-raw-request-in-logger`](../../packages/eslint-plugin-sergeant-design/index.js) ловить ці три патерни і пропонує канонічну заміну:

```ts
// ✅ pino-http serializer розгортає `req` у `{ method, url, headers, query }`
//    і застосовує `redactPaths` на правильні шляхи (`req.headers.authorization`).
logger.info({ req });

// ✅ Явний destructure — лише ті поля, які гарантовано не несуть секретів.
logger.info({
  method: req.method,
  url: req.originalUrl,
  status: res.statusCode,
});
```

## Redaction list — single source of truth

[`apps/server/src/obs/logger.ts`](../../apps/server/src/obs/logger.ts) експортує два списки:

- **`redactPaths`** (≥ 60 шляхів) — споживається `pino`-конструктором. Покриває:
  - Auth-headers: `req.headers.authorization`, `req.headers.cookie`, `req.headers["x-csrf-token"]`, `req.headers["x-api-key"]`, `req.headers["x-token"]`.
  - Webhook-headers (M3): `req.headers["x-mono-webhook-secret"]`, `req.headers["x-openclaw-webhook-secret"]`, `req.headers["x-api-secret"]`, `req.headers["x-internal-token"]`.
  - Body-fields для login/register: `req.body.password`, `req.body.token`, `req.body.currentPassword`, `req.body.newPassword`.
  - Tokens / secrets (root + 1-2 рівні): `password`, `token`, `accessToken`, `refreshToken`, `idToken`, `sessionToken`, `apiKey`, `secret`, `clientSecret`, `privateKey`, `signature`, `dsn`, `connectionString`.
  - Provider keys (M3): `groqKey`, `anthropicKey`, `voyageKey`.
  - Axios error config: `err.config.headers.Authorization`, `err.config.headers.Cookie`.
  - PII (email/phone): `email`, `phone`, плюс `*.email` / `*.phone` / `req.body.email` / `res.body.email`.

- **`redactKeyNames`** (≥ 30 імен) — споживається `applyBeforeSend` у `sentry.ts`. Імена нормалізуються до lowercase і матчаться рекурсивно. Будь-яке нове ім'я тут **обов'язково** дублюється у `redactPaths` (інакше Sentry зачистить, а Pino — ні).

## Sentry-Pino contract

`applyBeforeSend` у [`apps/server/src/sentry.ts`](../../apps/server/src/sentry.ts) імпортує `redactKeyNames` напряму з `logger.ts`, тому drift між двома списками неможливий. Контракт:

| Поверхня             | Механізм                                                              | Покриття                                          |
| -------------------- | --------------------------------------------------------------------- | ------------------------------------------------- |
| Pino → stdout / Loki | `pino({ redact: { paths: redactPaths } })`                            | Path-based, fixed-depth wildcards (`*.password`). |
| Sentry events        | `applyBeforeSend` → `scrubPII(event.extra/contexts/breadcrumbs.data)` | Key-based, recursive (`redactKeyNames`).          |
| Sentry breadcrumbs   | `applyBeforeBreadcrumb` → `scrubPII(breadcrumb.data)`                 | Key-based + URL-redaction (`redactSensitiveUrl`). |
| Sentry request URL   | `applyBeforeSend` → `redactSensitiveUrl(event.request.url)`           | C1 webhook-secret-у-path-і.                       |
| Sentry user-payload  | `applyBeforeSend` → strip до `{id, ip_address}`                       | `sendDefaultPii: false` + duplicate-захист.       |

Якщо додаєш нове чутливе поле:

1. Додай шлях(и) у `redactPaths` — **та** ім'я у `redactKeyNames`.
2. Розширюй wildcard-набір якщо очікуєш > 2 рівнів вкладеності.
3. Додай assertion у `apps/server/src/obs/logger.test.ts` (один-два рядки на новий ключ).

## ESLint-rule `sergeant-design/no-raw-request-in-logger`

Деталі — у [`packages/eslint-plugin-sergeant-design/index.js`](../../packages/eslint-plugin-sergeant-design/index.js) (рег-id `no-raw-request-in-logger`). Шорт-форма:

| Що ловить                                         | Приклад                           | Чому це leak                                                              |
| ------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| Direct raw `req` / `res`                          | `logger.info(req)`                | Без `req.*` префіксу — path-based redaction не спрацює.                   |
| Spread (`...req` / `...res`)                      | `logger.info({ ...req })`         | Ключі піднімаються у root, поза `req.headers.*` redact-paths.             |
| Re-key (`body: req.body`, `headers: res.headers`) | `logger.info({ body: req.body })` | Форма payload-у змінилась → `req.body.password` ≠ `body.password` → leak. |

Що **не** ловить:

- `logger.info({ req })` — канонічний shorthand. pino-http stdSerializer розгортає у `{method, url, headers, query}` під префіксом `req.*`.
- Явний destructure: `logger.info({ method: req.method, url: req.originalUrl })`. Чисто, бо немає secret-bearing полів.
- Виклики поза server (`apps/web/src/**`, `apps/mobile/src/**`) — рул scope обмежений `apps/server/src/**`.
- Сам файл `apps/server/src/obs/logger.ts` (`LOGGER_FILE_PATH_RE` виняток) — там визначається сам redaction-list.

## Тестування

```bash
# Pino redaction smoke-test (40+ assertions).
pnpm --filter @sergeant/server test logger.test.ts

# ESLint-rule unit test (34 cases — direct/spread/rekey/safe/file-scope).
node packages/eslint-plugin-sergeant-design/__tests__/no-raw-request-in-logger.test.mjs

# Repo-wide lint — переконатись що 0 violations існуючих логер-callsite-ів.
pnpm --filter @sergeant/server lint
```

## Чого ця політика не покриває

- **Outbound HTTP-логи через axios/fetch.** Якщо явно логуєш `response.data` від зовнішнього API — це окрема відповідальність caller-а; ми не можемо знати схему чужого API.
- **OpenTelemetry / spans.** Span-attributes мають свій pipeline — див. [`docs/adr/0035-distributed-tracing-opentelemetry.md`](../adr/0035-distributed-tracing-opentelemetry.md).
- **DB-query-логи (Drizzle).** Drizzle логер за замовчуванням вимкнений у prod; якщо вмикається — це окремий audit (PR не покриває).
- **Web-side console.log.** PR покриває server-side. Web-side має `no-anthropic-key-in-logs` як defense-in-depth, але full audit web-логів — окрема ініціатива.

## Історія

| Дата       | Подія                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-05-04 | M3 close-out — `redactPaths` розширено на webhook-secret-headers, provider keys, axios `err.config`, login/register body fields. Sentry `redactKeyNames` синхронізовано. |
| 2026-05-06 | PR-16 — введено `sergeant-design/no-raw-request-in-logger` ESLint rule, формалізовано Hard Rule #21, винесено політику у цей доку.                                       |

## Посилання

- [`apps/server/src/obs/logger.ts`](../../apps/server/src/obs/logger.ts) — джерело істини redaction.
- [`apps/server/src/obs/logger.test.ts`](../../apps/server/src/obs/logger.test.ts) — юніт-тести redaction.
- [`apps/server/src/sentry.ts`](../../apps/server/src/sentry.ts) — `applyBeforeSend` + `scrubPII`.
- [`packages/eslint-plugin-sergeant-design/index.js`](../../packages/eslint-plugin-sergeant-design/index.js) — `no-raw-request-in-logger`.
- [`docs/security/hardening/M3-pino-redact-paths.md`](./hardening/M3-pino-redact-paths.md) — попередній round redaction-coverage.
- [`docs/security/pii-handling.md`](./pii-handling.md) — ширша PII-policy.
- [stack-pulse PR-16 plan](../initiatives/stack-pulse-2026-05/pr-16-pino-redaction-policy.md).
