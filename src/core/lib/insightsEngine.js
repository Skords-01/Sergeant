/**
 * Cross-module insights engine.
 * Reads data from localStorage of all 4 modules and computes
 * correlations / patterns across weeks and months.
 */

function safeLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseFizrukWorkouts() {
  const raw = localStorage.getItem("fizruk_workouts_v1");
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p)) return p;
    if (p && Array.isArray(p.workouts)) return p.workouts;
  } catch {}
  return [];
}

const DOW_UK = [
  "Неділя",
  "Понеділок",
  "Вівторок",
  "Середа",
  "Четвер",
  "П'ятниця",
  "Субота",
];

const MONTHS_UK = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
];

/**
 * Insight 1: Best day-of-week for workouts.
 * Requires ≥ 20 completed workouts.
 */
function workoutDayInsight() {
  const workouts = parseFizrukWorkouts().filter((w) => w.endedAt);
  if (workouts.length < 20) return null;

  const dowCount = Array(7).fill(0);
  for (const w of workouts) {
    dowCount[new Date(w.startedAt).getDay()]++;
  }

  const maxCount = Math.max(...dowCount);
  if (maxCount < 3) return null;
  const maxIdx = dowCount.indexOf(maxCount);

  return {
    id: "best_workout_day",
    emoji: "📅",
    title: "Найпродуктивніший день для тренувань",
    stat: DOW_UK[maxIdx],
    detail: `${maxCount} з ${workouts.length} тренувань`,
  };
}

/**
 * Insight 2: Weekly spending in active weeks (≥3 workouts) vs rest weeks.
 * Requires ≥ 4 weeks with spending data AND ≥ 2 weeks in each group.
 */
function activeWeeksSpendingInsight() {
  const workouts = parseFizrukWorkouts().filter((w) => w.endedAt);
  const raw = safeLS("finyk_tx_cache", []);
  const txs = Array.isArray(raw) ? raw : raw?.txs ?? [];

  if (workouts.length < 6) return null;

  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;

  const weekStats = [];
  for (let i = 0; i < 16; i++) {
    const mon = new Date(now);
    mon.setDate(now.getDate() - mondayOffset - i * 7);
    mon.setHours(0, 0, 0, 0);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);

    const wCount = workouts.filter((w) => {
      const d = new Date(w.startedAt);
      return d >= mon && d <= sun;
    }).length;

    const spending = txs
      .filter((tx) => {
        const ts = tx.time > 1e10 ? tx.time : tx.time * 1000;
        const d = new Date(ts);
        return d >= mon && d <= sun && (tx.amount ?? 0) < 0;
      })
      .reduce((s, tx) => s + Math.abs(tx.amount / 100), 0);

    if (spending > 0) weekStats.push({ wCount, spending });
  }

  if (weekStats.length < 4) return null;

  const activeWeeks = weekStats.filter((w) => w.wCount >= 3);
  const restWeeks = weekStats.filter((w) => w.wCount < 3);

  if (activeWeeks.length < 2 || restWeeks.length < 2) return null;

  const avgActive =
    activeWeeks.reduce((s, w) => s + w.spending, 0) / activeWeeks.length;
  const avgRest =
    restWeeks.reduce((s, w) => s + w.spending, 0) / restWeeks.length;

  if (avgRest === 0) return null;

  const diffPct = Math.round(((avgRest - avgActive) / avgRest) * 100);
  if (Math.abs(diffPct) < 5) return null;

  if (diffPct > 0) {
    return {
      id: "active_weeks_spending",
      emoji: "💡",
      title: `У тижні з 3+ тренуваннями ти витрачаєш на ${diffPct}% менше`,
      stat: `−${diffPct}%`,
      detail: `${Math.round(avgActive).toLocaleString("uk-UA")} ₴ vs ${Math.round(avgRest).toLocaleString("uk-UA")} ₴ витрат/тиж.`,
    };
  }

  const morePct = Math.abs(diffPct);
  return {
    id: "active_weeks_spending",
    emoji: "💡",
    title: `У активні тижні ти витрачаєш на ${morePct}% більше`,
    stat: `+${morePct}%`,
    detail: `${Math.round(avgActive).toLocaleString("uk-UA")} ₴ vs ${Math.round(avgRest).toLocaleString("uk-UA")} ₴ витрат/тиж.`,
  };
}

