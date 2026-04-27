# eslint-plugin-sergeant-design

Custom ESLint rules for the Sergeant monorepo. Each rule encodes a hard constraint from `AGENTS.md` or a design-system guardrail so violations are caught at lint time rather than in review.

## Rules

### `sergeant-design/no-eyebrow-drift`

Forbids the combination of `uppercase`, `tracking-*`, and `text-*` in a single className string. Use `<SectionHeading>` (or `<Label normalCase={false}>`) instead. Severity: **error**.

### `sergeant-design/no-ellipsis-dots`

Forbids three consecutive ASCII dots (`...`) inside string literals and JSX text. Use the typographic ellipsis `…` (U+2026). Auto-fixable. Severity: **error**.

### `sergeant-design/no-raw-tracked-storage`

Forbids `useLocalStorage` calls on mobile when the key is registered in `SYNC_MODULES` — use `useSyncedStorage` so the write is mirrored to the cloud-sync queue. Severity: **error** (scoped to `apps/mobile/**`).

### `sergeant-design/no-raw-local-storage`

Forbids direct `localStorage.*` (and `window.localStorage.*`) access in `apps/web`. Use `safeReadLS` / `safeWriteLS`, `useLocalStorageState`, or `createModuleStorage`. Severity: **error** (with an allowlist in `eslint.config.js` for existing call-sites).

### `sergeant-design/ai-marker-syntax`

Validates AI code-marker comments follow the canonical syntax (`// AI-NOTE:`, `// AI-DANGER:`, `// AI-GENERATED:`, `// AI-LEGACY:`). Catches typos like `AI-NOTES`, `AINOTE`, `AI_NOTE`, or missing colons. Severity: **warn**.

### `sergeant-design/valid-tailwind-opacity`

Flags Tailwind `<color>/<N>` opacity modifiers where `N` is not registered in `theme.opacity`. Unregistered steps are silently dropped by Tailwind, breaking `dark:` / `hover:` overrides. Severity: **error**.

### `sergeant-design/no-low-contrast-text-on-fill`

Forbids saturated brand `bg-*` utilities behind `text-white` — use the `-strong` companion (= 700/800 step) so the pairing clears WCAG AA 4.5 : 1. Severity: **error**.

### `sergeant-design/no-bigint-string`

