import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@shared/components/ui/Input";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
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

  // ──────────────────────────────────────────────
  // Sheets (заміна prompt/confirm/alert)
  // ──────────────────────────────────────────────
  const [pantryManagerOpen, setPantryManagerOpen] = useState(false);
  const pantryManagerRef = useRef(null);
  useDialogFocusTrap(pantryManagerOpen, pantryManagerRef, {
    onEscape: () => setPantryManagerOpen(false),
  });

  const [pantryForm, setPantryForm] = useState(() => ({
    mode: "create", // create | rename
    name: "",
    err: "",
  }));

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const confirmDeleteRef = useRef(null);
  useDialogFocusTrap(confirmDeleteOpen, confirmDeleteRef, {
    onEscape: () => setConfirmDeleteOpen(false),
  });

  const [itemEdit, setItemEdit] = useState(() => ({
    open: false,
    idx: -1,
    name: "",
    qty: "",
    unit: "",
    err: "",
  }));
  const itemEditRef = useRef(null);
  useDialogFocusTrap(itemEdit.open, itemEditRef, {
    onEscape: () => setItemEdit((s) => ({ ...s, open: false })),
  });

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
      <NutritionHeader
        busy={busy}
        activePage={activePage}
        setActivePage={setActivePageAndHash}
        pantries={pantries}
        activePantry={activePantry}
        activePantryId={activePantryId}
        setActivePantryId={setActivePantryId}
        onOpenPantryManager={() => setPantryManagerOpen(true)}
        onBackToHub={onBackToHub}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-24 w-full">
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

      {/* Pantry manager sheet */}
      {pantryManagerOpen && (
        <div className={cn("fixed inset-0 flex items-end", "z-[100]")}>
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Закрити"
            onClick={() => setPantryManagerOpen(false)}
          />
          <div
            ref={pantryManagerRef}
            className={cn(
              "relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft max-h-[92dvh] flex flex-col",
              "fizruk-sheet-pad",
            )}
            onPointerDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nutrition-pantries-title"
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-line rounded-full" aria-hidden />
            </div>
            <div className="px-4 sm:px-5 pb-6 overflow-y-auto flex-1 min-h-0">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div
                    id="nutrition-pantries-title"
                    className="text-lg font-extrabold text-text leading-tight"
                  >
                    Склади продуктів
                  </div>
                  <div className="text-xs text-subtle mt-1">
                    Створи окремо для “Дім / Робота” або по дієті
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPantryManagerOpen(false)}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
                  aria-label="Закрити"
                >
                  ✕
                </button>
              </div>

              <div className="rounded-2xl border border-line bg-bg overflow-hidden mb-4">
                {(Array.isArray(pantries) ? pantries : []).map((p) => {
                  const active = p.id === activePantryId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActivePantryId(p.id)}
                      className={cn(
                        "w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-panelHi transition-colors",
                        active && "bg-nutrition/10",
                      )}
                      aria-pressed={active}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-text truncate">
                          {p.name || "Склад"}
                        </div>
                        {active ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-nutrition/15 text-nutrition border border-nutrition/25">
                            Активний
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                <Button
                  type="button"
                  className="h-12 min-h-[44px] bg-nutrition text-white hover:bg-nutrition-hover"
                  onClick={beginCreatePantry}
                >
                  + Новий склад
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 min-h-[44px]"
                  onClick={beginRenamePantry}
                >
                  Перейменувати активний
                </Button>
              </div>

              <div className="rounded-2xl border border-line bg-panelHi p-4">
                <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">
                  {pantryForm.mode === "rename" ? "Нова назва" : "Назва складу"}
                </div>
                <div className="mt-2">
                  <Input
                    value={pantryForm.name}
                    onChange={(e) =>
                      setPantryForm((f) => ({ ...f, name: e.target.value, err: "" }))
                    }
                    placeholder="напр. Дім"
                    disabled={busy}
                    aria-label="Назва складу"
                  />
                  {pantryForm.err ? (
                    <div className="text-xs text-danger mt-2">{pantryForm.err}</div>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    type="button"
                    className="h-12 min-h-[44px] bg-nutrition text-white hover:bg-nutrition-hover"
                    onClick={() => {
                      const name = String(pantryForm.name || "").trim();
                      if (!name) {
                        setPantryForm((f) => ({ ...f, err: "Вкажи назву." }));
                        return;
                      }
                      if (pantryForm.mode === "rename") {
                        setPantries((cur) =>
                          updatePantry(cur, activePantryId, (p) => ({
                            ...p,
                            name,
                          })),
                        );
                        setPantryManagerOpen(false);
                        return;
                      }
                      const id = `p_${Date.now()}`;
                      setPantries((cur) => [
                        ...(Array.isArray(cur) ? cur : []),
                        { id, name, items: [], text: "" },
                      ]);
                      setActivePantryId(id);
                      setPantryManagerOpen(false);
                    }}
                  >
                    Зберегти
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    className="h-12 min-h-[44px]"
                    onClick={beginDeletePantry}
                  >
                    Видалити активний
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete sheet */}
      {confirmDeleteOpen && (
        <div className={cn("fixed inset-0 flex items-end", "z-[110]")}>
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Закрити"
            onClick={() => setConfirmDeleteOpen(false)}
          />
          <div
            ref={confirmDeleteRef}
            className={cn(
              "relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft",
              "fizruk-sheet-pad",
            )}
            onPointerDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nutrition-delete-title"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-line rounded-full" aria-hidden />
            </div>
            <div className="px-5 pb-6">
              <div
                id="nutrition-delete-title"
                className="text-lg font-extrabold text-text leading-tight"
              >
                Видалити склад?
              </div>
              <div className="text-xs text-subtle mt-1">
                Це прибере всі продукти в ньому. Дію не можна відмінити.
              </div>
              {(() => {
                const arr = Array.isArray(pantries) ? pantries : [];
                if (arr.length <= 1) {
                  return (
                    <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
                      Не можна видалити останній склад.
                    </div>
                  );
                }
                return null;
              })()}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 min-h-[44px]"
                  onClick={() => setConfirmDeleteOpen(false)}
                >
                  Скасувати
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="h-12 min-h-[44px]"
                  onClick={() => {
                    const arr = Array.isArray(pantries) ? pantries : [];
                    if (arr.length <= 1) return;
                    const next = arr.filter((p) => p.id !== activePantryId);
                    setPantries(next);
                    setActivePantryId(next[0]?.id || "home");
                    setConfirmDeleteOpen(false);
                    setPantryManagerOpen(false);
                  }}
                >
                  Видалити
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit item sheet */}
      {itemEdit.open && (
        <div className={cn("fixed inset-0 flex items-end", "z-[120]")}>
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Закрити"
            onClick={() => setItemEdit((s) => ({ ...s, open: false }))}
          />
          <div
            ref={itemEditRef}
            className={cn(
              "relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft",
              "fizruk-sheet-pad",
            )}
            onPointerDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nutrition-item-edit-title"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-line rounded-full" aria-hidden />
            </div>
            <div className="px-5 pb-6">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div
                    id="nutrition-item-edit-title"
                    className="text-lg font-extrabold text-text leading-tight truncate"
                  >
                    {itemEdit.name}
                  </div>
                  <div className="text-xs text-subtle mt-1">
                    Кількість і одиниці (порожньо — прибрати)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setItemEdit((s) => ({ ...s, open: false }))}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
                  aria-label="Закрити"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-1">
                    Кількість
                  </div>
                  <Input
                    value={itemEdit.qty}
                    onChange={(e) =>
                      setItemEdit((s) => ({ ...s, qty: e.target.value, err: "" }))
                    }
                    inputMode="decimal"
                    placeholder="напр. 2.5"
                    aria-label="Кількість"
                  />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-1">
                    Одиниця
                  </div>
                  <Input
                    value={itemEdit.unit}
                    onChange={(e) =>
                      setItemEdit((s) => ({ ...s, unit: e.target.value, err: "" }))
                    }
                    placeholder="г / кг / мл / л / шт"
                    aria-label="Одиниця"
                  />
                </div>
              </div>

              {itemEdit.err ? (
                <div className="text-xs text-danger mt-2">{itemEdit.err}</div>
              ) : null}

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  type="button"
                  className="h-12 min-h-[44px] bg-nutrition text-white hover:bg-nutrition-hover"
                  onClick={() => {
                    const qtyStr = String(itemEdit.qty || "").trim();
                    const unitStr = String(itemEdit.unit || "").trim();
                    const qty =
                      qtyStr === "" ? null : Number(qtyStr.replace(",", "."));
                    if (qtyStr !== "" && !Number.isFinite(qty)) {
                      setItemEdit((s) => ({ ...s, err: "Некоректна кількість." }));
                      return;
                    }
                    const unit = unitStr === "" ? null : normalizeUnit(unitStr);
                    setPantries((curPantries) =>
                      updatePantry(curPantries, activePantryId, (p) => {
                        const items = Array.isArray(p.items) ? [...p.items] : [];
                        const item = items[itemEdit.idx];
                        if (!item) return p;
                        items[itemEdit.idx] = {
                          ...item,
                          qty: Number.isFinite(qty) ? qty : null,
                          unit,
                        };
                        return { ...p, items };
                      }),
                    );
                    setItemEdit((s) => ({ ...s, open: false }));
                  }}
                >
                  Зберегти
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 min-h-[44px]"
                  onClick={() => setItemEdit((s) => ({ ...s, open: false }))}
                >
                  Скасувати
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

