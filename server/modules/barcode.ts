import type { Request, Response } from "express";
import { recordExternalHttp } from "../lib/externalHttp.js";
import { BarcodeQuerySchema } from "../http/schemas.js";
import { validateQuery } from "../http/validate.js";
import { barcodeLookupsTotal } from "../obs/metrics.js";

interface NormalizedProduct {
  name: string;
  brand: string | null;
  kcal_100g: number | null;
  protein_100g: number | null;
  fat_100g: number | null;
  carbs_100g: number | null;
  servingSize: string | null;
  servingGrams: number | null;
  source: "off" | "usda" | "upcitemdb";
  partial?: boolean;
}

interface OFFProduct {
  product_name?: string;
  product_name_uk?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
  serving_size?: string;
  serving_quantity?: number | string;
}

interface USDAFoodNutrient {
  nutrientId?: number;
  nutrient?: { id?: number };
  value?: number;
  amount?: number;
}

interface USDAFood {
  description?: string;
  brandOwner?: string;
  brandName?: string;
  foodNutrients?: USDAFoodNutrient[];
  servingSize?: number;
  servingSizeUnit?: string;
  gtinUpc?: string;
}

function hasErrorName(e: unknown, name: string): boolean {
  return !!e && typeof e === "object" && (e as { name?: string }).name === name;
}

/**
 * Record-helper одночасно емітить і domain-specific метрику
 * `barcode_lookups_total{source,outcome}` (читають існуючі дашборди), і
 * уніфіковану `external_http_requests_total{upstream=source,outcome}`.
 * Свідоме дублювання — знести domain-метрику лише після оновлення дашбордів.
 */
function recordLookup(source: string, outcome: string, ms: number): void {
  try {
    barcodeLookupsTotal.inc({ source, outcome });
  } catch {
    /* ignore */
  }
  recordExternalHttp(source, outcome, ms);
}

function elapsedMs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

// ──────────────────────────────────────────────────────────────────────────────
// Source 1: Open Food Facts (no key, 100 req/min, global crowdsourced DB)
// ──────────────────────────────────────────────────────────────────────────────
const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";
const OFF_FIELDS =
  "product_name,product_name_uk,brands,nutriments,serving_size,serving_quantity";

function normalizeOFF(
  product: OFFProduct | null | undefined,
): NormalizedProduct | null {
  const n = (product?.nutriments || {}) as Record<string, unknown>;
  const name = product?.product_name_uk || product?.product_name || null;
  const brand = product?.brands
    ? String(product.brands).split(",")[0].trim()
    : null;

  const round1 = (v: unknown): number | null =>
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

async function lookupOFF(barcode: string): Promise<NormalizedProduct | null> {
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
    const data = (await r.json()) as { status?: number; product?: OFFProduct };
    if (data?.status !== 1 || !data?.product) {
      recordLookup("off", "miss", elapsedMs(start));
      return null;
    }
    const product = normalizeOFF(data.product);
    recordLookup("off", product ? "hit" : "miss", elapsedMs(start));
    return product;
  } catch (e: unknown) {
    recordLookup(
      "off",
      hasErrorName(e, "TimeoutError") ? "timeout" : "error",
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
} as const;

function normalizeUSDA(
  food: USDAFood | null | undefined,
): NormalizedProduct | null {
  if (!food) return null;
  const name = food.description || null;
  if (!name) return null;

  const brand = food.brandOwner || food.brandName || null;

  const nutrientMap: Record<number, number> = {};
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

async function lookupUSDA(barcode: string): Promise<NormalizedProduct | null> {
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
    const data = (await r.json()) as { foods?: USDAFood[] };
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
  } catch (e: unknown) {
    recordLookup(
      "usda",
      hasErrorName(e, "TimeoutError") ? "timeout" : "error",
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
async function lookupUPCitemdb(
  barcode: string,
): Promise<NormalizedProduct | null> {
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
    const data = (await r.json()) as {
      items?: Array<{ title?: string; brand?: string }>;
    };
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
  } catch (e: unknown) {
    recordLookup(
      "upcitemdb",
      hasErrorName(e, "TimeoutError") ? "timeout" : "error",
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
export default async function handler(
  req: Request,
  res: Response,
): Promise<void> {
  const parsed = validateQuery(BarcodeQuerySchema, req, res);
  if (!parsed.ok) return;
  const barcode = parsed.data.barcode.replace(/\D/g, "");
  if (!/^\d{8,14}$/.test(barcode)) {
    res.status(400).json({ error: "Невірний штрихкод (8–14 цифр)" });
    return;
  }

  try {
    // Cascade: OFF → USDA → UPCitemdb
    let product: NormalizedProduct | null = null;

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
      res.status(404).json({ error: "Продукт не знайдено" });
      return;
    }

    res.status(200).json({ product });
  } catch (e: unknown) {
    if (hasErrorName(e, "TimeoutError") || hasErrorName(e, "AbortError")) {
      res
        .status(504)
        .json({ error: "Сервіс недоступний (таймаут). Спробуй пізніше." });
      return;
    }
    const message = e instanceof Error ? e.message : "Server error";
    res.status(500).json({ error: message });
  }
}
