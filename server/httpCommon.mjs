import { randomUUID } from "crypto";
import helmet from "helmet";
import { rateLimitExpress } from "./api/lib/rateLimit.js";

/** Клієнт може передати X-Request-Id; інакше генеруємо UUID. */
export function requestIdMiddleware(req, res, next) {
  const incoming = req.get("x-request-id")?.trim();
  const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader("X-Request-Id", id);
  next();
}

/** Один рядок JSON на відповідь — зручно для Railway / grep. */
export function requestLogMiddleware(req, res, next) {
  const url = req.originalUrl || "";
  if (url.startsWith("/assets/")) return next();

  const start = Date.now();
  res.on("finish", () => {
    const path = url.split("?")[0];
    const line = {
      level: "info",
      msg: "http",
      requestId: req.requestId,
      method: req.method,
      path,
      status: res.statusCode,
      ms: Date.now() - start,
    };
    console.log(JSON.stringify(line));
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
 *   (наприклад, `server/replit.mjs`). У цьому режимі CSP вимикається, бо
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

export function createHealthHandler(pool) {
  return async (_req, res) => {
    let dbOk = false;
    try {
      await pool.query("SELECT 1");
      dbOk = true;
    } catch (e) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "health_db_ping",
          error: e?.message || String(e),
        }),
      );
    }
    if (dbOk) {
      res.status(200).type("text/plain").send("ok");
    } else {
      res.status(503).type("text/plain").send("unhealthy");
    }
  };
}
