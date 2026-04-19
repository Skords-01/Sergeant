import type { Request, Response } from "express";
import { z } from "zod";
import { validateBody } from "../http/validate.js";
import { logger } from "../obs/logger.js";
import {
  type BankProvider,
  VaultNotConfiguredError,
  deleteToken,
  hasToken,
  isVaultConfigured,
  putToken,
} from "../lib/bankVault.js";

/**
 * Endpoint-и для керування банківськими credentials у server-side vault.
 *
 *   POST   /api/bank/mono/token              — зберегти Monobank personal token
 *   DELETE /api/bank/mono/token              — видалити
 *   POST   /api/bank/privat/credentials      — зберегти PrivatBank id+token
 *   DELETE /api/bank/privat/credentials      — видалити
 *   GET    /api/bank/status                  — { mono: bool, privat: bool }
 *
 * Усі — з `requireSession()`. Credentials шифруються AES-256-GCM ключем з
 * env `BANK_TOKEN_ENC_KEY` (див. `server/lib/bankVault.ts`).
 *
 * Якщо vault не сконфігурований (відсутній ключ), endpoint-и повертають
 * 503 з `code: "VAULT_UNAVAILABLE"` — фронт тоді продовжує старий
 * path-through-header-шлях.
 */

type WithSessionUser = Request & { user?: { id: string } };

function userId(req: Request): string {
  return (req as WithSessionUser).user!.id;
}

// ── Schemas ────────────────────────────────────────────────────────────────

const MonoTokenSchema = z.object({
  // Monobank personal token — UUID або випадкова рядок. Обмеження розміру,
  // щоб не зберегти 1MB сміття випадково.
  token: z.string().trim().min(16).max(512),
});

const PrivatCredentialsSchema = z.object({
  // Merchant ID — короткий alphanumerical
  id: z.string().trim().min(1).max(128),
  // Merchant token — довший, але все одно розумний cap
  token: z.string().trim().min(8).max(512),
});

// ── Helpers ────────────────────────────────────────────────────────────────

function vaultUnavailable(res: Response): void {
  res.status(503).json({
    error: "Сховище банківських токенів не сконфігуровано",
    code: "VAULT_UNAVAILABLE",
  });
}

async function safeVault<T>(
  res: Response,
  op: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await op();
  } catch (e: unknown) {
    if (e instanceof VaultNotConfiguredError) {
      vaultUnavailable(res);
      return undefined;
    }
    throw e;
  }
}

// ── Handlers ───────────────────────────────────────────────────────────────

export async function bankStatus(req: Request, res: Response): Promise<void> {
  if (!isVaultConfigured()) {
    // Не 503, бо це інформаційний endpoint — фронт має зрозуміти, що
    // vault недоступний, і не пропонувати "Зберегти на сервер". Просто
    // кажемо, що жоден провайдер не підключений через vault.
    res.json({ mono: false, privat: false, vaultAvailable: false });
    return;
  }
  const uid = userId(req);
  const [mono, privat] = await Promise.all([
    hasToken(uid, "monobank"),
    hasToken(uid, "privatbank"),
  ]);
  res.json({ mono, privat, vaultAvailable: true });
}

export async function bankMonoPut(req: Request, res: Response): Promise<void> {
  const parsed = validateBody(MonoTokenSchema, req, res);
  if (!parsed.ok) return;
  const uid = userId(req);
  const ok = await safeVault(res, () =>
    putToken(uid, "monobank", parsed.data.token),
  );
  if (ok === undefined) return;
  logger.info({ msg: "bank_vault_put", provider: "monobank", userId: uid });
  res.json({ ok: true });
}

export async function bankMonoDelete(
  req: Request,
  res: Response,
): Promise<void> {
  const uid = userId(req);
  const removed = await safeVault(res, () => deleteToken(uid, "monobank"));
  if (removed === undefined) return;
  logger.info({
    msg: "bank_vault_delete",
    provider: "monobank",
    userId: uid,
    removed,
  });
  res.json({ ok: true, removed });
}

export async function bankPrivatPut(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = validateBody(PrivatCredentialsSchema, req, res);
  if (!parsed.ok) return;
  const uid = userId(req);
  // Сторимо як JSON — щоб одному рядку відповідав один payload (а не два
  // окремі рядки для id і token). Декодер у `mono.ts`/`privat.ts` парсить
  // JSON і дістає потрібні поля.
  const payload = JSON.stringify({
    id: parsed.data.id,
    token: parsed.data.token,
  });
  const ok = await safeVault(res, () => putToken(uid, "privatbank", payload));
  if (ok === undefined) return;
  logger.info({ msg: "bank_vault_put", provider: "privatbank", userId: uid });
  res.json({ ok: true });
}

export async function bankPrivatDelete(
  req: Request,
  res: Response,
): Promise<void> {
  const uid = userId(req);
  const removed = await safeVault(res, () => deleteToken(uid, "privatbank"));
  if (removed === undefined) return;
  logger.info({
    msg: "bank_vault_delete",
    provider: "privatbank",
    userId: uid,
    removed,
  });
  res.json({ ok: true, removed });
}

// Re-export provider type to keep imports tight elsewhere.
export type { BankProvider };
