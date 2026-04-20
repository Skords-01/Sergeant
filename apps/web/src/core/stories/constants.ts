// Duration per story slide in ms. Slightly longer than Instagram's ~5s because
// we're showing denser numeric content, not photos.
export const SLIDE_MS = 6500;

// Minimum vertical drag (px) required to trigger close-on-swipe-down.
export const SWIPE_CLOSE_THRESHOLD = 80;

// Press-and-hold threshold (ms): shorter than this counts as a tap, longer
// than this promotes the gesture to a pause.
export const HOLD_THRESHOLD_MS = 180;

// Max visual translate when dragging down; past this we plateau so the
// overlay never detaches from the finger.
export const MAX_DRAG_TRANSLATE = 260;

export const BG_GRADIENTS = {
  intro:
    "from-brand-500 via-brand-400 to-teal-400 dark:from-brand-700 dark:via-brand-600 dark:to-teal-600",
  finyk:
    "from-brand-600 via-brand-500 to-indigo-400 dark:from-brand-800 dark:via-brand-700 dark:to-indigo-700",
  fizruk:
    "from-teal-500 via-teal-400 to-cyan-400 dark:from-teal-700 dark:via-teal-600 dark:to-cyan-700",
  nutrition:
    "from-lime-500 via-lime-400 to-emerald-400 dark:from-lime-700 dark:via-lime-600 dark:to-emerald-700",
  routine:
    "from-coral-500 via-coral-400 to-rose-400 dark:from-coral-700 dark:via-coral-600 dark:to-rose-700",
  overall:
    "from-amber-500 via-orange-400 to-coral-400 dark:from-amber-700 dark:via-orange-600 dark:to-coral-700",
} as const;
