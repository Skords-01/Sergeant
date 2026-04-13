import { useRef, useState } from "react";
import { cn } from "@shared/lib/cn";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { useRoutinePushups } from "../hooks/useRoutinePushups.js";

const C = {
  primary: "!bg-[#e0786c] hover:!bg-[#d46356] !text-white border-0",
  barToday: "bg-[#e0786c]",
  barOther: "bg-[#e0786c]/35",
};

export function PushupsWidget() {
  const { todayCount, addReps, recentHistory } = useRoutinePushups();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const ref = useRef(null);
  useDialogFocusTrap(open, ref, { onEscape: () => setOpen(false) });

  return (
    <>
      <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card" aria-label="Відтискання">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-subtle uppercase tracking-widest">Відтискання сьогодні</p>
            <p className="text-4xl font-black text-text tabular-nums mt-1">{todayCount}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setInput("");
              setOpen(true);
            }}
            className="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-transform active:scale-95 bg-[#e0786c] text-white shadow-md"
            aria-label="Додати відтискання"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
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
                const isToday = d.date === new Date().toISOString().slice(0, 10);
                const pct = d.total / max;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className={cn("w-full rounded-t-sm transition-all", isToday ? C.barToday : C.barOther)}
                      style={{ height: `${Math.max(pct * 32, d.total > 0 ? 4 : 0)}px` }}
                      title={`${d.date}: ${d.total}`}
                    />
                    <span className="text-[8px] text-subtle">
                      {new Date(`${d.date}T12:00:00`).toLocaleDateString("uk-UA", { weekday: "narrow" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center" role="presentation">
          <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Закрити" onClick={() => setOpen(false)} />
          <div
            ref={ref}
            className="relative w-full max-w-4xl bg-panel border-t border-line rounded-t-3xl p-5 shadow-soft"
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="routine-pushup-modal-title"
          >
            <div className="w-10 h-1 bg-line rounded-full mx-auto mb-4" aria-hidden />
            <div id="routine-pushup-modal-title" className="text-lg font-extrabold text-text mb-4">
              Додати відтискання
            </div>

            <div className="flex gap-2 mb-4">
              {[5, 10, 15, 20, 25].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    addReps(n);
                    setOpen(false);
                  }}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm border transition-colors active:opacity-90 bg-[#fff0eb] text-[#b45348] border-[#f5c4b8]/80"
                >
                  +{n}
                </button>
              ))}
            </div>

            <p className="text-xs text-subtle mb-2 text-center">або введи кількість вручну</p>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                min="1"
                max="999"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Скільки?"
                className="flex-1 h-12 rounded-2xl border border-line bg-panelHi px-4 text-base text-text outline-none focus:border-[#e0786c]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && input) {
                    addReps(Number(input));
                    setOpen(false);
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                className={cn("h-12 px-6 rounded-2xl font-bold text-[15px] disabled:opacity-40", C.primary)}
                disabled={!input || Number(input) <= 0}
                onClick={() => {
                  addReps(Number(input));
                  setOpen(false);
                }}
              >
                Додати
              </button>
            </div>
            <p className="text-xs text-subtle mt-3 text-center">
              Сьогодні: <span className="font-bold text-text">{todayCount}</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
