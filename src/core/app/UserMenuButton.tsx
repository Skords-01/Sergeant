import { useEffect, useRef, useState } from "react";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { useSyncStatus } from "../useCloudSync.js";

function SyncBadge({ user, syncing }) {
  const { dirtyCount, queuedCount, isOnline } = useSyncStatus();
  if (!user) return null;
  let tone = null;
  if (!isOnline && queuedCount > 0) tone = "queued";
  else if (!isOnline) tone = "offline";
  else if (syncing) tone = "syncing";
  else if (dirtyCount > 0) tone = "dirty";
  if (!tone) return null;
  const toneCls =
    tone === "syncing"
      ? "bg-primary animate-pulse"
      : tone === "offline"
        ? "bg-muted"
        : "bg-warning";
  return (
    <span
      aria-hidden
      className={cn(
        "absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg",
        toneCls,
      )}
    />
  );
}

export function UserMenuButton({
  user,
  syncing,
  lastSync,
  onSync,
  onPull,
  onLogout,
  dark,
  onToggleDark,
}) {
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
        aria-expanded={open}
        title={user.email}
        className={cn(
          "relative w-11 h-11 flex items-center justify-center rounded-2xl text-sm font-bold transition-colors",
          "bg-brand-500/15 text-brand-600 dark:text-brand-400 hover:bg-brand-500/25",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          syncing && "animate-pulse",
        )}
      >
        {initial}
        <SyncBadge user={user} syncing={syncing} />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 bg-panel border border-line rounded-2xl shadow-float p-3 space-y-2">
          <div className="px-2 py-1">
            <p className="text-sm font-semibold text-text truncate">
              {user.name || "Користувач"}
            </p>
            <p className="text-xs text-muted truncate">{user.email}</p>
          </div>
          <div className="border-t border-line pt-2 space-y-1">
            <button
              type="button"
              onClick={() => {
                onSync();
                setOpen(false);
              }}
              disabled={syncing}
              className="w-full text-left px-3 py-2 rounded-xl text-sm text-text hover:bg-panelHi transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Icon name="upload" size={16} />
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
              <Icon name="download" size={16} />
              Завантажити з хмари
            </button>
            {lastSync && (
              <p className="px-3 text-2xs text-muted">
                Остання синхр.: {lastSync.toLocaleTimeString("uk-UA")}
              </p>
            )}
          </div>
          {typeof onToggleDark === "function" && (
            <div className="border-t border-line pt-2">
              <button
                type="button"
                onClick={() => {
                  onToggleDark();
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-sm text-text hover:bg-panelHi transition-colors flex items-center gap-2"
              >
                <Icon name={dark ? "sun" : "moon"} size={16} />
                {dark ? "Світла тема" : "Темна тема"}
              </button>
            </div>
          )}
          <div className="border-t border-line pt-2">
            <button
              type="button"
              onClick={() => {
                onLogout();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-xl text-sm text-error hover:bg-error/10 transition-colors flex items-center gap-2"
            >
              <Icon name="log-out" size={16} />
              Вийти
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
