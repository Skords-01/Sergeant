import { useCallback, useEffect, useState } from "react";
import { useToast } from "@shared/hooks/useToast";

declare global {
  interface Window {
    __pwaUpdateSW?: (reloadPage?: boolean) => void;
    __pwaUpdateReady?: boolean;
  }
}

const AUTO_UPDATE_DELAY_MS = 4_000;

export function useSWUpdate() {
  const toast = useToast();
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const applyUpdate = useCallback(() => {
    if (typeof window.__pwaUpdateSW === "function") {
      window.__pwaUpdateSW(true);
    } else {
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleUpdate = () => {
      setUpdateAvailable(true);
      toast.info("Нова версія — оновлюємо автоматично…", AUTO_UPDATE_DELAY_MS);
      timer = setTimeout(applyUpdate, AUTO_UPDATE_DELAY_MS);
    };

    const onOffline = () => {
      toast.success("Додаток готовий до роботи офлайн", 4000);
    };

    if (window.__pwaUpdateReady) scheduleUpdate();
    window.addEventListener("pwa-update-ready", scheduleUpdate);
    window.addEventListener("pwa-offline-ready", onOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pwa-update-ready", scheduleUpdate);
      window.removeEventListener("pwa-offline-ready", onOffline);
    };
  }, [toast, applyUpdate]);

  return { updateAvailable, applyUpdate };
}
