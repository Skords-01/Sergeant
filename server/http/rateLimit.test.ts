import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request } from "express";

// Metrics are a global singleton — reset between tests so label counts don't
// leak across cases. Inline mock keeps test isolation tight.
vi.mock("../obs/metrics.js", async () => {
  const actual = await vi.importActual("../obs/metrics.js");
  return {
    ...actual,
    rateLimitHitsTotal: { inc: vi.fn() },
  };
});

import { getIp, checkRateLimit } from "./rateLimit.js";

function asReq(partial: Partial<Request> & Record<string, unknown>): Request {
  return partial as unknown as Request;
}

describe("getIp", () => {
  it("returns req.ip when Express populated it (trust-proxy path)", () => {
    const req = asReq({
      ip: "203.0.113.10",
      headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.10" },
    });
    expect(getIp(req)).toBe("203.0.113.10");
  });

  it("ignores a spoofed X-Forwarded-For first entry when req.ip is present", () => {
    // Regression for the rate-limit / quota bypass: with trust proxy = 1,
    // Railway appends the real client IP at the end of XFF. A client sending
    // `X-Forwarded-For: 1.1.1.1` must NOT end up bucketed as 1.1.1.1.
    const req = asReq({
      ip: "198.51.100.7",
      headers: { "x-forwarded-for": "1.1.1.1, 198.51.100.7" },
    });
    expect(getIp(req)).toBe("198.51.100.7");
  });

  it("falls back to the LAST X-Forwarded-For entry when req.ip is missing", () => {
    const req = asReq({
      headers: { "x-forwarded-for": "1.1.1.1, 198.51.100.7" },
    });
    expect(getIp(req)).toBe("198.51.100.7");
  });

  it("falls back to x-real-ip when both req.ip and XFF are missing", () => {
    const req = asReq({ headers: { "x-real-ip": "10.0.0.42" } });
    expect(getIp(req)).toBe("10.0.0.42");
  });

  it('returns "unknown" when nothing is available', () => {
    expect(getIp(asReq({ headers: {} }))).toBe("unknown");
  });

  it("trims whitespace in all paths", () => {
    expect(getIp(asReq({ ip: "  10.0.0.1  ", headers: {} }))).toBe("10.0.0.1");
    expect(
      getIp(asReq({ headers: { "x-forwarded-for": "  1.1.1.1 , 9.9.9.9  " } })),
    ).toBe("9.9.9.9");
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  function makeReq(ip: string): Request {
    return asReq({ ip, headers: {} });
  }

  it("allows up to the limit and blocks the limit+1 hit", () => {
    // Unique key per test so shared in-process Map state doesn't collide.
    const key = `t_allow_${Math.random().toString(36).slice(2)}`;
    const req = makeReq("192.0.2.1");

    const r1 = checkRateLimit(req, { key, limit: 2, windowMs: 60_000 });
    const r2 = checkRateLimit(req, { key, limit: 2, windowMs: 60_000 });
    const r3 = checkRateLimit(req, { key, limit: 2, windowMs: 60_000 });

    expect(r1.ok).toBe(true);
    expect(r1.remaining).toBe(1);
    expect(r2.ok).toBe(true);
    expect(r2.remaining).toBe(0);
    expect(r3.ok).toBe(false);
    expect(r3.remaining).toBe(0);
    // retryAfter is a positive integer (seconds)
    expect(r3.retryAfterSec).toBeGreaterThan(0);
  });

  it("isolates buckets per-IP", () => {
    const key = `t_iso_${Math.random().toString(36).slice(2)}`;
    const a = checkRateLimit(makeReq("10.0.0.1"), {
      key,
      limit: 1,
      windowMs: 60_000,
    });
    const b = checkRateLimit(makeReq("10.0.0.2"), {
      key,
      limit: 1,
      windowMs: 60_000,
    });
    const aAgain = checkRateLimit(makeReq("10.0.0.1"), {
      key,
      limit: 1,
      windowMs: 60_000,
    });

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(aAgain.ok).toBe(false);
  });

  it("isolates buckets per-key (same IP, different route)", () => {
    const req = makeReq("192.0.2.9");
    const a = checkRateLimit(req, {
      key: `ka_${Date.now()}`,
      limit: 1,
      windowMs: 60_000,
    });
    const b = checkRateLimit(req, {
      key: `kb_${Date.now()}`,
      limit: 1,
      windowMs: 60_000,
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });

  it("rolls the window after windowMs elapses", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      const key = `t_window_${Math.random().toString(36).slice(2)}`;
      const req = makeReq("192.0.2.5");
      const first = checkRateLimit(req, { key, limit: 1, windowMs: 1_000 });
      const blocked = checkRateLimit(req, { key, limit: 1, windowMs: 1_000 });
      expect(first.ok).toBe(true);
      expect(blocked.ok).toBe(false);

      vi.advanceTimersByTime(1_500);
      const reopened = checkRateLimit(req, { key, limit: 1, windowMs: 1_000 });
      expect(reopened.ok).toBe(true);
      expect(reopened.remaining).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves a long-window bucket when a short-window route triggers a sweep", () => {
    // Regression for the shared-TTL bug: sweepBuckets previously used the
    // current request's windowMs as a global eviction threshold. After the
    // fix, each bucket's own window is used.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      const longKey = `long_${Math.random().toString(36).slice(2)}`;
      const shortKey = `short_${Math.random().toString(36).slice(2)}`;
      const ip = "192.0.2.77";
      const req = makeReq(ip);

      // Occupy the long-window bucket (1h) with a single hit.
      const opened = checkRateLimit(req, {
        key: longKey,
        limit: 1,
        windowMs: 60 * 60_000,
      });
      expect(opened.ok).toBe(true);

      // Advance past the sweep debounce (>30s), then fire a short-window hit
      // whose windowMs would previously have evicted the long-window bucket.
      vi.advanceTimersByTime(2 * 60_000);
      const shortHit = checkRateLimit(makeReq("10.9.8.7"), {
        key: shortKey,
        limit: 10,
        windowMs: 15_000,
      });
      expect(shortHit.ok).toBe(true);

      // Long bucket must still be saturated — the earlier hit was NOT swept.
      const replay = checkRateLimit(req, {
        key: longKey,
        limit: 1,
        windowMs: 60 * 60_000,
      });
      expect(replay.ok).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("retryAfterSec is at least 1 second even for sub-second windows", () => {
    const key = `t_retry_${Math.random().toString(36).slice(2)}`;
    const req = makeReq("192.0.2.100");
    checkRateLimit(req, { key, limit: 1, windowMs: 100 });
    const blocked = checkRateLimit(req, { key, limit: 1, windowMs: 100 });
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThanOrEqual(1);
  });
});
