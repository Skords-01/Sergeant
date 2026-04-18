import { useCallback, useEffect, useMemo, useState } from "react";

import { MONTHLY_PLAN_STORAGE_KEY } from "../lib/fizrukStorage";

const STORAGE_KEY = MONTHLY_PLAN_STORAGE_KEY;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return {
        reminderEnabled: true,
        reminderHour: 18,
        reminderMinute: 0,
        days: {},
      };
    const p = JSON.parse(raw);
    return {
      reminderEnabled: p.reminderEnabled !== false,
      reminderHour: Number.isFinite(p.reminderHour) ? p.reminderHour : 18,
      reminderMinute: Number.isFinite(p.reminderMinute) ? p.reminderMinute : 0,
      days: typeof p.days === "object" && p.days ? p.days : {},
    };
  } catch {
    return {
      reminderEnabled: true,
      reminderHour: 18,
      reminderMinute: 0,
      days: {},
    };
  }
}

function saveState(s) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("fizruk-storage-monthly-plan"));
  } catch {}
}

export function useMonthlyPlan() {
  const [state, setState] = useState(loadState);

  useEffect(() => {
    const sync = () => setState(loadState());
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY || e.key === null) sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("fizruk-storage-monthly-plan", sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("fizruk-storage-monthly-plan", sync);
    };
  }, []);

  const setReminder = useCallback((hour, minute) => {
    setState((prev) => {
      const next = {
        ...prev,
        reminderHour: Math.max(0, Math.min(23, hour)),
        reminderMinute: Math.max(0, Math.min(59, minute)),
      };
      saveState(next);
      return next;
    });
  }, []);

  const setReminderEnabled = useCallback((enabled) => {
    setState((prev) => {
      const next = { ...prev, reminderEnabled: !!enabled };
      saveState(next);
      return next;
    });
  }, []);

  const setDayTemplate = useCallback((dateKey, templateId) => {
    setState((prev) => {
      const days = { ...prev.days };
      if (templateId == null || templateId === "") {
        delete days[dateKey];
      } else {
        days[dateKey] = { templateId };
      }
      const next = { ...prev, days };
      saveState(next);
      return next;
    });
  }, []);

  const getTemplateForDate = useCallback(
    (dateKey) => state.days[dateKey]?.templateId ?? null,
    [state.days],
  );

  const todayTemplateId = useMemo(
    () => state.days[todayKey()]?.templateId ?? null,
    [state.days],
  );

  return {
    reminderEnabled: state.reminderEnabled,
    reminderHour: state.reminderHour,
    reminderMinute: state.reminderMinute,
    days: state.days,
    setReminder,
    setReminderEnabled,
    setDayTemplate,
    getTemplateForDate,
    todayTemplateId,
    getTodayDateKey: todayKey,
  };
}
