import { useEffect, useMemo, useRef, useState } from "react";
import { fileToBase64 } from "./lib/fileToBase64.js";
import { postJson } from "./lib/nutritionApi.js";
import { mergeItems } from "./lib/mergeItems.js";
import { NutritionHeader } from "./components/NutritionHeader.jsx";
import { NutritionBottomNav } from "./components/NutritionBottomNav.jsx";
import { PhotoAnalyzeCard } from "./components/PhotoAnalyzeCard.jsx";
import { PantryCard } from "./components/PantryCard.jsx";
import { RecipesCard } from "./components/RecipesCard.jsx";
import { PantryManagerSheet } from "./components/PantryManagerSheet.jsx";
import { ConfirmDeleteSheet } from "./components/ConfirmDeleteSheet.jsx";
import { ItemEditSheet } from "./components/ItemEditSheet.jsx";
import {
  loadActivePantryId,
  loadPantries,
  loadNutritionPrefs,
  makeDefaultPantry,
  persistPantries,
  persistNutritionPrefs,
  updatePantry,
  NUTRITION_PANTRIES_KEY,
  NUTRITION_ACTIVE_PANTRY_KEY,
} from "./lib/nutritionStorage.js";
import {
  normalizeFoodName,
  parseLoosePantryText,
} from "./lib/pantryTextParser.js";

function fmtMacro(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Math.round(Number(n));
}

const VALID_NUTRITION_PAGES = ["products", "recipes"];