/**
 * Insight 3: Best habit-completion month over the last 12 months.
 * Requires ≥ 2 months with data.
 */
function bestHabitMonthInsight() {
  const state = safeLS("hub_routine_v1", null);
  if (!state) return null;

  const habits = (state.habits || []).filter((h) => !h.archived);
  const completions = state.completions || {};
  if (habits.length === 0) return null;

  const monthDone = {};
  for (const h of habits) {
    for (const dk of completions[h.id] || []) {
      const mk = dk.slice(0, 7);
      monthDone[mk] = (monthDone[mk] || 0) + 1;
    }
  }

  const months = Object.keys(monthDone);
  if (months.length < 2) return null;

  let bestMk = null;
  let bestPct = 0;

  for (const mk of months) {
    const [y, m] = mk.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const total = habits.length * daysInMonth;
    if (total === 0) continue;
    const pct = Math.round((monthDone[mk] / total) * 100);
    if (pct > bestPct) {
      bestPct = pct;
      bestMk = mk;
    }
  }

  if (!bestMk || bestPct < 10) return null;

  const [y, m] = bestMk.split("-").map(Number);
  const label = `${MONTHS_UK[m - 1]} ${y}`;

  return {
    id: "best_habit_month",
    emoji: "🔥",
    title: "Найпослідовніший місяць за звичками",
    stat: `${bestPct}%`,
    detail: label,
  };
}

/**
 * Insight 4: Average kcal on workout days vs rest days.
 * Requires ≥ 3 days in each group.
 */
function workoutKcalInsight() {
  const workouts = parseFizrukWorkouts().filter((w) => w.endedAt);
  const log = safeLS("nutrition_log_v1", {});

  const workoutDays = new Set(
    workouts.map((w) => localDateKey(new Date(w.startedAt))),
  );

  const kcalWorkout = [];
  const kcalRest = [];

  for (const [dk, dayData] of Object.entries(log)) {
    const meals = Array.isArray(dayData?.meals) ? dayData.meals : [];
    const kcal = meals.reduce((s, m) => s + (m?.macros?.kcal ?? 0), 0);
    if (kcal === 0) continue;
    if (workoutDays.has(dk)) {
      kcalWorkout.push(kcal);
    } else {
      kcalRest.push(kcal);
    }
  }

  if (kcalWorkout.length < 3 || kcalRest.length < 3) return null;

  const avgWorkout = Math.round(
    kcalWorkout.reduce((s, k) => s + k, 0) / kcalWorkout.length,
  );
  const avgRest = Math.round(
    kcalRest.reduce((s, k) => s + k, 0) / kcalRest.length,
  );

  const diff = avgWorkout - avgRest;
  if (Math.abs(diff) < 50) return null;

  const sign = diff > 0 ? "+" : "";
  return {
    id: "workout_kcal",
    emoji: "🥗",
    title:
      diff > 0
        ? `У дні тренувань ти їси на ${diff.toLocaleString("uk-UA")} ккал більше`
        : `У дні тренувань ти їси на ${Math.abs(diff).toLocaleString("uk-UA")} ккал менше`,
    stat: `${sign}${diff.toLocaleString("uk-UA")} ккал`,
    detail: `${avgWorkout.toLocaleString("uk-UA")} vs ${avgRest.toLocaleString("uk-UA")} ккал/день`,
  };
}

/**
 * Returns up to 4 cross-module insights computed from localStorage data.
 * Returns an empty array when there is not enough data.
 *
 * Each insight: { id, emoji, title, stat, detail }
 */
export function generateInsights() {
  return [
    workoutDayInsight(),
    activeWeeksSpendingInsight(),
    bestHabitMonthInsight(),
    workoutKcalInsight(),
  ]
    .filter(Boolean)
    .slice(0, 4);
}
