import { useCallback, useEffect, useState } from "react";

const IOS_BANNER_DISMISSED_KEY = "ios_install_banner_dismissed";

export function useIosInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(IOS_BANNER_DISMISSED_KEY) === "1") return;
    } catch {
      /* noop */
    }
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (isIOS && !isStandalone) {
      const timer = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(IOS_BANNER_DISMISSED_KEY, "1");
    } catch {
      /* noop */
    }
    setVisible(false);
  }, []);

  return { visible, dismiss };
}
