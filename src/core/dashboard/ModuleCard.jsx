/**
 * Hub Dashboard — ModuleCard and SortableCard.
 *
 * `ModuleCard` renders one module tile with icon, preview snippet and optional
 * mini progress bar. `SortableCard` wraps it in `@dnd-kit/sortable` machinery
 * so the dashboard order can be rearranged by the user.
 */

import { cn } from "@shared/lib/cn";
import { Icon } from "@shared/components/ui/Icon";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MODULE_CONFIGS } from "./moduleConfigs.jsx";

const MODULE_GRADIENTS = {
  finyk: "module-card-finyk",
  fizruk: "module-card-fizruk",
  routine: "module-card-routine",
  nutrition: "module-card-nutrition",
};

const MODULE_GLOWS = {
  finyk: "hover-glow",
  fizruk: "hover-glow-teal",
  routine: "hover-glow-coral",
  nutrition: "hover-glow-lime",
};

const PROGRESS_BAR_COLORS = {
  routine: "bg-routine",
  nutrition: "bg-nutrition",
  fizruk: "bg-fizruk",
  finyk: "bg-finyk",
};

export function ModuleCard({ config, onClick, dragProps, isDragging }) {
  const preview = config.getPreview();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full text-left",
        "p-4 rounded-2xl border",
        "shadow-card transition-all duration-200 ease-smooth",
        "hover:shadow-float hover:-translate-y-1",
        "active:scale-[0.97] active:shadow-card",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        MODULE_GRADIENTS[config.module] || "bg-panel",
        MODULE_GLOWS[config.module],
        isDragging &&
          "opacity-80 scale-[0.97] shadow-float z-50 cursor-grabbing rotate-1",
      )}
      {...dragProps}
    >
      <div className="relative">
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
              "transition-transform duration-200 ease-smooth",
              "group-hover:scale-105",
              "shadow-sm",
              config.colorClass,
            )}
          >
            {config.icon}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
              {config.label}
            </span>
          </div>
          <div
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center",
              "bg-line/30 dark:bg-white/5",
              "group-hover:bg-line/50 dark:group-hover:bg-white/10",
              "transition-all duration-200",
              "group-hover:translate-x-0.5",
            )}
          >
            <Icon
              name="chevron-right"
              size={14}
              strokeWidth={2.5}
              className="text-muted group-hover:text-text transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          {preview.main ? (
            <>
              <p className="text-xl font-bold text-text tabular-nums leading-tight">
                {preview.main}
              </p>
              {preview.sub && (
                <p className="text-xs text-muted leading-snug">{preview.sub}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted leading-snug">
              {preview.sub || config.description}
            </p>
          )}

          {preview.progress !== undefined && preview.progress > 0 && (
            <div className="mt-2.5 h-1.5 rounded-full bg-line/40 dark:bg-white/10 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700 ease-out",
                  PROGRESS_BAR_COLORS[config.module],
                )}
                style={{ width: `${Math.min(preview.progress, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export function SortableCard({ id, onOpenModule }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const cfg = MODULE_CONFIGS[id];
  if (!cfg) return null;

  return (
    <div ref={setNodeRef} style={style}>
      <ModuleCard
        config={cfg}
        onClick={() => onOpenModule(id)}
        isDragging={isDragging}
        dragProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
