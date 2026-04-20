import { mealTypeByNow, type MealTypeId } from "../../lib/mealTypes.js";
import type { NullableMacros } from "../../lib/macros.js";

export function currentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export interface MealFormPhotoResult {
  dishName?: string | null;
  macros?: Partial<NullableMacros> | null;
}

export interface MealFormState {
  name: string;
  mealType: MealTypeId;
  time: string;
  kcal: string;
  protein_g: string;
  fat_g: string;
  carbs_g: string;
  err: string;
}

export function emptyForm(
  photoResult?: MealFormPhotoResult | null,
): MealFormState {
  const macros = photoResult?.macros || {};
  return {
    name: photoResult?.dishName || "",
    // Default to the meal that matches the current hour. Hard-coding
    // "breakfast" at 21:00 forced every late-dinner user to tap the picker
    // and flip the type to "Вечеря" before they could save.
    mealType: mealTypeByNow(),
    time: currentTime(),
    kcal: macros.kcal != null ? String(Math.round(macros.kcal)) : "",
    protein_g:
      macros.protein_g != null ? String(Math.round(macros.protein_g)) : "",
    fat_g: macros.fat_g != null ? String(Math.round(macros.fat_g)) : "",
    carbs_g: macros.carbs_g != null ? String(Math.round(macros.carbs_g)) : "",
    err: "",
  };
}
