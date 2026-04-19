import { logger } from "../obs/logger.js";
import { recordExternalHttp } from "../lib/externalHttp.js";
import { validateQuery } from "../http/validate.js";
import { PrivatQuerySchema } from "../http/schemas.js";
import { ExternalServiceError } from "../obs/errors.js";

/**
 * `/api/privat` — проксі до PrivatBank merchant API. CORS/rate-limit/tag
 * зроблені middleware-ами роутера; тут тільки upstream credentials,
 * path-валідація і фільтрація заголовків від CRLF-injection.
 */
const ALLOWED_PATHS = ["/statements/balance/final", "/statements/transactions"];

export default async function handler(req, res) {
  const merchantId = req.headers["x-privat-id"];
  const merchantToken = req.headers["x-privat-token"];

  if (!merchantId || !merchantToken) {
    return res.status(401).json({ error: "Credentials відсутні" });
  }

  const parsedQ = validateQuery(PrivatQuerySchema, req, res);
  if (!parsedQ.ok) return;
  const path = String(parsedQ.data.path || "/statements/balance/final");

  const pathAllowed = ALLOWED_PATHS.some(
    (p) => path === p || path.startsWith(p + "/"),
  );
  if (!pathAllowed) {
    return res.status(400).json({ error: "Недозволений API шлях" });
  }

  // Відкидаємо небезпечні символи у значеннях заголовків (CRLF-injection захист).
  const safeHeader = (v) => {
    const s = String(v);
    if (/[\r\n]/.test(s)) return null;
    return s;
  };
  const safeId = safeHeader(merchantId);
  const safeToken = safeHeader(merchantToken);
  if (!safeId || !safeToken) {
    return res.status(400).json({ error: "Недозволений заголовок" });
  }

  const queryParams = new URLSearchParams(req.query);
  queryParams.delete("path");
  const queryString = queryParams.toString();

  const start = process.hrtime.bigint();
  let response;
  try {
    const url = `https://acp.privatbank.ua/api${path}${queryString ? "?" + queryString : ""}`;
    response = await fetch(url, {
      headers: {
        id: safeId,
        token: safeToken,
        "Content-Type": "application/json;charset=utf-8",
      },
    });
  } catch (e) {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    recordExternalHttp("privatbank", "error", ms);
    logger.error({
      msg: "privat_proxy_failed",
      err: { message: e?.message || String(e), code: e?.code },
    });
    throw new ExternalServiceError("Помилка сервера", {
      code: "PRIVATBANK_FETCH_FAILED",
      cause: e,
    });
  }
  const ms = Number(process.hrtime.bigint() - start) / 1e6;

  if (!response.ok) {
    recordExternalHttp(
      "privatbank",
      response.status === 429 ? "rate_limited" : "error",
      ms,
    );
    let errorText = "";
    try {
      errorText = await response.text();
    } catch {
      /* response body may be unreadable — surface status text only */
    }
    return res.status(response.status).json({
      error:
        response.status === 429
          ? "Занадто багато запитів"
          : response.status === 401 || response.status === 403
            ? "Невірні credentials PrivatBank"
            : errorText || `Помилка ${response.status}`,
    });
  }

  recordExternalHttp("privatbank", "ok", ms);
  const data = await response.json();
  res.status(200).json(data);
}
