import { extractJsonFromText } from "../../http/jsonSafe.js";
import { validateBody } from "../../http/validate.js";
import { AnalyzePhotoSchema } from "../../http/schemas.js";
import {
  anthropicMessages,
  extractAnthropicText,
} from "../../lib/anthropic.js";
import { normalizePhotoResult } from "../../lib/nutritionResponse.js";
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

/**
 * POST /api/nutrition/analyze-photo — розпізнати страву з фото і повернути
 * оцінені КБЖВ. CORS / token / quota / rate-limit виставляє роутер.
 */
export default async function handler(req, res) {
  const apiKey = req.anthropicKey;

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
      endpoint: "analyze-photo",
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
