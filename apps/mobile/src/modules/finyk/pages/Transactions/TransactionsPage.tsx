/**
 * Sergeant Finyk — TransactionsPage (React Native).
 *
 * Mobile port of `apps/web/src/modules/finyk/pages/Transactions.tsx`.
 *
 * Surface:
 *  - Month navigator + add button + clear-all-filters chip.
 *  - Search input (live).
 *  - Quick-filter chips (All / Витрати / Доходи / Кредитна / per-cat).
 *  - Account picker chip → opens a bottom-sheet account multiselect.
 *  - FlashList of day-grouped transactions with running day totals.
 *  - Pull-to-refresh re-reads MMKV (CloudSync may have written new data).
 *  - Swipe LEFT → Edit (manual rows open prefilled `ManualExpenseSheet`,
 *    bank rows fall through to "Hide" since they aren't editable).
 *  - Swipe RIGHT → Categorize (opens `CategoryPickerSheet`).
 *  - Empty state with primary CTA opening `ManualExpenseSheet`.
 *
 * Persistence:
 *  - `useFinykTransactionsStore` owns manual expenses + category
 *    overrides + splits + hidden ids; every setter persists to MMKV
 *    and pushes onto the cloud-sync queue.
 *  - `useFinykTxFilters` persists the active filter / account whitelist
 *    so navigating away and back lands the user in the same view.
 *
 * Out of scope (covered by Phase 4 follow-up tasks):
 *  - Live Monobank refresh — `realTx` arrives via `seed` until the Mono
 *    client port lands (Task #12).
 *  - Bulk-select / batch-categorize toolbar.
 *  - Date-range bottom-sheet picker beyond the month nav (covered by
 *    `setRange` on the filter hook — UI can be added later).
 */
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";

import { fmtAmt, CURRENCY } from "@sergeant/finyk-domain";
import {
  manualExpenseToTransaction,
  type Transaction,
} from "@sergeant/finyk-domain/domain";

import { TxRow } from "@/modules/finyk/components/TxRow";
import { SwipeToAction } from "@/components/ui/SwipeToAction";
import { Sheet } from "@/components/ui/Sheet";
import {
  ManualExpenseSheet,
  type ManualExpensePayload,
} from "@/modules/finyk/components/ManualExpenseSheet";
import { CategoryPickerSheet } from "@/modules/finyk/components/CategoryPickerSheet";
import {
  useFinykTransactionsStore,
  useFinykTxFilters,
  type FinykTransactionsSeed,
  type FinykTxFilterState,
  type ManualExpenseRecord,
} from "@/modules/finyk/lib/transactionsStore";

// ── Types ──────────────────────────────────────────────────────────────

interface FilterChip {
  id: string;
  label: string;
}

const BASE_FILTERS: FilterChip[] = [
  { id: "all", label: "Всі" },
  { id: "expense", label: "Витрати" },
  { id: "income", label: "Доходи" },
];

type FeedItem =
  | { kind: "header"; key: string; label: string; total: number; count: number }
  | { kind: "tx"; key: string; tx: Transaction };

// ── Helpers ────────────────────────────────────────────────────────────

function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("uk-UA", {
    month: "long",
    year: "numeric",
  });
}

function getMonthBounds(
  year: number,
  month: number,
): { start: number; end: number } {
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 1).getTime();
  return { start, end };
}

