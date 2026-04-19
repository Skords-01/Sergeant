import type { RequestHandler } from "express";
import helmet from "helmet";

export type ApiCspDirectives = Record<string, string[]>;

export interface ApiHelmetOptions {
  servesFrontend?: boolean;
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
export function buildApiCspDirectives(): ApiCspDirectives {
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
export function apiHelmetMiddleware({
  servesFrontend = false,
}: ApiHelmetOptions = {}): RequestHandler {
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
