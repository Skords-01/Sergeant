import { extractJsonFromText } from "../../http/jsonSafe.js";
import {
  anthropicMessages,
  extractAnthropicText,
} from "../../lib/anthropic.js";
import { normalizeRecipes } from "../../lib/nutritionResponse.js";
const SYSTEM = `Ти шеф-кухар і нутріціолог. Відповідай ТІЛЬКИ українською.
Поверни ТІЛЬКИ валідний JSON без markdown і без додаткового тексту.

Задача: запропонувати 2–4 реалістичних рецептів з наявних продуктів.
Не вигадуй інгредієнти. Дозволено додати лише базові "припущення" (сіль, перець, вода, олія) і тоді явно познач їх у tips.
Дай короткі поради по приготуванню і безпеці (температура/час) без зайвої води.
ВАЖЛИВО: відповідь має бути КОРОТКА і НЕ Обрізана. Якщо не вміщається — поверни МЕНШЕ рецептів і/або коротші steps/tips.

Формат JSON:
{
  "recipes": [
    {
      "title": string,
      "timeMinutes": number|null,
      "servings": number|null,
      "ingredients": string[],
      "steps": string[],
      "tips": string[],
      "macros": { "kcal": number|null, "protein_g": number|null, "fat_g": number|null, "carbs_g": number|null }
    }
  ]
}
`;

/**
 * POST /api/nutrition/recommend-recipes — рецепти з наявних продуктів.
 * CORS / token / quota / rate-limit виставляє роутер.
 */
export default async function handler(req, res) {
  const apiKey = req.anthropicKey;

  try {
    const { items, preferences } = req.body || {};
    const arr = Array.isArray(items) ? items : [];
    if (arr.length === 0)
      return res.status(400).json({ error: "items is required" });
    if (arr.length > 60)
      return res.status(413).json({ error: "Too many items" });

    const prefs =
      preferences && typeof preferences === "object" ? preferences : {};
    const goal = String(prefs.goal || "balanced");
    const servings = Number(prefs.servings || 1);
    const timeMinutes = Number(prefs.timeMinutes || 25);
    const exclude = String(prefs.exclude || "");
    const locale = String(prefs.locale || "uk-UA");

    const pantry = arr
      .map((x) => {
        if (typeof x === "string") return x;
        const name = x?.name ? String(x.name) : "";
        const qty = x?.qty != null && x.qty !== "" ? String(x.qty) : "";
        const unit = x?.unit ? String(x.unit) : "";
        const notes = x?.notes ? String(x.notes) : "";
        return [name, qty && unit ? `${qty} ${unit}` : qty || unit, notes]
          .filter(Boolean)
          .join(" — ");
      })
      .filter(Boolean)
      .slice(0, 60)
      .join("\n- ");

    const prompt = `Мова: ${locale}.
Ціль: ${goal}.
Порції: ${Number.isFinite(servings) && servings > 0 ? servings : 1}.
Час: ${Number.isFinite(timeMinutes) && timeMinutes > 0 ? timeMinutes : 25} хв.
Не використовувати/алергени: ${exclude || "—"}.

Наявні продукти:
- ${pantry}

Поверни 3 рецепти.
Обмеження формату:
- steps: максимум 7 кроків
- tips: максимум 4 поради
- ingredients: тільки ключові позиції
Якщо продуктів мало — все одно поверни 2 прості рецепти.`;

    const payload = {
      model: "claude-sonnet-4-6",
      max_tokens: 2800,
      temperature: 0.2,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    };

    const { response, data } = await anthropicMessages(apiKey, payload, {
      timeoutMs: 45000,
      endpoint: "recommend-recipes",
    });
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: data?.error?.message || "AI error" });
    }

    const out = extractAnthropicText(data);

    const parsed = extractJsonFromText(out);
    const recipes = normalizeRecipes(parsed);
    return res.status(200).json({
      recipes,
      rawText: recipes.length === 0 ? out || null : null,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Помилка AI сервера" });
  }
}
