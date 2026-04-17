import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { postJson } from "./lib/nutritionApi.js";
import { NutritionHeader } from "./components/NutritionHeader.jsx";
import { NutritionBottomNav } from "./components/NutritionBottomNav.jsx";
import { PhotoAnalyzeCard } from "./components/PhotoAnalyzeCard.jsx";
import { NutritionDashboard } from "./components/NutritionDashboard.jsx";
import { PantryCard } from "./components/PantryCard.jsx";
import { RecipesCard } from "./components/RecipesCard.jsx";
import { DailyPlanCard } from "./components/DailyPlanCard.jsx";
import { ShoppingListCard } from "./components/ShoppingListCard.jsx";
import { LogCard } from "./components/LogCard.jsx";
import { AddMealSheet } from "./components/AddMealSheet.jsx";
import { PantryManagerSheet } from "./components/PantryManagerSheet.jsx";
import { ConfirmDeleteSheet } from "./components/ConfirmDeleteSheet.jsx";
import { ItemEditSheet } from "./components/ItemEditSheet.jsx";
import { Banner } from "@shared/components/ui/Banner.jsx";
import {
  loadNutritionPrefs,
  persistNutritionPrefs,
  getDayMacros,
  getDaySummary,
  toLocalISODate,
} from "./lib/nutritionStorage.js";
import { useNutritionPantries } from "./hooks/useNutritionPantries.js";
import { useNutritionLog } from "./hooks/useNutritionLog.js";
import { usePhotoAnalysis } from "./hooks/usePhotoAnalysis.js";
import { useShoppingList } from "./hooks/useShoppingList.js";
import { useNutritionUiState } from "./hooks/useNutritionUiState.js";
import {
  buildRecipeCacheKey,
  readRecipeCache,
  writeRecipeCache,
} from "./lib/recipeCache.js";
import { stableRecipeId } from "./lib/recipeIds.js";
import {
  fileToThumbnailBlob,
  saveMealThumbnail,
} from "./lib/mealPhotoStorage.js";
import {
  applyNutritionBackupPayload,
  buildNutritionBackupPayload,
} from "./domain/nutritionBackup.js";
import {
  decryptBlobToJson,
  encryptJsonToBlob,
} from "./lib/nutritionCloudBackup.js";
import { useToast } from "@shared/hooks/useToast";
import { InputDialog } from "@shared/components/ui/InputDialog";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import { BarcodeScanner } from "./components/BarcodeScanner.jsx";
import { apiUrl } from "@shared/lib/apiUrl.js";
import { parseNutritionHash, setNutritionHash } from "./lib/nutritionRouter.js";

function fmtMacro(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Math.round(Number(n));
}

function todayISODate() {
  return toLocalISODate(new Date());
}

