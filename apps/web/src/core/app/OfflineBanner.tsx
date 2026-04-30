import { Icon } from "@shared/components/ui/Icon";
import { useSyncStatus } from "../cloudSync/useCloudSync";
import { pluralUa } from "@sergeant/shared";

/**
 * Subtle offline indicator — a small floating pill in the top-right
 * corner instead of a full-width warning banner. For a PWA designed to
 * work offline, screaming "NO INTERNET!" felt like a critical error.
 *
 * Shows a compact wifi-off icon + short label. When items are queued
 * for sync, the pending count is displayed so the user knows their
 * data is safe and waiting.
 */
export function OfflineBanner() {
  const { queuedCount, dirtyCount } = useSyncStatus();
  const pending = Math.max(queuedCount, dirtyCount);
  const label =
    pending > 0
      ? `Офлайн · ${pending} ${pluralUa(pending, {
          one: "в черзі",
          few: "в черзі",
          many: "в черзі",
        })}`
      : "Офлайн";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 right-3 z-[300] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-panel/90 border border-line text-muted text-xs font-medium shadow-soft backdrop-blur-sm safe-area-pt motion-safe:animate-fade-in"
    >
      <Icon name="wifi-off" size={12} strokeWidth={2.5} aria-hidden />
      <span>{label}</span>
    </div>
  );
}
