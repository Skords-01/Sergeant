import { logger } from "../obs/logger.js";
import { als } from "../obs/requestContext.js";
import {
  httpInFlight,
  httpRequestDurationMs,
  httpRequestsTotal,
  statusClass,
} from "../obs/metrics.js";

/**
 * Один JSON-рядок на відповідь + емісія HTTP-RED метрик.
 * `requestId`/`userId`/`module` додаються автоматично через ALS у logger.
 *
 * `path` = route pattern (`/api/nutrition/food/:id`), не сирий URL — інакше
 * cardinality метрик вибухне.
 */
export function requestLogMiddleware(req, res, next) {
  const url = req.originalUrl || "";
  // Не спамимо логи запитами на статику/health.
  if (
    url.startsWith("/assets/") ||
    url === "/livez" ||
    url === "/readyz" ||
    url === "/health"
  ) {
    return next();
  }

  const start = process.hrtime.bigint();
  httpInFlight.inc({ method: req.method });

  res.on("finish", () => {
    httpInFlight.dec({ method: req.method });
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const routePath = req.route?.path;
    const basePath = typeof req.baseUrl === "string" ? req.baseUrl : "";
    // Fallback на `unknown` (не сирий URL) щоб не роздувати cardinality Prometheus
    // сканерами /wp-admin і подібним.
    const path = routePath != null ? `${basePath}${routePath}` : "unknown";
    const status = res.statusCode;
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
    const bytesOut = Number(res.getHeader("content-length")) || 0;
    const mod = als.getStore()?.module || "unknown";

    logger[level]({
      msg: "http",
      method: req.method,
      path,
      status,
      ms: Math.round(ms),
      bytesOut,
      ip: req.ip,
      ua: req.get("user-agent") || undefined,
    });

    try {
      httpRequestsTotal.inc({
        method: req.method,
        path,
        status,
        module: mod,
      });
      httpRequestDurationMs.observe(
        { method: req.method, path, status_class: statusClass(status) },
        ms,
      );
    } catch {
      /* metrics must never break a request */
    }
  });
  next();
}
