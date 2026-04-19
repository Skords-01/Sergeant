import type { Request, Response } from "express";
import { getSessionUser } from "../auth.js";
import { getToken } from "../lib/bankVault.js";
import { bankProxyFetch } from "../lib/bankProxy.js";
import { validateQuery } from "../http/validate.js";
import { PrivatQuerySchema } from "../http/schemas.js";
import { logger } from "../obs/logger.js";

/**
 * `/api/privat` — проксі до PrivatBank merchant API. CORS/rate-limit/tag
 * зроблені middleware-ами роутера; тут — лише upstream credentials,
 * path-валідація, CRLF-фільтр заголовків і делегація transport-шару в
 * `bankProxy.js` (timeout/retry/breaker/TTL-cache).
 *
 * Source of truth для credentials:
 *   1) Vault (`bank_tokens`, provider='privatbank'). Payload — JSON
 *      {"id": "...", "token": "..."}.
 *   2) Fallback: заголовки `X-Privat-Id` + `X-Privat-Token` (legacy).
 */
const ALLOWED_PATHS = ["/statements/balance/final", "/statements/transactions"];

interface PrivatCreds {
  id: string;
  token: string;
}

async function resolveCredentials(req: Request): Promise<PrivatCreds | null> {
  let userId: string | null = null;
  try {
    const user = await getSessionUser(req);
    userId = user?.id ?? null;
  } catch (e) {
    logger.warn({
      msg: "privat_session_lookup_failed",
      err: e instanceof Error ? e.message : String(e),
    });
  }

  if (userId) {
    try {
      const vaulted = await getToken(userId, "privatbank");
      if (vaulted) {
        try {
          const parsed = JSON.parse(vaulted) as Partial<PrivatCreds>;
          if (
            parsed &&
            typeof parsed.id === "string" &&
            typeof parsed.token === "string" &&
            parsed.id.length > 0 &&
            parsed.token.length > 0
          ) {
            return { id: parsed.id, token: parsed.token };
          }
          logger.warn({ msg: "privat_vault_payload_invalid" });
        } catch (e) {
          logger.warn({
            msg: "privat_vault_payload_parse_failed",
            err: e instanceof Error ? e.message : String(e),
          });
        }
      }
    } catch (e) {
      logger.warn({
        msg: "privat_vault_read_failed",
        err: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Legacy headers fallback.
  const id = req.headers["x-privat-id"];
  const token = req.headers["x-privat-token"];
  const idStr =
    typeof id === "string"
      ? id
      : Array.isArray(id) && id.length > 0
        ? id[0]!
        : null;
  const tokenStr =
    typeof token === "string"
      ? token
      : Array.isArray(token) && token.length > 0
        ? token[0]!
        : null;
  if (!idStr || !tokenStr) return null;
  return { id: idStr, token: tokenStr };
}

export default async function handler(
  req: Request,
  res: Response,
): Promise<void> {
  const creds = await resolveCredentials(req);

  if (!creds) {
    res.status(401).json({ error: "Credentials відсутні" });
    return;
  }

  const parsedQ = validateQuery(PrivatQuerySchema, req, res);
  if (!parsedQ.ok) return;
  const path = String(parsedQ.data.path || "/statements/balance/final");

  const pathAllowed = ALLOWED_PATHS.some(
    (p) => path === p || path.startsWith(p + "/"),
  );
  if (!pathAllowed) {
    res.status(400).json({ error: "Недозволений API шлях" });
    return;
  }

  // Відкидаємо небезпечні символи у значеннях заголовків (CRLF-injection захист).
  const safeHeader = (v: string): string | null => {
    if (/[\r\n]/.test(v)) return null;
    return v;
  };
  const safeId = safeHeader(creds.id);
  const safeToken = safeHeader(creds.token);
  if (!safeId || !safeToken) {
    res.status(400).json({ error: "Недозволений заголовок" });
    return;
  }

  const queryParams = new URLSearchParams(req.query as Record<string, string>);
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
    res.status(status).json({ error: errorMessage });
    return;
  }

  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    res.setHeader("Content-Type", contentType || "text/plain; charset=utf-8");
    res.status(status).send(body);
    return;
  }
  res.status(200).json(data);
}
