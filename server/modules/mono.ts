import type { Request, Response } from "express";
import { getSessionUser } from "../auth.js";
import { getToken } from "../lib/bankVault.js";
import { bankProxyFetch } from "../lib/bankProxy.js";
import { validateQuery } from "../http/validate.js";
import { MonoQuerySchema } from "../http/schemas.js";
import { logger } from "../obs/logger.js";

/**
 * `/api/mono` — проксі до Monobank personal API. CORS/rate-limit/module-tag
 * зроблені middleware-ами роутера; тут — лише upstream credentials,
 * path-валідація (whitelist), делегація transport-шару в `bankProxy.js`
 * (timeout/retry/breaker/TTL-cache).
 *
 * Source of truth для токена:
 *   1) Якщо юзер залогінений І має рядок у `bank_tokens` — читаємо з vault.
 *   2) Fallback: `X-Token` заголовок (legacy, для ще-не-мігрованих клієнтів).
 * Порядок важливий: якщо vault доступний, ми ігноруємо заголовок —
 * так недовірлива ланка "LocalStorage + XSS" не може підмінити credentials
 * юзера, який уже переїхав на vault.
 */
const ALLOWED_PATHS = ["/personal/client-info", "/personal/statement"];

async function resolveToken(req: Request): Promise<string | null> {
  // 1) Vault. Якщо сесії нема — тихо пропускаємо (частина юзерів на
  // legacy-клієнті ще не має auth-сесії при виклику /api/mono).
  let userId: string | null = null;
  try {
    const user = await getSessionUser(req);
    userId = user?.id ?? null;
  } catch (e) {
    // Auth-lookup тимчасово зламаний — логуємо і падаємо на fallback,
    // щоб не зламати активних користувачів.
    logger.warn({
      msg: "mono_session_lookup_failed",
      err: e instanceof Error ? e.message : String(e),
    });
  }

  if (userId) {
    try {
      const vaulted = await getToken(userId, "monobank");
      if (vaulted) return vaulted;
    } catch (e) {
      // Vault недоступний (немає ключа, помилка БД) — падаємо на
      // заголовок. Не ламаємо користувачів.
      logger.warn({
        msg: "mono_vault_read_failed",
        err: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // 2) Legacy header.
  const header = req.headers["x-token"];
  if (typeof header === "string" && header.length > 0) return header;
  if (Array.isArray(header) && header.length > 0) return header[0]!;
  return null;
}

export default async function handler(
  req: Request,
  res: Response,
): Promise<void> {
  const token = await resolveToken(req);

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
    headers: { "X-Token": token },
    cacheKeySecret: token,
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
