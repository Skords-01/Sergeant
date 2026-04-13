import { useState, useMemo, useEffect, useCallback } from "react";
import { TxRow } from "../components/TxRow";
import { getCategory, getIncomeCategory } from "../utils";
import { mergeExpenseCategoryDefinitions } from "../constants";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { cn } from "@shared/lib/cn";

const now = new Date();
const PAGE_SIZE = 80;

function dayKeyFromTx(ts) {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatStickyDayLabel(key) {
  const [y, m, da] = key.split("-").map(Number);
  const d = new Date(y, m - 1, da);
  const t0 = new Date();
  t0.setHours(0, 0, 0, 0);
  const d0 = new Date(d);
  d0.setHours(0, 0, 0, 0);
  const diffDays = Math.round((t0 - d0) / 86400000);
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
}) {
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
    txCategories,
    customCategories,
    overrideCategory,
    txSplits,
    setSplitTx,
  } = storage;
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (categoryFilter) {
      setFilter(categoryFilter);
      onClearCategoryFilter?.();
    }
  }, [categoryFilter, onClearCategoryFilter]);
  const [showHidden, setShowHidden] = useState(false);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selMonth, setSelMonth] = useState(() => ({
    year: now.getFullYear(),
    month: now.getMonth(),
  }));

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selMonth, filter, search, showHidden]);

  const isCurrentMonth =
    selMonth.year === now.getFullYear() && selMonth.month === now.getMonth();
  const activeTx = isCurrentMonth ? realTx : historyTx;
  const activeLoading = isCurrentMonth ? loadingTx : loadingHistory;

  const goMonth = (delta) => {
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
      if (!(y === now.getFullYear() && m === now.getMonth())) fetchMonth(y, m);
      return { year: y, month: m };
    });
  };

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
      showHidden
        ? activeTx
        : activeTx.filter((t) => !hiddenTxIds.includes(t.id)),
    [activeTx, hiddenTxIds, showHidden],
  );
  const filtered = useMemo(
    () =>
      txsToShow.filter((t) => {
        const matchFilter =
          filter === "all"
            ? true
            : filter === "income"
              ? t.amount > 0
              : filter === "expense"
                ? t.amount < 0
                : filter === "credit"
                  ? creditAccIds.has(t._accountId)
                  : getEffectiveCat(t).id === filter;
        const matchSearch =
          !search.trim() ||
          (t.description || "").toLowerCase().includes(search.toLowerCase());
        return matchFilter && matchSearch;
      }),
    [txsToShow, filter, search, creditAccIds, getEffectiveCat],
  );

  const visibleSorted = useMemo(
    () => [...filtered].sort((a, b) => b.time - a.time).slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const groupedByDate = useMemo(() => {
    const groups = [];
    for (const t of visibleSorted) {
      const k = dayKeyFromTx(t.time);
      const last = groups[groups.length - 1];
      if (last && last.key === k) last.items.push(t);
      else groups.push({ key: k, items: [t] });
    }
    return groups;
  }, [visibleSorted]);

  const syncColor =
    syncState?.status === "error"
      ? "text-danger"
      : syncState?.status === "partial"
        ? "text-warning"
        : "text-subtle";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))]">
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
            {hiddenTxIds.length > 0 && (
              <button
                onClick={() => setShowHidden((v) => !v)}
                className={cn(
                  "text-xs px-3 py-2 rounded-full border border-line transition-colors min-h-[36px]",
                  showHidden ? "text-primary border-primary" : "text-subtle",
                )}
              >
                {showHidden ? "👁" : `🗑 ${hiddenTxIds.length}`}
              </button>
            )}
            <button
              onClick={refresh}
              disabled={activeLoading}
              className="text-xs px-3 py-2 rounded-full border border-line text-subtle hover:text-text hover:border-muted transition-colors disabled:opacity-40 min-h-[36px]"
            >
              {activeLoading ? "⟳" : "🔄"}
            </button>
          </div>
        </div>

        {/* Sync status */}
        {syncState?.status !== "idle" && (
          <div className={cn("text-xs mb-1", syncColor)}>
            {syncState.status === "loading"
              ? "⟳ оновлення..."
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

        {/* Search */}
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle text-sm">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук по транзакціях..."
            className="w-full bg-panelHi border border-line rounded-2xl pl-9 pr-4 py-2.5 text-sm text-text placeholder:text-subtle focus:outline-none focus:border-primary/50 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-text"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="mb-4 -mx-4 px-4 overflow-x-auto no-scrollbar">
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
          <div className="rounded-2xl border border-dashed border-line/60 bg-panelHi/40 px-6 py-12 text-center">
            <p className="text-sm font-medium text-text">
              {search.trim()
                ? `Нічого не знайдено за «${search}»`
                : "Немає транзакцій за цими умовами"}
            </p>
            <p className="text-xs text-subtle mt-2 max-w-sm mx-auto leading-relaxed">
              {search.trim()
                ? "Спробуй інший запит або очисть пошук."
                : "Зміни місяць, фільтр або переключи «приховані», якщо вони є."}
            </p>
            {search.trim() && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-4 text-sm font-semibold text-primary hover:underline"
              >
                Очистити пошук
              </button>
            )}
          </div>
        )}

        {/* List */}
        {filtered.length > 0 && (
          <div className="rounded-2xl border border-line/40 overflow-hidden -mx-px">
            {groupedByDate.map((g) => (
              <div key={g.key}>
                <div
                  className="sticky top-0 z-10 px-3 py-2 bg-bg/95 backdrop-blur-sm border-b border-line/50 text-[11px] font-semibold text-subtle tracking-wide"
                  role="presentation"
                >
                  {formatStickyDayLabel(g.key)}
                </div>
                {g.items.map((t, i) => (
                  <div
                    key={t.id}
                    className={cn(
                      "px-1 sm:px-2",
                      i % 2 === 1 && "bg-panelHi/25",
                    )}
                  >
                    <TxRow
                      tx={t}
                      onHide={hideTx}
                      hidden={hiddenTxIds.includes(t.id)}
                      overrideCatId={txCategories[t.id]}
                      onCatChange={overrideCategory}
                      accounts={accounts}
                      hideAmount={!showBalance}
                      txSplits={txSplits}
                      onSplitChange={setSplitTx}
                      customCategories={customCategories}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {activeLoading && activeTx.length > 0 && (
          <p className="text-center text-xs text-subtle py-2">⟳ оновлення...</p>
        )}
        {filtered.length > visibleCount && (
          <div className="flex flex-col items-center gap-2 py-4">
            <p className="text-xs text-subtle">
              Показано {visibleCount} з {filtered.length}
            </p>
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="text-sm font-semibold text-primary px-4 py-2 rounded-xl border border-line hover:bg-panelHi transition-colors min-h-[44px]"
            >
              Завантажити ще
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
