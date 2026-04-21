/**
 * MMKV-backed Transactions store for Finyk (mobile).
 *
 * Owns the slices the `TransactionsPage` reads / writes:
 *   - manualExpenses     → finyk_manual_expenses_v1  (FINYK_STORAGE_KEYS.transactions)
 *   - txCategories       → finyk_tx_cats             (FINYK_BACKUP_STORAGE_KEYS.txCategories)
 *   - txSplits           → finyk_tx_splits           (FINYK_BACKUP_STORAGE_KEYS.txSplits)
 *   - hiddenTxIds        → finyk_hidden_txs          (FINYK_BACKUP_STORAGE_KEYS.hiddenTxIds)
 *
 * Each setter persists to MMKV via `safeWriteLS` and then calls
 * `enqueueChange(KEY)` so the cloud-sync scheduler picks the change
 * up — same pattern as `assetsStore.ts`.
 *
 * Real Monobank-sourced transactions (`realTx`) are not persisted here;
 * they come from the network layer (still seed-only on mobile until the
 * Monobank client port lands). The store accepts a `seed` so storybooks
 * and jest tests can render the page deterministically.
 */
import { useCallback, useEffect, useState } from "react";

import {
  FINYK_BACKUP_STORAGE_KEYS,
  FINYK_STORAGE_KEYS,
} from "@sergeant/finyk-domain";
import type {
  MonoAccount,
  Transaction,
} from "@sergeant/finyk-domain/domain";
import { STORAGE_KEYS } from "@sergeant/shared";

import { _getMMKVInstance, safeReadLS, safeWriteLS } from "@/lib/storage";
import { enqueueChange } from "@/sync/enqueue";

import type { ManualExpensePayload } from "../components/ManualExpenseSheet";

const KEY_MANUAL = FINYK_STORAGE_KEYS.transactions;
const KEY_TX_CATS = FINYK_BACKUP_STORAGE_KEYS.txCategories;
const KEY_TX_SPLITS = FINYK_BACKUP_STORAGE_KEYS.txSplits;
const KEY_HIDDEN_TXS = FINYK_BACKUP_STORAGE_KEYS.hiddenTxIds;
const KEY_FILTERS = STORAGE_KEYS.FINYK_TX_FILTERS;

/**
 * Persisted shape of a manual expense entry — matches the web file
 * (`apps/web/src/modules/finyk/hooks/useStorage.ts`). `id` is a stable
 * client-generated string; `amount` is in UAH (positive number).
 */
export interface ManualExpenseRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
}

export interface TxSplitEntry {
  categoryId: string;
  amount: number;
}

function read<T>(key: string, fallback: T): T {
  const v = safeReadLS<T>(key, fallback);
  return v == null ? fallback : v;
}

export interface FinykTransactionsSeed {
  manualExpenses?: ManualExpenseRecord[];
  txCategories?: Record<string, string>;
  txSplits?: Record<string, TxSplitEntry[]>;
  hiddenTxIds?: string[];
  /** Real (Monobank-sourced) transactions — not persisted, render-only. */
  realTx?: Transaction[];
  /** Mono accounts — used for the "credit card" filter. */
  accounts?: MonoAccount[];
  /** Custom categories — surfaced in the category filter chips. */
  customCategories?: { id: string; label: string }[];
}

export interface UseFinykTransactionsStoreReturn {
  manualExpenses: ManualExpenseRecord[];
  txCategories: Record<string, string>;
  txSplits: Record<string, TxSplitEntry[]>;
  hiddenTxIds: string[];
  realTx: Transaction[];
  accounts: MonoAccount[];
  customCategories: { id: string; label: string }[];

  addManualExpense: (entry: ManualExpensePayload) => ManualExpenseRecord;
  updateManualExpense: (id: string, patch: ManualExpensePayload) => void;
  removeManualExpense: (id: string) => void;
  hideTx: (id: string) => void;
  unhideTx: (id: string) => void;
  overrideCategory: (txId: string, categoryId: string | null) => void;
  setSplitTx: (txId: string, splits: TxSplitEntry[]) => void;
  /** Re-read every persisted slice from MMKV. Used by pull-to-refresh. */
  refresh: () => void;
}

/**
 * Persisted filter state — survives navigation away from the screen,
 * re-mounting, and app cold-starts. Wired to its own MMKV key so it
 * round-trips through CloudSync when the user opts in.
 */
