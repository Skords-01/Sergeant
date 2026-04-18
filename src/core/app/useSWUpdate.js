import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@shared/hooks/useToast";

export function useSWUpdate() {
  const toast = useToast();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const toastShownRef = useRef(false);

  const applyUpdate = useCallback(() => {
    if (typeof window.__pwaUpdateSW === "function") {
      window.__pwaUpdateSW(true);
    } else {
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    const showUpdateToast = () => {
      if (toastShownRef.current) return;
      toastShownRef.current = true;
      toast.info("Доступна нова версія", 15000, {
        label: "Оновити",
        onClick: applyUpdate,
      });
    };

    const onUpdate = () => {
      setUpdateAvailable(true);
      showUpdateToast();
    };
    const onOffline = () => {
      toast.success("Додаток готовий до роботи офлайн", 4000);
    };
    if (window.__pwaUpdateReady) {
      setUpdateAvailable(true);
      showUpdateToast();
    }
    window.addEventListener("pwa-update-ready", onUpdate);
    window.addEventListener("pwa-offline-ready", onOffline);
    return () => {
      window.removeEventListener("pwa-update-ready", onUpdate);
      window.removeEventListener("pwa-offline-ready", onOffline);
    };
  }, [toast, applyUpdate]);

  return { updateAvailable, applyUpdate };
}
