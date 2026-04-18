import { SYNC_MODULES, type ModuleName } from "../config";
import type { ModulePayload } from "../types";

/**
 * Extract the last-known module payloads from a queue, tolerating corrupted
 * rows (non-objects, wrong types, unknown module names, missing data).
 * Later entries overwrite earlier ones for the same module since the queue is
 * append-ordered.
 */
export function collectQueuedModules(
  queue: unknown,
): Record<string, ModulePayload> {
  const modulesToPush: Record<string, ModulePayload> = {};
  if (!Array.isArray(queue)) return modulesToPush;
  for (const entry of queue) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { type?: string; modules?: unknown };
    if (e.type !== "push") continue;
    if (!e.modules || typeof e.modules !== "object") continue;
    for (const [mod, payload] of Object.entries(
      e.modules as Record<string, unknown>,
    )) {
      if (!SYNC_MODULES[mod as ModuleName]) continue;
      if (!payload || typeof payload !== "object") continue;
      modulesToPush[mod] = payload as ModulePayload;
    }
  }
  return modulesToPush;
}
