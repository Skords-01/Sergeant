/**
 * Button preset class strings — shared presets for hand-rolled <button>
 * elements that don't fit the <Button> variants cleanly.
 *
 * Prefer <Button variant="…"> when possible. Use these presets only for
 * the specific patterns below.
 */

/**
 * Subtle nav-style secondary button. Used in page headers for "Прогрес →",
 * "Програми →", "Виміри" navigation links.
 *
 * h-9, 12px text, subtle color by default, hover lifts to panelHi.
 */
export const subtleNavButtonClass =
  "h-9 px-3 rounded-xl border border-line text-xs font-semibold text-subtle hover:text-text hover:bg-panelHi transition-colors";

/**
 * Compact retro/toolbar button. h-8, tighter padding.
 */
export const compactToolbarButtonClass =
  "h-8 px-2.5 rounded-lg border border-line text-xs text-subtle hover:text-text hover:bg-panel transition-colors";