export interface FinykTxFilterState {
  /** Quick filter id (`all` / `expense` / `income` / `credit` / category id). */
  filter: string;
  /** Optional account id whitelist. Empty = no account filter. */
  accountIds: string[];
  /** Optional millis-since-epoch range. `null` = month nav defines the window. */
  range: { startMs: number | null; endMs: number | null };
}

const DEFAULT_FILTERS: FinykTxFilterState = {
  filter: "all",
  accountIds: [],
  range: { startMs: null, endMs: null },
};

export function useFinykTxFilters(seed?: Partial<FinykTxFilterState>): {
  filters: FinykTxFilterState;
  setFilter: (filter: string) => void;
  setAccountIds: (ids: string[]) => void;
  setRange: (range: FinykTxFilterState["range"]) => void;
  clearAll: () => void;
} {
  const [filters, setFiltersState] = useState<FinykTxFilterState>(() => {
    const stored = read<FinykTxFilterState>(KEY_FILTERS, DEFAULT_FILTERS);
    return { ...DEFAULT_FILTERS, ...stored, ...(seed ?? {}) };
  });

  const persist = useCallback((next: FinykTxFilterState) => {
    setFiltersState(next);
    safeWriteLS(KEY_FILTERS, next);
    enqueueChange(KEY_FILTERS);
  }, []);

  const setFilter = useCallback(
    (filter: string) => {
      persist({ ...read<FinykTxFilterState>(KEY_FILTERS, DEFAULT_FILTERS), filter });
    },
    [persist],
  );

  const setAccountIds = useCallback(
    (accountIds: string[]) => {
      persist({
        ...read<FinykTxFilterState>(KEY_FILTERS, DEFAULT_FILTERS),
        accountIds,
      });
    },
    [persist],
  );

  const setRange = useCallback(
    (range: FinykTxFilterState["range"]) => {
      persist({
        ...read<FinykTxFilterState>(KEY_FILTERS, DEFAULT_FILTERS),
        range,
      });
    },
    [persist],
  );

  const clearAll = useCallback(() => {
    persist(DEFAULT_FILTERS);
  }, [persist]);

  return { filters, setFilter, setAccountIds, setRange, clearAll };
}

