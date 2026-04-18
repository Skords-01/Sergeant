import { Icon } from "@shared/components/ui/Icon";
import { DarkModeToggle } from "./DarkModeToggle.jsx";
import { SyncStatusIndicator } from "../SyncStatusIndicator.jsx";
import { UserMenuButton } from "./UserMenuButton.jsx";

const ICON_BUTTON_CLS =
  "w-11 h-11 flex items-center justify-center rounded-2xl text-muted hover:text-text hover:bg-panelHi transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function HubHeader({
  hubView,
  onOpenSearch,
  user,
  syncing,
  lastSync,
  onSync,
  onPull,
  onLogout,
  authLoading,
  onShowAuth,
  dark,
  onToggleDark,
}) {
  return (
    <header
      className="px-5 pt-10 pb-2 max-w-lg mx-auto w-full flex items-start justify-between"
      style={{ paddingTop: "max(2.5rem, env(safe-area-inset-top))" }}
    >
      <div>
        <h1 className="text-3xl font-bold text-text tracking-tight">
          Sergeant
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
          onClick={onOpenSearch}
          aria-label="Пошук"
          title="Пошук по всіх модулях"
          className={ICON_BUTTON_CLS}
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
              onSync={onSync}
              onPull={onPull}
              onLogout={onLogout}
            />
          </>
        ) : (
          !authLoading && (
            <button
              type="button"
              onClick={onShowAuth}
              aria-label="Увійти в акаунт"
              title="Увійти"
              className={ICON_BUTTON_CLS}
            >
              <Icon name="user" size={20} />
            </button>
          )
        )}

        <DarkModeToggle dark={dark} onToggle={onToggleDark} />
      </div>
    </header>
  );
}
