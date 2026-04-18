import { useToast, type ToastType } from "@shared/hooks/useToast";
import { cn } from "@shared/lib/cn";

const VARIANT: Record<ToastType, string> = {
  success: "bg-success text-white",
  error: "bg-danger text-white",
  warning: "bg-warning text-white",
  info: "bg-primary text-white",
};

const ICON_WRAP: Record<ToastType, string> = {
  success: "motion-safe:animate-check-pop",
  error: "",
  warning: "",
  info: "",
};

const ICON: Record<ToastType, React.ReactNode> = {
  success: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  warning: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-[max(1.25rem,env(safe-area-inset-top,0px)+0.75rem)] left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none w-[min(92vw,24rem)]"
      aria-live="polite"
      role="status"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto w-full px-4 py-3 rounded-2xl text-sm font-semibold shadow-float flex items-center gap-2.5",
            "animate-in fade-in slide-in-from-top-2 duration-200",
            VARIANT[t.type] || VARIANT.info,
          )}
          role="alert"
        >
          <span
            className={cn(
              "shrink-0 inline-flex items-center justify-center",
              ICON_WRAP[t.type],
            )}
          >
            {ICON[t.type]}
          </span>
          <span className="min-w-0 flex-1 leading-snug">{t.msg}</span>
          {t.action?.onClick && (
            <button
              type="button"
              onClick={() => {
                try {
                  t.action?.onClick();
                } finally {
                  dismiss(t.id);
                }
              }}
              className="shrink-0 px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/25 transition-colors"
            >
              {t.action.label || "Дія"}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Закрити"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
