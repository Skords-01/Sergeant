import { useMemo, useState } from "react";
import { subtleNavButtonClass } from "@shared/components/ui/buttonPresets";
import { cn } from "@shared/lib/cn";
import { useDailyLog } from "../hooks/useDailyLog";
import { MiniLineChart } from "../components/MiniLineChart";
import { PhotoProgress } from "../components/PhotoProgress";

const ENERGY_LABELS = [
  "",
  "Виснажений",
  "Втомлений",
  "Нормально",
  "Добре",
  "Відмінно",
];
const MOOD_LABELS = [
  "",
  "Пригнічений",
  "Поганий",
  "Нейтральний",
  "Гарний",
  "Чудовий",
];

function ScoreButton({ value, selected, onClick, label }) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={cn(
        "flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition-all",
        selected
          ? "bg-success text-white border-success"
          : "border-line text-subtle hover:border-success/50 hover:text-text",
      )}
      aria-pressed={selected}
      title={label}
    >
      <span className="text-base leading-none">{value}</span>
      <span
        className={cn(
          "text-3xs leading-none truncate max-w-full px-1",
          selected ? "text-white/80" : "text-muted",
        )}
      >
        {label}
      </span>
    </button>
  );
}

export function Body({ onOpenMeasurements }) {
  const { entries, addEntry, deleteEntry, recentWith } = useDailyLog();

  const [form, setForm] = useState({
    weightKg: "",
    sleepHours: "",
    energyLevel: null,
    moodScore: null,
    note: "",
  });
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const entry = {
      weightKg: form.weightKg !== "" ? Number(form.weightKg) : null,
      sleepHours: form.sleepHours !== "" ? Number(form.sleepHours) : null,
      energyLevel: form.energyLevel,
      moodScore: form.moodScore,
      note: form.note.trim(),
    };
    addEntry(entry);
    setForm({
      weightKg: "",
      sleepHours: "",
      energyLevel: null,
      moodScore: null,
      note: "",
    });
    setSubmitSuccess(true);
    setTimeout(() => setSubmitSuccess(false), 2000);
  };

  const weightData = useMemo(() => {
    const recent = recentWith("weightKg", 30);
    return recent
      .slice()
      .reverse()
      .map((e) => ({
        value: e.weightKg,
        label: new Date(e.at).toLocaleDateString("uk-UA", {
          day: "numeric",
          month: "short",
        }),
      }));
  }, [recentWith]);

  const sleepData = useMemo(() => {
    const recent = recentWith("sleepHours", 20);
    return recent
      .slice()
      .reverse()
      .map((e) => ({
        value: e.sleepHours,
        label: new Date(e.at).toLocaleDateString("uk-UA", {
          day: "numeric",
          month: "short",
        }),
      }));
  }, [recentWith]);

  const energyData = useMemo(() => {
    const recent = recentWith("energyLevel", 20);
    return recent
      .slice()
      .reverse()
      .map((e) => ({
        value: e.energyLevel,
        label: new Date(e.at).toLocaleDateString("uk-UA", {
          day: "numeric",
          month: "short",
        }),
      }));
  }, [recentWith]);

  const moodData = useMemo(() => {
    const recent = recentWith("moodScore", 20);
    return recent
      .slice()
      .reverse()
      .map((e) => ({
        value: e.moodScore,
        label: new Date(e.at).toLocaleDateString("uk-UA", {
          day: "numeric",
          month: "short",
        }),
      }));
  }, [recentWith]);

  const stats = useMemo(() => {
    const wEntries = recentWith("weightKg", 7);
    const sEntries = recentWith("sleepHours", 7);
    const eEntries = recentWith("energyLevel", 7);
    const avgSleep =
      sEntries.length > 0
        ? sEntries.reduce((s, e) => s + (e.sleepHours || 0), 0) /
          sEntries.length
        : null;
    const avgEnergy =
      eEntries.length > 0
        ? eEntries.reduce((s, e) => s + (e.energyLevel || 0), 0) /
          eEntries.length
        : null;
    const latestWeight = wEntries[0]?.weightKg ?? null;
    return { latestWeight, avgSleep, avgEnergy };
  }, [recentWith]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 pt-4 page-tabbar-pad space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-text">Тіло</h1>
            <p className="text-xs text-subtle mt-0.5">
              Вага · сон · самопочуття
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-xs text-subtle">Вага</div>
              <div className="text-base font-extrabold text-text tabular-nums">
                {stats.latestWeight != null ? `${stats.latestWeight} кг` : "—"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-subtle">Сон</div>
              <div className="text-base font-extrabold text-text tabular-nums">
                {stats.avgSleep != null
                  ? `${stats.avgSleep.toFixed(1)} г`
                  : "—"}
              </div>
            </div>
            {onOpenMeasurements && (
              <button
                type="button"
                onClick={onOpenMeasurements}
                className={subtleNavButtonClass}
              >
                Виміри
              </button>
            )}
          </div>
        </div>

        <section
          className="bg-panel border border-line rounded-2xl p-4 shadow-card"
          aria-label="Записати показники"
        >
          <h2 className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">
            Записати сьогодні
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="body-weight"
                  className="text-2xs font-bold text-subtle uppercase tracking-widest block mb-1"
                >
                  Вага (кг)
                </label>
                <input
                  id="body-weight"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="20"
                  max="300"
                  className="w-full h-11 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none focus:border-success/60 transition-colors"
                  placeholder="70.5"
                  value={form.weightKg}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, weightKg: e.target.value }))
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="body-sleep"
                  className="text-2xs font-bold text-subtle uppercase tracking-widest block mb-1"
                >
                  Сон (год)
                </label>
                <input
                  id="body-sleep"
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0"
                  max="24"
                  className="w-full h-11 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none focus:border-success/60 transition-colors"
                  placeholder="8.0"
                  value={form.sleepHours}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sleepHours: e.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <p className="text-2xs font-bold text-subtle uppercase tracking-widest mb-2">
                Рівень енергії
              </p>
              <div
                className="flex gap-1.5"
                role="group"
                aria-label="Рівень енергії"
              >
                {[1, 2, 3, 4, 5].map((v) => (
                  <ScoreButton
                    key={v}
                    value={v}
                    label={ENERGY_LABELS[v]}
                    selected={form.energyLevel === v}
                    onClick={(val) =>
                      setForm((f) => ({
                        ...f,
                        energyLevel: f.energyLevel === val ? null : val,
                      }))
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="text-2xs font-bold text-subtle uppercase tracking-widest mb-2">
                Настрій
              </p>
              <div className="flex gap-1.5" role="group" aria-label="Настрій">
                {[1, 2, 3, 4, 5].map((v) => (
                  <ScoreButton
                    key={v}
                    value={v}
                    label={MOOD_LABELS[v]}
                    selected={form.moodScore === v}
                    onClick={(val) =>
                      setForm((f) => ({
                        ...f,
                        moodScore: f.moodScore === val ? null : val,
                      }))
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="body-note"
                className="text-2xs font-bold text-subtle uppercase tracking-widest block mb-1"
              >
                Нотатка (необов&apos;язково)
              </label>
              <input
                id="body-note"
                type="text"
                className="w-full h-11 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none focus:border-success/60 transition-colors"
                placeholder="Як почуваєшся сьогодні…"
                value={form.note}
                onChange={(e) =>
                  setForm((f) => ({ ...f, note: e.target.value }))
                }
                maxLength={200}
              />
            </div>

            <button
              type="submit"
              className={cn(
                "w-full py-3 rounded-xl font-semibold text-sm transition-all",
                submitSuccess
                  ? "bg-success text-white"
                  : "bg-success text-white active:scale-[0.98]",
              )}
            >
              {submitSuccess ? "Записано ✓" : "Записати"}
            </button>
          </form>
        </section>

        {weightData.length >= 2 && (
          <section
            className="bg-panel border border-line rounded-2xl p-4 shadow-card"
            aria-label="Динаміка ваги"
          >
            <h2 className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">
              Динаміка ваги
            </h2>
            <MiniLineChart
              data={weightData}
              unit="кг"
              color="rgb(22 163 74)"
              metricLabel="вагу"
            />
          </section>
        )}

        {sleepData.length >= 2 && (
          <section
            className="bg-panel border border-line rounded-2xl p-4 shadow-card"
            aria-label="Динаміка сну"
          >
            <h2 className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">
              Сон
            </h2>
            <MiniLineChart
              data={sleepData}
              unit="год"
              color="rgb(99 102 241)"
              metricLabel="сон"
            />
          </section>
        )}

        {energyData.length >= 2 && (
          <section
            className="bg-panel border border-line rounded-2xl p-4 shadow-card"
            aria-label="Динаміка енергії"
          >
            <h2 className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">
              Рівень енергії
            </h2>
            <MiniLineChart
              data={energyData}
              unit="/5"
              color="rgb(245 158 11)"
              metricLabel="рівень енергії"
            />
          </section>
        )}

        {moodData.length >= 2 && (
          <section
            className="bg-panel border border-line rounded-2xl p-4 shadow-card"
            aria-label="Динаміка настрою"
          >
            <h2 className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">
              Настрій
            </h2>
            <MiniLineChart
              data={moodData}
              unit="/5"
              color="rgb(236 72 153)"
              metricLabel="настрій"
            />
          </section>
        )}

        <PhotoProgress />

        {entries.length > 0 && (
          <section
            className="bg-panel border border-line rounded-2xl p-4 shadow-card"
            aria-label="Журнал записів"
          >
            <h2 className="text-xs font-bold text-subtle uppercase tracking-widest mb-3">
              Журнал
            </h2>
            <div className="space-y-2">
              {entries.slice(0, 15).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-xl border border-line bg-bg p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-subtle mb-1">
                      {new Date(entry.at).toLocaleDateString("uk-UA", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      })}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {entry.weightKg != null && (
                        <span className="text-xs text-text">
                          <span className="text-subtle">Вага:</span>{" "}
                          <span className="font-semibold">
                            {entry.weightKg} кг
                          </span>
                        </span>
                      )}
                      {entry.sleepHours != null && (
                        <span className="text-xs text-text">
                          <span className="text-subtle">Сон:</span>{" "}
                          <span className="font-semibold">
                            {entry.sleepHours} год
                          </span>
                        </span>
                      )}
                      {entry.energyLevel != null && (
                        <span className="text-xs text-text">
                          <span className="text-subtle">Енергія:</span>{" "}
                          <span className="font-semibold">
                            {entry.energyLevel}/5
                          </span>
                        </span>
                      )}
                      {entry.moodScore != null && (
                        <span className="text-xs text-text">
                          <span className="text-subtle">Настрій:</span>{" "}
                          <span className="font-semibold">
                            {entry.moodScore}/5
                          </span>
                        </span>
                      )}
                    </div>
                    {entry.note && (
                      <p className="text-xs text-subtle mt-1 italic">
                        {entry.note}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteEntry(entry.id)}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    aria-label="Видалити запис"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
