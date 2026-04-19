import { extractJsonFromText } from "../../http/jsonSafe.js";
import { validateBody } from "../../http/validate.js";
import { WeekPlanSchema } from "../../http/schemas.js";
import { ExternalServiceError } from "../../obs/errors.js";
import {
  anthropicMessages,
  extractAnthropicText,
} from "../../lib/anthropic.js";
function normalizeWeekPlan(parsed) {
  const obj =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  const days = Array.isArray(obj.days) ? obj.days : [];
  const shoppingList = Array.isArray(obj.shoppingList) ? obj.shoppingList : [];
  return {
    days: days.slice(0, 7).map((d, i) => {
      if (!d || typeof d !== "object")
        return { label: `День ${i + 1}`, note: "", meals: [] };
      const label = String(d.label || `День ${i + 1}`).slice(0, 40);
      const note = String(d.note || "").slice(0, 500);
      const meals = Array.isArray(d.meals)
        ? d.meals
            .slice(0, 8)
            .map((x) => String(x || "").trim())
            .filter(Boolean)
        : [];
      return { label, note, meals };
    }),
    shoppingList: shoppingList
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, 50),
  };
}

const SYSTEM = `Ти шеф-кухар і планувальник харчування. Відповідай ТІЛЬКИ українською.
Поверни ТІЛЬКИ валідний JSON без markdown.

Формат:
{
  "days": [
    { "label": "Пн", "note": "коротко", "meals": ["сніданок — ...", "обід — ..."] }
  ],
  "shoppingList": ["продукт (кількість)", "..."]
}
Максимум 7 днів. Не вигадуй екзотичні інгредієнти поза списком — дозволено додати сіль, олію, базові спеції.`;

/**
 * POST /api/nutrition/week-plan — згенерувати план харчування на тиждень.
 * CORS / token / quota / rate-limit виставляє роутер.
 */
export default async function handler(req, res) {
  const apiKey = req.anthropicKey;

  const parsed = validateBody(WeekPlanSchema, req, res);
  if (!parsed.ok) return;
  const { pantry: pantryIn, preferences, locale } = parsed.data;
  const arr = Array.isArray(pantryIn) ? pantryIn : [];

  const prefs = preferences || {};
  const goal = String(prefs.goal || "balanced");
  const loc = String(locale || "uk-UA");

  const pantry = arr
    .map((x) => (typeof x === "string" ? x : x?.name ? String(x.name) : ""))
    .filter(Boolean)
    .slice(0, 50)
    .join("\n- ");

  const prompt = `Мова: ${loc}. Ціль: ${goal}.
Продукти вдома:
- ${pantry}

Запропонуй приблизний план харчування на 7 днів і список покупок того, чого бракує (коротко, реалістично).`;

  const payload = {
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    temperature: 0.25,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  };

  const { response, data } = await anthropicMessages(apiKey, payload, {
    timeoutMs: 35000,
    endpoint: "week-plan",
  });
  if (!response.ok) {
    throw new ExternalServiceError(data?.error?.message || "AI error", {
      status: response.status,
      code: "ANTHROPIC_ERROR",
    });
  }

  const out = extractAnthropicText(data);
  let plan = { days: [], shoppingList: [] };
  try {
    const jsonParsed = extractJsonFromText(out);
    plan = normalizeWeekPlan(jsonParsed);
  } catch {
    plan = { days: [], shoppingList: [] };
  }
  return res
    .status(200)
    .json({ plan, rawText: plan.days.length === 0 ? out : null });
}