function genId(): string {
  return `me_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Read-through MMKV hook for the Transactions page slices. Mirrors the
 * `useFinykAssetsStore` shape exactly so future consolidation into a
 * single Finyk root store is mechanical.
 */
export function useFinykTransactionsStore(
  seed?: FinykTransactionsSeed,
): UseFinykTransactionsStoreReturn {
  const [manualExpenses, setManualState] = useState<ManualExpenseRecord[]>(
    () => seed?.manualExpenses ?? read<ManualExpenseRecord[]>(KEY_MANUAL, []),
  );
  const [txCategories, setTxCatsState] = useState<Record<string, string>>(
    () =>
      seed?.txCategories ??
      read<Record<string, string>>(KEY_TX_CATS, {}),
  );
  const [txSplits, setTxSplitsState] = useState<Record<string, TxSplitEntry[]>>(
    () =>
      seed?.txSplits ??
      read<Record<string, TxSplitEntry[]>>(KEY_TX_SPLITS, {}),
  );
  const [hiddenTxIds, setHiddenState] = useState<string[]>(
    () => seed?.hiddenTxIds ?? read<string[]>(KEY_HIDDEN_TXS, []),
  );

  // Flush seed values through MMKV on first mount so re-renders read
  // through the same code path as production.
  useEffect(() => {
    if (!seed) return;
    if (seed.manualExpenses) safeWriteLS(KEY_MANUAL, seed.manualExpenses);
    if (seed.txCategories) safeWriteLS(KEY_TX_CATS, seed.txCategories);
    if (seed.txSplits) safeWriteLS(KEY_TX_SPLITS, seed.txSplits);
    if (seed.hiddenTxIds) safeWriteLS(KEY_HIDDEN_TXS, seed.hiddenTxIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick up writes from other consumers of the same keys (e.g.
  // CloudSync pulling a fresh server payload).
  useEffect(() => {
    const mmkv = _getMMKVInstance();
    const sub = mmkv.addOnValueChangedListener((changedKey) => {
      switch (changedKey) {
        case KEY_MANUAL:
          setManualState(read<ManualExpenseRecord[]>(KEY_MANUAL, []));
          break;
        case KEY_TX_CATS:
          setTxCatsState(read<Record<string, string>>(KEY_TX_CATS, {}));
          break;
        case KEY_TX_SPLITS:
          setTxSplitsState(
            read<Record<string, TxSplitEntry[]>>(KEY_TX_SPLITS, {}),
          );
          break;
        case KEY_HIDDEN_TXS:
          setHiddenState(read<string[]>(KEY_HIDDEN_TXS, []));
          break;
        default:
          break;
      }
    });
    return () => sub.remove();
  }, []);

  const writeManual = useCallback((next: ManualExpenseRecord[]) => {
    setManualState(next);
    safeWriteLS(KEY_MANUAL, next);
    enqueueChange(KEY_MANUAL);
  }, []);

  const addManualExpense = useCallback(
    (entry: ManualExpensePayload): ManualExpenseRecord => {
      const id = entry.id ?? genId();
      const record: ManualExpenseRecord = {
        id,
        date: entry.date,
        description: entry.description,
        amount: entry.amount,
        category: entry.category,
      };
      // Reuse the latest persisted snapshot so back-to-back adds don't
      // race the React state setter.
      const current = read<ManualExpenseRecord[]>(KEY_MANUAL, []);
      writeManual([record, ...current.filter((e) => e.id !== id)]);
      return record;
    },
    [writeManual],
  );

  const updateManualExpense = useCallback(
    (id: string, patch: ManualExpensePayload) => {
      const current = read<ManualExpenseRecord[]>(KEY_MANUAL, []);
      const next = current.map((e) =>
        e.id === id
          ? {
              id,
              date: patch.date,
              description: patch.description,
              amount: patch.amount,
              category: patch.category,
            }
          : e,
      );
      writeManual(next);
    },
    [writeManual],
  );

  const removeManualExpense = useCallback(
    (id: string) => {
      const current = read<ManualExpenseRecord[]>(KEY_MANUAL, []);
      writeManual(current.filter((e) => e.id !== id));
    },
    [writeManual],
  );

  const hideTx = useCallback((id: string) => {
    const current = read<string[]>(KEY_HIDDEN_TXS, []);
    if (current.includes(id)) return;
    const next = [...current, id];
    setHiddenState(next);
    safeWriteLS(KEY_HIDDEN_TXS, next);
    enqueueChange(KEY_HIDDEN_TXS);
  }, []);

  const unhideTx = useCallback((id: string) => {
    const current = read<string[]>(KEY_HIDDEN_TXS, []);
    if (!current.includes(id)) return;
    const next = current.filter((x) => x !== id);
    setHiddenState(next);
    safeWriteLS(KEY_HIDDEN_TXS, next);
    enqueueChange(KEY_HIDDEN_TXS);
  }, []);

  const overrideCategory = useCallback(
    (txId: string, categoryId: string | null) => {
      const current = read<Record<string, string>>(KEY_TX_CATS, {});
      const next = { ...current };
      if (categoryId == null || categoryId === "") {
        delete next[txId];
      } else {
        next[txId] = categoryId;
      }
      setTxCatsState(next);
      safeWriteLS(KEY_TX_CATS, next);
      enqueueChange(KEY_TX_CATS);
    },
    [],
  );

  const setSplitTx = useCallback(
    (txId: string, splits: TxSplitEntry[]) => {
      const current = read<Record<string, TxSplitEntry[]>>(KEY_TX_SPLITS, {});
      const next = { ...current };
      if (!splits || splits.length === 0) {
        delete next[txId];
      } else {
        next[txId] = splits;
      }
      setTxSplitsState(next);
      safeWriteLS(KEY_TX_SPLITS, next);
      enqueueChange(KEY_TX_SPLITS);
    },
    [],
  );

  const refresh = useCallback(() => {
    setManualState(read<ManualExpenseRecord[]>(KEY_MANUAL, []));
    setTxCatsState(read<Record<string, string>>(KEY_TX_CATS, {}));
    setTxSplitsState(read<Record<string, TxSplitEntry[]>>(KEY_TX_SPLITS, {}));
    setHiddenState(read<string[]>(KEY_HIDDEN_TXS, []));
  }, []);

  return {
    manualExpenses,
    txCategories,
    txSplits,
    hiddenTxIds,
    realTx: seed?.realTx ?? [],
    accounts: seed?.accounts ?? [],
    customCategories: seed?.customCategories ?? [],

    addManualExpense,
    updateManualExpense,
    removeManualExpense,
    hideTx,
    unhideTx,
    overrideCategory,
    setSplitTx,
    refresh,
  };
}
