import { useEffect, useRef } from "react";
import {
  dateKeyFromDate,
  habitScheduledOnDate,
} from "../lib/hubCalendarAggregate.js";
import { normalizeReminderTimes } from "../lib/routineDraftUtils.js";

export const ROUTINE_NOTIFY_PREFIX = "routine_notify_";

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
  } catch {}
}

function todayKey() {
  return dateKeyFromDate(new Date());
}

function currentHm() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

async function showNotification(title, body, tag) {
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        tag,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        requireInteraction: false,
      });
      return;
    }
  } catch {}
  try {
    new Notification(title, { body, tag, requireInteraction: false });
  } catch {}
}

function sendRoutineStateToSW(routine) {
  try {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return;
    navigator.serviceWorker.controller.postMessage({
      type: "ROUTINE_STATE_UPDATE",
      data: {
        habits: routine.habits,
        completions: routine.completions,
        prefs: routine.prefs,
      },
    });
  } catch {}
}

export function useRoutineReminders(routine) {
  const enabled = routine.prefs?.routineRemindersEnabled === true;
  const routineRef = useRef(routine);
  routineRef.current = routine;

  useEffect(() => {
    cleanupStaleRoutineNotifyKeys();
  }, []);

  useEffect(() => {
    sendRoutineStateToSW(routine);
  }, [routine]);

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
        const times = normalizeReminderTimes(h);
        if (times.length === 0) continue;
        if (!times.includes(hm)) continue;
        if (!habitScheduledOnDate(h, dk)) continue;
        const completions = r.completions[h.id] || [];
        if (completions.includes(dk)) continue;

        const storageKey = `${ROUTINE_NOTIFY_PREFIX}${h.id}_${hm}_${dk}`;
        try {
          if (localStorage.getItem(storageKey)) continue;
        } catch {}

        const title = `${h.emoji || "✓"} ${h.name}`;
        showNotification(title, "Нагадування про звичку", storageKey);
        try {
          localStorage.setItem(storageKey, "1");
          try {
            if (navigator.serviceWorker?.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: "ROUTINE_NOTIFICATION_SENT",
                data: { storageKey },
              });
            }
          } catch {}
        } catch {}
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
