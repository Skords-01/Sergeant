import { cn } from "../../lib/cn";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn("panel p-4", className)}
      {...props}
    />
  );
}
