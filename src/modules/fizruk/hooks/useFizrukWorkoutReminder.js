import { useEffect, useRef } from "react";

const LAST_KEY = "fizruk_last_reminder_notif_day";

/**
 * Локальне нагадування (через Notification API, якщо дозволено).
 * `enabled` — на сьогодні є запис у календарі плану.
 */
export function useFizrukWorkoutReminder({
  enabled,
  reminderHour,
  reminderMinute,
}) {
  const firedRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      const now = new Date();
      if (
        now.getHours() !== reminderHour ||
        now.getMinutes() !== reminderMinute
      )
        return;

      const dayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (firedRef.current === dayStr) return;

      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;

      firedRef.current = dayStr;
      try {
        localStorage.setItem(LAST_KEY, dayStr);
      } catch {
        /* ignore */
      }

      new Notification("Фізрук — тренування", {
        body: "Заплановане тренування на сьогодні. Відкрий застосунок, щоб стартувати.",
        tag: "fizruk-plan",
      });
    };

    const id = setInterval(tick, 30_000);
    tick();
    return () => clearInterval(id);
  }, [enabled, reminderHour, reminderMinute]);
}

export function requestNotificationPermission() {
  if (typeof Notification === "undefined")
    return Promise.resolve("unsupported");
  if (Notification.permission === "granted") return Promise.resolve("granted");
  return Notification.requestPermission();
}
