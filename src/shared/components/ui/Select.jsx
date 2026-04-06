import { cn } from "../../lib/cn";

export function Select({ className, ...props }) {
  return (
    <select
      className={cn(
        "w-full h-11 rounded-xl border border-line bg-bg px-3 text-sm text-text outline-none focus:border-primary appearance-none",
        className
      )}
      {...props}
    />
  );
}
