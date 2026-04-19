import { describe, it, expect } from "vitest";
import { validateBody, validateQuery } from "./validate.js";
import {
  ChatRequestSchema,
  AnalyzePhotoSchema,
  ParsePantrySchema,
  RecommendRecipesSchema,
  z,
} from "./schemas.js";

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe("validateBody", () => {
  it("повертає parsed data для валідного payload-у", () => {
    const schema = z.object({ a: z.string(), b: z.number() });
    const res = mockRes();
    const result = validateBody(schema, { body: { a: "x", b: 1 } }, res);
    expect(result).toEqual({ ok: true, data: { a: "x", b: 1 } });
    expect(res.statusCode).toBe(200);
  });

  it("повертає 400 з деталями при помилці", () => {
    const schema = z.object({ a: z.string() });
    const res = mockRes();
    const result = validateBody(schema, { body: { a: 42 } }, res);
    expect(result.ok).toBe(false);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Некоректні дані запиту");
    expect(res.body.details).toHaveLength(1);
    expect(res.body.details[0].path).toBe("a");
  });

  it("обробляє відсутній body як {}", () => {
    const schema = z.object({ a: z.string().optional() });
    const res = mockRes();
    const result = validateBody(schema, {}, res);
    expect(result.ok).toBe(true);
  });
});

describe("validateQuery", () => {
  it("працює на req.query", () => {
    const schema = z.object({ q: z.string() });
    const res = mockRes();
    const ok = validateQuery(schema, { query: { q: "foo" } }, res);
    expect(ok).toEqual({ ok: true, data: { q: "foo" } });
  });
});

describe("ChatRequestSchema", () => {
  it("приймає порожній payload з дефолтами", () => {
    const r = ChatRequestSchema.safeParse({});
    expect(r.success).toBe(true);
    expect(r.data.context).toBe("");
    expect(r.data.messages).toEqual([]);
  });

  it("приймає валідний чат", () => {
    const r = ChatRequestSchema.safeParse({
      context: "ctx",
      messages: [
        { role: "user", content: "привіт" },
        { role: "assistant", content: "привіт!" },
      ],
      stream: true,
    });
    expect(r.success).toBe(true);
  });

  it("відкидає занадто довге повідомлення", () => {
    const r = ChatRequestSchema.safeParse({
      messages: [{ role: "user", content: "x".repeat(9000) }],
    });
    expect(r.success).toBe(false);
  });

  it("відкидає невідому role", () => {
    const r = ChatRequestSchema.safeParse({
      messages: [{ role: "system", content: "hi" }],
    });
    expect(r.success).toBe(false);
  });

  it("обмежує кількість повідомлень", () => {
    const many = Array.from({ length: 60 }, () => ({
      role: "user",
      content: "x",
    }));
    const r = ChatRequestSchema.safeParse({ messages: many });
    expect(r.success).toBe(false);
  });

  it("обмежує розмір context", () => {
    const r = ChatRequestSchema.safeParse({ context: "x".repeat(41_000) });
    expect(r.success).toBe(false);
  });
});

describe("AnalyzePhotoSchema", () => {
  it("вимагає image_base64", () => {
    expect(AnalyzePhotoSchema.safeParse({}).success).toBe(false);
  });

  it("відкидає занадто коротке зображення", () => {
    const r = AnalyzePhotoSchema.safeParse({ image_base64: "short" });
    expect(r.success).toBe(false);
  });

  it("відкидає завелике зображення", () => {
    const r = AnalyzePhotoSchema.safeParse({
      image_base64: "x".repeat(7_100_000),
    });
    expect(r.success).toBe(false);
  });

  it("приймає валідний payload", () => {
    const r = AnalyzePhotoSchema.safeParse({
      image_base64: "x".repeat(200),
      mime_type: "image/jpeg",
      locale: "uk-UA",
    });
    expect(r.success).toBe(true);
  });

  it("відкидає невалідний mime_type", () => {
    const r = AnalyzePhotoSchema.safeParse({
      image_base64: "x".repeat(200),
      mime_type: "text/html",
    });
    expect(r.success).toBe(false);
  });
});

describe("ParsePantrySchema", () => {
  it("trim-ить та вимагає непорожній text", () => {
    expect(ParsePantrySchema.safeParse({ text: "   " }).success).toBe(false);
  });

  it("обмежує довжину text-у", () => {
    const r = ParsePantrySchema.safeParse({ text: "x".repeat(10_100) });
    expect(r.success).toBe(false);
  });

  it("приймає валідний запит", () => {
    const r = ParsePantrySchema.safeParse({
      text: "молоко 1л, хліб",
      locale: "uk-UA",
    });
    expect(r.success).toBe(true);
    expect(r.data.text).toBe("молоко 1л, хліб");
  });
});

describe("RecommendRecipesSchema", () => {
  it("приймає порожній запит", () => {
    expect(RecommendRecipesSchema.safeParse({}).success).toBe(true);
  });

  it("обмежує розмір pantry", () => {
    const pantry = Array.from({ length: 300 }, () => ({ name: "x" }));
    const r = RecommendRecipesSchema.safeParse({ pantry });
    expect(r.success).toBe(false);
  });

  it("приймає валідний pantry", () => {
    const r = RecommendRecipesSchema.safeParse({
      pantry: [{ name: "яйце", qty: 5, unit: "шт" }],
      count: 3,
    });
    expect(r.success).toBe(true);
  });
});
