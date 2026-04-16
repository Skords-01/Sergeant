function safeString(x, fallback = "") {
  return x == null ? fallback : String(x);
}

function safeNumberOrNull(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function safeNonNegNumberOrNull(x) {
  const n = safeNumberOrNull(x);
  return n == null ? null : n >= 0 ? n : null;
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export function normalizePhotoResult(parsed, { fallbackGrams = null } = {}) {
  const obj =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  const dishName = safeString(obj.dishName, "Результат").trim() || "Результат";
  const confidence = clamp01(obj.confidence);

  const portion =
    obj.portion &&
    typeof obj.portion === "object" &&
    !Array.isArray(obj.portion)
      ? {
          label: safeString(obj.portion.label, "").trim() || null,
          gramsApprox:
            obj.portion.gramsApprox == null
              ? null
              : safeNumberOrNull(obj.portion.gramsApprox),
        }
      : null;

  const ingredients = Array.isArray(obj.ingredients)
    ? obj.ingredients
        .slice(0, 40)
        .map((x) => {
          if (!x || typeof x !== "object") return null;
          const name = safeString(x.name, "").trim();
          if (!name) return null;
          const notes =
            x.notes == null || x.notes === ""
              ? null
              : safeString(x.notes, "").trim();
          return { name, notes };
        })
        .filter(Boolean)
    : [];

  const macros =
    obj.macros && typeof obj.macros === "object" && !Array.isArray(obj.macros)
      ? obj.macros
      : {};
  const outMacros = {
    kcal: safeNonNegNumberOrNull(macros.kcal),
    protein_g: safeNonNegNumberOrNull(macros.protein_g),
    fat_g: safeNonNegNumberOrNull(macros.fat_g),
    carbs_g: safeNonNegNumberOrNull(macros.carbs_g),
  };

  const questions = Array.isArray(obj.questions)
    ? obj.questions
        .map((q) => safeString(q, "").trim())
        .filter(Boolean)
        .slice(0, 6)
    : [];

  const finalPortion =
    portion ||
    (fallbackGrams != null
      ? { label: `${fallbackGrams} г`, gramsApprox: fallbackGrams }
      : null);

  return {
    dishName,
    confidence,
    portion: finalPortion,
    ingredients,
    macros: outMacros,
    questions,
  };
}

export function normalizePantryItems(parsed) {
  const items = Array.isArray(parsed?.items)
    ? parsed.items
    : Array.isArray(parsed)
      ? parsed
      : [];
  return items
    .slice(0, 80)
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const name = safeString(x.name, "").trim();
      if (!name) return null;
      const qty =
        x.qty == null || x.qty === "" ? null : safeNumberOrNull(x.qty);
      let unit =
        x.unit == null || x.unit === "" ? null : safeString(x.unit, "").trim();
      if (qty != null && unit == null) unit = "шт";
      const notes =
        x.notes == null || x.notes === ""
          ? null
          : safeString(x.notes, "").trim();
      return { name, qty, unit, notes };
    })
    .filter(Boolean);
}

export function normalizeRecipes(parsed) {
  const recipes = Array.isArray(parsed?.recipes)
    ? parsed.recipes
    : Array.isArray(parsed)
      ? parsed
      : [];
  return recipes
    .slice(0, 6)
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const title = safeString(r.title, "").trim();
      const timeMinutes =
        r.timeMinutes == null ? null : safeNumberOrNull(r.timeMinutes);
      const servings = r.servings == null ? null : safeNumberOrNull(r.servings);
      const ingredients = Array.isArray(r.ingredients)
        ? r.ingredients
            .map((x) => safeString(x, "").trim())
            .filter(Boolean)
            .slice(0, 30)
        : [];
      const steps = Array.isArray(r.steps)
        ? r.steps
            .map((x) => safeString(x, "").trim())
            .filter(Boolean)
            .slice(0, 10)
        : [];
      const tips = Array.isArray(r.tips)
        ? r.tips
            .map((x) => safeString(x, "").trim())
            .filter(Boolean)
            .slice(0, 8)
        : [];
      const m =
        r.macros && typeof r.macros === "object" && !Array.isArray(r.macros)
          ? r.macros
          : {};
      const macros = {
        kcal: safeNonNegNumberOrNull(m.kcal),
        protein_g: safeNonNegNumberOrNull(m.protein_g),
        fat_g: safeNonNegNumberOrNull(m.fat_g),
        carbs_g: safeNonNegNumberOrNull(m.carbs_g),
      };
      return {
        title: title || "Рецепт",
        timeMinutes,
        servings,
        ingredients,
        steps,
        tips,
        macros,
      };
    })
    .filter(Boolean);
}
