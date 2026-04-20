import { Suspense, memo } from "react";
import { CategoryChart } from "../../components/charts/lazy";
import { ChartFallback } from "../../components/charts/ChartFallback";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { Card } from "@shared/components/ui/Card";

/**
 * «Витрати за категоріями». Відмальовує chart якщо є дані, або empty-state
 * з CTA на «Операції». Клік по bar-у викликає onCategoryClick + перехід.
 */
const CategoryChartSectionImpl = function CategoryChartSection({
  catSpends,
  onNavigate,
  onCategoryClick,
}) {
  if (catSpends.length > 0) {
    return (
      <Card radius="lg" padding="lg">
        <div className="text-xs font-medium text-subtle mb-4">
          Витрати за категоріями
        </div>
        <Suspense fallback={<ChartFallback className="h-40" />}>
          <CategoryChart
            data={catSpends.slice(0, 6)}
            onBarClick={
              onCategoryClick
                ? (catId) => {
                    onCategoryClick(catId);
                    onNavigate?.("transactions");
                  }
                : undefined
            }
          />
        </Suspense>
      </Card>
    );
  }

  return (
    <div className="bg-panel border border-dashed border-line rounded-2xl shadow-card">
      <EmptyState
        title="Поки немає витрат"
        description="Цього місяця витрат за категоріями ще немає."
        action={
          <button
            type="button"
            onClick={() => onNavigate("transactions")}
            className="text-sm font-medium text-primary hover:underline"
          >
            Переглянути операції
          </button>
        }
      />
    </div>
  );
};

export const CategoryChartSection = memo(CategoryChartSectionImpl);
