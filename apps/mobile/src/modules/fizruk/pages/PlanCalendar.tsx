/**
 * Fizruk / PlanCalendar page — mobile placeholder (Phase 6 / PR-1).
 *
 * Web counterpart: `apps/web/src/modules/fizruk/pages/PlanCalendar.tsx` (349 LOC).
 * Monthly plan grid with training templates per day. Integrates with the
 * Hub `showFizrukInCalendar` setting (RoutineSection) — see PR-G.
 */

import { PagePlaceholder } from "./PagePlaceholder";

export function PlanCalendar() {
  return (
    <PagePlaceholder
      title="План на місяць"
      description="Календар тренувань по днях: шаблон на день, нагадування, інтеграція з Рутиною."
      plannedFeatures={[
        "Місячна сітка з шаблонами тренувань",
        "Щоденні нагадування (expo-notifications)",
        "Інтеграція з `showFizrukInCalendar` з HubSettings",
        "Перенесення тренувань між днями (drag-and-drop → long-press menu)",
      ]}
      phaseHint="Фаза 6 · PR-G — PlanCalendar + Routine integration"
    />
  );
}

export default PlanCalendar;
