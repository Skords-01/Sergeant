/**
 * Compare exercise muscle ids with recovery stats (useRecovery().by).
 * Primary muscles weighted higher in messaging; secondary still flagged if not recovered.
 */
export function recoveryConflictsForExercise(ex, by = {}) {
  const primary = ex?.muscles?.primary || [];
  const secondary = ex?.muscles?.secondary || [];
  const red = [];
  const yellow = [];
  const push = (id, role) => {
    const m = by[id];
    if (!m) return;
    const row = { id, label: m.label || id, role, status: m.status };
    if (m.status === "red") red.push(row);
    else if (m.status === "yellow") yellow.push(row);
  };
  for (const id of primary) push(id, "primary");
  for (const id of secondary) push(id, "secondary");
  return {
    red,
    yellow,
    hasWarning: red.length > 0 || yellow.length > 0,
    hasHardBlock: red.length > 0,
  };
}

export function recoveryConflictsForWorkoutItem(it, by = {}) {
  const primary = it?.musclesPrimary || [];
  const secondary = it?.musclesSecondary || [];
  const ex = { muscles: { primary, secondary } };
  return recoveryConflictsForExercise(ex, by);
}
