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
  labelNames: ["method", "path", "status"],
  registers: [register],
});

export const httpRequestDurationMs = new client.Histogram({
  name: "http_request_duration_ms",
  help: "HTTP request duration in ms",
  labelNames: ["method", "path"],
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
