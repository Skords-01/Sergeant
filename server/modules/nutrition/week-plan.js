import { assertAiQuota } from "../../aiQuota.js";
import { setCorsHeaders } from "../../http/cors.js";
import { setRequestModule } from "../../obs/requestContext.js";
import { extractJsonFromText } from "../../http/jsonSafe.js";
import {
  anthropicMessages,
  extractAnthropicText,
} from "../../lib/anthropic.js";
import {
  checkRateLimit,
  requireNutritionTokenIfConfigured,
} from "./lib/nutritionSecurity.js";

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

export default async function handler(req, res) {
  setRequestModule("nutrition");
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
    key: "nutrition:week-plan",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.ok)
    return res
      .status(429)
      .json({ error: "Забагато запитів. Спробуй пізніше." });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set" });

  try {
    const { items, preferences, locale } = req.body || {};
    const arr = Array.isArray(items) ? items : [];
    if (arr.length === 0)
      return res.status(400).json({ error: "items is required" });

    const prefs =
      preferences && typeof preferences === "object" ? preferences : {};
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
      return res
        .status(response.status)
        .json({ error: data?.error?.message || "AI error" });
    }

    const out = extractAnthropicText(data);
    let plan = { days: [], shoppingList: [] };
    try {
      const parsed = extractJsonFromText(out);
      plan = normalizeWeekPlan(parsed);
    } catch {
      plan = { days: [], shoppingList: [] };
    }
    return res
      .status(200)
      .json({ plan, rawText: plan.days.length === 0 ? out : null });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Помилка AI сервера" });
  }
}
