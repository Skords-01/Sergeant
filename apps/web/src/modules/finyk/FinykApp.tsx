import { useState, useEffect, Suspense } from "react";
import { lazyImport } from "../../core/lib/lazyImport";
import { useSwipeNavigation } from "@shared/hooks/useSwipeNavigation";
import { useMonobank } from "./hooks/useMonobank";
import { usePrivatbank } from "./hooks/usePrivatbank";
import { useStorage } from "./hooks/useStorage";
import { readRaw, writeRaw } from "./lib/finykStorage";
import { FINYK_MANUAL_ONLY_KEY, enableFinykManualOnly } from "./lib/demoData";
import { ModuleBottomNav } from "@shared/components/ui/ModuleBottomNav";
import { ModuleAccentProvider } from "@shared/components/layout";
import { NoBankBanner } from "./components/NoBankBanner";
import { FinykManualExpenseConflictBanner } from "./components/FinykManualExpenseConflictBanner";
import { FinykHeader } from "./components/FinykHeader";
import { FinykAuthErrorBanner } from "./components/FinykAuthErrorBanner";
import { SectionErrorBoundary } from "@shared/components/ui/SectionErrorBoundary";
import { cn } from "@shared/lib/ui/cn";
import { useToast } from "@shared/hooks/useToast";
import { tryShowCrossModulePrompt } from "@shared/lib/modules/crossModulePrompt";
import { openHubModuleWithAction } from "@shared/lib/modules/hubNav";
import { Overview } from "./pages/Overview";
import { ModulePageLoader } from "@shared/components/ui/ModulePageLoader";

// Heavy sub-pages are lazy-loaded so navigating into them for the first
// time shows the finyk-branded ModulePageLoader skeleton instead of a
// blank flash. Overview stays eager because it is the landing page and
// must not add a waterfall to cold module navigation.
//
// `lazyImport` (instead of bare `React.lazy()`) keeps Suspense from
// crashing when `chunkReload.ts` swallows a `vite:preloadError` after a
// fresh Vercel deploy — same Sentry-noise pattern that hit AuthPage as
// `e.AuthPage` (issue 116945546). See core/lib/lazyImport.ts.
const Transactions = lazyImport(
  () => import("./pages/transactions"),
  "Transactions",
);
const Budgets = lazyImport(() => import("./pages/budgets"), "Budgets");
const Assets = lazyImport(() => import("./pages/Assets"), "Assets");
const Analytics = lazyImport(() => import("./pages/Analytics"), "Analytics");
import { ManualExpenseSheet } from "./components/ManualExpenseSheet";
import { FinykLoginScreen } from "./components/FinykLoginScreen";
import { NAV_ICONS, NAV_IDS, NAV_ITEMS } from "./components/finykNav";
// eslint-disable-next-line sergeant-design/no-hash-router-in-modules -- pre-existing hash-router callsite (initiative 0006 Phase 2 migration на react-router-dom ще не дійшла до FinykApp shell-роутера).
import { useHashRouter, useHashQueryParam } from "./hooks/useHashRouter";
import { useUnifiedFinanceData } from "./hooks/useUnifiedFinanceData";
import { useFinykPersonalization } from "./hooks/useFinykPersonalization";
import { useMonoTokenMigration } from "./hooks/useMonoTokenMigration";
import { consumePresetPrefill } from "../../core/onboarding/presetPrefill";

const PRIVAT_ENABLED = false;

interface FinykAppProps {
  onBackToHub?: () => void;
  pwaAction?: string | null;
  onPwaActionConsumed?: () => void;
}

