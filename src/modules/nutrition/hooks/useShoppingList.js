import { useCallback, useEffect, useState } from "react";
import {
  loadShoppingList,
  persistShoppingList,
  toggleShoppingItem,
  removeCheckedItems,
  getCheckedItems,
} from "../lib/shoppingListStorage.js";

export function useShoppingList() {
  const [shoppingList, setShoppingList] = useState(() => loadShoppingList());

  useEffect(() => {
    persistShoppingList(shoppingList);
  }, [shoppingList]);

  const toggle = useCallback((categoryName, itemId) => {
    setShoppingList((list) => toggleShoppingItem(list, categoryName, itemId));
  }, []);

  const clearChecked = useCallback(() => {
    setShoppingList((list) => removeCheckedItems(list));
  }, []);

  const clearAll = useCallback(() => {
    setShoppingList({ categories: [] });
  }, []);

  const setGeneratedList = useCallback((categories) => {
    setShoppingList({ categories: Array.isArray(categories) ? categories : [] });
  }, []);

  const checkedItems = getCheckedItems(shoppingList);

  return {
    shoppingList,
    toggle,
    clearChecked,
    clearAll,
    setGeneratedList,
    checkedItems,
  };
}
