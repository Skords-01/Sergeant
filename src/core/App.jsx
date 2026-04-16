import { useState, useCallback, lazy, Suspense, useEffect, useRef } from "react";
import { cn } from "@shared/lib/cn";
import ModuleErrorBoundary from "./ModuleErrorBoundary";
import { HubBackupPanel } from "./HubBackupPanel.jsx";
import { useDarkMode } from "@shared/hooks/useDarkMode";
import { ToastProvider, useToast } from "@shared/hooks/useToast";
import { ToastContainer } from "@shared/components/ui/Toast";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import { useCloudSync } from "./useCloudSync.js";
import { HubDashboard } from "./HubDashboard.jsx";
import { HubReports } from "./HubReports.jsx";

const HubSearch = lazy(() => import("./HubSearch.jsx").then((m) => ({ default: m.HubSearch })));

/** Detects online/offline state and shows a banner when offline */
function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function OfflineBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-center gap-2 px-4 py-2 bg-warning text-white text-xs font-semibold safe-area-pt shadow-soft"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
      </svg>
      Немає підключення до інтернету
    </div>
  );
}

import RoutineApp from "../modules/routine/RoutineApp.jsx";

const HubChat = lazy(() => import("./HubChat"));

const FinykApp = lazy(() => import("../modules/finyk/FinykApp"));
const FizrukApp = lazy(() => import("../modules/fizruk/FizrukApp"));
const NutritionApp = lazy(() => import("../modules/nutrition/NutritionApp"));

const HUB_MODULE_KEY = "hub_last_module";
const HUB_MODULE_HASHES_KEY = "hub_module_hashes_v1";
const VALID_MODULES = new Set(["finyk", "fizruk", "routine", "nutrition"]);