export default function App({
  onBackToHub,
  pwaAction,
  onPwaActionConsumed,
}: FinykAppProps = {}) {
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

  const { clientInfo, connecting, error, authError, connect } = mono;
  const syncTone =
    mergedMono?.syncState?.status === "error"
      ? {
          dot: "bg-danger",
          text: "помилка",
          pill: "bg-danger-soft  text-danger  border-danger/20",
        }
      : mergedMono?.syncState?.status === "partial"
        ? {
            dot: "bg-warning",
            text: "частково",
            pill: "bg-warning/10   text-warning border-warning/20",
          }
        : mergedMono?.syncState?.status === "loading"
          ? {
              dot: "bg-muted",
              text: "оновлення",
              pill: "bg-panelHi     text-muted   border-line",
            }
          : {
              dot: "bg-success",
              text: "ок",
              pill: "bg-success/10  text-success border-success/20",
            };

  // Свайп між вкладками (без pull-to-refresh: скрол живе всередині сторінок, зовнішній scrollTop завжди 0).
  // Logic shared with other module shells via useSwipeNavigation.
  const SWIPE_THRESHOLD_PX = 60;
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
  const swipeDx = swipe.dragDx;

  // Auto-close the connect overlay once the user successfully connects
  // a Monobank token — `clientInfo` flips from null to populated inside
  // `useMonobank` after a successful handshake.
  useEffect(() => {
    if (clientInfo && showLoginOverlay) {
      setShowLoginOverlay(false);
    }
  }, [clientInfo, showLoginOverlay]);

  const showNoBankBanner = !clientInfo && !manualOnly;

  // ── Main app ──────────────────────────────────────────────────────────
  return (
    <ModuleAccentProvider module="finyk" asShellRoot>
      <FinykHeader
        onBackToHub={onBackToHub}
        syncTone={syncTone}
        showBalance={showBalance}
        onToggleBalance={() => setShowBalance((v) => !v)}
      />

      {showNoBankBanner && (
        <NoBankBanner
          onConnect={() => setShowLoginOverlay(true)}
          onContinueManually={() => {
            enableFinykManualOnly();
            setManualOnly(true);
          }}
        />
      )}

      {/*
        Sync-v2 LWW-conflict banner для `finyk_manual_expenses` (Stage 5
        PR #044, `docs/planning/storage-roadmap.md`). Self-renders як
        no-op коли черга у `conflicts/store.ts` порожня — тому жодного
        feature-flag-у тут не треба, гілка дешева. Розташований нижче
        no-bank банера, щоб «налаштуй банк» залишався primary CTA для
        свіжих юзерів, а conflict-warning спливав поверх для тих, хто
        вже має data + race з іншого пристрою.
      */}
      <FinykManualExpenseConflictBanner />

      {/* Page content */}
      <div
        className="flex-1 overflow-hidden flex flex-col min-h-0 touch-pan-y relative"
        onTouchStart={swipe.onTouchStart}
        onTouchMove={swipe.onTouchMove}
        onTouchEnd={swipe.onTouchEnd}
      >
        {/*
          Swipe progress bar — surfaces an in-progress tab swipe so
          the gesture isn't a black box anymore. Sits at the top of
          the page wrapper, fills toward the threshold (60 px), then
          tints fully on commit. Hidden when the user isn't dragging
          to keep the chrome clean.
        */}
        {swipeDx !== 0 && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 inset-x-0 h-0.5 z-20 overflow-hidden"
          >
            <div
              className={cn(
                "h-full",
                Math.abs(swipeDx) >= SWIPE_THRESHOLD_PX
                  ? "bg-finyk"
                  : "bg-finyk/40",
              )}
              style={{
                width: `${Math.min(100, (Math.abs(swipeDx) / SWIPE_THRESHOLD_PX) * 100)}%`,
                marginLeft: swipeDx < 0 ? "auto" : 0,
                transition: "background-color 120ms linear",
              }}
            />
          </div>
        )}
        <div
          key={`page-${page}`}
          className="flex-1 overflow-hidden flex flex-col min-h-0 motion-safe:animate-fade-in"
          style={
            swipeDx !== 0
              ? {
                  // 0.45 follow-coefficient mirrors iOS' "rubber band"
                  // feel — the page tracks the finger but lags behind
                  // it, so the dominant motion stays in the user's
                  // hand, not the screen. No transition while dragging
                  // so there's no rubber-banding lag.
                  transform: `translate3d(${swipeDx * 0.45}px, 0, 0)`,
                  transition: "none",
                  willChange: "transform",
                }
              : {
                  transform: "translate3d(0, 0, 0)",
                  transition: "transform 200ms cubic-bezier(0.32, 0.72, 0, 1)",
                }
          }
        >
          <Suspense fallback={<ModulePageLoader module="finyk" />}>
            {page === "overview" && (
              <SectionErrorBoundary
                key="page-overview"
                title="Не вдалось показати «Огляд»"
              >
                <Overview
                  mono={mergedMono}
                  storage={storage}
                  onNavigate={navigate}
                  showBalance={showBalance}
                />
              </SectionErrorBoundary>
            )}
            {page === "transactions" && (
              <SectionErrorBoundary
                key="page-transactions"
                title="Не вдалось показати «Операції»"
              >
                <Transactions
                  mono={mergedMono}
                  storage={storage}
                  showBalance={showBalance}
                  categoryFilter={categoryFilter}
                  onClearCategoryFilter={() => setCategoryFilter(null)}
                  onEditManualExpense={(id) => {
                    setEditingManualExpenseId(String(id));
                    setShowExpenseSheet(true);
                  }}
                />
              </SectionErrorBoundary>
            )}
            {page === "budgets" && (
              <SectionErrorBoundary
                key="page-budgets"
                title="Не вдалось показати «Планування»"
              >
                <Budgets
                  mono={mergedMono}
                  storage={storage}
                  showBalance={showBalance}
                  focusLimitCategoryId={focusLimitCategoryId}
                />
              </SectionErrorBoundary>
            )}
            {page === "analytics" && (
              <SectionErrorBoundary
                key="page-analytics"
                title="Не вдалось показати «Аналітику»"
              >
                <Analytics mono={mergedMono} storage={storage} />
              </SectionErrorBoundary>
            )}
            {page === "assets" && (
              <SectionErrorBoundary
                key="page-assets"
                title="Не вдалось показати «Активи»"
              >
                <Assets
                  mono={mergedMono}
                  storage={storage}
                  showBalance={showBalance}
                />
              </SectionErrorBoundary>
            )}
          </Suspense>
        </div>
      </div>

      {(page === "overview" ||
        page === "transactions" ||
        page === "budgets") && (
        <button
          onClick={() => {
            setEditingManualExpenseId(null);
            setShowExpenseSheet(true);
          }}
          className="fixed bottom-[calc(60px+env(safe-area-inset-bottom,0)+16px)] right-4 w-12 h-12 rounded-full bg-linear-to-br from-brand-400 to-brand-600 text-white shadow-float flex items-center justify-center text-2xl hover:from-brand-500 hover:to-brand-700 hover:shadow-glow hover:scale-105 active:scale-95 transition-[background-color,box-shadow,opacity,transform] duration-200 ease-smooth z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finyk/45 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
          aria-label="Додати витрату"
        >
          +
        </button>
      )}

      {mono.authError && (
        <FinykAuthErrorBanner
          authError={mono.authError}
          onBackToHub={onBackToHub}
          onDismiss={() => mono.setAuthError("")}
        />
      )}

      <ManualExpenseSheet
        open={showExpenseSheet}
        onClose={() => {
          setShowExpenseSheet(false);
          setEditingManualExpenseId(null);
          setQuickAddCategory(null);
          setQuickAddDescription(null);
        }}
        initialExpense={
          editingManualExpenseId
            ? (storage.manualExpenses || []).find(
                (e) => String(e.id) === String(editingManualExpenseId),
              ) || null
            : null
        }
        initialCategory={quickAddCategory}
        initialDescription={quickAddDescription}
        frequentCategories={frequentCategories}
        frequentMerchants={frequentMerchants}
        onSave={(expense) => {
          if (expense?.id) {
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
          const cat = String(expense?.category || "");
          const promptId =
            cat === "restaurant"
              ? "finyk-restaurant-to-meal"
              : cat === "food"
                ? "finyk-food-to-meal"
                : null;
          if (promptId) {
            const msg =
              promptId === "finyk-restaurant-to-meal"
                ? "Додати прийом їжі з ресторану?"
                : "Додати прийом їжі з продуктів?";
            tryShowCrossModulePrompt(toast, {
              id: promptId,
              msg,
              acceptLabel: "Додати →",
              onAccept: () => openHubModuleWithAction("nutrition", "add_meal"),
            });
          }
        }}
      />

      {/* Bottom navigation */}
      <ModuleBottomNav
        items={NAV_ITEMS.map((item) => ({
          id: item.id,
          label: item.label,
          icon: NAV_ICONS[item.id],
        }))}
        activeId={page}
        onChange={navigate}
        module="finyk"
      />

      {showLoginOverlay && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Підключення Monobank"
        >
          <FinykLoginScreen
            tokenInput={tokenInput}
            onTokenInputChange={setTokenInput}
            showToken={showToken}
            onToggleShowToken={() => setShowToken((v) => !v)}
            authError={authError}
            error={error}
            connecting={connecting}
            onConnect={() => connect(tokenInput.trim())}
            onContinueWithoutBank={() => {
              enableFinykManualOnly();
              setManualOnly(true);
              setShowLoginOverlay(false);
            }}
            toast={toast}
            onBackToHub={() => setShowLoginOverlay(false)}
            backLabel="Назад"
          />
        </div>
      )}
    </ModuleAccentProvider>
  );
}
