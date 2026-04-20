import { useMemo } from "react";
import type { CurrentUser, EngineArgs } from "../types";
import { useSyncCallbacks, type SyncLifecycle } from "./useSyncCallbacks";

export interface UseEngineArgsResult {
  /**
   * The 5-field bag every engine entry point accepts
   * (`user` + `onStart` + `onSuccess` + `onError` + `onSettled`).
   * Spread into engine args to add extra callbacks like `onNeedMigration`.
   */
  engineArgs: EngineArgs;
  /**
   * React state (`syncing`, `lastSync`, `syncError`) plus the in-flight
   * concurrency guard (`runExclusive`, `claimBusy`). Exposed separately
   * from `engineArgs` because the orchestrator wires the guard around
   * engine calls rather than passing it to engines.
   */
  lifecycle: SyncLifecycle;
}

/**
 * Builds the engine argument bag and lifecycle handle used by the cloud-sync
 * orchestrator. Owns `useSyncCallbacks` so consumers don't juggle four
 * individual callbacks next to `user` — they read a single `engineArgs`
 * reference whose identity is stable across renders.
 */
export function useEngineArgs(
  user: CurrentUser | null | undefined,
): UseEngineArgsResult {
  const lifecycle = useSyncCallbacks();
  const { onStart, onSuccess, onError, onErrorRaw, onSettled } = lifecycle;
  const engineArgs: EngineArgs = useMemo(
    () => ({ user, onStart, onSuccess, onError, onErrorRaw, onSettled }),
    [user, onStart, onSuccess, onError, onErrorRaw, onSettled],
  );
  return { engineArgs, lifecycle };
}
