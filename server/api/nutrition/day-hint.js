import { setCorsHeaders } from "../lib/cors.js";
import { extractJsonFromText } from "../lib/jsonSafe.js";
import { anthropicMessages, extractAnthropicText } from "./lib/anthropicFetch.js";
import {
  checkRateLimit,
  requireNutritionTokenIfConfigured,
} from "./lib/nutritionSecurity.js";

function normalizeHint(text) {
  const t = String(text || "").trim();
  return t.slice(0, 1200);
}

export default async function handler(req, res) {
  setCorsHeaders(res, req, {
    allowHeaders: "X-Token, Content-Type",
    methods: "POST, OPTIONS",
  });

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!requireNutritionTokenIfConfigured(req, res)) return;
  const rl = checkRateLimit(req, { key: "nutrition:day-hint", limit: 30, windowMs: 60_000 });
  if (!rl.ok) return res.status(429).json({ error: "Забагато запитів. Спробуй пізніше." });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set" });

  try {
    const { macros, targets, locale } = req.body || {};
    const m = macros && typeof macros === "object" ? macros : {};
    const t = targets && typeof targets === "object" ? targets : {};
    const loc = String(locale || "uk-UA");

    const prompt = `Мова: ${loc}.
Факт за день: ккал ${m.kcal ?? "—"}, білки ${m.protein_g ?? "—"} г, жири ${m.fat_g ?? "—"} г, вуглеводи ${m.carbs_g ?? "—"} г.
Цілі (якщо є): ккал ${t.dailyTargetKcal ?? "—"}, білки ${t.dailyTargetProtein_g ?? "—"}, жири ${t.dailyTargetFat_g ?? "—"}, вуглеводи ${t.dailyTargetCarbs_g ?? "—"}.

Дай 2–4 речення: коротко порівняй з цілями (якщо цілі задані), що добре / що звернути увагу завтра. Без моралізаторства. Відповідь ТІЛЬКИ JSON: {"hint":"..."}`;

    const payload = {
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    };

    const { response, data } = await anthropicMessages(apiKey, payload, { timeoutMs: 20000 });
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "AI error" });
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
