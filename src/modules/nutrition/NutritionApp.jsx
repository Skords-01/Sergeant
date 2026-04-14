import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { postJson } from "./lib/nutritionApi.js";
import { NutritionHeader } from "./components/NutritionHeader.jsx";
import { NutritionBottomNav } from "./components/NutritionBottomNav.jsx";
import { PhotoAnalyzeCard } from "./components/PhotoAnalyzeCard.jsx";
import { PantryCard } from "./components/PantryCard.jsx";
import { RecipesCard } from "./components/RecipesCard.jsx";
import { LogCard } from "./components/LogCard.jsx";
import { AddMealSheet } from "./components/AddMealSheet.jsx";
import { PantryManagerSheet } from "./components/PantryManagerSheet.jsx";
import { ConfirmDeleteSheet } from "./components/ConfirmDeleteSheet.jsx";
import { ItemEditSheet } from "./components/ItemEditSheet.jsx";
import { loadNutritionPrefs, persistNutritionPrefs, getDayMacros } from "./lib/nutritionStorage.js";
import { useNutritionPantries } from "./hooks/useNutritionPantries.js";
import { useNutritionLog } from "./hooks/useNutritionLog.js";
import { usePhotoAnalysis } from "./hooks/usePhotoAnalysis.js";
import { buildRecipeCacheKey, readRecipeCache, writeRecipeCache } from "./lib/recipeCache.js";
import { fileToThumbnailBlob, saveMealThumbnail } from "./lib/mealPhotoStorage.js";

function fmtMacro(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Math.round(Number(n));
}

const VALID_NUTRITION_PAGES = ["products", "log", "recipes"];

