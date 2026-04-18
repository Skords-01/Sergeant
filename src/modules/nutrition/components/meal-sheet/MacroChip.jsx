import { cn } from "@shared/lib/cn";

export function MacroChip({ label, value, unit = "г", color }) {
  return (
    <div className={cn("flex flex-col items-center px-3 py-2 min-w-0", color)}>
      <span className="text-xs font-bold uppercase tracking-widest opacity-70">
        {label}
      </span>
      <span className="text-base font-extrabold leading-tight">
        {value != null ? Math.round(value) : "—"}
      </span>
      <span className="text-[10px] opacity-60">{unit}</span>
    </div>
  );
}
