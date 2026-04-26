/**
 * Shared chart theme tokens — barrel.
 *
 * Prefer importing from `@shared/charts` instead of deep paths so renames
 * stay cheap and IDE autocomplete surfaces the full API:
 *
 *   import { chartSeries, chartAxis, THEME_HEX } from "@shared/charts";
 */

export {
  brandColors,
  chartAxis,
  chartGradients,
  chartGrid,
  chartHeatmap,
  chartPalette,
  chartPaletteList,
  chartSeries,
  chartTick,
  moduleColors,
  statusColors,
} from "./chartTheme";
