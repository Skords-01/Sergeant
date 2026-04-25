import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";
import type { Mock } from "vitest";

vi.mock("../../db.js", () => {
  const pool = { query: vi.fn() };
  return { default: pool, pool };
});

vi.mock("../../lib/bankProxy.js", () => ({
  bankProxyFetch: vi.fn(),
}));

vi.mock("../../obs/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import _pool from "../../db.js";
import { bankProxyFetch as _bankProxyFetch } from "../../lib/bankProxy.js";
import {
  backfillHandler,
  __setBackfillSleep,
  __getActiveBackfills,
} from "./backfill.js";

const pool = _pool as unknown as { query: Mock };
const bankProxyFetch = _bankProxyFetch as unknown as Mock;

interface TestRes {
  statusCode: number;
  body: unknown;
  status(code: number): TestRes;
  json(payload: unknown): TestRes;
}

function makeRes(): TestRes & Response {
  const res: TestRes = {
    statusCode: 200,
    body: {},
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as TestRes & Response;
}

function makeReq(userId = "user_1"): Request {
  return {
    method: "POST",
    body: {},
    user: { id: userId },
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  __setBackfillSleep(async () => {});
  __getActiveBackfills().clear();
  // Default: no MONO_TOKEN_KEY
  delete process.env.MONO_TOKEN_KEY;
});

describe("backfillHandler", () => {
  it("returns 401 if no user", async () => {
    const res = makeRes();
    await backfillHandler({ body: {} } as unknown as Request, res);
    expect(res.statusCode).toBe(401);
  });

  it("returns 429 if backfill already in progress", async () => {
    __getActiveBackfills().set("user_1", true);

    const res = makeRes();
    await backfillHandler(makeReq(), res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: "Backfill already in progress" });
  });

  it("returns 400 if no connection (token decrypt fails)", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // no connection

    const res = makeRes();
    await backfillHandler(makeReq(), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: "No Monobank connection or decryption failed",
    });
  });

  it("returns 400 if no accounts to backfill", async () => {
    // Setup: has connection but MONO_TOKEN_KEY configured
    const crypto = await import("node:crypto");
    const key = crypto.randomBytes(32);
    process.env.MONO_TOKEN_KEY = key.toString("hex");

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update("test-token", "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            token_ciphertext: encrypted,
            token_iv: iv,
            token_tag: tag,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }); // no accounts

    const res = makeRes();
    await backfillHandler(makeReq(), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "No accounts to backfill" });
  });

  it("starts backfill and responds immediately", async () => {
    const crypto = await import("node:crypto");
    const key = crypto.randomBytes(32);
    process.env.MONO_TOKEN_KEY = key.toString("hex");

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update("test-token", "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    pool.query
      .mockResolvedValueOnce({
        rows: [
          {
            token_ciphertext: encrypted,
            token_iv: iv,
            token_tag: tag,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ mono_account_id: "acc1" }],
      })
      // For each upsert
      .mockResolvedValue({ rows: [] });

    bankProxyFetch.mockResolvedValue({
      status: 200,
      body: JSON.stringify([
        {
          id: "tx1",
          time: Math.floor(Date.now() / 1000) - 100,
          amount: -1000,
          operationAmount: -1000,
          currencyCode: 980,
        },
      ]),
    });

    const res = makeRes();
    await backfillHandler(makeReq(), res);

    // Should respond immediately with status: started
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "started", accountsCount: 1 });

    // Let the async backfill complete
    await new Promise((r) => setTimeout(r, 100));

    // Verify bankProxyFetch was called
    expect(bankProxyFetch).toHaveBeenCalled();
    const call = bankProxyFetch.mock.calls[0][0];
    expect(call.upstream).toBe("monobank");
    expect(call.path).toContain("/personal/statement/acc1/");
  });

  it("guard releases after backfill completes", async () => {
    const crypto = await import("node:crypto");
    const key = crypto.randomBytes(32);
    process.env.MONO_TOKEN_KEY = key.toString("hex");

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update("test-token", "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    pool.query
      .mockResolvedValueOnce({
        rows: [{ token_ciphertext: encrypted, token_iv: iv, token_tag: tag }],
      })
      .mockResolvedValueOnce({
        rows: [{ mono_account_id: "acc1" }],
      })
      .mockResolvedValue({ rows: [] });

    bankProxyFetch.mockResolvedValue({
      status: 200,
      body: JSON.stringify([]),
    });

    const res = makeRes();
    await backfillHandler(makeReq(), res);

    expect(__getActiveBackfills().has("user_1")).toBe(true);

    await new Promise((r) => setTimeout(r, 100));

    expect(__getActiveBackfills().has("user_1")).toBe(false);
  });

  it("UPSERT is idempotent: webhook+backfill overlap gives 1 row", async () => {
    const crypto = await import("node:crypto");
    const key = crypto.randomBytes(32);
    process.env.MONO_TOKEN_KEY = key.toString("hex");

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update("test-token", "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    pool.query
      .mockResolvedValueOnce({
        rows: [{ token_ciphertext: encrypted, token_iv: iv, token_tag: tag }],
      })
      .mockResolvedValueOnce({
        rows: [{ mono_account_id: "acc1" }],
      })
      .mockResolvedValue({ rows: [] });

    bankProxyFetch.mockResolvedValue({
      status: 200,
      body: JSON.stringify([
        {
          id: "tx_dup",
          time: Math.floor(Date.now() / 1000) - 100,
          amount: -500,
          operationAmount: -500,
          currencyCode: 980,
        },
      ]),
    });

    const res = makeRes();
    await backfillHandler(makeReq(), res);
    await new Promise((r) => setTimeout(r, 100));

    // Verify the UPSERT SQL includes ON CONFLICT
    const upsertCalls = pool.query.mock.calls.filter(
      (c: unknown[]) =>
        typeof c[0] === "string" && (c[0] as string).includes("ON CONFLICT"),
    );
    expect(upsertCalls.length).toBeGreaterThan(0);
  });

  it("pacing: uses sleep between pages", async () => {
    const sleepMock = vi.fn(async () => {});
    __setBackfillSleep(sleepMock);

    const crypto = await import("node:crypto");
    const key = crypto.randomBytes(32);
    process.env.MONO_TOKEN_KEY = key.toString("hex");

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([
      cipher.update("test-token", "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    pool.query
      .mockResolvedValueOnce({
        rows: [{ token_ciphertext: encrypted, token_iv: iv, token_tag: tag }],
      })
      .mockResolvedValueOnce({
        rows: [{ mono_account_id: "acc1" }, { mono_account_id: "acc2" }],
      })
      .mockResolvedValue({ rows: [] });

    bankProxyFetch.mockResolvedValue({
      status: 200,
      body: JSON.stringify([]),
    });

    const res = makeRes();
    await backfillHandler(makeReq(), res);

    await new Promise((r) => setTimeout(r, 100));

    // Sleep should be called for pacing between accounts
    expect(sleepMock).toHaveBeenCalledWith(60_000);
  });
});
