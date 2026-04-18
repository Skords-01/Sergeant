import pino from "pino";
import { als } from "./requestContext.js";

/**
 * Єдиний JSON-логер для сервера. Railway, Sentry, Grafana Loki — всі
 * споживають JSON-рядок на `stdout` без налаштувань. Правила:
 *  - Ніколи не логувати тіла запитів (фото, паролі, Monobank-токени).
 *  - `requestId`/`userId`/`module` додаються автоматично з ALS (див.
 *    `requestContext.js`) — не передавай їх вручну.
 *  - `LOG_LEVEL` керує рівнем; за замовчуванням `info` в prod, `debug`
 *    локально (див. гілку `NODE_ENV` нижче). Ніколи не змінюй рівень у коді.
 *  - В dev можна увімкнути pino-pretty через `LOG_PRETTY=1`.
 */

const isDev = process.env.NODE_ENV !== "production";
const level = process.env.LOG_LEVEL || (isDev ? "debug" : "info");

const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-api-key"]',
  'req.headers["x-token"]',
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "apiKey",
];

const usePretty = process.env.LOG_PRETTY === "1";

export const logger = pino({
  level,
  base: {
    service: "sergeant-api",
    env: process.env.NODE_ENV || "development",
    release:
      process.env.SENTRY_RELEASE ||
      process.env.RAILWAY_GIT_COMMIT_SHA ||
      undefined,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: { paths: redactPaths, censor: "[redacted]" },
  formatters: {
    // `level` як string замість числа — зручніше для grep у Railway.
    level(label) {
      return { level: label };
    },
  },
  mixin() {
    const ctx = als.getStore();
    if (!ctx) return {};
    const out = {};
    if (ctx.requestId) out.requestId = ctx.requestId;
    if (ctx.userId) out.userId = ctx.userId;
    if (ctx.module) out.module = ctx.module;
    return out;
  },
  transport: usePretty
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss.l" },
      }
    : undefined,
});

/** Дочірній логер із додатковими bindings (напр. `logger.child({ module: "nutrition" })`). */
export function childLogger(bindings) {
  return logger.child(bindings);
}
