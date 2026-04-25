import { cn } from "../../lib/cn";

/**
 * Sergeant Design System — Empty-state illustrations.
 *
 * Lightweight inline SVGs for each module's empty state, sized to feel
 * friendly and inviting. Each variant uses the module's accent palette
 * via `currentColor` so it adapts to light/dark automatically when
 * wrapped in a container with the module text color.
 *
 * Usage with EmptyState:
 *   <EmptyState
 *     icon={<EmptyStateIllustration variant="finyk" />}
 *     title="Ще немає транзакцій"
 *     description="Додайте першу транзакцію, щоб почати."
 *   />
 */

export type IllustrationVariant =
  | "finyk"
  | "fizruk"
  | "routine"
  | "nutrition"
  | "generic";

const wrapperColors: Record<IllustrationVariant, string> = {
  finyk: "text-brand-500",
  fizruk: "text-teal-500",
  routine: "text-coral-500",
  nutrition: "text-lime-600",
  generic: "text-muted",
};

export interface EmptyStateIllustrationProps {
  variant?: IllustrationVariant;
  className?: string;
  size?: number;
}

export function EmptyStateIllustration({
  variant = "generic",
  className,
  size = 80,
}: EmptyStateIllustrationProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        wrapperColors[variant],
        className,
      )}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {illustrations[variant]}
      </svg>
    </div>
  );
}

const illustrations: Record<IllustrationVariant, React.ReactNode> = {
  /* Finyk — wallet / coin stack */
  finyk: (
    <>
      <circle cx="40" cy="40" r="36" fill="currentColor" opacity="0.08" />
      <circle cx="40" cy="40" r="24" fill="currentColor" opacity="0.1" />
      <rect
        x="26"
        y="30"
        width="28"
        height="20"
        rx="4"
        fill="currentColor"
        opacity="0.2"
      />
      <rect
        x="28"
        y="32"
        width="24"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <circle
        cx="40"
        cy="40"
        r="4"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M48 36h6a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),

  /* Fizruk — dumbbell */
  fizruk: (
    <>
      <circle cx="40" cy="40" r="36" fill="currentColor" opacity="0.08" />
      <circle cx="40" cy="40" r="24" fill="currentColor" opacity="0.1" />
      <rect
        x="32"
        y="38"
        width="16"
        height="4"
        rx="2"
        fill="currentColor"
        opacity="0.4"
      />
      <rect
        x="22"
        y="32"
        width="8"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <rect
        x="50"
        y="32"
        width="8"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <line
        x1="30"
        y1="40"
        x2="50"
        y2="40"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </>
  ),

  /* Routine — calendar / checklist */
  routine: (
    <>
      <circle cx="40" cy="40" r="36" fill="currentColor" opacity="0.08" />
      <circle cx="40" cy="40" r="24" fill="currentColor" opacity="0.1" />
      <rect
        x="26"
        y="28"
        width="28"
        height="24"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <line
        x1="26"
        y1="36"
        x2="54"
        y2="36"
        stroke="currentColor"
        strokeWidth="2"
      />
      <line
        x1="33"
        y1="28"
        x2="33"
        y2="24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="47"
        y1="28"
        x2="47"
        y2="24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M34 43l3 3 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </>
  ),

  /* Nutrition — apple / leaf */
  nutrition: (
    <>
      <circle cx="40" cy="40" r="36" fill="currentColor" opacity="0.08" />
      <circle cx="40" cy="40" r="24" fill="currentColor" opacity="0.1" />
      <path
        d="M40 28c-6 0-12 6-12 14s6 14 12 14 12-6 12-14-6-14-12-14Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M40 28c0 0-2-6 4-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M40 32v12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.4"
      />
    </>
  ),

  /* Generic — empty box */
  generic: (
    <>
      <circle cx="40" cy="40" r="36" fill="currentColor" opacity="0.06" />
      <rect
        x="26"
        y="30"
        width="28"
        height="22"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M22 30l18-8 18 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
        opacity="0.5"
      />
      <line
        x1="40"
        y1="22"
        x2="40"
        y2="30"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.3"
      />
    </>
  ),
};
