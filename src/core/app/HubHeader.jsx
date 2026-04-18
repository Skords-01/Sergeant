import { Icon } from "@shared/components/ui/Icon";
import { DarkModeToggle } from "./DarkModeToggle.jsx";
import { SyncStatusIndicator } from "../SyncStatusIndicator.jsx";
import { UserMenuButton } from "./UserMenuButton.jsx";

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
          onClick={onOpenSearch}
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

        <DarkModeToggle dark={dark} onToggle={onToggleDark} />
      </div>
    </header>
  );
}
