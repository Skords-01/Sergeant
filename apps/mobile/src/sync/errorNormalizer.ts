/**
 * Map any thrown value into the normalized `SyncError` shape surfaced
 * by `useCloudSync` and `useSyncStatus`. Port of
 * `apps/web/src/core/cloudSync/errorNormalizer.ts` — same rules, same
 * retryability classification, identical message fallbacks.
 *
 * Rules:
 *   - ApiError { kind: "network" | "aborted" } → type: "network"
 *     (aborted is non-retryable; network is retryable)
 *   - ApiError { kind: "http", 5xx }           → type: "server", retryable
 *   - ApiError { kind: "http", 4xx }           → type: "server", non-retryable
 *   - ApiError { kind: "parse" }               → type: "server", non-retryable
 *   - plain Error / unknown                    → type: "unknown"
 */
import { isApiError } from "@sergeant/api-client";
import type { SyncError } from "./types";

export function toSyncError(err: unknown): SyncError {
  if (isApiError(err)) {
    if (err.kind === "network") {
      return {
        message: err.message || "Network error",
        type: "network",
        retryable: true,
      };
    }
    if (err.kind === "aborted") {
      return {
        message: err.message || "Request aborted",
        type: "network",
        retryable: false,
      };
    }
    if (err.kind === "http") {
      const retryable = err.status >= 500 && err.status < 600;
      return {
        message: err.serverMessage || err.message || `HTTP ${err.status}`,
        type: "server",
        retryable,
      };
    }
    return {
      message: err.message || "Parse error",
      type: "server",
      retryable: false,
    };
  }
  if (err instanceof Error) {
    return {
      message: err.message || "Unknown error",
      type: "unknown",
      retryable: false,
    };
  }
  return { message: String(err), type: "unknown", retryable: false };
}

export function isRetryableError(err: unknown): boolean {
  if (!isApiError(err)) return false;
  if (err.kind === "network") return true;
  if (err.kind === "http" && err.status >= 500 && err.status < 600) return true;
  return false;
}
