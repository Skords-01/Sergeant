import { assertAiQuota } from "../../aiQuota.js";
import { setCorsHeaders } from "../lib/cors.js";
import { extractJsonFromText } from "../lib/jsonSafe.js";
import { validateBody } from "../lib/validate.js";
import { AnalyzePhotoSchema } from "../lib/schemas.js";
import {
  anthropicMessages,
  extractAnthropicText,
} from "./lib/anthropicFetch.js";
import { normalizePhotoResult } from "./lib/nutritionResponse.js";
import {
  checkRateLimit,
  requireNutritionTokenIfConfigured,
} from "./lib/nutritionSecurity.js";

const SYSTEM = `Ти нутріціолог-помічник. Відповідай ТІЛЬКИ українською.
Поверни ТІЛЬКИ валідний JSON без markdown і без додаткового тексту.

Задача: з фото їжі оцінити страву, інгредієнти, приблизну порцію, та приблизні КБЖВ (ккал, білки/жири/вуглеводи у грамах).
Якщо впевненість низька або порція невідома — додай 1–3 короткі уточнюючі питання.

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
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  if (!requireNutritionTokenIfConfigured(req, res)) return;
  if (!(await assertAiQuota(req, res))) return;
  const rl = checkRateLimit(req, {
    key: "nutrition:analyze-photo",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.ok)
    return res
      .status(429)
      .json({ error: "Забагато запитів. Спробуй пізніше." });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set" });

  const parsed = validateBody(AnalyzePhotoSchema, req, res);
  if (!parsed.ok) return;

  try {
    const { image_base64, mime_type, locale } = parsed.data;
    const b64 = image_base64.trim();
    const mediaType = mime_type || "image/jpeg";

    const userText = `Мова: ${locale || "uk-UA"}.
Опиши, що на фото і порахуй приблизне КБЖВ. Якщо треба — задай уточнення.`;

    const payload = {
      model: "claude-sonnet-4-6",
      max_tokens: 700,
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

    const { response, data } = await anthropicMessages(apiKey, payload, {
      timeoutMs: 20000,
    });
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: data?.error?.message || "AI error" });
    }

    const text = extractAnthropicText(data);

    const parsed = extractJsonFromText(text);
    const result = normalizePhotoResult(parsed);

    return res.status(200).json({ result, rawText: text || null });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Помилка AI сервера" });
  }
}
