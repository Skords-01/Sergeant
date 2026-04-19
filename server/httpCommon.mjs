import { randomUUID } from "crypto";
import helmet from "helmet";
import { rateLimitExpress } from "./api/lib/rateLimit.js";
import { logger, serializeError } from "./obs/logger.js";
import { als, withRequestContext } from "./obs/requestContext.js";
import {
  appErrorsTotal,
  authAttemptsTotal,
  httpInFlight,
  httpRequestDurationMs,
  httpRequestsTotal,
  statusClass,
} from "./obs/metrics.js";
import { isOperationalError } from "./obs/errors.js";

export { withRequestContext };

/** Клієнт може передати X-Request-Id; інакше генеруємо UUID. */
export function requestIdMiddleware(req, res, next) {
  const incoming = req.get("x-request-id")?.trim();
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}

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

/**
 * CSP директиви для API-only сервера.
 *
 * Railway сервер віддає лише JSON (або мінімальні текст/plain для health) і не
 * обслуговує HTML фронтенду — той живе на Vercel. Тому CSP може бути дуже
 * суворою: ніякий контент із цього origin не має виконувати скрипти / бути
 * вбудованим у фрейм / завантажувати щось. Це захищає на випадок помилки
 * middleware, яка випадково поверне HTML.
 *
 * Для фронтенду CSP треба задавати в `vercel.json` з урахуванням PWA
 * (script-src + worker-src blob:, connect-src — Railway + Anthropic-free, бо
 * AI виклики проксовані через API).
 */
export function buildApiCspDirectives() {
  return {
    defaultSrc: ["'none'"],
    frameAncestors: ["'none'"],
    baseUri: ["'none'"],
    formAction: ["'none'"],
    connectSrc: ["'self'"],
    imgSrc: ["'self'", "data:"],
    // Навіть якщо колись повернеться HTML з сервера — ніяких зовнішніх скриптів
    scriptSrc: ["'none'"],
    styleSrc: ["'none'"],
  };
}

/**
 * Helmet middleware для Express.
 *
 * @param {{ servesFrontend?: boolean }} [opts]
 * - `servesFrontend: true` — цей процес окрім API віддає ще й React SPA
 *   (режим Replit, `SERVER_MODE=replit`). У цьому режимі CSP вимикається, бо
 *   API-CSP з `script-src 'none'` зламала б фронтенд (Vite-PWA вбудовує
 *   інлайн-скрипт реєстрації SW, плюс `blob:` worker). Для розгортань, де
 *   потрібна CSP на SPA, політика задається на CDN-рівні (Vercel headers).
 * - `servesFrontend: false` (дефолт) — API-only (Railway). CSP буде строгою
 *   (див. buildApiCspDirectives). `CSP_REPORT_ONLY=1` переводить у
 *   report-only, `CSP_DISABLE=1` — повне вимкнення без re-deploy.
 *
 * `crossOriginResourcePolicy: 'cross-origin'` — щоб fetch з іншого домену
 * (Vercel → Railway) не ламався.
 */
