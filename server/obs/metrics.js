import client from "prom-client";

/**
 * Prometheus-реєстр з default-метриками (event loop lag, RSS, heap, GC)
 * плюс HTTP-RED, Postgres-USE і domain-лічильники. Експортується через
 * `GET /metrics` (захищено bearer-токеном `METRICS_TOKEN`).
 */
export const register = new client.Registry();
client.collectDefaultMetrics({ register });

// ───────────────────────── HTTP (RED) ─────────────────────────
export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "path", "status", "module"],
  registers: [register],
});

export const httpRequestDurationMs = new client.Histogram({
  name: "http_request_duration_ms",
  help: "HTTP request duration in ms",
  labelNames: ["method", "path", "status_class"],
  buckets: [5, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [register],
});

export const httpInFlight = new client.Gauge({
  name: "http_in_flight",
  help: "In-flight HTTP requests",
  labelNames: ["method"],
  registers: [register],
});

// ───────────────────────── Postgres (USE) ─────────────────────
export const dbQueryDurationMs = new client.Histogram({
  name: "db_query_duration_ms",
  help: "PG query duration in ms",
  labelNames: ["op"],
  buckets: [1, 5, 25, 100, 250, 1000, 5000],
  registers: [register],
});

export const dbErrorsTotal = new client.Counter({
  name: "db_errors_total",
  help: "PG errors grouped by error code",
  labelNames: ["code"],
  registers: [register],
});

export const dbSlowQueriesTotal = new client.Counter({
  name: "db_slow_queries_total",
  help: "PG queries over DB_SLOW_MS",
  labelNames: ["op"],
  registers: [register],
});

export const dbPoolTotal = new client.Gauge({
  name: "db_pool_total",
  help: "PG pool total connections",
  registers: [register],
});

export const dbPoolIdle = new client.Gauge({
  name: "db_pool_idle",
  help: "PG pool idle connections",
  registers: [register],
});

export const dbPoolWaiting = new client.Gauge({
  name: "db_pool_waiting",
  help: "PG pool waiting clients",
  registers: [register],
});

// ───────────────────────── Domain ─────────────────────────────
export const aiTokensTotal = new client.Counter({
  name: "ai_tokens_total",
  help: "AI tokens consumed",
  labelNames: ["provider", "model", "kind"], // kind=prompt|completion
  registers: [register],
});

export const aiQuotaBlocksTotal = new client.Counter({
  name: "ai_quota_blocks_total",
  help: "AI quota refusals",
  labelNames: ["reason"], // limit|disabled
  registers: [register],
});

export const aiQuotaFailOpenTotal = new client.Counter({
  name: "ai_quota_fail_open_total",
  help: "AI quota store unavailable → fail-open",
  labelNames: ["reason"],
  registers: [register],
});

export const syncConflictsTotal = new client.Counter({
  name: "sync_conflicts_total",
  help: "Sync conflicts per module",
  labelNames: ["module"],
  registers: [register],
});

export const pushSendsTotal = new client.Counter({
  name: "push_sends_total",
  help: "Web-push send outcomes",
  labelNames: ["outcome"], // ok|invalid_endpoint|rate_limited|error
  registers: [register],
});

export const barcodeLookupsTotal = new client.Counter({
  name: "barcode_lookups_total",
  help: "Barcode lookups by upstream and outcome",
  labelNames: ["source", "outcome"], // source=off|usda|upcitemdb; outcome=hit|miss|error
  registers: [register],
});

export const externalHttpRequestsTotal = new client.Counter({
  name: "external_http_requests_total",
  help: "Outbound HTTP calls to 3rd-party APIs",
  labelNames: ["upstream", "outcome"], // upstream=monobank|privat|anthropic|off|usda|upcitemdb...
  registers: [register],
});

export const externalHttpDurationMs = new client.Histogram({
  name: "external_http_duration_ms",
  help: "Outbound HTTP call duration by upstream",
  labelNames: ["upstream", "outcome"], // outcome=ok|rate_limited|error|timeout|miss|hit
  buckets: [25, 100, 250, 500, 1000, 2500, 5000, 10000, 20000],
  registers: [register],
});

// ───────────────────────── Auth ───────────────────────────────
export const authAttemptsTotal = new client.Counter({
  name: "auth_attempts_total",
  help: "Auth attempts by operation and outcome",
  // op=sign_in|sign_up|forget_password|reset_password|session_check|signout
  // outcome=ok|bad_credentials|rate_limited|invalid|error|hit|miss
  labelNames: ["op", "outcome"],
  registers: [register],
});

export const authSessionLookupDurationMs = new client.Histogram({
  name: "auth_session_lookup_duration_ms",
  help: "Duration of better-auth session resolution in ms",
  labelNames: ["outcome"], // hit|miss|error
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [register],
});

// ───────────────────────── Rate limit ─────────────────────────
export const rateLimitHitsTotal = new client.Counter({
  name: "rate_limit_hits_total",
  help: "Rate limit decisions by key and outcome",
  labelNames: ["key", "outcome"], // outcome=allowed|blocked
  registers: [register],
});

// ───────────────────────── Sync ───────────────────────────────
export const syncOperationsTotal = new client.Counter({
  name: "sync_operations_total",
  help: "Sync push/pull operations by module and outcome",
  // op=push|pull|push_all|pull_all; outcome=ok|conflict|unauthorized|invalid|too_large|error|empty
  labelNames: ["op", "module", "outcome"],
  registers: [register],
});

export const syncDurationMs = new client.Histogram({
  name: "sync_duration_ms",
  help: "Sync operation duration in ms",
  labelNames: ["op", "module"],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [register],
});

export const syncPayloadBytes = new client.Histogram({
  name: "sync_payload_bytes",
  help: "Sync blob size in bytes",
  labelNames: ["op", "module"],
  // 1KB..5MB — MAX_BLOB_SIZE = 5MB
  buckets: [1024, 8192, 65536, 262144, 1048576, 3145728, 5242880],
  registers: [register],
});

// ───────────────────────── Application errors ─────────────────
export const appErrorsTotal = new client.Counter({
  name: "app_errors_total",
  help: "Application errors surfaced by errorHandler",
  // kind=operational|programmer; status=400..599; code=VALIDATION|UNAUTHORIZED|...
  labelNames: ["kind", "status", "code", "module"],
  registers: [register],
});

export const unhandledRejectionsTotal = new client.Counter({
  name: "unhandled_rejections_total",
  help: "Process-level unhandled promise rejections",
  registers: [register],
});

export const uncaughtExceptionsTotal = new client.Counter({
  name: "uncaught_exceptions_total",
  help: "Process-level uncaught exceptions",
  registers: [register],
});

// ───────────────────────── AI ─────────────────────────────────
export const aiRequestsTotal = new client.Counter({
  name: "ai_requests_total",
  help: "AI requests by provider/model/endpoint/outcome",
  // endpoint=analyze-photo|refine-photo|chat|coach|day-plan|...
  // outcome=ok|rate_limited|timeout|error|bad_response
  labelNames: ["provider", "model", "endpoint", "outcome"],
  registers: [register],
});

export const aiRequestDurationMs = new client.Histogram({
  name: "ai_request_duration_ms",
  help: "AI request duration in ms",
  labelNames: ["provider", "model", "endpoint"],
  buckets: [100, 250, 500, 1000, 2500, 5000, 10000, 20000, 30000, 60000],
  registers: [register],
});

// ───────────────────────── Helpers ────────────────────────────
/** Класифікує HTTP-статус у одне з 4 відер для SLO / latency-дашбордів. */
export function statusClass(status) {
  const s = Number(status) || 0;
  if (s >= 500) return "5xx";
  if (s >= 400) return "4xx";
  if (s >= 300) return "3xx";
  if (s >= 200) return "2xx";
  return "other";
}

/**
 * Обгортка, що міряє тривалість async-операції в мс і пише в histogram
 * разом з outcome counter (опційно).
 *
 * @template T
 * @param {{
 *   histogram: import("prom-client").Histogram<string>,
 *   labels: Record<string, string>,
 *   counter?: import("prom-client").Counter<string>,
 *   counterLabels?: (outcome: string) => Record<string, string>,
 *   classify?: (result: T) => string,
 * }} opts
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function observeAsync(opts, fn) {
  const start = process.hrtime.bigint();
  let outcome = "ok";
  try {
    const result = await fn();
    if (typeof opts.classify === "function") {
      try {
        outcome = opts.classify(result) || "ok";
      } catch {
        /* ignore */
      }
    }
    return result;
  } catch (e) {
    outcome = e?.name === "AbortError" ? "timeout" : "error";
    throw e;
  } finally {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    try {
      opts.histogram.observe(opts.labels, ms);
    } catch {
      /* metrics must never break a request */
    }
    if (opts.counter) {
      try {
        const labels = opts.counterLabels
          ? opts.counterLabels(outcome)
          : { ...opts.labels, outcome };
        opts.counter.inc(labels);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Sample pg pool gauges periodically. Call once at boot.
 * Returns an unref-ed interval handle so the process can still exit cleanly.
 */
export function startPoolSampler(pool, { intervalMs = 10_000 } = {}) {
  const sample = () => {
    try {
      dbPoolTotal.set(pool.totalCount ?? 0);
      dbPoolIdle.set(pool.idleCount ?? 0);
      dbPoolWaiting.set(pool.waitingCount ?? 0);
    } catch {
      /* ignore */
    }
  };
  sample();
  const h = setInterval(sample, intervalMs);
  if (typeof h.unref === "function") h.unref();
  return h;
}

/**
 * Express handler для `GET /metrics`. Якщо задано `METRICS_TOKEN` — вимагає
 * `Authorization: Bearer <token>`. У dev/локально можна не ставити токен.
 */
export function metricsHandler(req, res) {
  const expected = process.env.METRICS_TOKEN;
  if (expected) {
    const auth = req.get("authorization") || "";
    const got = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (got !== expected) {
      res.status(401).type("text/plain").send("unauthorized");
      return;
    }
  }
  register
    .metrics()
    .then((body) => {
      res.setHeader("Content-Type", register.contentType);
      res.send(body);
    })
    .catch((err) => {
      res
        .status(500)
        .type("text/plain")
        .send(`metrics_error: ${err?.message || err}`);
    });
}
