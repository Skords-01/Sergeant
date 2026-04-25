import { useMemo } from "react";
import { Icon } from "@shared/components/ui/Icon";
import { DarkModeToggle } from "./DarkModeToggle.jsx";
import { UserMenuButton } from "./UserMenuButton.jsx";
import type { User } from "@sergeant/shared";

const ICON_BUTTON_CLS =
  "w-11 h-11 flex items-center justify-center rounded-2xl text-muted hover:text-text hover:bg-panelHi transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const GREETINGS: Record<string, { text: string; emoji: string }> = {
  morning: { text: "Доброго ранку", emoji: "\u2600\uFE0F" },
  afternoon: { text: "Доброго дня", emoji: "\uD83C\uDF24\uFE0F" },
  evening: { text: "Доброго вечора", emoji: "\uD83C\uDF19" },
  night: { text: "Доброї ночі", emoji: "\uD83C\uDF1F" },
};

function getTimeOfDay(): keyof typeof GREETINGS {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

function formatUkrainianDate(): string {
  const now = new Date();
  try {
    const weekday = now.toLocaleDateString("uk-UA", { weekday: "long" });
    const rest = now.toLocaleDateString("uk-UA", {
      day: "numeric",
      month: "long",
    });
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${rest}`;
  } catch {
    return "";
  }
}

interface HubHeaderProps {
  onOpenSearch: () => void;
  user: User | null;
  syncing?: boolean;
  lastSync?: string | Date | null;
  onSync?: () => void;
  onPull?: () => void;
  onLogout?: () => void;
  authLoading?: boolean;
  onShowAuth?: () => void;
  dark?: boolean;
  onToggleDark?: () => void;
  hideAuthButton?: boolean;
}

export function HubHeader({
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
  hideAuthButton = false,
}: HubHeaderProps) {
  const greeting = useMemo(() => {
    const tod = getTimeOfDay();
    const g = GREETINGS[tod];
    const name = user?.name?.split(" ")[0];
    return {
      text: name ? `${g.text}, ${name}` : g.text,
      emoji: g.emoji,
    };
  }, [user?.name]);

  const dateStr = useMemo(formatUkrainianDate, []);

  return (
    <header
      className="px-5 pt-10 pb-2 max-w-lg mx-auto w-full flex items-start justify-between"
      style={{ paddingTop: "max(2.5rem, env(safe-area-inset-top))" }}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-text leading-tight truncate">
          {greeting.text} <span aria-hidden>{greeting.emoji}</span>
        </h1>
        {dateStr && <p className="text-xs text-muted mt-0.5">{dateStr}</p>}
      </div>
      <div className="pt-1 flex items-center gap-1 shrink-0">
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
          <UserMenuButton
            user={user}
            syncing={syncing}
            lastSync={lastSync}
            onSync={onSync}
            onPull={onPull}
            onLogout={onLogout}
            dark={dark}
            onToggleDark={onToggleDark}
          />
        ) : (
          <>
            <DarkModeToggle dark={dark} onToggle={onToggleDark} />
            {!authLoading && !hideAuthButton && (
              <button
                type="button"
                onClick={onShowAuth}
                aria-label="Увійти в акаунт"
                title="Увійти"
                className={ICON_BUTTON_CLS}
              >
                <Icon name="user" size={20} />
              </button>
            )}
          </>
        )}
      </div>
    </header>
  );
}
