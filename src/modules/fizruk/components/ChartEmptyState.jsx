import { cn } from "@shared/lib/cn";

/** Порожній стан для графіків Фізрука (замість «нічого не видно»). */
export function ChartEmptyState({ title, hint, className }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-line/60 bg-panelHi/50 px-4 py-7 text-center",
        className,
      )}
      role="status"
    >
      <div className="text-sm font-semibold text-text">{title}</div>
      {hint ? (
        <p className="text-xs text-subtle mt-1.5 leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}
