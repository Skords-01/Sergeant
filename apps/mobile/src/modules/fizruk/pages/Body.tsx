/**
 * Fizruk / Body page — mobile placeholder (Phase 6 / PR-1).
 *
 * Web counterpart: `apps/web/src/modules/fizruk/pages/Body.tsx` (464 LOC).
 * Body-measurements dashboard, opens Measurements sheet for full input.
 * Full port lands alongside PR-D (charts) / the Measurements screen.
 */

import { PagePlaceholder } from "./PagePlaceholder";

export interface BodyProps {
  onOpenMeasurements?: () => void;
}

export function Body(_props: BodyProps = {}) {
  return (
    <PagePlaceholder
      title="Тіло"
      description="Останні вимірювання тіла, тренди по ключових показниках і перехід до детального введення."
      plannedFeatures={[
        "Останні ваги / обхвати / самопочуття (Card summary)",
        "Графіки трендів (MiniLineChart — victory-native)",
        "Кнопка переходу до детальних вимірювань",
      ]}
      phaseHint="Фаза 6 · PR-D + Measurements"
    />
  );
}

export default Body;
