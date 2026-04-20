import { isApiError } from "@shared/api";
import type { SyncError } from "./types";

/**
 * Map any thrown value into the normalized `SyncError` shape surfaced by
 * the hook and debug panel. Keeps the decision of "what counts as a
 * network error" / "what counts as retryable" in one place so engines and
 * retry logic agree.
 *
 * Rules:
 *   - ApiError { kind: "network" | "aborted" }  → type: "network", retryable: true
 *   - ApiError { kind: "http", 5xx }           → type: "server",  retryable: true
 *   - ApiError { kind: "http", 4xx }           → type: "server",  retryable: false
 *   - ApiError { kind: "parse" }               → type: "server",  retryable: false
 *   - plain Error / unknown                    → type: "unknown", retryable: false
 */
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
      // Aborted requests are transient but not user-retryable: the caller
      // intentionally cancelled. Classify as network so UI treats it like
      // a transient issue, but mark non-retryable to avoid looping.
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
    // parse
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

/**
 * `true` iff the caller should retry the failed request. Matches the
 * classification used by `toSyncError` (network + 5xx → retry; 4xx, parse,
 * aborted, unknown → no retry).
 */
export function isRetryableError(err: unknown): boolean {
  if (!isApiError(err)) return false;
  if (err.kind === "network") return true;
  if (err.kind === "http" && err.status >= 500 && err.status < 600) return true;
  return false;
}
