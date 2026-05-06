# PR-16: Pino redaction policy + ESLint guard

> **Last validated:** 2026-05-06 by Devin. **Next review:** 2026-08-04.
> **Status:** In review — [#2088](https://github.com/Skords-01/Sergeant/pull/2088)

|              |                                                                |
| ------------ | -------------------------------------------------------------- |
| **Severity** | High (H10)                                                     |
| **Owner**    | @Skords-01                                                     |
| **Effort**   | 1 день                                                         |
| **Risk**     | Low (additive: захищає, не ламає існуюче)                      |
| **Touches**  | `apps/server/src/obs/logger.ts`, ESLint config, кожен callsite |

## Контекст

```ts
// apps/server/src/obs/logger.ts (приблизно)
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // redact: <empty or partial>
});
```

Pino підтримує `redact: { paths: [...], censor: "[REDACTED]" }`. Sergeant має багато sensitive-полів:

- `Authorization` header
- `Cookie` / `Set-Cookie`
- `password`, `token`, `apiKey`, `secret`, `dsn`, `connectionString`
- `email` (PII за GDPR)
- Better Auth session tokens
- Anthropic API key

Якщо logger.info(req) — без redaction — ці поля **попадають у Sentry breadcrumbs + Pino-output**. Sentry має server-side scrubbing, але:

1. Локальні logs (Railway) не scrubb-ляться.
2. Не всі полів охоплює default Sentry-список.

## Scope

### 1. Configure pino-redaction

```ts
import pino from "pino";

export const logger = pino({
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-api-key']",
      "req.body.password",
      "req.body.token",
      "req.body.apiKey",
      "*.password",
      "*.token",
      "*.apiKey",
      "*.secret",
      "*.dsn",
      "*.connectionString",
      "*.privateKey",
      "user.email",
      "session.token",
    ],
    censor: "[REDACTED]",
    remove: false,
  },
  level: env.LOG_LEVEL,
  base: { service: "sergeant-server", commit: env.COMMIT_SHA },
});
```

### 2. ESLint guard

- Custom rule (extension `packages/eslint-plugin-sergeant-design/`):
  - Disallow `console.log` у `apps/server/src/` (вже є?).
  - Disallow `logger.info(req)` без destructure — змусити явно вказати fields для logging.
  - Або: warn на будь-якому `logger.x(<variable з типом Request | Response | Headers>)` — потенційний leak.

### 3. Audit + sweep

- grep `logger\.(info|warn|error|debug)` у `apps/server/src/` → перевірити, які з них можуть включити sensitive payload.
- Спершу автоматичний sweep, потім manual review high-risk files (`auth.ts`, `webhooks/*.ts`).

### 4. Sentry parity

- `apps/server/src/sentry.ts` — `beforeSend` hook видаляє чорний-список полів у extra/contexts. Sync з pino-redaction-list.

### 5. Documentation

- `docs/security/logging-redaction-policy.md` — явні правила, ownership-line, як додати нове поле.
- `docs/governance/hard-rules-registry.json` — нове правило «Logging-redaction-required».

## Out of scope

- Перейти на structured-logging libraries beyond pino (winston / bunyan) — не виграш.
- Video / image redaction (не logger-related).

## Acceptance criteria (DoD)

- [x] `apps/server/src/obs/logger.ts` має enforced `redact:` config з ≥15 paths (наразі ~60 paths + 30 key-names — single source of truth).
- [x] Pino unit-test: `logger.info({ password: "x" })` → output має `[redacted]`, не `"x"`. Перевірено у `apps/server/src/obs/logger.test.ts` (45/45 passing).
- [x] ESLint rule active + 0 violations у server-tree (`pnpm --filter @sergeant/server lint` → 0 errors, 4 pre-existing warns).
- [x] `docs/security/logging-redaction-policy.md` описаний.
- [x] Hard rule зареєстрований — Hard Rule #21 у `AGENTS.md` + `CONTRIBUTING.md` + `docs/governance/hard-rules.json`.
- [x] Sentry `beforeSend` синхронізований — `applyBeforeSend` імпортує `redactKeyNames` з `logger.ts` (no drift).

## Outcome

- ESLint rule `sergeant-design/no-raw-request-in-logger` ловить три патерни (direct `logger.info(req)`, spread `{ ...req }`, re-key `{ body: req.body }`) — 34 unit-тестів.
- Existing Pino redaction (60+ paths) зафіксовано як hard contract; нові поля додаються одночасно у `redactPaths` (Pino) і `redactKeyNames` (Sentry-`applyBeforeSend`).
- Single-page reference: [`docs/security/logging-redaction-policy.md`](../../security/logging-redaction-policy.md).

## Тести

- `apps/server/src/obs/__tests__/logger.test.ts` — для кожної path-rule, перевірити redaction.
- ESLint test (snapshot-based): негативний приклад `logger.info(req)` має fail.

## Rollout

- Single PR. Якщо ESLint rule блокує занадто багато existing code → split на 2 PR (rule first as warning, fix sweep, then promote to error).

## Risks & mitigations

| Risk                                                | Mitigation                                                            |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| `req.body` має арбітрарну shape, redaction промахне | Wildcard paths (`*.password`, `*.token`) ловлять довільну вкладеність |
| Performance impact на gigabyte-логах                | Pino redaction native, ~5% overhead — acceptable                      |

## Touchpoints (file:line)

- `apps/server/src/obs/logger.ts`
- `apps/server/src/sentry.ts` — beforeSend sync
- `packages/eslint-plugin-sergeant-design/` — нове правило
- `docs/security/logging-redaction-policy.md` — новий
- `docs/governance/hard-rules-registry.json` — додати rule

## Refs

- [Pino redaction docs](https://github.com/pinojs/pino/blob/main/docs/redaction.md)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- ADR (якщо є) на observability strategy
