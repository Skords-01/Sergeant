import { apiUrl } from "@shared/lib/apiUrl";
import type { ModulePayload, PullAllResponse, PushAllResponse } from "../types";

export interface TransportResponse<T> {
  ok: boolean;
  json(): Promise<T>;
}

export interface Transport {
  pushAll(
    modules: Record<string, ModulePayload>,
  ): Promise<TransportResponse<PushAllResponse>>;
  pullAll(): Promise<TransportResponse<PullAllResponse>>;
}

export const httpTransport: Transport = {
  pushAll: (modules) =>
    fetch(apiUrl("/api/sync/push-all"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ modules }),
    }) as unknown as Promise<TransportResponse<PushAllResponse>>,
  pullAll: () =>
    fetch(apiUrl("/api/sync/pull-all"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    }) as unknown as Promise<TransportResponse<PullAllResponse>>,
};