function parseHash() {
  const raw = (window.location.hash || "").replace(/^#/, "").trim();
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

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export default function NutritionApp({ onBackToHub } = {}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [statusText, setStatusText] = useState("");

  const [activePage, setActivePage] = useState(() => parseHash().page);

  useEffect(() => {
    const onHash = () => setActivePage(parseHash().page);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const setActivePageAndHash = (page) => {
    setActivePage(page);
    setHash(page);
  };

  const pantry = useNutritionPantries({ setBusy, setErr, setStatusText });
  const log = useNutritionLog();
  const photo = usePhotoAnalysis({ setBusy, setErr, setStatusText });

  const [prefs, setPrefs] = useState(() => loadNutritionPrefs());
  const [prefsStorageErr, setPrefsStorageErr] = useState("");

  useEffect(() => {
    setPrefsStorageErr(persistNutritionPrefs(prefs) ? "" : "Не вдалося зберегти налаштування.");
  }, [prefs]);

  const [recipes, setRecipes] = useState([]);
  const [recipesTried, setRecipesTried] = useState(false);
  const [recipesRaw, setRecipesRaw] = useState("");

  const [weekPlan, setWeekPlan] = useState(null);
  const [weekPlanRaw, setWeekPlanRaw] = useState("");
  const [weekPlanBusy, setWeekPlanBusy] = useState(false);

  const [dayHintText, setDayHintText] = useState("");
  const [dayHintBusy, setDayHintBusy] = useState(false);

  const recipeCacheKey = useMemo(
    () =>
      buildRecipeCacheKey(pantry.activePantryId, pantry.effectiveItems, {
        goal: prefs.goal,
        servings: prefs.servings,
        timeMinutes: prefs.timeMinutes,
        exclude: prefs.exclude,
      }),
    [
      pantry.activePantryId,
      pantry.effectiveItems,
      prefs.goal,
      prefs.servings,
      prefs.timeMinutes,
      prefs.exclude,
    ],
  );

  useEffect(() => {
    if (activePage !== "recipes") return;
    const c = readRecipeCache(recipeCacheKey);
    if (c?.recipes?.length) {
      setRecipes(c.recipes);
      setRecipesRaw(c.recipesRaw || "");
      setRecipesTried(true);
    }
  }, [activePage, recipeCacheKey]);

  const lastNotifyKeyRef = useRef("");

  useEffect(() => {
    if (!prefs.reminderEnabled || typeof window === "undefined" || !("Notification" in window)) return;
    const tick = () => {
      if (Notification.permission !== "granted") return;
      const h = new Date().getHours();
      const target = prefs.reminderHour ?? 12;
      if (h !== target) return;
      const key = `${todayISODate()}-${target}`;
      if (lastNotifyKeyRef.current === key) return;
      lastNotifyKeyRef.current = key;
      try {
        new Notification("Харчування", { body: "Час записати прийоми їжі." });
      } catch {
        /* ignore */
      }
    };
    const id = window.setInterval(tick, 45_000);
    tick();
    return () => window.clearInterval(id);
  }, [prefs.reminderEnabled, prefs.reminderHour]);

  const handleSaveToLog = () => {
    log.setAddMealPhotoResult(photo.photoResult);
    log.setAddMealSheetOpen(true);
  };

  const recommendRecipes = async () => {
    setBusy(true);
    setErr("");
    setRecipes([]);
    setRecipesRaw("");
    setRecipesTried(true);
    setStatusText("Генерую рецепти…");
    try {
      const items = pantry.effectiveItems;
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
      const list = Array.isArray(data?.recipes) ? data.recipes : [];
      const raw = typeof data?.rawText === "string" ? data.rawText : "";
      setRecipes(list);
      setRecipesRaw(raw);
      writeRecipeCache(recipeCacheKey, { recipes: list, recipesRaw: raw });
    } catch (e) {
      setErr(e?.message || "Помилка рекомендацій");
    } finally {
      setStatusText("");
      setBusy(false);
    }
  };

  const fetchWeekPlan = async () => {
    setWeekPlanBusy(true);
    setErr("");
    setWeekPlan(null);
    setWeekPlanRaw("");
    try {
      const items = pantry.effectiveItems;
      if (items.length === 0) throw new Error("Додай продукти на склад.");
      const data = await postJson("/api/nutrition/week-plan", {
        items: items.slice(0, 50),
        preferences: { goal: prefs.goal },
        locale: "uk-UA",
      });
      setWeekPlan(data?.plan || null);
      setWeekPlanRaw(typeof data?.rawText === "string" ? data.rawText : "");
    } catch (e) {
      setErr(e?.message || "Помилка плану");
    } finally {
      setWeekPlanBusy(false);
    }
  };

  const fetchDayHint = useCallback(async () => {
    setDayHintBusy(true);
    setErr("");
    try {
      const macros = getDayMacros(log.nutritionLog, log.selectedDate);
      const data = await postJson("/api/nutrition/day-hint", {
        macros,
        targets: {
          dailyTargetKcal: prefs.dailyTargetKcal,
          dailyTargetProtein_g: prefs.dailyTargetProtein_g,
          dailyTargetFat_g: prefs.dailyTargetFat_g,
          dailyTargetCarbs_g: prefs.dailyTargetCarbs_g,
        },
        locale: "uk-UA",
      });
      setDayHintText(typeof data?.hint === "string" ? data.hint : "");
    } catch (e) {
      setErr(e?.message || "Помилка підказки");
    } finally {
      setDayHintBusy(false);
    }
  }, [log.nutritionLog, log.selectedDate, prefs]);

  const recipeCacheEntry = useMemo(() => readRecipeCache(recipeCacheKey), [recipeCacheKey]);

  const wrappedAddMeal = useCallback(
    async (meal) => {
      log.handleAddMeal(meal);
      if (meal.source === "photo" && photo.fileRef?.current?.files?.[0]) {
        const blob = await fileToThumbnailBlob(photo.fileRef.current.files[0]);
        if (blob) await saveMealThumbnail(meal.id, blob);
      }
    },
    [log, photo.fileRef],
  );

  const storageBanner = [log.storageErr, pantry.pantryStorageErr, prefsStorageErr]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="h-dvh flex flex-col bg-bg text-text overflow-hidden">
      <NutritionHeader busy={busy} onBackToHub={onBackToHub} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-6 w-full">
          <div className="rounded-2xl bg-nutrition/10 border border-nutrition/20 px-4 py-3 mb-4 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-nutrition/70 uppercase tracking-widest mb-0.5">
                Активний склад
              </div>
              <div className="text-base font-extrabold text-text leading-tight">
                {pantry.activePantry?.name || "Склад"}
              </div>
              <div className="text-xs text-subtle mt-0.5">
                {pantry.pantryItems.length > 0
                  ? `${pantry.pantryItems.length} продуктів збережено`
                  : "Склад порожній"}
              </div>
            </div>
            {(Array.isArray(pantry.pantries) ? pantry.pantries : []).length > 1 && (
              <select
                value={pantry.activePantry?.id || pantry.activePantryId || ""}
                onChange={(e) => pantry.setActivePantryId(e.target.value)}
                disabled={busy}
                className="h-9 rounded-xl bg-panel/60 border border-nutrition/30 px-3 text-sm text-text outline-none focus:border-nutrition/60 max-w-[36vw]"
                aria-label="Обрати склад"
              >
                {(Array.isArray(pantry.pantries) ? pantry.pantries : []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || "Склад"}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => pantry.setPantryManagerOpen(true)}
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

          {statusText && (
            <div className="mb-4 rounded-2xl border border-nutrition/35 bg-nutrition/10 px-4 py-3 text-sm text-text">
              {statusText}
            </div>
          )}
          {err && (
            <div className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {err}
            </div>
          )}
          {storageBanner && (
            <div className="mb-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {storageBanner}
            </div>
          )}

          <div className="grid gap-4">
            <PhotoAnalyzeCard
              busy={busy}
              analyzePhoto={photo.analyzePhoto}
              fileRef={photo.fileRef}
              onPickPhoto={photo.onPickPhoto}
              photoPreviewUrl={photo.photoPreviewUrl}
              photoResult={photo.photoResult}
              fmtMacro={fmtMacro}
              portionGrams={photo.portionGrams}
              setPortionGrams={photo.setPortionGrams}
              refinePhoto={photo.refinePhoto}
              answers={photo.answers}
              setAnswers={photo.setAnswers}
              onSaveToLog={photo.photoResult ? handleSaveToLog : undefined}
            />

            {activePage === "products" && (
              <PantryCard
                busy={busy}
                activePantry={pantry.activePantry}
                parsePantry={pantry.parsePantry}
                applyTemplate={pantry.applyTemplate}
                newItemName={pantry.newItemName}
                setNewItemName={pantry.setNewItemName}
                upsertItem={pantry.upsertItem}
                pantryText={pantry.pantryText}
                setPantryText={pantry.setPantryText}
                effectiveItems={pantry.effectiveItems}
                editItemAt={pantry.editItemAt}
                removeItemAtOrByName={(idx, name) =>
                  pantry.pantryItems.length > 0 ? pantry.removeItemAt(idx) : pantry.removeItem(name)
                }
                pantryItemsLength={pantry.pantryItems.length}
                pantrySummary={pantry.pantrySummary}
              />
            )}

            {activePage === "log" && (
              <LogCard
                log={log.nutritionLog}
                selectedDate={log.selectedDate}
                setSelectedDate={log.setSelectedDate}
                onAddMeal={() => {
                  log.setAddMealPhotoResult(null);
                  log.setAddMealSheetOpen(true);
                }}
                onRemoveMeal={log.handleRemoveMeal}
                prefs={prefs}
                setPrefs={setPrefs}
                onDuplicateYesterday={log.duplicateYesterday}
                onImportMerge={log.mergeLogFromJsonText}
                onImportReplace={log.replaceLogFromJsonText}
                onTrimLog={log.trimLogToLastDays}
                onFetchDayHint={fetchDayHint}
                dayHintText={dayHintText}
                dayHintBusy={dayHintBusy}
              />
            )}

            {activePage === "recipes" && (
              <RecipesCard
                busy={busy}
                activePantry={pantry.activePantry}
                prefs={prefs}
                setPrefs={setPrefs}
                recommendRecipes={recommendRecipes}
                recipes={recipes}
                recipesTried={recipesTried}
                recipesRaw={recipesRaw}
                err={err}
                fmtMacro={fmtMacro}
                recipeCacheEntry={recipeCacheEntry}
                weekPlan={weekPlan}
                weekPlanRaw={weekPlanRaw}
                weekPlanBusy={weekPlanBusy}
                fetchWeekPlan={fetchWeekPlan}
              />
            )}
          </div>
        </div>
      </div>

      <NutritionBottomNav activePage={activePage} setActivePage={setActivePageAndHash} />

      <PantryManagerSheet
        open={pantry.pantryManagerOpen}
        onClose={() => pantry.setPantryManagerOpen(false)}
        pantries={pantry.pantries}
        activePantryId={pantry.activePantryId}
        setActivePantryId={pantry.setActivePantryId}
        pantryForm={pantry.pantryForm}
        setPantryForm={pantry.setPantryForm}
        busy={busy}
        onSavePantryForm={pantry.onSavePantryForm}
        onBeginCreate={pantry.beginCreatePantry}
        onBeginRename={pantry.beginRenamePantry}
        onBeginDelete={pantry.beginDeletePantry}
      />

      <ConfirmDeleteSheet
        open={pantry.confirmDeleteOpen}
        onClose={() => pantry.setConfirmDeleteOpen(false)}
        pantries={pantry.pantries}
        activePantryId={pantry.activePantryId}
        onConfirm={pantry.onConfirmDeletePantry}
      />

      <ItemEditSheet
        itemEdit={pantry.itemEdit}
        setItemEdit={pantry.setItemEdit}
        onClose={() => pantry.setItemEdit((s) => ({ ...s, open: false }))}
        onSave={pantry.onSaveItemEdit}
      />

      <AddMealSheet
        open={log.addMealSheetOpen}
        onClose={() => {
          log.setAddMealSheetOpen(false);
          log.setAddMealPhotoResult(null);
        }}
        onSave={wrappedAddMeal}
        photoResult={log.addMealPhotoResult}
        mealTemplates={prefs.mealTemplates || []}
        setPrefs={setPrefs}
      />
    </div>
  );
}
