import { mealTypeByNow } from "../../lib/mealTypes.js";

export function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function emptyForm(photoResult) {
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
