export type SlideKind =
  | "intro"
  | "finyk"
  | "fizruk"
  | "nutrition"
  | "routine"
  | "overall";

export interface Slide {
  id: string;
  kind: SlideKind;
  label: string;
  bg: string;
  // The aggregates come from `useWeeklyDigest.js` which is still untyped
  // JavaScript; pinning them here would mean typing that module first.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agg?: any;
  // AI summaries have the shape { summary?: string; comment?: string }
  // but are delivered by an untyped API payload.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ai?: any;
  recommendations?: string[];
  weekRange?: string;
}

export type TapZone = "prev" | "next";

export type PauseReason = "hold" | "explicit" | "drag";
