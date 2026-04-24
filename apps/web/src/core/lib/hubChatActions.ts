import { resolveExpenseCategoryMeta } from "../../modules/finyk/utils";
import {
  createHabit as routineCreateHabit,
  loadRoutineState,
} from "../../modules/routine/lib/routineStorage";
import { saveRecipeToBook } from "../../modules/nutrition/lib/recipeBook";
import { ls, lsSet } from "./hubChatUtils.js";

interface ChangeCategoryAction {
  name: "change_category";
  input: { tx_id: string; category_id: string };
}

interface CreateDebtAction {
  name: "create_debt";
  input: {
    name: string;
    amount: number | string;
    due_date?: string;
    emoji?: string;
  };
}

interface CreateReceivableAction {
  name: "create_receivable";
  input: { name: string; amount: number | string };
}

interface HideTransactionAction {
  name: "hide_transaction";
  input: { tx_id: string };
}

interface SetBudgetLimitAction {
  name: "set_budget_limit";
  input: { category_id: string; limit: number | string };
}

interface SetMonthlyPlanAction {
  name: "set_monthly_plan";
  input: {
    income?: number | string | null;
    expense?: number | string | null;
    savings?: number | string | null;
  };
}

interface MarkHabitDoneAction {
  name: "mark_habit_done";
  input: { habit_id: string; date?: string };
}

interface PlanWorkoutAction {
  name: "plan_workout";
  input: {
    date?: string;
    time?: string;
    note?: string;
    exercises?: Array<{
      name: string;
      sets?: number | string;
      reps?: number | string;
      weight?: number | string;
    }>;
  };
}

interface LogMealAction {
  name: "log_meal";
  input: {
    name?: string;
    kcal?: number | string;
    protein_g?: number | string;
    fat_g?: number | string;
    carbs_g?: number | string;
  };
}

interface CreateHabitAction {
  name: "create_habit";
  input: {
    name: string;
    emoji?: string;
    recurrence?: string;
    weekdays?: number[];
    time_of_day?: string;
  };
}

interface CreateTransactionAction {
  name: "create_transaction";
  input: {
    type?: string;
    amount: number | string;
    category?: string;
    description?: string;
    date?: string;
  };
}

interface LogSetAction {
  name: "log_set";
  input: {
    exercise_name: string;
    weight_kg?: number | string;
    reps: number | string;
    sets?: number | string;
  };
}

interface LogWaterAction {
  name: "log_water";
  input: {
    amount_ml: number | string;
    date?: string;
  };
}

interface DeleteTransactionAction {
  name: "delete_transaction";
  input: { tx_id: string };
}

interface UpdateBudgetAction {
  name: "update_budget";
  input: {
    scope: "limit" | "goal";
    category_id?: string;
    limit?: number | string;
    name?: string;
    target_amount?: number | string;
    saved_amount?: number | string;
  };
}

interface MarkDebtPaidAction {
  name: "mark_debt_paid";
  input: {
    debt_id: string;
    amount?: number | string;
    note?: string;
  };
}

interface AddAssetAction {
  name: "add_asset";
  input: {
    name: string;
    amount: number | string;
    currency?: string;
  };
}

interface ImportMonobankRangeAction {
  name: "import_monobank_range";
  input: { from: string; to: string };
}

interface StartWorkoutAction {
  name: "start_workout";
  input: { note?: string; date?: string; time?: string };
}

interface FinishWorkoutAction {
  name: "finish_workout";
  input: { workout_id?: string };
}

interface LogMeasurementAction {
  name: "log_measurement";
  input: Record<string, number | string | undefined>;
}

interface AddProgramDayAction {
  name: "add_program_day";
  input: {
    weekday: number | string;
    name: string;
    exercises?: Array<{
      name: string;
      sets?: number | string;
      reps?: number | string;
      weight?: number | string;
    }>;
  };
}

interface LogWellbeingAction {
  name: "log_wellbeing";
  input: {
    weight_kg?: number | string;
    sleep_hours?: number | string;
    energy_level?: number | string;
    mood_score?: number | string;
    note?: string;
  };
}

interface CreateReminderAction {
  name: "create_reminder";
  input: { habit_id: string; time: string };
}

interface CompleteHabitForDateAction {
  name: "complete_habit_for_date";
  input: { habit_id: string; date: string; completed?: boolean };
}

interface ArchiveHabitAction {
  name: "archive_habit";
  input: { habit_id: string; archived?: boolean };
}

interface AddCalendarEventAction {
  name: "add_calendar_event";
  input: { name: string; date: string; time?: string; emoji?: string };
}

interface AddRecipeAction {
  name: "add_recipe";
  input: {
    title: string;
    ingredients?: string[];
    steps?: string[];
    servings?: number | string;
    time_minutes?: number | string;
    kcal?: number | string;
    protein_g?: number | string;
    fat_g?: number | string;
    carbs_g?: number | string;
  };
}

interface AddToShoppingListAction {
  name: "add_to_shopping_list";
  input: {
    name: string;
    quantity?: string;
    note?: string;
    category?: string;
  };
}

interface ConsumeFromPantryAction {
  name: "consume_from_pantry";
  input: { name: string };
}

interface SetDailyPlanAction {
  name: "set_daily_plan";
  input: {
    kcal?: number | string;
    protein_g?: number | string;
    fat_g?: number | string;
    carbs_g?: number | string;
    water_ml?: number | string;
  };
}

interface LogWeightAction {
  name: "log_weight";
  input: { weight_kg: number | string; note?: string };
}

interface SuggestWorkoutAction {
  name: "suggest_workout";
  input: { focus?: string };
}

interface CopyWorkoutAction {
  name: "copy_workout";
  input: { source_workout_id?: string; date?: string };
}

interface CompareProgressAction {
  name: "compare_progress";
  input: {
    exercise_name?: string;
    muscle_group?: string;
    period_days?: number | string;
  };
}

interface SplitTransactionAction {
  name: "split_transaction";
  input: {
    tx_id: string;
    parts: Array<{ category_id: string; amount: number | string }>;
  };
}

interface RecurringExpenseAction {
  name: "recurring_expense";
  input: {
    name: string;
    amount: number | string;
    day_of_month?: number | string;
    category?: string;
  };
}

interface ExportReportAction {
  name: "export_report";
  input: { period?: string; from?: string; to?: string };
}

interface EditHabitAction {
  name: "edit_habit";
  input: {
    habit_id: string;
    name?: string;
    emoji?: string;
    recurrence?: string;
    weekdays?: number[];
  };
}

interface ReorderHabitsAction {
  name: "reorder_habits";
  input: { habit_ids: string[] };
}

interface HabitStatsAction {
  name: "habit_stats";
  input: { habit_id: string; period_days?: number | string };
}

interface SuggestMealAction {
  name: "suggest_meal";
  input: { focus?: string; meal_type?: string };
}

interface CopyMealFromDateAction {
  name: "copy_meal_from_date";
  input: { source_date: string; meal_index?: number | string };
}

interface PlanMealsForDayAction {
  name: "plan_meals_for_day";
  input: {
    target_kcal?: number | string;
    meals_count?: number | string;
    preferences?: string;
  };
}

interface MorningBriefingAction {
  name: "morning_briefing";
  input: Record<string, never>;
}

interface WeeklySummaryAction {
  name: "weekly_summary";
  input: { include_recommendations?: boolean };
}

interface SetGoalAction {
  name: "set_goal";
  input: {
    description: string;
    target_weight_kg?: number | string;
    target_date?: string;
    daily_kcal?: number | string;
    workouts_per_week?: number | string;
  };
}

interface SpendingTrendAction {
  name: "spending_trend";
  input: { period_days?: number | string };
}

interface WeightChartAction {
  name: "weight_chart";
  input: { period_days?: number | string };
}

interface CategoryBreakdownAction {
  name: "category_breakdown";
  input: { period_days?: number | string };
}

interface DetectAnomaliesAction {
  name: "detect_anomalies";
  input: {
    period_days?: number | string;
    threshold_multiplier?: number | string;
  };
}

interface HabitTrendAction {
  name: "habit_trend";
  input: { habit_id?: string; period_days?: number | string };
}

interface Calculate1rmAction {
  name: "calculate_1rm";
  input: {
    weight_kg: number | string;
    reps: number | string;
    exercise_name?: string;
  };
}

interface ConvertUnitsAction {
  name: "convert_units";
  input: { value: number | string; from: string; to: string };
}

interface SaveNoteAction {
  name: "save_note";
  input: { text: string; tag?: string };
}

interface ListNotesAction {
  name: "list_notes";
  input: { tag?: string; limit?: number | string };
}

interface ExportModuleDataAction {
  name: "export_module_data";
  input: { module: string; format?: string };
}

interface RememberAction {
  name: "remember";
  input: { fact: string; category?: string };
}

interface ForgetAction {
  name: "forget";
  input: { fact_id: string };
}

interface MyProfileAction {
  name: "my_profile";
  input: { category?: string };
}

export type ChatAction =
  | ChangeCategoryAction
  | CreateDebtAction
  | CreateReceivableAction
  | HideTransactionAction
  | SetBudgetLimitAction
  | SetMonthlyPlanAction
  | MarkHabitDoneAction
  | PlanWorkoutAction
  | LogMealAction
  | CreateHabitAction
  | CreateTransactionAction
  | LogSetAction
  | LogWaterAction
  | DeleteTransactionAction
  | UpdateBudgetAction
  | MarkDebtPaidAction
  | AddAssetAction
  | ImportMonobankRangeAction
  | StartWorkoutAction
  | FinishWorkoutAction
  | LogMeasurementAction
  | AddProgramDayAction
  | LogWellbeingAction
  | CreateReminderAction
  | CompleteHabitForDateAction
  | ArchiveHabitAction
  | AddCalendarEventAction
  | AddRecipeAction
  | AddToShoppingListAction
  | ConsumeFromPantryAction
  | SetDailyPlanAction
  | LogWeightAction
  | SuggestWorkoutAction
  | CopyWorkoutAction
  | CompareProgressAction
  | SplitTransactionAction
  | RecurringExpenseAction
  | ExportReportAction
  | EditHabitAction
  | ReorderHabitsAction
  | HabitStatsAction
  | SuggestMealAction
  | CopyMealFromDateAction
  | PlanMealsForDayAction
  | MorningBriefingAction
  | WeeklySummaryAction
  | SetGoalAction
  | SpendingTrendAction
  | WeightChartAction
  | CategoryBreakdownAction
  | DetectAnomaliesAction
  | HabitTrendAction
  | Calculate1rmAction
  | ConvertUnitsAction
  | SaveNoteAction
  | ListNotesAction
  | ExportModuleDataAction
  | RememberAction
  | ForgetAction
  | MyProfileAction
  | { name: string; input: Record<string, unknown> };

interface BudgetLimit {
  id: string;
  type: "limit";
  categoryId: string;
  limit: number;
}

interface BudgetGoal {
  id: string;
  type: "goal";
  name: string;
  targetAmount: number;
  savedAmount?: number;
}

type Budget = BudgetLimit | BudgetGoal;

interface Debt {
  id: string;
  name: string;
  totalAmount: number;
  dueDate: string;
  emoji: string;
  linkedTxIds: string[];
}

interface Receivable {
  id: string;
  name: string;
  amount: number;
  linkedTxIds: string[];
}

interface MonthlyPlan {
  income?: string;
  expense?: string;
  savings?: string;
}

interface HabitState {
  habits: Array<{ id: string; name?: string; emoji?: string }>;
  completions: Record<string, string[]>;
}

interface WorkoutSet {
  weightKg: number;
  reps: number;
}

interface WorkoutItem {
  id: string;
  nameUk: string;
  type: "strength";
  musclesPrimary: string[];
  musclesSecondary: string[];
  sets: WorkoutSet[];
  durationSec: number;
  distanceM: number;
}

interface Workout {
  id: string;
  startedAt: string;
  endedAt: string | null;
  items: WorkoutItem[];
  groups: unknown[];
  warmup: unknown | null;
  cooldown: unknown | null;
  note: string;
  planned: boolean;
}

interface NutritionMeal {
  id: string;
  name: string;
  macros: {
    kcal: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  };
  addedAt: string;
}

interface NutritionDay {
  meals: NutritionMeal[];
}

