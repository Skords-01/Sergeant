import { extractJsonFromText } from "../../http/jsonSafe.js";
import {
  anthropicMessages,
  extractAnthropicText,
} from "../../lib/anthropic.js";
const SYSTEM = `Ти нутріціолог і шеф-кухар. Відповідай ТІЛЬКИ українською.
Поверни ТІЛЬКИ валідний JSON без markdown і без додаткового тексту.

Формат JSON:
{
  "meals": [
    {
      "type": "breakfast"|"lunch"|"dinner"|"snack",
      "label": string,
      "name": string,
      "description": string,
      "ingredients": string[],
      "kcal": number|null,
      "protein_g": number|null,
      "fat_g": number|null,
      "carbs_g": number|null
    }
  ],
  "totalKcal": number|null,
  "totalProtein_g": number|null,
  "totalFat_g": number|null,
  "totalCarbs_g": number|null,
  "note": string
}

Правила:
- Сніданок (breakfast), обід (lunch), вечеря (dinner), і 1-2 перекуси (snack)
- Намагайся використовувати продукти з наявного списку (pantry)
- Загальні макроси мають максимально відповідати цільовим значенням
- description — 1-2 рядки опису страви
- ingredients — список ключових інгредієнтів з кількостями
- Якщо цільові макроси не задані — пропонуй збалансоване харчування ~2000 ккал`;

function normalizeDayPlan(parsed) {
  const obj =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  const meals = Array.isArray(obj.meals) ? obj.meals : [];
  const validTypes = ["breakfast", "lunch", "dinner", "snack"];
  return {
    meals: meals
      .map((m) => {
        if (!m || typeof m !== "object") return null;
        const type = validTypes.includes(m.type) ? m.type : "snack";
        const typeLabels = {
          breakfast: "Сніданок",
          lunch: "Обід",
          dinner: "Вечеря",
          snack: "Перекус",
        };
        return {
          type,
          label: String(m.label || typeLabels[type]),
          name: String(m.name || "").trim(),
          description: String(m.description || "").trim(),
          ingredients: Array.isArray(m.ingredients)
            ? m.ingredients.map((x) => String(x).trim()).filter(Boolean)
            : [],
          kcal:
            m.kcal != null && Number.isFinite(Number(m.kcal))
              ? Number(m.kcal)
              : null,
          protein_g:
            m.protein_g != null && Number.isFinite(Number(m.protein_g))
              ? Number(m.protein_g)
              : null,
          fat_g:
            m.fat_g != null && Number.isFinite(Number(m.fat_g))
              ? Number(m.fat_g)
              : null,
          carbs_g:
            m.carbs_g != null && Number.isFinite(Number(m.carbs_g))
              ? Number(m.carbs_g)
              : null,
        };
      })
      .filter(Boolean)
      .slice(0, 6),
    totalKcal:
      obj.totalKcal != null && Number.isFinite(Number(obj.totalKcal))
        ? Number(obj.totalKcal)
        : null,
    totalProtein_g:
      obj.totalProtein_g != null && Number.isFinite(Number(obj.totalProtein_g))
        ? Number(obj.totalProtein_g)
        : null,
    totalFat_g:
      obj.totalFat_g != null && Number.isFinite(Number(obj.totalFat_g))
        ? Number(obj.totalFat_g)
        : null,
    totalCarbs_g:
      obj.totalCarbs_g != null && Number.isFinite(Number(obj.totalCarbs_g))
        ? Number(obj.totalCarbs_g)
        : null,
    note: String(obj.note || "").trim(),
  };
}

/**
 * POST /api/nutrition/day-plan — згенерувати план харчування на день.
 * CORS / token / quota / rate-limit виставляє роутер.
 */
export default async function handler(req, res) {
  const apiKey = req.anthropicKey;

  try {
    const { items, targets, regenerateMealType, locale } = req.body || {};
    const arr = Array.isArray(items) ? items : [];
    const loc = String(locale || "uk-UA");

    const tgt = targets && typeof targets === "object" ? targets : {};
    const kcal = tgt.kcal != null ? Number(tgt.kcal) : null;
    const protein = tgt.protein_g != null ? Number(tgt.protein_g) : null;
    const fat = tgt.fat_g != null ? Number(tgt.fat_g) : null;
    const carbs = tgt.carbs_g != null ? Number(tgt.carbs_g) : null;

    const pantryStr =
      arr.length > 0
        ? arr
            .map((x) => {
              if (typeof x === "string") return x;
              const name = x?.name ? String(x.name) : "";
              const qty = x?.qty != null ? String(x.qty) : "";
              const unit = x?.unit ? String(x.unit) : "";
              return [name, qty && unit ? `${qty} ${unit}` : qty || unit]
                .filter(Boolean)
                .join(" — ");
            })
            .filter(Boolean)
            .slice(0, 50)
            .join("\n- ")
        : "продукти не вказані";

    const targetsStr =
      kcal != null
        ? `Ціль ккал: ${kcal}. Білки: ${protein ?? "не задано"} г. Жири: ${fat ?? "не задано"} г. Вуглеводи: ${carbs ?? "не задано"} г.`
        : "Цілі не задані — запропонуй збалансоване харчування.";

    const regenStr = regenerateMealType
      ? `Потрібно перегенерувати ТІЛЬКИ прийом їжі типу: "${regenerateMealType}". Решту не включай.`
      : "Згенеруй повний план на день: сніданок, обід, вечеря, 1-2 перекуси.";

    const prompt = `Мова: ${loc}.
${targetsStr}

Наявні продукти (намагайся використовувати їх):
- ${pantryStr}

${regenStr}`;

    const payload = {
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      temperature: 0.3,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    };

    const { response, data } = await anthropicMessages(apiKey, payload, {
      timeoutMs: 30000,
      endpoint: "day-plan",
    });
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: data?.error?.message || "AI error" });
    }

    const out = extractAnthropicText(data);
    const parsed = extractJsonFromText(out);
    const plan = normalizeDayPlan(parsed);

    return res.status(200).json({
      plan,
      rawText: plan.meals.length === 0 ? out || null : null,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Помилка AI сервера" });
  }
}
