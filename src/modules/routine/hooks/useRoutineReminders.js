import { useEffect, useRef } from "react";
import {
  dateKeyFromDate,
  habitScheduledOnDate,
} from "../lib/hubCalendarAggregate.js";

export const ROUTINE_NOTIFY_PREFIX = "routine_notify_";

/** Видаляє старі ключі routine_notify_* (дата в кінці ключа). */
export function cleanupStaleRoutineNotifyKeys(maxAgeDays = 45) {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(ROUTINE_NOTIFY_PREFIX)) continue;
      const m = k.match(/(\d{4}-\d{2}-\d{2})$/);
      const d = m?.[1];
      if (d && d < cutoffKey) localStorage.removeItem(k);
    }
  } catch {
    /* noop */
  }
}

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
    cleanupStaleRoutineNotifyKeys();
  }, []);

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

        const storageKey = `${ROUTINE_NOTIFY_PREFIX}${h.id}_${dk}`;
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
