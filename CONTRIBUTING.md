# Contributing to Sergeant

> **Goal:** zero-to-running in ≤ 5 minutes on any machine with Docker.

---

## Prerequisites

| Tool        | Version    | Install                                                      |
| ----------- | ---------- | ------------------------------------------------------------ |
| **Node.js** | 20.x       | [nodejs.org](https://nodejs.org/) or `volta install node@20` |
| **pnpm**    | 9.15.1     | `corepack enable && corepack prepare pnpm@9.15.1 --activate` |
| **Docker**  | Any recent | [docker.com](https://docs.docker.com/get-docker/)            |

> The repo pins `"packageManager": "pnpm@9.15.1"` — Corepack will enforce the exact version automatically.

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

# 3. Database
pnpm db:up                  # docker compose up -d (Postgres 16 on :5432)
pnpm db:migrate             # run SQL migrations (001–008)

# 4. Dev servers (two terminals)
pnpm dev:server             # Express API  → http://localhost:3000
pnpm dev:web                # Vite dev     → http://localhost:5173  (proxies /api → :3000)
```

Open <http://localhost:5173> — you should see the Hub dashboard.

### Teardown

```bash
pnpm db:down                # stop & remove the Postgres container (data persists in volume)
```

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
pnpm --filter @sergeant/web dev          # only web dev server
pnpm --filter @sergeant/server dev       # only API server
pnpm --filter <package> exec vitest run <path>   # run specific test file
```

---

## Pre-commit Hooks

[Husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged) run automatically on every commit:

- **JS/TS files** → `eslint --fix --max-warnings=0` + `prettier --write`
- **JSON/MD/CSS/HTML/YAML** → `prettier --write`

Hooks are installed by `pnpm install` (via the `prepare` script). **Do not skip them** (`--no-verify` is forbidden per `AGENTS.md` hard rule #7).

---

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

feat(web):     new feature in apps/web
fix(server):   bug fix in apps/server
docs(root):    documentation change at repo root
chore(config): tooling/config change in packages/config
```

**Scope** = package name without `@sergeant/` (e.g. `web`, `server`, `shared`, `api-client`, `finyk-domain`). For repo-root changes use `root`.

---

## CI Pipeline

Every push/PR triggers `.github/workflows/ci.yml` with these jobs:

| Job           | What                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| **check**     | Install → audit → `pnpm check` (format + lint + typecheck + test + build) |
| **coverage**  | Vitest with coverage floors + artifact upload                             |
| **a11y**      | Playwright + axe-core accessibility checks                                |
| **smoke-e2e** | Playwright smoke suite against Postgres + real API server                 |

### Known flaky mobile tests

These three tests fail on `main` and **should not block merge** if your PR does not touch `apps/mobile`:

- `apps/mobile/src/core/OnboardingWizard.test.tsx`
- `apps/mobile/src/core/dashboard/WeeklyDigestFooter.test.tsx`
- `apps/mobile/src/core/settings/HubSettingsPage.test.tsx`

---

## Pull Request Expectations

1. **Branch naming:** `devin/<unix-ts>-<area>-<desc>` or `<your-name>/<short-desc>`.
2. **Fill out the PR template** (`.github/PULL_REQUEST_TEMPLATE.md`) — especially _How to test_ and _How AI-tested this PR_ sections.
3. **All checks green** before requesting review: `pnpm check` locally, CI on the PR.
4. **Keep PRs focused** — one logical change per PR.
5. **Don't mix dependency bumps** with feature work (separate PRs).

### Hard rules (from `AGENTS.md`)

These are non-negotiable. Read `AGENTS.md` for full context.

1. **Coerce `bigint` → `number`** in every server serializer (`pg` returns bigints as strings).
2. **React Query keys** only via factories in `apps/web/src/shared/lib/queryKeys.ts` — never hardcoded arrays.
3. **API contract changes** must update `packages/api-client` types AND add a test.
4. **SQL migrations** are sequential `NNN_*.sql` in `apps/server/src/migrations/` — no gaps.
5. **Conventional Commits** — enforced by convention, checked in review.
6. **No force-push to main.** `--force-with-lease` on feature branches is fine.
7. **Never skip pre-commit hooks** (`--no-verify` is forbidden).

---

## Project Structure (Quick Reference)

```
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
├── docs/               # Roadmaps, architecture docs
├── AGENTS.md           # AI-agent rules & repo conventions
├── docker-compose.yml  # Local Postgres
└── .env.example        # All env vars with descriptions
```

---

## Deployment

| Target       | Platform | Notes                                                                   |
| ------------ | -------- | ----------------------------------------------------------------------- |
| **Frontend** | Vercel   | Preview deploy on every PR (free tier may rate-limit).                  |
| **Backend**  | Railway  | `Dockerfile.api`. Pre-deploy runs `pnpm db:migrate`. Health: `/health`. |

See `docs/railway-vercel.md` for step-by-step deployment instructions.

---

## Need Help?

- Check existing docs in `docs/` (roadmaps, tech debt, architecture).
- Read `AGENTS.md` for the full set of repo conventions and AI-marker syntax.
- Open an issue or ask in a PR comment.
