import { useState, useEffect, useRef, useCallback } from "react";
import { useMonobank } from "./hooks/useMonobank";
import { useStorage } from "./hooks/useStorage";
import { PAGES } from "./constants";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import { cn } from "@shared/lib/cn";
import { Overview } from "./pages/Overview.jsx";
import { Transactions } from "./pages/Transactions.jsx";
import { Budgets } from "./pages/Budgets.jsx";
import { Assets } from "./pages/Assets.jsx";
import { Settings } from "./pages/Settings.jsx";

const NAV_ICONS = {
  overview: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  transactions: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  ),
  budgets: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  assets: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  settings: (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { id: "overview", label: "Огляд" },
  { id: "transactions", label: "Операції" },
  { id: "budgets", label: "Планування" },
  { id: "assets", label: "Активи" },
  { id: "settings", label: "Налаш." },
];
const NAV_IDS = NAV_ITEMS.map((n) => n.id);

const ALL_PAGE_IDS = [...PAGES.map((p) => p.id), "settings"];

function FinykToast({ toast }) {
  if (!toast) return null;
  return (
    <div
      className={cn(
        "fixed top-20 left-1/2 -translate-x-1/2 z-[110] px-4 py-3 rounded-2xl text-sm font-semibold shadow-float",
        "animate-in fade-in slide-in-from-top-2 duration-200",
        toast.type === "error"
          ? "bg-danger text-white"
          : "bg-success text-white",
      )}
      role="status"
      aria-live="polite"
    >
      {toast.msg}
    </div>
  );
}

