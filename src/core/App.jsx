import { useEffect, lazy, Suspense, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@shared/lib/cn";
import ModuleErrorBoundary from "./ModuleErrorBoundary";
import { useDarkMode } from "@shared/hooks/useDarkMode";
import { useOnlineStatus } from "@shared/hooks/useOnlineStatus";
import { ToastProvider } from "@shared/hooks/useToast";
import { ToastContainer } from "@shared/components/ui/Toast";
import { HUB_OPEN_MODULE_EVENT } from "@shared/lib/hubNav";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import { useCloudSync } from "./useCloudSync.js";
import { PageLoader } from "./app/PageLoader.jsx";
import { OfflineBanner } from "./app/OfflineBanner.jsx";
import { MigrationPrompt } from "./app/MigrationPrompt.jsx";
import { usePwaInstall } from "./app/usePwaInstall.js";
import { useIosInstallBanner } from "./app/useIosInstallBanner.js";
import { useSWUpdate } from "./app/useSWUpdate.js";
import { PWA_ACTION_KEY } from "./app/pwaAction.js";
import { HubHeader } from "./app/HubHeader.jsx";
import { HubTabs } from "./app/HubTabs.jsx";
import { HubMainContent } from "./app/HubMainContent.jsx";
import { HubFloatingActions } from "./app/HubFloatingActions.jsx";
import { HubModals } from "./app/HubModals.jsx";
import { useHubNavigation } from "./hooks/useHubNavigation.js";
import { useHubUIState } from "./hooks/useHubUIState.js";
import { usePwaActions } from "./hooks/usePwaActions.js";

import RoutineApp from "../modules/routine/RoutineApp.jsx";
const AuthPage = lazy(() =>
  import("./AuthPage.jsx").then((m) => ({ default: m.AuthPage })),
);
const FinykApp = lazy(() => import("../modules/finyk/FinykApp"));
const FizrukApp = lazy(() => import("../modules/fizruk/FizrukApp"));
const NutritionApp = lazy(() => import("../modules/nutrition/NutritionApp"));

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
  const [showAuth, setShowAuth] = useState(false);
  const [searchParams] = useSearchParams();

  const { activeModule, openModule, goToHub, moduleAnimClass } =
    useHubNavigation();
  const ui = useHubUIState();
  const { pwaAction, setPwaAction, clearPwaAction, validActions } =
    usePwaActions(searchParams);
  const { dark, toggle: toggleDark } = useDarkMode();
  const { canInstall, install, dismiss } = usePwaInstall();
  const { visible: iosVisible, dismiss: iosDismiss } = useIosInstallBanner();
  const online = useOnlineStatus();
  const { updateAvailable, applyUpdate } = useSWUpdate();
  const { user, isLoading: authLoading, logout } = useAuth();
  const sync = useCloudSync(user);
  useEffect(() => {
    const onMessage = (event) => {
      if (event.data?.type === "OPEN_MODULE") {
        openModule(event.data.module);
      }
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onMessage);
      return () =>
        navigator.serviceWorker.removeEventListener("message", onMessage);
    }
  }, [openModule]);

  useEffect(() => {
    const onHubOpen = (ev) => {
      const { module, hash, action } = ev.detail || {};
      if (action && validActions.has(action)) {
        try {
          localStorage.setItem(PWA_ACTION_KEY, action);
        } catch {
          /* noop */
        }
        setPwaAction(action);
      }
      openModule(module, hash ? { hash } : undefined);
    };
    window.addEventListener(HUB_OPEN_MODULE_EVENT, onHubOpen);
    return () => window.removeEventListener(HUB_OPEN_MODULE_EVENT, onHubOpen);
  }, [openModule, setPwaAction, validActions]);

  if (sync.migrationPending) {
    return (
      <MigrationPrompt
        onUpload={sync.uploadLocalData}
        onSkip={sync.skipMigration}
        syncing={sync.syncing}
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

        <HubHeader
          hubView={ui.hubView}
          onOpenSearch={() => ui.setSearchOpen(true)}
          user={user}
          syncing={sync.syncing}
          lastSync={sync.lastSync}
          onSync={sync.pushAll}
          onPull={sync.pullAll}
          onLogout={logout}
          authLoading={authLoading}
          onShowAuth={() => setShowAuth(true)}
          dark={dark}
          onToggleDark={toggleDark}
        />

        <HubTabs hubView={ui.hubView} onChange={ui.setHubView} />

        <HubMainContent
          updateAvailable={updateAvailable}
          onApplyUpdate={applyUpdate}
          canInstall={canInstall}
          onInstall={install}
          onDismissInstall={dismiss}
          onboarding={ui.onboarding}
          setOnboarding={ui.setOnboarding}
          onSetPwaAction={setPwaAction}
          onOpenModule={openModule}
          iosVisible={iosVisible}
          onDismissIos={iosDismiss}
          hubView={ui.hubView}
          onOpenChat={ui.openChat}
          dark={dark}
          onToggleDark={toggleDark}
          syncing={sync.syncing}
          onSync={sync.pushAll}
          onPull={sync.pullAll}
          user={user}
        />

        <HubFloatingActions onOpenChat={() => ui.openChat()} />

        <HubModals
          chatOpen={ui.chatOpen}
          onCloseChat={ui.closeChat}
          chatInitialMessage={ui.chatInitialMessage}
          searchOpen={ui.searchOpen}
          onCloseSearch={ui.closeSearch}
          onOpenModule={openModule}
        />
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
