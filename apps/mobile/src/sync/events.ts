/**
 * Tiny, DOM-free pub-sub used in place of `window.addEventListener` on
 * web. Mobile has no `window`, so we expose a module-scoped emitter
 * with the same event names (`SYNC_EVENT` = queue/dirty bumps,
 * `SYNC_STATUS_EVENT` = status-view refresh) and the same semantics:
 * fire-and-forget, listeners are idempotent refresh callbacks.
 *
 * Kept intentionally minimal (no `once`, no wildcard) — every consumer
 * only needs `on`/`off`/`emit`. Importantly: this emitter is singleton
 * for the whole app, so `useSyncStatus` in one screen sees events
 * fired by the orchestrator mounted in `_layout.tsx`.
 */
import { SYNC_EVENT, SYNC_STATUS_EVENT } from "./config";

export { SYNC_EVENT, SYNC_STATUS_EVENT };

type Listener = () => void;

const listeners: Record<string, Set<Listener>> = {
  [SYNC_EVENT]: new Set(),
  [SYNC_STATUS_EVENT]: new Set(),
};

function ensureBucket(event: string): Set<Listener> {
  let bucket = listeners[event];
  if (!bucket) {
    bucket = new Set();
    listeners[event] = bucket;
  }
  return bucket;
}

export function onSyncEvent(event: string, listener: Listener): () => void {
  const bucket = ensureBucket(event);
  bucket.add(listener);
  return () => bucket.delete(listener);
}

export function emitStatusEvent(): void {
  for (const l of ensureBucket(SYNC_STATUS_EVENT)) {
    try {
      l();
    } catch {
      /* listener errors must not break the emitter */
    }
  }
}

export function emitSyncEvent(): void {
  for (const l of ensureBucket(SYNC_EVENT)) {
    try {
      l();
    } catch {
      /* swallow */
    }
  }
}

/** Test-only: drop all listeners. */
export function _resetSyncEventsForTest(): void {
  for (const key of Object.keys(listeners)) {
    listeners[key] = new Set();
  }
}
