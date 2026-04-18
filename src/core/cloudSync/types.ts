import type { ModuleName } from "./config";

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
