import { setCorsHeaders } from "./cors.js";

/**
 * Global CORS middleware для всього /api. Залишилось один-в-один те, що
 * раніше жило inline у `server/app.js`:
 *   - ставимо стандартні CORS-хедери (idempotent → handler-и можуть
 *     перевизначити allow-headers якщо треба ширший список);
 *   - на OPTIONS одразу 200, щоб preflight не проходив далі по middleware
 *     chain (rate-limit, auth).
 *
 * Ця middleware зараз дублюється в handler-ах (per-handler виклики
 * setCorsHeaders + OPTIONS-guard) — PR 4 видалить дублікати.
 */
export function apiCorsMiddleware() {
  return (req, res, next) => {
    setCorsHeaders(res, req, {
      allowHeaders: "X-Token, Content-Type",
      methods: "GET, POST, OPTIONS",
    });
    if (req.method === "OPTIONS") return res.status(200).end();
    next();
  };
}
