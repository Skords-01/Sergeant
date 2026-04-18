/**
 * Крос-модульна навігація всередині Hub.
 *
 * Замість прокидування `onOpenModule` через дерево кожного модуля — крихітний
 * подієвий шинний канал. Слухач встановлюється в `core/App.jsx` і викликає
 * існуючий `openModule(id, { hash })`. Будь-який глибокий компонент може
 * викликати `openHubModule("finyk", "/analytics")` без додаткових пропсів.
 *
 * Це НЕ замінює існуючі `onOpenModule` пропси (напр. у `RoutineCalendarPanel`) —
 * вони лишаються як є. Це доповнювальний, опційний канал.
 */

export const HUB_OPEN_MODULE_EVENT = "hub:open-module";

const VALID_HUB_MODULES = new Set(["finyk", "fizruk", "routine", "nutrition"]);

/**
 * Перемкнути активний модуль Hub (з опційним hash для вкладки всередині).
 * @param {"finyk"|"fizruk"|"routine"|"nutrition"} moduleId
 * @param {string} [hash] — наприклад `"/analytics"` для Фініка або `"log"` для Nutrition.
 */
export function openHubModule(moduleId, hash) {
  if (!VALID_HUB_MODULES.has(moduleId)) return;
  try {
    window.dispatchEvent(
      new CustomEvent(HUB_OPEN_MODULE_EVENT, {
        detail: { module: moduleId, hash: hash || "" },
      }),
    );
  } catch {
    /* noop — SSR / disabled CustomEvent */
  }
}

const VALID_HUB_ACTIONS = new Set(["add_expense", "start_workout", "add_meal"]);

/**
 * Відкрити модуль із запитом на дію (така ж семантика як у PWA shortcuts).
 * Використовується, напр., для кнопки "Додати витрату" на hub-дашборді.
 * @param {"finyk"|"fizruk"|"routine"|"nutrition"} moduleId
 * @param {"add_expense"|"start_workout"|"add_meal"} action
 */
export function openHubModuleWithAction(moduleId, action) {
  if (!VALID_HUB_MODULES.has(moduleId)) return;
  if (!VALID_HUB_ACTIONS.has(action)) return;
  try {
    window.dispatchEvent(
      new CustomEvent(HUB_OPEN_MODULE_EVENT, {
        detail: { module: moduleId, hash: "", action },
      }),
    );
  } catch {
    /* noop */
  }
}
