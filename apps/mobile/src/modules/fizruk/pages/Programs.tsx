/**
 * Fizruk / Programs page — mobile placeholder (Phase 6 / PR-1).
 *
 * Web counterpart: `apps/web/src/modules/fizruk/pages/Programs.tsx` (231 LOC).
 * Training-program catalogue + active-program controls. Lands alongside
 * the Dashboard port in a follow-up Phase 6 PR.
 */

import { PagePlaceholder } from "./PagePlaceholder";

export function Programs() {
  return (
    <PagePlaceholder
      title="Програми"
      description="Каталог готових програм тренувань, активація / деактивація, сьогоднішня сесія з активної програми."
      plannedFeatures={[
        "Каталог програм (pure з `@sergeant/fizruk-domain`)",
        "Активація / деактивація з persistence у MMKV",
        "Сьогоднішня сесія з активної програми → кнопка «Почати»",
        "Інтеграція з таймером активного тренування",
      ]}
      phaseHint="Фаза 6 · PR-F — Programs + active-workout"
    />
  );
}

export default Programs;
