/**
 * Shared types for the mobile cloud-sync subsystem. Mirrors
 * `apps/web/src/core/cloudSync/types.ts` 1:1 so both client codebases
 * speak the same vocabulary when talking to the server's
 * `/api/v1/sync/*` endpoints (payload shapes are identical).
 */

export type SyncState =
  | "idle"
  | "dirty"
  | "queued"
  | "syncing"
  | "success"
  | "error";

export interface SyncError {
  message: string;
  type: "network" | "server" | "unknown";
  retryable: boolean;
}

export interface SyncCallbacks {
  onStart(): void;
  onSuccess(when: Date): void;
  onError(message: string): void;
  onErrorRaw?(err: unknown): void;
  onSettled(): void;
}

export interface EngineArgs extends SyncCallbacks {
  user: CurrentUser | null | undefined;
}

export interface ModulePayload {
  data: Record<string, unknown>;
  clientUpdatedAt: string;
}

export interface ServerModuleResult {
  version?: number;
  conflict?: boolean;
  error?: string;
  ok?: boolean;
}

export interface PushAllResponse {
  results?: Record<string, ServerModuleResult>;
}

export interface PullAllModuleBody {
  data?: Record<string, unknown>;
  version?: number;
  serverUpdatedAt?: string;
}

export interface PullAllResponse {
  modules?: Record<string, PullAllModuleBody>;
}

export interface QueuePushEntry {
  type: "push";
  ts: string;
  modules: Record<string, ModulePayload>;
}

export type QueueEntry = QueuePushEntry;

export interface CurrentUser {
  id?: string;
}
