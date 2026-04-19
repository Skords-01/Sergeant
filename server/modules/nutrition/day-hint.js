import { extractJsonFromText } from "../../http/jsonSafe.js";
import {
  anthropicMessages,
  extractAnthropicText,
} from "../../lib/anthropic.js";
function safeNonNegOrNull(x) {
  if (x == null || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizeHint(text) {
  const t = String(text || "").trim();
  return t.slice(0, 1200);
}

/**
 * POST /api/nutrition/day-hint — коротка порада по денних макросах.
 * CORS / token / quota / rate-limit виставляє роутер.
 */
export default async function handler(req, res) {
  const apiKey = req.anthropicKey;

  try {
    const { macros, targets, locale, hasMeals, hasAnyMacros, macroSources } =
      req.body || {};
    const mRaw = macros && typeof macros === "object" ? macros : {};
    const m = {
      kcal: safeNonNegOrNull(mRaw.kcal),
      protein_g: safeNonNegOrNull(mRaw.protein_g),
      fat_g: safeNonNegOrNull(mRaw.fat_g),
      carbs_g: safeNonNegOrNull(mRaw.carbs_g),
    };
    const t = targets && typeof targets === "object" ? targets : {};
    const loc = String(locale || "uk-UA");

    const contextNote =
      hasMeals && !hasAnyMacros
        ? "У журналі є прийоми їжі, але без КБЖВ (макроси не задані). Дай пораду, як краще заповнювати/оцінювати КБЖВ, не звинувачуючи.\n"
        : "";

    const sourcesNote =
      macroSources && typeof macroSources === "object"
        ? `Походження КБЖВ (кількість прийомів): ${JSON.stringify(macroSources)}.\nЯкщо багато AI — обережно формулюй висновки, можеш порадити уточнити вагу/порцію.\n`
        : "";

    const prompt = `Мова: ${loc}.
${contextNote}${sourcesNote}Факт за день: ккал ${m.kcal ?? "—"}, білки ${m.protein_g ?? "—"} г, жири ${m.fat_g ?? "—"} г, вуглеводи ${m.carbs_g ?? "—"} г.
Цілі (якщо є): ккал ${t.dailyTargetKcal ?? "—"}, білки ${t.dailyTargetProtein_g ?? "—"}, жири ${t.dailyTargetFat_g ?? "—"}, вуглеводи ${t.dailyTargetCarbs_g ?? "—"}.

Дай 2–4 речення: коротко порівняй з цілями (якщо цілі задані), що добре / що звернути увагу завтра. Без моралізаторства. Відповідь ТІЛЬКИ JSON: {"hint":"..."}`;

    const payload = {
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    };

    const { response, data } = await anthropicMessages(apiKey, payload, {
      timeoutMs: 20000,
      endpoint: "day-hint",
    });
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: data?.error?.message || "AI error" });
    }

    const out = extractAnthropicText(data);
    let hint = "";
    try {
      const parsed = extractJsonFromText(out);
      hint = normalizeHint(parsed?.hint);
    } catch {
      try {
        hint = normalizeHint(out);
      } catch {
        hint = "";
      }
    }
    if (!hint) hint = "Не вдалося сформувати підказку.";
    return res.status(200).json({ hint });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Помилка AI сервера" });
  }
}
