import { createContext, useContext, useMemo } from "react";

const RoutineCalendarContext = createContext(null);

export function RoutineCalendarProvider({ value, children }) {
  const memoValue = useMemo(() => value, [value]);
  return (
    <RoutineCalendarContext.Provider value={memoValue}>
      {children}
    </RoutineCalendarContext.Provider>
  );
}

export function useRoutineCalendar() {
  const ctx = useContext(RoutineCalendarContext);
  if (!ctx) throw new Error("useRoutineCalendar must be used within RoutineCalendarProvider");
  return ctx;
}

