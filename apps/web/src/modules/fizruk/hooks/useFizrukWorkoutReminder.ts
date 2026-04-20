import { useEffect, useRef } from "react";

const LAST_KEY = "fizruk_last_reminder_notif_day";

export function sendFizrukStateToSW(state) {
  try {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller)
      return;
    navigator.serviceWorker.controller.postMessage({
      type: "FIZRUK_STATE_UPDATE",
      data: state,
    });
  } catch {}
}

/**
 * Локальне нагадування (через Notification API, якщо дозволено).
 * `enabled` — на сьогодні є запис у календарі плану.
 */
export function useFizrukWorkoutReminder({
  enabled,
  reminderHour,
  reminderMinute,
  reminderEnabled,
  days,
}) {
  const firedRef = useRef(null);

  useEffect(() => {
    sendFizrukStateToSW({
      reminderEnabled,
      reminderHour,
      reminderMinute,
      days,
    });
  }, [reminderEnabled, reminderHour, reminderMinute, days]);

  useEffect(() => {
    if (!enabled) return;
    if (!reminderEnabled) return;

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

      try {
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.ready
            .then((reg) => {
              reg.showNotification("🏋️ Фізрук — тренування", {
                body: "Заплановане тренування на сьогодні. Відкрий застосунок, щоб стартувати.",
                tag: `fizruk-plan-${dayStr}`,
                icon: "/icon-192.png",
                badge: "/icon-192.png",
                requireInteraction: false,
                data: { action: "open", module: "fizruk" },
              });
            })
            .catch(() => {
              new Notification("🏋️ Фізрук — тренування", {
                body: "Заплановане тренування на сьогодні. Відкрий застосунок, щоб стартувати.",
                tag: "fizruk-plan",
              });
            });
        } else {
          new Notification("🏋️ Фізрук — тренування", {
            body: "Заплановане тренування на сьогодні. Відкрий застосунок, щоб стартувати.",
            tag: "fizruk-plan",
          });
        }
      } catch {}
    };

    const id = setInterval(tick, 30_000);
    tick();
    return () => clearInterval(id);
  }, [enabled, reminderEnabled, reminderHour, reminderMinute]);
}
