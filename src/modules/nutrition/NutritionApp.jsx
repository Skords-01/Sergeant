import { useEffect, useMemo, useRef, useState } from "react";
import { fileToBase64 } from "./lib/fileToBase64.js";
import { postJson } from "./lib/nutritionApi.js";
import { mergeItems } from "./lib/mergeItems.js";
import { NutritionHeader } from "./components/NutritionHeader.jsx";
import { PhotoAnalyzeCard } from "./components/PhotoAnalyzeCard.jsx";
import { PantryCard } from "./components/PantryCard.jsx";
import { RecipesCard } from "./components/RecipesCard.jsx";
import {
  loadActivePantryId,
  loadPantries,
  loadNutritionPrefs,
  makeDefaultPantry,
  persistPantries,
  persistNutritionPrefs,
  updatePantry,
} from "./lib/nutritionStorage.js";
import {
  normalizeFoodName,
  normalizeUnit,
  parseLoosePantryText,
} from "./lib/pantryTextParser.js";

function fmtMacro(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Math.round(Number(n));
}

export default function NutritionApp() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [statusText, setStatusText] = useState("");

  const [activePage, setActivePage] = useState("products"); // products | recipes

  // ──────────────────────────────────────────────
  // Pantries (склади) + persistence
  // ──────────────────────────────────────────────
  const PANTRIES_KEY = "nutrition_pantries_v1";
  const ACTIVE_PANTRY_KEY = "nutrition_active_pantry_v1";

  const [pantries, setPantries] = useState(() =>
    loadPantries(PANTRIES_KEY, ACTIVE_PANTRY_KEY),
  );
  const [activePantryId, setActivePantryId] = useState(() =>
    loadActivePantryId(ACTIVE_PANTRY_KEY),
  );

  const activePantry = useMemo(() => {
    const arr = Array.isArray(pantries) ? pantries : [];
    return arr.find((p) => p.id === activePantryId) || arr[0] || makeDefaultPantry();
  }, [pantries, activePantryId]);

  const pantryText = activePantry?.text || "";
  const pantryItems = useMemo(
    () => (Array.isArray(activePantry?.items) ? activePantry.items : []),
    [activePantry?.items],
  );
  const [newItemName, setNewItemName] = useState("");

  useEffect(() => {
    persistPantries(PANTRIES_KEY, ACTIVE_PANTRY_KEY, pantries, activePantryId);
  }, [pantries, activePantryId]);

  const [prefs, setPrefs] = useState(() => loadNutritionPrefs());

  useEffect(() => {
    persistNutritionPrefs(prefs);
  }, [prefs]);

  const fileRef = useRef(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoResult, setPhotoResult] = useState(null);
  const [lastPhotoPayload, setLastPhotoPayload] = useState(null);
  const [answers, setAnswers] = useState({});
  const [portionGrams, setPortionGrams] = useState("");

  const [recipes, setRecipes] = useState([]);
  const [recipesTried, setRecipesTried] = useState(false);
  const [recipesRaw, setRecipesRaw] = useState("");

  const pantrySummary = useMemo(() => {
    if (!Array.isArray(pantryItems) || pantryItems.length === 0) return "—";
    return pantryItems
      .slice(0, 12)
      .map((x) => x.name)
      .filter(Boolean)
      .join(", ");
  }, [pantryItems]);

  const effectiveItems = useMemo(() => {
    if (Array.isArray(pantryItems) && pantryItems.length > 0) return pantryItems;
    const raw = pantryText.trim();
    if (!raw) return [];
    return parseLoosePantryText(raw);
  }, [pantryItems, pantryText]);

  const upsertItem = (name) => {
    const n = normalizeFoodName(name);
    if (!n) return;
    setPantries((cur) =>
      updatePantry(cur, activePantryId, (p) => {
        const arr = Array.isArray(p.items) ? p.items : [];
        if (arr.some((x) => normalizeFoodName(x?.name) === n)) return p;
        return {
          ...p,
          items: [...arr, { name: n, qty: null, unit: null, notes: null }],
        };
      }),
    );
  };

  const removeItem = (name) => {
    const n = normalizeFoodName(name);
    if (!n) return;
    setPantries((cur) =>
      updatePantry(cur, activePantryId, (p) => ({
        ...p,
        items: (Array.isArray(p.items) ? p.items : []).filter(
          (x) => normalizeFoodName(x?.name) !== n,
        ),
      })),
    );
  };

  const ensureStructuredItems = () => {
    if (pantryItems.length > 0) return true;
    if (effectiveItems.length === 0) return false;
    setPantries((cur) =>
      updatePantry(cur, activePantryId, (p) => ({
        ...p,
        items: effectiveItems.map((x) => ({
          name: normalizeFoodName(x?.name),
          qty: x?.qty ?? null,
          unit: x?.unit ?? null,
          notes: x?.notes ?? null,
        })),
      })),
    );
    return true;
  };

  const editItemAt = (idx) => {
    if (!ensureStructuredItems()) return;
    const cur = (Array.isArray(activePantry?.items) ? activePantry.items : [])[idx];
    if (!cur) return;
    const curName = normalizeFoodName(cur.name);
    const curQty = cur.qty != null ? String(cur.qty) : "";
    const curUnit = cur.unit != null ? String(cur.unit) : "";

    const nextQtyRaw = prompt(
      `Кількість для "${curName}" (порожньо — прибрати кількість):`,
      curQty,
    );
    if (nextQtyRaw == null) return; // cancel
    const nextUnitRaw = prompt(
      `Одиниця для "${curName}" (г/кг/мл/л/шт або порожньо):`,
      curUnit,
    );
    if (nextUnitRaw == null) return;

    const qtyStr = String(nextQtyRaw).trim();
    const unitStr = String(nextUnitRaw).trim();
    const qty = qtyStr === "" ? null : Number(qtyStr.replace(",", "."));
    const unit = unitStr === "" ? null : normalizeUnit(unitStr);

    setPantries((curPantries) =>
      updatePantry(curPantries, activePantryId, (p) => {
        const items = Array.isArray(p.items) ? [...p.items] : [];
        const item = items[idx];
        if (!item) return p;
        items[idx] = {
          ...item,
          qty: Number.isFinite(qty) ? qty : null,
          unit,
        };
        return { ...p, items };
      }),
    );
  };

  const removeItemAt = (idx) => {
    if (!ensureStructuredItems()) return;
    setPantries((curPantries) =>
      updatePantry(curPantries, activePantryId, (p) => {
        const items = Array.isArray(p.items) ? [...p.items] : [];
        items.splice(idx, 1);
        return { ...p, items };
      }),
    );
  };

  const applyTemplate = (id) => {
    const templates = {
      quickBreakfast: ["яйця", "йогурт", "банан", "вівсянка", "сир кисломолочний"],
      quickLunch: ["курка", "рис", "огірок", "помідор", "оливкова олія"],
      quickFitness: ["тунець", "гречка", "яйця", "творог", "овочі"],
    };
    const list = templates[id] || [];
    setPantries((cur) =>
      updatePantry(cur, activePantryId, (p) => ({
        ...p,
        items: list.map((n) => ({ name: n, qty: null, unit: null, notes: null })),
        text: list.join(", "),
      })),
    );
  };

  const renameActivePantry = () => {
    const curName = String(activePantry?.name || "").trim() || "Склад";
    const name = prompt("Нова назва складу:", curName);
    if (!name || !String(name).trim()) return;
    setPantries((cur) =>
      updatePantry(cur, activePantryId, (p) => ({ ...p, name: String(name).trim() })),
    );
  };

  const deleteActivePantry = () => {
    const arr = Array.isArray(pantries) ? pantries : [];
    if (arr.length <= 1) {
      alert("Не можна видалити останній склад.");
      return;
    }
    const ok = confirm(
      `Видалити склад "${activePantry?.name || "Склад"}"? Це прибере всі продукти в ньому.`,
    );
    if (!ok) return;
    const next = arr.filter((p) => p.id !== activePantryId);
    setPantries(next);
    setActivePantryId(next[0]?.id || "home");
  };

  const onPickPhoto = async (file) => {
    setErr("");
    setPhotoResult(null);
    if (!file) return;
    if (!/^image\//.test(file.type || "")) {
      setErr("Обери файл зображення (jpg/png/heic).");
      return;
    }
    if (file.size > 4.5 * 1024 * 1024) {
      setErr("Фото завелике для швидкого аналізу. Обріж або стисни (≈ до 4 МБ).");
      return;
    }
    try {
      const url = URL.createObjectURL(file);
      setPhotoPreviewUrl(url);
    } catch {
      /* ignore */
    }
  };

  const analyzePhoto = async () => {
    setBusy(true);
    setErr("");
    setStatusText("Аналізую фото…");
    setPhotoResult(null);
    setAnswers({});
    setPortionGrams("");
    try {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("Спочатку обери фото.");
      const b64 = await fileToBase64(file);
      const payload = {
        image_base64: b64,
        mime_type: file.type || "image/jpeg",
        locale: "uk-UA",
      };
      setLastPhotoPayload(payload);
      const data = await postJson("/api/nutrition/analyze-photo", payload);
      setPhotoResult(data?.result || null);
    } catch (e) {
      setErr(e?.message || "Помилка аналізу фото");
    } finally {
      setStatusText("");
      setBusy(false);
    }
  };

  const refinePhoto = async () => {
    setBusy(true);
    setErr("");
    setStatusText("Уточнюю порцію та перераховую…");
    try {
      if (!lastPhotoPayload) throw new Error("Немає вихідного фото. Спочатку зроби аналіз.");
      const questions = Array.isArray(photoResult?.questions)
        ? photoResult.questions.slice(0, 6)
        : [];
      const qna = questions
        .map((q) => ({ question: q, answer: String(answers[q] || "").trim() }))
        .filter((x) => x.answer);
      const grams = Number(String(portionGrams).replace(",", "."));
      const data = await postJson("/api/nutrition/refine-photo", {
        ...lastPhotoPayload,
        prior_result: photoResult,
        portion_grams: Number.isFinite(grams) && grams > 0 ? grams : null,
        qna,
        locale: "uk-UA",
      });
      setPhotoResult(data?.result || null);
    } catch (e) {
      setErr(e?.message || "Помилка уточнення");
    } finally {
      setStatusText("");
      setBusy(false);
    }
  };

  const parsePantry = async () => {
    setBusy(true);
    setErr("");
    setStatusText("Розбираю список…");
    try {
      if (!pantryText.trim()) throw new Error("Надиктуй/впиши список продуктів.");
      const data = await postJson("/api/nutrition/parse-pantry", {
        text: pantryText.trim(),
        locale: "uk-UA",
      });
      const next = Array.isArray(data?.items) ? data.items : [];
      setPantries((cur) =>
        updatePantry(cur, activePantryId, (p) => ({
          ...p,
          items: mergeItems(p.items, next),
        })),
      );
    } catch (e) {
      setErr(e?.message || "Помилка розбору списку");
    } finally {
      setStatusText("");
      setBusy(false);
    }
  };

  const recommendRecipes = async () => {
    setBusy(true);
    setErr("");
    setRecipes([]);
    setRecipesRaw("");
    setRecipesTried(true);
    setStatusText("Генерую рецепти…");
    try {
      const items = effectiveItems;
      if (items.length === 0) throw new Error("Дай хоча б 2–3 продукти для рецептів.");
      const data = await postJson("/api/nutrition/recommend-recipes", {
        items: items.slice(0, 40),
        preferences: {
          goal: prefs.goal,
          servings: Number(prefs.servings) || 1,
          timeMinutes: Number(prefs.timeMinutes) || 25,
          exclude: String(prefs.exclude || ""),
          locale: "uk-UA",
        },
      });
      setRecipes(Array.isArray(data?.recipes) ? data.recipes : []);
      setRecipesRaw(typeof data?.rawText === "string" ? data.rawText : "");
    } catch (e) {
      setErr(e?.message || "Помилка рекомендацій");
    } finally {
      setStatusText("");
      setBusy(false);
    }
  };

  useEffect(() => {
    if (photoResult && Array.isArray(photoResult.questions)) {
      setAnswers((cur) => {
        const next = { ...cur };
        photoResult.questions.slice(0, 6).forEach((q) => {
          if (next[q] == null) next[q] = "";
        });
        return next;
      });
    }
  }, [photoResult]);

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-6 pb-24 max-w-2xl mx-auto w-full">
      <NutritionHeader
        busy={busy}
        activePage={activePage}
        setActivePage={setActivePage}
        pantries={pantries}
        activePantry={activePantry}
        activePantryId={activePantryId}
        setActivePantryId={setActivePantryId}
        renameActivePantry={renameActivePantry}
        deleteActivePantry={deleteActivePantry}
        createPantry={() => {
          const name = prompt("Назва нового складу (напр. Дім, Робота):");
          if (!name || !String(name).trim()) return;
          const id = `p_${Date.now()}`;
          setPantries((cur) => [
            ...(Array.isArray(cur) ? cur : []),
            { id, name: String(name).trim(), items: [], text: "" },
          ]);
          setActivePantryId(id);
        }}
      />

      {(err || statusText) && (
        <div className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {err || statusText}
        </div>
      )}

      <div className="grid gap-4">
        <PhotoAnalyzeCard
          busy={busy}
          analyzePhoto={analyzePhoto}
          fileRef={fileRef}
          onPickPhoto={onPickPhoto}
          photoPreviewUrl={photoPreviewUrl}
          photoResult={photoResult}
          fmtMacro={fmtMacro}
          portionGrams={portionGrams}
          setPortionGrams={setPortionGrams}
          refinePhoto={refinePhoto}
          answers={answers}
          setAnswers={setAnswers}
        />

        {activePage === "products" && (
          <PantryCard
            busy={busy}
            activePantry={activePantry}
            parsePantry={parsePantry}
            applyTemplate={applyTemplate}
            newItemName={newItemName}
            setNewItemName={setNewItemName}
            upsertItem={upsertItem}
            pantryText={pantryText}
            setPantryText={(text) =>
              setPantries((cur) =>
                updatePantry(cur, activePantryId, (p) => ({ ...p, text })),
              )
            }
            effectiveItems={effectiveItems}
            editItemAt={editItemAt}
            removeItemAtOrByName={(idx, name) =>
              pantryItems.length > 0 ? removeItemAt(idx) : removeItem(name)
            }
            pantryItemsLength={pantryItems.length}
            pantrySummary={pantrySummary}
          />
        )}

        {activePage === "recipes" && (
          <RecipesCard
            busy={busy}
            activePantry={activePantry}
            prefs={prefs}
            setPrefs={setPrefs}
            recommendRecipes={recommendRecipes}
            recipes={recipes}
            recipesTried={recipesTried}
            recipesRaw={recipesRaw}
            err={err}
            fmtMacro={fmtMacro}
          />
        )}
      </div>
    </div>
  );
}

