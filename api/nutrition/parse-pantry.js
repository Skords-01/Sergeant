import { setCorsHeaders } from "../lib/cors.js";
import { extractJsonFromText } from "../lib/jsonSafe.js";
import { anthropicMessages, extractAnthropicText } from "./lib/anthropicFetch.js";
import { normalizePantryItems } from "./lib/nutritionResponse.js";
import {
  checkRateLimit,
  requireNutritionTokenIfConfigured,
} from "./lib/nutritionSecurity.js";

const SYSTEM = `Ти помічник з харчування. Відповідай ТІЛЬКИ українською.
Поверни ТІЛЬКИ валідний JSON без markdown і без додаткового тексту.

Задача: перетвори сирий список продуктів (може бути надиктований, з помилками) у структурований масив.
Нормалізуй назви (однина), витягни кількість і одиниці якщо вказані.

Формат JSON:
{
  "items": [
    { "name": string, "qty": number|null, "unit": string|null, "notes": string|null }
  ]
}
`;

export default async function handler(req, res) {
  setCorsHeaders(res, req, {
    allowHeaders: "X-Token, Content-Type",
    methods: "POST, OPTIONS",
  });

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!requireNutritionTokenIfConfigured(req, res)) return;
  const rl = checkRateLimit(req, { key: "nutrition:parse-pantry", limit: 60, windowMs: 60_000 });
  if (!rl.ok) return res.status(429).json({ error: "Забагато запитів. Спробуй пізніше." });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set" });

  try {
    const { text, locale } = req.body || {};
    const raw = typeof text === "string" ? text.trim() : "";
    if (!raw) return res.status(400).json({ error: "text is required" });
    if (raw.length > 10_000) return res.status(413).json({ error: "Text too large" });

    const payload = {
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      temperature: 0.2,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Мова: ${locale || "uk-UA"}.\nОсь список продуктів:\n${raw}`,
        },
      ],
    };

    const { response, data } = await anthropicMessages(apiKey, payload, { timeoutMs: 20000 });
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: data?.error?.message || "AI error" });
    }

    const out = extractAnthropicText(data);

    const parsed = extractJsonFromText(out);
    const items = normalizePantryItems(parsed);
    return res.status(200).json({ items, rawText: out || null });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Помилка AI сервера" });
  }
}