export default function NutritionApp({ onBackToHub, pwaAction, onPwaActionConsumed } = {}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [statusText, setStatusText] = useState("");

  const [activePage, setActivePage] = useState(() => parseNutritionHash().page);

  useEffect(() => {
    const onHash = () => {
      const p = parseNutritionHash();
      setActivePage(p.page);
      if (p.redirectFrom === "products") setNutritionHash("pantry");
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const setActivePageAndHash = (page) => {
    setActivePage(page);
    setNutritionHash(page);
  };

  const pantry = useNutritionPantries({ setBusy, setErr, setStatusText });
  const log = useNutritionLog();
  const ui = useNutritionUiState();
  const photo = usePhotoAnalysis({ setBusy, setErr, setStatusText });
  const shopping = useShoppingList();

  useEffect(() => {
    if (pwaAction === "add_meal") {
      setActivePageAndHash("log");
      log.setAddMealSheetOpen(true);
      onPwaActionConsumed?.();
    }
  }, []);  

  const [prefs, setPrefs] = useState(() => loadNutritionPrefs());
  const [prefsStorageErr, setPrefsStorageErr] = useState("");

  useEffect(() => {
    setPrefsStorageErr(
      persistNutritionPrefs(prefs) ? "" : "Не вдалося зберегти налаштування.",
    );
  }, [prefs]);

  const {
    editingMeal,
    setEditingMeal,
    recipes,
    setRecipes,
    recipesTried,
    setRecipesTried,
    recipesRaw,
    setRecipesRaw,
    weekPlan,
    setWeekPlan,
    weekPlanRaw,
    setWeekPlanRaw,
    weekPlanBusy,
    setWeekPlanBusy,
    dayPlan,
    setDayPlan,
    dayPlanBusy,
    setDayPlanBusy,
    shoppingBusy,
    setShoppingBusy,
    dayHintText,
    setDayHintText,
    dayHintBusy,
    setDayHintBusy,
    cloudBackupBusy,
    setCloudBackupBusy,
    backupPasswordDialog,
    setBackupPasswordDialog,
    restoreConfirm,
    setRestoreConfirm,
    pantryScannerOpen,
    setPantryScannerOpen,
    pantryScanStatus,
    setPantryScanStatus,
  } = ui;

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
      setRecipes(
        c.recipes.map((r) => ({
          ...r,
          id: r?.id ? String(r.id) : stableRecipeId(r),
        })),
      );
      setRecipesRaw(c.recipesRaw || "");
      setRecipesTried(true);
    }
  }, [activePage, recipeCacheKey]);

  const lastNotifyKeyRef = useRef("");

  useEffect(() => {
    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "NUTRITION_STATE_UPDATE",
          data: { reminderEnabled: prefs.reminderEnabled, reminderHour: prefs.reminderHour ?? 12 },
        });
      }
    } catch {}
  }, [prefs.reminderEnabled, prefs.reminderHour]);

  useEffect(() => {
    if (
      !prefs.reminderEnabled ||
      typeof window === "undefined" ||
      !("Notification" in window)
    )
      return;
    const tick = () => {
      if (Notification.permission !== "granted") return;
      const h = new Date().getHours();
      const target = prefs.reminderHour ?? 12;
      if (h !== target) return;
      const key = `${todayISODate()}-${target}`;
      if (lastNotifyKeyRef.current === key) return;
      lastNotifyKeyRef.current = key;
      try {
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification("🥗 Харчування", {
              body: "Час записати прийоми їжі.",
              tag: `nutrition-reminder-${key}`,
              icon: "/icon-192.png",
              badge: "/icon-192.png",
              requireInteraction: false,
              data: { action: "open", module: "nutrition" },
            });
          }).catch(() => {
            new Notification("🥗 Харчування", { body: "Час записати прийоми їжі." });
          });
        } else {
          new Notification("🥗 Харчування", { body: "Час записати прийоми їжі." });
        }
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

  const handlePantryBarcodeDetected = useCallback(
    async (raw) => {
      setPantryScannerOpen(false);
      setPantryScanStatus("Шукаю продукт\u2026");
      const code = String(raw || "").trim().replace(/\D/g, "");
      if (!code) {
        setPantryScanStatus("Некоректний штрих-код.");
        return;
      }
      if (!navigator.onLine) {
        setPantryScanStatus("Немає підключення до інтернету.");
        return;
      }
      try {
        const res = await fetch(apiUrl(`/api/barcode?barcode=${encodeURIComponent(code)}`));
        if (res.status === 404) {
          setPantryScanStatus("Продукт не знайдено в базі. Додай вручну.");
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setPantryScanStatus(err?.error || "Помилка пошуку.");
          return;
        }
        const data = await res.json();
        const p = data?.product;
        if (!p?.name) {
          setPantryScanStatus("Продукт знайдено, але назва відсутня. Додай вручну.");
          return;
        }
        const label = [p.name, p.brand].filter(Boolean).join(" ").trim();
        pantry.upsertItem(label);
        if (p.partial) {
          setPantryScanStatus(`Знайдено: ${label}. КБЖВ відсутнє в базі — за потреби додай вручну. \u2714`);
        } else {
          setPantryScanStatus(`Додано: ${label} \u2714`);
        }
        setTimeout(() => setPantryScanStatus(""), 4000);
      } catch {
        setPantryScanStatus("Помилка пошуку. Перевір з\u2019єднання.");
      }
    },
    [pantry],
  );

  const recommendRecipes = async () => {
    setBusy(true);
    setErr("");
    setRecipes([]);
    setRecipesRaw("");
    setRecipesTried(true);
    setStatusText("Генерую рецепти…");
    try {
      const items = pantry.effectiveItems;
      if (items.length === 0)
        throw new Error("Дай хоча б 2–3 продукти для рецептів.");
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
      const list = Array.isArray(data?.recipes)
        ? data.recipes.map((r) => ({
            ...r,
            id: r?.id ? String(r.id) : stableRecipeId(r),
          }))
        : [];
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
      const summary = getDaySummary(log.nutritionLog, log.selectedDate);
      if (!summary.hasMeals) {
        setDayHintText("День порожній. Додай прийом їжі — і я зможу дати підказку.");
        return;
      }
      const meals = log.nutritionLog?.[log.selectedDate]?.meals || [];
      const macroSources = meals.reduce((acc, m) => {
        const k = String(m?.macroSource || (m?.source === "photo" ? "photoAI" : "manual"));
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      const macros = summary.hasAnyMacros
        ? getDayMacros(log.nutritionLog, log.selectedDate)
        : { kcal: null, protein_g: null, fat_g: null, carbs_g: null };
      const data = await postJson("/api/nutrition/day-hint", {
        macros,
        hasMeals: summary.hasMeals,
        hasAnyMacros: summary.hasAnyMacros,
        macroSources,
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

  const fetchDayPlan = useCallback(
    async (regenerateMealType) => {
      setDayPlanBusy(true);
      setErr("");
      try {
        const data = await postJson("/api/nutrition/day-plan", {
          items: pantry.effectiveItems.slice(0, 50),
          targets: {
            kcal: prefs.dailyTargetKcal,
            protein_g: prefs.dailyTargetProtein_g,
            fat_g: prefs.dailyTargetFat_g,
            carbs_g: prefs.dailyTargetCarbs_g,
          },
          regenerateMealType: regenerateMealType || null,
          locale: "uk-UA",
        });
        const plan = data?.plan;
        if (!plan) throw new Error("Не вдалося отримати план харчування");
        if (regenerateMealType && dayPlan?.meals?.length > 0) {
          const newMeals = Array.isArray(plan.meals) ? plan.meals : [];
          const merged = [
            ...dayPlan.meals.filter((m) => m.type !== regenerateMealType),
            ...newMeals.filter((m) => m.type === regenerateMealType),
          ];
          const totals = merged.reduce(
            (acc, m) => ({
              totalKcal: (acc.totalKcal ?? 0) + (m.kcal ?? 0),
              totalProtein_g: (acc.totalProtein_g ?? 0) + (m.protein_g ?? 0),
              totalFat_g: (acc.totalFat_g ?? 0) + (m.fat_g ?? 0),
              totalCarbs_g: (acc.totalCarbs_g ?? 0) + (m.carbs_g ?? 0),
            }),
            {}
          );
          setDayPlan({ ...dayPlan, meals: merged, ...totals });
        } else {
          setDayPlan(plan);
        }
      } catch (e) {
        setErr(e?.message || "Помилка генерації плану");
      } finally {
        setDayPlanBusy(false);
      }
    },
    [pantry.effectiveItems, prefs, dayPlan]
  );

  const addMealFromPlan = useCallback(
    (meal) => {
      const id = `meal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const typeLabels = {
        breakfast: "Сніданок",
        lunch: "Обід",
        dinner: "Вечеря",
        snack: "Перекус",
      };
      log.handleAddMeal({
        id,
        time: `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`,
        mealType: meal.type || "snack",
        label: typeLabels[meal.type] || "Прийом їжі",
        name: meal.name || "Страва",
        macros: {
          kcal: meal.kcal ?? null,
          protein_g: meal.protein_g ?? null,
          fat_g: meal.fat_g ?? null,
          carbs_g: meal.carbs_g ?? null,
        },
        source: "manual",
        macroSource: "recipeAI",
      });
    },
    [log]
  );

  const generateShoppingList = useCallback(
    async (source) => {
      setShoppingBusy(true);
      setErr("");
      try {
        const body = {
          pantryItems: pantry.effectiveItems.slice(0, 50),
          locale: "uk-UA",
        };
        if (source === "weekplan" && weekPlan?.days?.length > 0) {
          body.weekPlan = weekPlan;
        } else if (recipes.length > 0) {
          body.recipes = recipes;
        } else {
          throw new Error("Немає рецептів чи тижневого плану для генерації.");
        }
        const data = await postJson("/api/nutrition/shopping-list", body);
        if (!Array.isArray(data?.categories))
          throw new Error("Не вдалося згенерувати список покупок.");
        shopping.setGeneratedList(data.categories);
      } catch (e) {
        setErr(e?.message || "Помилка генерації списку покупок");
      } finally {
        setShoppingBusy(false);
      }
    },
    [pantry.effectiveItems, recipes, weekPlan, shopping]
  );

  const addCheckedItemsToPantry = useCallback(() => {
    for (const item of shopping.checkedItems) {
      pantry.upsertItem(item.name);
    }
    shopping.clearChecked();
  }, [shopping, pantry]);

  const uploadCloudBackup = useCallback(() => {
    if (cloudBackupBusy) return;
    setBackupPasswordDialog({
      mode: "upload",
      title: "Пароль для шифрування",
      description: "Введіть пароль для шифрування бекапу (запам'ятайте його):",
    });
  }, [cloudBackupBusy]);

  const handleBackupPasswordConfirm = useCallback(
    async (pass) => {
      const mode = backupPasswordDialog?.mode;
      setBackupPasswordDialog(null);
      if (!pass) return;
      if (mode === "upload") {
        try {
          setCloudBackupBusy(true);
          setErr("");
          const payload = buildNutritionBackupPayload();
          const blob = await encryptJsonToBlob(payload, pass);
          await postJson("/api/nutrition/backup-upload", { blob });
          toast.success("Бекап завантажено.");
        } catch (e) {
          setErr(e?.message || "Не вдалося завантажити бекап");
        } finally {
          setCloudBackupBusy(false);
        }
      } else if (mode === "download") {
        try {
          setCloudBackupBusy(true);
          setErr("");
          const data = await postJson("/api/nutrition/backup-download", {});
          const payload = await decryptBlobToJson(data?.blob, pass);
          setRestoreConfirm({ payload });
        } catch (e) {
          setErr(e?.message || "Не вдалося відновити бекап");
        } finally {
          setCloudBackupBusy(false);
        }
      }
    },
    [backupPasswordDialog, toast],
  );

  const downloadCloudBackup = useCallback(() => {
    if (cloudBackupBusy) return;
    setBackupPasswordDialog({
      mode: "download",
      title: "Пароль для розшифрування",
      description: "Введіть пароль для розшифрування бекапу:",
    });
  }, [cloudBackupBusy]);

  const recipeCacheEntry = useMemo(
    () => readRecipeCache(recipeCacheKey),
    [recipeCacheKey],
  );

  const wrappedSaveMeal = useCallback(
    async (meal) => {
      if (editingMeal?.id) {
        log.handleEditMeal(editingMeal.date, meal);
        setEditingMeal(null);
      } else {
        log.handleAddMeal(meal);
      }
      if (meal.source === "photo" && photo.fileRef?.current?.files?.[0]) {
        const blob = await fileToThumbnailBlob(photo.fileRef.current.files[0]);
        if (blob) await saveMealThumbnail(meal.id, blob);
      }
    },
    [log, photo.fileRef, editingMeal],
  );

  const storageBanner = [
    log.storageErr,
    pantry.pantryStorageErr,
    prefsStorageErr,
  ]
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
            {(Array.isArray(pantry.pantries) ? pantry.pantries : []).length >
              1 && (
              <select
                value={pantry.activePantry?.id || pantry.activePantryId || ""}
                onChange={(e) => pantry.setActivePantryId(e.target.value)}
                disabled={busy}
                className="h-9 rounded-xl bg-panel/60 border border-nutrition/30 px-3 text-sm text-text outline-none focus:border-nutrition/60 max-w-[36vw]"
                aria-label="Обрати склад"
              >
                {(Array.isArray(pantry.pantries) ? pantry.pantries : []).map(
                  (p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || "Склад"}
                    </option>
                  ),
                )}
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
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
          </div>

          {statusText && <Banner className="mb-4">{statusText}</Banner>}
          {err && (
            <Banner variant="danger" className="mb-4">
              {err}
            </Banner>
          )}
          {storageBanner && (
            <Banner variant="warning" className="mb-4">
              {storageBanner}
            </Banner>
          )}

          <div className="grid gap-4">
            {activePage === "start" && (
              <>
                <NutritionDashboard
                  log={log.nutritionLog}
                  prefs={prefs}
                  onGoToLog={() => setActivePageAndHash("log")}
                  onFetchDayHint={fetchDayHint}
                  dayHintText={dayHintText}
                  dayHintBusy={dayHintBusy}
                  onAddMeal={() => {
                    log.setSelectedDate(todayISODate());
                    setActivePageAndHash("log");
                    setTimeout(() => {
                      log.setAddMealPhotoResult(null);
                      log.setAddMealSheetOpen(true);
                    }, 80);
                  }}
                />
                <details className="group">
                  <summary className="flex items-center gap-2 cursor-pointer select-none py-2 px-1 text-sm font-semibold text-text">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-transform group-open:rotate-90"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    Аналіз фото страви
                  </summary>
                  <div className="pt-1">
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
                  </div>
                </details>
              </>
            )}

            {activePage === "pantry" && (
              <>
                <PantryCard
                  busy={busy}
                  parsePantry={pantry.parsePantry}
                  newItemName={pantry.newItemName}
                  setNewItemName={pantry.setNewItemName}
                  upsertItem={pantry.upsertItem}
                  pantryText={pantry.pantryText}
                  setPantryText={pantry.setPantryText}
                  effectiveItems={pantry.effectiveItems}
                  editItemAt={pantry.editItemAt}
                  removeItemAtOrByName={(idx, name) =>
                    pantry.pantryItems.length > 0
                      ? pantry.removeItemAt(idx)
                      : pantry.removeItem(name)
                  }
                  pantryItemsLength={pantry.pantryItems.length}
                  pantrySummary={pantry.pantrySummary}
                  onScanBarcode={() => {
                    setPantryScanStatus("");
                    setPantryScannerOpen(true);
                  }}
                />
                {pantryScanStatus && (
                  <div className="text-xs text-subtle px-1">{pantryScanStatus}</div>
                )}
              </>
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
                onAddMealFromSearch={(meal) => {
                  const id = `meal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                  log.handleAddMeal({ ...meal, id });
                }}
                onRemoveMeal={(date, meal) => {
                  if (!meal?.id) return;
                  log.handleRemoveMeal(date, meal);
                  toast.info("Запис видалено", 5000, {
                    label: "Undo",
                    onClick: () => log.handleRestoreMeal(date, meal),
                  });
                }}
                onEditMeal={(date, meal) => {
                  setEditingMeal({ date, ...meal });
                  log.setAddMealPhotoResult(null);
                  log.setAddMealSheetOpen(true);
                }}
                prefs={prefs}
                setPrefs={setPrefs}
                onDuplicateYesterday={log.duplicateYesterday}
                onImportMerge={log.mergeLogFromJsonText}
                onImportReplace={log.replaceLogFromJsonText}
                onTrimLog={log.trimLogToLastDays}
                onFetchDayHint={fetchDayHint}
                dayHintText={dayHintText}
                dayHintBusy={dayHintBusy}
                onCloudBackupUpload={uploadCloudBackup}
                onCloudBackupDownload={downloadCloudBackup}
                cloudBackupBusy={cloudBackupBusy}
              />
            )}

            {activePage === "plan" && (
              <DailyPlanCard
                prefs={prefs}
                setPrefs={setPrefs}
                pantryItems={pantry.effectiveItems}
                busy={busy}
                dayPlan={dayPlan}
                dayPlanBusy={dayPlanBusy}
                fetchDayPlan={() => fetchDayPlan(null)}
                regenMeal={(mealType) => fetchDayPlan(mealType)}
                addMealToLog={addMealFromPlan}
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
                addMealToLog={wrappedSaveMeal}
              />
            )}

            {activePage === "shop" && (
              <ShoppingListCard
                recipes={recipes}
                weekPlan={weekPlan}
                pantryItems={pantry.effectiveItems}
                shoppingList={shopping.shoppingList}
                shoppingBusy={shoppingBusy}
                onGenerate={generateShoppingList}
                onToggleItem={shopping.toggle}
                onClearChecked={shopping.clearChecked}
                onClearAll={shopping.clearAll}
                onAddCheckedToPantry={addCheckedItemsToPantry}
                checkedItems={shopping.checkedItems}
              />
            )}
          </div>
        </div>
      </div>

      <NutritionBottomNav
        activePage={activePage}
        setActivePage={setActivePageAndHash}
      />

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

      {pantryScannerOpen && (
        <div className="fixed inset-0 z-[120]">
          <BarcodeScanner
            onDetected={handlePantryBarcodeDetected}
            onClose={() => setPantryScannerOpen(false)}
          />
        </div>
      )}

      <AddMealSheet
        open={log.addMealSheetOpen}
        onClose={() => {
          log.setAddMealSheetOpen(false);
          log.setAddMealPhotoResult(null);
          setEditingMeal(null);
        }}
        onSave={wrappedSaveMeal}
        photoResult={log.addMealPhotoResult}
        initialMeal={editingMeal}
        mealTemplates={prefs.mealTemplates || []}
        setPrefs={setPrefs}
        pantryItems={pantry.effectiveItems}
        onConsumePantryItem={pantry.consumePantryItem}
      />

      <InputDialog
        open={!!backupPasswordDialog}
        title={backupPasswordDialog?.title || ""}
        description={backupPasswordDialog?.description || ""}
        type="password"
        placeholder="Пароль"
        onConfirm={handleBackupPasswordConfirm}
        onCancel={() => setBackupPasswordDialog(null)}
      />

      <ConfirmDialog
        open={!!restoreConfirm}
        title="Відновити бекап?"
        description="Це перезапише поточні дані харчування на цьому пристрої."
        confirmLabel="Відновити"
        danger
        onConfirm={() => {
          if (restoreConfirm?.payload) {
            applyNutritionBackupPayload(restoreConfirm.payload);
            window.location.reload();
          }
          setRestoreConfirm(null);
        }}
        onCancel={() => setRestoreConfirm(null)}
      />
    </div>
  );
}
