import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isCapacitor } from "@sergeant/shared";

/**
 * Bridge-компонент, який звʼязує Capacitor-shell і React Router через
 * namespaced window-ключі — без compile-time залежності веб-бандла на
 * `@capacitor/*`. Після маунту роутера виставляє
 * `window.__sergeantShellNavigate` (shell використовує його у
 * `appUrlOpen` handler) і прогає буферизовані deep-link шляхи, що
 * прилетіли ДО маунту (cold start через `com.sergeant.shell://…`
 * URL → Capacitor вже встиг пушнути path у
 * `window.__sergeantShellDeepLinkQueue`, але React Router тоді ще не
 * існував).
 *
 * У браузері рендер no-op: guard `isCapacitor()` скіпає install-логіку,
 * і всі window-ключі лишаються `undefined`. Компонент повертає `null`
 * незалежно від плаформи — він лише для side-effect-ів ефекту.
 *
 * Маунтиться ВСЕРЕДИНІ `<BrowserRouter>`, інакше `useNavigate()` кине
 * «useNavigate() may be used only in the context of a <Router>».
 */

type DeepLinkBridgeWindow = Window & {
  __sergeantShellNavigate?: (path: string) => void;
  __sergeantShellDeepLinkQueue?: string[];
};

export function ShellDeepLinkBridge(): null {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isCapacitor()) return;
    if (typeof window === "undefined") return;
    const w = window as DeepLinkBridgeWindow;

    const handler = (path: string): void => {
      navigate(path);
    };
    w.__sergeantShellNavigate = handler;

    // Drain-имо буфер cold-start шляхів одразу після install-у. Масив
    // міг бути заповнений shell-ем у вікні між `initNativeShell()` і
    // першим ефектом React-дерева — типовий сценарій при запуску апки
    // через `com.sergeant.shell://<path>`.
    const queue = w.__sergeantShellDeepLinkQueue;
    if (Array.isArray(queue) && queue.length > 0) {
      const pending = queue.splice(0, queue.length);
      for (const path of pending) {
        try {
          navigate(path);
        } catch (err) {
          console.warn("[shell-deep-link] flush navigate failed", err);
        }
      }
    }

    return () => {
      // Чистимо саме наш handler — якщо хтось інший перевстановив
      // bridge (наприклад, HMR-перезапуск ефекту), не витираємо новіший.
      if (w.__sergeantShellNavigate === handler) {
        delete w.__sergeantShellNavigate;
      }
    };
  }, [navigate]);

  return null;
}
