import { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./core/App";
import "./index.css";
import { storageManager } from "@shared/lib/storageManager.js";
import { createAppQueryClient } from "@shared/lib/queryClient.js";
// Registers the web `navigator.vibrate`-based adapter on the shared
// haptic contract (`@sergeant/shared`). Import for side effects only.
import "@shared/lib/haptic";
import { ErrorBoundary } from "./core/ErrorBoundary.jsx";
import { initSentry } from "./core/sentry.js";
import { initWebVitals } from "./core/webVitals.js";
import { runDemoCleanupOnce } from "./core/onboarding/cleanupDemoData.js";

const queryClient = createAppQueryClient();

// react-query devtools are only useful in development. Lazy-importing keeps
// them out of the production bundle entirely — the tree-shaker can drop the
// import expression when `import.meta.env.DEV` is statically `false`.
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : null;

storageManager.runAll();
runDemoCleanupOnce();

function ErrorFallback({ error, resetError }) {
  return (
    <div className="p-8 font-sans">
      <h2 className="text-lg font-semibold text-text">Щось пішло не так</h2>
      <pre className="text-xs text-danger whitespace-pre-wrap mt-2">
        {error?.message}
      </pre>
      <button
        type="button"
        onClick={() => {
          resetError?.();
          window.location.reload();
        }}
        className="mt-4 px-4 py-2 rounded-xl border border-line bg-panel text-sm font-medium text-text"
      >
        Перезавантажити
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary fallback={ErrorFallback}>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      {ReactQueryDevtools ? (
        <Suspense fallback={null}>
          <ReactQueryDevtools
            initialIsOpen={false}
            buttonPosition="bottom-left"
          />
        </Suspense>
      ) : null}
    </QueryClientProvider>
  </ErrorBoundary>,
);

// Sentry init + web-vitals збір відкладаємо до після hydration — SDK Sentry
// (~30–40 KB gzip) і `web-vitals` (~1 KB gzip) не повинні блокувати TTI.
// До ініта Sentry `captureException` у локальному ErrorBoundary — no-op.
// Web-vitals слухачі мають бути на місці ДО першого hidden/pagehide, але
// `onLCP`/`onFCP` самі реєструють свої PerformanceObserver якомога раніше
// в межах тіку виклику, тож idle-timeout 2s прийнятний.
const scheduleInit = () => {
  void initSentry();
  void initWebVitals();
};
if (typeof window !== "undefined") {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(scheduleInit, { timeout: 2000 });
  } else {
    setTimeout(scheduleInit, 0);
  }
}

if ("serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => {
    const updateSW = registerSW({
      onNeedRefresh() {
        window.__pwaUpdateReady = true;
        window.__pwaUpdateSW = updateSW;
        window.dispatchEvent(new CustomEvent("pwa-update-ready"));
      },
      onOfflineReady() {
        window.dispatchEvent(new CustomEvent("pwa-offline-ready"));
      },
    });
  });
}
