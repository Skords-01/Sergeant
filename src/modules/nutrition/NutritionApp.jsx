import { useCallback, useEffect, useMemo, useState } from "react";
import { NutritionHeader } from "./components/NutritionHeader.jsx";
import { NutritionBottomNav } from "./components/NutritionBottomNav.jsx";
import { SubTabs } from "./components/SubTabs.jsx";
import { PhotoAnalyzeCard } from "./components/PhotoAnalyzeCard.jsx";
import { NutritionDashboard } from "./components/NutritionDashboard.jsx";
import { PantryCard } from "./components/PantryCard.jsx";
import { RecipesCard } from "./components/RecipesCard.jsx";
import { DailyPlanCard } from "./components/DailyPlanCard.jsx";
import { ShoppingListCard } from "./components/ShoppingListCard.jsx";
import { LogCard } from "./components/LogCard.jsx";
import { NutritionPantrySelector } from "./components/NutritionPantrySelector.jsx";
import { NutritionOverlays } from "./components/NutritionOverlays.jsx";
import { Banner } from "@shared/components/ui/Banner.jsx";
import { Icon } from "@shared/components/ui/Icon";
import {
  loadNutritionPrefs,
  persistNutritionPrefs,
} from "./lib/nutritionStorage.js";
import { useNutritionPantries } from "./hooks/useNutritionPantries.js";
import { useNutritionLog } from "./hooks/useNutritionLog.js";
import { usePhotoAnalysis } from "./hooks/usePhotoAnalysis.js";
import { useShoppingList } from "./hooks/useShoppingList.js";
import { useNutritionUiState } from "./hooks/useNutritionUiState.js";
import { useNutritionHashRoute } from "./hooks/useNutritionHashRoute.js";
import { useNutritionReminders } from "./hooks/useNutritionReminders.js";
import { usePantryBarcodeScan } from "./hooks/usePantryBarcodeScan.js";
import { useNutritionCloudBackup } from "./hooks/useNutritionCloudBackup.js";
import { useNutritionRemoteActions } from "./hooks/useNutritionRemoteActions.js";
import { buildRecipeCacheKey, readRecipeCache } from "./lib/recipeCache.js";
import { stableRecipeId } from "./lib/recipeIds.js";
import {
  fileToThumbnailBlob,
  saveMealThumbnail,
} from "./lib/mealPhotoStorage.js";
import { useToast } from "@shared/hooks/useToast";
import { showUndoToast } from "@shared/lib/undoToast";
import { fmtMacro, todayISODate } from "./lib/nutritionFormat.js";