Forbids mapping pg `.rows` into an object literal without `Number(…)` coercion on columns that look like `bigint` / `int8`. The `pg` driver returns these as strings — see [AGENTS.md rule #1](../../AGENTS.md) and [#708](https://github.com/Skords-01/Sergeant/issues/708). Severity: **error** (scoped to `apps/server/src/**`).

**Heuristic:** when the rule finds a `.rows.map(callback)` call whose callback returns an object literal, it checks each property whose key matches the `numericColumns` list (or ends with `_id` / `_at`). If the value is a plain member expression (`r.id`, `row.amount`) without `Number(…)`, `+expr`, `parseInt(…)`, `parseFloat(…)`, or a `toNumber*` helper, it reports.

The rule intentionally prefers false-negatives over false-positives — it only fires on the canonical `rows.map(r => ({ id: r.id }))` shape.

#### Options

```json
{
  "sergeant-design/no-bigint-string": [
    "error",
    {
      "numericColumns": [
        "id",
        "user_id",
        "amount",
        "balance",
        "count",
        "version"
      ]
    }
  ]
}
```

| Option           | Type       | Default                                                                                                                                                                                                                                                         |
| ---------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `numericColumns` | `string[]` | `["id", "user_id", "account_id", "transaction_id", "workout_id", "habit_id", "recipe_id", "meal_id", "subscription_id", "budget_id", "debt_id", "asset_id", "amount", "balance", "credit_limit", "count", "version", "created_at", "updated_at", "deleted_at"]` |

In addition to exact matches, columns ending with `_id` or `_at` are always matched regardless of the list.

#### Examples

```ts
// ❌ BAD — bigint leaks as string to client
return rows.map((r) => ({
  id: r.id,
  amount: r.amount,
}));

// ✅ GOOD — explicit Number() in the serializer
return rows.map((r) => ({
  id: Number(r.id),
  amount: Number(r.amount),
}));

// ✅ GOOD — toNumberOrNull helper
return rows.map((r) => ({
  balance: toNumberOrNull(r.balance),
}));

// ✅ GOOD — ternary with Number fallback
return rows.map((r) => ({
  deleted_at: r.deleted_at ? Number(r.deleted_at) : null,
}));
```

### `sergeant-design/rq-keys-only-from-factory`

Forbids inline array literals for React Query `queryKey` / `mutationKey`. All keys must come from the centralized factory in `queryKeys.ts` ([AGENTS.md rule #2](../../AGENTS.md)). Severity: **error** (scoped to `apps/web/src/**`).

The rule catches inline `ArrayExpression` in:

- **RQ hooks:** `useQuery`, `useMutation`, `useInfiniteQuery`, `useSuspenseQuery`, `useSuspenseInfiniteQuery`
- **QueryClient option methods:** `invalidateQueries`, `cancelQueries`, `removeQueries`, `fetchQuery`, `prefetchQuery`, `refetchQueries`, `resetQueries`
- **QueryClient direct-key methods:** `getQueryData`, `setQueryData`, `getQueriesData`, `getQueryState`, `ensureQueryData`

The factory file itself is always exempt — it legitimately defines the key arrays.

#### Options

| Option              | Type     | Default                                | Description                                                  |
| ------------------- | -------- | -------------------------------------- | ------------------------------------------------------------ |
| `factoryModulePath` | `string` | `apps/web/src/shared/lib/queryKeys.ts` | Path to the query keys factory file (relative to repo root). |

#### Examples

```ts
// ❌ BAD — inline array literal drifts from the factory
useQuery({ queryKey: ["finyk", "transactions", accountId], queryFn: fn });
queryClient.invalidateQueries({ queryKey: ["finyk"] });
queryClient.getQueryData(["finyk", "mono"]);

// ✅ GOOD — factory key from queryKeys.ts
import { finykKeys } from "@shared/lib/queryKeys";
useQuery({
  queryKey: finykKeys.monoTransactionsDb(from, to, accountId),
  queryFn: fn,
});
queryClient.invalidateQueries({ queryKey: finykKeys.all });
queryClient.getQueryData(finykKeys.mono);
```

### `sergeant-design/no-anthropic-key-in-logs`

Forbids logging Anthropic API keys or secrets via `console.*`, `logger.*`, `pino.*`, or `log.*` methods. Catches `process.env.ANTHROPIC_API_KEY` passed as an argument (always), and secret-like identifiers (`apiKey`, `anthropicKey`, `secret`) when the file imports `@anthropic-ai/sdk`. Severity: **error** (scoped to `apps/server/src/**` and `apps/web/src/**`).

#### Detection

- **Always flagged:** `process.env.ANTHROPIC_API_KEY` as a direct argument, inside a template literal, or in string concatenation.
- **Flagged with Anthropic import:** identifiers matching `/apiKey/i`, `/anthropicKey/`, `/secret/i` — only when the file imports `@anthropic-ai/sdk`.
- **Not flagged:** string literals mentioning "ANTHROPIC_API_KEY" (e.g. error messages), non-logger function calls, unknown logger objects.

#### Options

```json
{
  "sergeant-design/no-anthropic-key-in-logs": [
    "error",
    {
      "additionalSecretIdentifiers": ["Token$", "^credential"]
    }
  ]
}
```

| Option                        | Type       | Default | Description                                     |
| ----------------------------- | ---------- | ------- | ----------------------------------------------- |
| `additionalSecretIdentifiers` | `string[]` | `[]`    | Extra regex patterns to match identifier names. |

#### Examples

```ts
// ❌ BAD — logs the actual API key value
console.log(process.env.ANTHROPIC_API_KEY);
console.log(`Key is ${process.env.ANTHROPIC_API_KEY}`);
logger.info(apiKey); // when file imports @anthropic-ai/sdk

// ✅ GOOD — safe logging
console.error("ANTHROPIC_API_KEY is not set");
console.log(requestId);
```

### `sergeant-design/no-strict-bypass`

Forbids type-safety bypasses in production code (PR-6.E). Catches four patterns:

1. `// @ts-expect-error` comments
2. `// @ts-ignore` comments
3. `as any` casts
4. `as unknown as X` double-casts

Severity: **error** (scoped to `apps/web/src/**` and `apps/server/src/**`). Test files are exempt. Existing violations are allowlisted in `eslint.config.js` — see [`docs/frontend-tech-debt.md`](../../docs/frontend-tech-debt.md) §no-strict-bypass.

#### Options

| Option                         | Type      | Default | Description                          |
| ------------------------------ | --------- | ------- | ------------------------------------ |
| `forbidPatterns.tsExpectError` | `boolean` | `true`  | Flag `@ts-expect-error` comments.    |
| `forbidPatterns.tsIgnore`      | `boolean` | `true`  | Flag `@ts-ignore` comments.          |
| `forbidPatterns.asAny`         | `boolean` | `true`  | Flag `as any` casts.                 |
| `forbidPatterns.asUnknownAs`   | `boolean` | `true`  | Flag `as unknown as X` double-casts. |

#### Examples

```ts
// ❌ BAD — bypasses type system
// @ts-expect-error
const x = badCall();
// @ts-ignore
const y = badCall();
const z = value as any;
const w = window as unknown as { webkitAudioContext: typeof AudioContext };

// ✅ GOOD — proper types
const x: ReturnType<typeof badCall> = badCall();
const z: SpecificType = value;
const el = document.getElementById("foo") as HTMLDivElement;
```

## Running tests

```sh
pnpm --filter eslint-plugin-sergeant-design exec node --test
```

Or via the monorepo script:

```sh
pnpm lint:plugins
```
