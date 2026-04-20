import { cn } from "@shared/lib/cn";
import { SectionHeading } from "@shared/components/ui/SectionHeading";

export function MacroChip({ label, value, unit = "г", color }) {
  return (
    <div className={cn("flex flex-col items-center px-3 py-2 min-w-0", color)}>
      <SectionHeading as="span" size="xs" className="text-inherit opacity-70">
        {label}
      </SectionHeading>
      <span className="text-base font-extrabold leading-tight">
        {value != null ? Math.round(value) : "—"}
      </span>
      <span className="text-2xs opacity-60">{unit}</span>
    </div>
  );
}
