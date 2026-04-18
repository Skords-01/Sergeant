import { useCallback, useEffect, useMemo, useState } from "react";
import { safeReadLS, safeWriteLS } from "@shared/lib/storage.js";
import { STORAGE_KEYS } from "@shared/lib/storageKeys.js";

const KEY = STORAGE_KEYS.FIZRUK_MEASUREMENTS;

function uid() {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const MEASURE_FIELDS = [
  { id: "weightKg", label: "Вага", unit: "кг" },
  { id: "bodyFatPct", label: "% жиру", unit: "%" },
  { id: "neckCm", label: "Шия", unit: "см" },
  { id: "chestCm", label: "Груди", unit: "см" },
  { id: "waistCm", label: "Талія", unit: "см" },
  { id: "hipsCm", label: "Стегна (обхват)", unit: "см" },
  { id: "bicepLCm", label: "Біцепс (Л)", unit: "см" },
  { id: "bicepRCm", label: "Біцепс (П)", unit: "см" },
  { id: "forearmLCm", label: "Передпліччя (Л)", unit: "см" },
  { id: "forearmRCm", label: "Передпліччя (П)", unit: "см" },
  { id: "thighLCm", label: "Стегно (Л)", unit: "см" },
  { id: "thighRCm", label: "Стегно (П)", unit: "см" },
  { id: "calfLCm", label: "Литка (Л)", unit: "см" },
  { id: "calfRCm", label: "Литка (П)", unit: "см" },
];

export function useMeasurements() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    const parsed = safeReadLS(KEY, []);
    if (Array.isArray(parsed)) setEntries(parsed);
  }, []);

  const persist = useCallback((next) => {
    setEntries(next);
    safeWriteLS(KEY, next);
  }, []);

  const addEntry = useCallback(
    (entry) => {
      const e = { id: uid(), at: new Date().toISOString(), ...entry };
      persist([e, ...entries]);
      return e;
    },
    [persist, entries],
  );

  const deleteEntry = useCallback(
    (id) => {
      persist(entries.filter((e) => e.id !== id));
    },
    [persist, entries],
  );

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  }, [entries]);

  return { entries: sorted, addEntry, deleteEntry };
}
