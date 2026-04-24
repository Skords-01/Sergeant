/**
 * AddMealSheet — RN port of web's AddMealSheet.
 *
 * Two-step bottom sheet:
 *  Step "source" — «Вручну» + «Сканер штрихкоду» (PR-6) →
 *    `/(tabs)/nutrition/scan?returnTo=addMeal` + prefill через bridge.
 *  Step "fill"   — MealTypePicker + NameTimeRow + MacrosEditor + Save.
 * Pantry / food search / photo — PR-7+.
 */
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";

import {
  MEAL_TYPES,
  type MealMacroSource,
  type MealSource,
  type MealTypeId,
} from "@sergeant/nutrition-domain";
import { hapticSuccess } from "@sergeant/shared";

import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { setNutritionScanPrefillHandler } from "../lib/nutritionScanBridge";

import { MacrosEditor } from "./meal-sheet/MacrosEditor";
import { MealTypePicker } from "./meal-sheet/MealTypePicker";
import { NameTimeRow } from "./meal-sheet/NameTimeRow";
import {
  currentTime,
  emptyForm,
  type MealFormState,
} from "./meal-sheet/mealFormUtils";

export interface MealSavePayload {
  id: string;
  time: string;
  mealType: MealTypeId;
  label: string;
  name: string;
  macros: {
    kcal: number | null;
    protein_g: number | null;
    fat_g: number | null;
    carbs_g: number | null;
  };
  source: MealSource;
  macroSource: MealMacroSource;
}

export interface InitialMeal {
  id?: string;
  name?: string;
  mealType?: MealTypeId;
  time?: string;
  macros?: {
    kcal?: number | null;
    protein_g?: number | null;
    fat_g?: number | null;
    carbs_g?: number | null;
  };
}

interface AddMealSheetProps {
  open: boolean;
  onClose: () => void;
  onSave: (meal: MealSavePayload) => void;
  initialMeal?: InitialMeal | null;
}

export function AddMealSheet({
  open,
  onClose,
  onSave,
  initialMeal,
}: AddMealSheetProps) {
  const [form, setForm] = useState<MealFormState>(() => emptyForm(null));
  const [step, setStep] = useState<"source" | "fill">("source");
  const [macroSource, setMacroSource] = useState<MealMacroSource>("manual");

  useEffect(() => {
    if (!open) return;
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
      setMacroSource("manual");
      setStep("fill");
    } else {
      setForm(emptyForm(null));
      setMacroSource("manual");
      setStep("source");
    }
  }, [open, initialMeal]);

  useEffect(() => {
    if (!open) {
      setNutritionScanPrefillHandler(null);
      return;
    }
    setNutritionScanPrefillHandler((payload) => {
      setForm((s) => ({
        ...s,
        name: payload.name,
        kcal: payload.kcal,
        protein_g: payload.protein_g,
        fat_g: payload.fat_g,
        carbs_g: payload.carbs_g,
        err: payload.partial
          ? "Перевір макроси: часткові дані з каталогу."
          : "",
      }));
      setMacroSource("productDb");
      setStep("fill");
    });
    return () => setNutritionScanPrefillHandler(null);
  }, [open]);

  const field = useCallback(
    (key: keyof MealFormState) => (v: string) =>
      setForm((s) => ({ ...s, [key]: v, err: "" })),
    [],
  );

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
    const mealLabel =
      MEAL_TYPES.find((m) => m.id === form.mealType)?.label || "Прийом їжі";
    hapticSuccess();
    onSave({
      id:
        initialMeal?.id ||
        `meal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      time: form.time || currentTime(),
      mealType: form.mealType,
      label: mealLabel,
      name,
      macros: { kcal, protein_g, fat_g, carbs_g },
      source: "manual" as MealSource,
      macroSource,
    });
  }

  const showBack = step === "fill" && !initialMeal?.id;
  const sheetTitle = step === "source" ? "Звідки страва?" : "Додати прийом їжі";

  return (
    <Sheet open={open} onClose={onClose} title={sheetTitle}>
      {step === "source" ? (
        <View>
          <Text className="text-xs text-stone-400 mb-4">
            Оберіть джерело нижче. Макроси, назву й час відредагуєте на
            наступному кроці.
          </Text>

          <Button
            variant="secondary"
            onPress={() => {
              router.push({
                pathname: "/(tabs)/nutrition/scan",
                params: { returnTo: "addMeal" },
              });
            }}
            accessibilityLabel="Сканер штрихкоду"
            testID="add-meal-open-barcode-scan"
          >
            Сканер штрихкоду
          </Button>

          <View className="items-center my-3">
            <View className="flex-row items-center gap-3">
              <View className="flex-1 h-px bg-cream-300" />
              {/* eslint-disable-next-line sergeant-design/no-eyebrow-drift -- divider text */}
              <Text className="text-[10px] text-stone-400 uppercase tracking-wider">
                або
              </Text>
              <View className="flex-1 h-px bg-cream-300" />
            </View>
          </View>

          <Button
            variant="secondary"
            onPress={() => {
              setMacroSource("manual");
              setStep("fill");
            }}
            accessibilityLabel="Ввести вручну"
          >
            Ввести вручну
          </Button>
        </View>
      ) : (
        <View>
          {showBack ? (
            <Pressable
              onPress={() => setStep("source")}
              accessibilityRole="button"
              accessibilityLabel="Назад до вибору джерела"
              className="mb-3"
            >
              <Text className="text-xs text-stone-400 underline">
                ← Назад до вибору джерела
              </Text>
            </Pressable>
          ) : null}
          <MealTypePicker mealType={form.mealType} setForm={setForm} />
          <NameTimeRow form={form} field={field} setForm={setForm} />
          <MacrosEditor form={form} field={field} setForm={setForm} />

          {form.err ? (
            <Text className="text-xs text-red-500 mt-2">{form.err}</Text>
          ) : null}

          <View className="mt-5 gap-2">
            <Button variant="nutrition" onPress={handleSave}>
              Зберегти
            </Button>
            <Button variant="ghost" onPress={onClose}>
              Скасувати
            </Button>
          </View>
        </View>
      )}
    </Sheet>
  );
}
