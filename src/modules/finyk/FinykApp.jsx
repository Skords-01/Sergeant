import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useMonobank } from "./hooks/useMonobank";
import { useStorage } from "./hooks/useStorage";
import { PAGES } from "./constants";
import { Button } from "./components/ui/Button";
import { Input } from "./components/ui/Input";
import { SyncModal } from "./components/SyncModal";
import { Skeleton } from "./components/ui/Skeleton";
import { cn } from "./lib/cn";

const Overview       = lazy(() => import("./pages/Overview").then(m => ({ default: m.Overview })));
const Transactions   = lazy(() => import("./pages/Transactions").then(m => ({ default: m.Transactions })));
const Budgets        = lazy(() => import("./pages/Budgets").then(m => ({ default: m.Budgets })));
const Assets         = lazy(() => import("./pages/Assets").then(m => ({ default: m.Assets })));
const Settings       = lazy(() => import("./pages/Settings").then(m => ({ default: m.Settings })));

function PageLoader() {
  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-3 max-w-2xl mx-auto w-full">
      <Skeleton className="h-40" />
      <Skeleton className="h-28 opacity-80" />
      <Skeleton className="h-24 opacity-60" />
    </div>
  );
}

const NAV_ICONS = {
  overview: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
    </svg>
  ),
  transactions: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="1"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
      <line x1="9" y1="16" x2="13" y2="16"/>
    </svg>
  ),
  budgets: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  assets: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  ),
  settings: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  ),
};

const NAV_ITEMS = [
  { id: "overview",     label: "Огляд" },
  { id: "transactions", label: "Операції" },
  { id: "budgets",      label: "Планування" },
  { id: "assets",       label: "Активи" },
  { id: "settings",     label: "Налаш." },
];
const NAV_IDS = NAV_ITEMS.map(n => n.id);

const ALL_PAGE_IDS = [...PAGES.map(p => p.id), "settings"];

