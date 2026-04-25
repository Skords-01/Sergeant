import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";
import type { Mock } from "vitest";

vi.mock("../../db.js", () => ({
  query: vi.fn(),
}));

import { query as _query } from "../../db.js";
import { accountsHandler, transactionsHandler } from "./read.js";

const queryMock = _query as unknown as Mock;

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

function makeReq(
  query: Record<string, string> = {},
  userId = "user_1",
): Request {
  return {
    method: "GET",
    query,
    user: { id: userId },
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("accountsHandler", () => {
  it("returns accounts for authenticated user", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          userId: "user_1",
          monoAccountId: "acc1",
          sendId: null,
          type: "black",
          currencyCode: 980,
          cashbackType: "UAH",
          maskedPan: ["5375****1234"],
          iban: "UA123",
          balance: 10000,
          creditLimit: 0,
          lastSeenAt: new Date("2025-01-01T00:00:00Z"),
        },
      ],
    });

    const res = makeRes();
    await accountsHandler(makeReq(), res);

    expect(res.statusCode).toBe(200);
    const body = res.body as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0].monoAccountId).toBe("acc1");
    expect(body[0].lastSeenAt).toBe("2025-01-01T00:00:00.000Z");
    expect(body[0].maskedPan).toEqual(["5375****1234"]);
  });

  it("returns empty array when no accounts", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const res = makeRes();
    await accountsHandler(makeReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 401 if no user", async () => {
    const res = makeRes();
    await accountsHandler({ query: {} } as unknown as Request, res);

    expect(res.statusCode).toBe(401);
  });
});

describe("transactionsHandler", () => {
  it("returns transactions with cursor pagination", async () => {
    const rows = Array.from({ length: 51 }, (_, i) => ({
      userId: "user_1",
      monoAccountId: "acc1",
      monoTxId: `tx_${i}`,
      time: new Date(
        `2025-01-15T${String(12 - Math.floor(i / 6)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z`,
      ),
      amount: -(i + 1) * 100,
      operationAmount: -(i + 1) * 100,
      currencyCode: 980,
      mcc: null,
      originalMcc: null,
      hold: false,
      description: `tx ${i}`,
      comment: null,
      cashbackAmount: null,
      commissionRate: null,
      balance: 100000 - i * 100,
      receiptId: null,
      invoiceId: null,
      counterEdrpou: null,
      counterIban: null,
      counterName: null,
      source: "backfill",
      receivedAt: new Date("2025-01-15T00:00:00Z"),
    }));

    queryMock.mockResolvedValueOnce({ rows });

    const res = makeRes();
    await transactionsHandler(makeReq({}), res);

    expect(res.statusCode).toBe(200);
    const body = res.body as { data: unknown[]; nextCursor: string | null };
    expect(body.data).toHaveLength(50);
    expect(body.nextCursor).toBeTruthy();
  });

  it("returns null nextCursor when no more results", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          userId: "user_1",
          monoAccountId: "acc1",
          monoTxId: "tx_1",
          time: new Date("2025-01-15T12:00:00Z"),
          amount: -100,
          operationAmount: -100,
          currencyCode: 980,
          mcc: null,
          originalMcc: null,
          hold: false,
          description: "test",
          comment: null,
          cashbackAmount: null,
          commissionRate: null,
          balance: 100000,
          receiptId: null,
          invoiceId: null,
          counterEdrpou: null,
          counterIban: null,
          counterName: null,
          source: "webhook",
          receivedAt: new Date("2025-01-15T00:00:00Z"),
        },
      ],
    });

    const res = makeRes();
    await transactionsHandler(makeReq({}), res);

    expect(res.statusCode).toBe(200);
    const body = res.body as { data: unknown[]; nextCursor: string | null };
    expect(body.data).toHaveLength(1);
    expect(body.nextCursor).toBeNull();
  });

  it("applies from/to/accountId filters", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const res = makeRes();
    await transactionsHandler(
      makeReq({
        from: "2025-01-01T00:00:00Z",
        to: "2025-01-31T23:59:59Z",
        accountId: "acc1",
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).toContain("t.time >=");
    expect(sql).toContain("t.time <=");
    expect(sql).toContain("t.mono_account_id =");
  });

  it("applies cursor filter", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const res = makeRes();
    await transactionsHandler(
      makeReq({
        cursor: "2025-01-15T12:00:00.000Z:tx_25",
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    const sql = queryMock.mock.calls[0][0] as string;
    expect(sql).toContain("t.time <");
    expect(sql).toContain("t.mono_tx_id <");
    const params = queryMock.mock.calls[0][1] as unknown[];
    expect(params).toContain("2025-01-15T12:00:00.000Z");
    expect(params).toContain("tx_25");
  });

  it("returns 401 if no user", async () => {
    const res = makeRes();
    await transactionsHandler({ query: {} } as unknown as Request, res);

    expect(res.statusCode).toBe(401);
  });
});
