import type { HttpClient } from "../httpClient";

export interface ModulePushPayload {
  data: unknown;
  clientUpdatedAt: string;
}

export interface ModulePushResult {
  version?: number;
  ok?: boolean;
  error?: string;
  status?: string;
}

export interface PushAllResult {
  results?: Record<string, ModulePushResult>;
}

export interface ModulePullPayload {
  data?: unknown;
  version?: number;
  serverUpdatedAt?: string;
}

export interface PullAllResult {
  modules?: Record<string, ModulePullPayload>;
}

export interface SyncEndpoints {
  pushAll: (
    modules: Record<string, ModulePushPayload>,
  ) => Promise<PushAllResult>;
  pullAll: () => Promise<PullAllResult>;
}

export function createSyncEndpoints(http: HttpClient): SyncEndpoints {
  return {
    pushAll: (modules) =>
      http.post<PushAllResult>("/api/sync/push-all", { modules }),
    pullAll: () => http.post<PullAllResult>("/api/sync/pull-all"),
  };
}
