import type { Request, Response } from "express";
import { bankProxyFetch } from "../lib/bankProxy.js";
import { validateQuery } from "../http/validate.js";
import { MonoQuerySchema } from "../http/schemas.js";

/**
 * `/api/mono` — проксі до Monobank personal API. CORS/rate-limit/module-tag
 * зроблені middleware-ами роутера; тут — лише upstream credentials,
 * path-валідація (whitelist), делегація transport-шару в `bankProxy.js`
 * (timeout/retry/breaker/TTL-cache).
 */
const ALLOWED_PATHS = ["/personal/client-info", "/personal/statement"];

export default async function handler(
  req: Request,
  res: Response,
): Promise<void> {
  const token = req.headers["x-token"];

  if (!token) {
    res.status(401).json({ error: "Токен відсутній" });
    return;
  }

  const parsedQ = validateQuery(MonoQuerySchema, req, res);
  if (!parsedQ.ok) return;
  const path = String(parsedQ.data.path || "/personal/client-info");

  const pathAllowed = ALLOWED_PATHS.some(
    (allowed) => path === allowed || path.startsWith(allowed + "/"),
  );
  if (!pathAllowed) {
    res.status(400).json({ error: "Недозволений API шлях" });
    return;
  }

  const { status, body, contentType } = await bankProxyFetch({
    upstream: "monobank",
    baseUrl: "https://api.monobank.ua",
    path,
    headers: { "X-Token": String(token) },
    cacheKeySecret: String(token),
  });

  if (status < 200 || status >= 300) {
    res.status(status).json({
      error: status === 429 ? "Занадто багато запитів" : body,
    });
    return;
  }

  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    // upstream повернув не-JSON на 2xx — віддаємо як plain text, щоб не мовчки ковтати.
    res.setHeader("Content-Type", contentType || "text/plain; charset=utf-8");
    res.status(status).send(body);
    return;
  }
  res.status(200).json(data);
}
