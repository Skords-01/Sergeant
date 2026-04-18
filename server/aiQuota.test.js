import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("./auth.js", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("./db.js", () => {
  const pool = { connect: vi.fn() };
  return { default: pool, pool };
});

import { getSessionUser } from "./auth.js";
import pool from "./db.js";
import { assertAiQuota } from "./aiQuota.js";

function makeRes() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
}

function makeReq(headers = {}) {
  return {
    headers,
    socket: { remoteAddress: "1.2.3.4" },
  };
}

const ENV_VARS = [
  "AI_QUOTA_DISABLED",
  "AI_DAILY_USER_LIMIT",
  "AI_DAILY_ANON_LIMIT",
  "DATABASE_URL",
];
const savedEnv = {};

beforeEach(() => {
  for (const k of ENV_VARS) savedEnv[k] = process.env[k];
  vi.clearAllMocks();
});

afterEach(() => {
  for (const k of ENV_VARS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

describe("assertAiQuota", () => {
  it("returns true (no-op) when AI_QUOTA_DISABLED=1", async () => {
    process.env.AI_QUOTA_DISABLED = "1";
    const res = makeRes();
    const ok = await assertAiQuota(makeReq(), res);
    expect(ok).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(getSessionUser).not.toHaveBeenCalled();
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("fails open when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    process.env.AI_QUOTA_DISABLED = "0";
    getSessionUser.mockResolvedValue(null);
    const res = makeRes();
    const ok = await assertAiQuota(makeReq(), res);
    expect(ok).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.headers["X-AI-Quota-Remaining"]).toBe("unknown");
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it("fails open when the quota DB call throws", async () => {
    process.env.DATABASE_URL = "postgres://ignored";
    process.env.AI_QUOTA_DISABLED = "0";
    getSessionUser.mockResolvedValue(null);
    pool.connect.mockRejectedValue(
      Object.assign(new Error("ECONNREFUSED"), { code: "ECONNREFUSED" }),
    );
    const res = makeRes();
    const ok = await assertAiQuota(makeReq(), res);
    expect(ok).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBeUndefined();
    expect(res.headers["X-AI-Quota-Remaining"]).toBe("unknown");
  });

  it("fails open when getSessionUser throws", async () => {
    process.env.DATABASE_URL = "postgres://ignored";
    process.env.AI_QUOTA_DISABLED = "0";
    getSessionUser.mockRejectedValue(new Error("auth db down"));
    pool.connect.mockRejectedValue(new Error("db down"));
    const res = makeRes();
    const ok = await assertAiQuota(makeReq(), res);
    expect(ok).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.headers["X-AI-Quota-Remaining"]).toBe("unknown");
  });

  it("returns 429 when daily limit is reached", async () => {
    process.env.DATABASE_URL = "postgres://ignored";
    process.env.AI_QUOTA_DISABLED = "0";
    process.env.AI_DAILY_ANON_LIMIT = "2";
    getSessionUser.mockResolvedValue(null);
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ request_count: 2 }] }) // SELECT
      .mockResolvedValueOnce({}); // ROLLBACK
    pool.connect.mockResolvedValue(client);
    const res = makeRes();
    const ok = await assertAiQuota(makeReq(), res);
    expect(ok).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(res.body?.code).toBe("AI_QUOTA");
  });

  it("returns true and sets remaining header on success", async () => {
    process.env.DATABASE_URL = "postgres://ignored";
    process.env.AI_QUOTA_DISABLED = "0";
    process.env.AI_DAILY_ANON_LIMIT = "10";
    getSessionUser.mockResolvedValue(null);
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ request_count: 3 }] }) // SELECT
      .mockResolvedValueOnce({}) // UPDATE
      .mockResolvedValueOnce({}); // COMMIT
    pool.connect.mockResolvedValue(client);
    const res = makeRes();
    const ok = await assertAiQuota(makeReq(), res);
    expect(ok).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.headers["X-AI-Quota-Remaining"]).toBe("6");
  });
});
