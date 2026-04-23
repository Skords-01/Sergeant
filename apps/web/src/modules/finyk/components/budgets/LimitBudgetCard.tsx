import { memo, Suspense, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { Skeleton } from "@shared/components/ui/Skeleton";
import { Icon } from "@shared/components/ui/Icon";
import { cn } from "@shared/lib/cn";
import { Card } from "@shared/components/ui/Card";
import { Input } from "@shared/components/ui/Input";
import { BudgetTrendChart } from "../charts/lazy";
import { ChartFallback } from "../charts/ChartFallback";

// Презентаційна картка ліміту бюджету. Усі дані приходять готовими пропсами,
// тому memo потрібен, щоб картка не перемальовувалась при змінах сусідніх
// бюджетів чи сторонніх станів Budgets.
//
// Прогноз на кінець місяця відображається всередині цієї ж картки
// згорнутою секцією "Прогноз" — раніше він рендерився окремим блоком
// `BudgetForecastCard` під власним заголовком "Прогноз · кінець місяця"
// і дублював назву категорії та ліміт. Збережено всю інформацію
// (перевищення/залишок, графік, факт/середнє/дні, AI-пояснення), але
// за замовчуванням згорнуто, щоб не займати зайвий простір.
function LimitBudgetCardComponent({
  budget,
  categoryLabel,
  spent,
  pctRaw,
  pctRounded,
  remaining,
  isEditing,
  showProactiveAdvice,
  proactiveText,
  proactiveLoading,
  forecast,
  explanation,
  explanationLoading,
  onExplain,
  onDismissAdvice,
  onBeginEdit,
  onChangeLimit,
  onSave,
  onDelete,
}) {
  const overLimit = pctRaw >= 100;
  const warnLimit = pctRaw >= 80 && !overLimit;
  const [adviceOpen, setAdviceOpen] = useState(true);
  // Прогноз відкритий за замовчуванням лише коли він сигналить про
  // перевищення — інакше згортаємо, бо "вкладається у ліміт" дублює
  // рядок "Залишок … · … використано" вище.
  const [forecastOpen, setForecastOpen] = useState(
    Boolean(forecast?.overLimit),
  );
  // Авто-розкриваємо секцію лише на переході `overLimit: false → true`
  // (напр. користувач опускає ліміт інлайн-редактором, нова транзакція
  // виводить проєкцію за стелю). `useState` запам'ятовує initial value
  // тільки при першому монтажі, тож стежимо за попереднім значенням
  // окремим state і оновлюємо його під час рендеру — render-time
  // state adjustment за React docs (you-might-not-need-an-effect),
  // без зайвого ре-рендеру через `useEffect`. Свідоме згортання
  // користувачем вже-перевищеної секції лишається недоторканим, поки
  // `overLimit` не впаде назад у `false` і не стрельне знову.
  const nextOverLimit = Boolean(forecast?.overLimit);
  const [prevOverLimit, setPrevOverLimit] = useState(nextOverLimit);
  if (nextOverLimit !== prevOverLimit) {
    setPrevOverLimit(nextOverLimit);
    if (nextOverLimit) {
      setForecastOpen(true);
    }
  }
  const [explanationOpen, setExplanationOpen] = useState(true);

  return (
    <Card radius="lg" padding="lg">
      {isEditing ? (
        <div className="space-y-2">
          <Input
            size="sm"
            type="number"
            placeholder="Ліміт ₴"
            value={budget.limit}
            onChange={(e) => onChangeLimit?.(Number(e.target.value))}
          />
          <div className="flex gap-2">
            <Button className="flex-1" size="sm" onClick={onSave}>
              Зберегти
            </Button>
            <Button
              className="flex-1"
              size="sm"
              variant="danger"
              onClick={onDelete}
            >
              Видалити
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold">
              {categoryLabel || "—"}
            </span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-xs tabular-nums",
                  overLimit
                    ? "text-danger font-semibold"
                    : warnLimit
                      ? "text-warning"
                      : "text-muted",
                )}
              >
                {spent} / {budget.limit} ₴
              </span>
              <button
                type="button"
                onClick={onBeginEdit}
                className="text-subtle hover:text-text text-sm transition-colors"
                aria-label="Редагувати ліміт"
              >
                ✏️
              </button>
            </div>
          </div>
          <div className="h-2 bg-bg rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                overLimit
                  ? "bg-danger"
                  : warnLimit
                    ? "bg-warning"
                    : "bg-emerald-500",
              )}
              style={{ width: `${Math.min(100, pctRaw)}%` }}
            />
          </div>
          <div
            className={cn(
              "text-xs mt-2",
              overLimit
                ? "text-danger font-medium"
                : warnLimit
                  ? "text-warning"
                  : "text-subtle",
            )}
          >
            {overLimit
              ? `Перевищено на ${(spent - budget.limit).toLocaleString("uk-UA")} ₴`
              : `Залишок ${remaining.toLocaleString("uk-UA")} ₴ · ${pctRounded}% використано`}
          </div>

          {showProactiveAdvice &&
            (proactiveText || proactiveLoading !== false) && (
              <div className="mt-3 bg-bg rounded-xl overflow-hidden">
                {proactiveText ? (
                  <>
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        onClick={() => setAdviceOpen((v) => !v)}
                        aria-expanded={adviceOpen}
                        className="flex-1 flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-panelHi transition-colors"
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold text-text">
                          <span className="text-base leading-none">✨</span>
                          AI-порада
                        </span>
                        <Icon
                          name="chevron-down"
                          size={14}
                          className={cn(
                            "transition-transform text-muted",
                            adviceOpen ? "rotate-180" : "",
                          )}
                        />
                      </button>
                      {onDismissAdvice && (
                        <button
                          type="button"
                          onClick={onDismissAdvice}
                          className="px-3 text-xs text-muted hover:text-text border-l border-line transition-colors"
                          title="Прибрати пораду до наступної генерації"
                        >
                          Зрозуміло
                        </button>
                      )}
                    </div>
                    {adviceOpen && (
                      <p className="px-3 pb-2.5 text-xs text-text leading-relaxed">
                        {proactiveText}
                      </p>
                    )}
                  </>
                ) : (
                  <div
                    className="px-3 py-2.5 space-y-1.5 min-h-[3.5rem]"
                    aria-busy="true"
                  >
                    <Skeleton className="h-3 w-full rounded" />
                    <Skeleton className="h-3 w-4/5 rounded" />
                  </div>
                )}
              </div>
            )}

          {forecast && (
            <div className="mt-3 bg-bg rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setForecastOpen((v) => !v)}
                aria-expanded={forecastOpen}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-panelHi transition-colors"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-text min-w-0">
                  <span className="text-base leading-none" aria-hidden>
                    📈
                  </span>
                  <span className="truncate">Прогноз на кінець місяця</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span
                    className={cn(
                      "text-xs tabular-nums font-semibold",
                      forecast.overLimit ? "text-danger" : "text-muted",
                    )}
                  >
                    {forecast.forecast.toLocaleString("uk-UA")} ₴
                    {forecast.overLimit && ` · +${forecast.overPercent}%`}
                  </span>
                  <Icon
                    name="chevron-down"
                    size={14}
                    className={cn(
                      "transition-transform text-muted",
                      forecastOpen ? "rotate-180" : "",
                    )}
                  />
                </span>
              </button>
              {forecastOpen && (
                <div className="px-3 pb-3 pt-1">
                  {forecast.overLimit ? (
                    <div className="text-xs text-danger font-medium mb-2">
                      ⚠️ Перевищення на {forecast.overPercent}% (+
                      {(forecast.forecast - forecast.limit).toLocaleString(
                        "uk-UA",
                      )}{" "}
                      ₴)
                    </div>
                  ) : (
                    <div className="text-xs text-subtle mb-2">
                      Вкладається у ліміт · залишок{" "}
                      {(forecast.limit - forecast.forecast).toLocaleString(
                        "uk-UA",
                      )}{" "}
                      ₴
                    </div>
                  )}

                  <Suspense fallback={<ChartFallback className="h-20 mb-2" />}>
                    <BudgetTrendChart
                      dailyData={forecast.dailyData}
                      limit={forecast.limit}
                      color={forecast.overLimit ? "#ef4444" : "#6366f1"}
                      className="mb-2"
                    />
                  </Suspense>

                  <div className="flex items-center justify-between text-2xs text-subtle mt-1 mb-2">
                    <span>
                      Факт: {forecast.spent.toLocaleString("uk-UA")} ₴
                    </span>
                    <span>
                      ≈{forecast.avgPerDay.toLocaleString("uk-UA")} ₴/день
                    </span>
                    <span>Залишилось: {forecast.daysRemaining} дн.</span>
                  </div>

                  {explanation && (
                    <div className="bg-panel rounded-xl overflow-hidden mb-2">
                      <button
                        type="button"
                        onClick={() => setExplanationOpen((v) => !v)}
                        aria-expanded={explanationOpen}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-panelHi transition-colors"
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold text-text">
                          <span className="text-base leading-none">✨</span>
                          AI-пояснення
                        </span>
                        <Icon
                          name="chevron-down"
                          size={14}
                          className={cn(
                            "transition-transform text-muted",
                            explanationOpen ? "rotate-180" : "",
                          )}
                        />
                      </button>
                      {explanationOpen && (
                        <p className="px-3 pb-2 text-xs text-text leading-relaxed">
                          {explanation}
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={explanationLoading}
                    onClick={onExplain}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg border transition-colors w-full",
                      explanationLoading
                        ? "border-line text-subtle cursor-wait"
                        : "border-primary/40 text-primary hover:bg-primary/10",
                    )}
                  >
                    {explanationLoading
                      ? "AI аналізує…"
                      : explanation
                        ? "🔄 Пояснити знову"
                        : "✨ Пояснити"}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export const LimitBudgetCard = memo(LimitBudgetCardComponent);
