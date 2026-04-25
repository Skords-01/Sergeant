import { handleFinykAction } from "./chatActions/finykActions";
import { handleFizrukAction } from "./chatActions/fizrukActions";
import { handleRoutineAction } from "./chatActions/routineActions";
import { handleNutritionAction } from "./chatActions/nutritionActions";
import { handleCrossAction } from "./chatActions/crossActions";

export type { ChatAction } from "./chatActions/types";

export function executeAction(
  action: import("./chatActions/types").ChatAction,
): string {
  try {
    return (
      handleFinykAction(action) ??
      handleFizrukAction(action) ??
      handleRoutineAction(action) ??
      handleNutritionAction(action) ??
      handleCrossAction(action) ??
      `Невідома дія: ${action.name}`
    );
  } catch (e) {
    return `Помилка виконання: ${e instanceof Error ? e.message : String(e)}`;
  }
}
