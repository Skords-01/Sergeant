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
      /**
       * Модулі, де cloud-версія новіша за локальну, але локально лежать
       * непушнуті зміни (`dirtyModules[mod] === true`). Такі модулі
       * НЕ накатуємо з хмари, щоб не затерти локальні зміни мовчки —
       * `applyMerge` потім спробує запушити локальні дані на сервер; LWW-guard
       * на бекенді (`client_updated_at <= $4`) дасть `conflict`, якщо
       * cloud-timestamp справді новіший, і UI може показати попередження.
       */
      skippedDirty: string[];
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
    const skippedDirty: string[] = [];
    for (const [mod, payload] of Object.entries(cloud)) {
      if (!payload?.data) continue;
      const localVersion = userId ? getLocalVersion(userId, mod) : 0;
      const cloudVersion = payload.version ?? 0;
      const localModified = parseDateSafe(modifiedTimes[mod]);
      const cloudModified = parseDateSafe(payload.serverUpdatedAt);

      const cloudWins =
        cloudVersion > localVersion ||
        (cloudModified && localModified && cloudModified > localModified);

      if (cloudWins) {
        // Не затираємо локальні непушнуті зміни: модуль у dirtyModules
        // пошлеться окремо через `applyMerge` і бекендовий LWW-guard
        // (`client_updated_at <= $4`) самостійно вирішить, чия версія свіжіша.
        // Без цього skip, `applyModuleData(cloud)` затирав би локальні зміни
        // ще ДО push-у, і наступний push вже ніс би втрачений (cloud-)стан.
        if (inputs.dirtyModules[mod]) {
          skippedDirty.push(mod);
        } else {
          applyModules.push({ mod, data: payload.data });
        }
      }
      if (userId && payload.version) {
        setVersions.push({ mod, version: payload.version });
      }
    }
    const dirtyMods = Object.keys(inputs.dirtyModules);
    return {
      kind: "merge",
      applyModules,
      setVersions,
      dirtyMods,
      skippedDirty,
    };
  }

  return { kind: "noop" };
}
