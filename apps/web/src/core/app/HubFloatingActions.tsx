import { Icon } from "@shared/components/ui/Icon";
import { cn } from "@shared/lib/cn";

/**
 * Thumb-reach entry point to the AI assistant. A single FAB that opens
 * the hub chat — the primary add surface is `TodayFocusCard`
 * (`+ Витрата / + Їжа / + Звичка / + Тренування` chips), which already
 * covers every module's quick-add path and made the previous
 * add-speed-dial FAB a pure duplicate.
 *
 * This is the only chat entry point in the hub chrome; the header no
 * longer duplicates the action next to search/dark-mode.
 *
 * @param {object} props
 * @param {boolean} [props.hidden=false] - When true the FAB is not
 *   rendered at all. Used during the FTUX session so the only
 *   interactive surface in view is `FirstActionHeroCard` → `PresetSheet`
 *   (the one-tap "real entry" path). A chat FAB would otherwise pull
 *   users into a conversational flow before they've logged anything.
 * @param {() => void} props.onOpenChat - Opens the hub AI chat panel
 *   (resolves to `ui.openChat()`).
 */
export function HubFloatingActions({ hidden = false, onOpenChat }) {
  if (hidden || !onOpenChat) return null;

  return (
    <div
      className="fixed right-5 z-40 flex flex-col items-end gap-2 pointer-events-none"
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <button
        type="button"
        onClick={() => onOpenChat()}
        aria-label="Відкрити AI-асистента"
        title="Асистент"
        className={cn(
          "pointer-events-auto h-14 pl-4 pr-5 flex items-center justify-center gap-2 rounded-full",
          "bg-brand-500 text-white shadow-float",
          "hover:bg-brand-600 hover:shadow-glow active:scale-95 transition-all",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        )}
      >
        <Icon name="sparkle" size={22} strokeWidth={2.2} />
        <span className="text-sm font-semibold whitespace-nowrap">
          Асистент
        </span>
      </button>
    </div>
  );
}
