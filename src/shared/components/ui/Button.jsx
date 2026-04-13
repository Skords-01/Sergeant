import { cn } from "../../lib/cn";

const variants = {
  primary: "bg-text text-white hover:bg-text/85 active:bg-text/90",
  ghost:
    "bg-transparent text-muted border border-line hover:bg-panelHi hover:text-text",
  danger: "bg-danger/10 text-danger border border-danger/25 hover:bg-danger/15",
};

const sizes = {
  md: "h-11 px-5 text-sm font-semibold rounded-2xl",
  sm: "h-9 px-3 text-sm font-medium rounded-xl",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
