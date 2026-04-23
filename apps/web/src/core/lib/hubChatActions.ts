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
      default:
        return `Невідома дія: ${action.name}`;
    }
  } catch (e) {
    return `Помилка виконання: ${e instanceof Error ? e.message : String(e)}`;
  }
}
