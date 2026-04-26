import { useMemo } from "react";
import { Icon } from "@shared/components/ui/Icon";
import { Tooltip } from "@shared/components/ui/Tooltip";
import { BrandLogo } from "./BrandLogo";
import { DarkModeToggle } from "./DarkModeToggle";
import { UserMenuButton } from "./UserMenuButton";
import type { User } from "@sergeant/shared";

const ICON_BUTTON_CLS =
  "w-11 h-11 flex items-center justify-center rounded-2xl text-muted hover:text-text hover:bg-panelHi transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const GREETINGS: Record<string, string> = {
  morning: "Доброго ранку",
  afternoon: "Доброго дня",
  evening: "Доброго вечора",
  night: "Доброї ночі",
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
  const greetingText = useMemo(() => {
    const tod = getTimeOfDay();
    const base = GREETINGS[tod];
    const name = user?.name?.split(" ")[0];
    return name ? `${base}, ${name}` : base;
  }, [user?.name]);

  const dateStr = useMemo(formatUkrainianDate, []);

  return (
    <header
      className="px-5 pt-10 pb-3 max-w-lg mx-auto w-full"
      style={{ paddingTop: "max(2.5rem, env(safe-area-inset-top))" }}
    >
      {/* ── Row 1: Mark + Wordmark + Action icons ─────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <BrandLogo as="span" size="lg" variant="mark" />
          <h1 className="text-[22px] leading-none font-extrabold tracking-tight text-text select-none">
            Sergeant
          </h1>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Tooltip content="Пошук по всіх модулях" placement="bottom-center">
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Пошук"
              className={ICON_BUTTON_CLS}
            >
              <Icon name="search" size={20} />
            </button>
          </Tooltip>

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
                <Tooltip content="Увійти" placement="bottom-center">
                  <button
                    type="button"
                    onClick={onShowAuth}
                    aria-label="Увійти в акаунт"
                    className={ICON_BUTTON_CLS}
                  >
                    <Icon name="user" size={20} />
                  </button>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Row 2: Vertical bar + subtitle ────────────────────── */}
      <div className="flex items-center gap-1.5 mt-1.5 ml-[3px]">
        <span
          aria-hidden="true"
          className="inline-block w-[3px] h-[14px] rounded-full bg-brand-500"
        />
        <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-brand-700 dark:text-brand-400 select-none">
          Оперативний центр
        </span>
      </div>

      {/* ── Row 3: Greeting · date (single line) ──────────────── */}
      <p className="mt-1.5 ml-[3px] text-[13px] leading-snug text-muted truncate">
        {greetingText}
        {dateStr && (
          <>
            <span className="mx-1.5 text-subtle" aria-hidden="true">
              ·
            </span>
            <span className="text-subtle">{dateStr}</span>
          </>
        )}
      </p>
    </header>
  );
}
