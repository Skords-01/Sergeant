import { FlowRow } from "./FlowRow.jsx";
import { Card } from "@shared/components/ui/Card";

/**
 * Список «Найближчі платежі» (до 5 рядків). plannedFlows — вже відфільтрований
 * і відсортований масив, тому компонент просто маппить його.
 */
export function PlannedFlowsCard({ plannedFlows, onNavigate, showBalance }) {
  if (plannedFlows.length === 0) return null;

  return (
    <Card radius="lg" padding="none" className="overflow-hidden">
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-subtle">
          Найближчі платежі
        </span>
        <button
          onClick={() => onNavigate("budgets")}
          className="text-xs text-primary/80 hover:text-primary transition-colors py-2 px-1 min-h-[36px]"
        >
          Усі →
        </button>
      </div>
      <div className="px-5 pb-3">
        {plannedFlows.slice(0, 5).map((f) => (
          <FlowRow key={f.id} flow={f} showAmount={showBalance} />
        ))}
      </div>
    </Card>
  );
}
