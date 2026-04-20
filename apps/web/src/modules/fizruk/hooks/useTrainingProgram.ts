import { useCallback, useEffect, useMemo, useState } from "react";
import { BUILTIN_PROGRAMS, getTodaySession } from "@sergeant/fizruk-domain";

const ACTIVE_PROGRAM_KEY = "fizruk_active_program_id_v1";

export function useTrainingProgram() {
  const [activeProgramId, setActiveProgramId] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_PROGRAM_KEY) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (activeProgramId) {
        localStorage.setItem(ACTIVE_PROGRAM_KEY, activeProgramId);
      } else {
        localStorage.removeItem(ACTIVE_PROGRAM_KEY);
      }
    } catch {}
  }, [activeProgramId]);

  const activeProgram = useMemo(
    () => BUILTIN_PROGRAMS.find((p) => p.id === activeProgramId) || null,
    [activeProgramId],
  );

  const activateProgram = useCallback((id) => {
    setActiveProgramId(id || null);
  }, []);

  const deactivateProgram = useCallback(() => {
    setActiveProgramId(null);
  }, []);

  const todaySession = useMemo(
    () => getTodaySession(activeProgram),
    [activeProgram],
  );

  return {
    programs: BUILTIN_PROGRAMS,
    activeProgramId,
    activeProgram,
    todaySession,
    activateProgram,
    deactivateProgram,
  };
}