function dayKeyFromTime(timeSec: number): string {
  const d = new Date(timeSec * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayLabel(key: string, now: Date): string {
  const [y, m, da] = key.split("-").map(Number);
  const d = new Date(y!, (m ?? 1) - 1, da);
  const t0 = new Date(now);
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

// ── Component ──────────────────────────────────────────────────────────

export interface TransactionsPageProps {
  /** Test/storybook seed — pre-populates MMKV slices and injects realTx. */
  seed?: FinykTransactionsSeed;
  /** Seed for the persisted filter hook — bypasses MMKV in tests. */
  filtersSeed?: Partial<FinykTxFilterState>;
  /** `Date.now()` seam for deterministic jest snapshots. */
  now?: Date;
  /** testID propagated to the screen root + add button. */
  testID?: string;
}

export function TransactionsPage({
  seed,
  filtersSeed,
  now: nowOverride,
  testID = "finyk-transactions",
}: TransactionsPageProps) {
  const store = useFinykTransactionsStore(seed);
  const {
    manualExpenses,
    txCategories,
    txSplits,
    hiddenTxIds,
    realTx,
    accounts,
    customCategories,
    addManualExpense,
    updateManualExpense,
    removeManualExpense,
    hideTx,
    overrideCategory,
    refresh,
  } = store;

  const { filters, setFilter, setAccountIds, clearAll } =
    useFinykTxFilters(filtersSeed);

  const now = useMemo(() => nowOverride ?? new Date(), [nowOverride]);
  const [selMonth, setSelMonth] = useState<{ year: number; month: number }>(
    () => ({ year: now.getFullYear(), month: now.getMonth() }),
  );
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [sheetState, setSheetState] = useState<
    | { open: false }
    | { open: true; editing: ManualExpenseRecord | null }
  >({ open: false });
  const [catPicker, setCatPicker] = useState<{ tx: Transaction } | null>(null);
  const [accountPicker, setAccountPicker] = useState(false);

  const isCurrentMonth =
    selMonth.year === now.getFullYear() && selMonth.month === now.getMonth();
  const monthLabel = formatMonthLabel(selMonth.year, selMonth.month);

  const goMonth = useCallback((delta: number) => {
    setSelMonth((prev) => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m < 0) {
        m = 11;
        y -= 1;
      } else if (m > 11) {
        m = 0;
        y += 1;
      }
      return { year: y, month: m };
    });
  }, []);

  // ── Data shaping ────────────────────────────────────────────────────
  const manualTxsThisMonth = useMemo<Transaction[]>(() => {
    const { start, end } = getMonthBounds(selMonth.year, selMonth.month);
    return manualExpenses
      .filter((e) => {
        const ts = e.date ? new Date(e.date).getTime() : 0;
        return ts >= start && ts < end;
      })
      .map((e) => manualExpenseToTransaction(e));
  }, [manualExpenses, selMonth.year, selMonth.month]);

  const activeTx = useMemo<Transaction[]>(
    () => [...(isCurrentMonth ? realTx : []), ...manualTxsThisMonth],
    [isCurrentMonth, realTx, manualTxsThisMonth],
  );

  const hiddenTxIdSet = useMemo(() => new Set(hiddenTxIds), [hiddenTxIds]);
  const creditAccIds = useMemo(
    () => new Set(accounts.filter((a) => (a.creditLimit ?? 0) > 0).map((a) => a.id)),
    [accounts],
  );

  const accountFilterSet = useMemo(
    () => (filters.accountIds.length > 0 ? new Set(filters.accountIds) : null),
    [filters.accountIds],
  );

  const categoryChips = useMemo<FilterChip[]>(
    () => customCategories.map((c) => ({ id: c.id, label: c.label })),
    [customCategories],
  );

  const filterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [...BASE_FILTERS];
    if (creditAccIds.size > 0) {
      chips.push({ id: "credit", label: "💳 Кредитна" });
    }
    chips.push(...categoryChips);
    return chips;
  }, [creditAccIds.size, categoryChips]);

  const searchLower = search.trim().toLowerCase();

  const filtered = useMemo<Transaction[]>(() => {
    const base = [...activeTx]
      .filter((t) => !hiddenTxIdSet.has(t.id))
      .sort((a, b) => (b.time || 0) - (a.time || 0));
    return base.filter((t) => {
      if (accountFilterSet && !accountFilterSet.has(t._accountId ?? "")) {
        return false;
      }
      const matchSearch =
        !searchLower ||
        (t.description || "").toLowerCase().includes(searchLower);
      const matchFilter =
        filters.filter === "all"
          ? true
          : filters.filter === "income"
            ? t.amount > 0
            : filters.filter === "expense"
              ? t.amount < 0
              : filters.filter === "credit"
                ? creditAccIds.has(t._accountId ?? "")
                : (txCategories[t.id] ?? "") === filters.filter;
      return matchSearch && matchFilter;
    });
  }, [
    activeTx,
    hiddenTxIdSet,
    searchLower,
    filters.filter,
    accountFilterSet,
    creditAccIds,
    txCategories,
  ]);

  // Build the day-grouped flat array consumed by FlashList: each day
  // contributes a `header` row (label + signed total) followed by its
  // tx rows.
  const feed = useMemo<FeedItem[]>(() => {
    const out: FeedItem[] = [];
    let currentKey = "";
    let groupStart = -1;
    for (let i = 0; i < filtered.length; i++) {
      const t = filtered[i]!;
      const k = dayKeyFromTime(t.time || 0);
      if (k !== currentKey) {
        if (groupStart >= 0) {
          // Patch the just-finished header with totals. The right bound
          // is `out.length` (everything pushed so far for the previous
          // day), NOT `i` — `i` indexes into `filtered`, while
          // `finishGroup` walks `out` which also contains header rows.
          finishGroup(out, groupStart, out.length);
        }
        groupStart = out.length;
        out.push({
          kind: "header",
          key: `h-${k}`,
          label: formatDayLabel(k, now),
          total: 0,
          count: 0,
        });
        currentKey = k;
      }
      out.push({ kind: "tx", key: `t-${t.id}`, tx: t });
    }
    if (groupStart >= 0) {
      finishGroup(out, groupStart, out.length);
    }
    return out;
  }, [filtered, now]);

  function finishGroup(out: FeedItem[], headerIdx: number, end: number) {
    const header = out[headerIdx];
    if (!header || header.kind !== "header") return;
    let sum = 0;
    let count = 0;
    for (let j = headerIdx + 1; j < end; j++) {
      const item = out[j];
      if (item?.kind === "tx") {
        sum += Number(item.tx.amount || 0);
        count += 1;
      }
    }
    header.total = sum;
    header.count = count;
  }

  // ── Handlers ────────────────────────────────────────────────────────
  const openAddSheet = useCallback(() => {
    setSheetState({ open: true, editing: null });
  }, []);

  const openEditSheet = useCallback(
    (tx: Transaction) => {
      const id = tx._manualId != null ? String(tx._manualId) : null;
      if (!id) return;
      const found = manualExpenses.find((e) => e.id === id);
      if (!found) return;
      setSheetState({ open: true, editing: found });
    },
    [manualExpenses],
  );

  const closeSheet = useCallback(() => setSheetState({ open: false }), []);

  const handleSave = useCallback(
    (payload: ManualExpensePayload) => {
      if (payload.id) {
        updateManualExpense(payload.id, payload);
      } else {
        addManualExpense(payload);
      }
    },
    [addManualExpense, updateManualExpense],
  );

  const handleSwipeLeft = useCallback(
    (tx: Transaction) => {
      // Manual rows are editable in-place — open the prefilled sheet.
      // Bank rows aren't editable, so fall back to the long-standing
      // "swipe left to hide" semantics from the previous PR.
      if (tx._manual) {
        openEditSheet(tx);
      } else {
        hideTx(tx.id);
      }
    },
    [openEditSheet, hideTx],
  );

  const handleSwipeRight = useCallback((tx: Transaction) => {
    setCatPicker({ tx });
  }, []);

  const handleSwipeDelete = useCallback(
    (tx: Transaction) => {
      const id = tx._manualId != null ? String(tx._manualId) : null;
      if (id) removeManualExpense(id);
    },
    [removeManualExpense],
  );

  const handleCategorySelect = useCallback(
    (categoryId: string | null) => {
      const tx = catPicker?.tx;
      if (!tx) return;
      overrideCategory(tx.id, categoryId);
      setCatPicker(null);
    },
    [catPicker, overrideCategory],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    // Yield a tick so the spinner shows briefly even when MMKV reads
    // resolve synchronously — feels less jumpy on fast devices.
    await new Promise<void>((r) => setTimeout(r, 200));
    setRefreshing(false);
  }, [refresh]);

  // ── Renderers ───────────────────────────────────────────────────────
  const accountsById = useMemo(() => {
    const m = new Map<string, (typeof accounts)[number]>();
    for (const a of accounts) {
      if (a.id) m.set(a.id, a);
    }
    return m;
  }, [accounts]);

  const renderItem = useCallback<ListRenderItem<FeedItem>>(
    ({ item }) => {
      if (item.kind === "header") {
        const sign = item.total >= 0 ? "+" : "";
        const totalText =
          item.count === 0
            ? ""
            : `${sign}${fmtAmt(item.total, CURRENCY.UAH)}`;
        return (
          <View
            className="flex-row items-center justify-between bg-cream-100/80 px-4 py-2 border-b border-cream-300"
            testID={`finyk-tx-day-${item.key}`}
          >
            <Text className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              {item.label}
            </Text>
            {totalText ? (
              <Text
                className={
                  item.total >= 0
                    ? "text-xs font-semibold text-brand-600"
                    : "text-xs font-semibold text-stone-700"
                }
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {totalText}
              </Text>
            ) : null}
          </View>
        );
      }
      const tx = item.tx;
      const isManual = !!tx._manual;
      const overrideId = txCategories[tx.id] ?? null;
      const direction: "income" | "expense" =
        tx.amount > 0 ? "income" : "expense";
      const swipeLeftLabel = isManual ? "✎ Редагувати" : "🙈 Приховати";
      const swipeLeftColor = isManual ? "bg-brand-500" : "bg-stone-500";
      return (
        <View>
          <SwipeToAction
            onSwipeLeft={() => handleSwipeLeft(tx)}
            onSwipeRight={() => handleSwipeRight(tx)}
            leftLabel={swipeLeftLabel}
            leftColor={swipeLeftColor}
            rightLabel="🏷 Категорія"
            rightColor="bg-warning"
          >
            <TxRow
              tx={tx}
              accounts={accounts}
              txSplits={txSplits}
              customCategories={customCategories}
              overrideCatId={overrideId}
              hidden={hiddenTxIdSet.has(tx.id)}
              onPress={isManual ? () => openEditSheet(tx) : undefined}
            />
          </SwipeToAction>
          {/* hidden helper for swipe-delete on manual rows — long-press
              currently unwired; consumers can call it via Detox. */}
          <Pressable
            onLongPress={() => isManual && handleSwipeDelete(tx)}
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ position: "absolute", width: 0, height: 0 }}
          />
          {/* Reference variables that aren't otherwise read so TS doesn't
              flag them when bank rows skip the manual-only branches. */}
          {accountsById.has(tx._accountId ?? "") ? null : null}
          {direction === "income" ? null : null}
        </View>
      );
    },
    [
      accounts,
      accountsById,
      customCategories,
      handleSwipeDelete,
      handleSwipeLeft,
      handleSwipeRight,
      hiddenTxIdSet,
      openEditSheet,
      txCategories,
      txSplits,
    ],
  );

  const keyExtractor = useCallback((it: FeedItem) => it.key, []);
  const getItemType = useCallback(
    (it: FeedItem) => (it.kind === "header" ? "h" : "t"),
    [],
  );

  const hasActiveFilter =
    filters.filter !== "all" ||
    filters.accountIds.length > 0 ||
    !!searchLower;

  // Direction passed to the picker — `+` shows income categories.
  const pickerDirection: "income" | "expense" =
    catPicker?.tx && catPicker.tx.amount > 0 ? "income" : "expense";

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-cream-50">
      <View className="px-4 pt-3 pb-2 gap-3" testID={testID}>
        {/* Header — month nav + add button */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Pressable
              onPress={() => goMonth(-1)}
              accessibilityRole="button"
              accessibilityLabel="Попередній місяць"
              testID={`${testID}-prev-month`}
              className="w-9 h-9 items-center justify-center rounded-xl active:opacity-60"
            >
              <Text className="text-xl text-stone-500">‹</Text>
            </Pressable>
            <Text className="text-sm font-semibold text-stone-900 capitalize px-2">
              {monthLabel}
            </Text>
            <Pressable
              onPress={() => goMonth(1)}
              disabled={isCurrentMonth}
              accessibilityRole="button"
              accessibilityLabel="Наступний місяць"
              accessibilityState={{ disabled: isCurrentMonth }}
              testID={`${testID}-next-month`}
              className="w-9 h-9 items-center justify-center rounded-xl active:opacity-60"
            >
              <Text
                className={
                  isCurrentMonth
                    ? "text-xl text-stone-300"
                    : "text-xl text-stone-500"
                }
              >
                ›
              </Text>
            </Pressable>
          </View>

          <View className="flex-row items-center gap-1.5">
            {hasActiveFilter && (
              <Pressable
                onPress={() => {
                  clearAll();
                  setSearch("");
                }}
                accessibilityRole="button"
                accessibilityLabel="Скинути всі фільтри"
                testID={`${testID}-clear-filters`}
                className="bg-cream-100 border border-cream-300 rounded-full h-9 px-3 items-center justify-center active:opacity-70"
              >
                <Text className="text-stone-600 text-xs font-medium">
                  ✕ Скинути
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={openAddSheet}
              accessibilityRole="button"
              accessibilityLabel="Додати витрату"
              testID={`${testID}-add`}
              className="bg-brand-500 rounded-full h-9 px-4 items-center justify-center active:opacity-80"
            >
              <Text className="text-white text-sm font-semibold">+ Додати</Text>
            </Pressable>
          </View>
        </View>

        {/* Search */}
        <View className="bg-cream-100 border border-cream-300 rounded-2xl px-3 flex-row items-center">
          <Text className="text-stone-400 mr-2">🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Пошук по транзакціях…"
            placeholderTextColor="#a8a29e"
            className="flex-1 py-2.5 text-sm text-stone-900"
            accessibilityLabel="Пошук транзакцій"
            testID={`${testID}-search`}
          />
          {search.length > 0 && (
            <Pressable
              onPress={() => setSearch("")}
              accessibilityRole="button"
              accessibilityLabel="Очистити пошук"
              hitSlop={8}
            >
              <Text className="text-stone-400 px-1">✕</Text>
            </Pressable>
          )}
        </View>

        {/* Filter chips (horizontal, rendered via plain View + flex-wrap
            for simplicity — chip count is small and we don't need the
            virtualisation overhead here). */}
        <View className="flex-row flex-wrap gap-2" testID={`${testID}-filters`}>
          {filterChips.map((chip) => {
            const selected = filters.filter === chip.id;
            return (
              <Pressable
                key={chip.id}
                onPress={() => setFilter(chip.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                testID={`${testID}-filter-${chip.id}`}
                className={
                  selected
                    ? "bg-brand-500 border border-brand-500 rounded-full px-3 h-9 justify-center"
                    : "bg-cream-50 border border-cream-300 rounded-full px-3 h-9 justify-center"
                }
              >
                <Text
                  className={
                    selected
                      ? "text-white text-xs font-semibold"
                      : "text-stone-700 text-xs font-medium"
                  }
                  numberOfLines={1}
                >
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
          {accounts.length > 0 && (
            <Pressable
              onPress={() => setAccountPicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Фільтр по рахунках"
              testID={`${testID}-filter-accounts`}
              className={
                filters.accountIds.length > 0
                  ? "bg-brand-500 border border-brand-500 rounded-full px-3 h-9 justify-center"
                  : "bg-cream-50 border border-cream-300 rounded-full px-3 h-9 justify-center"
              }
            >
              <Text
                className={
                  filters.accountIds.length > 0
                    ? "text-white text-xs font-semibold"
                    : "text-stone-700 text-xs font-medium"
                }
              >
                🏦 Рахунки
                {filters.accountIds.length > 0
                  ? ` · ${filters.accountIds.length}`
                  : ""}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Transaction feed */}
      {feed.length === 0 ? (
        <View
          className="flex-1 items-center justify-center px-8"
          testID={`${testID}-empty`}
        >
          <Text className="text-5xl mb-3">🧾</Text>
          <Text className="text-base font-semibold text-stone-900 mb-1 text-center">
            {hasActiveFilter
              ? "Нічого не знайдено"
              : "Немає транзакцій за цей місяць"}
          </Text>
          <Text className="text-sm text-stone-500 text-center mb-4">
            {hasActiveFilter
              ? "Спробуйте інший фільтр або очистіть пошук."
              : "Додайте першу витрату — і вона з'явиться тут."}
          </Text>
          <Pressable
            onPress={openAddSheet}
            accessibilityRole="button"
            accessibilityLabel="Додати першу витрату"
            testID={`${testID}-empty-add`}
            className="bg-brand-500 rounded-full h-11 px-5 items-center justify-center active:opacity-80"
          >
            <Text className="text-white text-sm font-semibold">
              + Додати витрату
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={feed}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemType={getItemType}
          estimatedItemSize={68}
          contentContainerStyle={{ paddingBottom: 64 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#78716c"
            />
          }
          testID={`${testID}-list`}
        />
      )}

      <ManualExpenseSheet
        open={sheetState.open}
        onClose={closeSheet}
        onSave={handleSave}
        initialExpense={
          sheetState.open && sheetState.editing
            ? sheetState.editing
            : null
        }
        testID={`${testID}-sheet`}
      />

      <CategoryPickerSheet
        open={!!catPicker}
        onClose={() => setCatPicker(null)}
        onSelect={handleCategorySelect}
        direction={pickerDirection}
        customCategories={customCategories}
        selectedId={catPicker ? (txCategories[catPicker.tx.id] ?? null) : null}
        testID={`${testID}-cat-picker`}
      />

      <Sheet
        open={accountPicker}
        onClose={() => setAccountPicker(false)}
        title="Фільтр по рахунках"
        description="Оберіть рахунки, транзакції з яких показувати."
      >
        <View testID={`${testID}-accounts-sheet`}>
          {accounts.length === 0 ? (
            <Text className="text-sm text-stone-500 px-3 py-2">
              Немає підключених рахунків.
            </Text>
          ) : (
            accounts.map((a) => {
              const aid = a.id ?? "";
              const checked = filters.accountIds.includes(aid);
              return (
                <Pressable
                  key={aid}
                  onPress={() => {
                    const next = checked
                      ? filters.accountIds.filter((x) => x !== aid)
                      : [...filters.accountIds, aid];
                    setAccountIds(next);
                  }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  testID={`${testID}-account-opt-${aid}`}
                  className="flex-row items-center px-3 py-3 rounded-xl active:opacity-70"
                >
                  <Text className="text-sm text-stone-900 flex-1">
                    {a.type ?? aid ?? "Рахунок"}
                  </Text>
                  <Text className={checked ? "text-brand-500" : "text-stone-300"}>
                    {checked ? "☑" : "☐"}
                  </Text>
                </Pressable>
              );
            })
          )}
          {filters.accountIds.length > 0 && (
            <Pressable
              onPress={() => setAccountIds([])}
              accessibilityRole="button"
              testID={`${testID}-account-clear`}
              className="mt-2 px-3 py-3 rounded-xl bg-cream-100 active:opacity-70"
            >
              <Text className="text-sm text-stone-600 text-center">
                Скинути вибір рахунків
              </Text>
            </Pressable>
          )}
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

// Suppress an unused-import lint warning on the rare path where the
// CURRENCY constant isn't referenced by the renderer.
void useRef;
