import { handleFinykAction } from "./chatActions/finykActions";
import { handleFizrukAction } from "./chatActions/fizrukActions";
import { handleRoutineAction } from "./chatActions/routineActions";
import { handleNutritionAction } from "./chatActions/nutritionActions";
import { handleCrossAction } from "./chatActions/crossActions";

export type { ChatAction } from "./chatActions/types";

type ChatAction = import("./chatActions/types").ChatAction;

export function executeAction(action: ChatAction): string {
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

/**
 * Execute multiple tool calls and return their results in the same order.
 *
 * Today every handler is synchronous (writes go to localStorage) so this is
 * effectively the same as `actions.map(executeAction)` — the value is in
 * pinning the API shape now. As soon as a handler needs to hit the network
 * (e.g. `compare_weeks` aggregating from `/api/...` snapshots), we can flip
 * its `handle*Action` signature to `Promise<string>` and `Promise.all` here
 * starts giving real parallelism without touching `HubChat.tsx`.
 *
 * AI-CONTEXT: parallel write-tools that target the same localStorage key can
 * race — Anthropic rarely emits two writes to the same key in one turn but
 * if it ever does, the last `JSON.parse` → mutate → `JSON.stringify` pair
 * wins. Сompose handlers so each domain owns one key per turn, or sequence
 * conflicting writes via a queue if it becomes a real problem.
 */
export async function executeActions(
  actions: ReadonlyArray<ChatAction>,
): Promise<Array<{ name: string; result: string }>> {
  return Promise.all(
    actions.map(async (action) => ({
      name: action.name,
      result: await Promise.resolve(executeAction(action)),
    })),
  );
}
