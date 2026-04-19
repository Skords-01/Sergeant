import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { coachApi, isApiError } from "@shared/api";
import { coachKeys } from "@shared/lib/queryKeys.js";

const CACHE_KEY = "hub_coach_insight_cache_v1";

function localDateKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function safeParseLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

interface CategoryAmount {
  name: string;
  amount: number;
}

interface FinykSnapshot {
  totalSpent: number;
  totalIncome: number;
  txCount: number;
  topCategories: CategoryAmount[];
}

interface FizrukSnapshot {
  workoutsCount: number;
  totalVolume: number;
  recoveryLabel: string;
}

interface NutritionSnapshot {
  avgKcal: number;
  avgProtein: number;
  targetKcal: number;
  daysLogged: number;
}

interface RoutineSnapshot {
  habitCount: number;
  overallRate: number;
}

interface CoachSnapshot {
  finyk: FinykSnapshot;
  fizruk: FizrukSnapshot | null;
  nutrition: NutritionSnapshot | null;
  routine: RoutineSnapshot | null;
}

function aggregateCurrentSnapshot(): CoachSnapshot {
  const txRaw = safeParseLS<{ txs?: unknown[]; length?: number } | null>(
    "finyk_tx_cache",
    null,
  );
  const txList: unknown[] = (txRaw as { txs?: unknown[] })?.txs
    ? ((txRaw as { txs: unknown[] }).txs ?? [])
    : Array.isArray(txRaw)
      ? (txRaw as unknown[])
      : [];
  const txCategories = safeParseLS<Record<string, string>>("finyk_tx_cats", {});
  const hiddenIds = new Set(safeParseLS<string[]>("finyk_hidden_txs", []));
  const transferIds = new Set(
    Object.entries(txCategories)
      .filter(([, v]) => v === "internal_transfer")
      .map(([k]) => k),
  );

  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  let totalSpent = 0;
  let totalIncome = 0;
  let txCount = 0;
  const catAmounts: Record<string, number> = {};

  if (Array.isArray(txList)) {
    for (const tx of txList as Array<{
      id: string;
      time: number;
      amount: number;
      mcc?: number;
    }>) {
      const ts = tx.time > 1e10 ? tx.time : tx.time * 1000;
      const d = new Date(ts);
      if (d < weekStart) continue;
      if (hiddenIds.has(tx.id)) continue;
      if (transferIds.has(tx.id)) continue;
      const amount = (tx.amount ?? 0) / 100;
      txCount++;
      if (amount < 0) {
        totalSpent += Math.abs(amount);
        const cat = txCategories[tx.id] || String(tx.mcc ?? "other");
        catAmounts[cat] = (catAmounts[cat] ?? 0) + Math.abs(amount);
      } else {
        totalIncome += amount;
      }
    }
  }

  const topCategories = Object.entries(catAmounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount: Math.round(amount) }));

  const finyk: FinykSnapshot = {
    totalSpent: Math.round(totalSpent),
    totalIncome: Math.round(totalIncome),
    txCount,
    topCategories,
  };

  let fizruk: FizrukSnapshot | null = null;
  try {
    const raw = localStorage.getItem("fizruk_workouts_v1");
    if (raw) {
      const p = JSON.parse(raw) as unknown;
      const allWorkouts: Array<{
        endedAt?: string;
        startedAt: string;
        exercises?: Array<{ sets?: Array<{ weight?: number; reps?: number }> }>;
      }> = Array.isArray(p)
        ? p
        : ((p as { workouts?: unknown[] })?.workouts ?? []);
      const weekWorkouts = allWorkouts.filter((w) => {
        if (!w.endedAt) return false;
        return new Date(w.startedAt) >= weekStart;
      });
      let totalVolume = 0;
      for (const w of weekWorkouts) {
        if (Array.isArray(w.exercises)) {
          for (const ex of w.exercises) {
            totalVolume += Array.isArray(ex.sets)
              ? ex.sets.reduce(
                  (s, set) => s + (set.weight ?? 0) * (set.reps ?? 0),
                  0,
                )
              : 0;
          }
        }
      }
      const completed = allWorkouts.filter((w) => w.endedAt);
      const last = [...completed].sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )[0];
      let recoveryLabel = "Немає даних";
      if (last) {
        const hoursAgo =
          (Date.now() - new Date(last.startedAt).getTime()) / 3_600_000;
        if (hoursAgo < 20) recoveryLabel = "Відновлення";
        else if (hoursAgo < 44) recoveryLabel = "Часткове відновлення";
        else recoveryLabel = "Готовий до тренування";
      }
      fizruk = {
        workoutsCount: weekWorkouts.length,
        totalVolume: Math.round(totalVolume),
        recoveryLabel,
      };
    }
  } catch {
    /* non-fatal */
  }

  let nutrition: NutritionSnapshot | null = null;
  try {
    const log = safeParseLS<
      Record<
        string,
        { meals?: Array<{ macros?: { kcal?: number; protein_g?: number } }> }
      >
    >("nutrition_log_v1", {});
    const prefs = safeParseLS<{ dailyTargetKcal?: number } | null>(
      "nutrition_prefs_v1",
      null,
    );
    let totalKcal = 0,
      totalProtein = 0,
      daysLogged = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const dk = localDateKey(d);
      const meals = Array.isArray(log?.[dk]?.meals) ? log[dk].meals : [];
      if (meals.length > 0) {
        daysLogged++;
        for (const m of meals) {
          totalKcal += m?.macros?.kcal ?? 0;
          totalProtein += m?.macros?.protein_g ?? 0;
        }
      }
    }
    if (daysLogged > 0) {
      nutrition = {
        avgKcal: Math.round(totalKcal / daysLogged),
        avgProtein: Math.round(totalProtein / daysLogged),
        targetKcal: prefs?.dailyTargetKcal ?? 2000,
        daysLogged,
      };
    }
  } catch {
    /* non-fatal */
  }

  let routine: RoutineSnapshot | null = null;
  try {
    const state = safeParseLS<{
      habits?: Array<{ id: string; archived?: boolean }>;
      completions?: Record<string, string[]>;
    } | null>("hub_routine_v1", null);
    if (state) {
      const habits = (state.habits || []).filter((h) => !h.archived);
      const completions = state.completions ?? {};
      if (habits.length > 0) {
        let totalDone = 0;
        for (let i = 0; i < 7; i++) {
          const d = new Date(weekStart);
          d.setDate(weekStart.getDate() + i);
          const dk = localDateKey(d);
          for (const h of habits) {
            if (
              Array.isArray(completions[h.id]) &&
              completions[h.id].includes(dk)
            )
              totalDone++;
          }
        }
        const overallRate = Math.round((totalDone / (habits.length * 7)) * 100);
        routine = { habitCount: habits.length, overallRate };
      }
    }
  } catch {
    /* non-fatal */
  }

  return { finyk, fizruk, nutrition, routine };
}

