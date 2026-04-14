import { normalizeFoodName } from "./pantryTextParser.js";

const STORAGE_KEY = "nutrition_recipes_cache_v1";

function shortHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function buildRecipeCacheKey(activePantryId, effectiveItems, prefs) {
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

export function readRecipeCache(cacheKey) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    if (!all || typeof all !== "object") return null;
    const entry = all[cacheKey];
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

export function writeRecipeCache(cacheKey, { recipes, recipesRaw }) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    let all = {};
    if (raw) {
      try {
        all = JSON.parse(raw) || {};
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