function useHashRouter(defaultPage = "overview") {
  const getPage = useCallback(() => {
    let p = window.location.hash.replace("#/", "") || defaultPage;
    if (p === "payments") p = "budgets";
    return p;
  }, [defaultPage]);
  const [page, setPageState] = useState(getPage);
  useEffect(() => {
    const handler = () => setPageState(getPage());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [getPage]);
  const navigate = (p) => {
    window.location.hash = `/${p}`;
  };
  return [ALL_PAGE_IDS.includes(page) ? page : defaultPage, navigate];
}

export default function App({ onBackToHub } = {}) {
  const mono = useMonobank();
  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);
  const storage = useStorage({ onImportFeedback: showToast });
  const [page, navigate] = useHashRouter();
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [showBalance, setShowBalance] = useState(() => {
    try {
      return localStorage.getItem("finyk_show_balance_v1") !== "0";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("finyk_show_balance_v1", showBalance ? "1" : "0");
    } catch {}
  }, [showBalance]);

  useEffect(() => {
    if (window.location.search.includes("sync=")) {
      const ok = storage.loadFromUrl();
      if (ok) showToast("✅ Налаштування синхронізовано!");
      else showToast("❌ Не вдалось завантажити синк-дані", "error");
    }
    // Одноразово при монтуванні: ?sync= у URL
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storage/showToast не повинні перезапускати імпорт з URL
  }, []);

  useEffect(() => {
    if (window.location.hash === "#/payments") {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}#/budgets`,
      );
    }
  }, []);

  const { clientInfo, connecting, error, connect } = mono;
  const syncTone =
    mono?.syncState?.status === "error"
      ? { dot: "bg-danger", text: "помилка" }
      : mono?.syncState?.status === "partial"
        ? { dot: "bg-warning", text: "частково" }
        : mono?.syncState?.status === "loading"
          ? { dot: "bg-muted", text: "оновлення" }
          : { dot: "bg-success", text: "ок" };

  // Свайп між вкладками (без pull-to-refresh: скрол живе всередині сторінок, зовнішній scrollTop завжди 0)
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(dx) < 100 || Math.abs(dy) > Math.abs(dx) * 0.85) return;
    const curIdx = NAV_IDS.indexOf(page);
    if (curIdx === -1) return;
    const next = curIdx + (dx > 0 ? 1 : -1);
    if (next >= 0 && next < NAV_IDS.length) navigate(NAV_IDS[next]);
  };

  // ── Login screen ──────────────────────────────────────────────────────
  if (!clientInfo) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-5 bg-bg safe-area-pt-pb">
        <FinykToast toast={toast} />
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto bg-emerald-500/12 rounded-3xl flex items-center justify-center mb-4 border border-emerald-500/15 shadow-card">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-emerald-600"
                aria-hidden
              >
                <rect x="3" y="8" width="18" height="12" rx="2" />
                <path d="M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
                <line x1="3" y1="12" x2="21" y2="12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-text">ФІНІК</h1>
            <p className="text-sm text-muted mt-1">
              Персональний фінансовий менеджер
            </p>
          </div>

          <div className="bg-panel border border-line rounded-3xl p-6 shadow-float">
            <label
              className="text-sm text-muted mb-2 block"
              htmlFor="finyk-mono-token"
            >
              API токен Monobank
            </label>
            <p className="text-xs text-subtle mb-2">
              Mono → Налаштування → Інші → API
            </p>
            <div className="relative mt-1">
              <Input
                id="finyk-mono-token"
                className="pr-20"
                type={showToken ? "text" : "password"}
                placeholder="Вставте токен Mono API"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && connect(tokenInput.trim())
                }
                autoComplete="off"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="absolute right-10 top-1/2 -translate-y-1/2 h-8 w-8 p-0 border-0"
                aria-label="Вставити з буфера обміну"
                title="Вставити з буфера"
                onClick={async () => {
                  try {
                    setTokenInput(
                      (await navigator.clipboard.readText()).trim(),
                    );
                  } catch {
                    showToast("Не вдалось прочитати буфер обміну", "error");
                  }
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 border-0"
                aria-label={showToken ? "Приховати токен" : "Показати токен"}
                onClick={() => setShowToken((v) => !v)}
              >
                {showToken ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </Button>
            </div>

            {error && (
              <p className="mt-3 text-sm text-danger bg-danger/10 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <Button
              className="mt-4 w-full h-12 min-h-[48px] text-base !bg-emerald-600 !text-white hover:!bg-emerald-700 border-0 shadow-md"
              onClick={() => connect(tokenInput.trim())}
              disabled={connecting}
            >
              {connecting ? "Підключення..." : "Підключити"}
            </Button>
            {typeof onBackToHub === "function" && (
              <Button
                type="button"
                variant="ghost"
                className="mt-2 w-full min-h-[44px]"
                onClick={onBackToHub}
              >
                ← Назад до хабу
              </Button>
            )}
            <p className="mt-4 text-center text-xs text-subtle flex items-center justify-center gap-1.5">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Токен зберігається лише у твоєму браузері
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────
  return (
    <div className="h-dvh flex flex-col bg-bg text-text overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-panel/95 backdrop-blur-md border-b border-line/60 z-40 relative safe-area-pt">
        <div className="flex h-14 items-center justify-between px-4 sm:px-5 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="shrink-0 w-9 h-9 rounded-xl bg-emerald-500/12 flex items-center justify-center text-emerald-600 border border-emerald-500/15"
              aria-hidden
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <div className="min-w-0">
              <span className="text-[16px] font-semibold tracking-wide text-text block leading-tight">
                ФІНІК
              </span>
              <span className="text-[10px] text-subtle font-medium hidden sm:block truncate">
                Monobank · бюджети
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-subtle select-none">
              <span className={cn("w-2 h-2 rounded-full", syncTone.dot)} />
              <span className="hidden sm:inline">{syncTone.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowBalance((v) => !v)}
              className="w-11 h-11 flex items-center justify-center rounded-xl text-subtle hover:text-text hover:bg-panelHi transition-colors"
              aria-label={showBalance ? "Приховати суми" : "Показати суми"}
              title={showBalance ? "Приховати суми" : "Показати суми"}
            >
              {showBalance ? (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      <FinykToast toast={toast} />

      {/* Page content */}
      <div
        className="flex-1 overflow-hidden flex flex-col min-h-0 touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {page === "overview" && (
          <Overview
            mono={mono}
            storage={storage}
            onNavigate={navigate}
            onCategoryClick={(catId) => {
              setCategoryFilter(catId);
              navigate("transactions");
            }}
            showBalance={showBalance}
          />
        )}
        {page === "transactions" && (
          <Transactions
            mono={mono}
            storage={storage}
            showBalance={showBalance}
            categoryFilter={categoryFilter}
            onClearCategoryFilter={() => setCategoryFilter(null)}
          />
        )}
        {page === "budgets" && <Budgets mono={mono} storage={storage} />}
        {page === "assets" && (
          <Assets mono={mono} storage={storage} showBalance={showBalance} />
        )}
        {page === "settings" && (
          <Settings mono={mono} storage={storage} showToast={showToast} />
        )}
      </div>

      {/* Bottom navigation */}
      <nav className="shrink-0 bg-panel/95 backdrop-blur-md border-t border-line/60 relative z-30 safe-area-pb">
        <div className="flex h-[58px]">
          {NAV_ITEMS.map((item) => {
            const active = page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={cn(
                  "relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-all min-h-[48px] focus:outline-none",
                  active ? "text-emerald-600" : "text-muted hover:text-text",
                )}
              >
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-full bg-emerald-500"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "flex items-center justify-center w-8 h-6 rounded-lg transition-colors",
                    active && "bg-emerald-500/12",
                  )}
                >
                  {NAV_ICONS[item.id]}
                </span>
                <span className="text-[10px] leading-none font-semibold">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
