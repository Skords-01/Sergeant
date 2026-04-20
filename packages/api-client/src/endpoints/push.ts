import type { HttpClient } from "../httpClient";

export interface PushEndpoints {
  getVapidPublic: () => Promise<{ publicKey: string }>;
  subscribe: (subscription: PushSubscriptionJSON) => Promise<unknown>;
  unsubscribe: (endpoint: string) => Promise<unknown>;
}

export function createPushEndpoints(http: HttpClient): PushEndpoints {
  return {
    getVapidPublic: () =>
      http.get<{ publicKey: string }>("/api/push/vapid-public"),
    subscribe: (subscription) =>
      http.post<unknown>("/api/push/subscribe", subscription),
    unsubscribe: (endpoint) =>
      http.del<unknown>("/api/push/subscribe", { endpoint }),
  };
}
