import {
  habitScheduledOnDate,
  dateKeyFromDate,
  parseDateKey,
} from "./hubCalendarAggregate.js";

function dateKeyMinusDays(baseKey, daysBack) {
  const d = parseDateKey(baseKey);
  d.setDate(d.getDate() - daysBack);
  d.setHours(12, 0, 0, 0);
  return dateKeyFromDate(d);
}

/**
 * Поточна серія: від сьогодні назад, лише дні де звичка запланована; зупинка на першому без відмітки.
 */
export function streakForHabit(habit, completionsForHabit, todayKey) {
  const set = new Set(completionsForHabit || []);
  let streak = 0;
  let dayOffset = 0;
  for (let i = 0; i < 500; i++) {
    const key = dateKeyMinusDays(todayKey, dayOffset);
    if (!habitScheduledOnDate(habit, key)) {
      dayOffset += 1;
      continue;
    }
    if (set.has(key)) {
      streak += 1;
      dayOffset += 1;
    } else {
      break;
    }
  }
  return streak;
}

export function maxActiveStreak(habits, completions, todayKey) {
  let m = 0;
  for (const h of habits) {
    if (h.archived) continue;
    const c = completions[h.id] || [];
    m = Math.max(m, streakForHabit(h, c, todayKey));
  }
  return m;
}
