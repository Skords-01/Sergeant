import { setCorsHeaders } from "../lib/cors.js";
import { extractJsonFromText } from "../lib/jsonSafe.js";
import { anthropicMessages, extractAnthropicText } from "./lib/anthropicFetch.js";
import { normalizePhotoResult } from "./lib/nutritionResponse.js";
import {
  checkRateLimit,
  requireNutritionTokenIfConfigured,
} from "./lib/nutritionSecurity.js";

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
  setCorsHeaders(res, req, {
    allowHeaders: "X-Token, Content-Type",
    methods: "POST, OPTIONS",
  });

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!requireNutritionTokenIfConfigured(req, res)) return;
  const rl = checkRateLimit(req, { key: "nutrition:refine-photo", limit: 20, windowMs: 60_000 });
  if (!rl.ok) return res.status(429).json({ error: "Забагато запитів. Спробуй пізніше." });

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

    const { response, data } = await anthropicMessages(apiKey, payload, { timeoutMs: 20000 });
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: data?.error?.message || "AI error" });
    }

    const text = extractAnthropicText(data);

    const parsed = extractJsonFromText(text);
    const result = normalizePhotoResult(parsed, { fallbackGrams: grams });

    return res.status(200).json({ result, rawText: text || null });
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

