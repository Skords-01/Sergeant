import { Icon } from "@shared/components/ui/Icon";
import { useSyncStatus } from "../useCloudSync";
import { pluralUa } from "@sergeant/shared";

/**
 * Офлайн-банер у шапці. Раніше показував лише статичне "Немає
 * підключення до інтернету". Тепер підтягує `useSyncStatus`, щоб
 * користувач одразу бачив, скільки дій стоїть у черзі — це закриває
 * головну тривогу ("чи збережеться витрата, якщо я без мережі?").
 *
 * Шрифт/кольори не змінюємо, щоб не зміщувати layout у залежності від
 * кількості елементів у черзі (висота банера константна).
 */
export function OfflineBanner() {
  const { queuedCount, dirtyCount } = useSyncStatus();
  const pending = Math.max(queuedCount, dirtyCount);
  const label =
    pending > 0
      ? `Немає підключення · ${pending} ${pluralUa(pending, {
          one: "дія чекає",
          few: "дії чекають",
          many: "дій чекають",
        })} синхронізації`
      : "Немає підключення до інтернету";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-center gap-2 px-4 py-2 bg-warning text-white text-xs font-semibold safe-area-pt shadow-soft"
    >
      <Icon name="wifi-off" size={14} strokeWidth={2.5} aria-hidden />
      <span className="truncate max-w-[min(92vw,40rem)]">{label}</span>
    </div>
  );
}
