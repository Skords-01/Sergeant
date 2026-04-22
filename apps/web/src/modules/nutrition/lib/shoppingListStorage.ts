/**
 * Web I/O-адаптер для списку покупок.
 *
 * Pure-логіка (`normalizeShoppingList`, `toggleShoppingItem`,
 * `removeCheckedItems`, `getCheckedItems`, `getTotalCount`, типи) живе у
 * `@sergeant/nutrition-domain` і спільна з `apps/mobile`. Тут лишаються
 * лише load/persist поверх `createModuleStorage`.
 */
import {
  SHOPPING_LIST_KEY,
  normalizeShoppingList,
  type ShoppingList,
} from "@sergeant/nutrition-domain";

import { nutritionStorage } from "./nutritionStorageInstance.js";

export {
  SHOPPING_LIST_KEY,
  getCheckedItems,
  getTotalCount,
  normalizeShoppingList,
  removeCheckedItems,
  toggleShoppingItem,
} from "@sergeant/nutrition-domain";
export type {
  ShoppingCategory,
  ShoppingItem,
  ShoppingList,
  ShoppingListLike,
} from "@sergeant/nutrition-domain";

export function loadShoppingList(
  key: string = SHOPPING_LIST_KEY,
): ShoppingList {
  const parsed = nutritionStorage.readJSON(key, null);
  return normalizeShoppingList(parsed);
}

export function persistShoppingList(
  list: unknown,
  key: string = SHOPPING_LIST_KEY,
): boolean {
  return nutritionStorage.writeJSON(key, normalizeShoppingList(list));
}
