/**
 * Mounts `useCloudSync` exactly once for the whole app, binding it to
 * the currently-authenticated Better Auth user. This is the single
 * point where the scheduler, offline-queue replay, NetInfo listeners
 * and periodic retry timer attach.
 *
 * Must be placed:
 *   - **inside** `QueryProvider` (the persisted `QueryClient` is what
 *     makes `useUser()` cacheable / warm-started across launches)
 *   - **inside** `ApiClientProvider` (so `useApiClient()` has a client
 *     to hand to `useUser()`)
 *   - **outside** any screen components that might want to read sync
 *     status — they depend on our side-effects (the offline-queue
 *     listeners we install here).
 *
 * The React Query persister itself lives in `QueryProvider` so queries
 * warm-start before any user auth resolves; this component is purely
 * about kicking off background sync once we know who the user is.
 *
 * In addition to the side-effects, the provider exposes the
 * `useCloudSync` return value via React context so layout-level UI
 * (e.g. `SyncStatusIndicator`) can read `syncError` / `pullAll`
 * without re-invoking the hook (which would double-attach the
 * scheduler, NetInfo listeners and periodic retry timer).
 */
import { createContext, useContext, type PropsWithChildren } from "react";
import { useUser } from "@sergeant/api-client/react";

import { useCloudSync, type UseCloudSyncReturn } from "./hook/useCloudSync";

const CloudSyncContext = createContext<UseCloudSyncReturn | null>(null);

export function CloudSyncProvider({ children }: PropsWithChildren) {
  const { data: user } = useUser({
    // Auth may not be resolved yet — retrying immediately on a cold
    // start just spams the server with 401s. Let the api-client's
    // default retry handle transient failures; don't refetch on
    // focus because mobile apps "focus" on every bring-to-front.
    retry: false,
    refetchOnWindowFocus: false,
  });
  // `useUser` returns `MeResponse = { user: { id, ... } }`; the sync
  // engine only needs the id, so unwrap and forward that.
  const sync = useCloudSync(user?.user ? { id: user.user.id } : null);
  return (
    <CloudSyncContext.Provider value={sync}>
      {children}
    </CloudSyncContext.Provider>
  );
}

/**
 * Read the cloud-sync state owned by the surrounding `CloudSyncProvider`.
 * Returns `null` when called outside the provider — callers (e.g. the
 * root-layout sync indicator) should treat that as "sync not yet
 * initialised" and render a no-op.
 */
export function useCloudSyncContext(): UseCloudSyncReturn | null {
  return useContext(CloudSyncContext);
}
