import type { CrossModulePromptId } from "@shared/lib/modules/crossModulePrompt";
import type { useUnifiedFinanceData } from "./hooks/useUnifiedFinanceData";

type MergedMono = ReturnType<typeof useUnifiedFinanceData>["mergedMono"];

export interface SyncTone {
  dot: string;
  text: string;
  pill: string;
}

// Sync-state pill rendered in the FinykApp header. Centralised here so
// the header chrome stays a thin presentational shard.
export function deriveSyncTone(mergedMono: MergedMono): SyncTone {
  const status = mergedMono?.syncState?.status;
  if (status === "error") {
    return {
      dot: "bg-danger",
      text: "помилка",
      pill: "bg-danger-soft  text-danger  border-danger/20",
    };
  }
  if (status === "partial") {
    return {
      dot: "bg-warning",
      text: "частково",
      pill: "bg-warning/10   text-warning border-warning/20",
    };
  }
  if (status === "loading") {
    return {
      dot: "bg-muted",
      text: "оновлення",
      pill: "bg-panelHi     text-muted   border-line",
    };
  }
  return {
    dot: "bg-success",
    text: "ок",
    pill: "bg-success/10  text-success border-success/20",
  };
}

// Mirror of the categories that Finyk maps to nutrition-side meal-add
// nudges. Returns the cross-module prompt id + toast message, or null
// when the saved expense isn't food-related. Behaviour and copy are
// identical to the inline branch in FinykApp before decomposition.
export function deriveCrossModulePromptForExpense(
  expenseCategory: unknown,
): { id: CrossModulePromptId; msg: string } | null {
  const cat = String(expenseCategory || "");
  if (cat === "restaurant") {
    return {
      id: "finyk-restaurant-to-meal",
      msg: "Додати прийом їжі з ресторану?",
    };
  }
  if (cat === "food") {
    return {
      id: "finyk-food-to-meal",
      msg: "Додати прийом їжі з продуктів?",
    };
  }
  return null;
}

export const SWIPE_THRESHOLD_PX = 60;
