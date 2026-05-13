import { getPlatform, isCapacitor } from "@sergeant/shared";

type SentryModule = typeof import("@sentry/react");

let initialized = false;
let sentryModule: SentryModule | null = null;

function parseRate(val: unknown, fallback: number): number {
  if (val == null || val === "") return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Per-op + per-route sampling rates for the browser Sentry SDK
 * (stack-pulse PR-12 / H6).
 *
 * Browser `samplingContext` exposes:
 *   - `attributes["sentry.op"]` — transaction op (`pageload`,
 *     `navigation`, `http.client`, …).
 *   - `attributes["http.url"]` — outbound XHR/fetch URL.
 *   - `name` / `transactionContext.name` — SPA route path for
 *     `pageload` + `navigation` spans (e.g. `"/finyk"`).
 *
 * Sampling strategy (“MAX wins”, i.e. the higher rate of op vs route):
 *   - `pageload` 100% — first-paint perf, fires once per session.
 *   - `http.client` 1% — outbound spans are the noisiest.
 *   - For `navigation` we then apply a **route-aware** rate so onboarding
 *     navigations get 100% while hub navigations stay at 5%.
 *
 * Route table (longest-prefix-first):
 *   - `/onboarding` 100% — first-run UX is critical, low volume.
 *   - `/fizruk` / `/finyk` 50% — module flows we tune actively.
 *   - `/` (root — Hub overview) 5% — most-visited route, low value to
 *     re-sample each navigation.
 *   - other routes — fallback (env-tunable).
 */
export type WebSentrySamplingContext = {
  attributes?: Record<string, unknown>;
  op?: unknown;
  name?: unknown;
  transactionContext?: { name?: unknown };
};

type WebRouteRule = { readonly match: string; readonly rate: number };

/**
 * SPA route prefixes — longest-prefix-first. Each entry matches the
 * `name` (transaction path) of a `navigation` or `pageload` span.
 * Keep in sync with `apps/web/src/core/app/router.tsx` paths and
 * `docs/observability/sentry-sampling.md`.
 */
export const WEB_SENTRY_ROUTE_RULES: readonly WebRouteRule[] = [
  { match: "/onboarding", rate: 1.0 },
  { match: "/fizruk", rate: 0.5 },
  { match: "/finyk", rate: 0.5 },
  // Hub overview is the SPA root (“/”). Exact match handled below — we
  // do NOT include it in the prefix table because every other path also
  // starts with “/” and a prefix match would shadow them all.
] as const;

function pickRouteRate(name: string): number | null {
  if (name === "/" || name === "") return 0.05;
  for (const rule of WEB_SENTRY_ROUTE_RULES) {
    if (name === rule.match || name.startsWith(`${rule.match}/`))
      return rule.rate;
  }
  return null;
}

function pickRouteName(c: WebSentrySamplingContext): string | null {
  const explicit = c.name;
  if (typeof explicit === "string" && explicit.length > 0) return explicit;
  const ctxName = c.transactionContext?.name;
  if (typeof ctxName === "string" && ctxName.length > 0) return ctxName;
  return null;
}

export function pickWebTracesSampleRate(
  ctx: WebSentrySamplingContext | unknown,
  fallback: number,
): number {
  if (!ctx || typeof ctx !== "object") return fallback;
  const c = ctx as WebSentrySamplingContext;
  const op =
    (c.attributes && (c.attributes["sentry.op"] as unknown)) ?? c.op ?? "";
  if (typeof op !== "string") return fallback;

  if (op === "pageload") return 1.0;
  if (op === "http.client") return 0.01;

  if (op === "navigation") {
    const name = pickRouteName(c);
    if (name) {
      const routeRate = pickRouteRate(name);
      if (routeRate != null) return routeRate;
    }
    return 0.1;
  }

  return fallback;
}

/**
 * Sentry sampling preset for the web SDK — mirrors the server-side
 * profile selector but uses the `VITE_SENTRY_SAMPLE_PROFILE` env var
 * (must be `VITE_`-prefixed so Vite inlines it into the client bundle).
 * Values map 1‑1 to `apps/server/src/sentry.ts`:
 *   - `minimal` (0.01), `prod` (0.05), `aggressive` (0.2).
 *
 * Numeric `VITE_SENTRY_TRACES_SAMPLE_RATE` overrides the profile when set.
 */
export const WEB_SENTRY_SAMPLE_PROFILES = {
  minimal: 0.01,
  prod: 0.05,
  aggressive: 0.2,
} as const;

export type WebSentrySampleProfile = keyof typeof WEB_SENTRY_SAMPLE_PROFILES;

export function resolveWebSampleProfile(raw: unknown): WebSentrySampleProfile {
  if (raw === "minimal" || raw === "aggressive" || raw === "prod") return raw;
  return "prod";
}

/**
 * Resolve fallback sample rate.
 *
 * Accepts an optional `env` arg so tests can pass a plain object. The
 * default reads `import.meta.env` via a Record-typed lookup keyed by the
 * env var names — Vite inlines string literals at build time, so the
 * generic `Record<string, unknown>` shape is safe here even though
 * `import.meta.env` carries a richer type.
 */
export function defaultWebSampleRate(env?: Record<string, unknown>): number {
  const source: Record<string, unknown> = env ?? {
    VITE_SENTRY_TRACES_SAMPLE_RATE: import.meta.env
      .VITE_SENTRY_TRACES_SAMPLE_RATE,
    VITE_SENTRY_SAMPLE_PROFILE: import.meta.env.VITE_SENTRY_SAMPLE_PROFILE,
  };
  const explicit = source["VITE_SENTRY_TRACES_SAMPLE_RATE"];
  if (
    explicit != null &&
    explicit !== "" &&
    (typeof explicit === "string" || typeof explicit === "number")
  ) {
    return parseRate(explicit, 0.05);
  }
  const profile = resolveWebSampleProfile(source["VITE_SENTRY_SAMPLE_PROFILE"]);
  return WEB_SENTRY_SAMPLE_PROFILES[profile];
}

/**
 * Лениво завантажує `@sentry/react` і ініціалізує Sentry у браузері.
 *
 * Навмисно через динамічний `import()`, щоб SDK (~30–40 KB gzip) не
 * потрапляв у головний бандл — аналітика/error tracking не повинні
 * блокувати hydration (див. `.agents/skills/sergeant-web-ui/SKILL.md`).
 *
 * Без `VITE_SENTRY_DSN` — no-op і жодного чанку не підтягується.
 */
export async function initSentry() {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  const mod = await import("@sentry/react");
  sentryModule = mod;

  mod.init({
    dsn,
    environment:
      import.meta.env.VITE_SENTRY_ENVIRONMENT ||
      import.meta.env.MODE ||
      "production",
    release: import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [
      mod.browserTracingIntegration(),
      mod.replayIntegration({
        maskAllText: false,
        blockAllMedia: true,
      }),
    ],
    // Dynamic per-op + per-route sampler (stack-pulse PR-12 / H6).
    // Fallback rate resolves through `defaultWebSampleRate` — either
    // an explicit `VITE_SENTRY_TRACES_SAMPLE_RATE` (deploy override /
    // kill-switch when set to `0`), or the
    // `VITE_SENTRY_SAMPLE_PROFILE` preset (`minimal` / `prod` /
    // `aggressive`). Per-op rates (pageload=100%, http.client=1%) and
    // navigation route rates (onboarding=100%, fizruk/finyk=50%,
    // hub=5%) are applied independent of fallback.
    tracesSampler: (samplingContext) =>
      pickWebTracesSampleRate(samplingContext, defaultWebSampleRate()),
    replaysSessionSampleRate: parseRate(
      import.meta.env.VITE_SENTRY_REPLAY_SAMPLE_RATE,
      0,
    ),
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      return event;
    },
  });

  // Теги для тріажу: відрізнити події з нативного Capacitor WebView від
  // браузерних (native-specific баги: inset, кукі, keyboard resize тощо).
  mod.setTag("platform", getPlatform());
  mod.setTag("is_capacitor", String(isCapacitor()));

  initialized = true;
}

