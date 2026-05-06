import { useCallback, useEffect, useState } from "react";
import { useSwipeNavigation } from "@shared/hooks/useSwipeNavigation";
import { useToast } from "@shared/hooks/useToast";
import { tryShowCrossModulePrompt } from "@shared/lib/modules/crossModulePrompt";
import { openHubModuleWithAction } from "@shared/lib/modules/hubNav";
import { consumePresetPrefill } from "../../../core/onboarding/presetPrefill";
import { FINYK_MANUAL_ONLY_KEY, enableFinykManualOnly } from "../lib/demoData";
import { readRaw, writeRaw } from "../lib/finykStorage";
import { NAV_IDS } from "../components/finykNav";
import { useMonobank } from "./useMonobank";
import { useMonoTokenMigration } from "./useMonoTokenMigration";
import { usePrivatbank } from "./usePrivatbank";
import { useStorage } from "./useStorage";
import { useFinykPersonalization } from "./useFinykPersonalization";
import { useUnifiedFinanceData } from "./useUnifiedFinanceData";
// eslint-disable-next-line sergeant-design/no-hash-router-in-modules -- pre-existing hash-router callsite (initiative 0006 Phase 2 migration на react-router-dom ще не дійшла до FinykApp shell-роутера).
import { useHashQueryParam, useHashRouter } from "./useHashRouter";
import {
  SWIPE_THRESHOLD_PX,
  deriveCrossModulePromptForExpense,
  deriveSyncTone,
} from "../FinykApp.helpers";

const PRIVAT_ENABLED = false;

interface UseFinykAppStateOptions {
  pwaAction?: string | null;
  onPwaActionConsumed?: () => void;
}

