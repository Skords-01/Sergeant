import { rateLimitHitsTotal } from "../obs/metrics.js";

function recordRateLimit(key, outcome) {
  try {
    rateLimitHitsTotal.inc({ key, outcome });
  } catch {
    /* metrics must never break a request */
  }
}

export function getIp(req) {
  const xf = req?.headers?.["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0].trim();
  const real = req?.headers?.["x-real-ip"];
  if (typeof real === "string" && real.trim()) return real.trim();
  return "unknown";
}

// In-memory fixed-window rate limit.
// На Railway це пер-процес best-effort, але ріже очевидні спайки.
const buckets = new Map();
let lastSweepMs = 0;

function sweepBuckets(now, ttlMs) {
  if (now - lastSweepMs < 30_000) return;
  lastSweepMs = now;

  if (buckets.size === 0) return;
  const max = Math.max(60_000, Number(ttlMs) || 0);
  for (const [k, v] of buckets.entries()) {
    const start = v?.startMs;
    if (typeof start !== "number") {
      buckets.delete(k);
      continue;
    }
    if (now - start > max) buckets.delete(k);
  }
}

/**
 * Fixed-window rate-limit check (in-memory, per-process).
 *
 * @param {import("express").Request} req
 * @param {{ key: string, limit: number, windowMs: number }} opts
 * @returns {{
 *   ok: boolean,
 *   remaining: number,
 *   resetMs: number,
 *   retryAfterSec: number,
 * }}
 */
export function checkRateLimit(req, { key, limit, windowMs }) {
  const ip = getIp(req);
  const now = Date.now();
  sweepBuckets(now, Math.max(5 * (Number(windowMs) || 0), 10 * 60_000));
  const k = `${key}:${ip}`;
  const cur = buckets.get(k);
  if (!cur || now - cur.startMs >= windowMs) {
    buckets.set(k, { startMs: now, count: 1 });
    recordRateLimit(key, "allowed");
    return {
      ok: true,
      remaining: limit - 1,
      resetMs: windowMs,
      retryAfterSec: Math.max(1, Math.ceil(windowMs / 1000)),
    };
  }
  if (cur.count >= limit) {
    recordRateLimit(key, "blocked");
    const resetMs = Math.max(0, windowMs - (now - cur.startMs));
    return {
      ok: false,
      remaining: 0,
      resetMs,
      retryAfterSec: Math.max(1, Math.ceil(resetMs / 1000)),
    };
  }
  cur.count += 1;
  recordRateLimit(key, "allowed");
  const resetMs = Math.max(0, windowMs - (now - cur.startMs));
  return {
    ok: true,
    remaining: Math.max(0, limit - cur.count),
    resetMs,
    retryAfterSec: Math.max(1, Math.ceil(resetMs / 1000)),
  };
}

export function rateLimitExpress({ key, limit, windowMs }) {
  return (req, res, next) => {
    const rl = checkRateLimit(req, { key, limit, windowMs });
    try {
      res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
    } catch {
      /* ignore */
    }
    if (!rl.ok) {
      try {
        res.setHeader("Retry-After", String(rl.retryAfterSec));
      } catch {
        /* ignore */
      }
      return res.status(429).json({
        error: "Забагато запитів. Спробуй пізніше.",
        code: "RATE_LIMIT",
        ...(req?.requestId ? { requestId: req.requestId } : {}),
      });
    }
    next();
  };
}
