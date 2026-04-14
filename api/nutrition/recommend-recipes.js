import { setCorsHeaders } from "../lib/cors.js";
import { extractJsonFromText } from "../lib/jsonSafe.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM = `Ти шеф-кухар і нутріціолог. Відповідай ТІЛЬКИ українською.
Поверни ТІЛЬКИ валідний JSON без markdown і без додаткового тексту.

Задача: запропонувати 3–6 реалістичних рецептів з наявних продуктів.
Не вигадуй інгредієнти. Дозволено додати лише базові "припущення" (сіль, перець, вода, олія) і тоді явно познач їх у tips.
Дай короткі поради по приготуванню і безпеці (температура/час) без зайвої води.

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

export default async function handler(req, res) {
  setCorsHeaders(res, req, { allowHeaders: "Content-Type", methods: "POST, OPTIONS" });

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set" });

  try {
    const { items, preferences } = req.body || {};
    const arr = Array.isArray(items) ? items : [];
    if (arr.length === 0) return res.status(400).json({ error: "items is required" });
    if (arr.length > 60) return res.status(413).json({ error: "Too many items" });

    const prefs = preferences && typeof preferences === "object" ? preferences : {};
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

Поверни 5 рецептів.`;

    const payload = {
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      temperature: 0.2,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
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

    const out = (data?.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const parsed = extractJsonFromText(out);
    const recipes = Array.isArray(parsed?.recipes) ? parsed.recipes : [];
    return res.status(200).json({ recipes });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Помилка AI сервера" });
  }
}

