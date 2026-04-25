import { Card } from "@shared/components/ui/Card";
import { RecoveryFocusCard } from "../components/RecoveryFocusCard";
import { TodayPlanCard } from "../components/TodayPlanCard";

export function PlanCalendar({
  onOpenRoutine,
}: {
  onOpenRoutine?: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad space-y-4">
        <TodayPlanCard />

        <RecoveryFocusCard
          onOpenAtlas={() => {
            window.location.hash = "#atlas";
          }}
        />

        <Card as="section" radius="lg" padding="md">
          <h2 className="text-sm font-semibold text-text mb-1">
            Календар тренувань
          </h2>
          <p className="text-xs text-subtle leading-snug mb-3">
            Призначення шаблонів на конкретні дні тепер в єдиному Hub-календарі
            модуля «Рутина». Там бачиш і звички, і тренування, і підписки — все
            в одному розкладі.
          </p>
          {onOpenRoutine ? (
            <button
              type="button"
              onClick={onOpenRoutine}
              className="w-full rounded-xl border border-routine/30 bg-routine/5 hover:bg-routine/10 px-4 py-3 text-sm font-semibold text-routine-strong dark:text-routine transition-colors text-center"
            >
              Відкрити Рутину
            </button>
          ) : (
            <p className="text-xs text-subtle">
              Перейди в модуль «Рутина» для планування.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
