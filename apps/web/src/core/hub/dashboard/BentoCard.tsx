import { memo, useCallback, useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import {
  MODULE_CONFIGS,
  type ModuleConfig,
  type ModuleId,
} from "./moduleConfigs";

export interface BentoCardProps {
  config: ModuleConfig;
  onClick: () => void;
  onQuickAdd?: { label: string; run: () => void } | null;
  /**
   * Ref/props applied to the inner primary `<button>` so dnd-kit can use it
   * as the drag activator. Keeping the activator on the primary button (not
   * the wrapper) allows the quick-add button to live as a sibling instead of
   * a nested interactive control — see the `nested-interactive` axe rule
   * (#839).
   */
  primaryRef?: (node: HTMLButtonElement | null) => void;
  primaryProps?: Record<string, unknown>;
  isDragging?: boolean;
}

/**
 * Bento-grid module tile rendered inside the 2×2 dashboard layout. Shows
 * the module emoji + label, latest preview numbers (`main`/`sub`) and a
 * progress bar when the module has a daily goal (`hasGoal`).
 *
 * The card itself is the primary `<button>`; the small `+` quick-add affordance
 * is rendered as an absolutely-positioned sibling button. They are siblings —
 * not parent/child — so axe's `nested-interactive` rule passes.
 */
export const BentoCard = memo(function BentoCard({
  config,
  onClick,
  onQuickAdd,
  primaryRef,
  primaryProps,
  isDragging,
}: BentoCardProps) {
  const preview = config.getPreview();
  const showProgress =
    config.hasGoal && preview.progress !== undefined && preview.progress > 0;
  const hasData = !!(preview.main || preview.sub);

  return (
    <div className={cn("relative", isDragging && "opacity-70 z-50")}>
      <button
        ref={primaryRef}
        type="button"
        onClick={onClick}
        {...primaryProps}
        className={cn(
          "group relative flex flex-col w-full rounded-3xl border border-line p-3.5",
          "shadow-card transition-all duration-200 text-left",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          "active:scale-[0.98]",
          config.cardBg,
          isDragging && "shadow-float cursor-grabbing",
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <div
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
              config.iconClass,
            )}
          >
            {config.icon}
          </div>

          {/* Layout placeholder for the absolutely-positioned quick-add
              sibling — keeps the label centred consistently regardless of
              whether the module exposes a quick-add action. */}
          {onQuickAdd && <span aria-hidden className="w-6 h-6 shrink-0" />}
        </div>

        <span className="text-xs font-semibold text-text">
          {config.emoji} {config.label}
        </span>

        {hasData ? (
          <>
            {preview.main && (
              <span className="text-lg font-bold text-text tabular-nums mt-1 truncate">
                {preview.main}
              </span>
            )}
            {preview.sub && (
              <span className="text-2xs text-muted mt-0.5 truncate">
                {preview.sub}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-muted mt-1">{config.emptyLabel}</span>
        )}

        {showProgress && (
          <div
            className="w-full h-1 rounded-full bg-line/40 dark:bg-white/10 overflow-hidden mt-2"
            aria-hidden
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-700 ease-out",
                config.accentClass,
              )}
              style={{ width: `${Math.min(preview.progress ?? 0, 100)}%` }}
            />
          </div>
        )}
      </button>

      {onQuickAdd && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickAdd.run();
          }}
          aria-label={onQuickAdd.label}
          title={onQuickAdd.label}
          className={cn(
            "absolute top-3.5 right-3.5",
            "w-6 h-6 rounded-md flex items-center justify-center",
            "text-text bg-panel/80 hover:bg-primary hover:text-bg",
            "transition-colors",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          )}
        >
          <Icon name="plus" size={13} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
});

export interface SortableCardProps {
  id: ModuleId;
  onOpenModule: (id: ModuleId) => void;
  quickAdd?: { label: string; run: () => void } | null;
}

/**
 * Drag-sortable wrapper around `BentoCard` that wires up `@dnd-kit/sortable`
 * transforms / listeners. Rendered inside `<SortableContext>` from the
 * parent dashboard so the order persists via `saveDashboardOrder`.
 */
export const SortableCard = memo(function SortableCard({
  id,
  onOpenModule,
  quickAdd,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
    }),
    [transform, transition],
  );

  // AI-NOTE: spread dnd-kit attributes/listeners on the *inner* primary button
  // (via `primaryProps` + `setActivatorNodeRef`). Spreading them on the wrapper
  // would either nest interactive controls (button-in-button with quick-add)
  // or attach `role="button"` to a `<div>` whose only focusable child is the
  // primary `<button>` — both fail axe a11y rules.
  const primaryProps = useMemo(
    () => ({ ...attributes, ...listeners }),
    [attributes, listeners],
  );

  const handleClick = useCallback(() => onOpenModule(id), [onOpenModule, id]);

  const cfg = MODULE_CONFIGS[id];
  if (!cfg) return null;

  return (
    <div ref={setNodeRef} style={style} className="min-w-0">
      <BentoCard
        config={cfg}
        onClick={handleClick}
        onQuickAdd={quickAdd}
        primaryRef={setActivatorNodeRef}
        primaryProps={primaryProps}
        isDragging={isDragging}
      />
    </div>
  );
});
