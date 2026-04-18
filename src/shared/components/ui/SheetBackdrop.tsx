import { cn } from "../../lib/cn";

/**
 * SheetBackdrop — canonical scrim overlay for bottom sheets & dialogs.
 *
 * Replaces the 5+ hand-rolled backdrop patterns that drifted across modules.
 * Default style: `bg-black/60 backdrop-blur-sm` (the most common pattern,
 * 10 of 16 callsites).
 *
 * Renders as an invisible `<button>` so the scrim itself acts as a tap-to-
 * dismiss target with proper a11y (aria-label).
 */

export interface SheetBackdropProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label (defaults to Ukrainian "Close"). */
  label?: string;
}

export function SheetBackdrop({
  className,
  label = "Закрити",
  ...props
}: SheetBackdropProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn("absolute inset-0 bg-black/60 backdrop-blur-sm", className)}
      {...props}
    />
  );
}
