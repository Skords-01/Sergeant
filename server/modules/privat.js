import { bankProxyFetch } from "../lib/bankProxy.js";
import { validateQuery } from "../http/validate.js";
import { PrivatQuerySchema } from "../http/schemas.js";

/**
 * `/api/privat` — проксі до PrivatBank merchant API. CORS/rate-limit/tag
 * зроблені middleware-ами роутера; тут — лише upstream credentials,
 * path-валідація, CRLF-фільтр заголовків і делегація transport-шару в
 * `bankProxy.js` (timeout/retry/breaker/TTL-cache).
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
  const query = Object.fromEntries(queryParams.entries());

  const { status, body, contentType } = await bankProxyFetch({
    upstream: "privatbank",
    baseUrl: "https://acp.privatbank.ua/api",
    path,
    query,
    headers: {
      id: safeId,
      token: safeToken,
      "Content-Type": "application/json;charset=utf-8",
    },
    cacheKeySecret: `${safeId}|${safeToken}`,
  });

  if (status < 200 || status >= 300) {
    const errorMessage =
      status === 429
        ? "Занадто багато запитів"
        : status === 401 || status === 403
          ? "Невірні credentials PrivatBank"
          : body || `Помилка ${status}`;
    return res.status(status).json({ error: errorMessage });
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    res.setHeader("Content-Type", contentType || "text/plain; charset=utf-8");
    return res.status(status).send(body);
  }
  res.status(200).json(data);
}
