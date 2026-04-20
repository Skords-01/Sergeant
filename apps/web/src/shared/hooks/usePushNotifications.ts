import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApiClient } from "@sergeant/api-client/react";
import type { PushRegisterRequest } from "@sergeant/api-client";
import { isApiError, pushApi } from "@shared/api";
import { pushKeys } from "@shared/lib/queryKeys";

const PUSH_SUB_KEY = "hub_push_subscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export interface UsePushNotificationsResult {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  loading: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

// Ключ `pushKeys.vapid` — сервер не ротує VAPID public key, тож кешуємо
// назавжди (Infinity/Infinity). Зайвий мережевий похід перед кожним
// натисканням "увімкнути сповіщення" був помітний на слабкому 3G.

/**
 * Хук для управління Web Push підпискою.
 *
 * Мутації (subscribe/unsubscribe) йдуть через `useMutation`, щоб:
 *  - `isPending` замінив рукописний `loading`-стейт;
 *  - `onError` централізовано логував помилку без try/finally-шуму;
 *  - інвалідація `pushKeys.status` після successful підписки дозволяла
 *    іншим місцям (напр., налаштування модулів) спостерігати стан без
 *    CustomEvent-ів.
 *
 * Локальна `subscribed`-мітка в localStorage — оптимістичний кеш для
 * першого рендеру, щоб UI не мерехтів між "не підписано" і "підписано".
 */
export function usePushNotifications(): UsePushNotificationsResult {
  const supported = isPushSupported();
  const queryClient = useQueryClient();
  const api = useApiClient();

  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : "denied",
  );
  const [subscribed, setSubscribed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PUSH_SUB_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission);
  }, [supported]);

  // Prefetch VAPID на маунт — коли користувач натисне "увімкнути",
  // ключ вже буде в кеші й ми одразу підемо у pushManager.subscribe.
  const vapidQuery = useQuery({
    queryKey: pushKeys.vapid,
    queryFn: () => pushApi.getVapidPublic(),
    enabled: supported,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const subscribeMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!supported) return;

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const vapid =
        vapidQuery.data ??
        (await queryClient.fetchQuery({
          queryKey: pushKeys.vapid,
          queryFn: () => pushApi.getVapidPublic(),
          staleTime: Infinity,
          gcTime: Infinity,
        }));
      const publicKey = vapid?.publicKey;
      if (!publicKey) throw new Error("VAPID not configured");

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // `PushSubscription.toJSON()` повертає `{ endpoint, keys: { p256dh, auth } }`
      // (RFC 8030). Мапимо у web-варіант `PushRegisterRequest`, щоб
      // zod-валідація у `createPushEndpoints.register` пройшла без
      // модифікацій payload.
      const json = sub.toJSON();
      const endpoint = json.endpoint;
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!endpoint || !p256dh || !auth) {
        throw new Error("Push subscription is missing endpoint or keys");
      }
      const payload: PushRegisterRequest = {
        platform: "web",
        token: endpoint,
        keys: { p256dh, auth },
      };
      await api.push.register(payload);

      localStorage.setItem(PUSH_SUB_KEY, "1");
      setSubscribed(true);
      queryClient.invalidateQueries({ queryKey: pushKeys.status });
    },
    onError: (e) => {
      const message = isApiError(e)
        ? e.serverMessage || `Server error ${e.status}`
        : (e as Error).message;
      console.warn("[push] subscribe failed:", message);
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!supported) return;

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        // Серверний DELETE є best-effort: якщо сервер недоступний, локально
        // ми все одно розписалися — запис у БД зачистить cron або наступна
        // вдала підписка.
        await pushApi.unsubscribe(endpoint).catch(() => {});
      }
      localStorage.removeItem(PUSH_SUB_KEY);
      setSubscribed(false);
      queryClient.invalidateQueries({ queryKey: pushKeys.status });
    },
    onError: (e) => {
      const message = isApiError(e)
        ? e.serverMessage || `Server error ${e.status}`
        : (e as Error).message;
      console.warn("[push] unsubscribe failed:", message);
    },
  });

  const subscribe = useCallback(async (): Promise<void> => {
    if (subscribeMutation.isPending || unsubscribeMutation.isPending) return;
    await subscribeMutation.mutateAsync();
  }, [subscribeMutation, unsubscribeMutation.isPending]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (subscribeMutation.isPending || unsubscribeMutation.isPending) return;
    await unsubscribeMutation.mutateAsync();
  }, [subscribeMutation.isPending, unsubscribeMutation]);

  return {
    supported,
    permission,
    subscribed,
    loading: subscribeMutation.isPending || unsubscribeMutation.isPending,
    subscribe,
    unsubscribe,
  };
}
