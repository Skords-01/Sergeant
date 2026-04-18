import { useCallback, useState } from "react";
import { PWA_ACTION_KEY, consumePwaAction } from "../app/pwaAction.js";

const VALID_ACTIONS = new Set(["add_expense", "start_workout", "add_meal"]);

export function usePwaActions(searchParams) {
  const [pwaAction, setPwaAction] = useState(() => {
    const fromUrl = searchParams.get("action");
    if (VALID_ACTIONS.has(fromUrl)) {
      try {
        localStorage.setItem(PWA_ACTION_KEY, fromUrl);
      } catch {
        /* noop */
      }
      return fromUrl;
    }
    return consumePwaAction();
  });

  const clearPwaAction = useCallback(() => setPwaAction(null), []);

  return {
    pwaAction,
    setPwaAction,
    clearPwaAction,
    validActions: VALID_ACTIONS,
  };
}