async function fetchCoachInsight(): Promise<string | null> {
  let memory: string | null = null;
  try {
    const memJson = await coachApi.getMemory();
    memory = (memJson as { memory?: string }).memory ?? null;
  } catch {
    // Пам'ять не обов'язкова — інсайт будуємо й без неї.
  }

  const snapshot = aggregateCurrentSnapshot();

  try {
    const insightJson = await coachApi.postInsight({ snapshot, memory });
    return (insightJson as { insight?: string }).insight ?? null;
  } catch (e) {
    if (isApiError(e) && e.kind === "http") {
      const error = Object.assign(
        new Error(e.serverMessage || "Помилка генерації інсайту"),
        { status: e.status },
      );
      throw error;
    }
    throw e;
  }
}

const coachInsightQueryKey = (todayKey = localDateKey()) =>
  coachKeys.insight(todayKey);

function loadInitialInsight(todayKey: string): string | undefined {
  const cached = safeParseLS<{ date?: string; text?: string } | null>(
    CACHE_KEY,
    null,
  );
  if (cached?.date === todayKey && typeof cached?.text === "string") {
    return cached.text;
  }
  return undefined;
}

interface UseCoachInsightResult {
  insight: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<unknown>;
}

export function useCoachInsight(): UseCoachInsightResult {
  const queryClient = useQueryClient();
  const todayKey = localDateKey();
  const queryKey = coachInsightQueryKey(todayKey);

  const query = useQuery({
    queryKey,
    queryFn: fetchCoachInsight,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60_000,
    initialData: () => loadInitialInsight(todayKey),
    initialDataUpdatedAt: () => {
      const cached = safeParseLS<{ date?: string } | null>(CACHE_KEY, null);
      if (cached?.date !== todayKey) return undefined;
      return Date.now();
    },
  });

  if (
    typeof query.data === "string" &&
    query.data.length > 0 &&
    !query.isFetching
  ) {
    try {
      const cached = safeParseLS<{ date?: string; text?: string } | null>(
        CACHE_KEY,
        null,
      );
      if (cached?.date !== todayKey || cached?.text !== query.data) {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ date: todayKey, text: query.data }),
        );
      }
    } catch {
      /* non-fatal */
    }
  }

  const { refetch } = query;

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: coachKeys.all });
    return refetch();
  }, [queryClient, refetch]);

  return {
    insight: query.data ?? null,
    loading: query.isPending || query.isFetching,
    error: query.error
      ? (query.error as Error).message || "Помилка завантаження"
      : null,
    refresh,
  };
}
