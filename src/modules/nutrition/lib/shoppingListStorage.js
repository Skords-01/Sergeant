import { nutritionStorage } from "./nutritionStorageInstance.js";

export const SHOPPING_LIST_KEY = "nutrition_shopping_list_v1";

export function loadShoppingList(key = SHOPPING_LIST_KEY) {
  const parsed = nutritionStorage.readJSON(key, null);
  return normalizeShoppingList(parsed);
}

export function persistShoppingList(list, key = SHOPPING_LIST_KEY) {
  return nutritionStorage.writeJSON(key, normalizeShoppingList(list));
}

function normalizeItemKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function makeItemId() {
  return `si_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeItem(raw, seenIds) {
  if (!raw || typeof raw !== "object") return null;
  const itemName = String(raw.name || "").trim();
  if (!itemName) return null;
  let id = raw.id != null ? String(raw.id).trim() : "";
  if (!id || seenIds.has(id)) id = makeItemId();
  while (seenIds.has(id)) id = makeItemId();
  seenIds.add(id);
  return {
    id,
    name: itemName,
    quantity: String(raw.quantity || "").trim(),
    note: String(raw.note || "").trim(),
    checked: Boolean(raw.checked),
  };
}

function mergeItem(existing, next) {
  // Keep first id; prefer checked=true so user progress is not lost on merge.
  return {
    ...existing,
    quantity: existing.quantity || next.quantity,
    note: existing.note || next.note,
    checked: existing.checked || next.checked,
  };
}

export function normalizeShoppingList(raw) {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const rawCategories = Array.isArray(obj.categories) ? obj.categories : [];
  const seenIds = new Set();
  const byCategory = new Map();

  for (const cat of rawCategories) {
    if (!cat || typeof cat !== "object") continue;
    const name = String(cat.name || "Інше").trim() || "Інше";
    const rawItems = Array.isArray(cat.items) ? cat.items : [];

    const bucket = byCategory.get(name) || {
      name,
      items: [],
      byKey: new Map(),
    };
    for (const rawItem of rawItems) {
      const item = sanitizeItem(rawItem, seenIds);
      if (!item) continue;
      const key = normalizeItemKey(item.name);
      const existingIdx = bucket.byKey.get(key);
      if (existingIdx == null) {
        bucket.byKey.set(key, bucket.items.length);
        bucket.items.push(item);
      } else {
        bucket.items[existingIdx] = mergeItem(bucket.items[existingIdx], item);
      }
    }
    if (bucket.items.length > 0 && !byCategory.has(name)) {
      byCategory.set(name, bucket);
    } else if (bucket.items.length > 0) {
      byCategory.set(name, bucket);
    }
  }

  const categories = [];
  for (const { name, items } of byCategory.values()) {
    if (items.length === 0) continue;
    categories.push({ name, items });
  }
  return { categories };
}

export function toggleShoppingItem(list, categoryName, itemId) {
  const categories = (list?.categories || []).map((cat) => {
    if (cat.name !== categoryName) return cat;
    return {
      ...cat,
      items: cat.items.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item,
      ),
    };
  });
  return { ...list, categories };
}

export function removeCheckedItems(list) {
  const categories = (list?.categories || [])
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => !item.checked),
    }))
    .filter((cat) => cat.items.length > 0);
  return { ...list, categories };
}

export function getCheckedItems(list) {
  const items = [];
  for (const cat of list?.categories || []) {
    for (const item of cat.items || []) {
      if (item.checked) items.push(item);
    }
  }
  return items;
}

export function getTotalCount(list) {
  let total = 0;
  let checked = 0;
  for (const cat of list?.categories || []) {
    for (const item of cat.items || []) {
      total++;
      if (item.checked) checked++;
    }
  }
  return { total, checked };
}
