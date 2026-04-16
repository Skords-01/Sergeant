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

export function maxStreakAllTime(habit, completionsForHabit) {
  const sorted = [...(completionsForHabit || [])].sort();
  if (sorted.length === 0) return 0;
  let best = 0;
  let cur = 0;
  let prev = null;
  for (const key of sorted) {
    if (!habitScheduledOnDate(habit, key)) continue;
    if (prev === null) {
      cur = 1;
    } else {
      let gap = false;
      const d = parseDateKey(prev);
      d.setDate(d.getDate() + 1);
      while (dateKeyFromDate(d) < key) {
        const dk = dateKeyFromDate(d);
        if (habitScheduledOnDate(habit, dk)) {
          gap = true;
          break;
        }
        d.setDate(d.getDate() + 1);
      }
      if (gap) {
        cur = 1;
      } else {
        cur += 1;
      }
    }
    best = Math.max(best, cur);
    prev = key;
  }
  return best;
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

export const currentMaxStreak = maxActiveStreak;

export function completionRateForRange(habits, completions, startKey, endKey) {
  const days = [];
  const d = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  d.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);
  while (d <= end) {
    days.push(dateKeyFromDate(d));
    d.setDate(d.getDate() + 1);
  }

  let scheduled = 0;
  let completed = 0;
  for (const h of habits) {
    if (h.archived) continue;
    const set = new Set(completions[h.id] || []);
    for (const dk of days) {
      if (!habitScheduledOnDate(h, dk)) continue;
      scheduled += 1;
      if (set.has(dk)) completed += 1;
    }
  }
  return {
    completed,
    scheduled,
    rate: scheduled > 0 ? completed / scheduled : 0,
  };
}

export function habitCompletionRate(habit, completions, days) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));

  const dateList = [];
  const d = new Date(start);
  d.setHours(12, 0, 0, 0);
  while (d <= today) {
    dateList.push(dateKeyFromDate(d));
    d.setDate(d.getDate() + 1);
  }

  const set = new Set(completions || []);
  let scheduled = 0;
  let completed = 0;
  for (const dk of dateList) {
    if (!habitScheduledOnDate(habit, dk)) continue;
    scheduled += 1;
    if (set.has(dk)) completed += 1;
  }
  return {
    completed,
    scheduled,
    rate: scheduled > 0 ? completed / scheduled : 0,
  };
}
