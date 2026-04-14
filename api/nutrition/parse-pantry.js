import { setCorsHeaders } from "../lib/cors.js";
import { extractJsonFromText } from "../lib/jsonSafe.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

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
  setCorsHeaders(res, req, { allowHeaders: "Content-Type", methods: "POST, OPTIONS" });

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

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

    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: data?.error?.message || "AI error" });
    }

    const out = (data?.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const parsed = extractJsonFromText(out);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return res.status(200).json({ items });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Помилка AI сервера" });
  }
}