export default function NutritionApp({
  onBackToHub,
  pwaAction,
  onPwaActionConsumed,
} = {}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [statusText, setStatusText] = useState("");

  const { activePage, setActivePageAndHash } = useNutritionHashRoute();

  // Sub-tab state for merged pages (pantry = Склад + Покупки,
  // menu = План + Рецепти). Lives in component state because deep-linking
  // into sub-tabs wasn't part of the old router either.
  const [pantrySubTab, setPantrySubTab] = useState("items");
  const [menuSubTab, setMenuSubTab] = useState("plan");

  const pantry = useNutritionPantries({ setBusy, setErr, setStatusText });
  const log = useNutritionLog();
  const ui = useNutritionUiState();
  const photo = usePhotoAnalysis({ setBusy, setErr, setStatusText });
  const shopping = useShoppingList();

  // When the photo-first FTUX CTA lands us here (#S0.3), we force the
  // "Аналіз фото страви" disclosure open and pop the native file picker
  // on the next frame — no extra "Звідки страва?" detour.
  const [photoCardForceOpen, setPhotoCardForceOpen] = useState(false);

  useEffect(() => {
    if (pwaAction === "add_meal") {
      setActivePageAndHash("log");
      log.setAddMealSheetOpen(true);
      onPwaActionConsumed?.();
      return;
    }
    if (pwaAction === "add_meal_photo") {
      setActivePageAndHash("start");
      setPhotoCardForceOpen(true);
      // Defer the file-picker click until after the disclosure has
      // rendered the `<input ref={fileRef}>`. requestAnimationFrame is
      // enough on desktop; the 80ms fallback covers mobile browsers
      // that stall the first frame behind route transitions.
      const raf = requestAnimationFrame(() => {
        try {
          photo.fileRef.current?.click();
        } catch {
          /* noop — picker may be blocked without a user gesture */
        }
      });
      const fallback = window.setTimeout(() => {
        try {
          photo.fileRef.current?.click();
        } catch {
          /* noop */
        }
      }, 80);
      onPwaActionConsumed?.();
      return () => {
        cancelAnimationFrame(raf);
        window.clearTimeout(fallback);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, onPwaActionConsumed, pwaAction]);

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
    // Recipes moved to a sub-tab inside the "menu" page (#8). Only read
    // the cache when the menu page is actually showing the recipes tab.
    if (activePage !== "menu" || menuSubTab !== "recipes") return;
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
  }, [
    activePage,
    menuSubTab,
    recipeCacheKey,
    setRecipes,
    setRecipesRaw,
    setRecipesTried,
  ]);

  useNutritionReminders(prefs);

  const handleSaveToLog = () => {
    log.setAddMealPhotoResult(photo.photoResult);
    log.setAddMealSheetOpen(true);
  };

  // Requested from inside AddMealSheet's source-step (S13). Close the
  // sheet, route to the Start page where PhotoAnalyzeCard lives, force
  // the disclosure open and pop the native file picker — mirrors the
  // `add_meal_photo` PWA shortcut so there's a single path for "дати
  // фото" regardless of where the user starts.
  const handleRequestMealPhoto = () => {
    log.setAddMealSheetOpen(false);
    log.setAddMealPhotoResult(null);
    setEditingMeal(null);
    setActivePageAndHash("start");
    setPhotoCardForceOpen(true);
    const raf = requestAnimationFrame(() => {
      try {
        photo.fileRef.current?.click();
      } catch {
        /* noop — picker may be blocked without a user gesture */
      }
    });
    window.setTimeout(() => {
      cancelAnimationFrame(raf);
      try {
        photo.fileRef.current?.click();
      } catch {
        /* noop */
      }
    }, 80);
  };

  const handlePantryBarcodeDetected = usePantryBarcodeScan({
    pantry,
    setPantryScannerOpen,
    setPantryScanStatus,
  });

  const {
    recommendRecipes,
    fetchWeekPlan,
    fetchDayHint,
    fetchDayPlan,
    addMealFromPlan,
    generateShoppingList,
  } = useNutritionRemoteActions({
    setBusy,
    setErr,
    setStatusText,
    pantry,
    prefs,
    recipes,
    setRecipes,
    setRecipesRaw,
    setRecipesTried,
    recipeCacheKey,
    weekPlan,
    setWeekPlan,
    setWeekPlanRaw,
    setWeekPlanBusy,
    setDayPlan,
    setDayPlanBusy,
    setDayHintBusy,
    setDayHintText,
    log,
    shopping,
    setShoppingBusy,
  });

  const addCheckedItemsToPantry = useCallback(() => {
    for (const item of shopping.checkedItems) {
      pantry.upsertItem(item.name);
    }
    shopping.clearChecked();
  }, [shopping, pantry]);

  const {
    uploadCloudBackup,
    downloadCloudBackup,
    handleBackupPasswordConfirm,
    applyRestorePayload,
  } = useNutritionCloudBackup({
    toast,
    setErr,
    cloudBackupBusy,
    setCloudBackupBusy,
    backupPasswordDialog,
    setBackupPasswordDialog,
    setRestoreConfirm,
  });

  const recipeCacheEntry = useMemo(
    () => readRecipeCache(recipeCacheKey),
    [recipeCacheKey],
  );

  const wrappedSaveMeal = useCallback(
    async (meal) => {
      const isEdit = !!editingMeal?.id;
      if (isEdit) {
        log.handleEditMeal(editingMeal.date, meal);
        setEditingMeal(null);
      } else {
        log.handleAddMeal(meal);
      }
      // Сигналимо успіх як у Finyk (витрати) / Routine (звички) — тост із
      // check-pop анімацією плюс haptic зроблено вже в `AddMealSheet`
      // на `handleSave`. Без цього користувач бачив лише те, що модалка
      // закрилась, — це не читалось як «збережено».
      toast.success(isEdit ? "Страву оновлено." : "Страву додано.");
      if (meal.source === "photo" && photo.fileRef?.current?.files?.[0]) {
        const blob = await fileToThumbnailBlob(photo.fileRef.current.files[0]);
        if (blob) await saveMealThumbnail(meal.id, blob);
      }
    },
    [editingMeal, log, photo.fileRef, setEditingMeal, toast],
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
          <NutritionPantrySelector pantry={pantry} busy={busy} />

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
                <details
                  className="group"
                  open={photoCardForceOpen || undefined}
                  onToggle={(e) => {
                    if (!e.currentTarget.open) setPhotoCardForceOpen(false);
                  }}
                >
                  <summary className="flex items-center gap-2 cursor-pointer select-none py-2 px-1 text-sm font-semibold text-text">
                    <Icon
                      name="chevron-right"
                      size={16}
                      className="transition-transform group-open:rotate-90"
                    />
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
                      onSaveToLog={
                        photo.photoResult ? handleSaveToLog : undefined
                      }
                    />
                  </div>
                </details>
              </>
            )}

            {activePage === "pantry" && (
              <>
                <SubTabs
                  value={pantrySubTab}
                  onChange={setPantrySubTab}
                  tabs={[
                    { id: "items", label: "Склад" },
                    { id: "shopping", label: "Покупки" },
                  ]}
                />
                {pantrySubTab === "items" ? (
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
                      <div className="text-xs text-subtle px-1">
                        {pantryScanStatus}
                      </div>
                    )}
                  </>
                ) : (
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
                  showUndoToast(toast, {
                    msg: "Запис видалено",
                    onUndo: () => log.handleRestoreMeal(date, meal),
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

            {activePage === "menu" && (
              <>
                <SubTabs
                  value={menuSubTab}
                  onChange={setMenuSubTab}
                  tabs={[
                    { id: "plan", label: "План на день" },
                    { id: "recipes", label: "Рецепти" },
                  ]}
                />
                {menuSubTab === "plan" ? (
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
                ) : (
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
              </>
            )}
          </div>
        </div>
      </div>

      <NutritionBottomNav
        activePage={activePage}
        setActivePage={setActivePageAndHash}
      />

      <NutritionOverlays
        pantry={pantry}
        log={log}
        busy={busy}
        pantryScannerOpen={pantryScannerOpen}
        setPantryScannerOpen={setPantryScannerOpen}
        handlePantryBarcodeDetected={handlePantryBarcodeDetected}
        editingMeal={editingMeal}
        setEditingMeal={setEditingMeal}
        wrappedSaveMeal={wrappedSaveMeal}
        prefs={prefs}
        setPrefs={setPrefs}
        backupPasswordDialog={backupPasswordDialog}
        setBackupPasswordDialog={setBackupPasswordDialog}
        handleBackupPasswordConfirm={handleBackupPasswordConfirm}
        restoreConfirm={restoreConfirm}
        setRestoreConfirm={setRestoreConfirm}
        applyRestorePayload={applyRestorePayload}
        onRequestMealPhoto={handleRequestMealPhoto}
      />
    </div>
  );
}
