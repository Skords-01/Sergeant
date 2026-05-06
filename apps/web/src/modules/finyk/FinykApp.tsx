import { ModuleAccentProvider } from "@shared/components/layout";
import { ModuleBottomNav } from "@shared/components/ui/ModuleBottomNav";
import { cn } from "@shared/lib/ui/cn";
import { FinykManualExpenseConflictBanner } from "./components/FinykManualExpenseConflictBanner";
import { FinykLoginScreen } from "./components/FinykLoginScreen";
import { ManualExpenseSheet } from "./components/ManualExpenseSheet";
import { NoBankBanner } from "./components/NoBankBanner";
import { NAV_ICONS, NAV_ITEMS } from "./components/finykNav";
import { enableFinykManualOnly } from "./lib/demoData";
import { FinykAppHeader } from "./FinykAppHeader";
import { FinykPageRouter } from "./FinykPageRouter";
import { SWIPE_THRESHOLD_PX } from "./FinykApp.helpers";
import { useFinykAppState } from "./hooks/useFinykAppState";

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
  const s = useFinykAppState({ pwaAction, onPwaActionConsumed });
  const swipeDx = s.swipe.dragDx;

  return (
    <ModuleAccentProvider module="finyk" asShellRoot>
      <FinykAppHeader
        onBackToHub={onBackToHub}
        syncTone={s.syncTone}
        showBalance={s.showBalance}
        onToggleShowBalance={() => s.setShowBalance((v) => !v)}
      />

      {s.showNoBankBanner && (
        <NoBankBanner
          onConnect={() => s.setShowLoginOverlay(true)}
          onContinueManually={() => {
            enableFinykManualOnly();
            s.setManualOnly(true);
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
        onTouchStart={s.swipe.onTouchStart}
        onTouchMove={s.swipe.onTouchMove}
        onTouchEnd={s.swipe.onTouchEnd}
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
          key={`page-${s.page}`}
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
          <FinykPageRouter
            page={s.page}
            navigate={s.navigate}
            mergedMono={s.mergedMono}
            storage={s.storage}
            showBalance={s.showBalance}
            categoryFilter={s.categoryFilter}
            setCategoryFilter={s.setCategoryFilter}
            focusLimitCategoryId={s.focusLimitCategoryId}
            onEditManualExpense={s.openExpenseSheetForEdit}
          />
        </div>
      </div>

      {(s.page === "overview" ||
        s.page === "transactions" ||
        s.page === "budgets") && (
        <button
          onClick={s.openExpenseSheet}
          className="fixed bottom-[calc(60px+env(safe-area-inset-bottom,0)+16px)] right-4 w-12 h-12 rounded-full bg-linear-to-br from-brand-400 to-brand-600 text-white shadow-float flex items-center justify-center text-2xl hover:from-brand-500 hover:to-brand-700 hover:shadow-glow hover:scale-105 active:scale-95 transition-[background-color,box-shadow,opacity,transform] duration-200 ease-smooth z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-finyk/45 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
          aria-label="Додати витрату"
        >
          +
        </button>
      )}

      {s.mono.authError && (
        <div className="fixed top-[calc(56px+env(safe-area-inset-top,0)+8px)] left-4 right-4 z-50 max-w-lg mx-auto">
          <div className="bg-warning/15 border border-warning/40 rounded-2xl px-4 py-3 flex items-start gap-3 shadow-card">
            <span className="text-lg shrink-0 mt-0.5">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-style-label text-text">
                Токен потребує оновлення
              </p>
              <p className="text-xs text-muted mt-0.5">{s.mono.authError}</p>
              {onBackToHub && (
                <button
                  onClick={onBackToHub}
                  className="text-xs font-semibold text-primary mt-2 hover:underline"
                >
                  Оновити токен у Налаштуваннях Hub
                </button>
              )}
            </div>
            <button
              onClick={() => s.mono.setAuthError("")}
              className="text-muted hover:text-text transition-colors shrink-0"
              aria-label="Закрити"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <ManualExpenseSheet
        open={s.showExpenseSheet}
        onClose={s.closeExpenseSheet}
        initialExpense={
          s.editingManualExpenseId
            ? (s.storage.manualExpenses || []).find(
                (e) => String(e.id) === String(s.editingManualExpenseId),
              ) || null
            : null
        }
        initialCategory={s.quickAddCategory}
        initialDescription={s.quickAddDescription}
        frequentCategories={s.frequentCategories}
        frequentMerchants={s.frequentMerchants}
        onSave={s.handleManualExpenseSaved}
      />

      {/* Bottom navigation */}
      <ModuleBottomNav
        items={NAV_ITEMS.map((item) => ({
          id: item.id,
          label: item.label,
          icon: NAV_ICONS[item.id],
        }))}
        activeId={s.page}
        onChange={s.navigate}
        module="finyk"
      />

      {s.showLoginOverlay && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Підключення Monobank"
        >
          <FinykLoginScreen
            tokenInput={s.tokenInput}
            onTokenInputChange={s.setTokenInput}
            showToken={s.showToken}
            onToggleShowToken={() => s.setShowToken((v) => !v)}
            authError={s.mono.authError}
            error={s.mono.error}
            connecting={s.mono.connecting}
            onConnect={() => s.mono.connect(s.tokenInput.trim())}
            onContinueWithoutBank={s.continueWithoutBank}
            toast={s.toast}
            onBackToHub={() => s.setShowLoginOverlay(false)}
            backLabel="Назад"
          />
        </div>
      )}
    </ModuleAccentProvider>
  );
}
