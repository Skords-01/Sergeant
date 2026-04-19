import { Icon } from "@shared/components/ui/Icon";

export function OfflineBanner() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-center gap-2 px-4 py-2 bg-warning text-white text-xs font-semibold safe-area-pt shadow-soft"
    >
      <Icon name="wifi-off" size={14} strokeWidth={2.5} />
      Немає підключення до інтернету
    </div>
  );
}
