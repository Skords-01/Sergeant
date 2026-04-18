// Shown on the hub dashboard while the user is still exploring seeded
// demo data and hasn't logged anything real yet. Purpose: set expectations
// ("ці цифри — приклад") so the user doesn't mistake demo numbers for
// their own and isn't surprised when they disappear after the first real
// entry. Dismissible — users who already get it shouldn't see it again.

import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";

export function DemoModeBanner({ onDismiss }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-brand-500/20 bg-brand-500/5",
        "px-4 py-3 flex items-start gap-3",
      )}
      role="status"
    >
      <div
        className={cn(
          "shrink-0 w-8 h-8 rounded-full",
          "bg-brand-500/15 text-brand-600",
          "flex items-center justify-center",
        )}
      >
        <Icon name="sparkle" size={16} strokeWidth={2} aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text leading-snug">
          Це приклад даних за 2 тижні.
        </p>
        <p className="text-xs text-muted mt-0.5 leading-snug">
          Додай що-небудь своє — і цифри стануть твоїми.
        </p>
      </div>
      {typeof onDismiss === "function" && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Закрити підказку"
          className={cn(
            "shrink-0 w-7 h-7 rounded-full text-muted hover:text-text",
            "hover:bg-line/50 flex items-center justify-center",
            "transition-colors",
          )}
        >
          <Icon name="close" size={14} strokeWidth={2} aria-hidden />
        </button>
      )}
    </div>
  );
}
