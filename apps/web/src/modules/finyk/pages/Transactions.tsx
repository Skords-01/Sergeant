import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { GroupedVirtuoso } from "react-virtuoso";
import { TxListItem } from "../components/TxListItem";
import { getCategory, getIncomeCategory, fmtAmt } from "../utils";
import { manualExpenseToTransaction } from "@sergeant/finyk-domain/domain/transactions";
import { mergeExpenseCategoryDefinitions, CURRENCY } from "../constants";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { Icon } from "@shared/components/ui/Icon";
import { Sheet } from "@shared/components/ui/Sheet";
import { cn } from "@shared/lib/cn";
import { perfMark, perfEnd } from "@shared/lib/perf";
import { useToast } from "@shared/hooks/useToast";
import { showUndoToast } from "@shared/lib/undoToast";
import { STORAGE_KEYS } from "@sergeant/shared";

const now = new Date();
const DAY_COLLAPSE_KEY = STORAGE_KEYS.FINYK_TX_DAY_COLLAPSE;

function dayKeyFromTx(ts) {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readDayCollapse() {
  try {
    const raw = localStorage.getItem(DAY_COLLAPSE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
    return {};
  } catch {
    return {};
  }
}

function writeDayCollapse(v) {
  try {
    localStorage.setItem(DAY_COLLAPSE_KEY, JSON.stringify(v));
  } catch {
    /* quota / private-mode — drop silently */
  }
}

// Усі дні згорнуті за замовчуванням; ручне розгортання зберігається
// в `overrides` і переживає перезавантаження (та міжтабову синхронізацію).
// `todayKey` лишається в сигнатурі на випадок, якщо колись захочемо
// повернути логіку "сьогодні завжди відкрите" через feature-toggle,
// але зараз користувач свідомо попросив згорнуто-за-замовчуванням.
function isDayExpanded(overrides, key, _todayKey) {
  return !!overrides[key];
}

function formatStickyDayLabel(key) {
  const [y, m, da] = key.split("-").map(Number);
  const d = new Date(y, m - 1, da);
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  const d0 = new Date(d);
  d0.setHours(0, 0, 0, 0);
  const diffDays = Math.round((t0.getTime() - d0.getTime()) / 86400000);
  if (diffDays === 0) return "Сьогодні";
  if (diffDays === 1) return "Вчора";
  return d.toLocaleDateString("uk-UA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function Transactions({
  mono,
  storage,
  showBalance = true,
  categoryFilter,
  onClearCategoryFilter,
  onEditManualExpense,
}) {
  const toast = useToast();
  const {
    realTx,
    loadingTx,
    lastUpdated,
    refresh,
    syncState,
    accounts,
    fetchMonth,
    historyTx,
    loadingHistory,
  } = mono;
  const {
    hiddenTxIds,
    hideTx,
    excludedTxIds,
    excludedStatTxIds,
    toggleExcludeFromStats,
    txCategories,
    customCategories,
    overrideCategory,
    txSplits,
    setSplitTx,
    manualExpenses,
    addManualExpense,
    removeManualExpense,
  } = storage;
  const [filter, setFilter] = useState("all");
  const [scrollParent, setScrollParent] = useState(null);

  // Stable refs for handlers used by memoized row — avoids re-rendering all
  // visible rows whenever any unrelated parent state changes.
  const handlersRef = useRef({
    hideTx,
    overrideCategory,
    setSplitTx,
    removeManualExpense,
    addManualExpense,
    onEditManualExpense,
    toast,
  });
  handlersRef.current = {
    hideTx,
    overrideCategory,
    setSplitTx,
    removeManualExpense,
    addManualExpense,
    onEditManualExpense,
    toast,
  };

  useEffect(() => {
    if (categoryFilter) {
      setFilter(categoryFilter);
      onClearCategoryFilter?.();
    }
  }, [categoryFilter, onClearCategoryFilter]);
  const [showHidden, setShowHidden] = useState(false);
  // Batch selection
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [batchCatPicker, setBatchCatPicker] = useState(false);

  // useCallback — `toggleSelect` передається у кожен рядок вибору.
  // Сталий reference спільно з React.memo(TxRow)/обгорткою чекбокса дає
  // змогу дочірнім елементам не перерендерюватись при оновленні батька.
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const stableHideTx = useCallback((id) => handlersRef.current.hideTx(id), []);
  const stableOverrideCategory = useCallback(
    (id, catId) => handlersRef.current.overrideCategory(id, catId),
    [],
  );
  const stableSetSplitTx = useCallback(
    (id, splits) => handlersRef.current.setSplitTx(id, splits),
    [],
  );
  const stableOnEditManual = useCallback((manualId) => {
    const fn = handlersRef.current.onEditManualExpense;
    if (typeof fn === "function") fn(manualId);
  }, []);
  const stableSwipeHideTx = useCallback(
    (id) => handlersRef.current.hideTx(id),
    [],
  );
  const stableSwipeDeleteManual = useCallback((tx) => {
    const { removeManualExpense, addManualExpense, toast } =
      handlersRef.current;
    if (!removeManualExpense || !addManualExpense) return;
    const snapshot = {
      id: String(tx._manualId),
      date: tx.time
        ? new Date(tx.time * 1000).toISOString()
        : new Date().toISOString(),
      description: String(tx.description || ""),
      amount: Math.abs(Number(tx.amount || 0) / 100),
      category: String(tx._category || "інше"),
    };
    removeManualExpense(tx._manualId);
    showUndoToast(toast, {
      msg: "Витрату видалено",
      onUndo: () => addManualExpense(snapshot),
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBatchCatPicker(false);
  }, []);

  // useCallback — використовується у batch-панелі; стабільний handler
  // дозволяє безпечно мемоїзувати toolbar у майбутньому.
  const applyBatchCategory = useCallback(
    (catId) => {
      for (const id of selectedIds) overrideCategory(id, catId);
      exitSelectMode();
    },
    [selectedIds, overrideCategory, exitSelectMode],
  );

  const applyBatchHide = useCallback(() => {
    for (const id of selectedIds) {
      if (!hiddenTxIds.includes(id)) hideTx(id);
    }
    exitSelectMode();
  }, [selectedIds, hiddenTxIds, hideTx, exitSelectMode]);

  const applyBatchExclude = useCallback(() => {
    for (const id of selectedIds) {
      if (!(excludedStatTxIds || []).includes(id)) toggleExcludeFromStats(id);
    }
    exitSelectMode();
  }, [selectedIds, excludedStatTxIds, toggleExcludeFromStats, exitSelectMode]);
  const [selMonth, setSelMonth] = useState(() => ({
    year: now.getFullYear(),
    month: now.getMonth(),
  }));

  const isCurrentMonth =
    selMonth.year === now.getFullYear() && selMonth.month === now.getMonth();

  const manualExpenseTxs = useMemo(() => {
    const monthStart = new Date(selMonth.year, selMonth.month, 1).getTime();
    const monthEnd = new Date(selMonth.year, selMonth.month + 1, 1).getTime();
    return (manualExpenses || [])
      .filter((e) => {
        const ts = new Date(e.date).getTime();
        return ts >= monthStart && ts < monthEnd;
      })
      .map((e) => manualExpenseToTransaction(e));
  }, [manualExpenses, selMonth]);

  const activeTx = useMemo(
    () => [...(isCurrentMonth ? realTx : historyTx), ...manualExpenseTxs],
    [isCurrentMonth, realTx, historyTx, manualExpenseTxs],
  );
  const activeLoading = isCurrentMonth ? loadingTx : loadingHistory;

  // useCallback — `goMonth` підв'язаний до двох кнопок навігації місяцями;
  // стабільний handler уникає створення нових замикань на кожен рендер.
  const goMonth = useCallback(
    (delta) => {
      setSelMonth((prev) => {
        let m = prev.month + delta;
        let y = prev.year;
        if (m < 0) {
          m = 11;
          y--;
        }
        if (m > 11) {
          m = 0;
          y++;
        }
        if (!(y === now.getFullYear() && m === now.getMonth()))
          fetchMonth(y, m);
        return { year: y, month: m };
      });
    },
    [fetchMonth],
  );

  const monthLabel = new Date(
    selMonth.year,
    selMonth.month,
    1,
  ).toLocaleDateString("uk-UA", { month: "long", year: "numeric" });

  const creditAccIds = useMemo(
    () =>
      new Set(
        (accounts || []).filter((a) => a.creditLimit > 0).map((a) => a.id),
      ),
    [accounts],
  );

  const hiddenTxIdSet = useMemo(
    () => new Set(hiddenTxIds || []),
    [hiddenTxIds],
  );

  const getEffectiveCat = useCallback(
    (t) =>
      t.amount > 0
        ? getIncomeCategory(t.description, txCategories[t.id])
        : getCategory(
            t.description,
            t.mcc,
            txCategories[t.id],
            customCategories,
          ),
    [txCategories, customCategories],
  );

  const statTx = useMemo(
    () => activeTx.filter((t) => !excludedTxIds.has(t.id)),
    [activeTx, excludedTxIds],
  );
  const catSpends = useMemo(
    () =>
      mergeExpenseCategoryDefinitions(customCategories)
        .filter((c) => c.id !== "income")
        .map((cat) => ({
          ...cat,
          spent: Math.round(
            statTx
              .filter((t) => t.amount < 0)
              .reduce((s, t) => {
                const splits = txSplits?.[t.id];
                if (splits && splits.length > 0)
                  return (
                    s +
                    splits
                      .filter((sp) => sp.categoryId === cat.id)
                      .reduce((ss, sp) => ss + (sp.amount || 0), 0)
                  );
                return getEffectiveCat(t).id === cat.id
                  ? s + Math.abs(t.amount / 100)
                  : s;
              }, 0),
          ),
        }))
        .filter((c) => c.spent > 0)
        .sort((a, b) => b.spent - a.spent),
    [statTx, txSplits, getEffectiveCat, customCategories],
  );

  const txsToShow = useMemo(
    () =>
      showHidden ? activeTx : activeTx.filter((t) => !hiddenTxIdSet.has(t.id)),
    [activeTx, hiddenTxIdSet, showHidden],
  );

  const sortedTxs = useMemo(() => {
    const m = perfMark("finyk:tx:sort");
    const next = [...txsToShow].sort((a, b) => (b.time || 0) - (a.time || 0));
    perfEnd(m, { n: next.length });
    return next;
  }, [txsToShow]);

  const filtered = useMemo(() => {
    const m = perfMark("finyk:tx:filter");
    const res = sortedTxs.filter((t) => {
      if (filter === "all") return true;
      if (filter === "income") return t.amount > 0;
      if (filter === "expense") return t.amount < 0;
      if (filter === "credit") return creditAccIds.has(t._accountId);
      return getEffectiveCat(t).id === filter;
    });
    perfEnd(m, { n: res.length });
    return res;
  }, [sortedTxs, filter, creditAccIds, getEffectiveCat]);

  const groupedByDate = useMemo(() => {
    const m = perfMark("finyk:tx:groupByDate");
    const groups = [];
    for (const t of filtered) {
      const k = dayKeyFromTx(t.time);
      const last = groups[groups.length - 1];
      if (last && last.key === k) last.items.push(t);
      else groups.push({ key: k, items: [t] });
    }
    perfEnd(m, { groups: groups.length });
    return groups;
  }, [filtered]);

  // Per-day totals (signed amount in cents, item count). Cheap enough to
  // compute during grouping, but kept separate so the collapsed-header
  // summary doesn't force us to touch the hot grouping loop.
  const daySummaries = useMemo(() => {
    const map = {};
    for (const g of groupedByDate) {
      let total = 0;
      for (const t of g.items) total += Number(t.amount || 0);
      map[g.key] = { total, count: g.items.length };
    }
    return map;
  }, [groupedByDate]);

  // Day collapse/expand state. Persisted as a sparse override map:
  // absence → default rule (only "today" is expanded). Explicit boolean
  // overrides the default and survives across sessions.
  const todayDayKey = useMemo(
    () => dayKeyFromTx(Math.floor(Date.now() / 1000)),
    [],
  );
  const [dayOverrides, setDayOverrides] = useState(() => readDayCollapse());

  // Sync with other tabs: another Finyk tab toggling the same day should
  // immediately reflect here, matching how the rest of the module treats
  // localStorage as the single source of truth.
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== DAY_COLLAPSE_KEY) return;
      setDayOverrides(readDayCollapse());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggleDay = useCallback(
    (key) => {
      setDayOverrides((prev) => {
        const expanded = isDayExpanded(prev, key, todayDayKey);
        const next = { ...prev, [key]: !expanded };
        writeDayCollapse(next);
        return next;
      });
    },
    [todayDayKey],
  );

  // Фільтр-чіпи (Витрати/Доходи/Кредитна/Борг) більше не форсять
  // розгортання — користувач явно хотів, щоб згортання працювало
  // навіть під активним фільтром (inbox-style). `groupedByDate` уже
  // обчислено з відфільтрованого `filtered`, тож у згорнутій групі
  // лічильник під датою показує кількість саме *відфільтрованих*
  // транзакцій — нічого не зникає, все одно тап розгортає.
  const collapsedKeys = useMemo(() => {
    const s = new Set();
    for (const g of groupedByDate) {
      if (!isDayExpanded(dayOverrides, g.key, todayDayKey)) s.add(g.key);
    }
    return s;
  }, [groupedByDate, dayOverrides, todayDayKey]);

  const groupCounts = useMemo(
    () =>
      groupedByDate.map((g) => (collapsedKeys.has(g.key) ? 0 : g.items.length)),
    [groupedByDate, collapsedKeys],
  );

  // GroupedVirtuoso передає глобальний (плоский) індекс — будуємо плоский масив
  const flatItems = useMemo(
    () =>
      groupedByDate.flatMap((g) => (collapsedKeys.has(g.key) ? [] : g.items)),
    [groupedByDate, collapsedKeys],
  );

  const syncColor =
    syncState?.status === "error"
      ? "text-danger"
      : syncState?.status === "partial"
        ? "text-warning"
        : "text-subtle";

  return (
    <div ref={setScrollParent} className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => goMonth(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-subtle hover:text-text hover:bg-panelHi transition-colors text-lg"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-text capitalize px-1">
              {monthLabel}
            </span>
            <button
              onClick={() => goMonth(1)}
              disabled={isCurrentMonth}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-subtle hover:text-text hover:bg-panelHi transition-colors text-lg disabled:opacity-30"
            >
              ›
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            {selectMode ? (
              <button
                onClick={exitSelectMode}
                className="text-xs px-3 py-2 rounded-full border border-primary/40 bg-primary/8 text-primary min-h-[36px] font-semibold"
              >
                Скасувати
              </button>
            ) : (
              <>
                {hiddenTxIds.length > 0 && (
                  <button
                    onClick={() => setShowHidden((v) => !v)}
                    className={cn(
                      "text-xs px-3 py-2 rounded-full border border-line transition-colors min-h-[36px]",
                      showHidden
                        ? "text-primary border-primary"
                        : "text-subtle",
                    )}
                  >
                    {showHidden ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <span>{hiddenTxIds.length} прих.</span>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setSelectMode(true)}
                  className="text-xs px-3 py-2 rounded-full border border-line text-subtle hover:text-text hover:border-muted transition-colors min-h-[36px]"
                  title="Вибрати кілька"
                  aria-label="Режим вибору"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </button>
                <button
                  onClick={refresh}
                  disabled={activeLoading}
                  className="text-xs px-3 py-2 rounded-full border border-line text-subtle hover:text-text hover:border-muted transition-colors disabled:opacity-40 min-h-[36px]"
                  aria-label="Оновити"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={activeLoading ? "motion-safe:animate-spin" : ""}
                    aria-hidden
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Sync status */}
        {syncState?.status !== "idle" && (
          <div className={cn("text-xs mb-1", syncColor)}>
            {syncState.status === "loading"
              ? "⟳ оновлення…"
              : syncState.status === "success"
                ? "✓ синхронізовано"
                : syncState.status === "partial"
                  ? "⚠ частково"
                  : "✕ помилка"}{" "}
            ·{" "}
            {syncState.source === "network"
              ? "мережа"
              : syncState.source === "cache"
                ? "кеш"
                : "нема"}{" "}
            · {syncState.accountsOk}/{syncState.accountsTotal} акаунтів
          </div>
        )}
        {lastUpdated && (
          <div className="text-xs text-subtle mb-3">
            Оновлено:{" "}
            {lastUpdated.toLocaleTimeString("uk-UA", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}

        {/* Filters */}
        <div
          data-finyk-no-swipe
          className="mb-4 -mx-4 px-4 overflow-x-auto no-scrollbar"
        >
          <div className="flex gap-1.5 whitespace-nowrap">
            {[
              { id: "all", label: "Всі" },
              { id: "expense", label: "Витрати" },
              { id: "income", label: "Доходи" },
              ...(creditAccIds.size > 0
                ? [{ id: "credit", label: "💳 Кредитна" }]
                : []),
              ...catSpends.map((c) => ({
                id: c.id,
                label: c.label.split(" ")[0] + " " + c.label.slice(3),
              })),
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "text-xs px-4 py-2 rounded-full border transition-colors min-h-[36px]",
                  filter === f.id
                    ? "bg-primary border-primary text-white"
                    : "bg-transparent border-line text-subtle hover:border-muted hover:text-muted",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Skeleton */}
        {activeLoading && activeTx.length === 0 && (
          <div className="space-y-2">
            {Array(10)
              .fill(0)
              .map((_, i) => (
                <Skeleton
                  key={i}
                  className={cn(
                    "h-14",
                    i % 3 === 0
                      ? "opacity-100"
                      : i % 3 === 1
                        ? "opacity-70"
                        : "opacity-40",
                  )}
                />
              ))}
          </div>
        )}

        {/* Empty */}
        {filtered.length === 0 && !activeLoading && (
          <div className="rounded-2xl border border-dashed border-line bg-panelHi/40">
            <EmptyState
              icon={<Icon name="credit-card" size={20} strokeWidth={1.6} />}
              title="Немає транзакцій"
              description="Зміни місяць, фільтр або переключи «приховані», якщо вони є."
            />
          </div>
        )}

        {/* Virtualized list */}
        {filtered.length > 0 && (
          <div className="rounded-2xl border border-line/40 overflow-hidden -mx-px">
            <GroupedVirtuoso
              customScrollParent={scrollParent}
              groupCounts={groupCounts}
              increaseViewportBy={{ top: 400, bottom: 400 }}
              groupContent={(groupIndex) => {
                const group = groupedByDate[groupIndex];
                if (!group) return null;
                const key = group.key;
                const collapsed = collapsedKeys.has(key);
                const summary = daySummaries[key] ?? { total: 0, count: 0 };
                const showTotal = showBalance && summary.count > 0;
                const sign = summary.total > 0 ? "+" : "";
                const label = formatStickyDayLabel(key);
                return (
                  <button
                    type="button"
                    onClick={() => toggleDay(key)}
                    aria-expanded={!collapsed}
                    aria-label={`${collapsed ? "Розгорнути" : "Згорнути"} ${label}`}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-bg/95 backdrop-blur-sm border-b border-line text-xs font-semibold text-subtle tracking-wide hover:text-text hover:bg-panelHi transition-colors"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                        className="shrink-0 motion-safe:transition-transform motion-safe:duration-150"
                        style={{
                          transform: collapsed
                            ? "rotate(-90deg)"
                            : "rotate(0deg)",
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      <span className="truncate">{label}</span>
                      <span className="shrink-0 text-[10px] font-normal text-subtle/70 normal-case tabular-nums">
                        · {summary.count}
                      </span>
                    </span>
                    {showTotal && (
                      <span
                        className={cn(
                          "shrink-0 tabular-nums",
                          summary.total > 0 ? "text-success" : "text-text",
                        )}
                      >
                        {sign}
                        {fmtAmt(summary.total, CURRENCY.UAH)}
                      </span>
                    )}
                  </button>
                );
              }}
              itemContent={(index) => {
                const t = flatItems[index];
                if (!t) return null;
                return (
                  <TxListItem
                    tx={t}
                    rowIndex={index}
                    selectMode={selectMode}
                    selected={selectMode && selectedIds.has(t.id)}
                    hidden={hiddenTxIdSet.has(t.id)}
                    overrideCatId={txCategories[t.id]}
                    txSplits={txSplits}
                    accounts={accounts}
                    hideAmount={!showBalance}
                    customCategories={customCategories}
                    onToggleSelect={toggleSelect}
                    onSwipeHideTx={stableSwipeHideTx}
                    onSwipeDeleteManual={stableSwipeDeleteManual}
                    onEditManual={stableOnEditManual}
                    onHideTx={stableHideTx}
                    onCatChange={stableOverrideCategory}
                    onSplitChange={stableSetSplitTx}
                  />
                );
              }}
            />
          </div>
        )}

        {activeLoading && activeTx.length > 0 && (
          <p className="text-center text-xs text-subtle py-2">⟳ оновлення…</p>
        )}
      </div>

      {/* Batch action toolbar */}
      {selectMode && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] safe-area-pb">
          <div className="max-w-4xl mx-auto px-4 pb-[calc(60px+env(safe-area-inset-bottom,0px)+0.5rem)] pt-3">
            <div className="bg-panel border border-line rounded-2xl shadow-float px-4 py-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-text">
                {selectedIds.size > 0
                  ? `${selectedIds.size} обрано`
                  : "Оберіть транзакції"}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {selectedIds.size > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setBatchCatPicker(true)}
                      className="text-sm font-semibold px-4 py-2 rounded-xl bg-primary text-bg min-h-[40px] transition-colors"
                    >
                      Категорія
                    </button>
                    <button
                      type="button"
                      onClick={applyBatchHide}
                      className="text-sm font-semibold px-4 py-2 rounded-xl border border-line bg-panelHi text-text min-h-[40px] transition-colors hover:border-muted"
                    >
                      Приховати
                    </button>
                    <button
                      type="button"
                      onClick={applyBatchExclude}
                      className="text-sm font-semibold px-4 py-2 rounded-xl border border-line bg-panelHi text-text min-h-[40px] transition-colors hover:border-muted"
                    >
                      Зі статистики
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch category picker */}
      <Sheet
        open={batchCatPicker}
        onClose={() => setBatchCatPicker(false)}
        title="Вибрати категорію"
        description={`Застосується до ${selectedIds.size} транзакц${selectedIds.size === 1 ? "ії" : "ій"}`}
        panelClassName="finyk-sheet"
        zIndex={70}
        bodyClassName="px-4 pb-6 flex flex-col gap-1"
      >
        {mergeExpenseCategoryDefinitions(customCategories)
          .filter((c) => c.id !== "income")
          .map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => applyBatchCategory(cat.id)}
              className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-panelHi transition-colors min-h-[48px]"
            >
              <span className="text-lg">
                {(cat as { emoji?: string }).emoji}
              </span>
              <span className="text-sm font-medium text-text">{cat.label}</span>
            </button>
          ))}
      </Sheet>
    </div>
  );
}
