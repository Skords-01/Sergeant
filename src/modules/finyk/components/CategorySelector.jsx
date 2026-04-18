import { cn } from "@shared/lib/cn";

export function CategorySelector({
  value,
  onChange,
  categories = [],
  className,
  placeholder = "Оберіть категорію",
}) {
  return (
    <select
      className={cn(
        "w-full h-10 rounded-xl border border-line bg-bg px-3 text-sm text-text outline-none focus:border-primary",
        className,
      )}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
