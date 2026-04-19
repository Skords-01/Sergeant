/**
 * Unified server entrypoint.
 *
 * Replaces the previous `server/railway.mjs` + `server/replit.mjs` pair,
 * which duplicated ~80% of their code and had silently diverged (missing
 * `/api/push/*` routes and Sentry init on Replit). The runtime mode is
 * selected by `SERVER_MODE` (or auto-detected from `REPLIT_DOMAINS`) in
 * `server/config.js`.
 *
 * IMPORTANT: `./sentry.js` is imported FIRST, before `express` or any
 * transitively-loaded HTTP module. ESM evaluates imports depth-first in
 * declaration order, so `Sentry.init()` at the top of `sentry.js` runs
 * before `http`/`express` are pulled in — which is the only way
 * OpenTelemetry auto-instrumentation can monkey-patch them. See the
 * comment block in `server/sentry.js` for details.
 */
import "./sentry.js";

import { createApp } from "./app.js";
import { config } from "./config.js";
import { ensureSchema, pool } from "./db.js";
import { logger, serializeError } from "./obs/logger.js";
import {
  startPoolSampler,
  uncaughtExceptionsTotal,
  unhandledRejectionsTotal,
} from "./obs/metrics.js";

const app = createApp({
  servesFrontend: config.servesFrontend,
  distPath: config.distPath,
  trustProxy: config.trustProxy,
});

startPoolSampler(pool);

// Process-level error tracking: catches anything that escapes express's
// error-handling pipeline. Sentry instruments this on its own too, but we
// also bump a counter + emit a structured log so Grafana sees spikes even
// independently of Sentry retention/sampling.
process.on("unhandledRejection", (reason) => {
  try {
    unhandledRejectionsTotal.inc();
  } catch {
    /* ignore */
  }
  logger.error({
    msg: "unhandled_rejection",
    err: serializeError(reason, { includeStack: true }),
  });
});

process.on("uncaughtException", (err) => {
  try {
    uncaughtExceptionsTotal.inc();
  } catch {
    /* ignore */
  }
  logger.fatal({
    msg: "uncaught_exception",
    err: serializeError(err, { includeStack: true }),
  });
  // Intentionally do not `process.exit(1)` here: Railway/Replit restart the
  // process on failing health-probes and Sentry has already captured the
  // stack. A hard exit would abort in-flight requests.
});

ensureSchema()
  .then(() => {
    logger.info({ msg: "db_schema_verified" });
  })
  .catch((err) => {
    logger.error({
      msg: "db_schema_check_failed",
      err: { message: err?.message || String(err), code: err?.code },
    });
  });

app.listen(config.port, "0.0.0.0", () => {
  logger.info({
    msg: "server_listening",
    role: config.role,
    port: config.port,
  });
});
