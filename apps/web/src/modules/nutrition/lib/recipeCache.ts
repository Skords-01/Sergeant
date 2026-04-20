import { normalizeFoodName } from "./pantryTextParser.js";

const STORAGE_KEY = "nutrition_recipes_cache_v1";

function shortHash(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export interface RecipeCachePrefs {
  goal?: unknown;
  servings?: unknown;
  timeMinutes?: unknown;
  exclude?: unknown;
}

export interface RecipeCacheEntry<TRecipe = unknown> {
  recipes: TRecipe[];
  recipesRaw: string;
  savedAt?: number;
}

export function buildRecipeCacheKey(
  activePantryId: string,
  effectiveItems: ReadonlyArray<{ name?: unknown }>,
  prefs: RecipeCachePrefs | null | undefined,
): string {
  const names = effectiveItems
    .map((x) => normalizeFoodName(x?.name))
    .filter(Boolean)
    .sort();
  const prefStr = [
    prefs?.goal,
    prefs?.servings,
    prefs?.timeMinutes,
    String(prefs?.exclude || ""),
  ].join("|");
  const raw = `${activePantryId}\n${names.join("\n")}\n${prefStr}`;
  return shortHash(raw);
}

export function readRecipeCache<TRecipe = unknown>(
  cacheKey: string,
): RecipeCacheEntry<TRecipe> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    if (!all || typeof all !== "object") return null;
    const entry = (all as Record<string, unknown>)[cacheKey] as
      | RecipeCacheEntry<TRecipe>
      | undefined;
    if (!entry || !Array.isArray(entry.recipes)) return null;
    return {
      recipes: entry.recipes,
      recipesRaw: typeof entry.recipesRaw === "string" ? entry.recipesRaw : "",
      savedAt: entry.savedAt,
    };
  } catch {
    return null;
  }
}

export function writeRecipeCache<TRecipe = unknown>(
  cacheKey: string,
  { recipes, recipesRaw }: { recipes: TRecipe[]; recipesRaw?: string },
): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    let all: Record<string, RecipeCacheEntry<TRecipe>> = {};
    if (raw) {
      try {
        all = (JSON.parse(raw) || {}) as Record<
          string,
          RecipeCacheEntry<TRecipe>
        >;
      } catch {
        all = {};
      }
    }
    all[cacheKey] = {
      recipes,
      recipesRaw: recipesRaw || "",
      savedAt: Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
