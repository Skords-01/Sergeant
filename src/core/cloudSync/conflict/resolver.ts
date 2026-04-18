import { parseDateSafe } from "./parseDate";
import type { PullAllModuleBody } from "../types";

export interface ResolveInputs {
  cloud: Record<string, PullAllModuleBody | undefined> | undefined;
  hasAnyLocalData: boolean;
  migrated: boolean;
  userId: string | undefined;
  modifiedTimes: Record<string, string>;
  getLocalVersion: (userId: string, moduleName: string) => number;
  dirtyModules: Record<string, true>;
}

export type InitialSyncPlan =
  | {
      kind: "adoptCloud";
      applyModules: Array<{
        mod: string;
        data: Record<string, unknown>;
        version?: number;
      }>;
    }
  | { kind: "needMigration" }
  | {
      kind: "merge";
      applyModules: Array<{ mod: string; data: Record<string, unknown> }>;
      setVersions: Array<{ mod: string; version: number }>;
      dirtyMods: string[];
    }
  | { kind: "noop" };

function hasNonEmptyCloud(
  cloud: ResolveInputs["cloud"],
): cloud is Record<string, PullAllModuleBody> {
  if (!cloud) return false;
  return Object.keys(cloud).some((m) => {
    const body = cloud[m];
    return !!(body?.data && Object.keys(body.data).length > 0);
  });
}

/**
 * Pure classifier for the initial-sync conflict decision. Returns a plan that
 * `initialSync` executes. Extracted from the original `useCloudSync.js`
 * `initialSync` body so the four branches are testable without fetch mocks.
 */
export function resolveInitialSync(inputs: ResolveInputs): InitialSyncPlan {
  const { cloud, hasAnyLocalData, userId, modifiedTimes, getLocalVersion } =
    inputs;
  const hasCloudData = hasNonEmptyCloud(cloud);

  if (hasCloudData && !hasAnyLocalData) {
    const applyModules: Array<{
      mod: string;
      data: Record<string, unknown>;
      version?: number;
    }> = [];
    for (const [mod, payload] of Object.entries(cloud)) {
      if (payload?.data) {
        applyModules.push({
          mod,
          data: payload.data,
          version: payload.version,
        });
      }
    }
    return { kind: "adoptCloud", applyModules };
  }

  if (hasAnyLocalData && !hasCloudData && !inputs.migrated) {
    return { kind: "needMigration" };
  }

  if (hasCloudData && hasAnyLocalData) {
    const applyModules: Array<{
      mod: string;
      data: Record<string, unknown>;
    }> = [];
    const setVersions: Array<{ mod: string; version: number }> = [];
    for (const [mod, payload] of Object.entries(cloud)) {
      if (!payload?.data) continue;
      const localVersion = userId ? getLocalVersion(userId, mod) : 0;
      const cloudVersion = payload.version ?? 0;
      const localModified = parseDateSafe(modifiedTimes[mod]);
      const cloudModified = parseDateSafe(payload.serverUpdatedAt);

      if (
        cloudVersion > localVersion ||
        (cloudModified && localModified && cloudModified > localModified)
      ) {
        applyModules.push({ mod, data: payload.data });
      }
      if (userId && payload.version) {
        setVersions.push({ mod, version: payload.version });
      }
    }
    const dirtyMods = Object.keys(inputs.dirtyModules);
    return { kind: "merge", applyModules, setVersions, dirtyMods };
  }

  return { kind: "noop" };
}
