import type { Request, Response, NextFunction } from "express";

// When Express is configured with `app.set("trust proxy", 1)` (Railway),
// req.ip is already the correct client IP resolved from X-Forwarded-For.
// Fallback to manual header parsing for envs without trust proxy (Replit dev).
export function getIp(req: Request): string {
  if (req.ip && req.ip !== "::1" && req.ip !== "127.0.0.1") return req.ip;
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) return xf.split(",")[0].trim();
  const real = req.headers["x-real-ip"];
  if (typeof real === "string" && real.trim()) return real.trim();
  return "unknown";
}

// In-memory fixed-window rate limit.
// IMPORTANT: per-process only — ineffective if Railway scales to >1 instance.
// For multi-instance deployments, migrate to a shared store (PostgreSQL/Redis).
interface Bucket {
  startMs: number;
  count: number;
}

const buckets = new Map<string, Bucket>();
let lastSweepMs = 0;

function sweepBuckets(now: number, ttlMs: number): void {
  if (now - lastSweepMs < 30_000) return;
  lastSweepMs = now;

  if (buckets.size === 0) return;
  const max = Math.max(60_000, ttlMs);
  for (const [k, v] of buckets.entries()) {
    if (now - v.startMs > max) buckets.delete(k);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetMs: number;
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export function checkRateLimit(
  req: Request,
  { key, limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const ip = getIp(req);
  const now = Date.now();
  sweepBuckets(now, Math.max(5 * windowMs, 10 * 60_000));
  const k = `${key}:${ip}`;
  const cur = buckets.get(k);
  if (!cur || now - cur.startMs >= windowMs) {
    buckets.set(k, { startMs: now, count: 1 });
    return { ok: true, remaining: limit - 1, resetMs: windowMs };
  }
  if (cur.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      resetMs: Math.max(0, windowMs - (now - cur.startMs)),
    };
  }
  cur.count += 1;
  return {
    ok: true,
    remaining: Math.max(0, limit - cur.count),
    resetMs: Math.max(0, windowMs - (now - cur.startMs)),
  };
}

export function rateLimitExpress({ key, limit, windowMs }: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const rl = checkRateLimit(req, { key, limit, windowMs });
    try {
      res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
    } catch {
      /* ignore */
    }
    if (!rl.ok) {
      try {
        res.setHeader("Retry-After", String(Math.ceil(rl.resetMs / 1000)));
      } catch {
        /* ignore */
      }
      res.status(429).json({
        error: "Забагато запитів. Спробуй пізніше.",
        code: "RATE_LIMIT",
        ...("requestId" in req && req.requestId
          ? { requestId: req.requestId }
          : {}),
      });
      return;
    }
    next();
  };
}
