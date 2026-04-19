import crypto from "node:crypto";
import type { Pool } from "pg";
import pool from "../db.js";
import { logger } from "../obs/logger.js";

/**
 * Server-side зашифроване сховище банківських credentials.
 *
 * Навіщо. До цього Monobank personal token і PrivatBank merchant id+token
 * лежали в `localStorage` фронту і слалися заголовками на кожен запит до
 * `/api/mono` / `/api/privat`. Один XSS = повний витік. Monobank personal
 * token не ротується, не має scoped-permissions — це effectively root-
 * credentials для читання всієї фінансової історії.
 *
 * Рішення. Шифруємо AES-256-GCM сервер-ключем з env, зберігаємо в
 * `bank_tokens` (див. міграцію 006). Фронт передає відкриті credentials
 * рівно один раз — при підключенні; після цього знає лише boolean
 * "провайдер підключений".
 *
 * Key management. Ключ 32 байти (256 біт) у hex-форматі в env-змінній
 * `BANK_TOKEN_ENC_KEY`. Генерація: `openssl rand -hex 32`. На boot ключ
 * парситься один раз у `getActiveKey()`; якщо його немає — vault endpoint-и
 * повертають 503 з чітким повідомленням, vault-fallback у mono/privat
 * handler-ах тихо no-op-ить (старий X-Token-header-шлях продовжує
 * працювати для backward-compat під час міграції).
 *
 * Key rotation. Кожен рядок несе `key_id` ('v1' для поточного ключа).
 * Коли треба зротувати: додати env `BANK_TOKEN_ENC_KEY_V2`, викликати
 * bulk re-encrypt job, перемкнути `BANK_TOKEN_ENC_KEY_ACTIVE=v2`. Все
 * ще читаємо v1-рядки старим ключем. Повна ротація зараз поза скоупом —
 * `key_id` просто готує фундамент.
 */

export type BankProvider = "monobank" | "privatbank";

export class VaultNotConfiguredError extends Error {
  constructor() {
    super("BANK_TOKEN_ENC_KEY is not configured");
    this.name = "VaultNotConfiguredError";
  }
}

export class VaultDecryptError extends Error {
  constructor(cause: string) {
    super(`bank vault decrypt failed: ${cause}`);
    this.name = "VaultDecryptError";
  }
}

interface EncryptedRow {
  ciphertext: Buffer;
  iv: Buffer;
  auth_tag: Buffer;
  key_id: string;
}

const ACTIVE_KEY_ID = "v1";

let cachedKey: Buffer | null = null;
let cachedKeyChecked = false;

function getActiveKey(): Buffer {
  if (cachedKeyChecked && cachedKey) return cachedKey;
  const raw = process.env.BANK_TOKEN_ENC_KEY;
  if (!raw) {
    cachedKeyChecked = true;
    cachedKey = null;
    throw new VaultNotConfiguredError();
  }
  // Hex очікуємо 64 символи (32 байти). Base64 також приймаємо як
  // резерв — деякі secret-managers віддають саме його, і ми не хочемо
  // мовчки провалюватись з "bad key length".
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    // Пробуємо base64. Якщо дасть не-32 байти — кидаємо.
    try {
      key = Buffer.from(raw, "base64");
    } catch {
      throw new Error(
        "BANK_TOKEN_ENC_KEY must be 32-byte hex (64 chars) or base64",
      );
    }
  }
  if (key.length !== 32) {
    throw new Error(
      `BANK_TOKEN_ENC_KEY must decode to 32 bytes, got ${key.length}`,
    );
  }
  cachedKey = key;
  cachedKeyChecked = true;
  return key;
}

export function isVaultConfigured(): boolean {
  try {
    getActiveKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Чистий (db-free) encrypt/decrypt — винесено окремо для unit-тестів.
 */
export function encryptPayload(plaintext: string): EncryptedRow {
  const key = getActiveKey();
  const iv = crypto.randomBytes(12); // GCM recommended
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext,
    iv,
    auth_tag: authTag,
    key_id: ACTIVE_KEY_ID,
  };
}

export function decryptPayload(row: EncryptedRow): string {
  if (row.key_id !== ACTIVE_KEY_ID) {
    // Коли буде ротація — тут буде table lookup по key_id. Зараз явно
    // кидаємо, бо інших ключів ще нема і мовчазний fallback приховав би
    // баг у міграції даних.
    throw new VaultDecryptError(`unknown key_id: ${row.key_id}`);
  }
  const key = getActiveKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, row.iv);
  decipher.setAuthTag(row.auth_tag);
  try {
    const plaintext = Buffer.concat([
      decipher.update(row.ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new VaultDecryptError(msg);
  }
}

interface VaultPool {
  query: Pool["query"];
}

/**
 * UPSERT credentials. Якщо користувач перепідключився — перезаписуємо з
 * новим IV (важливо: GCM з тим самим ключем+IV рве безпеку).
 */
export async function putToken(
  userId: string,
  provider: BankProvider,
  plaintext: string,
  db: VaultPool = pool,
): Promise<void> {
  const enc = encryptPayload(plaintext);
  await db.query(
    `INSERT INTO bank_tokens (user_id, provider, ciphertext, iv, auth_tag, key_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id, provider) DO UPDATE
       SET ciphertext = EXCLUDED.ciphertext,
           iv         = EXCLUDED.iv,
           auth_tag   = EXCLUDED.auth_tag,
           key_id     = EXCLUDED.key_id,
           updated_at = NOW()`,
    [userId, provider, enc.ciphertext, enc.iv, enc.auth_tag, enc.key_id],
  );
}

export async function getToken(
  userId: string,
  provider: BankProvider,
  db: VaultPool = pool,
): Promise<string | null> {
  const { rows } = await db.query<{
    ciphertext: Buffer;
    iv: Buffer;
    auth_tag: Buffer;
    key_id: string;
  }>(
    `SELECT ciphertext, iv, auth_tag, key_id
       FROM bank_tokens
      WHERE user_id = $1 AND provider = $2`,
    [userId, provider],
  );
  if (rows.length === 0) return null;
  try {
    return decryptPayload(rows[0]);
  } catch (e) {
    // Decrypt-fail — не мовчимо: це або biтова corruption, або зміна
    // ключа без ротації. Логуємо і віддаємо null, щоб caller міг або
    // попросити юзера перепідключитись, або fallback на X-Token-header.
    logger.error({
      msg: "bank_vault_decrypt_failed",
      provider,
      err: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function deleteToken(
  userId: string,
  provider: BankProvider,
  db: VaultPool = pool,
): Promise<boolean> {
  const { rowCount } = await db.query(
    `DELETE FROM bank_tokens WHERE user_id = $1 AND provider = $2`,
    [userId, provider],
  );
  return (rowCount ?? 0) > 0;
}

export async function hasToken(
  userId: string,
  provider: BankProvider,
  db: VaultPool = pool,
): Promise<boolean> {
  const { rows } = await db.query<{ present: boolean }>(
    `SELECT TRUE AS present FROM bank_tokens
      WHERE user_id = $1 AND provider = $2 LIMIT 1`,
    [userId, provider],
  );
  return rows.length > 0;
}

/**
 * Test-only helper: скидає in-memory кеш ключа. Продакшн-код ніколи не
 * повинен це кликати — ключ читається з env один раз на boot.
 */
export function _resetKeyCacheForTests(): void {
  cachedKey = null;
  cachedKeyChecked = false;
}
