import { useEffect, useMemo, useState } from "react";
import { Input } from "@shared/components/ui/Input";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";
import { useWorkouts } from "../hooks/useWorkouts";

const ACTIVE_WORKOUT_KEY = "fizruk_active_workout_id_v1";

const EQUIPMENT_OPTIONS = [
  { id: "bodyweight", label: "Власна вага" },
  { id: "barbell", label: "Штанга" },
  { id: "dumbbell", label: "Гантелі" },
  { id: "kettlebell", label: "Гиря" },
  { id: "cable", label: "Блок/трос" },
  { id: "machine", label: "Тренажер" },
  { id: "band", label: "Еспандер/резинка" },
  { id: "bench", label: "Лава" },
  { id: "other", label: "Інше" },
];

function slugify(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toggleArr(arr, value) {
  const a = Array.isArray(arr) ? arr : [];
  return a.includes(value) ? a.filter(x => x !== value) : [...a, value];
}

export function Workouts() {
  const { search, primaryGroupsUk, musclesUk, musclesByPrimaryGroup, addExercise } = useExerciseCatalog();
  const { workouts, createWorkout, deleteWorkout, addItem, updateItem, removeItem } = useWorkouts();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(() => ({}));
  const [addOpen, setAddOpen] = useState(false);
  const [mode, setMode] = useState("catalog"); // catalog | log
  const [activeWorkoutId, setActiveWorkoutId] = useState(() => {
    try { return localStorage.getItem(ACTIVE_WORKOUT_KEY) || null; } catch { return null; }
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickQ, setPickQ] = useState("");
  const [form, setForm] = useState(() => ({
    nameUk: "",
    primaryGroup: "chest",
    musclesPrimary: [],
    musclesSecondary: [],
    equipment: ["bodyweight"],
    description: "",
  }));
  const suggestedMuscles = useMemo(() => {
    const g = form.primaryGroup;
    const ids = musclesByPrimaryGroup?.[g] || [];
    // show only known labels first
    return ids.filter(id => musclesUk?.[id]);
  }, [form.primaryGroup, musclesByPrimaryGroup, musclesUk]);
  const list = useMemo(() => search(q), [q]);
  const pickList = useMemo(() => search(pickQ).slice(0, 60), [pickQ]);
  const activeWorkout = workouts.find(w => w.id === activeWorkoutId) || null;

  useEffect(() => {
    try {
      if (!activeWorkoutId) localStorage.removeItem(ACTIVE_WORKOUT_KEY);
      else localStorage.setItem(ACTIVE_WORKOUT_KEY, activeWorkoutId);
    } catch {}
  }, [activeWorkoutId]);

  const lastByExerciseId = useMemo(() => {
    const out = {};
    for (const w of workouts || []) {
      if (w.id === activeWorkoutId) continue;
      for (const it of w.items || []) {
        const exId = it.exerciseId;
        if (!exId) continue;
        const existing = out[exId];
        if (!existing || (w.startedAt || "").localeCompare(existing._startedAt || "") > 0) {
          out[exId] = { ...it, _startedAt: w.startedAt };
        }
      }
    }
    return out;
  }, [workouts, activeWorkoutId]);

  const grouped = useMemo(() => {
    const m = new Map();
    for (const ex of list) {
      const gid = ex.primaryGroup || "full_body";
      if (!m.has(gid)) m.set(gid, []);
      m.get(gid).push(ex);
    }
    // stable group order (common first)
    const order = ["chest", "back", "shoulders", "arms", "core", "legs", "glutes", "full_body", "cardio"];
    const entries = Array.from(m.entries()).sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a[0].localeCompare(b[0]);
    });
    return entries.map(([gid, items]) => ({
      id: gid,
      label: primaryGroupsUk[gid] || gid,
      items: items.slice(0, 80),
      total: items.length,
    }));
  }, [list, primaryGroupsUk]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-sm font-semibold text-muted">Тренування</div>
          <div className="flex items-center gap-2">
            <button
              className={cn("text-xs px-3 py-2 rounded-full border transition-colors", mode === "catalog" ? "bg-text text-white border-text" : "border-line text-subtle hover:text-text")}
              onClick={() => setMode("catalog")}
            >
              Каталог
            </button>
            <button
              className={cn("text-xs px-3 py-2 rounded-full border transition-colors", mode === "log" ? "bg-text text-white border-text" : "border-line text-subtle hover:text-text")}
              onClick={() => setMode("log")}
            >
              Журнал
            </button>
            {mode === "catalog" && (
              <Button size="sm" className="h-9 px-4" onClick={() => setAddOpen(true)}>
                + Додати
              </Button>
            )}
          </div>
        </div>

        {mode === "log" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button
                className="flex-1 h-12"
                onClick={() => {
                  const w = createWorkout();
                  setActiveWorkoutId(w.id);
                }}
              >
                + Нове тренування
              </Button>
              <Button
                variant="ghost"
                className="h-12 px-4"
                onClick={() => setPickerOpen(true)}
                disabled={!activeWorkoutId}
              >
                + Вправа
              </Button>
            </div>

            {activeWorkout && (
              <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-text">Активне тренування</div>
                    <div className="text-xs text-subtle mt-0.5">
                      {new Date(activeWorkout.startedAt).toLocaleString("uk-UA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    className="h-9 px-4"
                    onClick={() => {
                      if (confirm("Видалити тренування?")) {
                        deleteWorkout(activeWorkout.id);
                        setActiveWorkoutId(prev => (prev === activeWorkout.id ? null : prev));
                      }
                    }}
                  >
                    Видалити
                  </Button>
                </div>

                <div className="mt-3 space-y-2">
                  {(activeWorkout.items || []).length === 0 ? (
                    <div className="text-sm text-subtle text-center py-6">Додай вправи, щоб почати логувати</div>
                  ) : (
                    (activeWorkout.items || []).map((it) => (
                      <div key={it.id} className="border border-line rounded-2xl p-3 bg-bg">
                        {it.exerciseId && lastByExerciseId[it.exerciseId] && (
                          <div className="text-[11px] text-subtle/70 mb-1">
                            Минулого разу{" "}
                            {lastByExerciseId[it.exerciseId]._startedAt
                              ? `(${new Date(lastByExerciseId[it.exerciseId]._startedAt).toLocaleDateString("uk-UA", { month: "short", day: "numeric" })})`
                              : ""}:
                            {" "}
                            {lastByExerciseId[it.exerciseId].type === "strength"
                              ? (lastByExerciseId[it.exerciseId].sets || []).map(s => `${s.weightKg ?? 0}×${s.reps ?? 0}`).slice(0, 3).join(", ")
                              : lastByExerciseId[it.exerciseId].type === "distance"
                                ? `${lastByExerciseId[it.exerciseId].distanceM ?? 0}м за ${lastByExerciseId[it.exerciseId].durationSec ?? 0}с`
                                : `${lastByExerciseId[it.exerciseId].durationSec ?? 0}с`
                            }
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <button
                              className="text-sm font-semibold text-text truncate text-left hover:underline"
                              onClick={() => {
                                if (it.exerciseId) window.location.hash = `#exercise/${it.exerciseId}`;
                              }}
                            >
                              {it.nameUk}
                            </button>
                            <div className="text-xs text-subtle mt-0.5">
                              Мʼязи: <span className="font-semibold text-muted">{(it.musclesPrimary || []).join(", ") || "—"}</span>
                            </div>
                          </div>
                          <button
                            className="text-xs text-danger/80 hover:text-danger"
                            onClick={() => removeItem(activeWorkout.id, it.id)}
                          >
                            ✕
                          </button>
                        </div>

                        <div className="mt-2">
                          <div className="rounded-2xl border border-line bg-panelHi px-3">
                            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest pt-2">Тип</div>
                            <select
                              className="w-full h-10 bg-transparent text-sm text-text outline-none"
                              value={it.type || "strength"}
                              onChange={(e) => {
                                const t = e.target.value;
                                if (t === "strength") updateItem(activeWorkout.id, it.id, { type: t, sets: it.sets?.length ? it.sets : [{ weightKg: 0, reps: 0 }], durationSec: undefined, distanceM: undefined });
                                if (t === "time") updateItem(activeWorkout.id, it.id, { type: t, durationSec: it.durationSec ?? 0, sets: undefined, distanceM: undefined });
                                if (t === "distance") updateItem(activeWorkout.id, it.id, { type: t, distanceM: it.distanceM ?? 0, durationSec: it.durationSec ?? 0, sets: undefined });
                              }}
                            >
                              <option value="strength">Силова (кг × повтори × підходи)</option>
                              <option value="time">Час (секунди)</option>
                              <option value="distance">Дистанція (метри) + час</option>
                            </select>
                          </div>
                        </div>

                        {it.type === "strength" && (
                          <div className="mt-2 space-y-2">
                            {(it.sets || []).map((s, idx) => (
                              <div key={idx} className="grid grid-cols-3 gap-2">
                                <input
                                  className="h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                                  type="number"
                                  placeholder="кг"
                                  value={s.weightKg ?? ""}
                                  onChange={(e) => {
                                    const next = [...(it.sets || [])];
                                    next[idx] = { ...next[idx], weightKg: Number(e.target.value) };
                                    updateItem(activeWorkout.id, it.id, { sets: next });
                                  }}
                                />
                                <input
                                  className="h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                                  type="number"
                                  placeholder="повт."
                                  value={s.reps ?? ""}
                                  onChange={(e) => {
                                    const next = [...(it.sets || [])];
                                    next[idx] = { ...next[idx], reps: Number(e.target.value) };
                                    updateItem(activeWorkout.id, it.id, { sets: next });
                                  }}
                                />
                                <button
                                  className="h-10 rounded-xl border border-line text-xs text-subtle hover:text-danger hover:border-danger/40 transition-colors"
                                  onClick={() => {
                                    const next = (it.sets || []).filter((_, i) => i !== idx);
                                    updateItem(activeWorkout.id, it.id, { sets: next });
                                  }}
                                >
                                  Видалити
                                </button>
                              </div>
                            ))}
                            <Button
                              variant="ghost"
                              className="w-full h-10"
                              onClick={() => updateItem(activeWorkout.id, it.id, { sets: [...(it.sets || []), { weightKg: 0, reps: 0 }] })}
                            >
                              + Підхід
                            </Button>
                          </div>
                        )}

                        {it.type === "time" && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <input
                              className="h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                              type="number"
                              placeholder="сек"
                              value={it.durationSec ?? ""}
                              onChange={(e) => updateItem(activeWorkout.id, it.id, { durationSec: Number(e.target.value) })}
                            />
                            <div className="h-10 rounded-xl border border-line bg-bg px-3 text-xs text-subtle flex items-center">
                              Напр: планка, ізометрія
                            </div>
                          </div>
                        )}

                        {it.type === "distance" && (
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <input
                              className="h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                              type="number"
                              placeholder="метри"
                              value={it.distanceM ?? ""}
                              onChange={(e) => updateItem(activeWorkout.id, it.id, { distanceM: Number(e.target.value) })}
                            />
                            <input
                              className="h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                              type="number"
                              placeholder="сек"
                              value={it.durationSec ?? ""}
                              onChange={(e) => updateItem(activeWorkout.id, it.id, { durationSec: Number(e.target.value) })}
                            />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            <div className="bg-panel border border-line/60 rounded-2xl shadow-card overflow-hidden">
              <div className="px-4 py-3 bg-panelHi/60 border-b border-line">
                <div className="text-xs font-bold text-subtle uppercase tracking-widest">Останні тренування</div>
              </div>
              {(workouts || []).slice(0, 12).map(w => (
                <button
                  key={w.id}
                  onClick={() => setActiveWorkoutId(w.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-panelHi transition-colors",
                    activeWorkoutId === w.id && "bg-text/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-text">
                      {new Date(w.startedAt).toLocaleDateString("uk-UA", { month: "short", day: "numeric" })}
                    </div>
                    <div className="text-xs text-subtle">{(w.items || []).length} вправ</div>
                  </div>
                </button>
              ))}
              {(workouts || []).length === 0 && (
                <div className="p-6 text-center text-sm text-subtle">Поки тренувань немає</div>
              )}
            </div>
          </div>
        )}

        {mode === "catalog" && (
        <div className="relative mb-3">
          <Input
            placeholder="Пошук (жим, підтягування, спина...)"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-text"
            >
              ✕
            </button>
          )}
        </div>
        )}

        <div className="bg-panel border border-line/60 rounded-2xl shadow-card overflow-hidden">
          {grouped.length === 0 ? (
            <div className="p-6 text-center text-sm text-subtle">
              Поки немає вправ. Додай першу через кнопку “+ Додати”.
            </div>
          ) : (
            grouped.map(g => {
              const isOpen = open[g.id] ?? true;
              return (
                <div key={g.id} className="border-b border-line last:border-0">
                  <button
                    onClick={() => setOpen(o => ({ ...o, [g.id]: !isOpen }))}
                    className="w-full flex items-center justify-between px-4 py-3 bg-panelHi/60 hover:bg-panelHi transition-colors"
                  >
                    <div className="text-sm font-bold text-text">{g.label}</div>
                    <div className="text-xs text-muted flex items-center gap-2">
                      <span>{g.total}</span>
                      <span className="text-lg leading-none">{isOpen ? "▾" : "▸"}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div>
                      {g.items.map(ex => (
                        <button
                          key={ex.id}
                          onClick={() => setSelected(ex)}
                          className="w-full text-left px-4 py-3 border-t border-line hover:bg-panelHi transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-text truncate">{ex?.name?.uk || ex?.name?.en}</div>
                              <div className="text-xs text-subtle mt-0.5">
                                Мʼязи:{" "}
                                <span className="font-semibold text-muted">
                                  {(ex?.muscles?.primary || []).join(", ") || "—"}
                                </span>
                              </div>
                            </div>
                            <div className="shrink-0 text-xs text-muted">
                              {ex.rating ? ex.rating.toFixed(1) : ""}
                            </div>
                          </div>
                        </button>
                      ))}
                      {g.total > g.items.length && (
                        <div className="px-4 py-3 text-xs text-subtle border-t border-line">
                          Показано {g.items.length} з {g.total} (уточни пошук щоб звузити)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Details sheet */}
        {selected && (
          <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSelected(null)}>
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
                    <div className="text-lg font-extrabold text-text leading-tight">{selected?.name?.uk || selected?.name?.en}</div>
                    <div className="text-xs text-subtle mt-1">
                      Основна група: <span className="font-semibold text-muted">{selected.primaryGroupUk || selected.primaryGroup}</span>
                      {selected.level ? <> · рівень: <span className="font-semibold text-muted">{selected.level}</span></> : null}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {((selected.images || []).filter(Boolean).length) > 0 && (
                  <div className="mb-4 -mx-5 px-5 overflow-x-auto no-scrollbar">
                    <div className="flex gap-3">
                      {selected.images.slice(0, 8).map((src) => (
                        <img
                          key={src}
                          src={src}
                          alt={selected?.name?.uk || selected?.name?.en || "exercise"}
                          loading="lazy"
                          className="h-40 w-40 rounded-2xl object-cover border border-line bg-bg"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {selected.description && (
                  <div className="text-sm text-text leading-relaxed mb-4">
                    {selected.description}
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-xs font-bold text-subtle uppercase tracking-widest">Мʼязи</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected?.muscles?.primary || []).map(m => (
                      <span key={m} className="text-xs px-3 py-1.5 rounded-full border border-line bg-bg text-muted font-semibold">
                        {m} · основний
                      </span>
                    ))}
                    {(selected?.muscles?.secondary || []).map(m => (
                      <span key={m} className="text-xs px-3 py-1.5 rounded-full border border-line bg-bg text-subtle font-semibold">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="text-xs font-bold text-subtle uppercase tracking-widest">Обладнання</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected.equipmentUk || selected.equipment || []).map(eq => (
                      <span key={eq} className="text-xs px-3 py-1.5 rounded-full border border-line bg-bg text-muted font-semibold">
                        {eq}
                      </span>
                    ))}
                  </div>
                </div>

                {selected.tips?.length ? (
                  <div className="mt-4">
                    <div className="text-xs font-bold text-subtle uppercase tracking-widest mb-2">Підказки</div>
                    <ul className="space-y-1.5">
                      {selected.tips.map((t, i) => (
                        <li key={i} className="text-sm text-text leading-relaxed">
                          <span className="text-muted font-bold mr-2">•</span>{t}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button className="h-12" onClick={() => setSelected(null)}>
                    Готово
                  </Button>
                  <Button
                    variant="ghost"
                    className={cn("h-12")}
                    onClick={() => {
                      navigator.clipboard?.writeText(selected?.name?.uk || selected?.name?.en || "").catch(() => {});
                    }}
                  >
                    📋 Копіювати назву
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add exercise sheet */}
        {addOpen && (
          <div className="fixed inset-0 z-50 flex items-end" onClick={() => setAddOpen(false)}>
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
                    <div className="text-lg font-extrabold text-text leading-tight">Додати вправу</div>
                    <div className="text-xs text-subtle mt-1">Збережеться локально на цьому пристрої</div>
                  </div>
                  <button
                    onClick={() => setAddOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2">
                  <Input
                    placeholder="Назва (укр) *"
                    value={form.nameUk}
                    onChange={e => setForm(f => ({ ...f, nameUk: e.target.value }))}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-line bg-panelHi px-3">
                      <div className="text-[10px] font-bold text-subtle uppercase tracking-widest pt-2">Основна група</div>
                      <select
                        className="w-full h-10 bg-transparent text-sm text-text outline-none"
                        value={form.primaryGroup}
                        onChange={e => setForm(f => ({ ...f, primaryGroup: e.target.value, musclesPrimary: [], musclesSecondary: [] }))}
                      >
                        {Object.keys(primaryGroupsUk).map(id => (
                          <option key={id} value={id}>{primaryGroupsUk[id]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="rounded-2xl border border-line bg-panelHi px-3">
                      <div className="text-[10px] font-bold text-subtle uppercase tracking-widest pt-2">Обладнання</div>
                      <div className="py-2 flex flex-wrap gap-1.5">
                        {EQUIPMENT_OPTIONS.map(o => {
                          const active = (form.equipment || []).includes(o.id);
                          return (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => setForm(f => ({ ...f, equipment: toggleArr(f.equipment, o.id) }))}
                              className={cn(
                                "text-[11px] px-3 py-1.5 rounded-full border transition-colors",
                                active ? "bg-text text-white border-text" : "border-line bg-bg text-muted hover:border-muted hover:text-text"
                              )}
                            >
                              {o.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="rounded-2xl border border-line bg-panelHi px-3 py-2">
                    <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">Основні мʼязи</div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {suggestedMuscles.map((id) => (
                        <button
                          key={id}
                          type="button"
                          className={cn(
                            "text-[11px] px-3 py-1.5 rounded-full border transition-colors",
                            (form.musclesPrimary || []).includes(id)
                              ? "bg-primary border-primary text-white"
                              : "border-line bg-bg text-muted hover:border-muted hover:text-text"
                          )}
                          onClick={() => setForm(f => ({ ...f, musclesPrimary: toggleArr(f.musclesPrimary, id) }))}
                        >
                          {musclesUk[id] || id}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-line bg-panelHi px-3 py-2">
                    <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">Супутні мʼязи</div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {suggestedMuscles.map((id) => (
                        <button
                          key={id}
                          type="button"
                          className={cn(
                            "text-[11px] px-3 py-1.5 rounded-full border transition-colors",
                            (form.musclesSecondary || []).includes(id)
                              ? "bg-text/80 border-text/80 text-white"
                              : "border-line bg-bg text-muted hover:border-muted hover:text-text"
                          )}
                          onClick={() => setForm(f => ({ ...f, musclesSecondary: toggleArr(f.musclesSecondary, id) }))}
                        >
                          {musclesUk[id] || id}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Input
                    placeholder="Опис"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button
                    className="h-12"
                    onClick={() => {
                      const nameUk = (form.nameUk || "").trim();
                      if (!nameUk) return;
                      const id = `custom_${slugify(nameUk) || Date.now()}`;
                      addExercise({
                        id,
                        name: { uk: nameUk, en: nameUk },
                        primaryGroup: form.primaryGroup,
                        primaryGroupUk: primaryGroupsUk[form.primaryGroup] || form.primaryGroup,
                        muscles: { primary: form.musclesPrimary || [], secondary: form.musclesSecondary || [], stabilizers: [] },
                        equipment: form.equipment || [],
                        equipmentUk: (form.equipment || []).map(eid => EQUIPMENT_OPTIONS.find(x => x.id === eid)?.label || eid),
                        description: (form.description || "").trim(),
                        source: "manual",
                      });
                      setAddOpen(false);
                      setForm({
                        nameUk: "",
                        primaryGroup: "chest",
                        musclesPrimary: [],
                        musclesSecondary: [],
                        equipment: ["bodyweight"],
                        description: "",
                      });
                    }}
                  >
                    Зберегти
                  </Button>
                  <Button variant="ghost" className="h-12" onClick={() => setAddOpen(false)}>
                    Скасувати
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Exercise picker for workout */}
        {pickerOpen && (
          <div className="fixed inset-0 z-50 flex items-end" onClick={() => setPickerOpen(false)}>
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
                    <div className="text-lg font-extrabold text-text leading-tight">Додати вправу в тренування</div>
                    <div className="text-xs text-subtle mt-1">Почни вводити назву</div>
                  </div>
                  <button
                    onClick={() => setPickerOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="relative mb-3">
                  <Input
                    placeholder="Пошук вправи…"
                    value={pickQ}
                    onChange={e => setPickQ(e.target.value)}
                  />
                </div>

                <div className="bg-bg border border-line rounded-2xl overflow-hidden max-h-[55vh] overflow-y-auto">
                  {pickList.map(ex => (
                    <button
                      key={ex.id}
                      className="w-full text-left px-4 py-3 border-b border-line last:border-0 hover:bg-panelHi transition-colors"
                      onClick={() => {
                        if (!activeWorkoutId) return;
                        addItem(activeWorkoutId, {
                          exerciseId: ex.id,
                          nameUk: ex?.name?.uk || ex?.name?.en,
                          primaryGroup: ex.primaryGroup,
                          musclesPrimary: ex?.muscles?.primary || [],
                          musclesSecondary: ex?.muscles?.secondary || [],
                          type: "strength",
                          sets: [{ weightKg: 0, reps: 0 }],
                          durationSec: 0,
                          distanceM: 0,
                        });
                        setPickerOpen(false);
                        setPickQ("");
                      }}
                    >
                      <div className="text-sm font-semibold text-text truncate">{ex?.name?.uk || ex?.name?.en}</div>
                      <div className="text-xs text-subtle mt-0.5">{ex.primaryGroupUk || ex.primaryGroup}</div>
                    </button>
                  ))}
                  {pickList.length === 0 && (
                    <div className="p-6 text-center text-sm text-subtle">Нічого не знайдено</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