// Orchestrator hook for FinykApp. Owns the state, derived data, async
// effects (deep-link / PWA prefill / URL sync import / Mono auth-gate)
// and callbacks that the composition root threads into header, page
// router and overlays. Public surface intentionally mirrors the inline
// closure variables in the pre-decomposition FinykApp so consumers
// (header, manual expense sheet, FAB, login overlay) move 1:1.
export function useFinykAppState({
  pwaAction,
  onPwaActionConsumed,
}: UseFinykAppStateOptions) {
  const mono = useMonobank();
  const privat = usePrivatbank(PRIVAT_ENABLED);
  // One-time migration of legacy browser tokens to server-side webhook
  useMonoTokenMigration(/* isLoggedIn */ true);
  const toast = useToast();
  // Pass the full toast API to storage so it can dispatch `success`/`error`
  // variants directly — the old `showToast(msg, type)` wrapper silently
  // collapsed everything except `error` to `success`, which blocked any
  // `warning`/`info`/`action` usage from the shared Toast module.
  const storage = useStorage({ toast });
  // eslint-disable-next-line sergeant-design/no-hash-router-in-modules -- pre-existing hash-router callsite (initiative 0006 Phase 2 migration на react-router-dom ще не дійшла до FinykApp shell-роутера).
  const [page, navigate] = useHashRouter();
  // Підтримка глибоких лінків на конкретний ліміт із Hub-інсайту
  // (`#budgets?cat=smoking`). Передається у Budgets, щоб одразу
  // підсвітити та проскролити потрібну картку.
  const focusLimitCategoryId = useHashQueryParam("cat");

  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showBalance, setShowBalance] = useState(
    () => readRaw("finyk_show_balance_v1", "1") !== "0",
  );
  const [showExpenseSheet, setShowExpenseSheet] = useState(false);
  // Inline Mono-token entry overlay. Triggered from the no-bank banner —
  // replaces the previous full-screen `FinykLoginScreen` gate so users
  // who land in Finyk without going through the FTUX preset path can
  // still see the empty Finyk UI immediately and add expenses manually,
  // without being forced to dismiss a connect-or-skip prompt first.
  const [showLoginOverlay, setShowLoginOverlay] = useState(false);
  const [editingManualExpenseId, setEditingManualExpenseId] = useState<
    string | null
  >(null);
  // Для prefill категорії при кліку на quick-add картку з Overview.
  const [quickAddCategory, setQuickAddCategory] = useState<string | null>(null);
  // Prefill опису з FTUX preset sheet («Кава», «Таксі», «Обід»). Окрема
  // стейт-клітинка, бо quick-add з Overview задає лише категорію —
  // description лишається порожнім і поповнюється користувачем.
  const [quickAddDescription, setQuickAddDescription] = useState<string | null>(
    null,
  );
  // "Manual only" bypass: user completed onboarding without Monobank or
  // pressed «Далі без банку» on the login screen. When set, we render the
  // normal Finyk UI populated from manual expenses even if `clientInfo` is
  // still null — the bank can still be connected later from settings.
  const [manualOnly, setManualOnly] = useState(
    () => readRaw(FINYK_MANUAL_ONLY_KEY, "") === "1",
  );

  useEffect(() => {
    writeRaw("finyk_show_balance_v1", showBalance ? "1" : "0");
  }, [showBalance]);

  useEffect(() => {
    if (window.location.search.includes("sync=")) {
      const ok = storage.loadFromUrl();
      if (ok) toast.success("Налаштування синхронізовано!");
      else toast.error("Не вдалось завантажити синк-дані");
    }
    // Одноразово при монтуванні: ?sync= у URL
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storage/toast не повинні перезапускати імпорт з URL
  }, []);

  useEffect(() => {
    if (pwaAction === "add_expense") {
      // FTUX preset sheet може стешити `item.data` у sessionStorage
      // (див. `writePresetPrefill`), щоб плитки «Кава» / «Таксі» / «Обід»
      // не деградували до трьох ідентичних порожніх форм. Споживаємо
      // prefill ТІЛЬКИ для нового запису — без `editingManualExpenseId`,
      // щоб випадковий stale prefill не перезаписав категорію під час
      // редагування існуючої витрати.
      const prefill = consumePresetPrefill("finyk");
      navigate("transactions");
      setEditingManualExpenseId(null);
      setQuickAddCategory(
        typeof prefill?.category === "string" ? prefill.category : null,
      );
      setQuickAddDescription(
        typeof prefill?.description === "string" ? prefill.description : null,
      );
      setShowExpenseSheet(true);
      onPwaActionConsumed?.();
    }
    // `navigate` — стабільна локальна функція useHashRouter, не ре-створюється між рендерами.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pwaAction, onPwaActionConsumed]);

  useEffect(() => {
    const h = window.location.hash;
    if (h === "#/payments" || h === "#payments") {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}#budgets`,
      );
    }
  }, []);

  const { mergedMono } = useUnifiedFinanceData({ mono, privat });

  // Частотна персоналізація: топ-категорії/мерчанти користувача.
  // Використовуються у quick add, dashboard-картці та підказках.
  const { frequentCategories, frequentMerchants } = useFinykPersonalization({
    mono: mergedMono,
    storage,
  });

  const syncTone = deriveSyncTone(mergedMono);

  // Свайп між вкладками (без pull-to-refresh: скрол живе всередині сторінок, зовнішній scrollTop завжди 0).
  // Logic shared with other module shells via useSwipeNavigation.
  const curPageIdx = NAV_IDS.indexOf(page);
  const swipe = useSwipeNavigation({
    onSwipeLeft: () => {
      const next = curPageIdx + 1;
      if (next >= 0 && next < NAV_IDS.length) navigate(NAV_IDS[next]!);
    },
    onSwipeRight: () => {
      const next = curPageIdx - 1;
      if (next >= 0 && next < NAV_IDS.length) navigate(NAV_IDS[next]!);
    },
    threshold: SWIPE_THRESHOLD_PX,
    atStart: curPageIdx === 0,
    atEnd: curPageIdx === NAV_IDS.length - 1,
  });

  // Auto-close the connect overlay once the user successfully connects
  // a Monobank token — `clientInfo` flips from null to populated inside
  // `useMonobank` after a successful handshake.
  const { clientInfo } = mono;
  useEffect(() => {
    if (clientInfo && showLoginOverlay) {
      setShowLoginOverlay(false);
    }
  }, [clientInfo, showLoginOverlay]);

  const showNoBankBanner = !clientInfo && !manualOnly;

  // Cross-module nudge for food-related expenses. Self-contained inside
  // the orchestrator so the manual-expense sheet's `onSave` keeps a
  // single call-site.
  //
  // `SavedExpense` mirrors the `ManualExpenseSheet#onSave` payload
  // shape — `id` is optional and `string`-typed there, so we mirror it
  // exactly to keep `editManualExpense` (string id) and
  // `addManualExpense` (Partial<ManualExpense>) happy without `as`.
  interface SavedExpense {
    id?: string;
    description: string;
    amount: number;
    category: string;
    date: string;
  }
  const handleManualExpenseSaved = useCallback(
    (expense: SavedExpense) => {
      if (expense.id) {
        storage.editManualExpense?.(expense.id, expense);
        toast.success("Витрату оновлено.");
        return;
      }
      storage.addManualExpense(expense);
      toast.success("Витрату додано.");

      // Cross-module nudge (UX wave-4 #4):
      // After a Кафе/Ресторан/Продукти save, suggest logging the
      // matching meal in Nutrition. Suppressed automatically after
      // ≥3 dismissals in 14 days or 12 h after the user accepts —
      // see `docs/design/cross-module-prompts.md`.
      const prompt = deriveCrossModulePromptForExpense(expense.category);
      if (prompt) {
        tryShowCrossModulePrompt(toast, {
          id: prompt.id,
          msg: prompt.msg,
          acceptLabel: "Додати →",
          onAccept: () => openHubModuleWithAction("nutrition", "add_meal"),
        });
      }
    },
    [storage, toast],
  );

  const closeExpenseSheet = useCallback(() => {
    setShowExpenseSheet(false);
    setEditingManualExpenseId(null);
    setQuickAddCategory(null);
    setQuickAddDescription(null);
  }, []);

  const openExpenseSheet = useCallback(() => {
    setEditingManualExpenseId(null);
    setShowExpenseSheet(true);
  }, []);

  const openExpenseSheetForEdit = useCallback((id: string) => {
    setEditingManualExpenseId(id);
    setShowExpenseSheet(true);
  }, []);

  const continueWithoutBank = useCallback(() => {
    enableFinykManualOnly();
    setManualOnly(true);
    setShowLoginOverlay(false);
  }, []);

  return {
    // Hook resources
    mono,
    storage,
    toast,
    // Derived data
    mergedMono,
    syncTone,
    frequentCategories,
    frequentMerchants,
    showNoBankBanner,
    // Routing / page
    page,
    navigate,
    focusLimitCategoryId,
    // Swipe
    swipe,
    // Header / balance
    showBalance,
    setShowBalance,
    // Expense sheet
    showExpenseSheet,
    editingManualExpenseId,
    quickAddCategory,
    quickAddDescription,
    openExpenseSheet,
    openExpenseSheetForEdit,
    closeExpenseSheet,
    handleManualExpenseSaved,
    // Category filter (txns)
    categoryFilter,
    setCategoryFilter,
    // Login overlay
    showLoginOverlay,
    setShowLoginOverlay,
    tokenInput,
    setTokenInput,
    showToken,
    setShowToken,
    continueWithoutBank,
    // Manual-only bypass
    setManualOnly,
  };
}

export type FinykAppState = ReturnType<typeof useFinykAppState>;
