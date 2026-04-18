import { useCallback, useEffect, useRef, useState } from "react";

const PWA_SESSIONS_KEY = "pwa_session_count";
const PWA_DISMISSED_KEY = "pwa_install_dismissed";
const INSTALL_DELAY_MS = 30000;
const MIN_SESSIONS = 2;

export function usePwaInstall() {
  const [prompt, setPrompt] = useState(null);
  const [ready, setReady] = useState(false);
  const deferredRef = useRef(null);

  useEffect(() => {
    try {
      const count =
        parseInt(localStorage.getItem(PWA_SESSIONS_KEY) || "0", 10) + 1;
      localStorage.setItem(PWA_SESSIONS_KEY, String(count));
    } catch {
      /* noop */
    }

    const handler = (e) => {
      e.preventDefault();
      deferredRef.current = e;
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!prompt) return;
    try {
      if (localStorage.getItem(PWA_DISMISSED_KEY) === "1") return;
    } catch {
      /* noop */
    }

    let sessions = 1;
    try {
      sessions = parseInt(localStorage.getItem(PWA_SESSIONS_KEY) || "1", 10);
    } catch {
      /* noop */
    }

    if (sessions >= MIN_SESSIONS) {
      const timer = setTimeout(() => setReady(true), INSTALL_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [prompt]);

  const install = useCallback(async () => {
    const p = deferredRef.current;
    if (!p) return;
    p.prompt();
    const { outcome } = await p.userChoice;
    if (outcome === "accepted") {
      deferredRef.current = null;
      setPrompt(null);
      setReady(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(PWA_DISMISSED_KEY, "1");
    } catch {
      /* noop */
    }
    setReady(false);
    setPrompt(null);
  }, []);

  return { canInstall: !!prompt && ready, install, dismiss };
}
