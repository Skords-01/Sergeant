import { useRoutineState } from "../../modules/routine/hooks/useRoutineState.js";
import { SettingsGroup, ToggleRow } from "./SettingsPrimitives.jsx";

export function RoutineSection() {
  const { routine, updatePref } = useRoutineState();

  return (
    <SettingsGroup title="Рутина" emoji="✅">
      <ToggleRow
        label="Показувати тренування з Фізрука в календарі"
        checked={routine.prefs?.showFizrukInCalendar !== false}
        onChange={(e) => updatePref("showFizrukInCalendar", e.target.checked)}
      />
      <ToggleRow
        label="Показувати планові платежі підписок Фініка в календарі"
        checked={routine.prefs?.showFinykSubscriptionsInCalendar !== false}
        onChange={(e) =>
          updatePref("showFinykSubscriptionsInCalendar", e.target.checked)
        }
      />
    </SettingsGroup>
  );
}
