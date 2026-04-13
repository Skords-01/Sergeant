import { useMemo } from "react";
import { useExerciseCatalog } from "./useExerciseCatalog";
import { useWorkouts } from "./useWorkouts";
import { computeRecoveryBy } from "../lib/recoveryCompute";

export { loadPointsForItem } from "../lib/recoveryCompute";

export function useRecovery() {
  const { musclesUk } = useExerciseCatalog();
  const { workouts } = useWorkouts();

  const stats = useMemo(() => {
    const by = computeRecoveryBy(workouts, musclesUk, Date.now());

    const list = Object.values(by)
      .filter((x) => x.id && x.label)
      .sort(
        (a, b) =>
          (b.daysSince ?? 999) - (a.daysSince ?? 999) || b.load7d - a.load7d,
      );

    const ready = list
      .filter((x) => x.lastAt == null || x.status === "green")
      .slice(0, 4);
    const avoid = list.filter((x) => x.status === "red").slice(0, 4);

    return { by, list, ready, avoid };
  }, [workouts, musclesUk]);

  return stats;
}