function useHashRouter(defaultPage = "overview") {
  const getPage = () => {
    let p = window.location.hash.replace("#/", "") || defaultPage;
    if (p === "payments") p = "budgets";
    return p;
  };
  const [page, setPageState] = useState(getPage);
  useEffect(() => {
    const handler = () => setPageState(getPage());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  const navigate = (p) => { window.location.hash = `/${p}`; };
  return [ALL_PAGE_IDS.includes(page) ? page : defaultPage, navigate];
}

export default function App() {
  const mono = useMonobank();
  const storage = useStorage();
  const [page, navigate] = useHashRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (window.location.search.includes("sync=")) {
      const ok = storage.loadFromUrl();
      if (ok) showToast("✅ Налаштування синхронізовано!");
      else showToast("❌ Не вдалось завантажити синк-дані", "error");
    }
  }, []);

  useEffect(() => {
    if (window.location.hash === "#/payments") {
      window.history.replaceState(null, "", `${window.location.pathname}#/budgets`);
    }
  }, []);

  const { clientInfo, connecting, error, connect, disconnect } = mono;
  const handleNavigate = (p) => { navigate(p); setMenuOpen(false); };

  // Swipe + pull-to-refresh
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const contentRef = useRef(null);
  const [pullDist, setPullDist] = useState(0);
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e) => {
    if (touchStartY.current === null) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    const dx = e.touches[0].clientX - touchStartX.current;
    const scrollTop = contentRef.current?.scrollTop ?? 1;
    if (dy > 0 && scrollTop <= 0 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      setPullDist(Math.min(dy * 0.5, 64));
    }
  };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = touchStartY.current - e.changedTouches[0].clientY;

    if (pullDist >= 52 && !pullRefreshing) {
      setPullRefreshing(true);
      mono.refresh().finally(() => { setPullRefreshing(false); setPullDist(0); });
    } else {
      setPullDist(0);
    }
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
    const curIdx = NAV_IDS.indexOf(page);
    if (curIdx === -1) return;
    const next = curIdx + (dx > 0 ? 1 : -1);
    if (next >= 0 && next < NAV_IDS.length) navigate(NAV_IDS[next]);
  };

  // ── Login screen ──────────────────────────────────────────────────────
  if (!clientInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-5 bg-bg">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="text-[28px] font-semibold tracking-wide text-text mb-1">ФІНІК</div>
            <div className="text-sm text-subtle">Персональний фінансист</div>
          </div>

          <div className="bg-panel border border-line rounded-3xl p-6 shadow-card">
            <div className="text-xs text-subtle mb-1">Mono → Налаштування → Інші → API</div>
            <div className="relative mt-3">
              <Input
                className="pr-20"
                type={showToken ? "text" : "password"}
                placeholder="Вставте токен Mono API"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && connect(tokenInput.trim())}
              />
              <Button type="button" size="sm" variant="ghost"
                className="absolute right-10 top-1/2 -translate-y-1/2 h-7 w-7 p-0 border-0"
                onClick={async () => {
                  try { setTokenInput((await navigator.clipboard.readText()).trim()); }
                  catch { alert("Не вдалось прочитати буфер."); }
                }}
              >📋</Button>
              <Button type="button" size="sm" variant="ghost"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 p-0 border-0"
                onClick={() => setShowToken(v => !v)}
              >{showToken ? "🙈" : "👁"}</Button>
            </div>

            {error && (
              <p className="mt-3 text-sm text-danger bg-danger/10 rounded-xl px-3 py-2">{error}</p>
            )}

            <Button className="mt-4 w-full h-12 text-base" onClick={() => connect(tokenInput.trim())} disabled={connecting}>
              {connecting ? "Підключення..." : "Підключити →"}
            </Button>
            <p className="mt-3 text-center text-xs text-subtle">🔒 Токен зберігається лише у твоєму браузері</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main app ──────────────────────────────────────────────────────────
  return (
    <div className="h-dvh flex flex-col bg-bg text-text overflow-hidden">

      {/* Header */}
      <div className="shrink-0 bg-panel/95 backdrop-blur-md border-b border-line/60 z-20" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="flex h-14 items-center justify-between px-5">
          <span className="text-[16px] font-semibold tracking-wide text-text">ФІНІК</span>
          <button
            onClick={() => setMenuOpen(true)}
            className="w-11 h-11 -mr-1.5 flex items-center justify-center text-subtle hover:text-text transition-colors"
          >
            <svg width="18" height="13" viewBox="0 0 18 13" fill="none">
              <rect width="18" height="1.6" rx="0.8" fill="currentColor"/>
              <rect y="5.7" width="12" height="1.6" rx="0.8" fill="currentColor"/>
              <rect y="11.4" width="7" height="1.6" rx="0.8" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Slide-in menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="absolute right-0 top-0 h-full w-[280px] bg-panel border-l border-line shadow-soft flex flex-col"
            onClick={e => e.stopPropagation()}
            style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="px-5 py-4 border-b border-line">
              <div className="text-sm font-semibold text-text">
                {clientInfo?.name || "ФІНІК"}
              </div>
              <div className="text-xs text-subtle mt-0.5">Особистий фінансист</div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {[...PAGES, { id: "settings", label: "Налаштування" }].map(p => {
                const icon = NAV_ICONS[p.id];
                return (
                  <button
                    key={p.id}
                    onClick={() => handleNavigate(p.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-colors",
                      page === p.id
                        ? "bg-text/6 text-text"
                        : "text-muted hover:bg-panelHi hover:text-text"
                    )}
                  >
                    {icon
                      ? <span className="w-5 h-5 flex items-center justify-center opacity-80">{icon}</span>
                      : <span className="w-5 h-5 flex items-center justify-center text-base leading-none">{p.label.split(" ")[0]}</span>
                    }
                    <span>{p.id === "settings" ? "Налаштування" : p.label.replace(/^[^\s]+\s/, "")}</span>
                  </button>
                );
              })}
            </div>
            <div className="p-3 border-t border-line">
              <button
                onClick={disconnect}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm text-danger hover:bg-danger/10 transition-colors"
              >
                <span className="text-xl">🚪</span>
                <span>Вийти</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl text-sm font-semibold shadow-soft transition-all",
          toast.type === "error" ? "bg-danger/90 text-white" : "bg-success/90 text-white"
        )}>
          {toast.msg}
        </div>
      )}

      {/* Sync modal */}
      {syncOpen && <SyncModal storage={storage} onClose={() => setSyncOpen(false)} />}

      {/* Pull-to-refresh indicator */}
      {(pullDist > 0 || pullRefreshing) && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-30 flex items-center justify-center transition-all"
          style={{ top: `calc(56px + env(safe-area-inset-top, 0px) + ${pullDist}px - 28px)` }}
        >
          <div className={cn(
            "w-8 h-8 rounded-full bg-panel border border-line shadow-card flex items-center justify-center text-sm transition-transform",
            pullRefreshing ? "animate-spin" : ""
          )}>
            {pullRefreshing ? "⟳" : pullDist >= 52 ? "↑" : "↓"}
          </div>
        </div>
      )}

      {/* Page content */}
      <div
        ref={contentRef}
        className="flex-1 overflow-hidden flex flex-col"
        style={{ transform: pullDist > 0 ? `translateY(${pullDist}px)` : undefined, transition: pullDist === 0 ? "transform 0.2s" : undefined }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Suspense fallback={<PageLoader />}>
          {page === "overview"     && <Overview      mono={mono} storage={storage} onNavigate={handleNavigate} />}
          {page === "transactions" && <Transactions  mono={mono} storage={storage} />}
          {page === "budgets"      && <Budgets       mono={mono} storage={storage} />}
          {page === "assets"       && <Assets        mono={mono} storage={storage} />}
          {page === "settings"     && <Settings      mono={mono} storage={storage} />}
        </Suspense>
      </div>

      {/* Bottom navigation */}
      <nav
        className="shrink-0 bg-panel/95 backdrop-blur-md border-t border-line/60"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex h-[58px]">
          {NAV_ITEMS.map(item => {
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 transition-all",
                  active ? "text-text" : "text-muted"
                )}
              >
                {NAV_ICONS[item.id]}
                <span className={cn(
                  "text-[11px] leading-none font-semibold",
                  active ? "text-text" : "text-muted"
                )}>
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
