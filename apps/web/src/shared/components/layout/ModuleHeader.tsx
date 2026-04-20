import type { ReactNode } from "react";
import { cn } from "@shared/lib/cn";

/**
 * Sticky module header used by Фінік / Фізрук / Рутина.
 *
 * Owns the layout contract — safe-area padding, 68px min-height, divider,
 * backdrop blur, sticky flex row — and exposes slots so each module can
 * drop in its own back/hub/settings buttons without re-declaring the shell
 * styles. Title/subtitle/eyebrow are conventional text rows; modules that
 * need a completely custom title body can pass `titleSlot` instead.
 *
 * Typical composition:
 *
 *     <ModuleHeader
 *       left={<ModuleHeaderBackButton onClick={onBackToHub} />}
 *       right={<ModuleHeaderIconButton ... />}
 *       title="ФІЗРУК"
 *       eyebrow="ОСОБИСТИЙ ЖУРНАЛ"
 *       subtitle="Тренування · прогрес"
 *     />
 */

export interface ModuleHeaderProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  /** Override the default title/eyebrow/subtitle body entirely. */
  titleSlot?: ReactNode;
  className?: string;
}

export function ModuleHeader({
  title,
  subtitle,
  eyebrow,
  left,
  right,
  titleSlot,
  className,
}: ModuleHeaderProps) {
  return (
    <div
      className={cn(
        "shrink-0 bg-panel/95 backdrop-blur-md border-b border-line z-40 relative safe-area-pt",
        className,
      )}
    >
      <div className="flex min-h-[68px] items-center px-4 py-2 sm:px-5 gap-3">
        {left}
        <div className="min-w-0 flex-1">
          {titleSlot ?? (
            <>
              {eyebrow ? (
                // eslint-disable-next-line sergeant-design/no-eyebrow-drift -- Module hero kicker renders at text-3xs with text-brand-700 tint (WCAG AA ≥4.5:1 on panel); SectionHeading xs is text-2xs and does not expose a brand-700 tone.
                <span className="text-3xs text-brand-700 dark:text-brand/70 font-bold tracking-widest uppercase block leading-none mb-0.5">
                  {eyebrow}
                </span>
              ) : null}
              {title ? (
                <span className="text-[16px] font-semibold tracking-wide text-text block leading-tight">
                  {title}
                </span>
              ) : null}
              {subtitle ? (
                <span className="text-2xs text-subtle font-medium truncate">
                  {subtitle}
                </span>
              ) : null}
            </>
          )}
        </div>
        {right}
      </div>
    </div>
  );
}

export interface ModuleHeaderIconButtonProps {
  onClick: () => void;
  ariaLabel: string;
  title?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Standardized 40×40 icon button used in module headers (back, settings).
 */
export function ModuleHeaderIconButton({
  onClick,
  ariaLabel,
  title,
  children,
  className,
}: ModuleHeaderIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors border border-line bg-panel/80",
        className,
      )}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
    >
      {children}
    </button>
  );
}

export interface ModuleHeaderBackButtonProps {
  onClick: () => void;
  /** Visible label next to the chevron (e.g. "Хаб"). */
  label?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * "Back" button variant — used for top-level "to hub" navigation. Renders
 * a chevron + optional label inside the same 40-tall pill as icon buttons.
 */
export function ModuleHeaderBackButton({
  onClick,
  label = "Хаб",
  ariaLabel = "До хабу",
  className,
}: ModuleHeaderBackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 h-10 min-h-[40px] -ml-1 pl-2 pr-3 gap-1.5 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors border border-line bg-panel/80",
        className,
      )}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label ? <span className="text-sm font-semibold">{label}</span> : null}
    </button>
  );
}

/**
 * Plain chevron-only back button (no label). Used inside a module when a
 * sub-page (e.g. Atlas, Exercise) wants to return to the module's own
 * dashboard rather than the global hub.
 */
export function ModuleHeaderChevronButton({
  onClick,
  ariaLabel = "Назад",
  className,
}: {
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-10 h-10 min-w-[40px] min-h-[40px] -ml-1 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors",
        className,
      )}
      aria-label={ariaLabel}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}
