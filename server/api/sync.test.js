import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../auth.js", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("../db.js", () => {
  const pool = { connect: vi.fn(), query: vi.fn() };
  return { default: pool, pool };
});

vi.mock("../obs/requestContext.js", () => ({
  setRequestModule: vi.fn(),
}));

vi.mock("../obs/metrics.js", () => ({
  syncConflictsTotal: { inc: vi.fn() },
  syncDurationMs: { observe: vi.fn() },
  syncOperationsTotal: { inc: vi.fn() },
  syncPayloadBytes: { observe: vi.fn() },
}));

import { getSessionUser } from "../auth.js";
import pool from "../db.js";
import { syncConflictsTotal, syncOperationsTotal } from "../obs/metrics.js";
import { syncPushAll } from "./sync.js";

function makeRes() {
  return {
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
  };
}

function makeReq(body) {
  return { method: "POST", body };
}

/** Збирає всі виклики `.inc(labels)` у масив для зручних assert-ів. */
function outcomesFor(op) {
  return syncOperationsTotal.inc.mock.calls
    .map(([labels]) => labels)
    .filter((l) => l.op === op);
}

beforeEach(() => {
  vi.clearAllMocks();
  getSessionUser.mockResolvedValue({ id: "user_1" });
});

describe("syncPushAll metric correctness around transaction boundary", () => {
  it("emits per-module outcomes only after COMMIT succeeds", async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      // finyk — ok
      .mockResolvedValueOnce({
        rows: [{ server_updated_at: "2026-01-01T00:00:00Z", version: 2 }],
      })
      // routine — ok
      .mockResolvedValueOnce({
        rows: [{ server_updated_at: "2026-01-01T00:00:01Z", version: 5 }],
      })
      .mockResolvedValueOnce({}); // COMMIT
    pool.connect.mockResolvedValue(client);

    const res = makeRes();
    await syncPushAll(
      makeReq({
        modules: {
          finyk: { data: { x: 1 }, clientUpdatedAt: "2026-01-01T00:00:00Z" },
          routine: { data: { y: 2 }, clientUpdatedAt: "2026-01-01T00:00:00Z" },
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);

    const pushOutcomes = outcomesFor("push");
    expect(pushOutcomes).toHaveLength(2);
    expect(pushOutcomes.map((o) => [o.module, o.outcome])).toEqual(
      expect.arrayContaining([
        ["finyk", "ok"],
        ["routine", "ok"],
      ]),
    );
    expect(outcomesFor("push_all")).toEqual([
      { op: "push_all", module: "all", outcome: "ok" },
    ]);
  });

  it("reclassifies in-flight records as error when COMMIT fails → ROLLBACK", async () => {
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      // finyk — «успішний» INSERT у межах транзакції
      .mockResolvedValueOnce({
        rows: [{ server_updated_at: "2026-01-01T00:00:00Z", version: 2 }],
      })
      // routine — INSERT кидає (наприклад, deadlock)
      .mockRejectedValueOnce(
        Object.assign(new Error("deadlock detected"), { code: "40P01" }),
      )
      .mockResolvedValueOnce({}); // ROLLBACK
    pool.connect.mockResolvedValue(client);

    const res = makeRes();
    await expect(
      syncPushAll(
        makeReq({
          modules: {
            finyk: { data: { x: 1 }, clientUpdatedAt: "2026-01-01T00:00:00Z" },
            routine: {
              data: { y: 2 },
              clientUpdatedAt: "2026-01-01T00:00:00Z",
            },
          },
        }),
        res,
      ),
    ).rejects.toThrow(/deadlock/);

    // Ключова гарантія: finyk, який «пройшов» INSERT у try-блоці, ПІСЛЯ
    // ROLLBACK-у враховується як error, а не як ok.
    const pushOutcomes = outcomesFor("push");
    expect(pushOutcomes).toEqual([
      expect.objectContaining({
        op: "push",
        module: "finyk",
        outcome: "error",
      }),
    ]);
    expect(outcomesFor("push_all")).toEqual([
      { op: "push_all", module: "all", outcome: "error" },
    ]);
    // Conflict counter НЕ має рухатись при error-гілці.
    expect(syncConflictsTotal.inc).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("emits too_large immediately (pre-DML reject), but defers ok/conflict until COMMIT", async () => {
    const big = "x".repeat(6 * 1024 * 1024); // > 5 MB MAX_BLOB_SIZE
    const client = {
      query: vi.fn(),
      release: vi.fn(),
    };
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      // nutrition — conflict (INSERT returns 0 rows → SELECT existing)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ server_updated_at: "2026-01-01T00:00:00Z", version: 7 }],
      })
      .mockResolvedValueOnce({}); // COMMIT
    pool.connect.mockResolvedValue(client);

    const res = makeRes();
    await syncPushAll(
      makeReq({
        modules: {
          // too_large — reject до DML, метрика емітиться одразу в циклі.
          finyk: { data: big, clientUpdatedAt: "2026-01-01T00:00:00Z" },
          nutrition: {
            data: { z: 3 },
            clientUpdatedAt: "2026-01-01T00:00:00Z",
          },
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.results.finyk).toEqual({ ok: false, error: "Too large" });
    expect(res.body.results.nutrition).toMatchObject({
      ok: true,
      conflict: true,
      version: 7,
    });

    const pushOutcomes = outcomesFor("push");
    expect(pushOutcomes.map((o) => [o.module, o.outcome])).toEqual(
      expect.arrayContaining([
        ["finyk", "too_large"],
        ["nutrition", "conflict"],
      ]),
    );
    expect(syncConflictsTotal.inc).toHaveBeenCalledWith({
      module: "nutrition",
    });
  });
});
