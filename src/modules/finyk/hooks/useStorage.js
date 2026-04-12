import { useState, useEffect } from "react";
import { DEFAULT_SUBSCRIPTIONS, INTERNAL_TRANSFER_ID } from "../constants";

function reportSilentError(scope, error) {
  console.warn(`[finyk] ${scope}`, error);
}

// Одноразова міграція ключів finto_* → finyk_*
const LEGACY_KEYS = [
  ["finto_hidden",           "finyk_hidden"],
  ["finto_budgets",          "finyk_budgets"],
  ["finto_subs",             "finyk_subs"],
  ["finto_assets",           "finyk_assets"],
  ["finto_debts",            "finyk_debts"],
  ["finto_recv",             "finyk_recv"],
  ["finto_hidden_txs",       "finyk_hidden_txs"],
  ["finto_monthly_plan",     "finyk_monthly_plan"],
  ["finto_tx_cats",          "finyk_tx_cats"],
  ["finto_mono_debt_linked", "finyk_mono_debt_linked"],
  ["finto_networth_history", "finyk_networth_history"],
  ["finto_tx_splits",        "finyk_tx_splits"],
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
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : defaultVal; } catch { return defaultVal; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }, [val]);
  return [val, setVal];
}

export function useStorage() {
  const defaultMonthlyPlan = { income: "", expense: "", savings: "" };
  const [hiddenAccounts, setHiddenAccounts] = usePersist("finyk_hidden", []);
  const [budgets, setBudgets] = usePersist("finyk_budgets", []);
  const [subscriptions, setSubscriptions] = usePersist("finyk_subs", DEFAULT_SUBSCRIPTIONS);
  const [manualAssets, setManualAssets] = usePersist("finyk_assets", []);
  const [manualDebts, setManualDebts] = usePersist("finyk_debts", []);
  const [receivables, setReceivables] = usePersist("finyk_recv", []);
  const [hiddenTxIds, setHiddenTxIds] = usePersist("finyk_hidden_txs", []);
  const [monthlyPlan, setMonthlyPlan] = usePersist("finyk_monthly_plan", defaultMonthlyPlan);
  const [txCategories, setTxCategories] = usePersist("finyk_tx_cats", {});
  const [monoDebtLinkedTxIds, setMonoDebtLinkedTxIds] = usePersist("finyk_mono_debt_linked", {});
  const [networthHistory, setNetworthHistory] = usePersist("finyk_networth_history", []);
  const [txSplits, setTxSplits] = usePersist("finyk_tx_splits", {});

  const toggleHideAccount = (id) => setHiddenAccounts(h => h.includes(id) ? h.filter(x => x !== id) : [...h, id]);

  const toggleMonoDebtTx = (accountId, txId) => {
    setMonoDebtLinkedTxIds(prev => {
      const linked = prev[accountId] || [];
      return {
        ...prev,
        [accountId]: linked.includes(txId) ? linked.filter(x => x !== txId) : [...linked, txId],
      };
    });
  };

  const toggleLinkedTx = (id, txId, type) => {
    const setter = type === "debt" ? setManualDebts : setReceivables;
    setter(items => items.map(d => {
      if (d.id !== id) return d;
      const linked = d.linkedTxIds || [];
      return { ...d, linkedTxIds: linked.includes(txId) ? linked.filter(x => x !== txId) : [...linked, txId] };
    }));
  };

  const hideTx = (id) => setHiddenTxIds(ids =>
    ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
  );

  const setSplitTx = (txId, splits) => {
    setTxSplits(prev =>
      splits && splits.length >= 2
        ? { ...prev, [txId]: splits }
        : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== txId))
    );
  };

  const overrideCategory = (txId, catId) => {
    setTxCategories(prev =>
      catId
        ? { ...prev, [txId]: catId }
        : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== txId))
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
  };

  const exportData = () => {
    const data = { version: 1, budgets, subscriptions, manualAssets, manualDebts, receivables, hiddenAccounts, hiddenTxIds, monthlyPlan };
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finto-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try { applyData(JSON.parse(e.target.result)); alert("Дані імпортовано!"); }
      catch (err) { reportSilentError("import data", err); alert("Помилка: невірний формат файлу"); }
    };
    reader.readAsText(file);
  };

  // Sync: навмисно НЕ включаємо hiddenTxIds/hiddenAccounts — device-specific
  const generateSyncLink = () => {
    const data = { v: 2, b: budgets, s: subscriptions, a: manualAssets, d: manualDebts, r: receivables, mp: monthlyPlan };
    const encoded = btoa(encodeURIComponent(JSON.stringify(data)));
    const url = `${window.location.origin}${window.location.pathname}?sync=${encoded}`;
    return url;
  };

  const loadFromUrl = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const encoded = params.get("sync");
      if (!encoded) return false;
      const data = JSON.parse(decodeURIComponent(atob(encoded)));
      if (data.b) setBudgets(data.b);
      if (data.s) setSubscriptions(data.s);
      if (data.a) setManualAssets(data.a);
      if (data.d) setManualDebts(data.d);
      if (data.r) setReceivables(data.r);
      if (data.h) setHiddenAccounts(data.h);
      if (data.mp) setMonthlyPlan(data.mp);
      window.history.replaceState({}, "", window.location.pathname);
      return true;
    } catch (err) { reportSilentError("load sync from url", err); return false; }
  };

  // Транзакції позначені як внутрішній переказ — виключаємо зі статистики
  const transferTxIds = Object.entries(txCategories)
    .filter(([, catId]) => catId === INTERNAL_TRANSFER_ID)
    .map(([txId]) => txId);

  // ID транзакцій прив'язаних до пасивів — для відстеження погашення в Assets
  // НЕ виключаємо зі статистики, щоб вони відображались у категорії "Борги та кредити"
  const debtLinkedTxIds = new Set([
    ...manualDebts.flatMap(d => d.linkedTxIds || []),
    ...Object.values(monoDebtLinkedTxIds).flat(),
  ]);

  // Зі статистики виключаємо: приховані, внутрішні перекази, дебіторку (щоб повернення боргу не рахувалось як дохід)
  const excludedTxIds = new Set([
    ...hiddenTxIds,
    ...transferTxIds,
    ...receivables.flatMap(r => r.linkedTxIds || []),
  ]);

  return {
    hiddenAccounts, setHiddenAccounts, toggleHideAccount,
    budgets, setBudgets,
    subscriptions, setSubscriptions,
    manualAssets, setManualAssets,
    manualDebts, setManualDebts,
    receivables, setReceivables,
    monthlyPlan, setMonthlyPlan,
    toggleLinkedTx,
    hiddenTxIds, hideTx,
    exportData, importData,
    generateSyncLink, loadFromUrl,
    excludedTxIds,
    debtTxIds: debtLinkedTxIds, // зворотна сумісність
    txCategories, overrideCategory,
    txSplits, setSplitTx,
    monoDebtLinkedTxIds, toggleMonoDebtTx,
    debtLinkedTxIds,
    networthHistory,
    saveNetworthSnapshot: (networth) => {
      const key = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      setNetworthHistory(prev => {
        const filtered = prev.filter(s => s.month !== key);
        return [...filtered, { month: key, networth: Math.round(networth) }]
          .sort((a, b) => a.month.localeCompare(b.month))
          .slice(-12);
      });
    },
  };
}
