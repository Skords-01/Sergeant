import type { ReactNode } from "react";
import { cn } from "@shared/lib/cn";

/**
 * Module shell skeleton used by Фінік / Фізрук / Рутина / Харчування.
 *
 * Owns the full-viewport flex column, background tokens, and overflow
 * discipline so every module entrypoint renders identically. Slots keep
 * module-specific bits (header, banner, bottom nav, overlays) composable
 * without forcing each module to re-declare the layout.
 *
 *     <ModuleShell
 *       header={<ModuleHeader … />}
 *       banner={<StorageErrorBanner eventName={…} />}
 *       nav={<ModuleBottomNav … />}
 *       overlays={<ModuleSettingsDrawer open={…} … />}
 *     >
 *       {page === "dashboard" && <Dashboard />}
 *       …
 *     </ModuleShell>
 */

export interface ModuleShellProps {
  header?: ReactNode;
  banner?: ReactNode;
  nav?: ReactNode;
  /** Rendered outside the main flex column — drawers, modal overlays, etc. */
  overlays?: ReactNode;
  children: ReactNode;
  className?: string;
  mainClassName?: string;
}

export function ModuleShell({
  header,
  banner,
  nav,
  overlays,
  children,
  className,
  mainClassName,
}: ModuleShellProps) {
  return (
    <div
      className={cn(
        "h-dvh flex flex-col bg-bg text-text overflow-hidden",
        className,
      )}
    >
      {header}
      {overlays}
      {banner}
      <div
        className={cn("flex-1 overflow-hidden flex flex-col", mainClassName)}
      >
        {children}
      </div>
      {nav}
    </div>
  );
}
