import type { ServerModuleResult } from "../types";

/**
 * A module push result is considered successful only when the server did not
 * signal a conflict, an error, or ok:false. Any ambiguous shape is treated as
 * non-success so we keep the module dirty and retry later instead of dropping
 * unsynced changes.
 */
export function isModulePushSuccess(r: unknown): boolean {
  if (!r || typeof r !== "object") return false;
  const res = r as ServerModuleResult;
  if (res.conflict) return false;
  if (res.error) return false;
  if (res.ok === false) return false;
  return true;
}
