import { useState, useCallback, useEffect } from "react";
import { apiUrl } from "@shared/lib/apiUrl.js";
import { STORAGE_KEYS } from "@shared/lib/storageKeys.js";
import { safeReadLS } from "@shared/lib/storage.js";
import { MCC_CATEGORIES, INCOME_CATEGORIES } from "@finyk/constants.js";

const DIGEST_PREFIX = STORAGE_KEYS.WEEKLY_DIGEST_PREFIX;

const ALL_CATS = [...MCC_CATEGORIES, ...INCOME_CATEGORIES];

function resolveCatLabel(catIdOrMcc, customCategories = []) {
  if (!catIdOrMcc || catIdOrMcc === "other") return "Інше";
  // Спочатку шукаємо по id (рядок)
  const byId = [...ALL_CATS, ...customCategories].find(
    (c) => c.id === catIdOrMcc,
  );
  if (byId) return byId.label ?? byId.name ?? catIdOrMcc;
  // Потім по MCC-коду (число або рядок)
  const mcc = Number(catIdOrMcc);
  if (!Number.isNaN(mcc) && mcc > 0) {
    const byMcc = MCC_CATEGORIES.find(
      (c) => Array.isArray(c.mccs) && c.mccs.includes(mcc),
    );
    if (byMcc) return byMcc.label;
    return `MCC ${mcc}`;
  }
  // Якщо нічого не знайдено — повертаємо оригінальний рядок (щоб AI розумів хоч щось)
  return String(catIdOrMcc);
}

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getWeekKey(d = new Date()) {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDateKey(monday);
}

export function getWeekRange(d = new Date()) {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (dt) =>
    dt.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  return `${fmt(monday)} — ${fmt(sunday)}`;
}

export function loadDigest(weekKey) {
  return safeReadLS(`${DIGEST_PREFIX}${weekKey}`, null);
}

export function listDigestHistory() {
  const results = [];
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
  } catch {}
  return results.sort((a, b) => b.weekKey.localeCompare(a.weekKey));
}

function saveDigest(weekKey, data) {
  try {
    localStorage.setItem(`${DIGEST_PREFIX}${weekKey}`, JSON.stringify(data));
    window.dispatchEvent(
      new CustomEvent("hub-weekly-digest-updated", { detail: { weekKey } }),
    );
  } catch {}
}

