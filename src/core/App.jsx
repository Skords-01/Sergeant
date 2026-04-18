import {
  useState,
  useCallback,
  lazy,
  Suspense,
  useEffect,
  useRef,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@shared/lib/cn";
import ModuleErrorBoundary from "./ModuleErrorBoundary";
import { useDarkMode } from "@shared/hooks/useDarkMode";
import { useOnlineStatus } from "@shared/hooks/useOnlineStatus";
import { ToastProvider, useToast } from "@shared/hooks/useToast";
import { ToastContainer } from "@shared/components/ui/Toast";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import { useCloudSync } from "./useCloudSync.js";
import { HubDashboard } from "./HubDashboard.jsx";
import { HubReports } from "./HubReports.jsx";
import { HubSettingsPage } from "./HubSettingsPage.jsx";
import { OnboardingWizard, shouldShowOnboarding } from "./OnboardingWizard.jsx";
import { SyncStatusIndicator } from "./SyncStatusIndicator.jsx";
import { Icon } from "@shared/components/ui/Icon";

const HubSearch = lazy(() =>
  import("./HubSearch.jsx").then((m) => ({ default: m.HubSearch })),
);

function OfflineBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-center gap-2 px-4 py-2 bg-warning text-white text-xs font-semibold safe-area-pt shadow-soft"
    >
      <Icon name="wifi-off" size={14} strokeWidth={2.5} />
      Немає підключення до інтернету
    </div>
  );
}

import RoutineApp from "../modules/routine/RoutineApp.jsx";

const HubChat = lazy(() => import("./HubChat"));

const FinykApp = lazy(() => import("../modules/finyk/FinykApp"));
const FizrukApp = lazy(() => import("../modules/fizruk/FizrukApp"));
const NutritionApp = lazy(() => import("../modules/nutrition/NutritionApp"));

const VALID_MODULES = new Set(["finyk", "fizruk", "routine", "nutrition"]);
const VALID_ACTIONS = new Set(["add_expense", "start_workout", "add_meal"]);

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
      <Icon name={dark ? "sun" : "moon"} size={20} />
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
      const count =
        parseInt(localStorage.getItem(PWA_SESSIONS_KEY) || "0", 10) + 1;
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

const IOS_BANNER_DISMISSED_KEY = "ios_install_banner_dismissed";

function useIosInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(IOS_BANNER_DISMISSED_KEY) === "1") return;
    } catch {}
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
    } catch {}
    setVisible(false);
  }, []);

  return { visible, dismiss };
}

