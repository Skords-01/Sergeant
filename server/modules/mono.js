import { logger } from "../obs/logger.js";
import { recordExternalHttp } from "../lib/externalHttp.js";
import { validateQuery } from "../http/validate.js";
import { MonoQuerySchema } from "../http/schemas.js";
import { ExternalServiceError } from "../obs/errors.js";

/**
 * `/api/mono` — проксі до Monobank personal API. CORS/rate-limit/module-tag
 * зроблені middleware-ами роутера; тут тільки upstream credentials,
 * path-валідація та HTTP-виклик.
 *
 * Формат `path` (whitelist-regex) валідується через `validateQuery` + zod;
 * allowlist конкретних upstream шляхів — нижче (не чистий shape-check,
 * тому тримаємо тут).
 */
const ALLOWED_PATHS = ["/personal/client-info", "/personal/statement"];

export default async function handler(req, res) {
  const token = req.headers["x-token"];

  if (!token) {
    return res.status(401).json({ error: "Токен відсутній" });
  }

  const parsedQ = validateQuery(MonoQuerySchema, req, res);
  if (!parsedQ.ok) return;
  const path = String(parsedQ.data.path || "/personal/client-info");

  const pathAllowed = ALLOWED_PATHS.some(
    (allowed) => path === allowed || path.startsWith(allowed + "/"),
  );
  if (!pathAllowed) {
    return res.status(400).json({ error: "Недозволений API шлях" });
  }

  const start = process.hrtime.bigint();
  let response;
  try {
    response = await fetch(`https://api.monobank.ua${path}`, {
      headers: { "X-Token": String(token) },
    });
  } catch (e) {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    recordExternalHttp("monobank", "error", ms);
    logger.error({
      msg: "mono_proxy_failed",
      err: { message: e?.message || String(e), code: e?.code },
    });
    throw new ExternalServiceError("Помилка сервера", {
      code: "MONOBANK_FETCH_FAILED",
      cause: e,
    });
  }
  const ms = Number(process.hrtime.bigint() - start) / 1e6;

  if (!response.ok) {
    recordExternalHttp(
      "monobank",
      response.status === 429 ? "rate_limited" : "error",
      ms,
    );
    const errorText = await response.text();
    return res.status(response.status).json({
      error: response.status === 429 ? "Занадто багато запитів" : errorText,
    });
  }

  const data = await response.json();
  recordExternalHttp("monobank", "ok", ms);
  res.status(200).json(data);
}
