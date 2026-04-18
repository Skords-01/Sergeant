import { useMemo, useState } from "react";
import { cn } from "@shared/lib/cn";
import { EmptyState } from "@shared/components/ui/EmptyState";
import { MEASURE_FIELDS, useMeasurements } from "../hooks/useMeasurements";

const inp =
  "w-full h-11 rounded-2xl border border-line bg-panelHi px-4 text-text outline-none focus:border-muted transition-colors";

export function Measurements() {
  const { entries, addEntry, deleteEntry } = useMeasurements();
  const [form, setForm] = useState(() =>
    Object.fromEntries(MEASURE_FIELDS.map((f) => [f.id, ""])),
  );

  const latest = entries[0] || null;
  const deltas = useMemo(() => {
    const prev = entries[1] || null;
    if (!latest || !prev) return {};
    const out = {};
    for (const f of MEASURE_FIELDS) {
      const a = Number(latest[f.id]);
      const b = Number(prev[f.id]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      const d = a - b;
      if (d === 0) continue;
      out[f.id] = d;
    }
    return out;
  }, [entries, latest]);

  const stats = useMemo(() => {
    const total = entries?.length || 0;
    const latestAt = latest?.at
      ? new Date(latest.at).toLocaleDateString("uk-UA", {
          day: "numeric",
          month: "short",
        })
      : "—";
    const filledLatest = latest
      ? MEASURE_FIELDS.filter(
          (f) => latest[f.id] != null && latest[f.id] !== "",
        ).length
      : 0;
    return { total, latestAt, filledLatest };
  }, [entries, latest]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad space-y-3">
        <a
          href="https://www.wikihow.com/Take-Body-Measurements"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 bg-panel border border-line/60 rounded-2xl p-4 shadow-card"
        >
          <div className="shrink-0 w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-subtle uppercase tracking-widest">
              Мануал
            </div>
            <div className="text-sm font-semibold text-success mt-0.5">
              Як правильно робити заміри →
            </div>
          </div>
        </a>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-panel border border-line/60 rounded-2xl p-3 shadow-card text-center">
            <div className="text-[10px] font-semibold text-subtle uppercase tracking-widest">
              Записів
            </div>
            <div className="text-lg font-extrabold text-text tabular-nums mt-1">
              {stats.total}
            </div>
          </div>
          <div className="bg-panel border border-line/60 rounded-2xl p-3 shadow-card text-center">
            <div className="text-[10px] font-semibold text-subtle uppercase tracking-widest">
              Останній
            </div>
            <div className="text-sm font-bold text-text mt-1">
              {stats.latestAt}
            </div>
          </div>
          <div className="bg-panel border border-line/60 rounded-2xl p-3 shadow-card text-center">
            <div className="text-[10px] font-semibold text-subtle uppercase tracking-widest">
              Полів
            </div>
            <div className="text-lg font-extrabold text-text tabular-nums mt-1">
              {stats.filledLatest}
            </div>
          </div>
        </div>

        <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
          <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">
            Додати замір
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MEASURE_FIELDS.map((f) => (
              <div key={f.id} className="space-y-1">
                <div className="text-[10px] font-bold text-subtle uppercase tracking-widest px-1">
                  {f.label} · {f.unit}
                </div>
                <input
                  className={inp}
                  inputMode="decimal"
                  placeholder="—"
                  value={form[f.id]}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, [f.id]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <button
              type="button"
              className="w-full py-4 rounded-full font-bold text-[15px] bg-fizruk text-white transition-all active:scale-[0.98]"
              onClick={() => {
                const payload = {};
                for (const f of MEASURE_FIELDS) {
                  const v = (form[f.id] || "").trim();
                  if (v) payload[f.id] = Number(v.replace(",", "."));
                }
                addEntry(payload);
                setForm(
                  Object.fromEntries(MEASURE_FIELDS.map((f) => [f.id, ""])),
                );
              }}
            >
              Зберегти замір
            </button>
          </div>
        </div>

        {latest && (
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-subtle uppercase tracking-widest">
                  Останній замір{" "}
                  <span className="ml-1 normal-case tracking-normal font-medium text-subtle">
                    · {stats.latestAt}
                  </span>
                </div>
              </div>
              <div className="text-xs text-subtle">
                {Object.keys(deltas).length ? "Δ від попереднього" : ""}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {MEASURE_FIELDS.map((f) => (
                <div
                  key={f.id}
                  className="bg-bg border border-line rounded-2xl p-3"
                >
                  <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">
                    {f.label}
                  </div>
                  <div className="text-lg font-extrabold tabular-nums text-text mt-1">
                    {Number.isFinite(Number(latest[f.id]))
                      ? Number(latest[f.id]).toLocaleString("uk-UA")
                      : "—"}{" "}
                    {f.unit}
                  </div>
                  {deltas[f.id] != null && (
                    <div
                      className={cn(
                        "text-xs font-semibold mt-1",
                        deltas[f.id] > 0 ? "text-warning" : "text-success",
                      )}
                    >
                      {deltas[f.id] > 0 ? "+" : ""}
                      {deltas[f.id].toFixed(1)} {f.unit}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-panel border border-line/60 rounded-2xl shadow-card overflow-hidden">
          <div className="px-4 py-3 bg-panelHi/60 border-b border-line">
            <div className="text-xs font-bold text-subtle uppercase tracking-widest">
              Історія
            </div>
          </div>
          {(entries || []).map((e) => (
            <div
              key={e.id}
              className="px-4 py-3 border-b border-line last:border-0"
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-text">
                  {new Date(e.at).toLocaleDateString("uk-UA", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <button
                  className="text-xs text-danger/80 hover:text-danger"
                  onClick={() => deleteEntry(e.id)}
                >
                  Видалити
                </button>
              </div>
              <div className="text-xs text-subtle mt-1">
                {MEASURE_FIELDS.filter((f) => e[f.id] != null && e[f.id] !== "")
                  .slice(0, 4)
                  .map(
                    (f) =>
                      `${f.label}: ${Number(e[f.id]).toLocaleString("uk-UA")} ${f.unit}`,
                  )
                  .join(" · ") || "—"}
              </div>
            </div>
          ))}
          {(entries || []).length === 0 && (
            <EmptyState
              compact
              title="Поки замірів немає"
              description="Додай перший запис, щоб бачити динаміку показників."
            />
          )}
        </div>
      </div>
    </div>
  );
}
