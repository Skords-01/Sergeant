/**
 * Collapsible weekly macro table for the nutrition journal.
 *
 * Phase 2 / round-2 decomposition (initiative 0001 carry-over → 0013):
 * extracted from `LogCard.tsx` so the journal entry is below the
 * 600-LOC ESLint guard. Owns its `weekOpen` toggle and renders the
 * last 7 days of macros for `selectedDate`.
 */

import { useMemo, useState } from "react";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { Icon } from "@shared/components/ui/Icon";
import { cn } from "@shared/lib/ui/cn";
import type { NutritionLog } from "@sergeant/nutrition-domain";
import { getMacrosForDateRange } from "../lib/nutritionStorage";

interface LogWeekTableProps {
  log: NutritionLog;
  selectedDate: string;
}

export function LogWeekTable({ log, selectedDate }: LogWeekTableProps) {
  const [weekOpen, setWeekOpen] = useState(false);
  const weekRows = useMemo(
    () => getMacrosForDateRange(log, selectedDate, 7),
    [log, selectedDate],
  );

  return (
    <>
      <SectionHeading
        as="button"
        size="xs"
        type="button"
        onClick={() => setWeekOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left py-1"
      >
        <Icon
          name="chevron-right"
          size={12}
          strokeWidth={2.5}
          className={cn(
            "transition-transform shrink-0",
            weekOpen ? "rotate-90" : "",
          )}
        />
        Журнал за тиждень
      </SectionHeading>

      {weekOpen && (
        <div className="rounded-2xl border border-line bg-panel/40 px-3 py-3">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-subtle">
                  <th className="py-1 pr-2">Дата</th>
                  <th className="py-1 pr-2">Ккал</th>
                  <th className="py-1 pr-2">Б</th>
                  <th className="py-1 pr-2">Ж</th>
                  <th className="py-1">В</th>
                </tr>
              </thead>
              <tbody>
                {weekRows.map((r) => (
                  <tr key={r.date} className="border-t border-line/40">
                    <td className="py-1 pr-2 font-mono text-2xs">
                      {r.date.slice(5)}
                    </td>
                    <td className="py-1 pr-2">{Math.round(r.kcal)}</td>
                    <td className="py-1 pr-2">{Math.round(r.protein_g)}</td>
                    <td className="py-1 pr-2">{Math.round(r.fat_g)}</td>
                    <td className="py-1">{Math.round(r.carbs_g)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
