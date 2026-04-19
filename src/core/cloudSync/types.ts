import type { ModuleName } from "./config";

/**
 * Lifecycle callbacks every engine entry point (pushDirty, pushAll,
 * pullAll, initialSync, uploadLocalData) accepts. The React hook owns
 * the implementations via `useSyncCallbacks`; engines only invoke them.
 */
export interface SyncCallbacks {
  onStart(): void;
  onSuccess(when: Date): void;
  onError(message: string): void;
  onSettled(): void;
}

/**
 * Base args bag passed into engine entry points. Engines that need extra
 * callbacks (e.g. `onNeedMigration`, `onMigrated`) intersect with this.
 */
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
  results?: Partial<Record<ModuleName | string, ServerModuleResult>>;
}

export interface PullAllModuleBody {
  data?: Record<string, unknown>;
  version?: number;
  serverUpdatedAt?: string;
}

export interface PullAllResponse {
  modules?: Partial<Record<ModuleName | string, PullAllModuleBody>>;
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
