/**
 * Brand logo mark — Sergeant chevron badge + wordmark.
 *
 * Renders a rounded emerald badge with three white sergeant chevrons
 * paired with the "Sergeant" wordmark in DM Sans ExtraBold.
 *
 * Variants:
 *   - "badge" (default): 32px rounded badge + wordmark side by side.
 *     Used in HubHeader, AuthPage, ResetPasswordPage.
 *   - "inline":           chevron icon inline with text (no badge).
 *     Used in OnboardingWizard inside a sentence.
 *
 * Sizes:
 *   - "lg": hub header — bigger badge + 22px wordmark.
 *   - "md": auth/onboarding — smaller badge + 18px wordmark.
 */

interface ChevronMarkProps {
  size: number;
}

function ChevronMark({ size }: ChevronMarkProps) {
  return (
    <svg
      viewBox="0 0 18 18"
      width={size}
      height={size}
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
}

type TagName = "span" | "h1" | "h2" | "h3" | "div";

interface BrandLogoProps {
  /** Extra Tailwind classes for the outer wrapper. */
  className?: string;
  /** Size variant. "lg" is the hub header, "md" is auth/onboarding. */
  size?: "lg" | "md";
  /** HTML element for the outer wrapper (default "span"). Use "h1" on pages that need a heading landmark. */
  as?: TagName;
  /**
   * "badge" (default) renders the chevron inside an emerald rounded square
   * next to the wordmark. "inline" renders a flat chevron icon next to the
   * wordmark — used when the logo appears mid-sentence.
   */
  variant?: "badge" | "inline";
}

export function BrandLogo({
  className,
  size = "lg",
  as: Tag = "span",
  variant = "badge",
}: BrandLogoProps) {
  const wordmarkCls =
    size === "lg"
      ? "text-[22px] leading-none font-extrabold tracking-tight"
      : "text-[18px] leading-none font-extrabold tracking-tight";

  if (variant === "inline") {
    const iconSize = size === "lg" ? 20 : 18;
    return (
      <Tag
        className={`inline-flex items-center gap-1.5 select-none text-brand-500 ${className ?? ""}`}
      >
        <ChevronMark size={iconSize} />
        <span className={`${wordmarkCls} text-text`}>Sergeant</span>
      </Tag>
    );
  }

  const badgePx = size === "lg" ? 32 : 28;
  const chevronPx = size === "lg" ? 20 : 18;
  const radiusPx = size === "lg" ? 10 : 9;
  const gapCls = size === "lg" ? "gap-2.5" : "gap-2";

  return (
    <Tag
      className={`inline-flex items-center select-none ${gapCls} ${className ?? ""}`}
    >
      <span
        aria-hidden="true"
        className="inline-flex items-center justify-center bg-brand-500 text-white shadow-[0_1px_2px_rgba(16,185,129,0.25),0_4px_12px_-2px_rgba(16,185,129,0.35)]"
        style={{
          width: badgePx,
          height: badgePx,
          borderRadius: radiusPx,
        }}
      >
        <ChevronMark size={chevronPx} />
      </span>
      <span className={`${wordmarkCls} text-text`}>Sergeant</span>
    </Tag>
  );
}
