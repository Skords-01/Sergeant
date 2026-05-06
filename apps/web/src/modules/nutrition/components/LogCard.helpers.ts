import {
  addDaysISODate,
  type Meal,
  type MealTypeId,
} from "@sergeant/nutrition-domain";
import { toLocalISODate } from "../lib/nutritionStorage";
import { isMealTypeId, mealTypeFromLabel } from "../lib/mealTypes";

export function toISODate(d: Date): string {
  return toLocalISODate(d);
}

export function formatDate(isoDate: string): string {
  const today = toISODate(new Date());
  const yesterday = addDaysISODate(today, -1);
  const tomorrow = addDaysISODate(today, 1);
  if (isoDate === today) return "Сьогодні";
  if (isoDate === yesterday) return "Вчора";
  if (isoDate === tomorrow) return "Завтра";
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

export function groupByMealType(meals: Meal[]): Record<MealTypeId, Meal[]> {
  const groups: Partial<Record<MealTypeId, Meal[]>> = {};
  for (const meal of meals) {
    const mealType: MealTypeId = isMealTypeId(meal.mealType)
      ? meal.mealType
      : mealTypeFromLabel(meal.label);
    if (!groups[mealType]) groups[mealType] = [];
    groups[mealType]!.push(meal);
  }
  return groups as Record<MealTypeId, Meal[]>;
}
