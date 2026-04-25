// Lightweight mapper з tool-call result у структуровану action-картку.
// За специфікацією `docs/superpowers/specs/2026-04-24-assistant-quick-actions-v1-design.md` §3.
//
// Без змін у `executeAction`/Anthropic протоколі — карти будуються
// поруч і додаються до assistant-message як metadata. Якщо tool
// невідомий мапперу — повертаємо `null`, і UI лишає текстовий fallback.

import type { ChatAction } from "./chatActions/types";

export type ChatActionCardModule =
  | "finyk"
  | "fizruk"
  | "routine"
  | "nutrition"
  | "hub";

export type ChatActionCardStatus = "completed" | "failed";

export interface ChatActionCard {
  id: string;
  toolName: string;
  status: ChatActionCardStatus;
  title: string;
  summary: string;
  module: ChatActionCardModule;
  /** Іконка з shared Icon registry. Опційно — UI має fallback. */
  icon?: string;
  /**
   * Маркер ризикової дії (delete/forget/import). v1 лише підсвічує
   * картку, повний confirmation flow — у v2.
   */
  risky?: boolean;
}

/** Tools, які класифіковані як ризикові за специфікацією §4. */
const RISKY_TOOLS: ReadonlySet<string> = new Set([
  "delete_transaction",
  "hide_transaction",
  "forget",
  "archive_habit",
  "import_monobank_range",
]);

/**
 * Сабсет tool names, для яких v1 малює картку.
 * Перший набір зі спеки §3.
 */
const KNOWN_TOOLS: ReadonlySet<string> = new Set([
  "create_transaction",
  "log_meal",
  "log_water",
  "start_workout",
  "log_set",
  "mark_habit_done",
  "create_habit",
  "morning_briefing",
  "weekly_summary",
]);

interface CardInput {
  /** Назва tool-а від Anthropic — `action.name`. */
  name: string;
  /** Сирий input до tool-а (для генерації summary). */
  input: ChatAction["input"] | Record<string, unknown>;
  /** Текстовий результат `executeAction` — fallback summary. */
  result: string;
  /**
   * Ознака помилки: якщо result починається з «Помилка» / «Невідома дія»
   * — статус failed.
   */
  failed?: boolean;
}

const FAILURE_RE = /^(Помилка|Невідома дія)/;

function deriveStatus(
  result: string,
  explicitFailed?: boolean,
): ChatActionCardStatus {
  if (explicitFailed) return "failed";
  return FAILURE_RE.test(result) ? "failed" : "completed";
}

function moduleFor(name: string): ChatActionCardModule {
  if (
    name === "create_transaction" ||
    name === "delete_transaction" ||
    name === "hide_transaction" ||
    name === "import_monobank_range"
  ) {
    return "finyk";
  }
  if (name === "log_meal" || name === "log_water") return "nutrition";
  if (name === "start_workout" || name === "log_set") return "fizruk";
  if (
    name === "mark_habit_done" ||
    name === "create_habit" ||
    name === "archive_habit"
  ) {
    return "routine";
  }
  return "hub";
}

function iconFor(name: string): string | undefined {
  switch (name) {
    case "create_transaction":
      return "credit-card";
    case "log_meal":
      return "utensils";
    case "log_water":
      return "utensils";
    case "start_workout":
    case "log_set":
      return "dumbbell";
    case "mark_habit_done":
    case "create_habit":
      return "check";
    case "morning_briefing":
      return "sun";
    case "weekly_summary":
      return "bar-chart";
    default:
      return undefined;
  }
}

function titleFor(name: string, status: ChatActionCardStatus): string {
  const failedSuffix = status === "failed" ? " — не вийшло" : "";
  switch (name) {
    case "create_transaction":
      return `Транзакцію записано${failedSuffix}`;
    case "log_meal":
      return `Прийом їжі залоговано${failedSuffix}`;
    case "log_water":
      return `Воду залоговано${failedSuffix}`;
    case "start_workout":
      return `Тренування стартувало${failedSuffix}`;
    case "log_set":
      return `Підхід записано${failedSuffix}`;
    case "mark_habit_done":
      return `Звичка виконана${failedSuffix}`;
    case "create_habit":
      return `Звичку створено${failedSuffix}`;
    case "morning_briefing":
      return `Ранковий брифінг`;
    case "weekly_summary":
      return `Тижневий підсумок`;
    default:
      return name;
  }
}

/**
 * Дуже коротке summary під картку: пробуємо витягти з input ключові поля,
 * інакше fallback на скорочений `result`.
 */
function summaryFor(
  name: string,
  input: Record<string, unknown>,
  result: string,
): string {
  const truncate = (s: string, max = 120): string =>
    s.length > max ? `${s.slice(0, max - 1)}…` : s;

  const stringField = (key: string): string | undefined => {
    const v = input[key];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const numberField = (key: string): number | undefined => {
    const v = input[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) {
      return Number(v);
    }
    return undefined;
  };

  switch (name) {
    case "create_transaction": {
      const amount = numberField("amount");
      const desc = stringField("description") || stringField("category_id");
      const parts: string[] = [];
      if (amount !== undefined) parts.push(`${amount} ₴`);
      if (desc) parts.push(desc);
      if (parts.length) return parts.join(" · ");
      break;
    }
    case "log_meal": {
      const meal = stringField("meal_type");
      const desc = stringField("description") || stringField("name");
      const kcal = numberField("calories");
      const parts: string[] = [];
      if (meal) parts.push(meal);
      if (desc) parts.push(desc);
      if (kcal !== undefined) parts.push(`${kcal} ккал`);
      if (parts.length) return parts.join(" · ");
      break;
    }
    case "log_water": {
      const ml = numberField("amount_ml") ?? numberField("amount");
      if (ml !== undefined) return `${ml} мл`;
      break;
    }
    case "log_set": {
      const exercise = stringField("exercise") || stringField("name");
      const weight = numberField("weight_kg") ?? numberField("weight");
      const reps = numberField("reps");
      const parts: string[] = [];
      if (exercise) parts.push(exercise);
      if (weight !== undefined) parts.push(`${weight} кг`);
      if (reps !== undefined) parts.push(`${reps} повт.`);
      if (parts.length) return parts.join(" · ");
      break;
    }
    case "mark_habit_done":
    case "create_habit": {
      const habit = stringField("habit_id") || stringField("name");
      if (habit) return habit;
      break;
    }
    case "start_workout": {
      const program = stringField("program_id") || stringField("name");
      if (program) return program;
      break;
    }
    default:
      break;
  }

  return truncate(result);
}

/**
 * Будує картку для одного tool-call. Якщо tool не у KNOWN_TOOLS —
 * повертає `null` (UI лишає лише текстовий fallback).
 */
export function buildActionCard(input: CardInput): ChatActionCard | null {
  if (!KNOWN_TOOLS.has(input.name)) return null;

  const status = deriveStatus(input.result, input.failed);
  const inputObj = (input.input || {}) as Record<string, unknown>;
  const title = titleFor(input.name, status);
  const summary = summaryFor(input.name, inputObj, input.result);
  const module = moduleFor(input.name);
  const icon = iconFor(input.name);
  const risky = RISKY_TOOLS.has(input.name);

  return {
    id: `card_${input.name}_${Math.random().toString(36).slice(2, 10)}`,
    toolName: input.name,
    status,
    title,
    summary,
    module,
    icon,
    ...(risky ? { risky: true } : {}),
  };
}

export function isRiskyTool(name: string): boolean {
  return RISKY_TOOLS.has(name);
}
