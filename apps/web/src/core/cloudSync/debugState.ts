import type { SyncError, SyncState } from "./types";

/**
 * Actions the debug panel cares about, ordered loosely by how a user
 * reads them in a log: something was enqueued, then scheduled, then a
 * sync ran, possibly with retries, and ended in success or error.
 */
export type SyncDebugAction =
  | "enqueue"
  | "schedule"
  | "sync"
  | "retry"
  | "success"
  | "error"
  | null;

export interface CloudSyncDebugSnapshot {
  /** Current high-level state of the sync lifecycle. */
  state: SyncState;
  /** Last time `onSuccess` fired — `null` until the first success. */
  lastSyncAt: Date | null;
  /** Last normalized error — `null` once a success lands afterwards. */
  lastError: SyncError | null;
  /** Most recent action the subsystem performed. */
  lastAction: SyncDebugAction;
  /** Monotonically-increasing id of the most recent `onStart`. */
  syncId: number;
}

/**
 * Module-level snapshot with a tiny pub/sub so the `useCloudSyncDebug`
 * hook can re-render without re-implementing all the derivations here.
 * Using module state (instead of React Context) keeps the debug hook
 * usable from any component without adding a provider at the root.
 */
let snapshot: CloudSyncDebugSnapshot = {
  state: "idle",
  lastSyncAt: null,
  lastError: null,
  lastAction: null,
  syncId: 0,
};

type Listener = (next: CloudSyncDebugSnapshot) => void;
const listeners = new Set<Listener>();

export function getDebugSnapshot(): CloudSyncDebugSnapshot {
  return snapshot;
}

export function updateDebugSnapshot(
  patch: Partial<CloudSyncDebugSnapshot>,
): void {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener(snapshot);
}

export function subscribeDebug(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
