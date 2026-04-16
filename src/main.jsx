import React from "react";
import ReactDOM from "react-dom/client";
import App from "./core/App";
import "./index.css";
import { storageManager } from "@shared/lib/storageManager.js";

storageManager.runAll();

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(e) {
    return { error: e };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-8 font-sans">
          <h2 className="text-lg font-semibold text-text">Щось пішло не так</h2>
          <pre className="text-xs text-danger whitespace-pre-wrap mt-2">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-xl border border-line bg-panel text-sm font-medium text-text"
          >
            Перезавантажити
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
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