/**
 * Lazy-forward wrapper: поки SDK не завантажений — no-op, потім
 * делегує у реальний `Sentry.captureException`. Використовується
 * локальним `ErrorBoundary`, щоб не змушувати його залежати від SDK.
 */
export function captureException(
  error: unknown,
  hint?: Parameters<SentryModule["captureException"]>[1],
): void {
  if (!sentryModule) return;
  try {
    sentryModule.captureException(error, hint);
  } catch {
    /* noop */
  }
}

/**
 * Lazy-forward `Sentry.addBreadcrumb`. No-op when the SDK is not yet
 * loaded so callers can leave breadcrumbs unconditionally without
 * forcing the Sentry chunk to ship eagerly. Used by `core/db/sqlite.ts`
 * to record VFS-fallback / COOP-COEP triage data.
 */
export function addSentryBreadcrumb(
  breadcrumb: Parameters<SentryModule["addBreadcrumb"]>[0],
): void {
  if (!sentryModule) return;
  try {
    sentryModule.addBreadcrumb(breadcrumb);
  } catch {
    /* noop */
  }
}

/**
 * Lazy-forward `Sentry.setTag`. No-op until the SDK is loaded so the
 * sync-engine boot path can record `outbox.boot.outcome` (and similar
 * Stage 8 triage tags) unconditionally — the call costs nothing on
 * cold-start and the actual tag is attached the moment the SDK
 * finishes lazy-loading via `requestIdleCallback`.
 *
 * Using global tags (rather than `withScope`) is intentional: every
 * subsequent event in the session inherits the tag so a saved search
 * like `outbox.boot.outcome:failed` finds the boot failure *and* any
 * downstream errors caused by it (e.g. the periodic drain surfacing
 * `no such table: sync_op_outbox`). That is the SERGEANT-WEB-A
 * shape we want to remain queryable if the regression ever recurs.
 */
export function setSentryTag(key: string, value: string): void {
  if (!sentryModule) return;
  try {
    sentryModule.setTag(key, value);
  } catch {
    /* noop */
  }
}