function readModuleHashes() {
  try {
    const raw = localStorage.getItem(HUB_MODULE_HASHES_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function writeModuleHashes(next) {
  try {
    localStorage.setItem(HUB_MODULE_HASHES_KEY, JSON.stringify(next || {}));
  } catch {
    /* ignore */
  }
}

function persistLastHashForModule(moduleId, hash) {
  const id = String(moduleId || "").trim();
  if (!VALID_MODULES.has(id)) return;
  const h = String(hash || "").trim();
  if (!h || h === "#") return;
  const map = readModuleHashes();
  map[id] = h.startsWith("#") ? h : `#${h}`;
  writeModuleHashes(map);
}

function readLastHashForModule(moduleId) {
  const id = String(moduleId || "").trim();
  if (!VALID_MODULES.has(id)) return "";
  const map = readModuleHashes();
  const h = map?.[id];
  return typeof h === "string" ? h : "";
}

const VALID_ACTIONS = new Set(["add_expense", "start_workout", "add_meal"]);

function readInitialAction() {
  if (typeof window === "undefined") return null;
  try {
    const q = new URLSearchParams(window.location.search).get("action");
    if (VALID_ACTIONS.has(q)) return q;
  } catch {}
  return null;
}

function readInitialModule() {
  if (typeof window === "undefined") return null;
  try {
    const q = new URLSearchParams(window.location.search).get("module");
    if (VALID_MODULES.has(q)) return q;
  } catch {}
  try {
    const s = localStorage.getItem(HUB_MODULE_KEY);
    if (VALID_MODULES.has(s)) return s;
  } catch {}
  return null;
}

function persistModuleToUrlAndStorage(moduleId) {
  try {
    if (moduleId) localStorage.setItem(HUB_MODULE_KEY, moduleId);
    else localStorage.removeItem(HUB_MODULE_KEY);
  } catch {}
  try {
    const url = new URL(window.location.href);
    if (moduleId) url.searchParams.set("module", moduleId);
    else url.searchParams.delete("module");
    window.history.replaceState(null, "", url);
  } catch {}
}

/** Read a quick status badge from localStorage for each module (no imports, no deps). */
function readModuleStatus(id) {
  try {
    if (id === "finyk") {
      const raw = localStorage.getItem("finyk_info_cache");
      if (!raw) return null;
      const info = JSON.parse(raw);
      const accs = info?.accounts ?? [];
      if (!accs.length) return null;
      const total = accs.reduce((s, a) => s + (a.balance ?? 0), 0) / 100;
      return `${total.toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴`;
    }
    if (id === "fizruk") {
      const raw = localStorage.getItem("fizruk_workouts_v1");
      if (!raw) return null;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length === 0) return null;
      const thisWeek = arr.filter((w) => {
        if (!w.endedAt) return false;
        const d = new Date(w.startedAt);
        const now = new Date();
        const mon = new Date(now);
        mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        mon.setHours(0, 0, 0, 0);
        return d >= mon;
      });
      return `${thisWeek.length} трен. цього тижня`;
    }
    if (id === "routine") {
      const raw = localStorage.getItem("hub_routine_v1");
      if (!raw) return null;
      const state = JSON.parse(raw);
      const habits = state?.habits ?? [];
      const active = habits.filter((h) => !h.archived);
      if (!active.length) return null;
      const now = new Date();
      // dateKeyFromDate equivalent — local date
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const completions = state?.completions ?? {};
      // completions structure: { habitId: ["2026-04-13", ...] }
      const done = active.filter(
        (h) =>
          Array.isArray(completions[h.id]) && completions[h.id].includes(today),
      );
      return `${done.length}/${active.length} звичок`;
    }
  } catch {}
  return null;
}

const MODULES = [
  {
    id: "finyk",
    label: "ФІНІК",
    desc: "Особисті фінанси",
    gradient: "from-emerald-400/15 to-teal-400/10",
    iconClass:
      "bg-emerald-500/12 text-emerald-600 border border-emerald-500/15",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
  {
    id: "fizruk",
    label: "ФІЗРУК",
    desc: "Фітнес і тренування",
    gradient: "from-sky-400/15 to-indigo-400/10",
    iconClass: "bg-sky-500/12 text-sky-600 border border-sky-500/15",
    badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3" />
      </svg>
    ),
  },
  {
    id: "routine",
    label: "РУТИНА",
    desc: "Календар Hub, звички, план",
    gradient: "from-orange-400/15 to-rose-400/10",
    iconClass:
      "bg-routine-surface text-routine-strong border border-routine-line/60",
    badgeClass: "bg-routine-surface text-routine-strong",
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </svg>
    ),
  },
  {
    id: "nutrition",
    label: "ХАРЧУВАННЯ",
    desc: "Фото → КБЖВ · Рецепти · Поради",
    gradient: "from-lime-400/15 to-emerald-400/10",
    iconClass: "bg-lime-500/12 text-lime-700",
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 11c0 6 4 10 8 10s8-4 8-10" />
        <path d="M12 21V11" />
        <path d="M7 5c0 2 1 3 2 4M17 5c0 2-1 3-2 4" />
        <path d="M7 5c0-1 1-2 2-2s2 1 2 2c0 2-2 4-2 6" />
        <path d="M17 5c0-1-1-2-2-2s-2 1-2 2c0 2 2 4 2 6" />
      </svg>
    ),
  },
];

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-subtle text-sm animate-pulse">Завантаження...</div>
    </div>
  );
}

