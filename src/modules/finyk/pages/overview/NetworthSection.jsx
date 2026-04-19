import { Suspense, memo } from "react";
import { NetworthChart } from "../../components/charts/lazy";
import { ChartFallback } from "../../components/charts/ChartFallback";

/**
 * Секція графіка нетворсу. Показує графік якщо історія містить ≥2 точки,
 * інакше — placeholder-картку з підказкою.
 */
const NetworthSectionImpl = function NetworthSection({ networthHistory }) {
  if (networthHistory.length >= 2) {
    return (
      <div className="bg-panel border border-line rounded-2xl px-5 pt-4 pb-3 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-subtle">
            Динаміка нетворсу
          </span>
          <span className="text-xs text-subtle/60">
            {networthHistory.length} міс.
          </span>
        </div>
        <Suspense fallback={<ChartFallback className="h-20" />}>
          <NetworthChart data={networthHistory} />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="bg-panel border border-dashed border-line rounded-2xl p-6 text-center shadow-card">
      <p className="text-sm text-subtle">
        Ще мало знімків для графіка нетворсу — з’явиться після кількох змін
        балансу.
      </p>
    </div>
  );
};

export const NetworthSection = memo(NetworthSectionImpl);
