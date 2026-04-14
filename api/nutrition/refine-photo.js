import { setCorsHeaders } from "../lib/cors.js";
import { extractJsonFromText } from "../lib/jsonSafe.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM = `Ти нутріціолог-помічник. Відповідай ТІЛЬКИ українською.
Поверни ТІЛЬКИ валідний JSON без markdown і без додаткового тексту.

Задача: користувач дав уточнення (вага порції у грамах та/або відповіді на питання).
Перерахуй приблизні КБЖВ, уточни порцію та інгредієнти. Якщо все ще бракує даних — залиш 1–2 питання.

Формат JSON:
{
  "dishName": string,
  "confidence": number, // 0..1
  "portion": { "label": string, "gramsApprox": number|null }|null,
  "ingredients": [{ "name": string, "notes": string|null }],
  "macros": { "kcal": number|null, "protein_g": number|null, "fat_g": number|null, "carbs_g": number|null },
  "questions": string[]
}
`;

export default async function handler(req, res) {
  setCorsHeaders(res, req, { allowHeaders: "Content-Type", methods: "POST, OPTIONS" });

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set" });

  try {
    const {
      image_base64,
      mime_type,
      prior_result,
      portion_grams,
      qna,
      locale,
    } = req.body || {};

    const b64 = typeof image_base64 === "string" ? image_base64.trim() : "";
    const mediaType =
      typeof mime_type === "string" && mime_type ? mime_type : "image/jpeg";
    if (!b64) return res.status(400).json({ error: "image_base64 is required" });
    if (b64.length > 7_000_000)
      return res.status(413).json({ error: "Image too large (base64 payload)" });

    const grams =
      typeof portion_grams === "number" && Number.isFinite(portion_grams) && portion_grams > 0
        ? portion_grams
        : null;
    const qa = Array.isArray(qna) ? qna.slice(0, 8) : [];

    const userText = `Мова: ${locale || "uk-UA"}.
Ось попередній результат (може бути приблизний): ${safeJson(prior_result)}

Уточнення користувача:
- Порція (г): ${grams != null ? grams : "—"}
- Q&A: ${safeJson(qa)}

Перерахуй і поверни JSON.`;

    const payload = {
      model: "claude-sonnet-4-6",
      max_tokens: 650,
      temperature: 0.2,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: b64 },
            },
            { type: "text", text: userText },
          ],
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

    const text = (data?.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const parsed = extractJsonFromText(text);
    const result =
      parsed && typeof parsed === "object"
        ? parsed
        : {
            dishName: "Результат",
            confidence: 0,
            portion: grams != null ? { label: `${grams} г`, gramsApprox: grams } : null,
            ingredients: [],
            macros: { kcal: null, protein_g: null, fat_g: null, carbs_g: null },
            questions: ["Не вдалося витягнути JSON. Спробуй ще раз."],
          };

    return res.status(200).json({ result });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Помилка AI сервера" });
  }
}

function safeJson(v) {
  try {
    return JSON.stringify(v ?? null);
  } catch {
    return "null";
  }
}