export function executeAction(action: ChatAction): string {
  try {
    switch (action.name) {
      case "change_category": {
        const { tx_id, category_id } = (action as ChangeCategoryAction).input;
        const cats = ls<Record<string, string>>("finyk_tx_cats", {});
        cats[tx_id] = category_id;
        lsSet("finyk_tx_cats", cats);
        const customC = ls<unknown[]>("finyk_custom_cats_v1", []);
        const cat = resolveExpenseCategoryMeta(category_id, customC);
        return `Категорію транзакції ${tx_id} змінено на ${cat?.label || category_id}`;
      }
      case "create_debt": {
        const { name, amount, due_date, emoji } = (action as CreateDebtAction)
          .input;
        const debts = ls<Debt[]>("finyk_debts", []);
        const newDebt: Debt = {
          id: `d_${Date.now()}`,
          name,
          totalAmount: Number(amount),
          dueDate: due_date || "",
          emoji: emoji || "💸",
          linkedTxIds: [],
        };
        debts.push(newDebt);
        lsSet("finyk_debts", debts);
        return `Борг "${name}" на ${amount} грн створено (id:${newDebt.id})`;
      }
      case "create_receivable": {
        const { name, amount } = (action as CreateReceivableAction).input;
        const recv = ls<Receivable[]>("finyk_recv", []);
        const newRecv: Receivable = {
          id: `r_${Date.now()}`,
          name,
          amount: Number(amount),
          linkedTxIds: [],
        };
        recv.push(newRecv);
        lsSet("finyk_recv", recv);
        return `Дебіторку "${name}" на ${amount} грн додано (id:${newRecv.id})`;
      }
      case "hide_transaction": {
        const { tx_id } = (action as HideTransactionAction).input;
        const hidden = ls<string[]>("finyk_hidden_txs", []);
        if (!hidden.includes(tx_id)) {
          hidden.push(tx_id);
          lsSet("finyk_hidden_txs", hidden);
        }
        return `Транзакцію ${tx_id} приховано зі статистики`;
      }
      case "set_budget_limit": {
        const { category_id, limit } = (action as SetBudgetLimitAction).input;
        const budgets = ls<Budget[]>("finyk_budgets", []);
        const idx = budgets.findIndex(
          (b) => b.type === "limit" && b.categoryId === category_id,
        );
        if (idx >= 0) {
          (budgets[idx] as BudgetLimit).limit = Number(limit);
        } else {
          budgets.push({
            id: `b_${Date.now()}`,
            type: "limit",
            categoryId: category_id,
            limit: Number(limit),
          });
        }
        lsSet("finyk_budgets", budgets);
        const customC = ls<unknown[]>("finyk_custom_cats_v1", []);
        const cat = resolveExpenseCategoryMeta(category_id, customC);
        return `Ліміт ${cat?.label || category_id} встановлено: ${limit} грн`;
      }
      case "set_monthly_plan": {
        const { income, expense, savings } = (action as SetMonthlyPlanAction)
          .input;
        const cur = ls<MonthlyPlan>("finyk_monthly_plan", {});
        const next: MonthlyPlan = { ...cur };
        if (income != null && income !== "") next.income = String(income);
        if (expense != null && expense !== "") next.expense = String(expense);
        if (savings != null && savings !== "") next.savings = String(savings);
        lsSet("finyk_monthly_plan", next);
        return `Фінплан місяця оновлено: дохід ${next.income ?? "—"} / витрати ${next.expense ?? "—"} / заощадження ${next.savings ?? "—"} грн/міс`;
      }
      case "mark_habit_done": {
        const { habit_id, date: habitDate } = (action as MarkHabitDoneAction)
          .input;
        const routineState = ls<HabitState>("hub_routine_v1", {
          habits: [],
          completions: {},
        });
        const completions: Record<string, string[]> = {
          ...(routineState.completions || {}),
        };
        const now = new Date();
        const targetDate =
          habitDate ||
          [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0"),
          ].join("-");
        const arr = Array.isArray(completions[habit_id])
          ? completions[habit_id].slice()
          : [];
        if (!arr.includes(targetDate)) arr.push(targetDate);
        completions[habit_id] = arr;
        lsSet("hub_routine_v1", { ...routineState, completions });
        const habit = (routineState.habits || []).find(
          (h) => h.id === habit_id,
        );
        return `Звичку "${habit?.name || habit_id}" відмічено як виконану (${targetDate})`;
      }
      case "plan_workout": {
        const { date, time, note, exercises } =
          (action as PlanWorkoutAction).input || {};
        const now = new Date();
        const today = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
        ].join("-");
        const targetDate =
          date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
        const timeStr =
          time && /^\d{1,2}:\d{2}$/.test(String(time).trim())
            ? String(time).trim().padStart(5, "0")
            : "09:00";
        const startedAt = new Date(`${targetDate}T${timeStr}:00`).toISOString();
        const wid = `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const items: WorkoutItem[] = Array.isArray(exercises)
          ? exercises
              .filter((ex) => ex && ex.name)
              .map((ex, i) => {
                const setsN = Math.max(1, Math.min(20, Number(ex.sets) || 3));
                const reps =
                  ex.reps != null && Number.isFinite(Number(ex.reps))
                    ? Number(ex.reps)
                    : 0;
                const weightKg =
                  ex.weight != null && Number.isFinite(Number(ex.weight))
                    ? Number(ex.weight)
                    : 0;
                const sets: WorkoutSet[] = Array.from(
                  { length: setsN },
                  () => ({
                    weightKg,
                    reps,
                  }),
                );
                return {
                  id: `i_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`,
                  nameUk: String(ex.name).trim(),
                  type: "strength",
                  musclesPrimary: [],
                  musclesSecondary: [],
                  sets,
                  durationSec: 0,
                  distanceM: 0,
                };
              })
          : [];
        const newW: Workout = {
          id: wid,
          startedAt,
          endedAt: null,
          items,
          groups: [],
          warmup: null,
          cooldown: null,
          note: note ? String(note).trim() : "",
          planned: true,
        };
        const wRaw = localStorage.getItem("fizruk_workouts_v1");
        let existing: Workout[] = [];
        try {
          const parsed = wRaw ? JSON.parse(wRaw) : null;
          if (Array.isArray(parsed)) existing = parsed as Workout[];
          else if (parsed && Array.isArray(parsed.workouts))
            existing = parsed.workouts as Workout[];
        } catch {}
        lsSet("fizruk_workouts_v1", {
          schemaVersion: 1,
          workouts: [newW, ...existing],
        });
        const exCount = items.length;
        return `Тренування заплановано на ${targetDate} о ${timeStr}${note ? ` ("${note}")` : ""}: ${exCount} вправ${exCount === 1 ? "а" : exCount >= 2 && exCount <= 4 ? "и" : ""} (id:${wid})`;
      }
      case "log_meal": {
        const { name, kcal, protein_g, fat_g, carbs_g } = (
          action as LogMealAction
        ).input;
        const nutritionLog = ls<Record<string, NutritionDay>>(
          "nutrition_log_v1",
          {},
        );
        const now = new Date();
        const todayKey = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
        ].join("-");
        const dayData: NutritionDay = {
          ...(nutritionLog[todayKey] || { meals: [] }),
        };
        const meals: NutritionMeal[] = Array.isArray(dayData.meals)
          ? dayData.meals.slice()
          : [];
        meals.push({
          id: `m_${Date.now()}`,
          name: name || "Без назви",
          macros: {
            kcal: Number(kcal) || 0,
            protein_g: Number(protein_g) || 0,
            fat_g: Number(fat_g) || 0,
            carbs_g: Number(carbs_g) || 0,
          },
          addedAt: new Date().toISOString(),
        });
        nutritionLog[todayKey] = { ...dayData, meals };
        lsSet("nutrition_log_v1", nutritionLog);
        return `Прийом їжі "${name || "Без назви"}" записано: ${Math.round(Number(kcal) || 0)} ккал`;
      }
      case "create_habit": {
        const {
          name,
          emoji,
          recurrence,
          weekdays,
          time_of_day: timeOfDay,
        } = (action as CreateHabitAction).input;
        const trimmed = (name || "").trim();
        if (!trimmed) return "Не можу створити звичку без назви.";
        const allowedRec = new Set([
          "daily",
          "weekdays",
          "weekly",
          "monthly",
          "once",
        ]);
        const rec =
          recurrence && allowedRec.has(recurrence) ? recurrence : "daily";
        const wdays = Array.isArray(weekdays)
          ? weekdays
              .map((d) => Number(d))
              .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
          : undefined;
        const tod =
          timeOfDay && /^\d{1,2}:\d{2}$/.test(String(timeOfDay).trim())
            ? String(timeOfDay).trim().padStart(5, "0")
            : "";
        const state = loadRoutineState();
        const nextState = routineCreateHabit(state, {
          name: trimmed,
          emoji: emoji || "✓",
          recurrence: rec,
          weekdays: wdays && wdays.length ? wdays : undefined,
          timeOfDay: tod,
        });
        const created = nextState.habits[nextState.habits.length - 1];
        const recLabelMap: Record<string, string> = {
          daily: "щодня",
          weekdays: "по буднях",
          weekly: "щотижня",
          monthly: "щомісяця",
          once: "разово",
        };
        return `Звичку "${trimmed}" створено (${recLabelMap[rec] || rec}, id:${created?.id || "?"})`;
      }
      case "create_transaction": {
        const { type, amount, category, description, date } = (
          action as CreateTransactionAction
        ).input;
        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
          return "Некоректна сума транзакції.";
        }
        const txType = type === "income" ? "income" : "expense";
        const nowIso = new Date().toISOString();
        const isoDate =
          date && /^\d{4}-\d{2}-\d{2}$/.test(date)
            ? new Date(`${date}T12:00:00`).toISOString()
            : nowIso;
        const customC = ls<Array<{ id: string; label?: string }>>(
          "finyk_custom_cats_v1",
          [],
        );
        let categoryLabel = "";
        if (category && category.trim()) {
          const meta = resolveExpenseCategoryMeta(category.trim(), customC);
          categoryLabel = meta?.label || category.trim();
        }
        const manualId = `m_${Date.now().toString(36)}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        const manualExpenses = ls<
          Array<{
            id: string;
            date: string;
            description?: string;
            amount: number;
            category?: string;
            type?: string;
          }>
        >("finyk_manual_expenses_v1", []);
        const entry = {
          id: manualId,
          date: isoDate,
          description: description?.trim() || "",
          amount: Math.abs(amt),
          category: category?.trim() || "",
          type: txType,
        };
        manualExpenses.unshift(entry);
        lsSet("finyk_manual_expenses_v1", manualExpenses);
        const label = categoryLabel ? ` (${categoryLabel})` : "";
        const human = txType === "income" ? "Дохід" : "Витрату";
        return `${human} ${amt} грн${description ? ` "${description.trim()}"` : ""}${label} записано (id:${manualId})`;
      }
      case "log_set": {
        const { exercise_name, weight_kg, reps, sets } = (
          action as LogSetAction
        ).input;
        const exName = (exercise_name || "").trim();
        if (!exName) return "Потрібна назва вправи для підходу.";
        const repsN = Number(reps);
        if (!Number.isFinite(repsN) || repsN <= 0) {
          return "Некоректна кількість повторень.";
        }
        const weightN = Number(weight_kg);
        const weightKg = Number.isFinite(weightN) && weightN >= 0 ? weightN : 0;
        const setsN = Math.max(1, Math.min(20, Number(sets) || 1));
        const newSets: WorkoutSet[] = Array.from({ length: setsN }, () => ({
          weightKg,
          reps: repsN,
        }));

        const wRaw = localStorage.getItem("fizruk_workouts_v1");
        let workouts: Workout[] = [];
        try {
          const parsed = wRaw ? JSON.parse(wRaw) : null;
          if (Array.isArray(parsed)) workouts = parsed as Workout[];
          else if (parsed && Array.isArray(parsed.workouts))
            workouts = parsed.workouts as Workout[];
        } catch {}

        const activeId = ls<string | null>("fizruk_active_workout_id_v1", null);
        const exerciseNameLower = exName.toLowerCase();

        let targetIdx = -1;
        if (activeId) {
          targetIdx = workouts.findIndex((w) => w.id === activeId);
        }
        if (targetIdx < 0) {
          targetIdx = workouts.findIndex((w) => !w.endedAt);
        }

        let workout: Workout;
        let created = false;
        if (targetIdx >= 0) {
          workout = {
            ...workouts[targetIdx],
            items: [...workouts[targetIdx].items],
          };
        } else {
          created = true;
          workout = {
            id: `w_${Date.now().toString(36)}_${Math.random()
              .toString(36)
              .slice(2, 8)}`,
            startedAt: new Date().toISOString(),
            endedAt: null,
            items: [],
            groups: [],
            warmup: null,
            cooldown: null,
            note: "",
            planned: false,
          };
        }

        const itemIdx = workout.items.findIndex(
          (it) => it.nameUk.trim().toLowerCase() === exerciseNameLower,
        );
        if (itemIdx >= 0) {
          const item = { ...workout.items[itemIdx] };
          item.sets = [...item.sets, ...newSets];
          workout.items[itemIdx] = item;
        } else {
          workout.items.push({
            id: `i_${Date.now().toString(36)}_${Math.random()
              .toString(36)
              .slice(2, 6)}`,
            nameUk: exName,
            type: "strength",
            musclesPrimary: [],
            musclesSecondary: [],
            sets: newSets,
            durationSec: 0,
            distanceM: 0,
          });
        }

        if (created) {
          workouts = [workout, ...workouts];
          lsSet("fizruk_active_workout_id_v1", workout.id);
        } else {
          workouts[targetIdx] = workout;
        }
        lsSet("fizruk_workouts_v1", {
          schemaVersion: 1,
          workouts,
        });

        const weightLabel = weightKg > 0 ? `${weightKg} кг × ` : "";
        const setsLabel =
          setsN === 1 ? "1 підхід" : `${setsN} підходи${setsN >= 5 ? "в" : ""}`;
        const prefix = created ? "Нове тренування розпочато. " : "";
        return `${prefix}Додано ${setsLabel} "${exName}": ${weightLabel}${repsN} повторень`;
      }
      case "log_water": {
        const { amount_ml, date: waterDate } = (action as LogWaterAction).input;
        const ml = Math.floor(Number(amount_ml));
        if (!Number.isFinite(ml) || ml <= 0) {
          return "Некоректна кількість води.";
        }
        const now = new Date();
        const today = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
        ].join("-");
        const dateKey =
          waterDate && /^\d{4}-\d{2}-\d{2}$/.test(waterDate)
            ? waterDate
            : today;
        const log = ls<Record<string, number>>("nutrition_water_v1", {});
        const prev = Number(log[dateKey]) || 0;
        log[dateKey] = prev + ml;
        lsSet("nutrition_water_v1", log);
        return `Додано ${ml} мл води (разом за ${dateKey}: ${log[dateKey]} мл)`;
      }
      case "delete_transaction": {
        const { tx_id } = (action as DeleteTransactionAction).input;
        const id = String(tx_id || "").trim();
        if (!id) return "Потрібен tx_id для видалення.";
        if (!id.startsWith("m_")) {
          return `Транзакцію ${id} не видалено: можна видаляти лише ручні (m_…). Для монобанк-транзакцій використайте hide_transaction.`;
        }
        const list = ls<Array<{ id: string }>>("finyk_manual_expenses_v1", []);
        const idx = list.findIndex((t) => t.id === id);
        if (idx < 0) return `Транзакцію ${id} не знайдено (вже видалена).`;
        const next = list.slice();
        next.splice(idx, 1);
        lsSet("finyk_manual_expenses_v1", next);
        return `Транзакцію ${id} видалено`;
      }
      case "update_budget": {
        const input = (action as UpdateBudgetAction).input;
        const scope = input.scope;
        const budgets = ls<Budget[]>("finyk_budgets", []);
        if (scope === "limit") {
          const categoryId = String(input.category_id || "").trim();
          const limitN = Number(input.limit);
          if (!categoryId) return "Для scope='limit' потрібен category_id.";
          if (!Number.isFinite(limitN) || limitN <= 0)
            return "Для scope='limit' потрібен додатний limit.";
          const idx = budgets.findIndex(
            (b) => b.type === "limit" && b.categoryId === categoryId,
          );
          if (idx >= 0) {
            (budgets[idx] as BudgetLimit).limit = limitN;
          } else {
            budgets.push({
              id: `b_${Date.now()}`,
              type: "limit",
              categoryId,
              limit: limitN,
            });
          }
          lsSet("finyk_budgets", budgets);
          const customC = ls<unknown[]>("finyk_custom_cats_v1", []);
          const cat = resolveExpenseCategoryMeta(categoryId, customC);
          return `Ліміт ${cat?.label || categoryId} оновлено: ${limitN} грн`;
        }
        if (scope === "goal") {
          const goalName = String(input.name || "").trim();
          const target = Number(input.target_amount);
          if (!goalName) return "Для scope='goal' потрібне name.";
          if (!Number.isFinite(target) || target <= 0)
            return "Для scope='goal' потрібен додатний target_amount.";
          const saved =
            input.saved_amount != null &&
            Number.isFinite(Number(input.saved_amount))
              ? Number(input.saved_amount)
              : 0;
          const idx = budgets.findIndex(
            (b) =>
              b.type === "goal" &&
              (b as BudgetGoal).name.trim().toLowerCase() ===
                goalName.toLowerCase(),
          );
          if (idx >= 0) {
            const g = budgets[idx] as BudgetGoal;
            g.targetAmount = target;
            g.savedAmount = saved;
            g.name = goalName;
          } else {
            budgets.push({
              id: `b_${Date.now()}`,
              type: "goal",
              name: goalName,
              targetAmount: target,
              savedAmount: saved,
            });
          }
          lsSet("finyk_budgets", budgets);
          return `Ціль "${goalName}" оновлено: ${saved}/${target} грн`;
        }
        return "Невідомий scope для update_budget (очікую 'limit' або 'goal').";
      }
      case "mark_debt_paid": {
        const { debt_id, amount, note } = (action as MarkDebtPaidAction).input;
        const id = String(debt_id || "").trim();
        if (!id) return "Потрібен debt_id.";
        const debts = ls<Debt[]>("finyk_debts", []);
        const idx = debts.findIndex((d) => d.id === id);
        if (idx < 0) return `Борг ${id} не знайдено.`;
        const debt = { ...debts[idx] };
        const payAmount =
          amount != null && Number.isFinite(Number(amount))
            ? Math.abs(Number(amount))
            : Number(debt.totalAmount) || 0;
        if (payAmount <= 0) return "Сума погашення має бути додатною.";
        const txId = `m_${Date.now().toString(36)}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;
        const manualExpenses = ls<
          Array<{
            id: string;
            date: string;
            description?: string;
            amount: number;
            category?: string;
            type?: string;
          }>
        >("finyk_manual_expenses_v1", []);
        manualExpenses.unshift({
          id: txId,
          date: new Date().toISOString(),
          description:
            (note && String(note).trim()) || `Погашення: ${debt.name}`,
          amount: payAmount,
          category: "",
          type: "expense",
        });
        lsSet("finyk_manual_expenses_v1", manualExpenses);
        debt.linkedTxIds = [...(debt.linkedTxIds || []), txId];
        const totalPaid = payAmount;
        const closed = totalPaid >= Number(debt.totalAmount);
        if (closed) {
          debts.splice(idx, 1);
        } else {
          debts[idx] = debt;
        }
        lsSet("finyk_debts", debts);
        return `Погашено ${payAmount} грн з "${debt.name}"${closed ? " — борг закрито" : ""} (tx:${txId})`;
      }
      case "add_asset": {
        const { name, amount, currency } = (action as AddAssetAction).input;
        const trimmed = (name || "").trim();
        const amt = Number(amount);
        if (!trimmed) return "Потрібна назва активу.";
        if (!Number.isFinite(amt) || amt <= 0)
          return "Сума активу має бути додатною.";
        const cur =
          (currency && String(currency).trim().slice(0, 3).toUpperCase()) ||
          "UAH";
        const assets = ls<
          Array<{ name: string; amount: number | string; currency?: string }>
        >("finyk_assets", []);
        assets.push({ name: trimmed, amount: amt, currency: cur });
        lsSet("finyk_assets", assets);
        return `Актив "${trimmed}" додано: ${amt} ${cur}`;
      }
      case "import_monobank_range": {
        const { from, to } = (action as ImportMonobankRangeAction).input;
        const fromStr = String(from || "").trim();
        const toStr = String(to || "").trim();
        const dateRe = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRe.test(fromStr) || !dateRe.test(toStr))
          return "Дати мають бути у форматі YYYY-MM-DD.";
        const fromD = new Date(`${fromStr}T00:00:00`);
        const toD = new Date(`${toStr}T00:00:00`);
        if (
          !Number.isFinite(fromD.getTime()) ||
          !Number.isFinite(toD.getTime()) ||
          fromD > toD
        ) {
          return "Некоректний діапазон дат.";
        }
        const clearedMonths: string[] = [];
        const cur = new Date(fromD.getFullYear(), fromD.getMonth(), 1);
        const end = new Date(toD.getFullYear(), toD.getMonth(), 1);
        while (cur <= end) {
          const y = cur.getFullYear();
          const m0 = cur.getMonth();
          try {
            localStorage.removeItem(`finyk_tx_cache_${y}_${m0}`);
          } catch {}
          clearedMonths.push(`${y}-${String(m0 + 1).padStart(2, "0")}`);
          cur.setMonth(cur.getMonth() + 1);
        }
        try {
          if (
            typeof window !== "undefined" &&
            typeof CustomEvent === "function"
          ) {
            window.dispatchEvent(
              new CustomEvent("hub:finyk-mono-import-range", {
                detail: { from: fromStr, to: toStr },
              }),
            );
          }
        } catch {}
        return `Запит на оновлення Монобанку з ${fromStr} до ${toStr} прийнято. Очищено кеш за ${clearedMonths.length} міс. (${clearedMonths.join(", ")}). Оновиться при відкритті Фініка.`;
      }
      case "start_workout": {
        const { note, date, time } = (action as StartWorkoutAction).input || {};
        const now = new Date();
        const today = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
        ].join("-");
        const targetDate =
          date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
        const timeStr =
          time && /^\d{1,2}:\d{2}$/.test(String(time).trim())
            ? String(time).trim().padStart(5, "0")
            : `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const startedAt = new Date(`${targetDate}T${timeStr}:00`).toISOString();
        const existingActiveId = ls<string | null>(
          "fizruk_active_workout_id_v1",
          null,
        );
        const wRaw = localStorage.getItem("fizruk_workouts_v1");
        let workouts: Workout[] = [];
        try {
          const parsed = wRaw ? JSON.parse(wRaw) : null;
          if (Array.isArray(parsed)) workouts = parsed as Workout[];
          else if (parsed && Array.isArray(parsed.workouts))
            workouts = parsed.workouts as Workout[];
        } catch {}
        if (
          existingActiveId &&
          workouts.some((w) => w.id === existingActiveId && !w.endedAt)
        ) {
          return `Вже є активне тренування (id:${existingActiveId}). Спочатку заверши його (finish_workout).`;
        }
        const wid = `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const newW: Workout = {
          id: wid,
          startedAt,
          endedAt: null,
          items: [],
          groups: [],
          warmup: null,
          cooldown: null,
          note: note ? String(note).trim() : "",
          planned: false,
        };
        lsSet("fizruk_workouts_v1", {
          schemaVersion: 1,
          workouts: [newW, ...workouts],
        });
        lsSet("fizruk_active_workout_id_v1", wid);
        return `Тренування розпочато о ${timeStr}${note ? ` ("${String(note).trim()}")` : ""} (id:${wid})`;
      }
      case "finish_workout": {
        const { workout_id } = (action as FinishWorkoutAction).input || {};
        const activeId = ls<string | null>("fizruk_active_workout_id_v1", null);
        const wRaw = localStorage.getItem("fizruk_workouts_v1");
        let workouts: Workout[] = [];
        try {
          const parsed = wRaw ? JSON.parse(wRaw) : null;
          if (Array.isArray(parsed)) workouts = parsed as Workout[];
          else if (parsed && Array.isArray(parsed.workouts))
            workouts = parsed.workouts as Workout[];
        } catch {}
        const targetId =
          (workout_id && String(workout_id).trim()) ||
          activeId ||
          workouts.find((w) => !w.endedAt)?.id ||
          "";
        if (!targetId) return "Немає активного тренування для завершення.";
        const idx = workouts.findIndex((w) => w.id === targetId);
        if (idx < 0) return `Тренування ${targetId} не знайдено.`;
        if (workouts[idx].endedAt) {
          if (activeId === targetId) lsSet("fizruk_active_workout_id_v1", null);
          return `Тренування ${targetId} вже завершено.`;
        }
        workouts[idx] = {
          ...workouts[idx],
          endedAt: new Date().toISOString(),
        };
        lsSet("fizruk_workouts_v1", { schemaVersion: 1, workouts });
        if (activeId === targetId) lsSet("fizruk_active_workout_id_v1", null);
        const setsCount = workouts[idx].items.reduce(
          (acc, it) => acc + (Array.isArray(it.sets) ? it.sets.length : 0),
          0,
        );
        return `Тренування завершено (id:${targetId}), підходів: ${setsCount}`;
      }
      case "log_measurement": {
        const input = (action as LogMeasurementAction).input || {};
        const keyMap: Record<string, string> = {
          weight_kg: "weightKg",
          body_fat_pct: "bodyFatPct",
          neck_cm: "neckCm",
          chest_cm: "chestCm",
          waist_cm: "waistCm",
          hips_cm: "hipsCm",
          bicep_l_cm: "bicepLCm",
          bicep_r_cm: "bicepRCm",
          forearm_l_cm: "forearmLCm",
          forearm_r_cm: "forearmRCm",
          thigh_l_cm: "thighLCm",
          thigh_r_cm: "thighRCm",
          calf_l_cm: "calfLCm",
          calf_r_cm: "calfRCm",
        };
        const entry: Record<string, number | string> = {
          id: `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          at: new Date().toISOString(),
        };
        const changed: string[] = [];
        for (const [src, dst] of Object.entries(keyMap)) {
          const v = input[src];
          if (v != null && v !== "") {
            const n = Number(v);
            if (Number.isFinite(n) && n > 0) {
              entry[dst] = n;
              changed.push(`${dst}=${n}`);
            }
          }
        }
        if (changed.length === 0)
          return "Немає жодного валідного поля для заміру.";
        const existing = ls<Array<Record<string, unknown>>>(
          "fizruk_measurements_v1",
          [],
        );
        lsSet("fizruk_measurements_v1", [entry, ...existing]);
        return `Заміри записано: ${changed.join(", ")}`;
      }
      case "add_program_day": {
        const { weekday, name, exercises } = (action as AddProgramDayAction)
          .input;
        const wd = Number(weekday);
        if (!Number.isInteger(wd) || wd < 0 || wd > 6)
          return "weekday має бути цілим 0..6.";
        const dayName = (name || "").trim();
        if (!dayName) return "Потрібна назва тренування.";
        const exList: Array<{
          name: string;
          sets?: number;
          reps?: number;
          weight?: number;
        }> = [];
        if (Array.isArray(exercises)) {
          for (const ex of exercises) {
            if (!ex || typeof ex !== "object") continue;
            const exName = String(ex.name || "").trim();
            if (!exName) continue;
            const setsN = Number(ex.sets);
            const repsN = Number(ex.reps);
            const weightN = Number(ex.weight);
            exList.push({
              name: exName,
              sets: Number.isFinite(setsN) && setsN > 0 ? setsN : undefined,
              reps: Number.isFinite(repsN) && repsN > 0 ? repsN : undefined,
              weight:
                Number.isFinite(weightN) && weightN >= 0 ? weightN : undefined,
            });
          }
        }
        const tpl = ls<{
          schemaVersion?: number;
          days?: Record<string, { name: string; exercises: unknown[] }>;
        }>("fizruk_plan_template_v1", {});
        const days = { ...(tpl.days || {}) };
        days[String(wd)] = { name: dayName, exercises: exList };
        lsSet("fizruk_plan_template_v1", { schemaVersion: 1, days });
        const weekdayLabels = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"];
        return `День "${dayName}" (${weekdayLabels[wd]}) збережено: ${exList.length} вправ.`;
      }
      case "log_wellbeing": {
        const input = (action as LogWellbeingAction).input || {};
        const entry: Record<string, number | string | null> = {
          id: `dl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          at: new Date().toISOString(),
          weightKg: null,
          sleepHours: null,
          energyLevel: null,
          moodScore: null,
          note: "",
        };
        const parts: string[] = [];
        const weight = Number(input.weight_kg);
        if (Number.isFinite(weight) && weight > 0) {
          entry.weightKg = weight;
          parts.push(`вага ${weight} кг`);
        }
        const sleep = Number(input.sleep_hours);
        if (Number.isFinite(sleep) && sleep >= 0 && sleep <= 24) {
          entry.sleepHours = sleep;
          parts.push(`сон ${sleep} год`);
        }
        const energy = Number(input.energy_level);
        if (Number.isFinite(energy) && energy >= 1 && energy <= 5) {
          entry.energyLevel = Math.round(energy);
          parts.push(`енергія ${Math.round(energy)}/5`);
        }
        const mood = Number(input.mood_score);
        if (Number.isFinite(mood) && mood >= 1 && mood <= 5) {
          entry.moodScore = Math.round(mood);
          parts.push(`настрій ${Math.round(mood)}/5`);
        }
        if (input.note && String(input.note).trim()) {
          entry.note = String(input.note).trim().slice(0, 500);
        }
        if (parts.length === 0 && !entry.note)
          return "Немає жодного валідного поля для самопочуття.";
        const existing = ls<Array<Record<string, unknown>>>(
          "fizruk_daily_log_v1",
          [],
        );
        lsSet("fizruk_daily_log_v1", [entry, ...existing]);
        return `Самопочуття записано${parts.length ? ": " + parts.join(", ") : ""}.`;
      }
      case "create_reminder": {
        const { habit_id, time } = (action as CreateReminderAction).input;
        const id = String(habit_id || "").trim();
        const t = String(time || "").trim();
        if (!id) return "Потрібен habit_id.";
        if (!/^\d{1,2}:\d{2}$/.test(t)) return "Час має бути у форматі HH:MM.";
        const normTime = t.padStart(5, "0");
        const state = ls<{
          habits?: Array<{
            id: string;
            name?: string;
            reminderTimes?: string[];
          }>;
        }>("hub_routine_v1", {});
        const habits = Array.isArray(state.habits) ? state.habits.slice() : [];
        const hIdx = habits.findIndex((h) => h.id === id);
        if (hIdx < 0) return `Звичку ${id} не знайдено.`;
        const reminders = Array.isArray(habits[hIdx].reminderTimes)
          ? [...(habits[hIdx].reminderTimes as string[])]
          : [];
        if (reminders.includes(normTime)) {
          return `Нагадування ${normTime} для "${habits[hIdx].name || id}" вже існує.`;
        }
        reminders.push(normTime);
        reminders.sort();
        habits[hIdx] = { ...habits[hIdx], reminderTimes: reminders };
        lsSet("hub_routine_v1", { ...state, habits });
        return `Нагадування ${normTime} додано до "${habits[hIdx].name || id}"`;
      }
      case "complete_habit_for_date": {
        const { habit_id, date, completed } = (
          action as CompleteHabitForDateAction
        ).input;
        const id = String(habit_id || "").trim();
        const d = String(date || "").trim();
        if (!id) return "Потрібен habit_id.";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d))
          return "Дата має бути у форматі YYYY-MM-DD.";
        const doComplete = completed !== false;
        const state = ls<{
          habits?: Array<{ id: string; name?: string }>;
          completions?: Record<string, string[]>;
        }>("hub_routine_v1", {});
        const habits = Array.isArray(state.habits) ? state.habits : [];
        const habit = habits.find((h) => h.id === id);
        if (!habit) return `Звичку ${id} не знайдено.`;
        const completions: Record<string, string[]> = {
          ...(state.completions || {}),
        };
        const cur = Array.isArray(completions[id])
          ? completions[id].slice()
          : [];
        const has = cur.includes(d);
        if (doComplete) {
          if (!has) cur.push(d);
        } else {
          const idx = cur.indexOf(d);
          if (idx >= 0) cur.splice(idx, 1);
        }
        completions[id] = cur.sort();
        lsSet("hub_routine_v1", { ...state, completions });
        return `Звичку "${habit.name || id}" ${doComplete ? "відмічено" : "знято з позначки"} на ${d}`;
      }
      case "archive_habit": {
        const { habit_id, archived } = (action as ArchiveHabitAction).input;
        const id = String(habit_id || "").trim();
        const doArchive = archived !== false;
        if (!id) return "Потрібен habit_id.";
        const state = ls<{
          habits?: Array<{ id: string; name?: string; archived?: boolean }>;
        }>("hub_routine_v1", {});
        const habits = Array.isArray(state.habits) ? state.habits.slice() : [];
        const idx = habits.findIndex((h) => h.id === id);
        if (idx < 0) return `Звичку ${id} не знайдено.`;
        if (!!habits[idx].archived === doArchive) {
          return `Звичку "${habits[idx].name || id}" вже ${doArchive ? "заархівовано" : "активна"}.`;
        }
        habits[idx] = { ...habits[idx], archived: doArchive };
        lsSet("hub_routine_v1", { ...state, habits });
        return `Звичку "${habits[idx].name || id}" ${doArchive ? "заархівовано" : "повернуто з архіву"}`;
      }
      case "add_calendar_event": {
        const { name, date, time, emoji } = (action as AddCalendarEventAction)
          .input;
        const evName = (name || "").trim();
        const d = String(date || "").trim();
        if (!evName) return "Потрібна назва події.";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d))
          return "Дата має бути у форматі YYYY-MM-DD.";
        const tod =
          time && /^\d{1,2}:\d{2}$/.test(String(time).trim())
            ? String(time).trim().padStart(5, "0")
            : "";
        const state = loadRoutineState();
        const nextState = routineCreateHabit(state, {
          name: evName,
          emoji: emoji || "📅",
          recurrence: "once",
          startDate: d,
          endDate: d,
          timeOfDay: tod,
        });
        const created = nextState.habits[nextState.habits.length - 1];
        return `Подію "${evName}" додано на ${d}${tod ? ` о ${tod}` : ""} (id:${created?.id || "?"})`;
      }
      case "add_recipe": {
        const {
          title,
          ingredients,
          steps,
          servings,
          time_minutes,
          kcal,
          protein_g,
          fat_g,
          carbs_g,
        } = (action as AddRecipeAction).input;
        const t = (title || "").trim();
        if (!t) return "Потрібна назва рецепту.";
        const payload = {
          title: t,
          servings:
            servings != null && Number.isFinite(Number(servings))
              ? Number(servings)
              : null,
          timeMinutes:
            time_minutes != null && Number.isFinite(Number(time_minutes))
              ? Number(time_minutes)
              : null,
          ingredients: Array.isArray(ingredients)
            ? ingredients.map((x) => String(x)).filter(Boolean)
            : [],
          steps: Array.isArray(steps)
            ? steps.map((x) => String(x)).filter(Boolean)
            : [],
          tips: [],
          macros: {
            kcal:
              kcal != null && Number.isFinite(Number(kcal))
                ? Number(kcal)
                : null,
            protein_g:
              protein_g != null && Number.isFinite(Number(protein_g))
                ? Number(protein_g)
                : null,
            fat_g:
              fat_g != null && Number.isFinite(Number(fat_g))
                ? Number(fat_g)
                : null,
            carbs_g:
              carbs_g != null && Number.isFinite(Number(carbs_g))
                ? Number(carbs_g)
                : null,
          },
        };
        void saveRecipeToBook(payload).catch((err: unknown) => {
          // fire-and-forget, але повний silent не хочемо — збої збереження
          // рецепту у книгу з чату були невидимі для UX/саппорту.
          console.warn("[hubChat] saveRecipeToBook failed", err);
        });
        return `Рецепт "${t}" збережено в книгу рецептів.`;
      }
      case "add_to_shopping_list": {
        const { name, quantity, note, category } = (
          action as AddToShoppingListAction
        ).input;
        const itemName = (name || "").trim();
        if (!itemName) return "Потрібна назва продукту.";
        const catName = (category && String(category).trim()) || "Інше";
        const list = ls<{
          categories?: Array<{
            name: string;
            items: Array<{
              id: string;
              name: string;
              quantity?: string;
              note?: string;
              checked?: boolean;
            }>;
          }>;
        }>("nutrition_shopping_list_v1", {});
        const categories = Array.isArray(list.categories)
          ? list.categories.slice()
          : [];
        let catIdx = categories.findIndex((c) => c.name === catName);
        if (catIdx < 0) {
          categories.push({ name: catName, items: [] });
          catIdx = categories.length - 1;
        }
        const items = (categories[catIdx].items || []).slice();
        const lower = itemName.toLowerCase();
        const itemIdx = items.findIndex(
          (it) =>
            String(it.name || "")
              .trim()
              .toLowerCase() === lower,
        );
        const qty = (quantity && String(quantity).trim()) || "";
        const notTxt = (note && String(note).trim()) || "";
        let action_msg = "додано";
        if (itemIdx >= 0) {
          items[itemIdx] = {
            ...items[itemIdx],
            quantity: qty || items[itemIdx].quantity || "",
            note: notTxt || items[itemIdx].note || "",
          };
          action_msg = "оновлено";
        } else {
          items.push({
            id: `si_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: itemName,
            quantity: qty,
            note: notTxt,
            checked: false,
          });
        }
        categories[catIdx] = { ...categories[catIdx], items };
        lsSet("nutrition_shopping_list_v1", { ...list, categories });
        return `Продукт "${itemName}" ${action_msg} у список покупок${qty ? ` (${qty})` : ""} [${catName}]`;
      }
      case "consume_from_pantry": {
        const { name } = (action as ConsumeFromPantryAction).input;
        const rawName = (name || "").trim();
        if (!rawName) return "Потрібна назва продукту.";
        const activeId =
          ls<string | null>("nutrition_active_pantry_v1", null) || "home";
        const pantries = ls<
          Array<{
            id: string;
            name: string;
            items: Array<{ name: string }>;
          }>
        >("nutrition_pantries_v1", []);
        const idx = pantries.findIndex((p) => p.id === activeId);
        if (idx < 0) return `Активну комору (${activeId}) не знайдено.`;
        const pantry = pantries[idx];
        const lower = rawName.toLowerCase();
        const items = Array.isArray(pantry.items) ? pantry.items : [];
        const before = items.length;
        const nextItems = items.filter(
          (it) =>
            String(it.name || "")
              .trim()
              .toLowerCase() !== lower,
        );
        if (nextItems.length === before) {
          return `Продукт "${rawName}" у коморі не знайдено.`;
        }
        const next = [...pantries];
        next[idx] = { ...pantry, items: nextItems };
        lsSet("nutrition_pantries_v1", next);
        return `Продукт "${rawName}" прибрано з комори "${pantry.name}"`;
      }
      case "set_daily_plan": {
        const { kcal, protein_g, fat_g, carbs_g, water_ml } = (
          action as SetDailyPlanAction
        ).input;
        const prefs = ls<Record<string, unknown>>("nutrition_prefs_v1", {});
        const next = { ...prefs };
        const parts: string[] = [];
        const setField = (
          key: string,
          val: unknown,
          label: string,
          unit: string,
        ) => {
          const n = Number(val);
          if (val != null && val !== "" && Number.isFinite(n) && n > 0) {
            next[key] = n;
            parts.push(`${label} ${n} ${unit}`);
          }
        };
        setField("dailyTargetKcal", kcal, "ккал", "");
        setField("dailyTargetProtein_g", protein_g, "білок", "г");
        setField("dailyTargetFat_g", fat_g, "жири", "г");
        setField("dailyTargetCarbs_g", carbs_g, "вуглеводи", "г");
        setField("waterGoalMl", water_ml, "вода", "мл");
        if (parts.length === 0) return "Немає полів для оновлення плану.";
        lsSet("nutrition_prefs_v1", next);
        return `Щоденний план оновлено: ${parts.join(", ")}`;
      }
      case "log_weight": {
        const { weight_kg, note } = (action as LogWeightAction).input;
        const n = Number(weight_kg);
        if (!Number.isFinite(n) || n <= 0)
          return "Вага має бути додатним числом (кг).";
        const entry = {
          id: `dl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          at: new Date().toISOString(),
          weightKg: n,
          sleepHours: null,
          energyLevel: null,
          moodScore: null,
          note: note ? String(note).trim().slice(0, 500) : "",
        };
        const existing = ls<Array<Record<string, unknown>>>(
          "fizruk_daily_log_v1",
          [],
        );
        lsSet("fizruk_daily_log_v1", [entry, ...existing]);
        return `Вагу записано: ${n} кг`;
      }
      // ── Фізрук v2 ──────────────────────────────────────────────
      case "suggest_workout": {
        const { focus } = (action as SuggestWorkoutAction).input || {};
        const wRaw = localStorage.getItem("fizruk_workouts_v1");
        let workouts: Workout[] = [];
        try {
          const parsed = wRaw ? JSON.parse(wRaw) : null;
          if (Array.isArray(parsed)) workouts = parsed as Workout[];
          else if (parsed && Array.isArray(parsed.workouts))
            workouts = parsed.workouts as Workout[];
        } catch {}
        const completed = workouts.filter((w) => w.endedAt);
        if (completed.length === 0) {
          return `Немає історії тренувань. Рекомендую почати з full-body тренування: присідання, жим лежачи, тяга, підтягування.${focus ? ` (фокус: ${focus})` : ""}`;
        }
        const muscleLastTrained: Record<string, number> = {};
        for (const w of completed) {
          const ts = new Date(w.startedAt).getTime();
          for (const item of w.items) {
            for (const mg of [
              ...item.musclesPrimary,
              ...item.musclesSecondary,
            ]) {
              if (!muscleLastTrained[mg] || muscleLastTrained[mg] < ts) {
                muscleLastTrained[mg] = ts;
              }
            }
          }
        }
        const now = Date.now();
        const sorted = Object.entries(muscleLastTrained)
          .map(([m, ts]) => ({
            muscle: m,
            daysAgo: Math.round((now - ts) / 86400000),
          }))
          .sort((a, b) => b.daysAgo - a.daysAgo);
        const neglected = sorted.filter((s) => s.daysAgo >= 3).slice(0, 5);
        const lastW = completed.sort(
          (a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
        )[0];
        const lastExercises = lastW
          ? lastW.items.map((i) => i.nameUk).join(", ")
          : "";
        const parts: string[] = [];
        if (neglected.length > 0) {
          parts.push(
            `М'язи, які найдовше не тренували: ${neglected.map((n) => `${n.muscle} (${n.daysAgo}д)`).join(", ")}`,
          );
        }
        if (lastExercises) {
          parts.push(`Останнє тренування: ${lastExercises}`);
        }
        parts.push(`Всього завершених: ${completed.length}`);
        if (focus) parts.push(`Бажаний фокус: ${focus}`);
        return (
          parts.join(". ") + ". Рекомендацію сформовано на основі цих даних."
        );
      }
      case "copy_workout": {
        const { source_workout_id, date } =
          (action as CopyWorkoutAction).input || {};
        const wRaw = localStorage.getItem("fizruk_workouts_v1");
        let workouts: Workout[] = [];
        try {
          const parsed = wRaw ? JSON.parse(wRaw) : null;
          if (Array.isArray(parsed)) workouts = parsed as Workout[];
          else if (parsed && Array.isArray(parsed.workouts))
            workouts = parsed.workouts as Workout[];
        } catch {}
        let source: Workout | undefined;
        if (source_workout_id) {
          source = workouts.find((w) => w.id === source_workout_id);
          if (!source) return `Тренування ${source_workout_id} не знайдено.`;
        } else {
          source = workouts
            .filter((w) => w.endedAt)
            .sort(
              (a, b) =>
                new Date(b.startedAt).getTime() -
                new Date(a.startedAt).getTime(),
            )[0];
          if (!source) return "Немає завершених тренувань для копіювання.";
        }
        const now = new Date();
        const today = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
        ].join("-");
        const targetDate =
          date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today;
        const wid = `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        const copiedItems: WorkoutItem[] = source.items.map((item, i) => ({
          ...item,
          id: `i_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          sets: item.sets.map((s) => ({ ...s })),
        }));
        const newW: Workout = {
          id: wid,
          startedAt: new Date(
            `${targetDate}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:00`,
          ).toISOString(),
          endedAt: null,
          items: copiedItems,
          groups: [],
          warmup: null,
          cooldown: null,
          note: source.note ? `Копія: ${source.note}` : "",
          planned: true,
        };
        lsSet("fizruk_workouts_v1", {
          schemaVersion: 1,
          workouts: [newW, ...workouts],
        });
        return `Тренування скопійовано (${source.items.length} вправ) на ${targetDate} (id:${wid})`;
      }
      case "compare_progress": {
        const { exercise_name, muscle_group, period_days } =
          (action as CompareProgressAction).input || {};
        const days = Number(period_days) || 30;
        const wRaw = localStorage.getItem("fizruk_workouts_v1");
        let workouts: Workout[] = [];
        try {
          const parsed = wRaw ? JSON.parse(wRaw) : null;
          if (Array.isArray(parsed)) workouts = parsed as Workout[];
          else if (parsed && Array.isArray(parsed.workouts))
            workouts = parsed.workouts as Workout[];
        } catch {}
        const completed = workouts.filter((w) => w.endedAt);
        if (completed.length === 0)
          return "Немає завершених тренувань для аналізу.";
        const now = Date.now();
        const cutoff = now - days * 86400000;
        const midpoint = now - (days / 2) * 86400000;
        const firstHalf = completed.filter((w) => {
          const ts = new Date(w.startedAt).getTime();
          return ts >= cutoff && ts < midpoint;
        });
        const secondHalf = completed.filter((w) => {
          const ts = new Date(w.startedAt).getTime();
          return ts >= midpoint;
        });
        const matchItem = (item: WorkoutItem): boolean => {
          if (
            exercise_name &&
            item.nameUk.toLowerCase().includes(exercise_name.toLowerCase())
          )
            return true;
          if (
            muscle_group &&
            item.musclesPrimary.some((m) =>
              m.toLowerCase().includes(muscle_group.toLowerCase()),
            )
          )
            return true;
          if (!exercise_name && !muscle_group) return true;
          return false;
        };
        const calcVolume = (ws: Workout[]): number =>
          ws.reduce(
            (total, w) =>
              total +
              w.items
                .filter(matchItem)
                .reduce(
                  (s, item) =>
                    s +
                    item.sets.reduce(
                      (ss, set) => ss + set.weightKg * set.reps,
                      0,
                    ),
                  0,
                ),
            0,
          );
        const calcMaxWeight = (ws: Workout[]): number =>
          ws.reduce(
            (max, w) =>
              Math.max(
                max,
                ...w.items
                  .filter(matchItem)
                  .flatMap((item) => item.sets.map((s) => s.weightKg)),
              ),
            0,
          );
        const vol1 = calcVolume(firstHalf);
        const vol2 = calcVolume(secondHalf);
        const max1 = calcMaxWeight(firstHalf);
        const max2 = calcMaxWeight(secondHalf);
        const label = exercise_name || muscle_group || "загалом";
        const volChange =
          vol1 > 0 ? Math.round(((vol2 - vol1) / vol1) * 100) : 0;
        const parts: string[] = [
          `Прогрес (${label}) за ${days} днів:`,
          `Об'єм (кг×повт): ${Math.round(vol1)} → ${Math.round(vol2)} (${volChange >= 0 ? "+" : ""}${volChange}%)`,
          `Макс. вага: ${max1} → ${max2} кг`,
          `Тренувань: ${firstHalf.length} → ${secondHalf.length}`,
        ];
        return parts.join("\n");
      }
      // ── Фінік v2 ───────────────────────────────────────────────
      case "split_transaction": {
        const { tx_id, parts: splitParts } = (action as SplitTransactionAction)
          .input;
        const id = String(tx_id || "").trim();
        if (!id) return "Потрібен tx_id.";
        if (!Array.isArray(splitParts) || splitParts.length < 2)
          return "Потрібно мінімум 2 частини для розділення.";
        const splits = ls<
          Record<string, Array<{ categoryId: string; amount: number }>>
        >("finyk_tx_splits", {});
        const customC = ls<unknown[]>("finyk_custom_cats_v1", []);
        const newSplits = splitParts.map((p) => ({
          categoryId: String(p.category_id || "").trim(),
          amount: Math.abs(Number(p.amount) || 0),
        }));
        splits[id] = newSplits;
        lsSet("finyk_tx_splits", splits);
        const desc = newSplits
          .map((s) => {
            const cat = resolveExpenseCategoryMeta(s.categoryId, customC);
            return `${cat?.label || s.categoryId}: ${s.amount} грн`;
          })
          .join(", ");
        return `Транзакцію ${id} розділено на ${newSplits.length} частин: ${desc}`;
      }
      case "recurring_expense": {
        const { name, amount, day_of_month, category } = (
          action as RecurringExpenseAction
        ).input;
        const trimmed = (name || "").trim();
        if (!trimmed) return "Потрібна назва платежу.";
        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt <= 0) return "Сума має бути додатною.";
        const day = Number(day_of_month);
        const dayN = Number.isInteger(day) && day >= 1 && day <= 31 ? day : 1;
        const subs = ls<
          Array<{
            id: string;
            name: string;
            amount?: number;
            dayOfMonth?: number;
            category?: string;
          }>
        >("finyk_subs", []);
        const newSub = {
          id: `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          name: trimmed,
          amount: amt,
          dayOfMonth: dayN,
          category: category?.trim() || "",
        };
        subs.push(newSub);
        lsSet("finyk_subs", subs);
        return `Підписку "${trimmed}" створено: ${amt} грн, ${dayN}-го числа (id:${newSub.id})`;
      }
      case "export_report": {
        const { period, from, to } = (action as ExportReportAction).input || {};
        const now = new Date();
        let fromDate: Date;
        let toDate = now;
        if (period === "week") {
          fromDate = new Date(now);
          fromDate.setDate(fromDate.getDate() - 7);
        } else if (period === "custom" && from && to) {
          fromDate = new Date(`${from}T00:00:00`);
          toDate = new Date(`${to}T23:59:59`);
        } else {
          fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        const fromTs = fromDate.getTime();
        const toTs = toDate.getTime();
        const txCache = ls<{
          txs?: Array<{
            id: string;
            amount: number;
            description?: string;
            time?: number;
          }>;
        } | null>("finyk_tx_cache", null);
        const txs = (txCache?.txs || []).filter((t) => {
          const ts = (t.time || 0) * 1000;
          return ts >= fromTs && ts <= toTs;
        });
        const hiddenTxIds = ls<string[]>("finyk_hidden_txs", []);
        const filtered = txs.filter((t) => !hiddenTxIds.includes(t.id));
        const expenses = filtered.filter((t) => t.amount < 0);
        const income = filtered.filter((t) => t.amount > 0);
        const totalExpense = expenses.reduce(
          (s, t) => s + Math.abs(t.amount / 100),
          0,
        );
        const totalIncome = income.reduce((s, t) => s + t.amount / 100, 0);
        const fromStr = fromDate.toLocaleDateString("uk-UA");
        const toStr = toDate.toLocaleDateString("uk-UA");
        return [
          `Звіт за ${fromStr} — ${toStr}:`,
          `Дохід: ${Math.round(totalIncome)} грн`,
          `Витрати: ${Math.round(totalExpense)} грн`,
          `Баланс: ${Math.round(totalIncome - totalExpense)} грн`,
          `Транзакцій: ${filtered.length} (витрат: ${expenses.length}, доходів: ${income.length})`,
        ].join("\n");
      }
      // ── Рутина v2 ──────────────────────────────────────────────
      case "edit_habit": {
        const { habit_id, name, emoji, recurrence, weekdays } = (
          action as EditHabitAction
        ).input;
        const id = String(habit_id || "").trim();
        if (!id) return "Потрібен habit_id.";
        const state = ls<{
          habits?: Array<{
            id: string;
            name?: string;
            emoji?: string;
            recurrence?: string;
            weekdays?: number[];
          }>;
          completions?: Record<string, string[]>;
        }>("hub_routine_v1", {});
        const habits = Array.isArray(state.habits) ? state.habits.slice() : [];
        const hIdx = habits.findIndex((h) => h.id === id);
        if (hIdx < 0) return `Звичку ${id} не знайдено.`;
        const updated = { ...habits[hIdx] };
        const changes: string[] = [];
        if (name && name.trim()) {
          updated.name = name.trim();
          changes.push(`назва → "${name.trim()}"`);
        }
        if (emoji) {
          updated.emoji = emoji;
          changes.push(`емодзі → ${emoji}`);
        }
        if (recurrence) {
          const allowedRec = new Set([
            "daily",
            "weekdays",
            "weekly",
            "monthly",
          ]);
          if (allowedRec.has(recurrence)) {
            updated.recurrence = recurrence;
            changes.push(`розклад → ${recurrence}`);
          }
        }
        if (Array.isArray(weekdays) && weekdays.length > 0) {
          updated.weekdays = weekdays.filter(
            (d) => Number.isInteger(d) && d >= 0 && d <= 6,
          );
          changes.push(`дні → [${updated.weekdays.join(",")}]`);
        }
        if (changes.length === 0) return "Немає змін для оновлення.";
        habits[hIdx] = updated;
        lsSet("hub_routine_v1", { ...state, habits });
        return `Звичку "${updated.name || id}" оновлено: ${changes.join(", ")}`;
      }
      case "reorder_habits": {
        const { habit_ids } = (action as ReorderHabitsAction).input;
        if (!Array.isArray(habit_ids) || habit_ids.length === 0)
          return "Потрібен масив habit_ids.";
        const state = ls<{
          habits?: Array<{ id: string; name?: string }>;
          completions?: Record<string, string[]>;
        }>("hub_routine_v1", {});
        const habits = Array.isArray(state.habits) ? state.habits.slice() : [];
        const habitMap = new Map(habits.map((h) => [h.id, h]));
        const reordered = habit_ids
          .map((id) => habitMap.get(id))
          .filter((h): h is (typeof habits)[0] => h != null);
        const remaining = habits.filter((h) => !habit_ids.includes(h.id));
        lsSet("hub_routine_v1", {
          ...state,
          habits: [...reordered, ...remaining],
        });
        return `Порядок звичок оновлено (${reordered.length} переміщено)`;
      }
      case "habit_stats": {
        const { habit_id, period_days } = (action as HabitStatsAction).input;
        const id = String(habit_id || "").trim();
        if (!id) return "Потрібен habit_id.";
        const days = Number(period_days) || 30;
        const state = ls<{
          habits?: Array<{ id: string; name?: string; emoji?: string }>;
          completions?: Record<string, string[]>;
        }>("hub_routine_v1", {});
        const habit = (state.habits || []).find((h) => h.id === id);
        if (!habit) return `Звичку ${id} не знайдено.`;
        const completions = state.completions || {};
        const habitCompletions = Array.isArray(completions[id])
          ? completions[id]
          : [];
        const now = new Date();
        let doneCount = 0;
        let streak = 0;
        let maxStreak = 0;
        let currentStreak = 0;
        const missedDates: string[] = [];
        for (let i = 0; i < days; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const dk = [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, "0"),
            String(d.getDate()).padStart(2, "0"),
          ].join("-");
          if (habitCompletions.includes(dk)) {
            doneCount++;
            currentStreak++;
            if (i === 0 || i === streak) streak = currentStreak;
            if (currentStreak > maxStreak) maxStreak = currentStreak;
          } else {
            currentStreak = 0;
            if (missedDates.length < 5) missedDates.push(dk);
          }
        }
        const pct = days > 0 ? Math.round((doneCount / days) * 100) : 0;
        const parts: string[] = [
          `Статистика "${habit.emoji || ""} ${habit.name || id}" за ${days} днів:`,
          `Виконано: ${doneCount}/${days} (${pct}%)`,
          `Поточна серія: ${streak} днів`,
          `Макс. серія: ${maxStreak} днів`,
        ];
        if (missedDates.length > 0) {
          parts.push(`Останні пропуски: ${missedDates.join(", ")}`);
        }
        return parts.join("\n");
      }
      // ── Харчування v2 ──────────────────────────────────────────
      case "suggest_meal": {
        const { focus, meal_type } = (action as SuggestMealAction).input || {};
        const nutritionLog = ls<Record<string, NutritionDay>>(
          "nutrition_log_v1",
          {},
        );
        const nutritionPrefs = ls<Record<string, number> | null>(
          "nutrition_prefs_v1",
          null,
        );
        const now = new Date();
        const todayKey = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
        ].join("-");
        const todayData = nutritionLog[todayKey];
        const meals = Array.isArray(todayData?.meals) ? todayData.meals : [];
        const eaten = {
          kcal: meals.reduce((s, m) => s + (m?.macros?.kcal ?? 0), 0),
          protein: meals.reduce((s, m) => s + (m?.macros?.protein_g ?? 0), 0),
          fat: meals.reduce((s, m) => s + (m?.macros?.fat_g ?? 0), 0),
          carbs: meals.reduce((s, m) => s + (m?.macros?.carbs_g ?? 0), 0),
        };
        const target = {
          kcal: nutritionPrefs?.dailyTargetKcal || 2000,
          protein: nutritionPrefs?.dailyTargetProtein_g || 120,
        };
        const remaining = {
          kcal: Math.max(0, target.kcal - eaten.kcal),
          protein: Math.max(0, target.protein - eaten.protein),
        };
        const parts: string[] = [
          `З'їдено сьогодні: ${Math.round(eaten.kcal)} ккал, ${Math.round(eaten.protein)}г білка`,
          `Залишилось: ${Math.round(remaining.kcal)} ккал, ${Math.round(remaining.protein)}г білка`,
        ];
        if (focus) parts.push(`Фокус: ${focus}`);
        if (meal_type) parts.push(`Тип прийому: ${meal_type}`);
        return (
          parts.join(". ") + ". Рекомендацію сформовано на основі цих даних."
        );
      }
      case "copy_meal_from_date": {
        const { source_date, meal_index } = (action as CopyMealFromDateAction)
          .input;
        if (!source_date || !/^\d{4}-\d{2}-\d{2}$/.test(source_date))
          return "Потрібна дата-джерело у форматі YYYY-MM-DD.";
        const nutritionLog = ls<Record<string, NutritionDay>>(
          "nutrition_log_v1",
          {},
        );
        const sourceDay = nutritionLog[source_date];
        if (
          !sourceDay ||
          !Array.isArray(sourceDay.meals) ||
          sourceDay.meals.length === 0
        )
          return `За ${source_date} немає записів їжі.`;
        const now = new Date();
        const todayKey = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
        ].join("-");
        const dayData: NutritionDay = {
          ...(nutritionLog[todayKey] || { meals: [] }),
        };
        const meals: NutritionMeal[] = Array.isArray(dayData.meals)
          ? dayData.meals.slice()
          : [];
        let copied: NutritionMeal[];
        if (meal_index != null && meal_index !== "") {
          const idx = Number(meal_index);
          if (idx < 0 || idx >= sourceDay.meals.length)
            return `Індекс ${idx} поза межами (є ${sourceDay.meals.length} записів).`;
          copied = [sourceDay.meals[idx]];
        } else {
          copied = sourceDay.meals;
        }
        for (const m of copied) {
          meals.push({
            ...m,
            id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            addedAt: new Date().toISOString(),
          });
        }
        nutritionLog[todayKey] = { ...dayData, meals };
        lsSet("nutrition_log_v1", nutritionLog);
        const totalKcal = copied.reduce(
          (s, m) => s + (m?.macros?.kcal ?? 0),
          0,
        );
        return `Скопійовано ${copied.length} прийом(ів) з ${source_date} (${Math.round(totalKcal)} ккал)`;
      }
      case "plan_meals_for_day": {
        const { target_kcal, meals_count, preferences } =
          (action as PlanMealsForDayAction).input || {};
        const nutritionPrefs = ls<Record<string, number> | null>(
          "nutrition_prefs_v1",
          null,
        );
        const targetKcal =
          Number(target_kcal) || nutritionPrefs?.dailyTargetKcal || 2000;
        const count = Number(meals_count) || 3;
        const parts: string[] = [
          `Планую ${count} прийомів на ${targetKcal} ккал/день`,
          `Приблизно ${Math.round(targetKcal / count)} ккал на прийом`,
        ];
        if (preferences) parts.push(`Побажання: ${preferences}`);
        if (nutritionPrefs?.dailyTargetProtein_g) {
          parts.push(
            `Ціль білка: ${nutritionPrefs.dailyTargetProtein_g}г/день`,
          );
        }
        return (
          parts.join(". ") + ". Рекомендацію сформовано на основі цих даних."
        );
      }
      // ── Кросмодульні ───────────────────────────────────────────
      case "morning_briefing": {
        const now = new Date();
        const todayKey = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, "0"),
          String(now.getDate()).padStart(2, "0"),
        ].join("-");
        const parts: string[] = [
          `Доброго ранку! Сьогодні ${now.toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" })}`,
        ];
        const routineState = ls<HabitState | null>("hub_routine_v1", null);
        if (routineState?.habits) {
          const activeHabits = routineState.habits.filter(
            (h) => !(h as Record<string, unknown>).archived,
          );
          const completions = routineState.completions || {};
          const done = activeHabits.filter(
            (h) =>
              Array.isArray(completions[h.id]) &&
              completions[h.id].includes(todayKey),
          );
          parts.push(`Звички: ${done.length}/${activeHabits.length} виконано`);
        }
        const wRaw = localStorage.getItem("fizruk_workouts_v1");
        let workouts: Workout[] = [];
        try {
          const parsed = wRaw ? JSON.parse(wRaw) : null;
          if (Array.isArray(parsed)) workouts = parsed as Workout[];
          else if (parsed && Array.isArray(parsed.workouts))
            workouts = parsed.workouts as Workout[];
        } catch {}
        const todayWorkouts = workouts.filter(
          (w) => w.startedAt.startsWith(todayKey) && w.planned && !w.endedAt,
        );
        if (todayWorkouts.length > 0) {
          parts.push(`Заплановано тренувань: ${todayWorkouts.length}`);
        }
        const nutritionLog = ls<Record<string, NutritionDay>>(
          "nutrition_log_v1",
          {},
        );
        const todayMeals = nutritionLog[todayKey]?.meals || [];
        const todayKcal = todayMeals.reduce(
          (s, m) => s + (m?.macros?.kcal ?? 0),
          0,
        );
        if (todayKcal > 0) {
          parts.push(`Калорії: ${Math.round(todayKcal)} ккал`);
        }
        return parts.join("\n");
      }
      case "weekly_summary": {
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const parts: string[] = ["Тижневий підсумок:"];
        const wRaw = localStorage.getItem("fizruk_workouts_v1");
        let workouts: Workout[] = [];
        try {
          const parsed = wRaw ? JSON.parse(wRaw) : null;
          if (Array.isArray(parsed)) workouts = parsed as Workout[];
          else if (parsed && Array.isArray(parsed.workouts))
            workouts = parsed.workouts as Workout[];
        } catch {}
        const weekWorkouts = workouts.filter(
          (w) =>
            w.endedAt && new Date(w.startedAt).getTime() > weekAgo.getTime(),
        );
        parts.push(`Тренувань: ${weekWorkouts.length}`);
        const totalVolume = weekWorkouts.reduce(
          (total, w) =>
            total +
            w.items.reduce(
              (s, item) =>
                s +
                item.sets.reduce((ss, set) => ss + set.weightKg * set.reps, 0),
              0,
            ),
          0,
        );
        if (totalVolume > 0)
          parts.push(`Об'єм: ${Math.round(totalVolume)} кг×повт`);
        const routineState = ls<HabitState | null>("hub_routine_v1", null);
        if (routineState?.habits) {
          const activeHabits = routineState.habits.filter(
            (h) => !(h as Record<string, unknown>).archived,
          );
          const completions = routineState.completions || {};
          let totalDone = 0;
          let totalPossible = 0;
          for (let i = 0; i < 7; i++) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dk = [
              d.getFullYear(),
              String(d.getMonth() + 1).padStart(2, "0"),
              String(d.getDate()).padStart(2, "0"),
            ].join("-");
            totalPossible += activeHabits.length;
            for (const h of activeHabits) {
              if (
                Array.isArray(completions[h.id]) &&
                completions[h.id].includes(dk)
              )
                totalDone++;
            }
          }
          const pct =
            totalPossible > 0
              ? Math.round((totalDone / totalPossible) * 100)
              : 0;
          parts.push(`Звички: ${pct}% (${totalDone}/${totalPossible})`);
        }
        const nutritionLog = ls<Record<string, NutritionDay>>(
          "nutrition_log_v1",
          {},
        );
        const weekKcal: number[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const dk = [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, "0"),
            String(d.getDate()).padStart(2, "0"),
          ].join("-");
          const dayMeals = nutritionLog[dk]?.meals || [];
          const k = dayMeals.reduce((s, m) => s + (m?.macros?.kcal ?? 0), 0);
          if (k > 0) weekKcal.push(k);
        }
        if (weekKcal.length > 0) {
          const avg = Math.round(
            weekKcal.reduce((a, b) => a + b, 0) / weekKcal.length,
          );
          parts.push(`Калорії: ~${avg} ккал/день (${weekKcal.length} днів)`);
        }
        const txCache = ls<{
          txs?: Array<{ amount: number; time?: number }>;
        } | null>("finyk_tx_cache", null);
        if (txCache?.txs) {
          const weekTs = weekAgo.getTime() / 1000;
          const weekTxs = txCache.txs.filter((t) => (t.time || 0) > weekTs);
          const spent = weekTxs
            .filter((t) => t.amount < 0)
            .reduce((s, t) => s + Math.abs(t.amount / 100), 0);
          parts.push(`Витрати: ${Math.round(spent)} грн`);
        }
        return parts.join("\n");
      }
      case "set_goal": {
        const {
          description,
          target_weight_kg,
          target_date,
          daily_kcal,
          workouts_per_week,
        } = (action as SetGoalAction).input;
        const desc = (description || "").trim();
        if (!desc) return "Потрібен опис цілі.";
        const goals = ls<
          Array<{
            id: string;
            description: string;
            targetWeightKg?: number;
            targetDate?: string;
            dailyKcal?: number;
            workoutsPerWeek?: number;
            createdAt: string;
          }>
        >("hub_goals_v1", []);
        const goal: (typeof goals)[0] = {
          id: `goal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          description: desc,
          createdAt: new Date().toISOString(),
        };
        const parts: string[] = [`Ціль "${desc}" створено`];
        if (target_weight_kg != null) {
          const tw = Number(target_weight_kg);
          if (Number.isFinite(tw) && tw > 0) {
            goal.targetWeightKg = tw;
            parts.push(`цільова вага: ${tw} кг`);
          }
        }
        if (target_date && /^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
          goal.targetDate = target_date;
          parts.push(`дедлайн: ${target_date}`);
        }
        if (daily_kcal != null) {
          const dk = Number(daily_kcal);
          if (Number.isFinite(dk) && dk > 0) {
            goal.dailyKcal = dk;
            parts.push(`калорії: ${dk} ккал/день`);
            const prefs = ls<Record<string, unknown>>("nutrition_prefs_v1", {});
            prefs.dailyTargetKcal = dk;
            lsSet("nutrition_prefs_v1", prefs);
          }
        }
        if (workouts_per_week != null) {
          const wpw = Number(workouts_per_week);
          if (Number.isFinite(wpw) && wpw > 0) {
            goal.workoutsPerWeek = wpw;
            parts.push(`тренувань/тиждень: ${wpw}`);
          }
        }
        goals.push(goal);
        lsSet("hub_goals_v1", goals);
        return parts.join(", ") + ` (id:${goal.id})`;
      }
      // ── Аналітика ──────────────────────────────────────────────
      case "spending_trend": {
        const { period_days } = (action as SpendingTrendAction).input || {};
        const days = Number(period_days) || 30;
        const now = Date.now();
        const currentStart = now - days * 86400000;
        const prevStart = currentStart - days * 86400000;
        const txCache = ls<{
          txs?: Array<{ amount: number; time?: number; description?: string }>;
        } | null>("finyk_tx_cache", null);
        const allTxs = txCache?.txs || [];
        const hiddenTxIds = ls<string[]>("finyk_hidden_txs", []);
        const txs = allTxs.filter(
          (t) => !hiddenTxIds.includes((t as { id?: string }).id || ""),
        );
        const currentPeriod = txs.filter((t) => {
          const ts = (t.time || 0) * 1000;
          return ts >= currentStart && ts <= now;
        });
        const prevPeriod = txs.filter((t) => {
          const ts = (t.time || 0) * 1000;
          return ts >= prevStart && ts < currentStart;
        });
        const sumExpenses = (arr: typeof txs) =>
          arr
            .filter((t) => t.amount < 0)
            .reduce((s, t) => s + Math.abs(t.amount / 100), 0);
        const sumIncome = (arr: typeof txs) =>
          arr
            .filter((t) => t.amount > 0)
            .reduce((s, t) => s + t.amount / 100, 0);
        const curExp = sumExpenses(currentPeriod);
        const prevExp = sumExpenses(prevPeriod);
        const curInc = sumIncome(currentPeriod);
        const change =
          prevExp > 0 ? Math.round(((curExp - prevExp) / prevExp) * 100) : 0;
        const avgPerDay = days > 0 ? Math.round(curExp / days) : 0;
        const parts: string[] = [
          `Тренд витрат за ${days} днів:`,
          `Витрати: ${Math.round(curExp)} грн (${avgPerDay} грн/день)`,
          `Дохід: ${Math.round(curInc)} грн`,
          `Попередній період: ${Math.round(prevExp)} грн`,
          `Зміна: ${change >= 0 ? "+" : ""}${change}%`,
          `Транзакцій: ${currentPeriod.length}`,
        ];
        return parts.join("\n");
      }
      case "weight_chart": {
        const { period_days } = (action as WeightChartAction).input || {};
        const days = Number(period_days) || 30;
        const log = ls<Array<{ at?: string; weightKg?: number | null }>>(
          "fizruk_daily_log_v1",
          [],
        );
        const cutoff = Date.now() - days * 86400000;
        const entries = log
          .filter(
            (e) =>
              e.weightKg != null && e.at && new Date(e.at).getTime() >= cutoff,
          )
          .sort(
            (a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime(),
          );
        if (entries.length === 0)
          return `Немає записів ваги за останні ${days} днів.`;
        const weights = entries.map((e) => e.weightKg as number);
        const min = Math.min(...weights);
        const max = Math.max(...weights);
        const first = weights[0];
        const last = weights[weights.length - 1];
        const diff = last - first;
        const parts: string[] = [
          `Вага за ${days} днів (${entries.length} записів):`,
          `Перша: ${first} кг → Остання: ${last} кг (${diff >= 0 ? "+" : ""}${diff.toFixed(1)} кг)`,
          `Мін: ${min} кг | Макс: ${max} кг`,
        ];
        const recent = entries.slice(-7);
        if (recent.length > 1) {
          parts.push("Останні записи:");
          for (const e of recent) {
            const d = new Date(e.at!).toLocaleDateString("uk-UA", {
              day: "numeric",
              month: "short",
            });
            parts.push(`  ${d}: ${e.weightKg} кг`);
          }
        }
        return parts.join("\n");
      }
      case "category_breakdown": {
        const { period_days } = (action as CategoryBreakdownAction).input || {};
        const days = Number(period_days) || 30;
        const cutoff = Date.now() - days * 86400000;
        const txCache = ls<{
          txs?: Array<{
            id?: string;
            amount: number;
            time?: number;
            categoryId?: string;
          }>;
        } | null>("finyk_tx_cache", null);
        const hiddenTxIds = ls<string[]>("finyk_hidden_txs", []);
        const customC = ls<unknown[]>("finyk_custom_cats_v1", []);
        const catMap = ls<Record<string, string>>("finyk_cat_overrides", {});
        const expenses = (txCache?.txs || []).filter((t) => {
          if (hiddenTxIds.includes(t.id || "")) return false;
          const ts = (t.time || 0) * 1000;
          return t.amount < 0 && ts >= cutoff;
        });
        const byCategory: Record<string, number> = {};
        for (const tx of expenses) {
          const catId = catMap[tx.id || ""] || tx.categoryId || "other";
          byCategory[catId] =
            (byCategory[catId] || 0) + Math.abs(tx.amount / 100);
        }
        const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
        const sorted = Object.entries(byCategory)
          .map(([id, amount]) => {
            const meta = resolveExpenseCategoryMeta(id, customC);
            return {
              label: meta?.label || id,
              amount,
              pct: total > 0 ? Math.round((amount / total) * 100) : 0,
            };
          })
          .sort((a, b) => b.amount - a.amount);
        const parts: string[] = [
          `Витрати по категоріях за ${days} днів (${Math.round(total)} грн):`,
        ];
        for (const c of sorted.slice(0, 15)) {
          parts.push(`  ${c.label}: ${Math.round(c.amount)} грн (${c.pct}%)`);
        }
        return parts.join("\n");
      }
      case "detect_anomalies": {
        const { period_days, threshold_multiplier } =
          (action as DetectAnomaliesAction).input || {};
        const days = Number(period_days) || 30;
        const threshold = Number(threshold_multiplier) || 3;
        const cutoff = Date.now() - days * 86400000;
        const txCache = ls<{
          txs?: Array<{
            id?: string;
            amount: number;
            time?: number;
            description?: string;
          }>;
        } | null>("finyk_tx_cache", null);
        const hiddenTxIds = ls<string[]>("finyk_hidden_txs", []);
        const expenses = (txCache?.txs || []).filter((t) => {
          if (hiddenTxIds.includes(t.id || "")) return false;
          const ts = (t.time || 0) * 1000;
          return t.amount < 0 && ts >= cutoff;
        });
        if (expenses.length < 3)
          return "Недостатньо транзакцій для аналізу аномалій.";
        const amounts = expenses.map((t) => Math.abs(t.amount / 100));
        const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const anomalies = expenses
          .filter((t) => Math.abs(t.amount / 100) > avg * threshold)
          .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
          .slice(0, 5);
        if (anomalies.length === 0) {
          return `За ${days} днів аномалій не виявлено (середня витрата: ${Math.round(avg)} грн, поріг: ${Math.round(avg * threshold)} грн).`;
        }
        const parts: string[] = [
          `Аномальні витрати за ${days} днів (середня: ${Math.round(avg)} грн, поріг ×${threshold}):`,
        ];
        for (const tx of anomalies) {
          const d = tx.time
            ? new Date(tx.time * 1000).toLocaleDateString("uk-UA")
            : "?";
          parts.push(
            `  ${d}: ${Math.round(Math.abs(tx.amount / 100))} грн — ${tx.description || "(без опису)"}`,
          );
        }
        return parts.join("\n");
      }
      case "habit_trend": {
        const { habit_id, period_days } =
          (action as HabitTrendAction).input || {};
        const days = Number(period_days) || 30;
        const state = ls<HabitState | null>("hub_routine_v1", null);
        if (!state?.habits || state.habits.length === 0) return "Немає звичок.";
        const habits = habit_id
          ? state.habits.filter((h) => h.id === habit_id)
          : state.habits.filter(
              (h) => !(h as Record<string, unknown>).archived,
            );
        if (habits.length === 0) return `Звичку ${habit_id} не знайдено.`;
        const completions = state.completions || {};
        const now = new Date();
        const weeks = Math.ceil(days / 7);
        const weeklyData: number[] = [];
        for (let w = 0; w < weeks; w++) {
          let done = 0;
          let possible = 0;
          for (let d = 0; d < 7; d++) {
            const dayOffset = w * 7 + d;
            if (dayOffset >= days) break;
            const dt = new Date(now);
            dt.setDate(dt.getDate() - dayOffset);
            const dk = [
              dt.getFullYear(),
              String(dt.getMonth() + 1).padStart(2, "0"),
              String(dt.getDate()).padStart(2, "0"),
            ].join("-");
            for (const h of habits) {
              possible++;
              if (
                Array.isArray(completions[h.id]) &&
                completions[h.id].includes(dk)
              )
                done++;
            }
          }
          weeklyData.push(
            possible > 0 ? Math.round((done / possible) * 100) : 0,
          );
        }
        const parts: string[] = [
          `Тренд звичок за ${days} днів (${habits.length} звичок):`,
        ];
        weeklyData.reverse();
        for (let i = 0; i < weeklyData.length; i++) {
          parts.push(`  Тиждень ${i + 1}: ${weeklyData[i]}%`);
        }
        const first = weeklyData[0];
        const last = weeklyData[weeklyData.length - 1];
        if (weeklyData.length >= 2) {
          const trend =
            last > first
              ? "покращується"
              : last < first
                ? "погіршується"
                : "стабільно";
          parts.push(`Тренд: ${trend} (${first}% → ${last}%)`);
        }
        return parts.join("\n");
      }
      // ── Утиліти ────────────────────────────────────────────────
      case "calculate_1rm": {
        const { weight_kg, reps, exercise_name } = (
          action as Calculate1rmAction
        ).input;
        const w = Number(weight_kg);
        const r = Number(reps);
        if (!Number.isFinite(w) || w <= 0)
          return "Вага має бути додатним числом.";
        if (!Number.isInteger(r) || r < 1)
          return "Повторення мають бути цілим числом >= 1.";
        if (r === 1) {
          return `1RM${exercise_name ? ` (${exercise_name})` : ""}: ${w} кг (1 повторення = вже максимум)`;
        }
        const epley = Math.round(w * (1 + r / 30) * 10) / 10;
        const brzycki = Math.round(((w * 36) / (37 - r)) * 10) / 10;
        const avg1rm = Math.round(((epley + brzycki) / 2) * 10) / 10;
        const percentages = [
          { pct: 100, reps: 1 },
          { pct: 95, reps: 2 },
          { pct: 90, reps: 4 },
          { pct: 85, reps: 6 },
          { pct: 80, reps: 8 },
          { pct: 75, reps: 10 },
          { pct: 70, reps: 12 },
          { pct: 65, reps: 15 },
        ];
        const parts: string[] = [
          `1RM${exercise_name ? ` (${exercise_name})` : ""}: ~${avg1rm} кг`,
          `Епллі: ${epley} кг | Бжицкі: ${brzycki} кг`,
          `Базується на: ${w} кг × ${r} повт`,
          "",
          "Таблиця відсотків:",
        ];
        for (const p of percentages) {
          parts.push(
            `  ${p.pct}% = ${Math.round((avg1rm * p.pct) / 100)} кг (~${p.reps} повт)`,
          );
        }
        return parts.join("\n");
      }
      case "convert_units": {
        const { value, from, to } = (action as ConvertUnitsAction).input;
        const v = Number(value);
        if (!Number.isFinite(v)) return "Значення має бути числом.";
        const f = (from || "").toLowerCase().trim();
        const t = (to || "").toLowerCase().trim();
        const conversions: Record<
          string,
          Record<string, (n: number) => number>
        > = {
          kg: { lb: (n) => n * 2.20462 },
          lb: { kg: (n) => n / 2.20462 },
          cm: { in: (n) => n / 2.54 },
          in: { cm: (n) => n * 2.54 },
          km: { mi: (n) => n * 0.621371 },
          mi: { km: (n) => n / 0.621371 },
          c: { f: (n) => (n * 9) / 5 + 32 },
          f: { c: (n) => ((n - 32) * 5) / 9 },
          kcal: { kj: (n) => n * 4.184 },
          kj: { kcal: (n) => n / 4.184 },
          m: { ft: (n) => n * 3.28084 },
          ft: { m: (n) => n / 3.28084 },
          g: { oz: (n) => n / 28.3495 },
          oz: { g: (n) => n * 28.3495 },
        };
        const fn = conversions[f]?.[t];
        if (!fn)
          return `Невідома конвертація: ${f} → ${t}. Підтримуються: kg↔lb, cm↔in, km↔mi, c↔f, kcal↔kj, m↔ft, g↔oz`;
        const result = Math.round(fn(v) * 100) / 100;
        return `${v} ${f} = ${result} ${t}`;
      }
      case "save_note": {
        const { text, tag } = (action as SaveNoteAction).input;
        const trimmed = (text || "").trim();
        if (!trimmed) return "Потрібен текст нотатки.";
        const notes = ls<
          Array<{ id: string; text: string; tag: string; createdAt: string }>
        >("hub_notes_v1", []);
        const note = {
          id: `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          text: trimmed.slice(0, 1000),
          tag: (tag || "other").trim().toLowerCase(),
          createdAt: new Date().toISOString(),
        };
        notes.unshift(note);
        lsSet("hub_notes_v1", notes);
        return `Нотатку збережено: "${trimmed.slice(0, 50)}${trimmed.length > 50 ? "\u2026" : ""}" [${note.tag}] (id:${note.id})`;
      }
      case "list_notes": {
        const { tag, limit } = (action as ListNotesAction).input || {};
        const max = Number(limit) || 10;
        const notes = ls<
          Array<{ id: string; text: string; tag: string; createdAt: string }>
        >("hub_notes_v1", []);
        if (notes.length === 0) return "Нотаток немає.";
        const filtered = tag
          ? notes.filter((n) => n.tag === tag.toLowerCase().trim())
          : notes;
        if (filtered.length === 0) return `Нотаток з тегом "${tag}" немає.`;
        const shown = filtered.slice(0, max);
        const parts: string[] = [`Нотатки (${filtered.length} всього):`];
        for (const n of shown) {
          const d = new Date(n.createdAt).toLocaleDateString("uk-UA");
          parts.push(
            `  [${n.tag}] ${n.text.slice(0, 80)}${n.text.length > 80 ? "\u2026" : ""} (${d})`,
          );
        }
        if (filtered.length > max) {
          parts.push(`  \u2026і ще ${filtered.length - max}`);
        }
        return parts.join("\n");
      }
      case "export_module_data": {
        const { module, format } = (action as ExportModuleDataAction).input;
        const mod = (module || "").toLowerCase().trim();
        const fmt = (format || "text").toLowerCase().trim();
        const exportData = (key: string, label: string) => {
          const raw = localStorage.getItem(key);
          if (!raw) return `${label}: немає даних.`;
          if (fmt === "json")
            return `${label} (JSON):\n${raw.slice(0, 3000)}${raw.length > 3000 ? "\n\u2026(обрізано)" : ""}`;
          try {
            const parsed = JSON.parse(raw);
            return `${label}: ${JSON.stringify(parsed, null, 2).slice(0, 3000)}${raw.length > 3000 ? "\n\u2026(обрізано)" : ""}`;
          } catch {
            return `${label}: ${raw.slice(0, 3000)}`;
          }
        };
        switch (mod) {
          case "finyk": {
            const parts: string[] = ["Експорт Фінік:"];
            parts.push(exportData("finyk_tx_cache", "Транзакції"));
            return parts.join("\n");
          }
          case "fizruk": {
            const parts: string[] = ["Експорт Фізрук:"];
            parts.push(exportData("fizruk_workouts_v1", "Тренування"));
            parts.push(exportData("fizruk_daily_log_v1", "Щоденний журнал"));
            return parts.join("\n");
          }
          case "routine": {
            const parts: string[] = ["Експорт Рутина:"];
            parts.push(exportData("hub_routine_v1", "Звички та виконання"));
            return parts.join("\n");
          }
          case "nutrition": {
            const parts: string[] = ["Експорт Харчування:"];
            parts.push(exportData("nutrition_log_v1", "Журнал їжі"));
            parts.push(exportData("nutrition_prefs_v1", "Налаштування"));
            return parts.join("\n");
          }
          default:
            return `Невідомий модуль: ${mod}. Доступні: finyk, fizruk, routine, nutrition.`;
        }
      }
      // ── Пам'ять / Профіль ──────────────────────────────────────
      case "remember": {
        const { fact, category } = (action as RememberAction).input;
        const trimmed = (fact || "").trim();
        if (!trimmed) return "Потрібен факт для запам'ятовування.";
        const PROFILE_KEY = "hub_user_profile_v1";
        const profile = ls<
          Array<{
            id: string;
            fact: string;
            category: string;
            createdAt: string;
          }>
        >(PROFILE_KEY, []);
        const duplicate = profile.find(
          (p) => p.fact.toLowerCase() === trimmed.toLowerCase(),
        );
        if (duplicate)
          return `Вже запам'ятовано: "${duplicate.fact}" [${duplicate.category}]`;
        const entry = {
          id: `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          fact: trimmed.slice(0, 500),
          category: (category || "other").trim().toLowerCase(),
          createdAt: new Date().toISOString(),
        };
        profile.push(entry);
        lsSet(PROFILE_KEY, profile);
        const categoryLabels: Record<string, string> = {
          allergy: "алергія",
          diet: "дієта",
          goal: "ціль",
          training: "тренування",
          health: "здоров'я",
          preference: "уподобання",
          other: "інше",
        };
        return `Запам'ятав: "${trimmed}" [${categoryLabels[entry.category] || entry.category}]`;
      }
      case "forget": {
        const { fact_id } = (action as ForgetAction).input;
        if (!fact_id) return "Потрібен ID або текст факту.";
        const PROFILE_KEY = "hub_user_profile_v1";
        const profile = ls<
          Array<{
            id: string;
            fact: string;
            category: string;
            createdAt: string;
          }>
        >(PROFILE_KEY, []);
        if (profile.length === 0)
          return "Профіль порожній — немає що забувати.";
        const byId = profile.findIndex((p) => p.id === fact_id);
        if (byId >= 0) {
          const removed = profile.splice(byId, 1)[0];
          lsSet(PROFILE_KEY, profile);
          return `Забув: "${removed.fact}"`;
        }
        const byText = profile.findIndex((p) =>
          p.fact.toLowerCase().includes(fact_id.toLowerCase()),
        );
        if (byText >= 0) {
          const removed = profile.splice(byText, 1)[0];
          lsSet(PROFILE_KEY, profile);
          return `Забув: "${removed.fact}"`;
        }
        return `Не знайшов факт "${fact_id}" у профілі.`;
      }
      case "my_profile": {
        const { category } = (action as MyProfileAction).input || {};
        const PROFILE_KEY = "hub_user_profile_v1";
        const profile = ls<
          Array<{
            id: string;
            fact: string;
            category: string;
            createdAt: string;
          }>
        >(PROFILE_KEY, []);
        if (profile.length === 0)
          return "Профіль порожній. Скажи мені щось про себе — і я запам'ятаю!";
        const filtered = category
          ? profile.filter((p) => p.category === category.toLowerCase().trim())
          : profile;
        if (filtered.length === 0)
          return `Немає записів у категорії "${category}".`;
        const categoryLabels: Record<string, string> = {
          allergy: "🚫 Алергії",
          diet: "🍎 Дієта",
          goal: "🎯 Цілі",
          training: "🏋️ Тренування",
          health: "💊 Здоров'я",
          preference: "⭐ Уподобання",
          other: "📝 Інше",
        };
        const grouped: Record<string, typeof filtered> = {};
        for (const entry of filtered) {
          const cat = entry.category || "other";
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(entry);
        }
        const parts: string[] = [`Профіль (${filtered.length} записів):`];
        for (const [cat, entries] of Object.entries(grouped)) {
          parts.push(`\n${categoryLabels[cat] || cat}:`);
          for (const e of entries) {
            parts.push(`  • ${e.fact} (id:${e.id})`);
          }
        }
        return parts.join("\n");
      }
      default:
        return `Невідома дія: ${action.name}`;
    }
  } catch (e) {
    return `Помилка виконання: ${e instanceof Error ? e.message : String(e)}`;
  }
}
