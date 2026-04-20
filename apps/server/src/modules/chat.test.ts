/**
 * Unit tests для server/modules/chat.js — tool-parsing з моканим Anthropic.
 *
 * Покриття:
 * - Перший крок: повертає tool_calls коли Anthropic присилає tool_use-блоки.
 * - Другий крок (tool_results + tool_calls_raw): повертає summary-текст.
 * - Перший крок без tool_use: повертає text напряму.
 * - Всі нові tools присутні у TOOLS з валідними input_schema.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";
import type { Mock } from "vitest";

vi.mock("../lib/anthropic.js", () => ({
  anthropicMessages: vi.fn(),
  anthropicMessagesStream: vi.fn(),
  extractAnthropicText: vi.fn(
    (d: { content?: { type: string; text?: string }[] }) =>
      (d?.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n"),
  ),
}));

import { anthropicMessages as _anthropicMessages } from "../lib/anthropic.js";
import handler from "./chat.js";

const anthropicMessages = _anthropicMessages as unknown as Mock;

interface TestRes {
  statusCode: number;
  body: unknown;
  status(code: number): TestRes;
  json(payload: unknown): TestRes;
}

function makeReq(body: unknown): Request {
  return { anthropicKey: "sk-test", body } as unknown as Request;
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
      this.body = payload;
      return this;
    },
  };
  return res as TestRes & Response;
}

function asRec(v: unknown): Record<string, unknown> {
  return v as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("chat handler — tool_use parsing", () => {
  it("повертає tool_calls коли Anthropic присилає tool_use-блоки", async () => {
    const toolUseBlock = {
      type: "tool_use",
      id: "toolu_01ABC",
      name: "delete_transaction",
      input: { tx_id: "m_abc123" },
    };
    anthropicMessages.mockResolvedValueOnce({
      response: { ok: true, status: 200 },
      data: { content: [{ type: "text", text: "Видаляю…" }, toolUseBlock] },
    });

    const req = makeReq({
      messages: [{ role: "user", content: "Видали транзакцію m_abc123" }],
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      text: "Видаляю…",
      tool_calls: [
        {
          id: "toolu_01ABC",
          name: "delete_transaction",
          input: { tx_id: "m_abc123" },
        },
      ],
    });
    expect(asRec(res.body).tool_calls_raw).toHaveLength(2);
    // Перевіряємо, що TOOLS передалися
    const callArg = anthropicMessages.mock.calls[0][1] as {
      tools: unknown[];
    };
    expect(Array.isArray(callArg.tools)).toBe(true);
    expect(callArg.tools.length).toBeGreaterThan(20);
  });

  it("повертає text напряму коли немає tool_use", async () => {
    anthropicMessages.mockResolvedValueOnce({
      response: { ok: true, status: 200 },
      data: { content: [{ type: "text", text: "Привіт!" }] },
    });

    const req = makeReq({
      messages: [{ role: "user", content: "Привіт" }],
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ text: "Привіт!" });
  });

  it("другий крок з tool_results → повертає summary-text", async () => {
    anthropicMessages.mockResolvedValueOnce({
      response: { ok: true, status: 200 },
      data: {
        content: [{ type: "text", text: "Готово, транзакцію видалено." }],
      },
    });

    const req = makeReq({
      messages: [{ role: "user", content: "Видали m_abc" }],
      tool_calls_raw: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "delete_transaction",
          input: { tx_id: "m_abc" },
        },
      ],
      tool_results: [
        { tool_use_id: "toolu_1", content: "Транзакцію m_abc видалено" },
      ],
    });
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(asRec(res.body).text).toContain("видалено");

    // Перевіряємо формат повідомлень до Anthropic на другому кроці
    const payload = anthropicMessages.mock.calls[0][1] as {
      messages: Array<{
        role: string;
        content: Array<{ type: string; tool_use_id?: string }>;
      }>;
    };
    expect(payload.messages).toHaveLength(3);
    expect(payload.messages[0]).toMatchObject({ role: "user" });
    expect(payload.messages[1]).toMatchObject({ role: "assistant" });
    expect(payload.messages[2].role).toBe("user");
    expect(payload.messages[2].content[0]).toMatchObject({
      type: "tool_result",
      tool_use_id: "toolu_1",
    });
  });

  it("400 коли немає повідомлень", async () => {
    const req = makeReq({ messages: [] });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Немає повідомлень" });
    expect(anthropicMessages).not.toHaveBeenCalled();
  });

  it("поширює помилку коли Anthropic повертає !ok", async () => {
    anthropicMessages.mockResolvedValueOnce({
      response: { ok: false, status: 429 },
      data: { error: { message: "rate limit" } },
    });
    const req = makeReq({
      messages: [{ role: "user", content: "hello" }],
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toEqual({ error: "rate limit" });
  });
});

describe("TOOLS registry — структура нових tools", () => {
  const expected = [
    // Фінік
    "delete_transaction",
    "update_budget",
    "mark_debt_paid",
    "add_asset",
    "import_monobank_range",
    // Фізрук
    "start_workout",
    "finish_workout",
    "log_measurement",
    "add_program_day",
    "log_wellbeing",
    // Рутина
    "create_reminder",
    "complete_habit_for_date",
    "archive_habit",
    "add_calendar_event",
    // Харчування
    "add_recipe",
    "add_to_shopping_list",
    "consume_from_pantry",
    "set_daily_plan",
    "log_weight",
  ];

  it("всі 19 нових tools передаються в Anthropic з валідним input_schema", async () => {
    anthropicMessages.mockResolvedValueOnce({
      response: { ok: true, status: 200 },
      data: { content: [{ type: "text", text: "ok" }] },
    });
    const req = makeReq({
      messages: [{ role: "user", content: "ping" }],
    });
    const res = makeRes();
    await handler(req, res);

    interface Tool {
      name: string;
      description: string;
      input_schema: {
        type: string;
        properties: Record<string, unknown>;
        required?: string[];
      };
    }
    const tools = (anthropicMessages.mock.calls[0][1] as { tools: Tool[] })
      .tools;
    const byName: Record<string, Tool> = Object.fromEntries(
      tools.map((t) => [t.name, t]),
    );
    for (const name of expected) {
      expect(
        byName[name],
        `tool "${name}" має бути зареєстрований`,
      ).toBeTruthy();
      expect(byName[name].description).toBeTypeOf("string");
      expect(byName[name].input_schema.type).toBe("object");
      expect(byName[name].input_schema.properties).toBeTypeOf("object");
    }

    // Обов'язкові required-поля для критичних tools
    expect(byName.delete_transaction.input_schema.required).toEqual(["tx_id"]);
    expect(byName.update_budget.input_schema.required).toEqual(["scope"]);
    expect(byName.mark_debt_paid.input_schema.required).toEqual(["debt_id"]);
    expect(byName.log_weight.input_schema.required).toEqual(["weight_kg"]);
    expect(byName.import_monobank_range.input_schema.required).toEqual([
      "from",
      "to",
    ]);
    expect(byName.create_reminder.input_schema.required).toEqual([
      "habit_id",
      "time",
    ]);
    expect(byName.add_calendar_event.input_schema.required).toEqual([
      "name",
      "date",
    ]);
  });
});