/** Sun/Moon icon toggle for dark mode */
function DarkModeToggle({ dark, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={dark ? "Увімкнути світлу тему" : "Увімкнути темну тему"}
      title={dark ? "Світла тема" : "Темна тема"}
      className="w-10 h-10 flex items-center justify-center rounded-2xl text-muted hover:text-text hover:bg-panelHi transition-colors"
    >
      {dark ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

const PWA_SESSIONS_KEY = "pwa_session_count";
const PWA_DISMISSED_KEY = "pwa_install_dismissed";
const INSTALL_DELAY_MS = 30000;
const MIN_SESSIONS = 2;

function usePwaInstall() {
  const [prompt, setPrompt] = useState(null);
  const [ready, setReady] = useState(false);
  const deferredRef = useRef(null);

  useEffect(() => {
    try {
      const count = parseInt(localStorage.getItem(PWA_SESSIONS_KEY) || "0", 10) + 1;
      localStorage.setItem(PWA_SESSIONS_KEY, String(count));
    } catch {}

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
    } catch {}

    let sessions = 1;
    try {
      sessions = parseInt(localStorage.getItem(PWA_SESSIONS_KEY) || "1", 10);
    } catch {}

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
    } catch {}
    setReady(false);
    setPrompt(null);
  }, []);

  return { canInstall: !!prompt && ready, install, dismiss };
}

function useSWUpdate() {
  const toast = useToast();
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const onUpdate = () => setUpdateAvailable(true);
    const onOffline = () => {
      toast.success("Додаток готовий до роботи офлайн", 4000);
    };
    if (window.__pwaUpdateReady) setUpdateAvailable(true);
    window.addEventListener("pwa-update-ready", onUpdate);
    window.addEventListener("pwa-offline-ready", onOffline);
    return () => {
      window.removeEventListener("pwa-update-ready", onUpdate);
      window.removeEventListener("pwa-offline-ready", onOffline);
    };
  }, [toast]);

  const applyUpdate = useCallback(() => {
    if (typeof window.__pwaUpdateSW === "function") {
      window.__pwaUpdateSW(true);
    } else {
      window.location.reload();
    }
  }, []);

  return { updateAvailable, applyUpdate };
}

const AuthPage = lazy(() =>
  import("./AuthPage.jsx").then((m) => ({ default: m.AuthPage })),
);

function UserMenuButton({ user, syncing, lastSync, onSync, onPull, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const initial = (user.name || user.email || "?")[0].toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Акаунт"
        title={user.email}
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded-2xl text-sm font-bold transition-colors",
          "bg-accent/15 text-accent hover:bg-accent/25",
          syncing && "animate-pulse",
        )}
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 bg-panel border border-line rounded-2xl shadow-float p-3 space-y-2">
          <div className="px-2 py-1">
            <p className="text-sm font-semibold text-text truncate">{user.name || "Користувач"}</p>
            <p className="text-xs text-muted truncate">{user.email}</p>
          </div>
          <div className="border-t border-line/60 pt-2 space-y-1">
            <button
              type="button"
              onClick={() => { onSync(); setOpen(false); }}
              disabled={syncing}
              className="w-full text-left px-3 py-2 rounded-xl text-sm text-text hover:bg-panelHi transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
              {syncing ? "Синхронізація..." : "Зберегти в хмару"}
            </button>
            <button
              type="button"
              onClick={() => { onPull(); setOpen(false); }}
              disabled={syncing}
              className="w-full text-left px-3 py-2 rounded-xl text-sm text-text hover:bg-panelHi transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="8 8 12 12 16 8" />
                <line x1="12" y1="3" x2="12" y2="12" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
              Завантажити з хмари
            </button>
            {lastSync && (
              <p className="px-3 text-[10px] text-muted">
                Остання синхр.: {lastSync.toLocaleTimeString("uk-UA")}
              </p>
            )}
          </div>
          <div className="border-t border-line/60 pt-2">
            <button
              type="button"
              onClick={() => { onLogout(); setOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-xl text-sm text-error hover:bg-error/10 transition-colors flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Вийти
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ToastContainer />
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ToastProvider>
  );
}

const PWA_ACTION_KEY = "pwa_pending_action";

function consumePwaAction() {
  try {
    const a = localStorage.getItem(PWA_ACTION_KEY);
    if (a) localStorage.removeItem(PWA_ACTION_KEY);
    return a || null;
  } catch {
    return null;
  }
}

