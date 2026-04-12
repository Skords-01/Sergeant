import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "fizruk_pushups_v1";
const HISTORY_DAYS = 30;

function todayStr() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

// Returns last N days as [{ date: "YYYY-MM-DD", total: number }], newest last
function buildHistory(data, days) {
  const result = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const str = d.toISOString().slice(0, 10);
    result.push({ date: str, total: data[str] ?? 0 });
  }
  return result;
}

export function usePushups() {
  const [data, setData] = useState(() => loadData());

  // Sync across tabs
  useEffect(() => {
    const handler = (e) => {
      if (e.key === STORAGE_KEY) setData(loadData());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const today = todayStr();
  const todayCount = data[today] ?? 0;

  const addReps = useCallback((reps) => {
    const n = Number(reps);
    if (!n || n <= 0) return;
    setData(prev => {
      const next = { ...prev, [today]: (prev[today] ?? 0) + n };
      saveData(next);
      return next;
    });
  }, [today]);

  const history = buildHistory(data, HISTORY_DAYS);

  // Last 7 days for mini chart on dashboard
  const recentHistory = history.slice(-7);

  return { todayCount, addReps, history, recentHistory };
}
