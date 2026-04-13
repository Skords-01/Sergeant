import { useRef, useState, useEffect } from "react";
import { cn } from "@shared/lib/cn";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { useRoutinePushups } from "../hooks/useRoutinePushups.js";
import { useVisualKeyboardInset } from "../hooks/useVisualKeyboardInset.js";

const C = {
  primary: "!bg-routine hover:!bg-routine-hover !text-white border-0",
  barToday: "bg-routine",
  barOther: "bg-routine/35",
};

export function PushupsWidget() {
  const { todayCount, addReps, recentHistory } = useRoutinePushups();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);
  const keyboardInset = useVisualKeyboardInset(open);
  useDialogFocusTrap(open, ref, { onEscape: () => setOpen(false) });

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <>
      <section
        className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card"
        aria-label="Відтискання"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-subtle uppercase tracking-widest">
              Відтискання сьогодні
            </p>
            <p className="text-4xl font-black text-text tabular-nums mt-1">
              {todayCount}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setInput("");
              setOpen(true);
            }}
            className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-transform active:scale-95 bg-routine text-white shadow-md"
            aria-label="Додати відтискання"
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {recentHistory.some((d) => d.total > 0) && (
          <div className="mt-4 pt-3 border-t border-line/60">
            <p className="text-[10px] text-subtle mb-2">Останні 7 днів</p>
            <div className="flex items-end gap-1 h-10">
              {recentHistory.map((d) => {
                const max = Math.max(...recentHistory.map((x) => x.total), 1);
                const isToday =
                  d.date === new Date().toISOString().slice(0, 10);
                const pct = d.total / max;
                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center gap-0.5"
                  >
                    <div
                      className={cn(
                        "w-full rounded-t-sm transition-all",
                        isToday ? C.barToday : C.barOther,
                      )}
                      style={{
                        height: `${Math.max(pct * 32, d.total > 0 ? 4 : 0)}px`,
                      }}
                      title={`${d.date}: ${d.total}`}
                    />
                    <span className="text-[8px] text-subtle">
                      {new Date(`${d.date}T12:00:00`).toLocaleDateString(
                        "uk-UA",
                        { weekday: "narrow" },
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {open && (
        <div
          className="routine-sheet fixed inset-0 z-[200] flex items-end justify-center"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Закрити"
            onClick={() => setOpen(false)}
          />
          <div
            ref={ref}
            className="routine-sheet-pad relative max-h-[min(92dvh,100%)] w-full max-w-4xl overflow-y-auto overflow-x-hidden rounded-t-3xl border-t border-line bg-panel p-5 shadow-soft transition-transform duration-150 ease-out"
            style={{
              transform:
                keyboardInset > 0
                  ? `translateY(-${keyboardInset}px)`
                  : undefined,
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="routine-pushup-modal-title"
          >
            <div
              className="w-10 h-1 shrink-0 rounded-full bg-line mx-auto mb-4"
              aria-hidden
            />
            <div
              id="routine-pushup-modal-title"
              className="text-lg font-extrabold text-text mb-4"
            >
              Додати відтискання
            </div>

            <div className="mb-4 grid grid-cols-5 gap-1.5 sm:gap-2">
              {[5, 10, 15, 20, 25].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    addReps(n);
                    setOpen(false);
                  }}
                  className="min-h-[44px] rounded-2xl border border-routine-line/80 bg-routine-surface px-1 py-2.5 text-center text-xs font-bold text-routine-kicker transition-colors active:opacity-90 sm:px-2 sm:text-sm"
                >
                  +{n}
                </button>
              ))}
            </div>

            <p className="mb-2 text-center text-xs text-subtle">
              або введи кількість вручну
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <input
                ref={inputRef}
                type="number"
                inputMode="numeric"
                min="1"
                max="999"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Скільки?"
                className="routine-touch-field min-h-[48px] min-w-0 flex-1 rounded-2xl border border-line bg-panelHi px-4 text-text outline-none focus:border-routine [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && input) {
                    addReps(Number(input));
                    setOpen(false);
                  }
                }}
              />
              <button
                type="button"
                className={cn(
                  "min-h-[48px] w-full shrink-0 rounded-2xl px-6 text-base font-bold disabled:opacity-40 sm:w-auto sm:min-w-[7rem]",
                  C.primary,
                )}
                disabled={!input || Number(input) <= 0}
                onClick={() => {
                  addReps(Number(input));
                  setOpen(false);
                }}
              >
                Додати
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-subtle">
              Сьогодні:{" "}
              <span className="font-bold text-text">{todayCount}</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