function parseHash() {
  const raw = (window.location.hash || "").replace(/^#/, "").trim();
  // Ігноруємо хеш формату Фініка (#/page)
  if (!raw || raw.startsWith("/")) return { page: "products" };
  const [page] = raw.split("/").filter(Boolean);
  if (!VALID_NUTRITION_PAGES.includes(page)) return { page: "products" };
  return { page };
}

function setHash(next) {
  const h = next ? `#${next}` : "#products";
  if (window.location.hash === h) return;
  window.location.hash = h;
}

export default function NutritionApp({ onBackToHub } = {}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [statusText, setStatusText] = useState("");

  const [activePage, setActivePage] = useState(() => parseHash().page); // products | recipes

  useEffect(() => {
    const onHash = () => setActivePage(parseHash().page);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const setActivePageAndHash = (page) => {
    setActivePage(page);
    setHash(page);
  };

  // ──────────────────────────────────────────────
  // Pantries (склади) + persistence
  // ──────────────────────────────────────────────
  const [pantries, setPantries] = useState(() =>
    loadPantries(NUTRITION_PANTRIES_KEY, NUTRITION_ACTIVE_PANTRY_KEY),
  );
  const [activePantryId, setActivePantryId] = useState(() =>
    loadActivePantryId(NUTRITION_ACTIVE_PANTRY_KEY),
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

  // ──────────────────────────────────────────────
  // Sheets (заміна prompt/confirm/alert)
  // ──────────────────────────────────────────────
  const [pantryManagerOpen, setPantryManagerOpen] = useState(false);

  const [pantryForm, setPantryForm] = useState(() => ({
    mode: "create", // create | rename
    name: "",
    err: "",
  }));

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [itemEdit, setItemEdit] = useState(() => ({
    open: false,
    idx: -1,
    name: "",
    qty: "",
    unit: "",
    err: "",
  }));

  useEffect(() => {
    persistPantries(NUTRITION_PANTRIES_KEY, NUTRITION_ACTIVE_PANTRY_KEY, pantries, activePantryId);
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

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        try {
          URL.revokeObjectURL(photoPreviewUrl);
        } catch {
          /* ignore */
        }
      }
    };
  }, [photoPreviewUrl]);

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
    const curName = normalizeFoodName(cur.name) || "Продукт";
    setItemEdit({
      open: true,
      idx,
      name: curName,
      qty: cur.qty != null ? String(cur.qty) : "",
      unit: cur.unit != null ? String(cur.unit) : "",
      err: "",
    });
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

  const beginRenamePantry = () => {
    const curName = String(activePantry?.name || "").trim() || "Склад";
    setPantryForm({ mode: "rename", name: curName, err: "" });
    setPantryManagerOpen(true);
  };

  const beginCreatePantry = () => {
    setPantryForm({ mode: "create", name: "", err: "" });
    setPantryManagerOpen(true);
  };

  const beginDeletePantry = () => {
    setConfirmDeleteOpen(true);
  };

  const onSavePantryForm = (name, mode) => {
    if (mode === "rename") {
      setPantries((cur) =>
        updatePantry(cur, activePantryId, (p) => ({ ...p, name })),
      );
    } else {
      const id = `p_${Date.now()}`;
      setPantries((cur) => [
        ...(Array.isArray(cur) ? cur : []),
        { id, name, items: [], text: "" },
      ]);
      setActivePantryId(id);
    }
    setPantryManagerOpen(false);
  };

  const onConfirmDeletePantry = () => {
    const arr = Array.isArray(pantries) ? pantries : [];
    if (arr.length <= 1) return;
    const next = arr.filter((p) => p.id !== activePantryId);
    setPantries(next);
    setActivePantryId(next[0]?.id || "home");
    setConfirmDeleteOpen(false);
    setPantryManagerOpen(false);
  };

  const onSaveItemEdit = (idx, qty, unit) => {
    setPantries((curPantries) =>
      updatePantry(curPantries, activePantryId, (p) => {
        const items = Array.isArray(p.items) ? [...p.items] : [];
        const item = items[idx];
        if (!item) return p;
        items[idx] = { ...item, qty, unit };
        return { ...p, items };
      }),
    );
    setItemEdit((s) => ({ ...s, open: false }));
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
      if (photoPreviewUrl) {
        try {
          URL.revokeObjectURL(photoPreviewUrl);
        } catch {
          /* ignore */
        }
      }
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
    <div className="h-dvh flex flex-col bg-bg text-text overflow-hidden">
      <NutritionHeader busy={busy} onBackToHub={onBackToHub} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-6 w-full">

          {/* Hero: склад */}
          <div className="rounded-2xl bg-nutrition/10 border border-nutrition/20 px-4 py-3 mb-4 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-nutrition/70 uppercase tracking-widest mb-0.5">
                Активний склад
              </div>
              <div className="text-base font-extrabold text-text leading-tight">
                {activePantry?.name || "Склад"}
              </div>
              <div className="text-xs text-subtle mt-0.5">
                {pantryItems.length > 0
                  ? `${pantryItems.length} продуктів збережено`
                  : "Склад порожній"}
              </div>
            </div>
            {(Array.isArray(pantries) ? pantries : []).length > 1 && (
              <select
                value={activePantry?.id || activePantryId || ""}
                onChange={(e) => setActivePantryId(e.target.value)}
                disabled={busy}
                className="h-9 rounded-xl bg-panel/60 border border-nutrition/30 px-3 text-sm text-text outline-none focus:border-nutrition/60 max-w-[36vw]"
                aria-label="Обрати склад"
              >
                {(Array.isArray(pantries) ? pantries : []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || "Склад"}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => setPantryManagerOpen(true)}
              disabled={busy}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-nutrition/70 hover:text-nutrition hover:bg-nutrition/10 transition-colors border border-nutrition/20"
              aria-label="Керування складами"
              title="Склади"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="1.5" /><circle cx="5" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
          </div>

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
      </div>

      <NutritionBottomNav
        activePage={activePage}
        setActivePage={setActivePageAndHash}
        busy={busy}
      />

      <PantryManagerSheet
        open={pantryManagerOpen}
        onClose={() => setPantryManagerOpen(false)}
        pantries={pantries}
        activePantryId={activePantryId}
        setActivePantryId={setActivePantryId}
        pantryForm={pantryForm}
        setPantryForm={setPantryForm}
        busy={busy}
        onSavePantryForm={onSavePantryForm}
        onBeginCreate={beginCreatePantry}
        onBeginRename={beginRenamePantry}
        onBeginDelete={beginDeletePantry}
      />

      <ConfirmDeleteSheet
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        pantries={pantries}
        activePantryId={activePantryId}
        onConfirm={onConfirmDeletePantry}
      />

      <ItemEditSheet
        itemEdit={itemEdit}
        setItemEdit={setItemEdit}
        onClose={() => setItemEdit((s) => ({ ...s, open: false }))}
        onSave={onSaveItemEdit}
      />
    </div>
  );
}
