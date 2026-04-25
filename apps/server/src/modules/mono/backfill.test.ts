import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";
import type { Mock } from "vitest";

vi.mock("../../db.js", () => ({
  query: vi.fn(),
}));

vi.mock("../../env/env.js", () => ({
  env: {
    MONO_TOKEN_ENC_KEY: undefined as string | undefined,
    MONO_WEBHOOK_ENABLED: true,
  },
}));

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

vi.mock("./crypto.js", () => ({
  decryptToken: vi.fn(),
  encryptToken: vi.fn(),
  tokenFingerprint: vi.fn(),
}));

import { query as _query } from "../../db.js";
import { env } from "../../env/env.js";
import { bankProxyFetch as _bankProxyFetch } from "../../lib/bankProxy.js";
import { decryptToken as _decryptToken } from "./crypto.js";
import {
  backfillHandler,
  __setBackfillSleep,
  __getActiveBackfills,
} from "./backfill.js";

const queryMock = _query as unknown as Mock;
const bankProxyFetch = _bankProxyFetch as unknown as Mock;
const decryptToken = _decryptToken as unknown as Mock;

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
  (env as { MONO_TOKEN_ENC_KEY: string | undefined }).MONO_TOKEN_ENC_KEY =
    undefined;
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

  it("returns 400 if no connection", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const res = makeRes();
    await backfillHandler(makeReq(), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: "No Monobank connection or decryption failed",
    });
  });

  it("returns 400 if MONO_TOKEN_ENC_KEY missing", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          token_ciphertext: Buffer.from("ct"),
          token_iv: Buffer.from("iv"),
          token_tag: Buffer.from("tag"),
        },
      ],
    });

    const res = makeRes();
    await backfillHandler(makeReq(), res);
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 if no accounts to backfill", async () => {
    (env as { MONO_TOKEN_ENC_KEY: string | undefined }).MONO_TOKEN_ENC_KEY =
      "a".repeat(64);
    decryptToken.mockReturnValue("test-token");

    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            token_ciphertext: Buffer.from("ct"),
            token_iv: Buffer.from("iv"),
            token_tag: Buffer.from("tag"),
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
    (env as { MONO_TOKEN_ENC_KEY: string | undefined }).MONO_TOKEN_ENC_KEY =
      "a".repeat(64);
    decryptToken.mockReturnValue("test-token");

    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            token_ciphertext: Buffer.from("ct"),
            token_iv: Buffer.from("iv"),
            token_tag: Buffer.from("tag"),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ mono_account_id: "acc1" }],
      })
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

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "started", accountsCount: 1 });

    await new Promise((r) => setTimeout(r, 100));

    expect(bankProxyFetch).toHaveBeenCalled();
    const call = bankProxyFetch.mock.calls[0][0];
    expect(call.upstream).toBe("monobank");
    expect(call.path).toContain("/personal/statement/acc1/");
  });

  it("guard releases after backfill completes", async () => {
    (env as { MONO_TOKEN_ENC_KEY: string | undefined }).MONO_TOKEN_ENC_KEY =
      "a".repeat(64);
    decryptToken.mockReturnValue("test-token");

    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            token_ciphertext: Buffer.from("ct"),
            token_iv: Buffer.from("iv"),
            token_tag: Buffer.from("tag"),
          },
        ],
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

  it("UPSERT query includes ON CONFLICT", async () => {
    (env as { MONO_TOKEN_ENC_KEY: string | undefined }).MONO_TOKEN_ENC_KEY =
      "a".repeat(64);
    decryptToken.mockReturnValue("test-token");

    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            token_ciphertext: Buffer.from("ct"),
            token_iv: Buffer.from("iv"),
            token_tag: Buffer.from("tag"),
          },
        ],
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

    const upsertCalls = queryMock.mock.calls.filter(
      (c: unknown[]) =>
        typeof c[0] === "string" && (c[0] as string).includes("ON CONFLICT"),
    );
    expect(upsertCalls.length).toBeGreaterThan(0);
  });

  it("pacing: uses sleep between accounts", async () => {
    const sleepMock = vi.fn(async () => {});
    __setBackfillSleep(sleepMock);

    (env as { MONO_TOKEN_ENC_KEY: string | undefined }).MONO_TOKEN_ENC_KEY =
      "a".repeat(64);
    decryptToken.mockReturnValue("test-token");

    queryMock
      .mockResolvedValueOnce({
        rows: [
          {
            token_ciphertext: Buffer.from("ct"),
            token_iv: Buffer.from("iv"),
            token_tag: Buffer.from("tag"),
          },
        ],
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

    expect(sleepMock).toHaveBeenCalledWith(60_000);
  });
});
