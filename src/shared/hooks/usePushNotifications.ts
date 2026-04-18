import { useState, useEffect, useCallback } from "react";
import { pushApi, isApiError } from "@shared/api";

const PUSH_SUB_KEY = "hub_push_subscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) out[i] = rawData.charCodeAt(i);
  return out;
}

export interface UsePushNotificationsResult {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  loading: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

/**
 * Хук для управління Web Push підпискою.
 */
export function usePushNotifications(): UsePushNotificationsResult {
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

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
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission);
  }, [supported]);

  const subscribe = useCallback(async (): Promise<void> => {
    if (!supported || loading) return;
    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      let publicKey: string;
      try {
        publicKey = (await pushApi.getVapidPublic()).publicKey;
      } catch {
        throw new Error("VAPID not configured");
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await pushApi.subscribe(sub.toJSON());

      localStorage.setItem(PUSH_SUB_KEY, "1");
      setSubscribed(true);
    } catch (e) {
      const message = isApiError(e)
        ? e.serverMessage || `Server error ${e.status}`
        : (e as Error).message;
      console.warn("[push] subscribe failed:", message);
    } finally {
      setLoading(false);
    }
  }, [supported, loading]);

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!supported || loading) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await pushApi.unsubscribe(endpoint).catch(() => {});
      }
      localStorage.removeItem(PUSH_SUB_KEY);
      setSubscribed(false);
    } catch (e) {
      console.warn("[push] unsubscribe failed:", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [supported, loading]);

  return { supported, permission, subscribed, loading, subscribe, unsubscribe };
}
