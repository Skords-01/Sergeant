import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./core/App";
import "./index.css";
import { storageManager } from "@shared/lib/storageManager.js";
import { initSentry, Sentry } from "./core/sentry.js";

initSentry();
storageManager.runAll();

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
  <Sentry.ErrorBoundary fallback={ErrorFallback}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </Sentry.ErrorBoundary>,
);

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
