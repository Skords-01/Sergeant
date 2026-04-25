/**
 * Brand logo mark — styled "Sergeant" title with military chevron accent.
 *
 * Renders a small three-chevron SVG (sergeant rank insignia) in brand
 * emerald alongside the app name in DM Sans ExtraBold with a subtle
 * text gradient that adapts to light/dark themes via CSS variables.
 *
 * Used in HubHeader, AuthPage, ResetPasswordPage and OnboardingWizard.
 */

const CHEVRON_ICON = (
  <svg
    viewBox="0 0 18 18"
    width={18}
    height={18}
    fill="none"
    aria-hidden="true"
    className="shrink-0"
  >
    <path
      d="M3 6.5 L9 3 L15 6.5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 10.5 L9 7 L15 10.5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 14.5 L9 11 L15 14.5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const GRADIENT_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(135deg, rgb(var(--c-text)) 50%, rgb(var(--c-accent)))",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

interface BrandLogoProps {
  /** Extra Tailwind classes for the outer wrapper. */
  className?: string;
  /** Size variant. "lg" is the hub header, "md" is auth/onboarding. */
  size?: "lg" | "md";
}

export function BrandLogo({ className, size = "lg" }: BrandLogoProps) {
  const textCls =
    size === "lg"
      ? "text-[26px] leading-none font-extrabold tracking-tight"
      : "text-2xl leading-none font-extrabold tracking-tight";

  return (
    <span
      className={`inline-flex items-center gap-1.5 select-none text-brand-500 ${className ?? ""}`}
    >
      {CHEVRON_ICON}
      <span className={textCls} style={GRADIENT_STYLE}>
        Sergeant
      </span>
    </span>
  );
}