export function apiHelmetMiddleware({ servesFrontend = false } = {}) {
  const cspDisabled = process.env.CSP_DISABLE === "1" || servesFrontend;
  const reportOnly = process.env.CSP_REPORT_ONLY === "1";

  return helmet({
    contentSecurityPolicy: cspDisabled
      ? false
      : {
          useDefaults: false,
          directives: buildApiCspDirectives(),
          reportOnly,
        },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
}

/** Жорсткіший ліміт на sign-in / sign-up / reset (POST). */
export function authSensitiveRateLimit(req, res, next) {
  const url = req.originalUrl || "";
  const sensitive =
    req.method === "POST" &&
    (url.includes("/sign-in") ||
      url.includes("/sign-up") ||
      url.includes("forget-password") ||
      url.includes("reset-password"));
  if (!sensitive) return next();
  return rateLimitExpress({
    key: "api:auth:sensitive",
    limit: 20,
    windowMs: 60_000,
  })(req, res, next);
}

/**
 * Класифікує auth-ендпоінти better-auth і після відповіді інкрементує
 * `authAttemptsTotal{op,outcome}`. Ставити ПЕРЕД `authSensitiveRateLimit`
 * (і ДО `toNodeHandler(auth)`): `res.on("finish")` спрацьовує, навіть
 * коли rate-limiter короткозамикає пайплайн без `next()`, тому реєстрація
 * listener-а мусить відбутись раніше за сам limiter, щоб 429 ловились.
 */
export function authMetricsMiddleware(req, res, next) {
  if (req.method !== "POST") return next();
  const url = req.originalUrl || "";
  const op =
    (url.includes("/sign-in") && "sign_in") ||
    (url.includes("/sign-up") && "sign_up") ||
    (url.includes("forget-password") && "forget_password") ||
    (url.includes("reset-password") && "reset_password") ||
    (url.includes("/sign-out") && "signout") ||
    null;
  if (!op) return next();

  res.on("finish", () => {
    const s = res.statusCode;
    const outcome =
      s === 429
        ? "rate_limited"
        : s === 401 || s === 403
          ? "bad_credentials"
          : s >= 500
            ? "error"
            : s >= 400
              ? "invalid"
              : "ok";
    try {
      authAttemptsTotal.inc({ op, outcome });
    } catch {
      /* ignore */
    }
  });
  next();
}

/**
 * @deprecated Використовуй `livezHandler` + `readyzHandler`. Лишено для
 * зворотної сумісності зі старими health-probe в інфраструктурі.
 */
export function createHealthHandler(pool) {
  return createReadyzHandler(pool);
}

/** Liveness: процес живий. Дешево і не чіпає БД. */
export function livezHandler(_req, res) {
  res.status(200).type("text/plain").send("ok");
}

/**
 * Readiness: процес готовий обслуговувати трафік. Пінгує БД; якщо БД не
 * відповідає — 503, платформа перестає маршрутизувати запити сюди.
 */
export function createReadyzHandler(pool) {
  return async (_req, res) => {
    let dbOk = false;
    try {
      await pool.query("SELECT 1");
      dbOk = true;
    } catch (e) {
      logger.error({
        msg: "readyz_db_ping_failed",
        err: { message: e?.message || String(e), code: e?.code },
      });
    }
    if (dbOk) res.status(200).type("text/plain").send("ok");
    else res.status(503).type("text/plain").send("unhealthy");
  };
}

/**
 * Термінальний error handler Express. Має стояти ПІСЛЯ
 * `attachSentryErrorHandler(app)` — той захопить stack і передасть далі.
 *
 * Правила:
 *  - `AppError` і підкласи → 4xx + `warn` + стабільне JSON body з `code`.
 *  - Все інше → 500 + `error` + generic message; деталі лише в логах/Sentry.
 *  - Клієнт завжди отримує `requestId`, щоб було що вставити в тікет.
 */
export function errorHandler(err, req, res, _next) {
  const operational = isOperationalError(err);
  const status = Number(err?.status) || (operational ? 400 : 500);
  const code =
    (typeof err?.code === "string" && err.code) ||
    (status === 429 ? "RATE_LIMIT" : operational ? "BAD_REQUEST" : "INTERNAL");
  const mod = als.getStore()?.module || "unknown";

  try {
    appErrorsTotal.inc({
      kind: operational ? "operational" : "programmer",
      status: String(status),
      code,
      module: mod,
    });
  } catch {
    /* metrics must never break error handling */
  }

  const level = status >= 500 ? "error" : "warn";
  logger[level]({
    msg: "request_failed",
    method: req.method,
    path: req.route?.path || req.originalUrl,
    status,
    code,
    module: mod,
    err: serializeError(err, { includeStack: status >= 500 }),
  });

  if (res.headersSent) return;

  res.status(status).json({
    error: operational ? err.message : "Server error",
    code,
    requestId: req.requestId,
  });
}
