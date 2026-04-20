/**
 * Fizruk / Exercise-detail page — mobile placeholder (Phase 6 / PR-1).
 *
 * Web counterpart: `apps/web/src/modules/fizruk/pages/Exercise.tsx` (637 LOC).
 * Detail view for a single exercise (description, muscles, history). Full
 * port lands in a follow-up Phase 6 PR alongside Workouts.
 */

import { PagePlaceholder } from "./PagePlaceholder";

export interface ExerciseProps {
  exerciseId?: string;
}

export function Exercise({ exerciseId }: ExerciseProps) {
  return (
    <PagePlaceholder
      title="Вправа"
      description={
        exerciseId
          ? `Деталі вправи «${exerciseId}» — історія підходів, м'язи, рекомендації.`
          : "Деталі вправи — історія підходів, м'язи, рекомендації."
      }
      plannedFeatures={[
        "Опис вправи, м'язи (primary/secondary)",
        "Історія ваг і підходів (графіки)",
        "Рекомендовані наступні ваги",
        "Додати в активне тренування / шаблон",
      ]}
      phaseHint="Фаза 6 · PR-F — Workouts + Exercise detail"
    />
  );
}

export default Exercise;
