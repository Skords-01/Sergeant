import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { coachApi, weeklyDigestApi } from "@shared/api";
import { STORAGE_KEYS, getWeekKey as sharedGetWeekKey } from "@sergeant/shared";
import { loadDigest as sharedLoadDigest } from "@shared/lib/weeklyDigestStorage";
import { coachKeys, digestKeys } from "@shared/lib/queryKeys.js";
import { formatApiError } from "@shared/lib/apiErrorFormat";
import {
  aggregateFinyk,
  aggregateFizruk,
  aggregateNutrition,
  aggregateRoutine,
} from "./lib/weeklyDigestAggregates";

// Re-export aggregates so existing import paths (buildSlides.ts, etc.) keep working.
export {
  aggregateFinyk,
  aggregateFizruk,
  aggregateNutrition,
  aggregateRoutine,
} from "./lib/weeklyDigestAggregates";
export type {
  FinykAggregate,
  FizrukAggregate,
  NutritionAggregate,
  HabitStat,
  RoutineAggregate,
} from "./lib/weeklyDigestAggregates";

const DIGEST_PREFIX = STORAGE_KEYS.WEEKLY_DIGEST_PREFIX;

// `getWeekKey` lives in `@sergeant/shared` now (DOM-free, reused by
// mobile); re-exported here so existing call-sites keep their import path.
export const getWeekKey = sharedGetWeekKey;

function getWeekRange(d = new Date()): string {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  return `${fmt(monday)} — ${fmt(sunday)}`;
}

export interface WeeklyDigest {
  generatedAt: string;
  weekKey: string;
  weekRange: string;
  [key: string]: unknown;
}

export function loadDigest(weekKey: string): WeeklyDigest | null {
  return sharedLoadDigest(weekKey) as WeeklyDigest | null;
}

interface DigestHistoryEntry {
  weekKey: string;
  weekRange: string;
}

function listDigestHistory(): DigestHistoryEntry[] {
  const results: DigestHistoryEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DIGEST_PREFIX)) {
        const wk = key.slice(DIGEST_PREFIX.length);
        if (/^\d{4}-\d{2}-\d{2}$/.test(wk)) {
          results.push({
            weekKey: wk,
            weekRange: getWeekRange(new Date(wk + "T12:00:00")),
          });
        }
      }
    }
  } catch {
    /* non-fatal */
  }
  return results.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
}

function saveDigest(weekKey: string, data: unknown): void {
  try {
    localStorage.setItem(`${DIGEST_PREFIX}${weekKey}`, JSON.stringify(data));
  } catch {
    /* non-fatal */
  }
}

async function generateWeeklyDigest(weekKey: string): Promise<{
  report: unknown;
  generatedAt: string;
  weekKey: string;
  weekRange: string;
}> {
  const currentWeekRange = getWeekRange(new Date(weekKey + "T12:00:00"));
  const finyk = aggregateFinyk(weekKey);
  const fizruk = aggregateFizruk(weekKey);
  const nutrition = aggregateNutrition(weekKey);
  const routine = aggregateRoutine(weekKey);

  // Не огортаємо `ApiError` у plain `Error` — це ламало retry-логіку
  // React Query (`isRetriableError` читає `.status`) і приховувало `kind`
  // від UI-селекторів. Консьюмери тепер читають `.serverMessage` через
  // `isApiError(query.error)`.
  const json = (await weeklyDigestApi.generate({
    weekRange: currentWeekRange,
    finyk,
    fizruk,
    nutrition,
    routine,
  })) as { report: unknown; generatedAt: string };

  return {
    report: json.report,
    generatedAt: json.generatedAt,
    weekKey,
    weekRange: currentWeekRange,
  };
}

const weeklyDigestQueryKey = (weekKey: string) => digestKeys.byWeek(weekKey);
const weeklyDigestHistoryQueryKey = digestKeys.history;

export function useDigestHistory() {
  return useQuery({
    queryKey: weeklyDigestHistoryQueryKey,
    queryFn: listDigestHistory,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useWeeklyDigest(selectedWeekKey?: string) {
  const queryClient = useQueryClient();
  const currentWeekKey = getWeekKey();
  const weekKey = selectedWeekKey || currentWeekKey;
  const weekRange = getWeekRange(new Date(weekKey + "T12:00:00"));
  const isCurrentWeek = weekKey === currentWeekKey;

  const query = useQuery({
    queryKey: weeklyDigestQueryKey(weekKey),
    queryFn: () => loadDigest(weekKey) ?? null,
    staleTime: Infinity,
    gcTime: Infinity,
    initialData: () => loadDigest(weekKey) ?? undefined,
    initialDataUpdatedAt: () => {
      const existing = loadDigest(weekKey);
      return existing ? Date.now() : undefined;
    },
  });

  const mutation = useMutation({
    mutationFn: generateWeeklyDigest,
    onSuccess: ({ report, generatedAt, weekKey: wk, weekRange: wr }) => {
      const newDigest = {
        ...(report as object),
        generatedAt,
        weekKey: wk,
        weekRange: wr,
      };
      saveDigest(wk, newDigest);
      queryClient.setQueryData(weeklyDigestQueryKey(wk), newDigest);
      queryClient.invalidateQueries({ queryKey: weeklyDigestHistoryQueryKey });
      queryClient.invalidateQueries({ queryKey: coachKeys.all });

      try {
        coachApi
          .postMemory({
            weeklyDigest: {
              weekKey: wk,
              weekRange: wr,
              generatedAt,
              ...(report as object),
            },
          })
          .catch((err: unknown) => {
            console.warn("[weeklyDigest] coachApi.postMemory failed", err);
          });
      } catch {
        /* non-fatal */
      }
    },
  });

  const { mutateAsync } = mutation;

  const generate = useCallback(async () => {
    if (!isCurrentWeek) return null;
    try {
      const result = await mutateAsync(weekKey);
      return {
        ...(result.report as object),
        generatedAt: result.generatedAt,
        weekKey: result.weekKey,
        weekRange: result.weekRange,
      };
    } catch {
      return null;
    }
  }, [weekKey, isCurrentWeek, mutateAsync]);

  return {
    digest: query.data ?? null,
    loading: mutation.isPending,
    error: mutation.error
      ? formatApiError(mutation.error, { fallback: "Помилка генерації звіту" })
      : null,
    weekKey,
    weekRange,
    generate,
    isCurrentWeek,
  };
}
