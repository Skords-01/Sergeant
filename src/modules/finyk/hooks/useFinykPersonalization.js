import { useMemo } from "react";
import {
  getFrequentCategories,
  getFrequentMerchants,
} from "../domain/personalization";

// Memo-обгортка навколо чистих селекторів персоналізації. Повертає список
// найчастіших категорій і мерчантів для поточного користувача — використовується
// у quick add, dashboard-картках та в компонентах, що сортують UI за частотою.
export function useFinykPersonalization({ mono, storage, now } = {}) {
  const rawTransactions = mono?.realTx;
  const rawManualExpenses = storage?.manualExpenses;
  const rawCustomCategories = storage?.customCategories;
  const rawTxCategories = storage?.txCategories;
  const excludedTxIds = storage?.excludedTxIds;

  // Стабілізуємо посилання — селектори приймають readonly-дані, а падаючі
  // `undefined → []` кожного рендера ламали dep-array useMemo.
  const transactions = useMemo(
    () => rawTransactions || [],
    [rawTransactions],
  );
  const manualExpenses = useMemo(
    () => rawManualExpenses || [],
    [rawManualExpenses],
  );
  const customCategories = useMemo(
    () => rawCustomCategories || [],
    [rawCustomCategories],
  );
  const txCategories = useMemo(
    () => rawTxCategories || {},
    [rawTxCategories],
  );

  const opts = useMemo(
    () => ({ customCategories, excludedTxIds, txCategories, now }),
    [customCategories, excludedTxIds, txCategories, now],
  );

  const frequentCategories = useMemo(
    () => getFrequentCategories(transactions, manualExpenses, opts),
    [transactions, manualExpenses, opts],
  );

  const frequentMerchants = useMemo(
    () => getFrequentMerchants(transactions, manualExpenses, opts),
    [transactions, manualExpenses, opts],
  );

  const hasSignal = useMemo(
    () => frequentCategories.some((c) => c.count >= 2),
    [frequentCategories],
  );

  return { frequentCategories, frequentMerchants, hasSignal };
}
