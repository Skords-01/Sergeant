# Agents in Sergeant

> Last reviewed: 2026-04-26. Reviewer: @Skords-01

## Repo overview

- **pnpm 9** + **Turborepo** monorepo, **Node 20**, **TypeScript 6**.
- **Apps** (4):
  - `apps/web` — Vite + React 18 SPA (frontend).
  - `apps/server` — Express + PostgreSQL (`pg`) + Better Auth (API).
  - `apps/mobile` — Expo 52 + React Native 0.76.
  - `apps/mobile-shell` — Capacitor wrapper for the web app.
- **Packages** (9): `@sergeant/shared`, `@sergeant/api-client`, `@sergeant/config`, `@sergeant/design-tokens`, `@sergeant/insights`, and 4 domain packages (`@sergeant/finyk-domain`, `@sergeant/fizruk-domain`, `@sergeant/nutrition-domain`, `@sergeant/routine-domain`).
- Pre-commit: **Husky** runs `lint-staged` (ESLint --fix + Prettier).

## Module ownership map

Quick lookup before editing: which path uses which test stack and which conventions are mandatory.

| Path                                                  | Test stack                              | RQ keys factory                       | Notes                                                                                                                                                           |
| ----------------------------------------------------- | --------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/modules/finyk/**`                       | Vitest + MSW + RTL                      | `finykKeys`                           | Tailwind, localStorage. Mono webhooks → `monoWebhook*` keys.                                                                                                    |
| `apps/web/src/modules/fizruk/**`                      | Vitest + MSW + RTL                      | (none yet — local-first via MMKV-web) | Workouts/sets are local-first. Cloud sync via `cloudsync` queue.                                                                                                |
| `apps/web/src/modules/nutrition/**`                   | Vitest + MSW + RTL                      | `nutritionKeys`                       | OFF = OpenFoodFacts; barcode scans share cache key with meal-sheet.                                                                                             |
| `apps/web/src/modules/routine/**`                     | Vitest + RTL                            | (local-first)                         | Habits + streaks; rely on Kyiv-day boundary (see Domain invariants).                                                                                            |
| `apps/web/src/core/**`                                | Vitest + RTL + (MSW for fetch)          | `hubKeys`, `coachKeys`, `digestKeys`  | HubChat, OnboardingWizard, dashboard. Quick actions registry lives here.                                                                                        |
| `apps/web/src/core/lib/chatActions/**`                | Vitest + RTL                            | n/a                                   | HubChat tool handlers. Повертають `string` для `tool_result`. Пишуть у localStorage тільки через `ls`/`lsSet`. Тест: happy path + error path кожного handler-а. |
| `apps/web/src/shared/**`                              | Vitest                                  | factories defined here                | Pure utils. No React.                                                                                                                                           |
| `apps/server/src/modules/**`                          | Vitest + Testcontainers (real Postgres) | n/a                                   | Always coerce bigint→number in serializers (rule #1). Update `api-client` types.                                                                                |
| `apps/server/src/modules/chat/**`                     | Vitest                                  | n/a                                   | Anthropic tool defs split per domain in `toolDefs/`. See Architecture section.                                                                                  |
| `apps/server/src/migrations/**`                       | n/a                                     | n/a                                   | Sequential `NNN_*.sql` (currently 001–008). No gaps. Two-phase for DROP — see rule #4.                                                                          |
| `apps/mobile/src/core/**`                             | Vitest (3 known flaky — see below)      | (mobile RQ uses module-local keys)    | NativeWind (not Tailwind). MMKV (not localStorage). No DOM.                                                                                                     |
| `apps/mobile/app/**`                                  | Vitest                                  | n/a                                   | Expo Router routes. Each `_layout.tsx` is a navigator.                                                                                                          |
| `apps/mobile-shell/**`                                | none                                    | n/a                                   | Capacitor wrapper around `apps/web`. No app code lives here, only build glue.                                                                                   |
| `packages/shared/**`                                  | Vitest                                  | n/a                                   | Zod schemas, types, business logic. Used by all apps — change with care.                                                                                        |
| `packages/api-client/**`                              | Vitest                                  | n/a                                   | HTTP clients + types. Must mirror `apps/server/src/modules/*` response shapes.                                                                                  |
| `packages/insights/**`                                | Vitest                                  | n/a                                   | Cross-module analytics. Pure functions over normalized data.                                                                                                    |
| `packages/{finyk,fizruk,nutrition,routine}-domain/**` | Vitest                                  | n/a                                   | Domain logic shared web ↔ mobile (e.g., kcal math, budget computations).                                                                                        |
| `packages/eslint-plugin-sergeant-design/**`           | `node --test` (`__tests__/*.mjs`)       | n/a                                   | Custom ESLint rules. Run via `pnpm lint:plugins`.                                                                                                               |

## Hard rules (do not break)

### 1. DB types: coerce `bigint` to `number` in serializers

The `pg` driver returns `bigint` as **string** (see [#708](https://github.com/Skords-01/Sergeant/issues/708)). Always coerce in the serializer, never let it leak to API consumers.

```ts
// ❌ BAD — bigint leaks as string to client; arithmetic breaks silently
return rows.map((r) => ({
  id: r.id, // string!
  amount: r.amount, // string!
}));

// ✅ GOOD — explicit Number() in the serializer
return rows.map((r) => ({
  id: Number(r.id),
  amount: Number(r.amount),
}));
```

Snapshot tests in `apps/server/src/modules/*` lock the shapes — if the snapshot diff shows a stringified number, you forgot the coercion.

### 2. RQ keys: only via centralized factories

All `useQuery`/`useMutation` keys come from `apps/web/src/shared/lib/queryKeys.ts`. Factories: `finykKeys`, `nutritionKeys`, `hubKeys`, `coachKeys`, `digestKeys`, `pushKeys`.

```ts
// ❌ BAD — drift; impossible to bulk-invalidate; typos compile
useQuery({ queryKey: ["finyk", "transactions", accountId], ... });

// ✅ GOOD — typed factory, supports bulk invalidate via `finykKeys.all`
import { finykKeys } from "@shared/lib/queryKeys";
useQuery({
  queryKey: finykKeys.monoTransactionsDb(from, to, accountId),
  ...
});
```

Secrets (Mono token, etc.) **must** be hashed via `hashToken()` before going into a key — they leak into devtools / logs otherwise.

### 3. API contract: server response shape ↔ `api-client` types ↔ test

When you change a JSON response shape in `apps/server/src/modules/*`, three things move together:

```diff
  // apps/server/src/modules/finyk/transactionsHandler.ts
  return rows.map((r) => ({
    id: Number(r.id),
+   merchantCategory: r.mcc ? String(r.mcc) : null,
    amount: Number(r.amount),
  }));
```

```diff
  // packages/api-client/src/endpoints/finyk.ts
  export interface MonoTransaction {
    id: number;
+   merchantCategory: string | null;
    amount: number;
  }
```

```diff
  // apps/server/src/modules/finyk/transactionsHandler.test.ts
  expect(result).toMatchInlineSnapshot(`
    {
      "id": 42,
+     "merchantCategory": "5411",
      "amount": 250,
    }
  `);
```

If you change only one — CI will pass but consumers break. Always do all three in the same PR.

### 4. SQL migrations: sequential, no gaps, two-phase for DROP

Files in `apps/server/src/migrations/` use the pattern `NNN_description.sql` (currently 001–008). Pre-deploy: `pnpm db:migrate` (Railway). The build step copies them via `apps/server/build.mjs` (fixed in [#704](https://github.com/Skords-01/Sergeant/issues/704)).

- **Adding a column:** single file `NNN_add_foo.sql`. Make it `NULL`-able or `DEFAULT`-ed so old code keeps working.
- **Renaming/removing a column:** **two phases**, deployed **separately**:

```sql
-- Phase 1: NNN_add_new_amount.sql (deployed first; old code unaffected)
ALTER TABLE transactions ADD COLUMN amount_minor BIGINT;
UPDATE transactions SET amount_minor = (amount * 100)::BIGINT;
-- Code is updated to write BOTH columns and read the new one.

-- Phase 2: (N+M)_drop_old_amount.sql (deployed only after phase 1 is live)
ALTER TABLE transactions DROP COLUMN amount;
```

Never drop a column in the same release as the code that stops writing to it — Railway pre-deploy migrates before the new app starts, so the old version (briefly serving traffic) will crash.

A `down.sql` companion (e.g. `008_mono_integration.down.sql`) is for local rollbacks. Production never runs `down.sql`.

### 5. Conventional Commits: explicit scope enum

Format: `<type>(<scope>): <subject>`. Allowed types: `feat`, `fix`, `docs`, `chore`, `refactor`, `perf`, `test`, `build`, `ci`.

**Scopes (use one of these — do not invent new ones):**

| Scope              | When to use                                                       |
| ------------------ | ----------------------------------------------------------------- |
| `web`              | `apps/web/**`                                                     |
| `server`           | `apps/server/**` (excluding migrations alone)                     |
| `mobile`           | `apps/mobile/**`                                                  |
| `mobile-shell`     | `apps/mobile-shell/**`                                            |
| `shared`           | `packages/shared/**`                                              |
| `api-client`       | `packages/api-client/**`                                          |
| `finyk-domain`     | `packages/finyk-domain/**`                                        |
| `fizruk-domain`    | `packages/fizruk-domain/**`                                       |
| `nutrition-domain` | `packages/nutrition-domain/**`                                    |
| `routine-domain`   | `packages/routine-domain/**`                                      |
| `insights`         | `packages/insights/**`                                            |
| `design-tokens`    | `packages/design-tokens/**`                                       |
| `config`           | `packages/config/**`                                              |
| `eslint-plugins`   | `packages/eslint-plugin-sergeant-design/**`                       |
| `migrations`       | `apps/server/src/migrations/**` only                              |
| `deps`             | Renovate / dependency-only PRs                                    |
| `docs`             | `docs/**`, `README.md`, `AGENTS.md`, `CONTRIBUTING.md`            |
| `ci`               | `.github/workflows/**`, `turbo.json`, scripts under `scripts/`    |
| `root`             | Repo-level config (`pnpm-workspace.yaml`, `package.json` at root) |

If a PR genuinely spans multiple scopes (rare), use the most "user-visible" one and explain in the body. **Do not invent** scopes like `monorepo`, `app`, `core`, `all`.

### 6. No force push to main/master

`--force-with-lease` on feature branches is OK.

### 7. Pre-commit hooks via Husky — do not skip

`--no-verify` is forbidden. If a hook is broken, fix the hook in the same PR; do not bypass it.

## AI markers

Structured comments for AI-agent context. Enforced by ESLint rule `sergeant-design/ai-marker-syntax` (warn).

| Marker                             | Purpose                                                                    | Example                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `// AI-NOTE: <text>`               | Contextual hint for future AI agents (not a human TODO)                    | `// AI-NOTE: coerce bigint→number; see rule #1`                                         |
| `// AI-CONTEXT: <text>`            | Architectural decision — _why_, not _what_ (rationale future AI must know) | `// AI-CONTEXT: tool виконується на клієнті — localStorage local-first, без round-trip` |
| `// AI-DANGER: <text>`             | High-risk zone — AI should confirm before changing                         | `// AI-DANGER: timing-safe comparison is critical here`                                 |
| `// AI-GENERATED: <generator>`     | File is generated — edit the generator, not this file                      | `// AI-GENERATED: from codegen.ts`                                                      |
| `// AI-LEGACY: expires YYYY-MM-DD` | Temporary code scheduled for removal                                       | `// AI-LEGACY: expires 2026-06-01`                                                      |

**Rules:**

- Use exactly these 5 prefixes followed by a colon and a space.
- Malformed variants (`AI-NOTES`, `AINOTE`, `AI_NOTE`, missing colon) trigger a lint warning.
- Do not spam markers — use only where they add genuine context for AI.
- `AI-NOTE` vs `AI-CONTEXT`: use `AI-NOTE` for short pointer-style hints ("see rule #1", "keep order stable"). Use `AI-CONTEXT` to record the _reason_ behind a non-obvious architectural choice that an agent might otherwise "clean up" (e.g. why two systems coexist, why a value is duplicated, why a sync write is intentional). The `sergeant-design/ai-marker-syntax` ESLint rule currently validates the original four prefixes; `AI-CONTEXT` is accepted but not yet enforced — extend the plugin in a follow-up if drift becomes a problem.

## Domain invariants

Things that bite hard if assumed wrong.

### Time and dates

- **Single source of truth: Europe/Kyiv.** All "today / yesterday / this week" UI logic computes day boundaries against `Europe/Kyiv` (UTC+2/+3 with DST).
- **Storage:** `timestamptz` in Postgres (UTC at rest), but read with `timezone('Europe/Kyiv', ts)` when bucketing by day in SQL.
- **Day key format:** `YYYY-MM-DD` interpreted in Kyiv local time. This is what `coachKeys.insight(dayKey)`, `digestKeys.byWeek(weekKey)`, and Routine streaks use.
- **Week start:** Monday (ISO 8601). `weekKey` = `YYYY-Www`.
- **Don't** use `new Date().toISOString().slice(0,10)` — it gives a UTC day, which flips a day at 21:00–22:00 Kyiv time and breaks Routine streaks for late-evening users.

### Money (UAH)

- **Database & API: minor units (kopiykas) as `number`** after bigint coercion. Mono webhook delivers minor units; we keep that representation through the stack.
- **UI display:** divide by 100 at render time only. For Finyk transactions and balances use `fmtAmt(minor, currencyCode?)` from `@sergeant/finyk-domain/lib/formatting` — it handles `+`/`-` sign and currency symbol consistently. For other contexts (insights, dashboards) write a thin local helper that wraps `(minor / 100).toLocaleString("uk-UA", { minimumFractionDigits: 2 })` rather than re-inlining the math at every call site.
- **Negative = expense, positive = income.** Match Mono's convention; transfers between own accounts come as a pair (-X on source, +X on destination) and are netted in budget calculations, not summed.

### Identity

- User IDs are Better Auth opaque strings (e.g. `I3BUW5atld8oOHM7lpFEJBIInpW1hzv7`). Do not assume UUID format. Cookies are HTTP-only; auth in tests goes via Better Auth test session helpers.

## Architecture: AI tool execution path

The HubChat assistant uses Anthropic tool-calling. Tools are **defined on the server**, **executed on the client** — server is a thin pass-through:

```
┌─────────────────┐    POST /api/chat        ┌────────────────────────┐
│ HubChat (web)   │ ──────────────────────▶  │ apps/server            │
│ apps/web/src/   │                          │ src/modules/chat/      │
│ core/HubChat.   │                          │  - chat.ts (handler)   │
│ tsx             │                          │  - tools.ts (TOOLS)    │
└─────────────────┘                          │  - toolDefs/*.ts       │
        ▲                                    └───────────┬────────────┘
        │ stream: text + tool_use blocks                 │
        │                                                ▼
        │                                    ┌────────────────────────┐
        │                                    │ Anthropic Messages API │
        │                                    │ (streaming, with tools)│
        │                                    └───────────┬────────────┘
        │                                                │
        │ ◀──────────────────────────────────────────────┘
        │
        ▼ tool_use{name,input}
┌──────────────────────────────────────┐
│ Client executor                      │
│ apps/web/src/core/lib/               │
│  hubChatActions.ts                   │
│   ├─ create_transaction → localStorage / api-client
│   ├─ log_meal → localStorage / api-client
│   ├─ start_workout → MMKV-web
│   ├─ mark_habit_done → localStorage
│   └─ … (one handler per tool)
└──────────────────────────────────────┘
        │ result text
        ▼ tool_result block sent back to model
┌──────────────────────────────────────┐
│ ChatMessage renders markdown + cards │
│ via hubChatActionCards.ts mapper     │
└──────────────────────────────────────┘
```

**Implications when changing tools:**

- A new tool needs three coordinated edits: `apps/server/src/modules/chat/toolDefs/<domain>.ts` (definition), `apps/web/src/core/lib/hubChatActions.ts` (executor), and (if user-visible) `hubChatActionCards.ts` + optionally `hubChatQuickActions.ts`.
- The server **does not** run tool side effects — never put DB writes in `chat.ts`. They go through the regular `apps/server/src/modules/<domain>/*` HTTP endpoints, called by the client executor.
- "Risky" tools (delete/forget/import) live in `RISKY_TOOLS` in `hubChatActionCards.ts` and get a "Критична дія" badge in the UI.

### `max_tokens` budget per request

`apps/server/src/modules/chat.ts` uses two distinct `max_tokens` values, intentionally:

| Request                      | `max_tokens` | Where (chat.ts)                 | Why                                                                                             |
| ---------------------------- | ------------ | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| First user-message chat call | **600**      | line ~171, payload to Anthropic | Enough for a tool call + short reply, or a 2–4-sentence answer.                                 |
| Tool-result continuation     | **400**      | line ~114, follow-up payload    | Just enough to summarise the tool result; the model already "used" its budget on the tool call. |

Do **not** lower these without testing the worst-case `/help` response and the largest tool-result blob.
When Anthropic returns `stop_reason: "max_tokens"`, the model may truncate **mid-JSON-tool-call**— the client `executeAction` then throws a parse error and the user sees "Невідома дія". If you need a longer system prompt or more tools, raise `max_tokens` first; do not silently squeeze the budget.

### `SYSTEM_PREFIX` is a prompt-cache candidate

`SYSTEM_PREFIX` (in `apps/server/src/modules/chat/toolDefs/systemPrompt.ts`) is the same on every request — only the appended `context` block varies. That makes it the natural target for Anthropic prompt caching (`cache_control: { type: "ephemeral" }` on the `system` array). Two consequences:

1. **Don't churn `SYSTEM_PREFIX`.** Each edit invalidates the cache for every active user, so a casual wording tweak can briefly multiply Anthropic spend. Batch prompt changes; bump a `SYSTEM_PROMPT_VERSION` constant when wiring caching so cache misses are observable.
2. **`context` (the dynamic data block) must stay outside the cached segment.** When caching is wired, the cached prefix is `SYSTEM_PREFIX` only; the per-user `context` is appended as a separate, non-cached `text` block.

See the `enable-prompt-caching` playbook for the actual rollout steps.

## Performance budgets

CI gates fail when these regress. Numbers come from `apps/web/package.json` → `"size-limit"` and the `Bundle size guard` workflow step ([#740](https://github.com/Skords-01/Sergeant/pull/740)).

| Metric                                | Budget             | Where enforced                                      |
| ------------------------------------- | ------------------ | --------------------------------------------------- |
| `apps/web` JS total (brotli)          | **≤ 615 kB**       | `pnpm --filter @sergeant/web exec size-limit` in CI |
| `apps/web` CSS (brotli)               | **≤ 18 kB**        | same                                                |
| Backend `/health` p95                 | < 100 ms           | (informal; track in Railway logs)                   |
| Anthropic `/api/chat` p95 first token | < 1.5 s            | (informal; will move to PostHog/Sentry once wired)  |
| Test suite total wall time            | < 60 s per package | turbo cache makes this implicit                     |

If you legitimately need to raise a limit (e.g. a major new dependency), bump the number in the same PR and call it out in the description so reviewers can sanity-check.

## Anti-patterns from past bugs

Real regressions we've shipped — do not repeat:

1. **bigint → string leaks ([#708](https://github.com/Skords-01/Sergeant/issues/708)).** Mono account balances suddenly went stringly-typed in the API; arithmetic in the dashboard silently produced `"123" + "456" = "123456"`. Fix: explicit `Number(r.id)` in serializers, snapshot tests on response shapes.
2. **`vitest.base.ts` ESM crash ([#720](https://github.com/Skords-01/Sergeant/pull/720)).** A `.ts` file behind `package exports` failed to load under Node's native ESM loader, and **every** package's `pnpm test` died. Lesson: shared config files exposed via `package.json` `exports` must be `.js` (with JSDoc types) or be transpiled, not raw `.ts`.
3. **Hardcoded RQ keys.** Several places had `["finyk", "transactions"]` inline; bulk-invalidate after a mutation missed half of them. Centralized factories make this impossible.
4. **One-shot DB migration that dropped a column.** Pre-deploy ran the migration before the new image started serving, so the still-warm old version crashed on the missing column. Two-phase migration policy (rule #4) prevents this.
5. **Skipped `// AI-DANGER` zone.** A subtle timing-safe comparison was rewritten as `===` during a "cleanup" PR. Catch them with `// AI-DANGER:` markers and lint warnings on malformed prefixes.
6. **Direct `localStorage.setItem` in chat tool handlers.** A handler that writes to localStorage via `localStorage.setItem` (instead of the project's `lsSet` helper) bypasses quota fallbacks **and** the cloud-sync queue used by `cloudsync`. Under a concurrent request (e.g. user fires two tool calls fast, or background sync runs) the local write and the cloud-sync write race — the user sees the change in the UI but the next device boot pulls a stale value from cloud. Always go through `ls` / `lsSet` (or `safeReadLS` / `safeWriteLS` / `createModuleStorage`); the same wrappers are also enforced by the `sergeant-design/no-raw-local-storage` ESLint rule.

## Soft rules (preferred)

- Branch naming: `devin/<unix-ts>-<short-area>-<desc>`. Example: `devin/1777137234-mono-bigint-coercion`.
- Tests next to code: `foo.ts` + `foo.test.ts` in the same folder (Vitest).
- Use path aliases (`@shared/*`, `@finyk/*`, etc.) instead of relative `../../../`.
- Dependency bumps — separate PRs (don't mix with features).
- When deleting a file — first `grep` its imports across the entire monorepo.
- Documentation language: write new/updated prose docs in Ukrainian where practical. Keep code identifiers, commands, API names, commit scopes, stack terms, and external quotes in their original language when that is clearer.

## Verification before PR

- `pnpm lint` — must be green.
- `pnpm typecheck` — must be green.
- `pnpm --filter <package> exec vitest run <path>` — for affected tests.
- When changing DB / API: `apps/server` tests must be green.
- When changing UI: take a screenshot and attach it to the PR description.

## Deployment

- **Frontend**: Vercel (preview deploy on each PR; free tier may rate-limit).
- **Backend**: Railway via `Dockerfile.api`. Pre-deploy: `pnpm db:migrate`. Health endpoint: `/health`.
- Migrations require `MIGRATE_DATABASE_URL` env (= public DB URL).

## Pre-existing flaky tests (do not block merge)

- `apps/mobile/src/core/OnboardingWizard.test.tsx`
- `apps/mobile/src/core/dashboard/WeeklyDigestFooter.test.tsx`
- `apps/mobile/src/core/settings/HubSettingsPage.test.tsx`

These three fail on `main`. Ignore them if your PR does not touch `apps/mobile`.

## Test users

- `I3BUW5atld8oOHM7lpFEJBIInpW1hzv7` — primary test user, 6 Monobank accounts, ~2 246 ₴ on UAH cards.

## See also

- `docs/ai-coding-improvements.md` — full roadmap for AI coding infra
- `docs/dev-stack-roadmap.md` — top-15 dev-stack roadmap with progress
- `docs/playbooks/` — procedural recipes for recurring tasks
- `docs/monobank-roadmap.md`
- `docs/monobank-webhook-migration.md`
- `docs/frontend-tech-debt.md`
- `docs/backend-tech-debt.md`
