import { useState, useCallback, lazy, Suspense, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { cn } from "@shared/lib/cn";
import ModuleErrorBoundary from "./ModuleErrorBoundary";
import { useDarkMode } from "@shared/hooks/useDarkMode";
import { useOnlineStatus } from "@shared/hooks/useOnlineStatus";
import { ToastProvider } from "@shared/hooks/useToast";
import { ToastContainer } from "@shared/components/ui/Toast";
import { Icon } from "@shared/components/ui/Icon";
import { HUB_OPEN_MODULE_EVENT } from "@shared/lib/hubNav";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import { useCloudSync } from "./useCloudSync.js";
import { HubDashboard } from "./HubDashboard.jsx";
import { HubReports } from "./HubReports.jsx";
import { HubSettingsPage } from "./HubSettingsPage.jsx";
import { OnboardingWizard, shouldShowOnboarding } from "./OnboardingWizard.jsx";
import {
  seedFinykDemoData,
  enableFinykManualOnly,
} from "../modules/finyk/lib/demoData.js";
import { SyncStatusIndicator } from "./SyncStatusIndicator.jsx";
import { OfflineBanner } from "./app/OfflineBanner.jsx";
import { PageLoader } from "./app/PageLoader.jsx";
import { DarkModeToggle } from "./app/DarkModeToggle.jsx";
import { IOSInstallBanner } from "./app/IOSInstallBanner.jsx";
import { UserMenuButton } from "./app/UserMenuButton.jsx";
import { MigrationPrompt } from "./app/MigrationPrompt.jsx";
import { usePwaInstall } from "./app/usePwaInstall.js";
import { useIosInstallBanner } from "./app/useIosInstallBanner.js";
import { useSWUpdate } from "./app/useSWUpdate.js";
import { PWA_ACTION_KEY, consumePwaAction } from "./app/pwaAction.js";

const HubSearch = lazy(() =>
  import("./HubSearch.jsx").then((m) => ({ default: m.HubSearch })),
);

import RoutineApp from "../modules/routine/RoutineApp.jsx";

const HubChat = lazy(() => import("./HubChat"));

const FinykApp = lazy(() => import("../modules/finyk/FinykApp"));
const FizrukApp = lazy(() => import("../modules/fizruk/FizrukApp"));
const NutritionApp = lazy(() => import("../modules/nutrition/NutritionApp"));

const VALID_MODULES = new Set(["finyk", "fizruk", "routine", "nutrition"]);
const VALID_ACTIONS = new Set(["add_expense", "start_workout", "add_meal"]);

const AuthPage = lazy(() =>
  import("./AuthPage.jsx").then((m) => ({ default: m.AuthPage })),
);

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
      } catch {
        /* noop */
      }
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

  // Крос-модульний deep-link через `openHubModule(...)` з @shared/lib/hubNav —
  // дозволяє будь-якому компоненту будь-якого модуля стрибнути в інший
  // модуль+hash без прокидування `onOpenModule` через дерево.
  useEffect(() => {
    const onHubOpen = (ev) => {
      const { module, hash } = ev.detail || {};
      if (!VALID_MODULES.has(module)) return;
      openModule(module, hash ? { hash } : undefined);
    };
    window.addEventListener(HUB_OPEN_MODULE_EVENT, onHubOpen);
    return () => window.removeEventListener(HUB_OPEN_MODULE_EVENT, onHubOpen);
  }, [openModule]);

  if (migrationPending) {
    return (
      <MigrationPrompt
        onUpload={uploadLocalData}
        onSkip={skipMigration}
        syncing={syncing}
      />
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
              <Icon name="search" size={20} />
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
                <Icon name="close" size={16} />
              </button>
            </div>
          </div>
        )}

        {showOnboarding && (
          <OnboardingWizard
            onDone={(startModuleId, opts = {}) => {
              setShowOnboarding(false);
              // Quick-start intents from the wizard map onto three different
              // landings inside Finyk. We set any flags / PWA actions *before*
              // calling `openModule` so FinykApp sees them on mount.
              if (opts.intent === "demo") {
                seedFinykDemoData();
              } else if (opts.intent === "manual") {
                enableFinykManualOnly();
                setPwaAction("add_expense");
              } else if (opts.intent === "bank") {
                // Bank flow needs no pre-seeding — the module renders its
                // token input as soon as it mounts.
              }
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