function aggregateFinyk(weekKey) {
  const txRaw = safeReadLS("finyk_tx_cache", null);
  const txList = txRaw?.txs ?? txRaw ?? [];
  const txCategories = safeReadLS("finyk_tx_cats", {});
  const hiddenIds = new Set(safeReadLS("finyk_hidden_txs", []));
  const customCategories = safeReadLS("finyk_custom_cats_v1", []);
  const transferIds = new Set(
    Object.entries(txCategories)
      .filter(([, v]) => v === "internal_transfer")
      .map(([k]) => k),
  );

  const monday = new Date(`${weekKey}T00:00:00`);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  let totalSpent = 0;
  let totalIncome = 0;
  let txCount = 0;
  const catAmounts = {};

  if (Array.isArray(txList)) {
    for (const tx of txList) {
      const ts = tx.time > 1e10 ? tx.time : tx.time * 1000;
      const d = new Date(ts);
      if (d < monday || d >= sunday) continue;
      if (hiddenIds.has(tx.id)) continue;
      if (transferIds.has(tx.id)) continue;
      const amount = (tx.amount ?? 0) / 100;
      txCount++;
      if (amount < 0) {
        totalSpent += Math.abs(amount);
        const rawCat = txCategories[tx.id] || tx.mcc || "other";
        const cat = resolveCatLabel(rawCat, customCategories);
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

  const finykStorage = safeReadLS("finyk_storage_v2", {});
  const monthlyBudget = finykStorage?.monthlyPlan?.expense ?? null;

  return {
    totalSpent: Math.round(totalSpent),
    totalIncome: Math.round(totalIncome),
    txCount,
    topCategories,
    monthlyBudget,
  };
}

function aggregateFizruk(weekKey) {
  const raw = localStorage.getItem("fizruk_workouts_v1");
  if (!raw) return null;

  let workouts = [];
  try {
    const p = JSON.parse(raw);
    workouts = Array.isArray(p) ? p : (p?.workouts ?? []);
  } catch {
    return null;
  }

  const monday = new Date(`${weekKey}T00:00:00`);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  const weekWorkouts = workouts.filter((w) => {
    if (!w.endedAt) return false;
    const d = new Date(w.startedAt);
    return d >= monday && d < sunday;
  });

  let totalVolume = 0;
  const exerciseVolumes = {};

  for (const w of weekWorkouts) {
    if (Array.isArray(w.exercises)) {
      for (const ex of w.exercises) {
        const vol = Array.isArray(ex.sets)
          ? ex.sets.reduce(
              (s, set) => s + (set.weight ?? 0) * (set.reps ?? 0),
              0,
            )
          : 0;
        totalVolume += vol;
        if (ex.name) {
          exerciseVolumes[ex.name] = (exerciseVolumes[ex.name] ?? 0) + vol;
        }
      }
    }
  }

  const topExercises = Object.entries(exerciseVolumes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([name, totalVolume]) => ({
      name,
      totalVolume: Math.round(totalVolume),
    }));

  const allCompleted = workouts.filter((w) => w.endedAt);
  const sorted = [...allCompleted].sort(
    (a, b) => new Date(b.startedAt) - new Date(a.startedAt),
  );
  const last = sorted[0];
  let recoveryLabel = "Немає даних";
  if (last) {
    const hoursAgo =
      (Date.now() - new Date(last.startedAt).getTime()) / 3_600_000;
    if (hoursAgo < 20) recoveryLabel = "Відновлення";
    else if (hoursAgo < 44) recoveryLabel = "Часткове відновлення";
    else recoveryLabel = "Готовий до тренування";
  }

  return {
    workoutsCount: weekWorkouts.length,
    totalVolume: Math.round(totalVolume),
    recoveryLabel,
    topExercises,
  };
}

function aggregateNutrition(weekKey) {
  const log = safeReadLS("nutrition_log_v1", {});
  const prefs = safeReadLS("nutrition_prefs_v1", null);
  const targetKcal = prefs?.dailyTargetKcal ?? 2000;

  const monday = new Date(`${weekKey}T00:00:00`);
  let totalKcal = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCarbs = 0;
  let daysLogged = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dk = localDateKey(d);
    const dayData = log?.[dk];
    const meals = Array.isArray(dayData?.meals) ? dayData.meals : [];
    if (meals.length > 0) {
      daysLogged++;
      for (const m of meals) {
        totalKcal += m?.macros?.kcal ?? 0;
        totalProtein += m?.macros?.protein_g ?? 0;
        totalFat += m?.macros?.fat_g ?? 0;
        totalCarbs += m?.macros?.carbs_g ?? 0;
      }
    }
  }

  if (daysLogged === 0) return null;

  return {
    avgKcal: Math.round(totalKcal / daysLogged),
    avgProtein: Math.round(totalProtein / daysLogged),
    avgFat: Math.round(totalFat / daysLogged),
    avgCarbs: Math.round(totalCarbs / daysLogged),
    targetKcal,
    daysLogged,
  };
}

function aggregateRoutine(weekKey) {
  const state = safeReadLS("hub_routine_v1", null);
  if (!state) return null;

  const habits = Array.isArray(state.habits)
    ? state.habits.filter((h) => !h.archived)
    : [];
  if (!habits.length) return null;

  const completions = state.completions ?? {};
  const monday = new Date(`${weekKey}T00:00:00`);

  const habitStats = habits.map((h) => {
    let done = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dk = localDateKey(d);
      if (Array.isArray(completions[h.id]) && completions[h.id].includes(dk)) {
        done++;
      }
    }
    return {
      name: h.name || h.title || "Звичка",
      done,
      total: 7,
      completionRate: Math.round((done / 7) * 100),
    };
  });

  const totalDone = habitStats.reduce((s, h) => s + h.done, 0);
  const totalPossible = habits.length * 7;
  const overallRate =
    totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

  return {
    habitCount: habits.length,
    overallRate,
    habits: habitStats,
  };
}

export function useWeeklyDigest(selectedWeekKey) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const currentWeekKey = getWeekKey();
  const weekKey = selectedWeekKey || currentWeekKey;
  const weekRange = getWeekRange(new Date(weekKey + "T12:00:00"));
  const isCurrentWeek = weekKey === currentWeekKey;

  const [digest, setDigest] = useState(() => loadDigest(weekKey));

  useEffect(() => {
    setDigest(loadDigest(weekKey));
  }, [weekKey]);

  useEffect(() => {
    const handler = (e) => {
      if (!e.detail?.weekKey || e.detail.weekKey === weekKey) {
        setDigest(loadDigest(weekKey));
      }
    };
    window.addEventListener("hub-weekly-digest-updated", handler);
    return () =>
      window.removeEventListener("hub-weekly-digest-updated", handler);
  }, [weekKey]);

  const generate = useCallback(async () => {
    if (!isCurrentWeek) return null;
    setLoading(true);
    setError(null);
    try {
      const currentWeekRange = getWeekRange(new Date(weekKey + "T12:00:00"));
      const finyk = aggregateFinyk(weekKey);
      const fizruk = aggregateFizruk(weekKey);
      const nutrition = aggregateNutrition(weekKey);
      const routine = aggregateRoutine(weekKey);

      const res = await fetch(apiUrl("/api/weekly-digest"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekRange: currentWeekRange,
          finyk,
          fizruk,
          nutrition,
          routine,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Помилка генерації звіту");
        return null;
      }

      const newDigest = {
        ...json.report,
        generatedAt: json.generatedAt,
        weekKey,
        weekRange: currentWeekRange,
      };
      saveDigest(weekKey, newDigest);
      setDigest(newDigest);

      try {
        fetch(apiUrl("/api/coach/memory"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weeklyDigest: {
              weekKey,
              weekRange: currentWeekRange,
              generatedAt: json.generatedAt,
              ...(json.report || {}),
            },
          }),
        }).catch(() => {});
      } catch {}

      return newDigest;
    } catch (e) {
      setError(e?.message || "Помилка мережі");
      return null;
    } finally {
      setLoading(false);
    }
  }, [weekKey, isCurrentWeek]);

  return {
    digest,
    loading,
    error,
    weekKey,
    weekRange,
    generate,
    isCurrentWeek,
  };
}
