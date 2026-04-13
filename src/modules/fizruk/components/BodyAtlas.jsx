import { useEffect, useMemo, useRef, useState } from "react";
import createBodyHighlighter from "body-highlighter";
import { cn } from "@shared/lib/cn";

const STATUS_TO_FREQ = { yellow: 1, red: 2 };

function buildDataFromStatuses(statusByMuscle) {
  const out = [];
  for (const [muscle, status] of Object.entries(statusByMuscle || {})) {
    const freq = STATUS_TO_FREQ[status];
    if (!freq) continue; // green = default bodyColor
    out.push({ name: muscle, muscles: [muscle], frequency: freq });
  }
  return out;
}

export function BodyAtlas({ statusByMuscle, height = 320, showLegend = true }) {
  const [view, setView] = useState("anterior"); // anterior | posterior
  const [selected, setSelected] = useState(null);
  const containerRef = useRef(null);
  const instRef = useRef(null);

  const data = useMemo(
    () => buildDataFromStatuses(statusByMuscle),
    [statusByMuscle],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    if (instRef.current) {
      instRef.current.destroy();
      instRef.current = null;
    }
    const inst = createBodyHighlighter({
      container: containerRef.current,
      type: view,
      data,
      // green as "ready" baseline
      bodyColor: "#16a34a",
      highlightedColors: ["#b45309", "#dc2626"],
      // body-highlighter sometimes injects an SVG with its own height;
      // enforce scaling by constraining container and SVG.
      svgStyle: {
        width: "100%",
        height: "100%",
        maxHeight: "100%",
        display: "block",
      },
      style: { width: "100%", height: "100%" },
      onClick: ({ muscle, data: mdata }) => {
        setSelected({ muscle, ...mdata });
      },
    });
    instRef.current = inst;
    return () => {
      instRef.current?.destroy?.();
      instRef.current = null;
    };
  }, [view, data]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            className={cn(
              "text-xs px-3 py-2 rounded-full border transition-colors",
              view === "anterior"
                ? "bg-text text-white border-text"
                : "border-line text-subtle hover:text-text",
            )}
            onClick={() => setView("anterior")}
          >
            Спереду
          </button>
          <button
            className={cn(
              "text-xs px-3 py-2 rounded-full border transition-colors",
              view === "posterior"
                ? "bg-text text-white border-text"
                : "border-line text-subtle hover:text-text",
            )}
            onClick={() => setView("posterior")}
          >
            Ззаду
          </button>
        </div>
        {showLegend && (
          <div className="flex items-center gap-2 text-xs text-subtle">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success" /> готово
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-warning" /> норм
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-danger" /> рано
            </span>
          </div>
        )}
      </div>

      <div className="bg-bg border border-line rounded-2xl p-3">
        <div
          ref={containerRef}
          className="w-full overflow-hidden"
          style={{ height, maxHeight: height }}
        />
      </div>

      {selected && (
        <div className="text-xs text-subtle">
          Обрано:{" "}
          <span className="font-semibold text-muted">{selected.muscle}</span> ·
          разів:{" "}
          <span className="font-semibold text-muted">
            {selected.frequency || 0}
          </span>
        </div>
      )}
    </div>
  );
}
