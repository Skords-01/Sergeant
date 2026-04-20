import type { Request, RequestHandler } from "express";
import { rateLimitHitsTotal } from "../obs/metrics.js";

type Outcome = "allowed" | "blocked";

function recordRateLimit(key: string, outcome: Outcome): void {
  try {
    rateLimitHitsTotal.inc({ key, outcome });
  } catch {
    /* metrics must never break a request */
  }
}

/**
 * Resolves the client's originating IP. Prefer Express's `req.ip`, which
 * respects `app.set('trust proxy', …)` and correctly peels off hops from
 * X-Forwarded-For — taking the first entry of a raw X-Forwarded-For is a
 * trivial rate-limit / quota bypass (a client can prepend any value and the
 * proxy only appends the real IP after it).
 *
 * We only fall back to parsing headers directly when Express did not surface
 * an IP (no trust-proxy configured AND no socket.remoteAddress), and even
 * then we pick the LAST entry — that's the one closest to our infra.
 */
export function getIp(req: Request): string {
  const fromExpress = req?.ip;
  if (typeof fromExpress === "string" && fromExpress.trim()) {
    return fromExpress.trim();
  }
  const xf = req?.headers?.["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    const parts = xf.split(",");
    return parts[parts.length - 1].trim();
  }
  const real = req?.headers?.["x-real-ip"];
  if (typeof real === "string" && real.trim()) return real.trim();
  return "unknown";
}

interface Bucket {
  startMs: number;
  count: number;
  // Per-bucket window so the global sweep never evicts a long-window
  // bucket based on another route's short window. Stored with the entry
  // rather than inferred from the current request.
  windowMs: number;
}

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetMs: number;
  retryAfterSec: number;
}

// In-memory fixed-window rate limit.
// На Railway це пер-процес best-effort, але ріже очевидні спайки.
const buckets = new Map<string, Bucket>();
let lastSweepMs = 0;

function sweepBuckets(now: number): void {
  if (now - lastSweepMs < 30_000) return;
  lastSweepMs = now;

  if (buckets.size === 0) return;
  for (const [k, v] of buckets.entries()) {
    const start = v?.startMs;
    if (typeof start !== "number") {
      buckets.delete(k);
      continue;
    }
    // Each bucket carries its own window; we only evict once the window
    // has elapsed with some slack, so a sweep triggered by a short-window
    // route cannot wipe still-valid state for a long-window route.
    const bucketWindow = Math.max(60_000, Number(v.windowMs) || 0);
    if (now - start > bucketWindow) buckets.delete(k);
  }
}

/**
 * Витягує userId з `req.user.id`, якщо попередній middleware (напр.
 * `requireSession`) вже резолвнув сесію. Це використовується як пріоритетний
 * rate-limit ключ перед IP: мобільні юзери ходять з динамічних IP (LTE,
 * VPN, CGN), а один автентифікований користувач не має "скидувати" лімет
 * просто перейшовши з Wi-Fi на мобільні дані.
 *
 * Контракт узгоджений з `server/aiQuota.ts` → `subjectFor`, який теж
 * префіксує `u:` / `ip:`, тож метрики/логи rate-limit vs AI-квот легко
 * корелювати по одному subject.
 */
export function rateLimitSubject(req: Request): string {
  const user = (req as Request & { user?: { id?: unknown } }).user;
  const id = user && typeof user.id === "string" ? user.id : "";
  if (id) return `u:${id}`;
  return `ip:${getIp(req)}`;
}

/**
 * Fixed-window rate-limit check (in-memory, per-process).
 */
export function checkRateLimit(
  req: Request,
  { key, limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const subject = rateLimitSubject(req);
  const now = Date.now();
  sweepBuckets(now);
  const k = `${key}:${subject}`;
  const cur = buckets.get(k);
  if (!cur || now - cur.startMs >= windowMs) {
    buckets.set(k, { startMs: now, count: 1, windowMs });
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

export function rateLimitExpress({
  key,
  limit,
  windowMs,
}: RateLimitOptions): RequestHandler {
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
      const requestId = (req as Request & { requestId?: string }).requestId;
      res.status(429).json({
        error: "Забагато запитів. Спробуй пізніше.",
        code: "RATE_LIMIT",
        ...(requestId ? { requestId } : {}),
      });
      return;
    }
    next();
  };
}
