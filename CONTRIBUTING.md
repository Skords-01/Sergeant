# Contributing to Sergeant

> **Ціль:** zero-to-running за ≤ 5 хвилин на будь-якій машині з Docker.

---

## Prerequisites

| Tool        | Version    | Install                                                      |
| ----------- | ---------- | ------------------------------------------------------------ |
| **Node.js** | 20.x       | [nodejs.org](https://nodejs.org/) or `volta install node@20` |
| **pnpm**    | 9.15.1     | `corepack enable && corepack prepare pnpm@9.15.1 --activate` |
| **Docker**  | Any recent | [docker.com](https://docs.docker.com/get-docker/)            |

Перевірте runtime перед інсталяцією:

```bash
node --version  # має бути v20.x
pnpm --version  # має бути 9.15.1
```

Repo pins `"packageManager": "pnpm@9.15.1"` — Corepack автоматично підхоплює точну версію pnpm. CI також працює на Node 20; Node 22 може давати engine warning і відрізнятися від CI.

---

## Before you start

1. Прочитайте [`AGENTS.md`](AGENTS.md), якщо змінюєте код або правила проєкту. Там зібрані hard rules, module ownership map, performance budgets і anti-patterns з минулих багів.
2. Визначте area/scope зміни: `web`, `server`, `mobile`, `api-client`, domain package, docs тощо.
3. Якщо задача збігається з playbook trigger — спочатку відкрийте відповідний playbook і йдіть по checklist:

| Task type                  | Playbook                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------- |
| Новий API endpoint         | [`docs/playbooks/add-api-endpoint.md`](docs/playbooks/add-api-endpoint.md)             |
| SQL migration              | [`docs/playbooks/add-sql-migration.md`](docs/playbooks/add-sql-migration.md)           |
| Feature flag               | [`docs/playbooks/add-feature-flag.md`](docs/playbooks/add-feature-flag.md)             |
| React Query hook           | [`docs/playbooks/add-react-query-hook.md`](docs/playbooks/add-react-query-hook.md)     |
| HubChat tool               | [`docs/playbooks/add-hubchat-tool.md`](docs/playbooks/add-hubchat-tool.md)             |
| Нова web route             | [`docs/playbooks/add-new-page-route.md`](docs/playbooks/add-new-page-route.md)         |
| External API integration   | [`docs/playbooks/onboard-external-api.md`](docs/playbooks/onboard-external-api.md)     |
| Dependency bump            | [`docs/playbooks/bump-dep-safely.md`](docs/playbooks/bump-dep-safely.md)               |
| Production incident/hotfix | [`docs/playbooks/hotfix-prod-regression.md`](docs/playbooks/hotfix-prod-regression.md) |

Повний список: [`docs/playbooks/README.md`](docs/playbooks/README.md).

---

## 5-Minute Quickstart

```bash
# 1. Clone & install
git clone https://github.com/Skords-01/Sergeant.git
cd Sergeant
pnpm install --frozen-lockfile

# 2. Environment
cp .env.example .env
# Defaults work out of the box for local dev (Postgres creds, ports, CORS).
# For AI features fill in ANTHROPIC_API_KEY; everything else is optional.
# Local dev only — disables AI quota accounting so HubChat doesn't burn the
# shared daily limit while you iterate:
echo "AI_QUOTA_DISABLED=1" >> .env

# 3. Database
pnpm db:up                  # docker compose up -d (Postgres 16 on :5432)
pnpm db:migrate             # run SQL migrations

# 4. Dev servers (two terminals)
pnpm dev:server             # Express API  → http://localhost:3000
pnpm dev:web                # Vite dev     → http://localhost:5173  (proxies /api → :3000)
```

Open <http://localhost:5173> — ви маєте побачити Hub dashboard.

### Teardown

```bash
pnpm db:down                # stop & remove the Postgres container (data persists in volume)
```

---

## Environment & secrets

- Скопіюйте `.env.example` у `.env`; реальний `.env` **ніколи не комітьте**.
- `DATABASE_URL=postgresql://hub:hub@localhost:5432/hub` працює з локальним Docker Postgres.
- `ANTHROPIC_API_KEY` потрібен тільки для AI features; без нього базовий local dev має запускатися.
- `VITE_*` змінні потрапляють у frontend bundle. Не кладіть у `VITE_*` DB URLs, private API keys, session secrets або приватні tokens.
- Frontend secrets живуть у Vercel тільки якщо вони справді публічні для browser bundle; backend secrets — у Railway.
- Для VAPID, Resend, USDA, Sentry і production CORS дивіться коментарі в [`.env.example`](.env.example) та [`docs/railway-vercel.md`](docs/railway-vercel.md).

---

## Everyday Commands

| Command              | What it does                                                                         |
| -------------------- | ------------------------------------------------------------------------------------ |
| `pnpm lint`          | ESLint (all apps + packages) + import checker + plugin tests                         |
| `pnpm typecheck`     | TypeScript type-check across the monorepo                                            |
| `pnpm test`          | Vitest for all packages                                                              |
| `pnpm test:coverage` | Vitest with per-package coverage floors                                              |
| `pnpm format`        | Prettier — auto-fix                                                                  |
| `pnpm format:check`  | Prettier — check only (CI uses this)                                                 |
| `pnpm build`         | Turbo build (all apps)                                                               |
| `pnpm check`         | `format:check` + `lint` + `typecheck` + `test` + `build` — the full CI suite locally |

### Scoped commands

```bash
pnpm --filter @sergeant/web dev
pnpm --filter @sergeant/server dev
pnpm --filter <package> exec vitest run <path>
```

---

## Working with HubChat locally

HubChat tools визначаються на сервері в `apps/server/src/modules/chat/toolDefs/<domain>.ts` і виконуються на клієнті в `apps/web/src/core/lib/chatActions/<domain>Actions.ts` (див. `AGENTS.md` → _Architecture: AI tool execution path_). Сервер — тонкий pass-through до Anthropic, який повертає `tool_use` блоки; localStorage / API write-и робить клієнтський executor.

### Тригерити tool call без браузера

```bash
# Попередньо: відкрий http://localhost:5173, залогінся, скопіюй значення
# better-auth.session_token з DevTools → Application → Cookies.

curl -X POST http://localhost:3000/api/chat \
  -H "Cookie: better-auth.session_token=<token>" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"залогуй 200мл води"}],"context":""}'
```

Якщо відповідь містить блоки `tool_use` але `localStorage` не змінився — це **норма**: сервер лише визначив tool call, виконання відбувається в `executeAction` на клієнті після рендеру відповіді в HubChat. Для перевірки повного циклу без UI треба вручну прогнати `tool_result` через другий `/api/chat` запит (див. continuation handler у `chat.ts`, `max_tokens: 2500`).

### Пов'язані playbookи

- [`docs/playbooks/add-hubchat-tool.md`](docs/playbooks/add-hubchat-tool.md) — як додати новий tool.
- [`docs/playbooks/tune-system-prompt.md`](docs/playbooks/tune-system-prompt.md) — як міняти `SYSTEM_PREFIX` без поломки tool-calling.
- [`docs/playbooks/debug-chat-tool.md`](docs/playbooks/debug-chat-tool.md) — секвенція перевірок коли «асистент каже що зробив, але нічого не сталось».

---

## Testing by change type

Run the smallest meaningful test set while developing, then use `pnpm check` before review when feasible.

| Change type                | Minimum local verification                                                                                                                                                                                                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Docs-only                  | `pnpm format:check` or `pnpm exec prettier --check <file>`                                                                                                                                                                                                                                                                                                         |
| Web UI (`apps/web`)        | Targeted Vitest/RTL test, `pnpm --filter @sergeant/web build`, screenshot in PR for visible UI changes                                                                                                                                                                                                                                                             |
| Server/API (`apps/server`) | Targeted server Vitest, response shape snapshot if applicable, update `packages/api-client` types                                                                                                                                                                                                                                                                  |
| DB migration               | Follow `add-sql-migration` playbook, run `pnpm db:up` + `pnpm --filter @sergeant/server db:migrate:dev`                                                                                                                                                                                                                                                            |
| React Query hook           | Use centralized keys from `apps/web/src/shared/lib/queryKeys.ts`, test cache invalidation path                                                                                                                                                                                                                                                                     |
| HubChat tool               | Update server tool definition, client executor, visible action card/quick action if user-facing. Targeted Vitest: `pnpm --filter @sergeant/web exec vitest run src/core/lib/chatActions` + `pnpm --filter @sergeant/server exec vitest run src/modules/chat`. Якщо додав tool у `toolDefs/` — онови список tools у `SYSTEM_PREFIX` (`systemPrompt.ts` рядки 7–14). |
| Mobile (`apps/mobile`)     | Targeted mobile Vitest; be aware of known flaky tests listed below                                                                                                                                                                                                                                                                                                 |
| Mobile shell               | Run relevant Capacitor/mobile-shell build command and watch Android/iOS workflow results                                                                                                                                                                                                                                                                           |
| Dependency bump            | Separate PR, run lockfile install, tests for touched package, and watch `pnpm audit` / license check output                                                                                                                                                                                                                                                        |

For UI changes, attach a screenshot or recording to the PR description when practical.

---

## Pre-commit Hooks

[Husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged) run automatically on every commit:

- **JS/TS files** → `eslint --fix --max-warnings=0` + `prettier --write`
- **JSON/MD/CSS/HTML/YAML** → `prettier --write`

Hooks are installed by `pnpm install` via the `prepare` script. **Do not skip them**: `--no-verify` is forbidden per `AGENTS.md` hard rule #7.

---

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<scope>): <short description>

feat(web): add weekly digest filter
fix(server): coerce mono balance id to number
docs(root): clarify local setup
chore(config): tune shared eslint config
```

Allowed types: `feat`, `fix`, `docs`, `chore`, `refactor`, `perf`, `test`, `build`, `ci`.

Use one of these scopes; do not invent scopes like `app`, `core`, `monorepo`, or `all`.

| Scope              | When to use                                                    |
| ------------------ | -------------------------------------------------------------- |
| `web`              | `apps/web/**`                                                  |
| `server`           | `apps/server/**` excluding migrations-only changes             |
| `mobile`           | `apps/mobile/**`                                               |
| `mobile-shell`     | `apps/mobile-shell/**`                                         |
| `shared`           | `packages/shared/**`                                           |
| `api-client`       | `packages/api-client/**`                                       |
| `finyk-domain`     | `packages/finyk-domain/**`                                     |
| `fizruk-domain`    | `packages/fizruk-domain/**`                                    |
| `nutrition-domain` | `packages/nutrition-domain/**`                                 |
| `routine-domain`   | `packages/routine-domain/**`                                   |
| `insights`         | `packages/insights/**`                                         |
| `design-tokens`    | `packages/design-tokens/**`                                    |
| `config`           | `packages/config/**`                                           |
| `eslint-plugins`   | `packages/eslint-plugin-sergeant-design/**`                    |
| `migrations`       | `apps/server/src/migrations/**` only                           |
| `deps`             | Renovate / dependency-only PRs                                 |
| `docs`             | `docs/**`, `README.md`, `AGENTS.md`, `CONTRIBUTING.md`         |
| `ci`               | `.github/workflows/**`, `turbo.json`, scripts under `scripts/` |
| `root`             | Repo-level config (`pnpm-workspace.yaml`, root `package.json`) |

If a PR genuinely spans multiple scopes, use the most user-visible scope and explain the rest in the PR body.

---

## CI Pipeline

Every push/PR triggers `.github/workflows/ci.yml`.

| Job           | What                                                                                |
| ------------- | ----------------------------------------------------------------------------------- |
| **check**     | Install, audit, license policy check, `pnpm check`, bundle size guard               |
| **coverage**  | `pnpm test:coverage`, coverage HTML/JSON artifacts                                  |
| **a11y**      | Playwright Chromium install + axe-core accessibility checks                         |
| **smoke-e2e** | Real Postgres service, migrations, API server, Vite preview, Playwright smoke suite |

### CI gotchas

- `pnpm audit --audit-level=critical --prod` is blocking.
- `pnpm audit --audit-level=high --prod` and full-tree high audit are non-blocking but should still be reviewed.
- `pnpm licenses:check` is blocking and requires `THIRD_PARTY_LICENSES.md` to match the lockfile.
- `pnpm --filter @sergeant/web exec size-limit` is blocking.
- `a11y` installs Playwright Chromium with system dependencies.
- `smoke-e2e` runs migrations with `pnpm --filter @sergeant/server db:migrate:dev`.
- Separate workflows exist for Detox Android/iOS and mobile-shell Android/iOS builds. Watch them when touching `apps/mobile` or `apps/mobile-shell`.

### Performance budgets

CI fails when bundle budgets regress:

| Metric                       | Budget       |
| ---------------------------- | ------------ |
| `apps/web` JS total (brotli) | **≤ 615 kB** |
| `apps/web` CSS (brotli)      | **≤ 18 kB**  |

If a legitimate feature needs a higher limit, bump the number in the same PR and call it out in the description.

### Known flaky mobile tests

These three tests fail on `main` and **should not block merge** if your PR does not touch `apps/mobile`:

- `apps/mobile/src/core/OnboardingWizard.test.tsx`
- `apps/mobile/src/core/dashboard/WeeklyDigestFooter.test.tsx`
- `apps/mobile/src/core/settings/HubSettingsPage.test.tsx`

---

## Pull Request Expectations

1. **Branch naming:** `devin/<unix-ts>-<area>-<desc>` or `<your-name>/<short-desc>`.
2. **Fill out the PR template** (`.github/PULL_REQUEST_TEMPLATE.md`) — especially _How to test_ and _How AI-tested this PR_ sections.
3. **All checks green** before requesting review: relevant checks locally, CI on the PR.
4. **Keep PRs focused** — one logical change per PR.
5. **Don't mix dependency bumps** with feature work; use separate PRs.
6. **Use Ukrainian for new/updated prose docs where practical.** Keep code identifiers, commands, API names, commit scopes, stack terms, and external quotes in their original language when clearer.

### PR checklist before review

- [ ] Branch name follows the convention.
- [ ] PR template is filled: what changed, why, how to test.
- [ ] Relevant local checks are listed in the PR.
- [ ] UI changes include screenshot/recording when practical.
- [ ] No secrets, `.env`, tokens, or private keys are committed.
- [ ] Dependency bumps are not mixed with feature work.
- [ ] API response shape changes update server, `packages/api-client`, and tests together.
- [ ] DB changes follow sequential migration rules and avoid unsafe one-shot drops.
- [ ] New permanent repo rules are added to `AGENTS.md`; otherwise mark “No” in the template.
- [ ] No new `AI-DANGER` marker is added without justification.
- [ ] Якщо додано HubChat tool — список tools у `SYSTEM_PREFIX` (`apps/server/src/modules/chat/toolDefs/systemPrompt.ts` рядки 7–14) оновлено.

### Hard rules (from `AGENTS.md`)

These are non-negotiable. Read `AGENTS.md` for full context.

1. **Coerce `bigint` → `number`** in every server serializer (`pg` returns bigints as strings).
2. **React Query keys** only via factories in `apps/web/src/shared/lib/queryKeys.ts` — never hardcoded arrays.
3. **API contract changes** must update `packages/api-client` types AND add a test.
4. **SQL migrations** are sequential `NNN_*.sql` in `apps/server/src/migrations/` — no gaps.
5. **Conventional Commits** with the allowed type/scope set above.
6. **No force-push to main.** `--force-with-lease` on feature branches is fine.
7. **Never skip pre-commit hooks** (`--no-verify` is forbidden).

---

## Project Structure (Quick Reference)

```text
Sergeant/
├── apps/
│   ├── web/            # Vite + React 18 SPA (frontend)
│   ├── server/         # Express + PostgreSQL + Better Auth (API)
│   ├── mobile/         # Expo 52 + React Native 0.76
│   └── mobile-shell/   # Capacitor wrapper for web app
├── packages/
│   ├── shared/         # @sergeant/shared
│   ├── api-client/     # @sergeant/api-client
│   ├── config/         # @sergeant/config
│   ├── design-tokens/  # @sergeant/design-tokens
│   ├── insights/       # @sergeant/insights
│   └── ...domain/      # finyk-domain, fizruk-domain, nutrition-domain, routine-domain
├── docs/               # Roadmaps, architecture docs, playbooks
├── AGENTS.md           # AI-agent rules & repo conventions
├── docker-compose.yml  # Local Postgres
└── .env.example        # All env vars with descriptions
```

---

## Deployment

| Target       | Platform | Notes                                                                   |
| ------------ | -------- | ----------------------------------------------------------------------- |
| **Frontend** | Vercel   | Preview deploy on every PR; free tier may rate-limit.                   |
| **Backend**  | Railway  | `Dockerfile.api`. Pre-deploy runs `pnpm db:migrate`. Health: `/health`. |

See [`docs/railway-vercel.md`](docs/railway-vercel.md) for step-by-step deployment instructions.

---

## Need Help?

- Check existing docs in [`docs/`](docs/) and playbooks in [`docs/playbooks/`](docs/playbooks/).
- Read [`AGENTS.md`](AGENTS.md) for the full set of repo conventions and AI-marker syntax.
- Open an issue or ask in a PR comment.
