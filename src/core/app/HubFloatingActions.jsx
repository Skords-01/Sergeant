import { Icon } from "@shared/components/ui/Icon";

/**
 * Compact circular FAB for the AI assistant. Sits above the safe-area inset
 * on the bottom-right so it doesn't fight the content column for attention.
 */
export function HubFloatingActions({ onOpenChat }) {
  return (
    <div
      className="fixed right-5 z-40 pointer-events-none"
      style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <button
        type="button"
        onClick={onOpenChat}
        aria-label="Відкрити AI-асистента"
        title="Асистент"
        className="pointer-events-auto w-14 h-14 flex items-center justify-center rounded-full bg-brand-500 text-white shadow-float hover:bg-brand-600 hover:shadow-glow active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <Icon name="sparkle" size={22} strokeWidth={2} />
      </button>
    </div>
  );
}
