import { memo } from "react";
import { CANONICAL_TO_MANUAL_LABEL } from "../../domain/personalization";
import { Card } from "@shared/components/ui/Card";
import { SectionHeading } from "@shared/components/ui/SectionHeading";

/**
 * Квікадд-картка: топ-категорії + «нещодавнє». Показуємо лише коли
 * `onQuickAdd` переданий І зібралась хоч якась релевантна статистика.
 */
const QuickAddCardImpl = function QuickAddCard({
  onQuickAdd,
  frequentCategories = [],
  frequentMerchants = [],
}) {
  if (!onQuickAdd) return null;
  if (frequentCategories.length === 0 && frequentMerchants.length === 0)
    return null;

  return (
    <Card radius="lg" padding="lg" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <SectionHeading as="div" size="sm">
            Швидке додавання
          </SectionHeading>
          <div className="text-sm text-muted mt-0.5">
            Ваші найчастіші категорії
          </div>
        </div>
        <button
          type="button"
          onClick={() => onQuickAdd?.()}
          className="text-xs font-semibold text-primary/90 hover:text-primary transition-colors py-2 px-1 min-h-[36px]"
        >
          Нова витрата →
        </button>
      </div>
      {frequentCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {frequentCategories.slice(0, 5).map((c) => {
            const manualLabel =
              (c.manualLabel && c.manualLabel) ||
              CANONICAL_TO_MANUAL_LABEL[c.id] ||
              c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onQuickAdd?.(manualLabel)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-panelHi border border-line hover:border-muted/50 transition-colors text-left min-w-[6.5rem]"
              >
                <span className="text-sm font-medium text-text truncate">
                  {c.label || manualLabel}
                </span>
                <span className="text-xs text-subtle tabular-nums shrink-0">
                  ×{c.count}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {frequentMerchants.length > 0 && (
        <div className="pt-2 border-t border-line">
          <SectionHeading as="div" size="sm" className="mb-2">
            Нещодавнє
          </SectionHeading>
          <div className="flex flex-wrap gap-1.5">
            {frequentMerchants.slice(0, 4).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => onQuickAdd?.(m.suggestedManualCategory || null)}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-panelHi text-muted border border-line hover:border-muted/50 transition-colors"
                title={`${m.count} разів · ${m.total.toLocaleString("uk-UA")} ₴`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export const QuickAddCard = memo(QuickAddCardImpl);
