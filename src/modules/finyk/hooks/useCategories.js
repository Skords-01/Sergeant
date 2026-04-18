import { useMemo } from "react";
import { mergeExpenseCategoryDefinitions } from "../constants";
import { resolveExpenseCategoryMeta } from "../utils";

export function useCategories(storage) {
  const {
    customCategories,
    addCustomCategory,
    editCustomCategory,
    removeCustomCategory,
  } = storage;

  const allCategories = useMemo(
    () => mergeExpenseCategoryDefinitions(customCategories),
    [customCategories],
  );

  const getCategoryMeta = (id) =>
    resolveExpenseCategoryMeta(id, customCategories);

  return {
    customCategories,
    allCategories,
    addCustomCategory,
    editCustomCategory,
    removeCustomCategory,
    getCategoryMeta,
  };
}
