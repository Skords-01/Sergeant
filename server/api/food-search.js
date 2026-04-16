import { setCorsHeaders } from "./lib/cors.js";
import { checkRateLimit } from "./lib/rateLimit.js";

const OFF_SEARCH = "https://world.openfoodfacts.org/api/v2/search";
const OFF_FIELDS =
  "product_name,product_name_uk,brands,nutriments,serving_quantity";

function normalizeProduct(product, idx) {
  const n = product?.nutriments || {};

  const round1 = (v) =>
    v != null && Number.isFinite(Number(v))
      ? Math.round(Number(v) * 10) / 10
      : null;

  const name =
    product?.product_name_uk ||
    product?.product_name ||
    null;
  if (!name) return null;

  const brand = product?.brands
    ? String(product.brands).split(",")[0].trim()
    : null;

  const kcal = round1(n["energy-kcal_100g"] ?? n["energy-kcal"] ?? null);
  const protein = round1(n["proteins_100g"] ?? null);
  const fat = round1(n["fat_100g"] ?? null);
  const carbs = round1(n["carbohydrates_100g"] ?? null);

  if (kcal == null && protein == null && fat == null && carbs == null) {
    return null;
  }

  return {
    id: `off_${idx}_${Date.now()}`,
    name,
    brand,
    source: "off",
    per100: {
      kcal: kcal ?? 0,
      protein_g: protein ?? 0,
      fat_g: fat ?? 0,
      carbs_g: carbs ?? 0,
    },
    defaultGrams: product?.serving_quantity
      ? Math.round(Number(product.serving_quantity))
      : 100,
  };
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

  try {
    const url = new URL(OFF_SEARCH);
    url.searchParams.set("search_terms", query);
    url.searchParams.set("page_size", "10");
    url.searchParams.set("fields", OFF_FIELDS);
    url.searchParams.set("sort_by", "unique_scans_n");

    const r = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Sergeant-NutritionApp/1.0 (https://sergeant.2dmanager.com.ua)",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!r.ok) {
      return res
        .status(502)
        .json({ error: "Помилка зовнішнього сервісу (Open Food Facts)" });
    }

    const data = await r.json();
    const products = (data?.products || [])
      .map((p, i) => normalizeProduct(p, i))
      .filter(Boolean)
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
