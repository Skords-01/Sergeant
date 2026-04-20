// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  PushRegisterRequestSchema,
  PushUnregisterRequestSchema,
  type PushRegisterRequest,
  type PushRegisterResponse,
  type PushUnregisterRequest,
  type PushUnregisterResponse,
} from "@sergeant/api-client";
import { ApiClientProvider } from "@sergeant/api-client/react";
import type { ApiClient } from "@sergeant/api-client";

// Mock `@shared/api` — уся web-сторона шарить один `createApiClient(...)`
// інстанс, але у юніт-тестах не хочемо проганяти HTTP-шар: мокаємо
// `pushApi.getVapidPublic` (інші методи pushApi після session-4c не
// використовуються напряму — все йде через уніфіковані `api.push.register`
// / `api.push.unregister` з `@sergeant/api-client/react`-хуків).
vi.mock("@shared/api", async () => {
  const actual =
    await vi.importActual<typeof import("@shared/api")>("@shared/api");
  return {
    ...actual,
    pushApi: {
      getVapidPublic: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    },
  };
});

import { usePushNotifications } from "./usePushNotifications.js";
import { pushApi } from "@shared/api";

const getVapidPublicMock = pushApi.getVapidPublic as unknown as ReturnType<
  typeof vi.fn
>;
const legacyUnsubscribeMock = pushApi.unsubscribe as unknown as ReturnType<
  typeof vi.fn
>;

// Мінімальний мок `PushSubscription` — нам цікавий тільки `toJSON()`
// (саме з нього береться `endpoint` + `keys`) і `endpoint` (для
// unsubscribe-шляху). Інші поля інтерфейсу веб-API не використовуються.
function makeMockPushSubscription(args: {
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  return {
    endpoint: args.endpoint,
    expirationTime: null,
    options: {} as PushSubscriptionOptions,
    getKey: () => null,
    toJSON: () => ({
      endpoint: args.endpoint,
      keys: { p256dh: args.p256dh, auth: args.auth },
    }),
    unsubscribe: async () => true,
  } as unknown as PushSubscription;
}

type NotificationStub = {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
};

function stubNotification(permission: NotificationPermission) {
  const requestPermission = vi.fn(async () => permission);
  const stub: NotificationStub = { permission, requestPermission };
  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    writable: true,
    value: stub,
  });
  return requestPermission;
}

function stubServiceWorker(
  subscription: PushSubscription,
  existing: PushSubscription | null = null,
) {
  const subscribeMock = vi.fn(async () => subscription);
  const registration = {
    pushManager: {
      subscribe: subscribeMock,
      getSubscription: vi.fn(async () => existing),
    },
  };
  Object.defineProperty(globalThis.navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve(registration) },
  });
  // `PushManager` як глобал — використовується у `isPushSupported()`.
  Object.defineProperty(globalThis, "PushManager", {
    configurable: true,
    value: function PushManager() {},
  });
  return subscribeMock;
}

function makeWrapper(apiClient: ApiClient) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <ApiClientProvider client={apiClient}>{children}</ApiClientProvider>
      </QueryClientProvider>
    );
  };
}

type RegisterMock = ReturnType<
  typeof vi.fn<(payload: PushRegisterRequest) => Promise<PushRegisterResponse>>
>;
type UnregisterMock = ReturnType<
  typeof vi.fn<
    (payload: PushUnregisterRequest) => Promise<PushUnregisterResponse>
  >
>;

function makeRegisterMock(response: PushRegisterResponse): RegisterMock {
  return vi.fn<(payload: PushRegisterRequest) => Promise<PushRegisterResponse>>(
    async () => response,
  );
}

function makeUnregisterMock(response: PushUnregisterResponse): UnregisterMock {
  return vi.fn<
    (payload: PushUnregisterRequest) => Promise<PushUnregisterResponse>
  >(async () => response);
}

function makeApiClientWithMocks(
  registerMock: RegisterMock,
  unregisterMock: UnregisterMock = makeUnregisterMock({
    ok: true,
    platform: "web",
  }),
) {
  return {
    push: {
      register: registerMock,
      unregister: unregisterMock,
      getVapidPublic: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    },
  } as unknown as ApiClient;
}

