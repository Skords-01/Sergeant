/**
 * Fizruk / Workouts page — mobile placeholder (Phase 6 / PR-1).
 *
 * Web counterpart: `apps/web/src/modules/fizruk/pages/Workouts.tsx` (626 LOC).
 * Full port — catalog, journal, active-workout panel, rest-timer overlay,
 * template drawer — lands in follow-up Phase 6 PRs.
 */

import { PagePlaceholder } from "./PagePlaceholder";

export function Workouts() {
  return (
    <PagePlaceholder
      title="Тренування"
      description="Каталог вправ, активне тренування з таймером відпочинку, журнал минулих сесій і бекапи."
      plannedFeatures={[
        "Активне тренування з таймером відпочинку",
        "Каталог вправ і фільтри за групою м'язів",
        "Журнал минулих тренувань",
        "Шаблони тренувань + запуск одним тапом",
        "Бекапи JSON (через expo-file-system + expo-sharing)",
      ]}
      phaseHint="Фаза 6 · PR-F — WorkoutTemplates + active-workout timer"
    />
  );
}

export default Workouts;
