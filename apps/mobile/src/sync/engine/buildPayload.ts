import { collectModuleData } from "../state/moduleData";
import type { ModulePayload } from "../types";

/**
 * Build the `{ module → payload }` map pushed to the server. For each
 * requested module, reads its MMKV slice via `collectModuleData` and
 * stamps `clientUpdatedAt` from the dirty-tracking `modifiedTimes`
 * snapshot (falling back to "now" for modules without a tracked
 * modify). Modules with no local data are omitted so we never send
 * empty objects. Port of
 * `apps/web/src/core/cloudSync/engine/buildPayload.ts`.
 */
export function buildModulesPayload(
  modNames: Iterable<string>,
  modifiedTimes: Record<string, string>,
): Record<string, ModulePayload> {
  const modules: Record<string, ModulePayload> = {};
  for (const mod of modNames) {
    const data = collectModuleData(mod);
    if (data && Object.keys(data).length > 0) {
      modules[mod] = {
        data,
        clientUpdatedAt: modifiedTimes[mod] || new Date().toISOString(),
      };
    }
  }
  return modules;
}
