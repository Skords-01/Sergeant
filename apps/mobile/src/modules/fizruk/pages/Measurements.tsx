/**
 * Fizruk / Measurements page — mobile placeholder (Phase 6 / PR-1).
 *
 * Web counterpart: `apps/web/src/modules/fizruk/pages/Measurements.tsx` (251 LOC).
 * Body measurements (weight, body-parts, wellbeing). Full port lands in
 * a follow-up Phase 6 PR alongside Body.
 */

import { PagePlaceholder } from "./PagePlaceholder";

export function Measurements() {
  return (
    <PagePlaceholder
      title="Вимірювання"
      description="Вага, обхвати (талія, груди, стегно, біцепс), самопочуття, сон, енергія."
      plannedFeatures={[
        "Введення ваги, обхватів і самопочуття",
        "Історія змін (з MMKV + CloudSync)",
        "Тренди (mini-line чарти)",
      ]}
      phaseHint="Фаза 6 · PR-D (charts) — у зв'язці з Body"
    />
  );
}

export default Measurements;
