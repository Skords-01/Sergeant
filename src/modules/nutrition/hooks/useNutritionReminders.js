import { useEffect, useRef } from "react";
import { todayISODate } from "../lib/nutritionFormat.js";

export function useNutritionReminders(prefs) {
  const lastNotifyKeyRef = useRef("");

  useEffect(() => {
    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "NUTRITION_STATE_UPDATE",
          data: {
            reminderEnabled: prefs.reminderEnabled,
            reminderHour: prefs.reminderHour ?? 12,
          },
        });
      }
    } catch {}
  }, [prefs.reminderEnabled, prefs.reminderHour]);

  useEffect(() => {
    if (
      !prefs.reminderEnabled ||
      typeof window === "undefined" ||
      !("Notification" in window)
    )
      return;
    const tick = () => {
      if (Notification.permission !== "granted") return;
      const h = new Date().getHours();
      const target = prefs.reminderHour ?? 12;
      if (h !== target) return;
      const key = `${todayISODate()}-${target}`;
      if (lastNotifyKeyRef.current === key) return;
      lastNotifyKeyRef.current = key;
      try {
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.ready
            .then((reg) => {
              reg.showNotification("🥗 Харчування", {
                body: "Час записати прийоми їжі.",
                tag: `nutrition-reminder-${key}`,
                icon: "/icon-192.png",
                badge: "/icon-192.png",
                requireInteraction: false,
                data: { action: "open", module: "nutrition" },
              });
            })
            .catch(() => {
              new Notification("🥗 Харчування", {
                body: "Час записати прийоми їжі.",
              });
            });
        } else {
          new Notification("🥗 Харчування", {
            body: "Час записати прийоми їжі.",
          });
        }
      } catch {
        /* ignore */
      }
    };
    const id = window.setInterval(tick, 45_000);
    tick();
    return () => window.clearInterval(id);
  }, [prefs.reminderEnabled, prefs.reminderHour]);
}
