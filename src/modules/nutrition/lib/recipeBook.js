const DB_NAME = "hub_nutrition_recipe_book";
const DB_VERSION = 1;
const STORE = "recipes";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "id" });
        s.createIndex("by_updatedAt", "updatedAt", { unique: false });
      }
    };
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function clamp0(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

function normalizeMacros(mac) {
  const m = mac && typeof mac === "object" ? mac : {};
  return {
    kcal: m.kcal == null ? null : clamp0(m.kcal),
    protein_g: m.protein_g == null ? null : clamp0(m.protein_g),
    fat_g: m.fat_g == null ? null : clamp0(m.fat_g),
    carbs_g: m.carbs_g == null ? null : clamp0(m.carbs_g),
  };
}

export function normalizeRecipeForSave(r) {
  const raw = r && typeof r === "object" ? r : {};
  const title = String(raw.title || "").trim();
  const id =
    raw.id && String(raw.id).trim()
      ? String(raw.id).trim()
      : `rcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    title,
    timeMinutes: raw.timeMinutes != null ? clamp0(raw.timeMinutes) : null,
    servings: raw.servings != null ? clamp0(raw.servings) : null,
    ingredients: Array.isArray(raw.ingredients) ? raw.ingredients.map((x) => String(x)).filter(Boolean).slice(0, 80) : [],
    steps: Array.isArray(raw.steps) ? raw.steps.map((x) => String(x)).filter(Boolean).slice(0, 80) : [],
    tips: Array.isArray(raw.tips) ? raw.tips.map((x) => String(x)).filter(Boolean).slice(0, 40) : [],
    macros: normalizeMacros(raw.macros),
    createdAt: raw.createdAt != null ? Number(raw.createdAt) || Date.now() : Date.now(),
    updatedAt: Date.now(),
  };
}

export async function listSavedRecipes(limit = 200) {
  try {
    const db = await openDb();
    const tx = db.transaction([STORE], "readonly");
    const store = tx.objectStore(STORE);
    const all = await new Promise((resolve, reject) => {
      const r = store.getAll();
      r.onsuccess = () => resolve(Array.isArray(r.result) ? r.result : []);
      r.onerror = () => reject(r.error);
    });
    await txDone(tx);
    db.close();
    return all
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, Math.max(1, Number(limit) || 200));
  } catch {
    return [];
  }
}

export async function saveRecipeToBook(recipe) {
  const r = normalizeRecipeForSave(recipe);
  if (!r.title) return { ok: false, error: "Порожня назва рецепту" };
  try {
    const db = await openDb();
    const tx = db.transaction([STORE], "readwrite");
    tx.objectStore(STORE).put(r);
    await txDone(tx);
    db.close();
    return { ok: true, recipe: r };
  } catch {
    return { ok: false, error: "Не вдалося зберегти рецепт" };
  }
}

export async function deleteSavedRecipe(id) {
  const key = String(id || "").trim();
  if (!key) return false;
  try {
    const db = await openDb();
    const tx = db.transaction([STORE], "readwrite");
    tx.objectStore(STORE).delete(key);
    await txDone(tx);
    db.close();
    return true;
  } catch {
    return false;
  }
}

export function scaleMacros(macros, factor) {
  const f = Number(factor);
  const k = Number.isFinite(f) && f > 0 ? f : 1;
  const m = macros && typeof macros === "object" ? macros : {};
  const v = (x) => (x == null ? null : Math.round(clamp0(x) * k * 10) / 10);
  return { kcal: v(m.kcal), protein_g: v(m.protein_g), fat_g: v(m.fat_g), carbs_g: v(m.carbs_g) };
}

