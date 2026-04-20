/**
 * Fizruk / Atlas page — mobile placeholder (Phase 6 / PR-1).
 *
 * Web counterpart: `apps/web/src/modules/fizruk/pages/Atlas.tsx` (90 LOC).
 * The full-screen body atlas with recovery-status highlighting. Full port
 * lands in Phase 6 · PR-C — React-Native body atlas (ADR in that PR body).
 */

import { PagePlaceholder } from "./PagePlaceholder";

export function Atlas() {
  return (
    <PagePlaceholder
      title="Атлас тіла"
      description="Інтерактивна карта тіла з підсвіткою груп м'язів за статусом відновлення (recovery)."
      plannedFeatures={[
        "BodyAtlas (react-native-svg) — front / back",
        "1:1 мапинг bodyZone id з web-версією",
        "Підсвітка за recovery-статусом (ready / yellow / red)",
        "Тап по зоні → deep-link у Exercise з фільтром",
      ]}
      phaseHint="Фаза 6 · PR-C — BodyAtlas (ADR: react-native-svg vs react-native-body-highlighter)"
    />
  );
}

export default Atlas;
