export const SHOPPING_LIST_KEY = "nutrition_shopping_list_v1";

export function loadShoppingList(key = SHOPPING_LIST_KEY) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { categories: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { categories: [] };
    return normalizeShoppingList(parsed);
  } catch {
    return { categories: [] };
  }
}

export function persistShoppingList(list, key = SHOPPING_LIST_KEY) {
  try {
    localStorage.setItem(key, JSON.stringify(list || { categories: [] }));
    return true;
  } catch {
    return false;
  }
}

export function normalizeShoppingList(raw) {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const categories = Array.isArray(obj.categories)
    ? obj.categories
        .map((cat) => {
          if (!cat || typeof cat !== "object") return null;
          const name = String(cat.name || "Інше").trim();
          const items = Array.isArray(cat.items)
            ? cat.items
                .map((item) => {
                  if (!item || typeof item !== "object") return null;
                  const id = item.id
                    ? String(item.id)
                    : `si_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                  const itemName = String(item.name || "").trim();
                  if (!itemName) return null;
                  return {
                    id,
                    name: itemName,
                    quantity: String(item.quantity || "").trim(),
                    note: String(item.note || "").trim(),
                    checked: Boolean(item.checked),
                  };
                })
                .filter(Boolean)
            : [];
          if (items.length === 0) return null;
          return { name, items };
        })
        .filter(Boolean)
    : [];
  return { categories };
}

export function toggleShoppingItem(list, categoryName, itemId) {
  const categories = (list?.categories || []).map((cat) => {
    if (cat.name !== categoryName) return cat;
    return {
      ...cat,
      items: cat.items.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
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
