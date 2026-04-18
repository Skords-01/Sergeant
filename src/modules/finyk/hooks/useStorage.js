import { useState, useEffect, useRef } from "react";
import { DEFAULT_SUBSCRIPTIONS, INTERNAL_TRANSFER_ID } from "../constants";
import { notifyFinykRoutineCalendarSync } from "../hubRoutineSync.js";
import {
  normalizeFinykBackup,
  normalizeFinykSyncPayload,
  FINYK_BACKUP_VERSION,
} from "../lib/finykBackup.js";
import { toLocalISODate } from "@shared/lib/date";
import { safeJsonSet } from "@shared/lib/storageQuota.js";

function reportSilentError(scope, error) {
  console.warn(`[finyk] ${scope}`, error);
}

// Одноразова міграція ключів finto_* → finyk_*
const LEGACY_KEYS = [
  ["finto_hidden", "finyk_hidden"],
  ["finto_budgets", "finyk_budgets"],
  ["finto_subs", "finyk_subs"],
  ["finto_assets", "finyk_assets"],
  ["finto_debts", "finyk_debts"],
  ["finto_recv", "finyk_recv"],
  ["finto_hidden_txs", "finyk_hidden_txs"],
  ["finto_monthly_plan", "finyk_monthly_plan"],
  ["finto_tx_cats", "finyk_tx_cats"],
  ["finto_mono_debt_linked", "finyk_mono_debt_linked"],
  ["finto_networth_history", "finyk_networth_history"],
  ["finto_tx_splits", "finyk_tx_splits"],
];
try {
  for (const [oldKey, newKey] of LEGACY_KEYS) {
    const old = localStorage.getItem(oldKey);
    if (old !== null && localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, old);
    }
    if (old !== null) localStorage.removeItem(oldKey);
  }
} catch {}

function usePersist(key, defaultVal) {
  const [val, setVal] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : defaultVal;
    } catch {
      return defaultVal;
    }
  });
  useEffect(() => {
    const res = safeJsonSet(key, val);
    if (!res.ok) {
      // Не ламаємо UX, але і не мовчимо повністю.
      console.warn(
        `[finyk] localStorage write failed for "${key}"`,
        res.reason,
      );
    }
  }, [key, val]);
  return [val, setVal];
}

