import { PushRegisterSchema, z } from "@sergeant/shared";
import type { HttpClient } from "../httpClient";
import type { RequestOptions } from "../types";

/**
 * Runtime-схема запиту `POST /api/v1/push/register`.
 *
 * Це точне дзеркало `PushRegisterSchema` з `@sergeant/shared`, щоб клієнт і
 * сервер валідувалися з одного джерела правди (див.
 * `packages/shared/src/schemas/api.ts`). Discriminated union на `platform`:
 *
 * - `platform: "web"` — web-push: `token` несе endpoint URL, `keys`
 *   (`p256dh`, `auth`) обовʼязкові (RFC 8030).
 * - `platform: "ios" | "android"` — native push: `token` — opaque APNs/FCM
 *   device token, `keys` відсутні.
 */
export const PushRegisterRequestSchema = PushRegisterSchema;

export type PushRegisterRequest = z.infer<typeof PushRegisterRequestSchema>;

export type PushPlatform = PushRegisterRequest["platform"];

/**
 * Runtime-схема відповіді `POST /api/v1/push/register`. Сервер відповідає
 * `200 { ok: true, platform }` як на web, так і на native (див.
 * `docs/mobile.md`).
 */
export const PushRegisterResponseSchema = z.object({
  ok: z.literal(true),
  platform: z.enum(["web", "ios", "android"]),
});

export type PushRegisterResponse = z.infer<typeof PushRegisterResponseSchema>;

export interface PushEndpoints {
  /** Legacy web-push: VAPID public key для `PushManager.subscribe`. */
  getVapidPublic: () => Promise<{ publicKey: string }>;
  /** Legacy web-push: зберегти `PushSubscription.toJSON()` на бекенді. */
  subscribe: (subscription: PushSubscriptionJSON) => Promise<unknown>;
  /** Legacy web-push: видалити підписку за `endpoint`. */
  unsubscribe: (endpoint: string) => Promise<unknown>;
  /**
   * `POST /api/push/register` — уніфікована реєстрація push-пристрою
   * (web / iOS / Android). Шлях автоматично перетворюється в
   * `/api/v1/push/register` через `applyApiPrefix` у `HttpClient`
   * (див. `src/httpClient.ts`). Відповідь валідується
   * `PushRegisterResponseSchema`.
   */
  register: (
    body: PushRegisterRequest,
    opts?: Pick<RequestOptions, "signal">,
  ) => Promise<PushRegisterResponse>;
}

export function createPushEndpoints(http: HttpClient): PushEndpoints {
  return {
    getVapidPublic: () =>
      http.get<{ publicKey: string }>("/api/push/vapid-public"),
    subscribe: (subscription) =>
      http.post<unknown>("/api/push/subscribe", subscription),
    unsubscribe: (endpoint) =>
      http.del<unknown>("/api/push/subscribe", { endpoint }),
    register: async (body, { signal } = {}) => {
      const raw = await http.post<unknown>("/api/push/register", body, {
        signal,
      });
      return PushRegisterResponseSchema.parse(raw);
    },
  };
}
