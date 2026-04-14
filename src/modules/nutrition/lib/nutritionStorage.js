import { normalizeFoodName } from "./pantryTextParser.js";
import { mergeItems } from "./mergeItems.js";

export const NUTRITION_PANTRIES_KEY = "nutrition_pantries_v1";
export const NUTRITION_ACTIVE_PANTRY_KEY = "nutrition_active_pantry_v1";
export const NUTRITION_PREFS_KEY = "nutrition_prefs_v1";

const LEGACY_ITEMS_KEY = "nutrition_pantry_items_v0";
const LEGACY_TEXT_KEY = "nutrition_pantry_text_v0";

export function defaultNutritionPrefs() {
  return {
    goal: "balanced",
    servings: 1,
    timeMinutes: 25,
    exclude: "",
  };
}

export function loadNutritionPrefs(key = NUTRITION_PREFS_KEY) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultNutritionPrefs();
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object" || Array.isArray(p)) return defaultNutritionPrefs();
    return {
      ...defaultNutritionPrefs(),
      ...p,
      servings: p.servings != null ? Number(p.servings) || 1 : 1,
      timeMinutes: p.timeMinutes != null ? Number(p.timeMinutes) || 25 : 25,
      exclude: p.exclude == null ? "" : String(p.exclude),
      goal: p.goal ? String(p.goal) : "balanced",
    };
  } catch {
    return defaultNutritionPrefs();
  }
}

export function persistNutritionPrefs(prefs, key = NUTRITION_PREFS_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(prefs || defaultNutritionPrefs()));
  } catch {}
}

export function makeDefaultPantry() {
  return { id: "home", name: "Дім", items: [], text: "" };
}

export function loadActivePantryId(activeKey = NUTRITION_ACTIVE_PANTRY_KEY) {
  try {
    const v = localStorage.getItem(activeKey);
    return v ? String(v) : "home";
  } catch {
    return "home";
  }
}

export function loadPantries(
  key = NUTRITION_PANTRIES_KEY,
  activeKey = NUTRITION_ACTIVE_PANTRY_KEY,
) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  // Міграція: якщо є старі ключі (не було складів), підтягнемо як "Дім"
  let fallback = makeDefaultPantry();
  try {
    const oldItems = JSON.parse(localStorage.getItem(LEGACY_ITEMS_KEY) || "null");
    const oldText = String(localStorage.getItem(LEGACY_TEXT_KEY) || "");
    if (Array.isArray(oldItems) && oldItems.length > 0) fallback.items = oldItems;
    if (oldText) fallback.text = oldText;
  } catch {}
  try {
    localStorage.setItem(activeKey, fallback.id);
  } catch {}
  return [fallback];
}

export function persistPantries(
  key = NUTRITION_PANTRIES_KEY,
  activeKey = NUTRITION_ACTIVE_PANTRY_KEY,
  pantries,
  activeId,
) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.isArray(pantries) ? pantries : []));
  } catch {}
  try {
    if (activeId) localStorage.setItem(activeKey, String(activeId));
  } catch {}
}

export function updatePantry(pantries, activeId, fn) {
  const arr = Array.isArray(pantries) ? pantries : [];
  const id = String(activeId || "home");
  const idx = arr.findIndex((p) => p.id === id);
  if (idx === -1) {
    const created = fn(makeDefaultPantry());
    return [created, ...arr];
  }
  const next = [...arr];
  next[idx] = fn(next[idx]);
  return next;
}

export function upsertPantryItem(pantry, name) {
  const n = normalizeFoodName(name);
  if (!n) return pantry;
  const arr = Array.isArray(pantry?.items) ? pantry.items : [];
  if (arr.some((x) => normalizeFoodName(x?.name) === n)) return pantry;
  return { ...pantry, items: [...arr, { name: n, qty: null, unit: null, notes: null }] };
}

export function removePantryItem(pantry, name) {
  const n = normalizeFoodName(name);
  if (!n) return pantry;
  const arr = Array.isArray(pantry?.items) ? pantry.items : [];
  return { ...pantry, items: arr.filter((x) => normalizeFoodName(x?.name) !== n) };
}

export function mergePantryItems(pantry, incomingItems) {
  return { ...pantry, items: mergeItems(pantry?.items, incomingItems) };
}

