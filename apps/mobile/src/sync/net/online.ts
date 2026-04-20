/**
 * Online-status adapter built on `@react-native-community/netinfo`.
 *
 * Web's `useCloudSync` reads `navigator.onLine` and listens to the
 * browser `online`/`offline` events. React Native has no such globals;
 * NetInfo is the community-standard bridge to the OS connectivity APIs
 * (CoreTelephony / ConnectivityManager).
 *
 * This module exposes three primitives so the rest of the sync code
 * looks the same as web:
 *
 *   - `isOnline()`        — synchronous best-guess used inside engines
 *                            that need to decide "push vs. enqueue"
 *                            without awaiting. Seeded by the first
 *                            NetInfo event and kept up to date via the
 *                            subscription.
 *   - `onOnlineChange(cb)` — fires exactly when connectivity flips
 *                            offline → online (matching the browser
 *                            `online` event), NOT on every NetInfo tick.
 *   - `startOnlineTracker()` — one-call bootstrap that installs the
 *                            single process-wide NetInfo subscription;
 *                            idempotent.
 *
 * The "only fire on offline→online transitions" shape matches how
 * `useSyncRetry` on web hooks `window.addEventListener('online', …)` —
 * we explicitly do NOT want every background radio flap to trigger a
 * sync, only the transitions that restore connectivity.
 */
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

type Listener = () => void;

let started = false;
// Default to `true` so first-render engines don't see a spurious
// "offline" before NetInfo delivers its first snapshot. NetInfo's own
// `fetch()` below corrects this immediately on mount.
let online = true;
const listeners = new Set<Listener>();

function applyState(state: NetInfoState): void {
  // `isInternetReachable` can legitimately be `null` on cold start
  // (NetInfo hasn't probed yet). Treat null as "assume reachable if
  // connected" so we don't over-report offline during the first
  // few hundred ms of app launch.
  const reachable =
    state.isConnected === true &&
    (state.isInternetReachable === true || state.isInternetReachable === null);
  const wasOnline = online;
  online = reachable;
  if (!wasOnline && online) {
    for (const l of listeners) {
      try {
        l();
      } catch {
        /* swallow */
      }
    }
  }
}

/**
 * Install the single NetInfo subscription. Safe to call multiple
 * times — subsequent calls are no-ops.
 */
export function startOnlineTracker(): () => void {
  if (started) return () => {};
  started = true;
  // Seed synchronously-ish: NetInfo.fetch is async, but the
  // subscription fires its current state almost immediately on most
  // platforms.
  NetInfo.fetch()
    .then(applyState)
    .catch(() => {
      /* swallow — default `online = true` stays */
    });
  const unsubscribe = NetInfo.addEventListener(applyState);
  return () => {
    unsubscribe();
    started = false;
  };
}

export function isOnline(): boolean {
  return online;
}

export function onOnlineChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test-only: reset module state between suites. */
export function _resetOnlineForTest(initial = true): void {
  started = false;
  online = initial;
  listeners.clear();
}
