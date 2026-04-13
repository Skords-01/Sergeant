import { forwardRef } from "react";
import { cn } from "../../lib/cn";

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full h-11 rounded-2xl border border-line bg-panelHi px-4 text-sm text-text placeholder:text-subtle/70 outline-none focus:border-muted transition-colors",
        className,
      )}
      {...props}
    />
  );
});