function IOSInstallBanner({ onDismiss }) {
  return (
    <div className="px-5 max-w-lg mx-auto w-full mb-2">
      <div className="px-4 py-3 rounded-2xl bg-panel border border-line shadow-card flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
            aria-hidden
          >
            <path d="M12 2v13M7 7l5-5 5 5" />
            <path d="M20 21H4a2 2 0 0 1-2-2v-1" />
            <path d="M22 21v-1a2 2 0 0 0-2-2" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text">
            Додай на головний екран
          </p>
          <p className="text-xs text-muted mt-0.5 leading-snug">
            Щоб отримувати push-сповіщення на iOS, відкрий меню{" "}
            <span className="font-semibold">Поділитися</span>{" "}
            <span aria-hidden>⬆️</span> і обери{" "}
            <span className="font-semibold">На початковий екран</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted hover:text-text shrink-0 p-1 -mt-1 -mr-1"
          aria-label="Закрити"
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function useSWUpdate() {
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
            <p className="text-sm font-semibold text-text truncate">
              {user.name || "Користувач"}
            </p>
            <p className="text-xs text-muted truncate">{user.email}</p>
          </div>
          <div className="border-t border-line/60 pt-2 space-y-1">
            <button
              type="button"
              onClick={() => {
                onSync();
                setOpen(false);
              }}
              disabled={syncing}
              className="w-full text-left px-3 py-2 rounded-xl text-sm text-text hover:bg-panelHi transition-colors disabled:opacity-50 flex items-center gap-2"
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
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
              {syncing ? "Синхронізація..." : "Зберегти в хмару"}
            </button>
            <button
              type="button"
              onClick={() => {
                onPull();
                setOpen(false);
              }}
              disabled={syncing}
              className="w-full text-left px-3 py-2 rounded-xl text-sm text-text hover:bg-panelHi transition-colors disabled:opacity-50 flex items-center gap-2"
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
              onClick={() => {
                onLogout();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-sm text-error hover:bg-error/10 transition-colors flex items-center gap-2"
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialModule = (() => {
    const q = searchParams.get("module");
    if (VALID_MODULES.has(q)) return q;
    return null;
  })();

  const [activeModule, setActiveModule] = useState(initialModule);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialMessage, setChatInitialMessage] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [hubView, setHubView] = useState("dashboard");
  const [showOnboarding, setShowOnboarding] = useState(() =>
    shouldShowOnboarding(),
  );
  const [moduleAnimClass, setModuleAnimClass] = useState("module-enter");
  const [searchOpen, setSearchOpen] = useState(false);
  const [pwaAction, setPwaAction] = useState(() => {
    const fromUrl = searchParams.get("action");
    if (VALID_ACTIONS.has(fromUrl)) {
      try {
        localStorage.setItem(PWA_ACTION_KEY, fromUrl);
      } catch {}
      return fromUrl;
    }
    return consumePwaAction();
  });
  const clearPwaAction = useCallback(() => setPwaAction(null), []);
  const { dark, toggle: toggleDark } = useDarkMode();
  const { canInstall, install, dismiss } = usePwaInstall();
  const { visible: iosVisible, dismiss: iosDismiss } = useIosInstallBanner();
  const online = useOnlineStatus();
  const { updateAvailable, applyUpdate } = useSWUpdate();
  const { user, isLoading: authLoading, logout } = useAuth();
  const {
    syncing,
    lastSync,
    pushAll,
    pullAll,
    migrationPending,
    uploadLocalData,
    skipMigration,
  } = useCloudSync(user);

  const goToHub = useCallback(() => {
    setModuleAnimClass("hub-enter");
    setActiveModule(null);
    navigate("/", { replace: false });
  }, [navigate]);

  const openModule = useCallback(
    (id, opts = {}) => {
      const nextId = String(id || "").trim();
      if (!VALID_MODULES.has(nextId)) return;
      const isSame = nextId === activeModule;

      try {
        const raw = opts.hash != null ? String(opts.hash).trim() : "";
        if (raw) {
          window.location.hash = raw.startsWith("#") ? raw : `#${raw}`;
        } else if (!isSame) {
          window.location.hash = "";
        }
      } catch {
        /* ignore */
      }
      setModuleAnimClass("module-enter");
      setActiveModule(nextId);
      navigate(`/?module=${nextId}`, { replace: false });
    },
    [activeModule, navigate],
  );

  // Sync activeModule from browser navigation (back/forward)
  useEffect(() => {
    const q = searchParams.get("module");
    const mod = VALID_MODULES.has(q) ? q : null;
    if (mod !== activeModule) {
      setModuleAnimClass(mod ? "module-enter" : "hub-enter");
      setActiveModule(mod);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onMessage = (event) => {
      if (
        event.data?.type === "OPEN_MODULE" &&
        VALID_MODULES.has(event.data.module)
      ) {
        openModule(event.data.module);
      }
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onMessage);
      return () =>
        navigator.serviceWorker.removeEventListener("message", onMessage);
    }
  }, [openModule]);

  if (migrationPending) {
    return (
      <div className="min-h-dvh bg-bg flex items-center justify-center p-6 page-enter">
        <div className="max-w-sm w-full bg-panel border border-line rounded-3xl p-6 shadow-float space-y-5">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto bg-accent/10 rounded-2xl flex items-center justify-center">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-accent"
                aria-hidden
              >
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-text">
              Локальні дані знайдено
            </h2>
            <p className="text-sm text-muted leading-relaxed">
              У вас є дані на цьому пристрої, які ще не збережено в хмарі.
              Бажаєте завантажити їх у свій акаунт?
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
              {hubView === "reports"
                ? "Звіти та статистика"
                : hubView === "settings"
                  ? "Налаштування"
                  : "Дашборд та модулі"}
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
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
            {user ? (
              <>
                <SyncStatusIndicator user={user} syncing={syncing} />
                <UserMenuButton
                  user={user}
                  syncing={syncing}
                  lastSync={lastSync}
                  onSync={pushAll}
                  onPull={pullAll}
                  onLogout={logout}
                />
              </>
            ) : (
              !authLoading && (
                <button
                  type="button"
                  onClick={() => setShowAuth(true)}
                  aria-label="Увійти в акаунт"
                  title="Увійти"
                  className="w-10 h-10 flex items-center justify-center rounded-2xl text-muted hover:text-text hover:bg-panelHi transition-colors"
                >
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
                  : "text-muted hover:text-text",
              )}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
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
                  : "text-muted hover:text-text",
              )}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Звіти
            </button>
            <button
              type="button"
              onClick={() => setHubView("settings")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-all",
                hubView === "settings"
                  ? "bg-panel text-text shadow-card"
                  : "text-muted hover:text-text",
              )}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              Налаштування
            </button>
          </div>
        </div>

        {updateAvailable && (
          <div className="px-5 max-w-lg mx-auto w-full mb-2">
            <div className="px-4 py-3 rounded-2xl bg-primary/10 border border-primary/20 flex items-center gap-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary shrink-0"
                aria-hidden
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span className="text-sm text-text flex-1">
                Доступна нова версія
              </span>
              <button
                onClick={applyUpdate}
                className="text-sm font-semibold text-primary hover:underline shrink-0"
              >
                Оновити
              </button>
            </div>
          </div>
        )}

        {canInstall && (
          <div className="px-5 max-w-lg mx-auto w-full mb-2">
            <div className="px-4 py-3 rounded-2xl bg-panel border border-line shadow-card flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-primary"
                  aria-hidden
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">
                  Встановити додаток
                </p>
                <p className="text-xs text-muted">
                  Працює офлайн, як рідний додаток
                </p>
              </div>
              <button
                onClick={install}
                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold shrink-0 hover:bg-primary/90 transition-colors"
              >
                Так
              </button>
              <button
                onClick={dismiss}
                className="text-muted hover:text-text shrink-0 p-1"
                aria-label="Закрити"
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
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {showOnboarding && (
          <OnboardingWizard
            onDone={(startModuleId) => {
              setShowOnboarding(false);
              if (startModuleId) openModule(startModuleId);
            }}
          />
        )}

        {iosVisible && <IOSInstallBanner onDismiss={iosDismiss} />}

        <main className="flex-1 px-5 pb-28 max-w-lg mx-auto w-full overflow-y-auto">
          {hubView === "dashboard" && (
            <div className="flex flex-col gap-5 pt-2">
              <HubDashboard
                onOpenModule={openModule}
                onOpenChat={(message) => {
                  setChatInitialMessage(message || null);
                  setChatOpen(true);
                }}
              />
            </div>
          )}

          {hubView === "reports" && (
            <div className="pt-2">
              <HubReports />
            </div>
          )}

          {hubView === "settings" && (
            <HubSettingsPage
              dark={dark}
              onToggleDark={toggleDark}
              syncing={syncing}
              onSync={pushAll}
              onPull={pullAll}
              user={user}
            />
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
            <HubChat
              onClose={() => {
                setChatOpen(false);
                setChatInitialMessage(null);
              }}
              initialMessage={chatInitialMessage}
            />
          </Suspense>
        )}

        {searchOpen && (
          <Suspense fallback={null}>
            <HubSearch
              onClose={() => setSearchOpen(false)}
              onOpenModule={openModule}
            />
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
        <div
          key={activeModule}
          className={cn(moduleAnimClass, "h-full flex flex-col")}
        >
          <ModuleErrorBoundary onBackToHub={goToHub}>
            {activeModule === "finyk" && (
              <FinykApp
                onBackToHub={goToHub}
                pwaAction={pwaAction}
                onPwaActionConsumed={clearPwaAction}
              />
            )}
            {activeModule === "fizruk" && (
              <FizrukApp
                onBackToHub={goToHub}
                pwaAction={pwaAction}
                onPwaActionConsumed={clearPwaAction}
              />
            )}
            {activeModule === "routine" && (
              <RoutineApp onBackToHub={goToHub} onOpenModule={openModule} />
            )}
            {activeModule === "nutrition" && (
              <NutritionApp
                onBackToHub={goToHub}
                pwaAction={pwaAction}
                onPwaActionConsumed={clearPwaAction}
              />
            )}
          </ModuleErrorBoundary>
        </div>
      </Suspense>
    </div>
  );
}