function AppInner() {
  const [activeModule, setActiveModule] = useState(readInitialModule);
  const [chatOpen, setChatOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [hubView, setHubView] = useState("dashboard");
  const [searchOpen, setSearchOpen] = useState(false);
  const [pwaAction, setPwaAction] = useState(() => {
    const fromUrl = readInitialAction();
    if (fromUrl) {
      try { localStorage.setItem(PWA_ACTION_KEY, fromUrl); } catch {}
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("action");
        window.history.replaceState(null, "", url);
      } catch {}
      return fromUrl;
    }
    return consumePwaAction();
  });
  const clearPwaAction = useCallback(() => setPwaAction(null), []);
  const { dark, toggle: toggleDark } = useDarkMode();
  const { canInstall, install, dismiss } = usePwaInstall();
  const online = useOnlineStatus();
  const { updateAvailable, applyUpdate } = useSWUpdate();
  const { user, isLoading: authLoading, logout } = useAuth();
  const { syncing, lastSync, pushAll, pullAll, migrationPending, uploadLocalData, skipMigration } = useCloudSync(user);

  const goToHub = useCallback(() => {
    try {
      if (activeModule) {
        persistLastHashForModule(activeModule, window.location.hash);
      }
    } catch {
      /* ignore */
    }
    setActiveModule(null);
    persistModuleToUrlAndStorage(null);
    try {
      const url = new URL(window.location.href);
      url.hash = "";
      window.history.replaceState(null, "", url);
    } catch {}
  }, [activeModule]);

  const openModule = useCallback(
    (id, opts = {}) => {
      const nextId = String(id || "").trim();
      const isSame = nextId && nextId === activeModule;

      try {
        if (!isSame && activeModule) {
          persistLastHashForModule(activeModule, window.location.hash);
        }

        const raw = opts.hash != null ? String(opts.hash).trim() : "";
        if (raw) {
          window.location.hash = raw.startsWith("#") ? raw : `#${raw}`;
        } else if (!isSame) {
          const saved = readLastHashForModule(nextId);
          if (saved) window.location.hash = saved;
          else window.location.hash = "";
        }
      } catch {
        /* ignore */
      }
      setActiveModule(nextId);
      persistModuleToUrlAndStorage(nextId);
    },
    [activeModule],
  );

  if (migrationPending) {
    return (
      <div className="min-h-dvh bg-bg flex items-center justify-center p-6 page-enter">
        <div className="max-w-sm w-full bg-panel border border-line rounded-3xl p-6 shadow-float space-y-5">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto bg-accent/10 rounded-2xl flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden>
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text">Локальні дані знайдено</h2>
            <p className="text-sm text-muted leading-relaxed">
              У вас є дані на цьому пристрої, які ще не збережено в хмарі. Бажаєте завантажити їх у свій акаунт?
            </p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={uploadLocalData}
              disabled={syncing}
              className="w-full py-3 rounded-2xl bg-accent text-white font-semibold text-sm hover:brightness-110 transition disabled:opacity-50"
            >
              {syncing ? "Завантаження..." : "Завантажити в хмару"}
            </button>
            <button
              type="button"
              onClick={skipMigration}
              className="w-full py-3 rounded-2xl border border-line text-muted text-sm hover:text-text hover:bg-panelHi transition"
            >
              Пропустити
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showAuth && !user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <div className="page-enter">
          <AuthPage />
          <div className="fixed bottom-6 left-0 right-0 flex justify-center">
            <button
              type="button"
              onClick={() => setShowAuth(false)}
              className="text-sm text-muted hover:text-text underline"
            >
              Продовжити без акаунту
            </button>
          </div>
        </div>
      </Suspense>
    );
  }

  if (!activeModule) {
    return (
      <div className="min-h-dvh bg-bg flex flex-col safe-area-pt-pb page-enter">
        {!online && <OfflineBanner />}

        <header className="px-5 pt-10 pb-2 max-w-lg mx-auto w-full flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text tracking-tight">
              Мій простір
            </h1>
            <p className="text-sm text-muted mt-1">
              {hubView === "reports" ? "Звіти та статистика" : "Дашборд та модулі"}
            </p>
          </div>
          <div className="pt-1 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Пошук"
              title="Пошук по всіх модулях"
              className="w-10 h-10 flex items-center justify-center rounded-2xl text-muted hover:text-text hover:bg-panelHi transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
            {user ? (
              <UserMenuButton user={user} syncing={syncing} lastSync={lastSync} onSync={pushAll} onPull={pullAll} onLogout={logout} />
            ) : (
              !authLoading && (
                <button
                  type="button"
                  onClick={() => setShowAuth(true)}
                  aria-label="Увійти в акаунт"
                  title="Увійти"
                  className="w-10 h-10 flex items-center justify-center rounded-2xl text-muted hover:text-text hover:bg-panelHi transition-colors"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </button>
              )
            )}
            <DarkModeToggle dark={dark} onToggle={toggleDark} />
          </div>
        </header>

        <div className="px-5 max-w-lg mx-auto w-full mb-1">
          <div className="flex rounded-2xl overflow-hidden border border-line bg-panelHi/40 p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setHubView("dashboard")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all",
                hubView === "dashboard"
                  ? "bg-panel text-text shadow-card"
                  : "text-muted hover:text-text"
              )}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              Головна
            </button>
            <button
              type="button"
              onClick={() => setHubView("reports")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all",
                hubView === "reports"
                  ? "bg-panel text-text shadow-card"
                  : "text-muted hover:text-text"
              )}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Звіти
            </button>
          </div>
        </div>

        {updateAvailable && (
          <div className="px-5 max-w-lg mx-auto w-full mb-2">
            <div className="px-4 py-3 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary shrink-0" aria-hidden>
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span className="text-sm text-text flex-1">Доступна нова версія</span>
              <button onClick={applyUpdate} className="text-sm font-semibold text-primary hover:underline shrink-0">Оновити</button>
            </div>
          </div>
        )}

        {canInstall && (
          <div className="px-5 max-w-lg mx-auto w-full mb-2">
            <div className="px-4 py-3 rounded-2xl bg-panel border border-line shadow-card flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" aria-hidden>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">Встановити додаток</p>
                <p className="text-xs text-muted">Працює офлайн, як рідний додаток</p>
              </div>
              <button onClick={install} className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold shrink-0 hover:bg-primary/90 transition-colors">Так</button>
              <button onClick={dismiss} className="text-muted hover:text-text shrink-0 p-1" aria-label="Закрити">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 px-5 pb-28 max-w-lg mx-auto w-full overflow-y-auto">
          {hubView === "dashboard" && (
            <div className="flex flex-col gap-5 pt-2">
              <HubDashboard onOpenModule={openModule} />

              <HubBackupPanel className="mt-1" />
            </div>
          )}

          {hubView === "reports" && (
            <div className="pt-2">
              <HubReports />
            </div>
          )}
        </main>

        <div className="fixed bottom-0 left-0 right-0 flex justify-center pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-2.5 px-5 h-12 rounded-full bg-primary text-bg shadow-float hover:brightness-110 active:scale-95 transition-all font-medium text-sm"
            aria-label="Відкрити асистента (фінанси та тренування)"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Асистент
          </button>
        </div>

        {chatOpen && (
          <Suspense fallback={null}>
            <HubChat onClose={() => setChatOpen(false)} />
          </Suspense>
        )}

        {searchOpen && (
          <Suspense fallback={null}>
            <HubSearch onClose={() => setSearchOpen(false)} onOpenModule={openModule} />
          </Suspense>
        )}
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col bg-bg text-text overflow-hidden">
      {!online && <OfflineBanner />}
      {activeModule !== "fizruk" && activeModule !== "routine" && (
        <div className="shrink-0 absolute top-0 left-0 z-50 p-2 safe-area-pt-8">
          <button
            type="button"
            onClick={goToHub}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl bg-panel/90 backdrop-blur-md border border-line/80 text-muted hover:text-text shadow-card transition-colors"
            title="До вибору модуля"
            aria-label="До вибору модуля"
          >
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
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </button>
        </div>
      )}

      <Suspense fallback={<PageLoader />}>
        <div key={activeModule} className="page-enter h-full flex flex-col">
          <ModuleErrorBoundary onBackToHub={goToHub}>
            {activeModule === "finyk" && <FinykApp onBackToHub={goToHub} pwaAction={pwaAction} onPwaActionConsumed={clearPwaAction} />}
            {activeModule === "fizruk" && <FizrukApp onBackToHub={goToHub} pwaAction={pwaAction} onPwaActionConsumed={clearPwaAction} />}
            {activeModule === "routine" && (
              <RoutineApp onBackToHub={goToHub} onOpenModule={openModule} />
            )}
            {activeModule === "nutrition" && (
              <NutritionApp onBackToHub={goToHub} pwaAction={pwaAction} onPwaActionConsumed={clearPwaAction} />
            )}
          </ModuleErrorBoundary>
        </div>
      </Suspense>
    </div>
  );
}
