import { getSessionUser } from "./auth.js";
import pool from "./db.js";
import { getIp } from "./api/lib/rateLimit.js";
import { logger } from "./obs/logger.js";
import { aiQuotaBlocksTotal, aiQuotaFailOpenTotal } from "./obs/metrics.js";

function parseLimit(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function isAiQuotaDisabled() {
  return process.env.AI_QUOTA_DISABLED === "1";
}

function effectiveLimits() {
  if (isAiQuotaDisabled()) return { user: null, anon: null };
  return {
    user: parseLimit("AI_DAILY_USER_LIMIT", 120),
    anon: parseLimit("AI_DAILY_ANON_LIMIT", 40),
  };
}

async function safeSessionUser(req) {
  try {
    return await getSessionUser(req);
  } catch (e) {
    logger.warn({
      msg: "ai_quota_session_lookup_failed",
      err: { message: e?.message || String(e) },
    });
    return null;
  }
}

/**
 * Перевірка та збільшення денного лічильника AI для залогіненого користувача або IP.
 * Повертає false, якщо відповідь вже відправлена (429).
 *
 * Квота зберігається в Postgres (ai_usage_daily). Якщо сховище тимчасово недоступне
 * (немає DATABASE_URL, впала БД, відсутня таблиця тощо) — fail-open: пропускаємо запит
 * і логуємо подію. Це advisory-ліміт, а не механізм безпеки: upstream (Anthropic) і
 * роут-специфічні `checkRateLimit` все одно захищають від зловживань.
 */
export async function assertAiQuota(req, res) {
  if (isAiQuotaDisabled()) return true;

  const { user: userLimit, anon: anonLimit } = effectiveLimits();
  const sessionUser = await safeSessionUser(req);
  const limit = sessionUser ? userLimit : anonLimit;

  if (limit == null) return true;

  if (limit === 0) {
    try {
      aiQuotaBlocksTotal.inc({ reason: "disabled" });
    } catch {
      /* ignore */
    }
    res.status(429).json({
      error: "AI-квота вимкнена для цього типу доступу.",
      code: "AI_QUOTA",
    });
    return false;
  }

  if (!process.env.DATABASE_URL) {
    logQuotaStoreUnavailable("database_url_missing");
    setRemainingHeader(res, "unknown");
    return true;
  }

  const subject = sessionUser ? `u:${sessionUser.id}` : `ip:${getIp(req)}`;
  const day = new Date().toISOString().slice(0, 10);

  try {
    const result = await consumeQuota(subject, day, limit);
    if (!result.ok) {
      try {
        aiQuotaBlocksTotal.inc({ reason: "limit" });
      } catch {
        /* ignore */
      }
      res.status(429).json({
        error: "Денний ліміт AI вичерпано. Спробуй завтра.",
        code: "AI_QUOTA",
        limit: result.limit,
      });
      return false;
    }
    setRemainingHeader(res, String(result.remaining));
    return true;
  } catch (e) {
    logQuotaStoreUnavailable("db_error", e);
    // Fail-open: краще пропустити запит, ніж блокувати всі AI-фічі через збій сховища квот.
    setRemainingHeader(res, "unknown");
    return true;
  }
}

function setRemainingHeader(res, value) {
  try {
    res.setHeader("X-AI-Quota-Remaining", value);
  } catch {
    /* ignore */
  }
}

function logQuotaStoreUnavailable(reason, e) {
  try {
    aiQuotaFailOpenTotal.inc({ reason });
  } catch {
    /* ignore */
  }
  logger.error({
    msg: "ai_quota_store_unavailable",
    reason,
    err: e ? { message: e?.message || String(e), code: e?.code } : undefined,
  });
}

async function consumeQuota(subject, day, limit) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const sel = await client.query(
      `SELECT request_count FROM ai_usage_daily WHERE subject_key = $1 AND usage_day = $2::date FOR UPDATE`,
      [subject, day],
    );
    const cur = sel.rows[0]?.request_count ?? 0;
    if (cur >= limit) {
      await client.query("ROLLBACK");
      return { ok: false, remaining: 0, limit };
    }
    const next = cur + 1;
    if (sel.rows.length === 0) {
      await client.query(
        `INSERT INTO ai_usage_daily (subject_key, usage_day, request_count) VALUES ($1, $2::date, 1)`,
        [subject, day],
      );
    } else {
      await client.query(
        `UPDATE ai_usage_daily SET request_count = $3 WHERE subject_key = $1 AND usage_day = $2::date`,
        [subject, day, next],
      );
    }
    await client.query("COMMIT");
    return { ok: true, remaining: limit - next, limit };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}
