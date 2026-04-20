/**
 * Fizruk / Progress page — mobile placeholder (Phase 6 / PR-1).
 *
 * Web counterpart: `apps/web/src/modules/fizruk/pages/Progress.tsx` (737 LOC).
 * Volume/wellbeing charts, photo progress, JSON backup controls. Lands
 * across PR-D (charts), PR-E (PhotoProgress) in Phase 6.
 */

import { PagePlaceholder } from "./PagePlaceholder";

export function Progress() {
  return (
    <PagePlaceholder
      title="Прогрес"
      description="Щотижневий об'єм, самопочуття, фотопрогрес і бекап даних Фізрука."
      plannedFeatures={[
        "Щотижневий об'єм (WeeklyVolumeChart — victory-native)",
        "Графік самопочуття (WellbeingChart)",
        "Mini-line chart для конкретної вправи",
        "Фотопрогрес: порівняння до/після (expo-image-picker)",
        "Експорт / імпорт JSON-бекапу через shared `downloadJson`",
      ]}
      phaseHint="Фаза 6 · PR-D (charts) + PR-E (PhotoProgress)"
    />
  );
}

export default Progress;
