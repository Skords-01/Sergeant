import { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiUrl } from "@shared/lib/apiUrl.js";

const CACHE_KEY = "hub_coach_insight_cache_v1";

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function safeParseLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function aggregateCurrentSnapshot() {
  const txRaw = safeParseLS("finyk_tx_cache", null);
  const txList = txRaw?.txs ?? txRaw ?? [];
  const txCategories = safeParseLS("finyk_tx_cats", {});
  const hiddenIds = new Set(safeParseLS("finyk_hidden_txs", []));
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
  const catAmounts = {};

  if (Array.isArray(txList)) {
    for (const tx of txList) {
      const ts = tx.time > 1e10 ? tx.time : tx.time * 1000;
      const d = new Date(ts);
      if (d < weekStart) continue;
      if (hiddenIds.has(tx.id)) continue;
      if (transferIds.has(tx.id)) continue;
      const amount = (tx.amount ?? 0) / 100;
      txCount++;
      if (amount < 0) {
        totalSpent += Math.abs(amount);
        const cat = txCategories[tx.id] || tx.mcc || "other";
        catAmounts[String(cat)] =
          (catAmounts[String(cat)] ?? 0) + Math.abs(amount);
      } else {
        totalIncome += amount;
      }
    }
  }

  const topCategories = Object.entries(catAmounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount: Math.round(amount) }));

  const finyk = {
    totalSpent: Math.round(totalSpent),
    totalIncome: Math.round(totalIncome),
    txCount,
    topCategories,
  };

  let fizruk = null;
  try {
    const raw = localStorage.getItem("fizruk_workouts_v1");
    if (raw) {
      const p = JSON.parse(raw);
      const allWorkouts = Array.isArray(p) ? p : (p?.workouts ?? []);
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
        (a, b) => new Date(b.startedAt) - new Date(a.startedAt),
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
  } catch {}

  let nutrition = null;
  try {
    const log = safeParseLS("nutrition_log_v1", {});
    const prefs = safeParseLS("nutrition_prefs_v1", null);
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
  } catch {}

  let routine = null;
  try {
    const state = safeParseLS("hub_routine_v1", null);
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
  } catch {}

  return { finyk, fizruk, nutrition, routine };
}

async function fetchCoachInsight() {
  let memory = null;
  try {
    const memRes = await fetch(apiUrl("/api/coach/memory"), {
      method: "GET",
      credentials: "include",
    });
    if (memRes.ok) {
      const memJson = await memRes.json();
      memory = memJson.memory;
    }
  } catch {}

  const snapshot = aggregateCurrentSnapshot();

  const insightRes = await fetch(apiUrl("/api/coach/insight"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ snapshot, memory }),
  });

  if (!insightRes.ok) {
    const err = await insightRes.json().catch(() => ({}));
    const error = new Error(err?.error || "Помилка генерації інсайту");
    error.status = insightRes.status;
    throw error;
  }

  const insightJson = await insightRes.json();
  return insightJson.insight ?? null;
}

export function useCoachInsight() {
  const [insight, setInsight] = useState(null);

  const mutation = useMutation({
    mutationFn: fetchCoachInsight,
    onSuccess: (text) => {
      if (!text) return;
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ date: localDateKey(), text }),
        );
      } catch {}
      setInsight(text);
    },
  });

  const loadInsight = useCallback(
    async (force = false) => {
      const todayKey = localDateKey();
      if (!force) {
        const cached = safeParseLS(CACHE_KEY, null);
        if (cached?.date === todayKey && cached?.text) {
          setInsight(cached.text);
          return cached.text;
        }
      }
      try {
        return await mutation.mutateAsync();
      } catch {
        return null;
      }
    },
    [mutation],
  );

  useEffect(() => {
    const todayKey = localDateKey();
    const cached = safeParseLS(CACHE_KEY, null);
    if (cached?.date === todayKey && cached?.text) {
      setInsight(cached.text);
      return;
    }
    loadInsight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(() => loadInsight(true), [loadInsight]);

  return {
    insight,
    loading: mutation.isPending,
    error: mutation.error
      ? mutation.error.message || "Помилка завантаження"
      : null,
    refresh,
  };
}