export function useStorage({ onImportFeedback } = {}) {
  const defaultMonthlyPlan = { income: "", expense: "", savings: "" };
  const [hiddenAccounts, setHiddenAccounts] = usePersist("finyk_hidden", []);
  const [budgets, setBudgets] = usePersist("finyk_budgets", []);
  const [subscriptions, setSubscriptions] = usePersist(
    "finyk_subs",
    DEFAULT_SUBSCRIPTIONS,
  );
  const [manualAssets, setManualAssets] = usePersist("finyk_assets", []);
  const [manualDebts, setManualDebts] = usePersist("finyk_debts", []);
  const [receivables, setReceivables] = usePersist("finyk_recv", []);
  const [hiddenTxIds, setHiddenTxIds] = usePersist("finyk_hidden_txs", []);
  const [monthlyPlan, setMonthlyPlan] = usePersist(
    "finyk_monthly_plan",
    defaultMonthlyPlan,
  );
  const [txCategories, setTxCategories] = usePersist("finyk_tx_cats", {});
  const [monoDebtLinkedTxIds, setMonoDebtLinkedTxIds] = usePersist(
    "finyk_mono_debt_linked",
    {},
  );
  const [networthHistory, setNetworthHistory] = usePersist(
    "finyk_networth_history",
    [],
  );
  const [txSplits, setTxSplits] = usePersist("finyk_tx_splits", {});
  const [customCategories, setCustomCategories] = usePersist(
    "finyk_custom_cats_v1",
    [],
  );
  const [manualExpenses, setManualExpenses] = usePersist(
    "finyk_manual_expenses_v1",
    [],
  );
  const [excludedStatTxIds, setExcludedStatTxIds] = usePersist(
    "finyk_excluded_stat_txs",
    [],
  );
  const networthSnapshotRef = useRef(
    (() => {
      try {
        const saved = localStorage.getItem("finyk_networth_last_snap");
        return saved ? JSON.parse(saved) : { date: null, value: null };
      } catch {
        return { date: null, value: null };
      }
    })(),
  );

  const addManualExpense = (expense) => {
    const entry = {
      id: expense?.id != null ? String(expense.id) : Date.now().toString(),
      date: expense.date || new Date().toISOString(),
      description: expense.description || "",
      amount: Number(expense.amount) || 0,
      category: expense.category || "інше",
    };
    setManualExpenses((prev) => [entry, ...prev]);
    return entry;
  };

  const removeManualExpense = (id) => {
    setManualExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const editManualExpense = (id, patch) => {
    const pid = String(id);
    setManualExpenses((prev) =>
      (prev || []).map((e) => {
        if (String(e.id) !== pid) return e;
        const next = { ...e };
        if (patch?.date) next.date = String(patch.date);
        if (patch?.description != null)
          next.description = String(patch.description || "");
        if (patch?.category != null)
          next.category = String(patch.category || "інше");
        if (patch?.amount != null) next.amount = Number(patch.amount) || 0;
        return next;
      }),
    );
  };

  const toggleHideAccount = (id) =>
    setHiddenAccounts((h) =>
      h.includes(id) ? h.filter((x) => x !== id) : [...h, id],
    );

  const toggleMonoDebtTx = (accountId, txId) => {
    setMonoDebtLinkedTxIds((prev) => {
      const linked = prev[accountId] || [];
      return {
        ...prev,
        [accountId]: linked.includes(txId)
          ? linked.filter((x) => x !== txId)
          : [...linked, txId],
      };
    });
  };

  const toggleLinkedTx = (id, txId, type) => {
    const setter = type === "debt" ? setManualDebts : setReceivables;
    setter((items) =>
      items.map((d) => {
        if (d.id !== id) return d;
        const linked = d.linkedTxIds || [];
        return {
          ...d,
          linkedTxIds: linked.includes(txId)
            ? linked.filter((x) => x !== txId)
            : [...linked, txId],
        };
      }),
    );
  };

  const hideTx = (id) =>
    setHiddenTxIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );

  const toggleExcludeFromStats = (id) =>
    setExcludedStatTxIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );

  const setSplitTx = (txId, splits) => {
    setTxSplits((prev) =>
      splits && splits.length >= 2
        ? { ...prev, [txId]: splits }
        : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== txId)),
    );
  };

  const updateSubscription = (subId, patch) => {
    setSubscriptions((subs) =>
      subs.map((s) => {
        if (s.id !== subId) return s;
        const next = { ...s };
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === undefined) delete next[k];
          else next[k] = v;
        }
        return next;
      }),
    );
    notifyFinykRoutineCalendarSync();
  };

  const overrideCategory = (txId, catId) => {
    setTxCategories((prev) =>
      catId
        ? { ...prev, [txId]: catId }
        : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== txId)),
    );
  };

  const addCustomCategory = (label, { color, icon, parentId } = {}) => {
    const trimmed = String(label || "").trim();
    if (!trimmed || trimmed.length > 80) return;
    setCustomCategories((prev) => {
      if (prev.length >= 80) return prev;
      if (prev.some((c) => c.label.toLowerCase() === trimmed.toLowerCase()))
        return prev;
      const id = `cus_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
      const entry = { id, label: trimmed };
      if (color) entry.color = color;
      if (icon) entry.icon = icon;
      if (parentId) entry.parentId = parentId;
      return [...prev, entry];
    });
  };

  const editCustomCategory = (id, patch) => {
    setCustomCategories((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c };
        if (patch.label != null) next.label = String(patch.label).trim() || c.label;
        if (patch.color !== undefined) next.color = patch.color || undefined;
        if (patch.icon !== undefined) next.icon = patch.icon || undefined;
        if (patch.parentId !== undefined) next.parentId = patch.parentId || undefined;
        return next;
      }),
    );
  };

  const removeCustomCategory = (id) => {
    setCustomCategories((prev) => prev.filter((c) => c.id !== id));
    setTxCategories((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[k] === id) delete next[k];
      }
      return next;
    });
    setTxSplits((prev) => {
      const out = { ...prev };
      for (const txId of Object.keys(out)) {
        const splits = out[txId];
        if (!Array.isArray(splits)) continue;
        const nextSplits = splits.map((s) =>
          s.categoryId === id ? { ...s, categoryId: "other" } : s,
        );
        const multi = nextSplits.filter(
          (s) => s.categoryId && (parseFloat(s.amount) || 0) > 0,
        );
        if (multi.length >= 2) out[txId] = nextSplits;
        else delete out[txId];
      }
      return out;
    });
    setBudgets((bs) =>
      bs.filter((b) => b.type !== "limit" || b.categoryId !== id),
    );
  };

  const applyData = (data) => {
    if (data.budgets) setBudgets(data.budgets);
    if (data.subscriptions) setSubscriptions(data.subscriptions);
    if (data.manualAssets) setManualAssets(data.manualAssets);
    if (data.manualDebts) setManualDebts(data.manualDebts);
    if (data.receivables) setReceivables(data.receivables);
    if (data.hiddenAccounts) setHiddenAccounts(data.hiddenAccounts);
    if (data.hiddenTxIds) setHiddenTxIds(data.hiddenTxIds);
    if (data.monthlyPlan) setMonthlyPlan(data.monthlyPlan);
    if (data.txCategories) setTxCategories(data.txCategories);
    if (data.txSplits) setTxSplits(data.txSplits);
    if (data.monoDebtLinkedTxIds)
      setMonoDebtLinkedTxIds(data.monoDebtLinkedTxIds);
    if (data.networthHistory) setNetworthHistory(data.networthHistory);
    if (data.customCategories) setCustomCategories(data.customCategories);
    notifyFinykRoutineCalendarSync();
  };

  const exportData = () => {
    const data = {
      version: FINYK_BACKUP_VERSION,
      budgets,
      subscriptions,
      manualAssets,
      manualDebts,
      receivables,
      hiddenAccounts,
      hiddenTxIds,
      monthlyPlan,
      txCategories,
      txSplits,
      monoDebtLinkedTxIds,
      networthHistory,
      customCategories,
    };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finyk-backup-${toLocalISODate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** @returns {Promise<boolean>} */
  const importData = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          const normalized = normalizeFinykBackup(parsed);
          applyData(normalized);
          onImportFeedback?.("✅ Дані імпортовано", "success");
          resolve(true);
        } catch (err) {
          reportSilentError("import data", err);
          const raw =
            err instanceof Error ? err.message : "невірний формат файлу";
          const msg = raw.startsWith("Помилка:") ? raw : `Помилка: ${raw}`;
          onImportFeedback?.(msg, "error");
          resolve(false);
        }
      };
      reader.onerror = () => {
        onImportFeedback?.("Помилка: не вдалось прочитати файл", "error");
        resolve(false);
      };
      reader.readAsText(file);
    });

  // Sync: без прихованих рахунків/транзакцій (device-specific). v3 — категорії, спліти, борги mono, нетворс.
  const generateSyncLink = () => {
    const data = {
      v: 3,
      b: budgets,
      s: subscriptions,
      a: manualAssets,
      d: manualDebts,
      r: receivables,
      mp: monthlyPlan,
      tc: txCategories,
      ts: txSplits,
      md: monoDebtLinkedTxIds,
      nh: networthHistory,
      cc: customCategories,
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(data)));
    return `${window.location.origin}${window.location.pathname}?sync=${encoded}`;
  };

  const loadFromUrl = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get("sync");
      if (!encoded) return false;
      const raw = JSON.parse(decodeURIComponent(atob(encoded)));
      const normalized = normalizeFinykSyncPayload(raw);
      applyData(normalized);
      window.history.replaceState({}, "", window.location.pathname);
      return true;
    } catch (err) {
      reportSilentError("load sync from url", err);
      return false;
    }
  };

  // Транзакції позначені як внутрішній переказ — виключаємо зі статистики
  const transferTxIds = Object.entries(txCategories)
    .filter(([, catId]) => catId === INTERNAL_TRANSFER_ID)
    .map(([txId]) => txId);

  // ID транзакцій прив'язаних до пасивів — для відстеження погашення в Assets
  // НЕ виключаємо зі статистики, щоб вони відображались у категорії "Борги та кредити"
  const debtLinkedTxIds = new Set([
    ...manualDebts.flatMap((d) => d.linkedTxIds || []),
    ...Object.values(monoDebtLinkedTxIds).flat(),
  ]);

  // Зі статистики виключаємо: приховані, внутрішні перекази, дебіторку (щоб повернення боргу не рахувалось як дохід)
  const excludedTxIds = new Set([
    ...hiddenTxIds,
    ...transferTxIds,
    ...receivables.flatMap((r) => r.linkedTxIds || []),
    ...excludedStatTxIds,
  ]);

  return {
    hiddenAccounts,
    setHiddenAccounts,
    toggleHideAccount,
    budgets,
    setBudgets,
    subscriptions,
    setSubscriptions,
    updateSubscription,
    manualAssets,
    setManualAssets,
    manualDebts,
    setManualDebts,
    receivables,
    setReceivables,
    monthlyPlan,
    setMonthlyPlan,
    toggleLinkedTx,
    hiddenTxIds,
    hideTx,
    exportData,
    importData,
    generateSyncLink,
    loadFromUrl,
    excludedTxIds,
    debtTxIds: debtLinkedTxIds, // зворотна сумісність
    txCategories,
    customCategories,
    addCustomCategory,
    editCustomCategory,
    removeCustomCategory,
    overrideCategory,
    txSplits,
    setSplitTx,
    monoDebtLinkedTxIds,
    toggleMonoDebtTx,
    debtLinkedTxIds,
    networthHistory,
    saveNetworthSnapshot: (networth) => {
      const today = toLocalISODate();
      const rounded = Math.round(networth);
      const snap = networthSnapshotRef.current;
      if (snap.date === today && snap.value !== null) {
        const changePct =
          snap.value !== 0 ? Math.abs((rounded - snap.value) / snap.value) : 1;
        if (changePct < 0.01) return;
      }
      networthSnapshotRef.current = { date: today, value: rounded };
      try {
        localStorage.setItem(
          "finyk_networth_last_snap",
          JSON.stringify({ date: today, value: rounded }),
        );
      } catch {}
      const key = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      setNetworthHistory((prev) => {
        const filtered = prev.filter((s) => s.month !== key);
        return [...filtered, { month: key, networth: rounded }]
          .sort((a, b) => a.month.localeCompare(b.month))
          .slice(-12);
      });
    },
    excludedStatTxIds,
    toggleExcludeFromStats,
    manualExpenses,
    setManualExpenses,
    addManualExpense,
    editManualExpense,
    removeManualExpense,
  };
}