describe("usePushNotifications — subscribe via api.push.register", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    getVapidPublicMock.mockResolvedValue({ publicKey: "AAAA" });
    legacyUnsubscribeMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("викликає api.push.register з web-payload `{ platform, token, keys }`", async () => {
    stubNotification("granted");
    const subscription = makeMockPushSubscription({
      endpoint: "https://fcm.googleapis.com/wp/abc123",
      p256dh: "p256dh-key",
      auth: "auth-key",
    });
    stubServiceWorker(subscription);

    const registerMock = makeRegisterMock({ ok: true, platform: "web" });
    const apiClient = makeApiClientWithMocks(registerMock);

    const { result } = renderHook(() => usePushNotifications(), {
      wrapper: makeWrapper(apiClient),
    });

    await act(async () => {
      await result.current.subscribe();
    });

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledTimes(1);
    });

    const payload = registerMock.mock.calls[0][0];
    expect(payload).toEqual({
      platform: "web",
      token: "https://fcm.googleapis.com/wp/abc123",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    });
    // Payload має задовольняти runtime-схему з `@sergeant/api-client`,
    // щоб зміни у shared-схемі ламали саме цей юніт, а не далеко у
    // httpClient-і.
    expect(() => PushRegisterRequestSchema.parse(payload)).not.toThrow();
    expect(localStorage.getItem("hub_push_subscribed")).toBe("1");
    expect(result.current.subscribed).toBe(true);
  });

  it("не викликає register, якщо permission НЕ granted", async () => {
    stubNotification("denied");
    const subscription = makeMockPushSubscription({
      endpoint: "https://example/e",
      p256dh: "p",
      auth: "a",
    });
    stubServiceWorker(subscription);

    const registerMock = makeRegisterMock({ ok: true, platform: "web" });
    const apiClient = makeApiClientWithMocks(registerMock);

    const { result } = renderHook(() => usePushNotifications(), {
      wrapper: makeWrapper(apiClient),
    });

    await act(async () => {
      await result.current.subscribe();
    });

    expect(registerMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("hub_push_subscribed")).toBeNull();
  });
});

describe("usePushNotifications — unsubscribe via api.push.unregister", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    getVapidPublicMock.mockResolvedValue({ publicKey: "AAAA" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("викликає api.push.unregister з `{ platform: 'web', endpoint }` і не чіпає legacy pushApi.unsubscribe", async () => {
    // При `unsubscribe()` хук має піти в уніфікований `/api/v1/push/unregister`
    // через `api.push.unregister`, а не у legacy DELETE `/api/push/subscribe`.
    const existing = makeMockPushSubscription({
      endpoint: "https://fcm.googleapis.com/wp/abc123",
      p256dh: "p256dh-key",
      auth: "auth-key",
    });
    stubServiceWorker(existing, existing);

    const registerMock = makeRegisterMock({ ok: true, platform: "web" });
    const unregisterMock = makeUnregisterMock({ ok: true, platform: "web" });
    const apiClient = makeApiClientWithMocks(registerMock, unregisterMock);

    localStorage.setItem("hub_push_subscribed", "1");

    const { result } = renderHook(() => usePushNotifications(), {
      wrapper: makeWrapper(apiClient),
    });

    await act(async () => {
      await result.current.unsubscribe();
    });

    await waitFor(() => {
      expect(unregisterMock).toHaveBeenCalledTimes(1);
    });

    const payload = unregisterMock.mock.calls[0][0];
    expect(payload).toEqual({
      platform: "web",
      endpoint: "https://fcm.googleapis.com/wp/abc123",
    });
    // Payload — валідний web-варіант discriminated union з shared.
    expect(() => PushUnregisterRequestSchema.parse(payload)).not.toThrow();
    // Legacy шлях (`pushApi.unsubscribe` → DELETE `/api/push/subscribe`)
    // не має смикатись: session-4c забороняє direct-виклики legacy у web.
    expect(legacyUnsubscribeMock).not.toHaveBeenCalled();
    expect(localStorage.getItem("hub_push_subscribed")).toBeNull();
    expect(result.current.subscribed).toBe(false);
  });

  it("без активної підписки у браузері — не викликає api.push.unregister", async () => {
    // `pushManager.getSubscription()` повертає null (юзер ще не підписувався).
    // У такому випадку немає `endpoint`, тож і серверу нічого чистити.
    const placeholder = makeMockPushSubscription({
      endpoint: "https://example/e",
      p256dh: "p",
      auth: "a",
    });
    stubServiceWorker(placeholder, null);

    const registerMock = makeRegisterMock({ ok: true, platform: "web" });
    const unregisterMock = makeUnregisterMock({ ok: true, platform: "web" });
    const apiClient = makeApiClientWithMocks(registerMock, unregisterMock);

    localStorage.setItem("hub_push_subscribed", "1");

    const { result } = renderHook(() => usePushNotifications(), {
      wrapper: makeWrapper(apiClient),
    });

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(unregisterMock).not.toHaveBeenCalled();
    // Локальний стан все одно чиститься, щоб UI не лишився «увімкненим».
    expect(localStorage.getItem("hub_push_subscribed")).toBeNull();
    expect(result.current.subscribed).toBe(false);
  });
});
