import { useEffect, useRef, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { useVisualKeyboardInset } from "@shared/hooks/useVisualKeyboardInset";
import { MEAL_TYPES } from "../lib/mealTypes.js";
import { ensureSeedFoods } from "../lib/foodDb/foodDb.js";
import { BarcodeScanner } from "./BarcodeScanner.jsx";
import { currentTime, emptyForm } from "./meal-sheet/mealFormUtils.js";
import { MealTemplatesRow } from "./meal-sheet/MealTemplatesRow.jsx";
import { MealTypePicker } from "./meal-sheet/MealTypePicker.jsx";
import { NameTimeRow } from "./meal-sheet/NameTimeRow.jsx";
import { FromPantryRow } from "./meal-sheet/FromPantryRow.jsx";
import { FoodPickerSection } from "./meal-sheet/FoodPickerSection.jsx";
import { BarcodeSection } from "./meal-sheet/BarcodeSection.jsx";
import { MacrosEditor } from "./meal-sheet/MacrosEditor.jsx";
import { SaveAsFood } from "./meal-sheet/SaveAsFood.jsx";
import { SaveAsTemplate } from "./meal-sheet/SaveAsTemplate.jsx";
import { useFoodSearch } from "./meal-sheet/useFoodSearch.js";
import { useBarcodeLookup } from "./meal-sheet/useBarcodeLookup.js";

export function AddMealSheet({
  open,
  onClose,
  onSave,
  photoResult,
  initialMeal,
  mealTemplates = [],
  setPrefs,
  pantryItems = [],
  onConsumePantryItem,
}) {
  const ref = useRef(null);
  const kbInsetPx = useVisualKeyboardInset(open);
  const [form, setForm] = useState(() => emptyForm(null));
  const [foodQuery, setFoodQuery] = useState("");
  const [pickedFood, setPickedFood] = useState(null);
  const [pickedGrams, setPickedGrams] = useState("100");
  const [fromPantryItem, setFromPantryItem] = useState(null);
  // Two-step flow: "source" (pick a source — template / pantry / food
  // search / barcode / photo / manual) then "fill" (name, time, macros,
  // save). Editing an existing meal or a photo import skips straight to
  // "fill" since the source is already decided.
  const [step, setStep] = useState("source");

  const { foodHits, offHits, foodBusy, offBusy, foodErr, setFoodErr } =
    useFoodSearch(foodQuery);

  const {
    barcode,
    setBarcode,
    barcodeStatus,
    setBarcodeStatus,
    scannerOpen,
    setScannerOpen,
    handleBarcodeLookup,
    handleBarcodeBind,
  } = useBarcodeLookup({
    pickedFood,
    setPickedFood,
    setPickedGrams,
    setForm,
  });

  useDialogFocusTrap(open, ref, { onEscape: onClose });

  useEffect(() => {
    if (open) {
      if (initialMeal?.id) {
        const mac = initialMeal.macros || {};
        setForm({
          name: String(initialMeal.name || ""),
          mealType: initialMeal.mealType || "breakfast",
          time: initialMeal.time || currentTime(),
          kcal: mac.kcal != null ? String(Math.round(mac.kcal)) : "",
          protein_g:
            mac.protein_g != null ? String(Math.round(mac.protein_g)) : "",
          fat_g: mac.fat_g != null ? String(Math.round(mac.fat_g)) : "",
          carbs_g: mac.carbs_g != null ? String(Math.round(mac.carbs_g)) : "",
          err: "",
        });
      } else {
        setForm(emptyForm(photoResult));
      }
      setFoodQuery("");
      setPickedFood(null);
      setPickedGrams(
        initialMeal?.amount_g != null
          ? String(Math.round(Number(initialMeal.amount_g) || 100))
          : "100",
      );
      setFoodErr("");
      setBarcode("");
      setBarcodeStatus("");
      setScannerOpen(false);
      setFromPantryItem(null);
      // Jump directly to fill when we already have content to edit.
      setStep(initialMeal?.id || photoResult ? "fill" : "source");
      void ensureSeedFoods();
    }
  }, [
    open,
    photoResult,
    initialMeal,
    setBarcode,
    setBarcodeStatus,
    setFoodErr,
    setScannerOpen,
  ]);

  function field(key) {
    return (v) => setForm((s) => ({ ...s, [key]: v, err: "" }));
  }

  // Auto-advance to fill step whenever a source selection lands (linked
  // food from search/barcode or pantry item).
  useEffect(() => {
    if (step === "source" && (pickedFood || fromPantryItem)) {
      setStep("fill");
    }
  }, [pickedFood, fromPantryItem, step]);

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      setForm((s) => ({ ...s, err: "Введіть назву страви." }));
      return;
    }
    const kcal = form.kcal === "" ? null : Number(form.kcal);
    const protein_g = form.protein_g === "" ? null : Number(form.protein_g);
    const fat_g = form.fat_g === "" ? null : Number(form.fat_g);
    const carbs_g = form.carbs_g === "" ? null : Number(form.carbs_g);
    if (
      [kcal, protein_g, fat_g, carbs_g].some(
        (n) => n != null && (!Number.isFinite(n) || n < 0),
      )
    ) {
      setForm((s) => ({ ...s, err: "Некоректне значення КБЖВ." }));
      return;
    }
    if (fromPantryItem && onConsumePantryItem) {
      const grams = Number(pickedGrams) || 100;
      onConsumePantryItem(fromPantryItem, grams);
    }
    const mealLabel =
      MEAL_TYPES.find((m) => m.id === form.mealType)?.label || "Прийом їжі";
    const source = photoResult ? "photo" : "manual";
    // Пріоритет foodId: новий вибір з pickedFood → інакше зберігаємо foodId з оригінальної страви.
    // Раніше при простому редагуванні страви з продуктом зв'язок з foodDb втрачався, бо pickedFood
    // скидається в null при відкритті схита.
    const effectiveFoodId = pickedFood?.id ?? initialMeal?.foodId ?? null;
    const hasAmount = pickedFood || initialMeal?.amount_g != null;
    const macroSource = photoResult
      ? "photoAI"
      : pickedFood
        ? "productDb"
        : initialMeal?.foodId
          ? "productDb"
          : "manual";
    onSave({
      id:
        initialMeal?.id ||
        `meal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      time: form.time || currentTime(),
      mealType: form.mealType,
      label: mealLabel,
      name,
      macros: { kcal, protein_g, fat_g, carbs_g },
      source,
      macroSource,
      ...(effectiveFoodId ? { foodId: effectiveFoodId } : {}),
      ...(hasAmount ? { amount_g: Number(pickedGrams) || 100 } : {}),
    });
  }

  const hasPhotoMacros =
    photoResult?.macros &&
    Object.values(photoResult.macros).some((v) => v != null && v !== 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-end z-[120]">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Закрити"
        onClick={onClose}
      />
      {scannerOpen && (
        <BarcodeScanner
          onDetected={async (raw) => {
            setScannerOpen(false);
            setBarcode(String(raw));
            await handleBarcodeLookup(raw);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
      <div
        ref={ref}
        className="relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft max-h-[90dvh] overflow-y-auto"
        style={{ marginBottom: kbInsetPx }}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-meal-sheet-title"
      >
        <div className="flex justify-center pt-3 pb-1 sticky top-0 bg-panel z-10">
          <div className="w-10 h-1 bg-line rounded-full" aria-hidden />
        </div>

        <div className="px-5 pb-8 pt-2">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 min-w-0">
              {step === "fill" && !initialMeal?.id && !photoResult && (
                <button
                  type="button"
                  onClick={() => {
                    // Also clear any picked source, otherwise the
                    // auto-advance effect immediately pushes us back to
                    // "fill" as soon as we return to "source".
                    setPickedFood(null);
                    setFromPantryItem(null);
                    setStep("source");
                  }}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text transition-colors"
                  aria-label="Назад до вибору джерела"
                >
                  ←
                </button>
              )}
              <div
                id="add-meal-sheet-title"
                className="text-lg font-extrabold text-text truncate"
              >
                {step === "source" ? "Звідки страва?" : "Додати прийом їжі"}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
              aria-label="Закрити"
            >
              ✕
            </button>
          </div>

          {step === "source" ? (
            <>
              <p className="text-xs text-muted mb-3">
                Оберіть джерело — або заповніть вручну. Макроси, назву й час
                відредагуєте на наступному кроці.
              </p>

              {/* Templates / pantry rows disappear when empty so a
                  first-time user sees search + barcode as the whole step
                  (no half-broken UI). They come back automatically once
                  the user saves a template or stocks the pantry. */}
              {mealTemplates.length > 0 && (
                <MealTemplatesRow
                  mealTemplates={mealTemplates}
                  setForm={setForm}
                  onSelected={() => setStep("fill")}
                />
              )}

              {pantryItems.length > 0 && (
                <FromPantryRow
                  pantryItems={pantryItems}
                  fromPantryItem={fromPantryItem}
                  setFromPantryItem={setFromPantryItem}
                  setForm={setForm}
                  setFoodQuery={setFoodQuery}
                />
              )}

              <FoodPickerSection
                form={form}
                setForm={setForm}
                foodQuery={foodQuery}
                setFoodQuery={setFoodQuery}
                foodHits={foodHits}
                offHits={offHits}
                foodBusy={foodBusy}
                offBusy={offBusy}
                foodErr={foodErr}
                pickedFood={pickedFood}
                setPickedFood={setPickedFood}
                pickedGrams={pickedGrams}
                setPickedGrams={setPickedGrams}
              />

              <BarcodeSection
                barcode={barcode}
                setBarcode={setBarcode}
                barcodeStatus={barcodeStatus}
                setBarcodeStatus={setBarcodeStatus}
                handleBarcodeLookup={handleBarcodeLookup}
                handleBarcodeBind={handleBarcodeBind}
                setScannerOpen={setScannerOpen}
              />

              <div className="mt-5 flex items-center gap-3 text-xs text-muted uppercase tracking-wider">
                <span className="flex-1 h-px bg-line" />
                або
                <span className="flex-1 h-px bg-line" />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="mt-3 w-full h-12 min-h-[44px]"
                onClick={() => setStep("fill")}
              >
                Ввести вручну
              </Button>
            </>
          ) : (
            <>
              <MealTypePicker mealType={form.mealType} setForm={setForm} />

              <NameTimeRow form={form} field={field} setForm={setForm} />

              <MacrosEditor
                form={form}
                field={field}
                setForm={setForm}
                pickedFood={pickedFood}
                setPickedFood={setPickedFood}
                photoResult={photoResult}
                hasPhotoMacros={hasPhotoMacros}
              />

              {!pickedFood && (
                <SaveAsFood
                  form={form}
                  setForm={setForm}
                  setPickedFood={setPickedFood}
                  setPickedGrams={setPickedGrams}
                  setFoodQuery={setFoodQuery}
                  setFoodErr={setFoodErr}
                />
              )}

              {form.err && (
                <div className="text-xs text-danger mt-2">{form.err}</div>
              )}

              <SaveAsTemplate
                form={form}
                setForm={setForm}
                setPrefs={setPrefs}
              />

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  type="button"
                  className="h-12 min-h-[44px] bg-nutrition text-white hover:bg-nutrition-hover"
                  onClick={handleSave}
                >
                  Зберегти
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-12 min-h-[44px]"
                  onClick={onClose}
                >
                  Скасувати
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
