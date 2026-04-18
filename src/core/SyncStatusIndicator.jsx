import { useSyncStatus } from "./useCloudSync.js";
import { Icon } from "@shared/components/ui/Icon";

/**
 * Small pill that reflects the current cloud-sync state.
 *
 *   - offline + queued        → "Буде синхронізовано"
 *   - offline                 → "Офлайн"
 *   - syncing                 → "Синхронізація…"
 *   - dirty (awaiting push)   → "Очікує синхронізації"
 *   - idle                    → "Синхронізовано" (rendered as a subtle check)
 *
 * The component is intentionally tiny — a single glyph + tooltip — so it can
 * sit next to the gear/menu icon without crowding the header.
 */
export function SyncStatusIndicator({
  user,
  syncing = false,
  className = "",
}) {
  const { dirtyCount, queuedCount, isOnline } = useSyncStatus();

  if (!user) return null;

  let tone = "idle";
  let title = "Все синхронізовано";
  let iconName = "cloud-check";

  if (!isOnline && queuedCount > 0) {
    tone = "queued";
    title = `Буде синхронізовано ${queuedCount} змін при підключенні`;
    iconName = "cloud-off";
  } else if (!isOnline) {
    tone = "offline";
    title = "Офлайн — зміни збережуться локально";
    iconName = "wifi-off";
  } else if (syncing) {
    tone = "syncing";
    title = "Синхронізація…";
    iconName = "refresh-cw";
  } else if (dirtyCount > 0) {
    tone = "dirty";
    title = `Очікує синхронізації: ${dirtyCount} модул${dirtyCount === 1 ? "ь" : "ів"}`;
    iconName = "cloud-off";
  }

  const toneClasses = {
    idle: "text-success/80",
    syncing: "text-primary animate-spin",
    dirty: "text-warning",
    offline: "text-muted",
    queued: "text-warning",
  };

  return (
    <span
      className={`inline-flex items-center justify-center w-8 h-8 rounded-xl ${className}`}
      title={title}
      aria-label={title}
      role="status"
    >
      <Icon
        name={iconName}
        size={16}
        className={toneClasses[tone]}
        title={title}
      />
    </span>
  );
}
