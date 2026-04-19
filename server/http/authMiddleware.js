import { createHash } from "crypto";
import { rateLimitExpress } from "../api/lib/rateLimit.js";
import { logger } from "../obs/logger.js";
import { authAttemptsTotal } from "../obs/metrics.js";

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
 * Лишаємо тільки перші 12 hex-символів SHA-256(lower(email)) — достатньо
 * щоб корелювати спроби за одним юзером (brute-force / credential-stuffing)
 * і **не є PII**: не reversible без offline brute-force по словнику.
 * У Prometheus цей лейбл НЕ йде (cardinality), тільки у Pino-лог.
 */
function emailFingerprint(raw) {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  return createHash("sha256")
    .update(raw.toLowerCase())
    .digest("hex")
    .slice(0, 12);
}

/**
 * Класифікує auth-ендпоінти better-auth і після відповіді інкрементує
 * `authAttemptsTotal{op,outcome}` + пише structured `auth_event` лог
 * з `emailHash` / `ip` для brute-force тріажу. Ставити ПЕРЕД
 * `authSensitiveRateLimit` (і ДО `toNodeHandler(auth)`): `res.on("finish")`
 * спрацьовує, навіть коли rate-limiter короткозамикає пайплайн без
 * `next()`, тому реєстрація listener-а мусить відбутись раніше за сам
 * limiter, щоб 429 ловились.
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

  // Читаємо body ДО `res.on("finish")`: better-auth toNodeHandler може
  // консьюмити stream і замінити/зачистити `req.body` до моменту емісії.
  // express.json() у app.js парсить лімітом 12mb, тож на /sign-in
  // це завжди object або undefined.
  const emailHash =
    op === "sign_in" || op === "sign_up" || op === "forget_password"
      ? emailFingerprint(req.body?.email)
      : undefined;

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
    // Structured log у ДОПОВНЕННЯ до HTTP-лога: той не має `op` і
    // `emailHash`, через які робимо brute-force тріаж.
    //   {service="sergeant-api"} | json | msg="auth_event" | outcome="bad_credentials" | emailHash="abc123..."
    try {
      const level =
        outcome === "error"
          ? "error"
          : outcome === "bad_credentials" ||
              outcome === "rate_limited" ||
              outcome === "invalid"
            ? "warn"
            : "info";
      logger[level]({
        msg: "auth_event",
        op,
        outcome,
        status: s,
        emailHash,
        ip: req.ip,
        ua: req.get("user-agent") || undefined,
      });
    } catch {
      /* logging must never break a response */
    }
  });
  next();
}
