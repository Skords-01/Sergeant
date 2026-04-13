import { BodyAtlas } from "../components/BodyAtlas";
import { useRecovery } from "../hooks/useRecovery";

export function Atlas() {
  const rec = useRecovery();

  const statusByMuscle = (() => {
    // Map our muscle ids to body-highlighter muscle keys.
    const map = (id) => {
      if (!id) return null;
      if (id === "pectoralis_major" || id === "pectoralis_minor")
        return "chest";
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
    const worst = (a, b) =>
      a === "red" || b === "red"
        ? "red"
        : a === "yellow" || b === "yellow"
          ? "yellow"
          : "green";
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
      <div className="max-w-4xl mx-auto px-4 pt-4 fizruk-page-scroll-pad space-y-3">
        <section
          className="rounded-3xl p-5 border border-line/20"
          style={{
            background: "linear-gradient(135deg, #0f2d1a 0%, #1e4d2b 100%)",
          }}
          aria-label="Атлас мʼязів"
        >
          <p className="text-[11px] font-bold tracking-widest uppercase text-accent">
            Атлас мʼязів
          </p>
          <h1 className="text-2xl font-black text-white mt-2 leading-tight">
            Стан відновлення
          </h1>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-success inline-block" />
              <span className="text-xs text-white/70">Готовий</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block" />
              <span className="text-xs text-white/70">Відновлюється</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-danger inline-block" />
              <span className="text-xs text-white/70">Уникати</span>
            </div>
          </div>
        </section>

        <div className="bg-panel border border-line/60 rounded-2xl p-5 shadow-card">
          <BodyAtlas
            statusByMuscle={statusByMuscle}
            height={520}
            showLegend={false}
          />
        </div>
      </div>
    </div>
  );
}
