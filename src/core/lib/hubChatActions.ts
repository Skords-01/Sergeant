import { resolveExpenseCategoryMeta } from "../../modules/finyk/utils";
import {
  createHabit as routineCreateHabit,
  loadRoutineState,
} from "../../modules/routine/lib/routineStorage";
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
      default:
        return `Невідома дія: ${action.name}`;
    }
  } catch (e) {
    return `Помилка виконання: ${e instanceof Error ? e.message : String(e)}`;
  }
}
