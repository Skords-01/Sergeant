import { syncApi } from "@shared/api";
import type { ModulePayload, PullAllResponse, PushAllResponse } from "../types";

/**
 * Transport — мінімальний контракт, який очікують engine-функції
 * (`push`, `pull`, `replay`, `initialSync`, `upload`). Форма навмисне
 * повторює те, що повертав `fetch(...)`: викликачі перевіряють `ok` та
 * викликають `json()`. Після централізації через `@shared/api` самі
 * запити йдуть через `syncApi` (він додає `credentials: "include"`,
 * парсить JSON і кидає `ApiError`). Для сумісності успішні відповіді
 * загортаємо у `TransportResponse`; помилки пробрасываються — engine
 * уже обробляє їх через `try/catch`.
 */
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

function asResponse<T>(data: T): TransportResponse<T> {
  return { ok: true, json: () => Promise.resolve(data) };
}

export const httpTransport: Transport = {
  pushAll: async (modules) =>
    asResponse((await syncApi.pushAll(modules)) as unknown as PushAllResponse),
  pullAll: async () =>
    asResponse((await syncApi.pullAll()) as unknown as PullAllResponse),
};
