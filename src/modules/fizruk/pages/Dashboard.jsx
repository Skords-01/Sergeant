import { useState } from "react";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { useRecovery } from "../hooks/useRecovery";
import { useWorkouts } from "../hooks/useWorkouts";
import { BodyAtlas } from "../components/BodyAtlas";

export function Dashboard() {
  const today = new Date().toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });
  const rec = useRecovery();
  const { workouts } = useWorkouts();
  const [atlasOpen, setAtlasOpen] = useState(false);

  const monthCount = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    return (workouts || []).filter(w => {
      const d = w.startedAt ? new Date(w.startedAt) : null;
      return d && d.getFullYear() === y && d.getMonth() === m;
    }).length;
  })();

  const streakDays = (() => {
    const days = new Set((workouts || [])
      .map(w => w.startedAt ? new Date(w.startedAt) : null)
      .filter(Boolean)
      .map(d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()));

    const now = new Date();
    let cur = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let s = 0;
    const DAY = 24 * 60 * 60 * 1000;
    while (days.has(cur)) {
      s += 1;
      cur -= DAY;
    }
    return s;
  })();

  const statusByMuscle = (() => {
    // Map our muscle ids to body-highlighter muscle keys.
    const map = (id) => {
      if (!id) return null;
      if (id === "pectoralis_major" || id === "pectoralis_minor") return "chest";
      if (id === "latissimus_dorsi") return "upper-back";
      if (id === "rhomboids" || id === "upper_back") return "upper-back";
      if (id === "erector_spinae") return "lower-back";
      if (id === "trapezius") return "trapezius";
      if (id === "biceps") return "biceps";
      if (id === "triceps") return "triceps";
      if (id === "forearms") return "forearm";
      if (id === "front_deltoid") return "front-deltoids";
      if (id === "rear_deltoid") return "back-deltoids";
      if (id === "rectus_abdominis") return "abs";
      if (id === "obliques") return "obliques";
      if (id === "quadriceps") return "quadriceps";
      if (id === "hamstrings") return "hamstring";
      if (id === "calves") return "calves";
      if (id === "adductors") return "adductor";
      if (id === "abductors") return "abductors";
      if (id === "gluteus_maximus" || id === "gluteus_medius") return "gluteal";
      if (id === "neck") return "neck";
      return null;
    };
    const worst = (a, b) => (a === "red" || b === "red") ? "red" : (a === "yellow" || b === "yellow") ? "yellow" : "green";
    const out = {};
    for (const m of Object.values(rec.by || {})) {
      const key = map(m.id);
      if (!key) continue;
      out[key] = out[key] ? worst(out[key], m.status) : m.status;
    }
    return out;
  })();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-16 space-y-3">

        <div className="bg-panel border border-line rounded-3xl p-5 shadow-float">
          <div className="text-xs text-subtle capitalize">{today}</div>
          <div className="text-3xl font-bold mt-2 text-text">Привіт, тренере 💪</div>
          <div className="text-sm text-subtle mt-1">Відновлення, баланс та план на сьогодні</div>
        </div>

        <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium text-subtle">Статус відновлення</div>
            <Button variant="ghost" size="sm" className="h-9 px-4" onClick={() => setAtlasOpen(true)}>
              На весь екран
            </Button>
          </div>
          <BodyAtlas statusByMuscle={statusByMuscle} height={220} showLegend={false} />
        </div>

        <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
          <div className="text-xs font-medium text-subtle mb-3">План на сьогодні</div>
          {rec.ready?.length ? (
            <div className="space-y-2">
              {rec.ready.slice(0, 3).map(m => (
                <div key={m.id} className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-text">{m.label}</div>
                  <div className="text-xs text-subtle">{m.daysSince == null ? "—" : `${m.daysSince} дн`}</div>
                </div>
              ))}
              {rec.avoid?.length ? (
                <div className="text-xs text-warning mt-2">Уникай сьогодні: {rec.avoid.map(x => x.label).join(", ")}</div>
              ) : null}
            </div>
          ) : (
            <div className="text-sm text-subtle text-center py-6">Додай перше тренування, щоб зʼявились рекомендації</div>
          )}
        </div>

        <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
          <div className="text-xs font-medium text-subtle mb-3">Баланс (найбільш “забуті”)</div>
          <div className="space-y-2">
            {(rec.list || []).slice(0, 7).map(m => (
              <div key={m.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("w-2.5 h-2.5 rounded-full inline-block", m.status === "red" ? "bg-danger" : m.status === "yellow" ? "bg-warning" : "bg-success")} />
                  <div className="text-sm text-text truncate">{m.label}</div>
                </div>
                <div className="text-xs text-subtle shrink-0">{m.daysSince == null ? "—" : `${m.daysSince} дн`}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Тренувань", value: String(monthCount), sub: "цього місяця" },
            { label: "Серія", value: String(streakDays), sub: "днів поспіль" },
            { label: "Ціль", value: "—", sub: "не задана" },
          ].map((s, i) => (
            <div key={i} className="bg-panel border border-line/60 rounded-2xl p-3 shadow-card text-center">
              <div className="text-xl font-bold text-text">{s.value}</div>
              <div className="text-[10px] font-semibold text-subtle mt-0.5">{s.label}</div>
              <div className="text-[9px] text-subtle/60 mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

      </div>

      {atlasOpen && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setAtlasOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-line rounded-full" />
            </div>
            <div className="px-5 pb-6">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="text-lg font-extrabold text-text leading-tight">Атлас мʼязів</div>
                  <div className="text-xs text-subtle mt-1">Зелений/жовтий/червоний — за відновленням</div>
                </div>
                <button
                  onClick={() => setAtlasOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="bg-bg border border-line rounded-2xl p-3">
                <BodyAtlas statusByMuscle={statusByMuscle} height={420} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
