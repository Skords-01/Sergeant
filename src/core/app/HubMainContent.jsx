import { Icon } from "@shared/components/ui/Icon";
import { HubDashboard } from "../HubDashboard.jsx";
import { HubReports } from "../HubReports.jsx";
import { HubSettingsPage } from "../HubSettingsPage.jsx";
import { OnboardingWizard } from "../OnboardingWizard.jsx";
import { IOSInstallBanner } from "./IOSInstallBanner.jsx";
import {
  enableFinykManualOnly,
  seedFinykDemoData,
} from "../../modules/finyk/lib/demoData.js";

export function HubMainContent({
  updateAvailable,
  onApplyUpdate,
  canInstall,
  onInstall,
  onDismissInstall,
  onboarding,
  setOnboarding,
  onSetPwaAction,
  onOpenModule,
  iosVisible,
  onDismissIos,
  hubView,
  onOpenChat,
  dark,
  onToggleDark,
  syncing,
  onSync,
  onPull,
  user,
}) {
  return (
    <>
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
              onClick={onApplyUpdate}
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
              onClick={onInstall}
              className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold shrink-0 hover:bg-primary/90 transition-colors"
            >
              Так
            </button>
            <button
              onClick={onDismissInstall}
              className="text-muted hover:text-text shrink-0 p-1"
              aria-label="Закрити"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>
      )}

      {onboarding && (
        <OnboardingWizard
          onDone={(startModuleId, opts = {}) => {
            setOnboarding(false);
            if (opts.intent === "demo") {
              seedFinykDemoData();
            } else if (opts.intent === "manual") {
              enableFinykManualOnly();
              onSetPwaAction("add_expense");
            }
            if (startModuleId) onOpenModule(startModuleId);
          }}
        />
      )}

      {iosVisible && <IOSInstallBanner onDismiss={onDismissIos} />}

      <main className="flex-1 px-5 pb-28 max-w-lg mx-auto w-full overflow-y-auto">
        {hubView === "dashboard" && (
          <div className="flex flex-col gap-5 pt-2">
            <HubDashboard onOpenModule={onOpenModule} onOpenChat={onOpenChat} />
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
            onToggleDark={onToggleDark}
            syncing={syncing}
            onSync={onSync}
            onPull={onPull}
            user={user}
          />
        )}
      </main>
    </>
  );
}
