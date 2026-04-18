import { useEffect, useRef, useState } from "react";
import { cn } from "@shared/lib/cn";

export function UserMenuButton({
  user,
  syncing,
  lastSync,
  onSync,
  onPull,
  onLogout,
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
