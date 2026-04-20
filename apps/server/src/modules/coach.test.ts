import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";
import type { Mock } from "vitest";

vi.mock("../db.js", () => {
  const pool = { query: vi.fn() };
  return { default: pool, pool };
});

vi.mock("../lib/anthropic.js", () => ({
  anthropicMessages: vi.fn(),
  // Дзеркалимо реальну реалізацію з `server/lib/anthropic.js`, включно з
  // `.trim()` — без нього LLM-відповіді з trailing newline-ами проходили б у
  // моку, але не у проді, а assert-и на точний `toBe()` давали б false-pass.
  extractAnthropicText: vi.fn(
    (d: { content?: { type: string; text?: string }[] }) =>
      (d?.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim(),
  ),
}));

import _pool from "../db.js";
import { anthropicMessages as _anthropicMessages } from "../lib/anthropic.js";
import { coachInsight, coachMemoryGet, coachMemoryPost } from "./coach.js";
import { MAX_BLOB_SIZE } from "./sync.js";

const pool = _pool as unknown as { query: Mock };
const anthropicMessages = _anthropicMessages as unknown as Mock;

interface TestRes {
  statusCode: number;
  body:
    | {
        error?: string;
        details?: unknown;
        ok?: boolean;
        insight?: string;
        memory?: unknown;
      }
    | undefined;
  status(code: number): TestRes;
  json(payload: unknown): TestRes;
}

function makeRes(): TestRes & Response {
  const res: TestRes = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload as TestRes["body"];
      return this;
    },
  };
  return res as TestRes & Response;
}

function asReq(v: unknown): Request {
  return v as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("coachMemoryPost blob-size guard", () => {
  it("повертає 413 коли merged-blob перевищує MAX_BLOB_SIZE і не робить INSERT", async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ data: JSON.stringify({ weeklyDigests: [] }) }],
    });

    const huge = "x".repeat(MAX_BLOB_SIZE + 1);
    const req = {
      user: { id: "user_1" },
      body: {
        weeklyDigest: {
          weekKey: "2026-W01",
          weekRange: huge,
        },
      },
    };
    const res = makeRes();

    await coachMemoryPost(asReq(req), res);

    expect(res.statusCode).toBe(413);
    expect(res.body).toEqual({ error: "Coach memory blob too large" });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it("нормальний розмір: робить INSERT і повертає ok", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const req = {
      user: { id: "user_1" },
      body: {
        weeklyDigest: {
          weekKey: "2026-W01",
          weekRange: "1–7 Jan",
          finyk: { summary: "усе ок" },
        },
      },
    };
    const res = makeRes();

    await coachMemoryPost(asReq(req), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(pool.query).toHaveBeenCalledTimes(2);
    const insertCall = pool.query.mock.calls[1] as [string, unknown[]];
    expect(insertCall[0]).toMatch(/INSERT INTO module_data/);
    expect(insertCall[1][0]).toBe("user_1");
  });

  it("невалідне body (weeklyDigest без weekKey) → 400 з issues", async () => {
    const req = {
      user: { id: "user_1" },
      body: { weeklyDigest: { weekRange: "no key here" } },
    };
    const res = makeRes();
    await coachMemoryPost(asReq(req), res);
    expect(res.statusCode).toBe(400);
    expect(res.body!.error).toBe("Некоректні дані запиту");
    expect(res.body!.details).toBeInstanceOf(Array);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe("coachMemoryGet", () => {
  it("повертає збережену пам'ять", async () => {
    const memory = {
      weeklyDigests: [{ weekKey: "2026-W01", finyk: { summary: "ok" } }],
    };
    pool.query.mockResolvedValueOnce({
      rows: [{ data: JSON.stringify(memory) }],
    });
    const res = makeRes();
    await coachMemoryGet(asReq({ user: { id: "user_1" } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, memory });
  });

  it("повертає null коли для користувача ще нема coach-рядка", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = makeRes();
    await coachMemoryGet(asReq({ user: { id: "user_1" } }), res);
    expect(res.body).toEqual({ ok: true, memory: null });
  });
});

describe("coachInsight", () => {
  function makeReq(body: unknown): Request {
    return {
      user: { id: "user_1" },
      anthropicKey: "sk-test",
      body,
    } as unknown as Request;
  }

  it("happy: віддає insight-текст на основі snapshot+memory", async () => {
    anthropicMessages.mockResolvedValueOnce({
      response: { ok: true, status: 200 },
      data: {
        content: [
          {
            type: "text",
            text: "Помітив, що ти 3 тижні поспіль тримаєш дефіцит.",
          },
        ],
      },
    });

    const res = makeRes();
    await coachInsight(
      makeReq({
        snapshot: {
          finyk: {
            totalSpent: 5000,
            totalIncome: 12000,
            txCount: 34,
            topCategories: [{ name: "Продукти", amount: 1500 }],
          },
        },
        memory: { weeklyDigests: [] },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
    expect(res.body!.insight).toContain("дефіцит");

    // System prompt повинен містити блоки SNAPSHOT/MEMORY і звертання до AI.
    const [, payload] = anthropicMessages.mock.calls[0] as [
      unknown,
      {
        model: string;
        messages: { content: string }[];
      },
    ];
    expect(payload.model).toMatch(/^claude-/);
    const user = payload.messages[0].content;
    expect(user).toContain("ФІНАНСИ ЦЬОГО ТИЖНЯ");
    expect(user).toContain("5000");
  });

  it("invalid body (snapshot.finyk з неправильним типом) → 400", async () => {
    const res = makeRes();
    await coachInsight(
      makeReq({
        snapshot: { finyk: { totalSpent: "не число" } },
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body!.error).toBe("Некоректні дані запиту");
    expect(anthropicMessages).not.toHaveBeenCalled();
  });

  it("AI upstream !ok → прокидає status+message (AI timeout/500 сценарій)", async () => {
    anthropicMessages.mockResolvedValueOnce({
      response: { ok: false, status: 504 },
      data: { error: { message: "Upstream timeout" } },
    });
    const res = makeRes();
    await coachInsight(makeReq({ snapshot: {}, memory: {} }), res);
    expect(res.statusCode).toBe(504);
    expect(res.body).toEqual({ error: "Upstream timeout" });
  });

  it("AI відповідь без помилкового тіла → fallback 'AI error'", async () => {
    anthropicMessages.mockResolvedValueOnce({
      response: { ok: false, status: 500 },
      data: null,
    });
    const res = makeRes();
    await coachInsight(makeReq({ snapshot: {}, memory: {} }), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "AI error" });
  });

  it("порожній snapshot → prompt містить 'Даних за поточний тиждень ще немає.'", async () => {
    anthropicMessages.mockResolvedValueOnce({
      response: { ok: true, status: 200 },
      data: { content: [{ type: "text", text: "ok" }] },
    });
    const res = makeRes();
    await coachInsight(makeReq({}), res);
    expect(res.statusCode).toBe(200);
    const [, payload] = anthropicMessages.mock.calls[0] as [
      unknown,
      { messages: { content: string }[] },
    ];
    expect(payload.messages[0].content).toContain(
      "Даних за поточний тиждень ще немає.",
    );
  });
});
