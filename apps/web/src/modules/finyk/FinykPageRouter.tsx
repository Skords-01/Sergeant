import { Suspense } from "react";
import type { Dispatch, SetStateAction } from "react";
import { ModulePageLoader } from "@shared/components/ui/ModulePageLoader";
import { SectionErrorBoundary } from "@shared/components/ui/SectionErrorBoundary";
import { lazyImport } from "../../core/lib/lazyImport";
import { Overview } from "./pages/Overview";
import type { useStorage } from "./hooks/useStorage";
import type { useUnifiedFinanceData } from "./hooks/useUnifiedFinanceData";

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

type Storage = ReturnType<typeof useStorage>;
type MergedMono = ReturnType<typeof useUnifiedFinanceData>["mergedMono"];

interface FinykPageRouterProps {
  page: string;
  navigate: (id: string) => void;
  mergedMono: MergedMono;
  storage: Storage;
  showBalance: boolean;
  categoryFilter: string | null;
  setCategoryFilter: Dispatch<SetStateAction<string | null>>;
  focusLimitCategoryId: string | null;
  onEditManualExpense: (id: string) => void;
}

// Renders the active Finyk page with a shared Suspense fallback and
// per-page error boundary. Pulled out of FinykApp so the composition
// root keeps state wiring separate from page-shape concerns.
export function FinykPageRouter({
  page,
  navigate,
  mergedMono,
  storage,
  showBalance,
  categoryFilter,
  setCategoryFilter,
  focusLimitCategoryId,
  onEditManualExpense,
}: FinykPageRouterProps) {
  return (
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
            onEditManualExpense={(id: string | number) => {
              onEditManualExpense(String(id));
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
  );
}
