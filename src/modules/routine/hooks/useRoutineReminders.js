import { useEffect, useRef } from "react";
import { dateKeyFromDate, habitScheduledOnDate } from "../lib/hubCalendarAggregate.js";

const NOTIFY_PREFIX = "routine_notify_";

function todayKey() {
  return dateKeyFromDate(new Date());
}

function currentHm() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

/**
 * Локальні нагадування (поки вкладка відкрита / дозвіл на Notification).
 * Одне сповіщення на звичку на день, лише якщо ще не відмічено виконання.
 */
export function useRoutineReminders(routine) {
  const enabled = routine.prefs?.routineRemindersEnabled === true;
  const routineRef = useRef(routine);
  routineRef.current = routine;

  useEffect(() => {
    if (!enabled) return undefined;

    const tick = () => {
      const r = routineRef.current;
      if (r.prefs?.routineRemindersEnabled !== true) return;
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;

      const dk = todayKey();
      const hm = currentHm();

      for (const h of r.habits) {
        if (h.archived) continue;
        const t = h.timeOfDay && String(h.timeOfDay).trim();
        if (!t || t !== hm) continue;
        if (!habitScheduledOnDate(h, dk)) continue;
        const completions = r.completions[h.id] || [];
        if (completions.includes(dk)) continue;

        const storageKey = `${NOTIFY_PREFIX}${h.id}_${dk}`;
        try {
          if (localStorage.getItem(storageKey)) continue;
        } catch {
          /* noop */
        }

        try {
          const title = `${h.emoji || "✓"} ${h.name}`;
          new Notification(title, {
            body: "Нагадування про звичку",
            tag: storageKey,
            requireInteraction: false,
          });
          try {
            localStorage.setItem(storageKey, "1");
          } catch {
            /* noop */
          }
        } catch {
          /* noop */
        }
      }
    };

    const id = setInterval(tick, 30000);
    tick();
    return () => clearInterval(id);
  }, [enabled]);
}

export async function requestRoutineNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}
