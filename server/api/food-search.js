import { setCorsHeaders } from "./lib/cors.js";
import { checkRateLimit } from "./lib/rateLimit.js";

const USDA_SEARCH = "https://api.nal.usda.gov/fdc/v1/foods/search";

const UK_TO_EN = {
  груша: "pear", яблуко: "apple", банан: "banana", апельсин: "orange",
  лимон: "lemon", ківі: "kiwi", манго: "mango", персик: "peach",
  слива: "plum", вишня: "cherry", черешня: "cherry", полуниця: "strawberry",
  суниця: "strawberry", малина: "raspberry", чорниця: "blueberry",
  виноград: "grapes", гарбуз: "pumpkin", кабачок: "zucchini",
  баклажан: "eggplant", помідор: "tomato", томат: "tomato",
  огірок: "cucumber", морква: "carrot", цибуля: "onion", часник: "garlic",
  картопля: "potato", броколі: "broccoli", шпинат: "spinach",
  капуста: "cabbage", буряк: "beet", гриби: "mushrooms",
  шампіньони: "mushrooms", авокадо: "avocado", курка: "chicken",
  яловичина: "beef", свинина: "pork", лосось: "salmon", тунець: "tuna",
  яйце: "egg", молоко: "milk", сир: "cheese", йогурт: "yogurt",
  масло: "butter", рис: "rice", гречка: "buckwheat", вівсянка: "oatmeal",
  макарони: "pasta", хліб: "bread", мед: "honey", горіх: "nuts",
  арахіс: "peanut", мигдаль: "almond", кава: "coffee", чай: "tea",
  сочевиця: "lentils", квасоля: "beans", нут: "chickpeas", тофу: "tofu",
  ананас: "pineapple", диня: "melon", кавун: "watermelon",
  абрикос: "apricot", мандарин: "tangerine", грейпфрут: "grapefruit",
  родзинки: "raisins", чорнослив: "prunes", горошок: "peas",
  кукурудза: "corn", спаржа: "asparagus", цвітна: "cauliflower",
  оселедець: "herring", скумбрія: "mackerel", тріска: "cod",
  форель: "trout", короп: "carp", кальмар: "squid", креветки: "shrimp",
  булгур: "bulgur", пшоно: "millet", перловка: "barley", кіноа: "quinoa",
  кускус: "couscous", манна: "semolina", сметана: "sour cream",
  вершки: "cream", кефір: "kefir", батат: "sweet potato",
  редиска: "radish", салат: "lettuce", руккола: "arugula",
  петрушка: "parsley", кріп: "dill", фісташки: "pistachios",
  кешью: "cashews", насіння: "seeds", кунжут: "sesame",
  шинка: "ham", бекон: "bacon", ковбаса: "sausage", фарш: "minced meat",
  котлета: "meat patty", пельмені: "dumplings", вареники: "varenyky",
  борщ: "borscht", морозиво: "ice cream", шоколад: "chocolate",
  протеїн: "protein", гейнер: "gainer", майонез: "mayonnaise",
  кетчуп: "ketchup", соєвий: "soy", олія: "oil", пшениця: "wheat",
  яловичий: "beef", курячий: "chicken", свинячий: "pork",
};

function translateFirstToken(query) {
  const token = query.trim().toLowerCase().split(/\s+/)[0];
  if (!token || token.length < 2) return null;
  if (UK_TO_EN[token]) return UK_TO_EN[token];
  if (token.length >= 3) {
    for (const [key, val] of Object.entries(UK_TO_EN)) {
      if (key.startsWith(token)) return val;
    }
  }
  return null;
}

function normalizeUSDAProduct(food, idx) {
  const name = food?.description;
  if (!name) return null;

  const round1 = (v) =>
    v != null && Number.isFinite(Number(v))
      ? Math.round(Number(v) * 10) / 10
      : null;

  const nutrients = Array.isArray(food?.foodNutrients) ? food.foodNutrients : [];
  const get = (id) => {
    const n = nutrients.find((x) => x.nutrientId === id);
    return n?.value != null ? Number(n.value) : null;
  };

  const kcal = round1(get(1008));
  const protein = round1(get(1003));
  const fat = round1(get(1004));
  const carbs = round1(get(1005));

  if (kcal == null && protein == null && fat == null && carbs == null) {
    return null;
  }

  return {
    id: `usda_${idx}_${Date.now()}`,
    name,
    brand: null,
    source: "usda",
    per100: {
      kcal: kcal ?? 0,
      protein_g: protein ?? 0,
      fat_g: fat ?? 0,
      carbs_g: carbs ?? 0,
    },
    defaultGrams: 100,
  };
}

async function fetchUSDA(query, signal) {
  const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
  const url = new URL(USDA_SEARCH);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("dataType", "Foundation,SR Legacy");
  url.searchParams.set("api_key", apiKey);

  const r = await fetch(url.toString(), { signal });
  if (!r.ok) return [];
  const data = await r.json();
  return data?.foods || [];
}

export default async function handler(req, res) {
  setCorsHeaders(res, req, {
    methods: "GET, OPTIONS",
    allowHeaders: "Content-Type",
  });
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const rl = checkRateLimit(req, {
    key: "api:food-search",
    limit: 40,
    windowMs: 60_000,
  });
  if (!rl.ok)
    return res.status(429).json({ error: "Забагато запитів. Спробуй пізніше." });

  const query = String(req.query.q || "").trim();
  if (!query || query.length < 2) {
    return res.status(400).json({ error: "Запит занадто короткий" });
  }

  const signal = AbortSignal.timeout(8000);

  try {
    const enTerm = translateFirstToken(query);
    if (!enTerm) {
      return res.status(200).json({ products: [] });
    }

    const usdaRaw = await fetchUSDA(enTerm, signal).catch(() => []);
    const enTokens = enTerm.toLowerCase().split(/\s+/);

    const seen = new Set();
    const products = usdaRaw
      .map((p, i) => normalizeUSDAProduct(p, i))
      .filter(Boolean)
      .filter((p) => {
        const key = (p.name || "").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return enTokens.some((t) => key.includes(t));
      })
      .slice(0, 8);

    return res.status(200).json({ products });
  } catch (e) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      return res
        .status(504)
        .json({ error: "Сервіс недоступний (таймаут). Спробуй пізніше." });
    }
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
