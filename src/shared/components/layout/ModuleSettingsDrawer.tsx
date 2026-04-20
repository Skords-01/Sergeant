import { useId, useRef, type ReactNode } from "react";
import { Icon } from "@shared/components/ui/Icon";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { cn } from "@shared/lib/cn";

/**
 * Right-side settings drawer for module "cog" overlays.
 *
 * Fizruk/Finyk/Routine previously hand-rolled the same overlay: full-screen
 * scrim + right-anchored sheet + focus trap + Escape-to-close + safe-area
 * padding. This primitive owns the markup + a11y so modules just pass the
 * body.
 */

export interface ModuleSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function ModuleSettingsDrawer({
  open,
  onClose,
  title,
  children,
  className,
}: ModuleSettingsDrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useDialogFocusTrap(open, panelRef, { onEscape: onClose });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Закрити налаштування"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative w-full max-w-sm h-full bg-panel border-l border-line shadow-2xl flex flex-col safe-area-pt-pb",
          className,
        )}
      >
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
          <h2 id={titleId} className="text-base font-semibold text-text">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors"
            aria-label="Закрити"
          >
            <Icon name="close" size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
