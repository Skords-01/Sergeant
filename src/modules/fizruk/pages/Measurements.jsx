import { useMemo, useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { MEASURE_FIELDS, useMeasurements } from "../hooks/useMeasurements";

const inp = "w-full h-11 rounded-2xl border border-line bg-panelHi px-4 text-text outline-none focus:border-muted transition-colors";

export function Measurements() {
  const { entries, addEntry, deleteEntry } = useMeasurements();
  const [form, setForm] = useState(() => Object.fromEntries(MEASURE_FIELDS.map(f => [f.id, ""])));

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

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))] space-y-3">
        <section
          className="rounded-3xl p-4 border border-line/20"
          style={{ background: "linear-gradient(135deg, #0f2d1a 0%, #1e4d2b 100%)" }}
          aria-label="Огляд замірів"
        >
          <div className="text-[11px] font-bold tracking-widest uppercase text-accent">Заміри</div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="rounded-xl bg-white/10 border border-white/15 p-3 text-center">
              <div className="text-[10px] uppercase tracking-wide text-white/60">Записів</div>
              <div className="text-lg font-black text-white tabular-nums">{entries.length}</div>
            </div>
            <div className="rounded-xl bg-white/10 border border-white/15 p-3 text-center">
              <div className="text-[10px] uppercase tracking-wide text-white/60">Останній</div>
              <div className="text-sm font-bold text-white tabular-nums mt-0.5">
                {latest ? new Date(latest.at).toLocaleDateString("uk-UA", { day: "numeric", month: "short" }) : "—"}
              </div>
            </div>
          </div>
        </section>

        <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
          <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">Додати замір</div>
          <div className="grid grid-cols-2 gap-2">
            {MEASURE_FIELDS.map(f => (
              <div key={f.id} className="space-y-1">
                <div className="text-[10px] font-bold text-subtle uppercase tracking-widest px-1">
                  {f.label} · {f.unit}
                </div>
                <input
                  className={inp}
                  inputMode="decimal"
                  placeholder="—"
                  value={form[f.id]}
                  onChange={(e) => setForm(s => ({ ...s, [f.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Button
              className="w-full h-12"
              onClick={() => {
                const payload = {};
                for (const f of MEASURE_FIELDS) {
                  const v = (form[f.id] || "").trim();
                  if (v) payload[f.id] = Number(v.replace(",", "."));
                }
                addEntry(payload);
                setForm(Object.fromEntries(MEASURE_FIELDS.map(f => [f.id, ""])));
              }}
            >
              Зберегти
            </Button>
          </div>
        </div>

        {latest && (
          <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-subtle uppercase tracking-widest">Останній замір</div>
                <div className="text-xs text-subtle mt-1">{new Date(latest.at).toLocaleString("uk-UA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <div className="text-xs text-subtle">
                {Object.keys(deltas).length ? "Δ від попереднього" : ""}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {MEASURE_FIELDS.map(f => (
                <div key={f.id} className="bg-bg border border-line rounded-2xl p-3">
                  <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">{f.label}</div>
                  <div className="text-lg font-extrabold tabular-nums text-text mt-1">
                    {Number.isFinite(Number(latest[f.id])) ? Number(latest[f.id]).toLocaleString("uk-UA") : "—"} {f.unit}
                  </div>
                  {deltas[f.id] != null && (
                    <div className={cn("text-xs font-semibold mt-1", deltas[f.id] > 0 ? "text-warning" : "text-success")}>
                      {deltas[f.id] > 0 ? "+" : ""}{deltas[f.id].toFixed(1)} {f.unit}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-panel border border-line/60 rounded-2xl shadow-card overflow-hidden">
          <div className="px-4 py-3 bg-panelHi/60 border-b border-line">
            <div className="text-xs font-bold text-subtle uppercase tracking-widest">Історія</div>
          </div>
          {(entries || []).map(e => (
            <div key={e.id} className="px-4 py-3 border-b border-line last:border-0">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-text">
                  {new Date(e.at).toLocaleDateString("uk-UA", { month: "short", day: "numeric", year: "numeric" })}
                </div>
                <button className="text-xs text-danger/80 hover:text-danger" onClick={() => deleteEntry(e.id)}>
                  Видалити
                </button>
              </div>
              <div className="text-xs text-subtle mt-1">
                {MEASURE_FIELDS
                  .filter(f => e[f.id] != null && e[f.id] !== "")
                  .slice(0, 4)
                  .map(f => `${f.label}: ${Number(e[f.id]).toLocaleString("uk-UA")} ${f.unit}`)
                  .join(" · ") || "—"}
              </div>
            </div>
          ))}
          {(entries || []).length === 0 && (
            <div className="p-6 text-center text-sm text-subtle">Поки замірів немає</div>
          )}
        </div>
      </div>
    </div>
  );
}
