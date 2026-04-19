import { recordExternalHttp } from "../lib/externalHttp.js";
import { barcodeLookupsTotal } from "../obs/metrics.js";

/**
 * Record-helper одночасно емітить і domain-specific метрику
 * `barcode_lookups_total{source,outcome}` (читають існуючі дашборди), і
 * уніфіковану `external_http_requests_total{upstream=source,outcome}`.
 * Свідоме дублювання — знести domain-метрику лише після оновлення дашбордів.
 */
function recordLookup(source, outcome, ms) {
  try {
    barcodeLookupsTotal.inc({ source, outcome });
  } catch {
    /* ignore */
  }
  recordExternalHttp(source, outcome, ms);
}

function elapsedMs(start) {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

// ──────────────────────────────────────────────────────────────────────────────
// Source 1: Open Food Facts (no key, 100 req/min, global crowdsourced DB)
// ──────────────────────────────────────────────────────────────────────────────
const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";
const OFF_FIELDS =
  "product_name,product_name_uk,brands,nutriments,serving_size,serving_quantity";

function normalizeOFF(product) {
  const n = product?.nutriments || {};
  const name = product?.product_name_uk || product?.product_name || null;
  const brand = product?.brands
    ? String(product.brands).split(",")[0].trim()
    : null;

  const round1 = (v) =>
    v != null && Number.isFinite(Number(v))
      ? Math.round(Number(v) * 10) / 10
      : null;

  const kcal = round1(n["energy-kcal_100g"] ?? n["energy-kcal"] ?? null);
  const protein = round1(n["proteins_100g"] ?? null);
  const fat = round1(n["fat_100g"] ?? null);
  const carbs = round1(n["carbohydrates_100g"] ?? null);

  const servingSize = product?.serving_size
    ? String(product.serving_size)
    : null;
  const servingGrams =
    product?.serving_quantity != null &&
    Number.isFinite(Number(product.serving_quantity))
      ? Number(product.serving_quantity)
      : null;

  if (!name) return null;
  // require at least one macro to avoid returning empty shells
  if (kcal == null && protein == null && fat == null && carbs == null)
    return null;

  return {
    name,
    brand,
    kcal_100g: kcal,
    protein_100g: protein,
    fat_100g: fat,
    carbs_100g: carbs,
    servingSize,
    servingGrams,
    source: "off",
  };
}

async function lookupOFF(barcode) {
  const url = `${OFF_BASE}/${barcode}.json?fields=${OFF_FIELDS}`;
  const start = process.hrtime.bigint();
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Sergeant-NutritionApp/1.0 (https://sergeant.2dmanager.com.ua)",
      },
      signal: AbortSignal.timeout(7000),
    });
    if (!r.ok) {
      recordLookup("off", "miss", elapsedMs(start));
      return null;
    }
    const data = await r.json();
    if (data?.status !== 1 || !data?.product) {
      recordLookup("off", "miss", elapsedMs(start));
      return null;
    }
    const product = normalizeOFF(data.product);
    recordLookup("off", product ? "hit" : "miss", elapsedMs(start));
    return product;
  } catch (e) {
    recordLookup(
      "off",
      e?.name === "TimeoutError" ? "timeout" : "error",
      elapsedMs(start),
    );
    throw e;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Source 2: USDA FoodData Central (Branded Foods with GTIN/UPC search)
// Free API key from https://api.data.gov/signup — set USDA_FDC_API_KEY env var.
// Falls back to DEMO_KEY (40 req/hr shared limit) if key is not set.
// ──────────────────────────────────────────────────────────────────────────────
const FDC_BASE = "https://api.nal.usda.gov/fdc/v1";

// Nutrient IDs in USDA FoodData Central
const FDC_NUTRIENT = {
  kcal: 1008,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
};

function normalizeUSDA(food) {
  if (!food) return null;
  const name = food.description || null;
  if (!name) return null;

  const brand = food.brandOwner || food.brandName || null;

  const nutrientMap = {};
  for (const n of food.foodNutrients || []) {
    const id = n.nutrientId ?? n.nutrient?.id;
    const value = n.value ?? n.amount;
    if (id != null && value != null && Number.isFinite(Number(value))) {
      nutrientMap[id] = Math.round(Number(value) * 10) / 10;
    }
  }

  const kcal = nutrientMap[FDC_NUTRIENT.kcal] ?? null;
  const protein = nutrientMap[FDC_NUTRIENT.protein] ?? null;
  const fat = nutrientMap[FDC_NUTRIENT.fat] ?? null;
  const carbs = nutrientMap[FDC_NUTRIENT.carbs] ?? null;

  // Serving size from USDA householdServingFullText + servingSize in grams
  const servingGrams =
    food.servingSize != null && Number.isFinite(Number(food.servingSize))
      ? Number(food.servingSize)
      : null;
  const servingUnit = food.servingSizeUnit || null;
  const servingSize =
    servingGrams && servingUnit ? `${servingGrams} ${servingUnit}` : null;

  if (kcal == null && protein == null && fat == null && carbs == null)
    return null;

  return {
    name,
    brand,
    kcal_100g: kcal,
    protein_100g: protein,
    fat_100g: fat,
    carbs_100g: carbs,
    servingSize,
    servingGrams,
    source: "usda",
  };
}

async function lookupUSDA(barcode) {
  const key = process.env.USDA_FDC_API_KEY || "DEMO_KEY";
  // Search Branded Foods by GTIN/UPC (barcode is stored in gtinUpc field)
  const url = `${FDC_BASE}/foods/search?query=${encodeURIComponent(barcode)}&dataType=Branded&pageSize=5&api_key=${key}`;
  const start = process.hrtime.bigint();
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Sergeant-NutritionApp/1.0" },
      signal: AbortSignal.timeout(7000),
    });
    if (!r.ok) {
      recordLookup("usda", "miss", elapsedMs(start));
      return null;
    }
    const data = await r.json();
    const foods = data?.foods;
    if (!Array.isArray(foods) || foods.length === 0) {
      recordLookup("usda", "miss", elapsedMs(start));
      return null;
    }

    // Prefer exact gtinUpc match, fallback to first result
    const exact = foods.find(
      (f) =>
        String(f.gtinUpc || "").replace(/^0+/, "") ===
        barcode.replace(/^0+/, ""),
    );
    const food = exact || foods[0];
    const product = normalizeUSDA(food);
    recordLookup("usda", product ? "hit" : "miss", elapsedMs(start));
    return product;
  } catch (e) {
    recordLookup(
      "usda",
      e?.name === "TimeoutError" ? "timeout" : "error",
      elapsedMs(start),
    );
    throw e;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Source 3: UPCitemdb (no key, 100 req/day, 694M+ barcodes)
// Returns product name/brand but rarely has nutrition data for food items.
// We mark partial: true so the frontend can prompt the user to fill in macros.
// ──────────────────────────────────────────────────────────────────────────────
async function lookupUPCitemdb(barcode) {
  const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`;
  const start = process.hrtime.bigint();
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Sergeant-NutritionApp/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) {
      recordLookup("upcitemdb", "miss", elapsedMs(start));
      return null;
    }
    const data = await r.json();
    const item = Array.isArray(data?.items) ? data.items[0] : null;
    if (!item) {
      recordLookup("upcitemdb", "miss", elapsedMs(start));
      return null;
    }

    const name = item.title || null;
    if (!name) {
      recordLookup("upcitemdb", "miss", elapsedMs(start));
      return null;
    }

    const brand = item.brand || null;

    recordLookup("upcitemdb", "hit", elapsedMs(start));
    return {
      name,
      brand,
      kcal_100g: null,
      protein_100g: null,
      fat_100g: null,
      carbs_100g: null,
      servingSize: null,
      servingGrams: null,
      source: "upcitemdb",
      partial: true, // no nutrition data — frontend should prompt user to fill in macros
    };
  } catch (e) {
    recordLookup(
      "upcitemdb",
      e?.name === "TimeoutError" ? "timeout" : "error",
      elapsedMs(start),
    );
    throw e;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/barcode?barcode=... — каскадний lookup через OFF → USDA → UPCitemdb.
 * Middleware-и роутера (`setModule`, `rateLimitExpress`) забезпечують
 * module-tag і rate-limit; тут лише бізнес-логіка.
 */
export default async function handler(req, res) {
  const barcode = String(req.query.barcode || "")
    .trim()
    .replace(/\D/g, "");
  if (!barcode || !/^\d{8,14}$/.test(barcode)) {
    return res.status(400).json({ error: "Невірний штрихкод (8–14 цифр)" });
  }

  try {
    // Cascade: OFF → USDA → UPCitemdb
    let product = null;

    try {
      product = await lookupOFF(barcode);
    } catch {
      /* continue to next source */
    }
    if (!product) {
      try {
        product = await lookupUSDA(barcode);
      } catch {
        /* continue to next source */
      }
    }
    if (!product) {
      try {
        product = await lookupUPCitemdb(barcode);
      } catch {
        /* continue to next source */
      }
    }

    if (!product) {
      return res.status(404).json({ error: "Продукт не знайдено" });
    }

    return res.status(200).json({ product });
  } catch (e) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") {
      return res
        .status(504)
        .json({ error: "Сервіс недоступний (таймаут). Спробуй пізніше." });
    }
    return res.status(500).json({ error: e?.message || "Server error" });
  }
}
