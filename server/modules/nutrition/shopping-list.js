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

const SYSTEM = `Ти помічник з планування покупок і харчування. Відповідай ТІЛЬКИ українською.
Поверни ТІЛЬКИ валідний JSON без markdown і без додаткового тексту.

Формат JSON:
{
  "categories": [
    {
      "name": string,
      "items": [
        { "name": string, "quantity": string, "note": string }
      ]
    }
  ]
}

Категорії (використовуй лише доречні):
"М'ясо та риба", "Молочні продукти", "Овочі та гриби", "Фрукти", "Крупи та злаки",
"Хлібобулочні вироби", "Яйця", "Олії та жири", "Приправи та соуси", "Напої", "Інше"

Правила класифікації:
- Гриби (печериці, шампіньйони, лисички, гливи тощо) → "Овочі та гриби"
- Молоко, сир, йогурт, вершки, масло, кефір → "Молочні продукти"
- М'ясо, птиця, риба, морепродукти → "М'ясо та риба"
- Яйця → "Яйця"

Правила:
- КОЖЕН продукт має з'явитися в списку ЛИШЕ ОДИН РАЗ — якщо той самий продукт є в кількох рецептах, об'єднай у один пункт і підсумуй кількість
- ВИКЛЮЧАЙ продукти, що вже є в коморі (pantry)
- quantity: вказуй кількість (напр. "500 г", "1 шт", "2 пачки")
- note: якщо потрібна порада або уточнення — додай стисло, інакше ""
- Якщо список покупок порожній (все є в коморі) — поверни порожній масив categories`;

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
    key: "nutrition:shopping-list",
    limit: 12,
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
    const { recipes, weekPlan, pantryItems, locale } = req.body || {};
    const loc = String(locale || "uk-UA");

    const pantryArr = Array.isArray(pantryItems) ? pantryItems : [];
    const pantryStr =
      pantryArr.length > 0
        ? pantryArr
            .map((x) =>
              typeof x === "string" ? x : x?.name ? String(x.name) : "",
            )
            .filter(Boolean)
            .join(", ")
        : "нічого";

    let ingredientsList = "";

    if (Array.isArray(recipes) && recipes.length > 0) {
      ingredientsList = recipes
        .map((r) => {
          const title = r?.title || "Рецепт";
          const ings = Array.isArray(r?.ingredients)
            ? r.ingredients.join(", ")
            : "";
          return `• ${title}: ${ings || "без деталей"}`;
        })
        .join("\n");
    } else if (weekPlan?.days?.length > 0) {
      ingredientsList = weekPlan.days
        .map((d) => {
          const day = d?.label || "День";
          const meals = Array.isArray(d?.meals) ? d.meals.join("; ") : "";
          return `• ${day}: ${meals}`;
        })
        .join("\n");
    }

    if (!ingredientsList) {
      return res
        .status(400)
        .json({ error: "Потрібно передати рецепти або тижневий план." });
    }

    const prompt = `Мова: ${loc}.

Що вже є в коморі (НЕ додавай до списку покупок):
${pantryStr}

Страви / рецепти з яких треба скласти список покупок:
${ingredientsList}

Склади список покупок, виключи все що вже є в коморі, згрупуй за категоріями.`;

    const payload = {
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      temperature: 0.15,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    };

    const { response, data } = await anthropicMessages(apiKey, payload, {
      timeoutMs: 25000,
      endpoint: "shopping-list",
    });
    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: data?.error?.message || "AI error" });
    }

    const out = extractAnthropicText(data);
    const parsed = extractJsonFromText(out);

    const obj =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};

    const seenNames = new Set();
    const normalize = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

    const categories = Array.isArray(obj.categories)
      ? obj.categories
          .map((cat) => {
            if (!cat || typeof cat !== "object") return null;
            const name = String(cat.name || "Інше").trim();
            const items = Array.isArray(cat.items)
              ? cat.items
                  .map((item) => {
                    if (!item || typeof item !== "object") return null;
                    const itemName = String(item.name || "").trim();
                    if (!itemName) return null;
                    const key = normalize(itemName);
                    if (seenNames.has(key)) return null;
                    seenNames.add(key);
                    return {
                      id: `si_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                      name: itemName,
                      quantity: String(item.quantity || "").trim(),
                      note: String(item.note || "").trim(),
                      checked: false,
                    };
                  })
                  .filter(Boolean)
              : [];
            if (items.length === 0) return null;
            return { name, items };
          })
          .filter(Boolean)
      : [];

    return res.status(200).json({
      categories,
      rawText: categories.length === 0 ? out || null : null,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Помилка AI сервера" });
  }
}
