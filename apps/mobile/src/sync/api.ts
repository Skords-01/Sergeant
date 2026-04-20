/**
 * Thin mobile-side seam over `apiClient.sync` from `@sergeant/api-client`.
 *
 * Intentionally re-exposes just the two sync endpoints (`pushAll`,
 * `pullAll`) under the same name web uses (`syncApi.pushAll`) so the
 * engine files read identically on both platforms and can stay in
 * lockstep with their web siblings.
 *
 * The `apiClient` instance is the same one wired into
 * `app/_layout.tsx` via `<ApiClientProvider client={apiClient}>`, so
 * the Authorization bearer header (Better Auth session token from
 * `expo-secure-store`) is attached automatically.
 */
import { apiClient } from "@/api/apiClient";

export const syncApi = apiClient.sync;
