import { useMemo, useState } from "react";
import { Input } from "@shared/components/ui/Input";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { useExerciseCatalog } from "../hooks/useExerciseCatalog";

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

function parseCsv(s) {
  return (s || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}

export function Workouts() {
  const { search, primaryGroupsUk, addExercise } = useExerciseCatalog();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(() => ({}));
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    nameUk: "",
    nameEn: "",
    primaryGroup: "chest",
    musclesPrimary: "",
    equipment: "bodyweight",
    description: "",
    imageUrl1: "",
    imageUrl2: "",
  }));
  const list = useMemo(() => search(q), [q]);

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
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-16">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-sm font-semibold text-muted">Каталог вправ</div>
          <Button size="sm" className="h-9 px-4" onClick={() => setAddOpen(true)}>
            + Додати
          </Button>
        </div>

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

        <div className="bg-panel border border-line/60 rounded-2xl shadow-card overflow-hidden">
          {grouped.length === 0 ? (
            <div className="p-6 text-center text-sm text-subtle">
              Нічого не знайдено
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

                {(selected.images?.length || 0) > 0 && (
                  <div className="mb-4 -mx-5 px-5 overflow-x-auto no-scrollbar">
                    <div className="flex gap-3">
                      {selected.images.slice(0, 5).map((src) => (
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
                  <Input
                    placeholder="Назва (англ, опц.)"
                    value={form.nameEn}
                    onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-line bg-panelHi px-3">
                      <div className="text-[10px] font-bold text-subtle uppercase tracking-widest pt-2">Основна група</div>
                      <select
                        className="w-full h-10 bg-transparent text-sm text-text outline-none"
                        value={form.primaryGroup}
                        onChange={e => setForm(f => ({ ...f, primaryGroup: e.target.value }))}
                      >
                        {Object.keys(primaryGroupsUk).map(id => (
                          <option key={id} value={id}>{primaryGroupsUk[id]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="rounded-2xl border border-line bg-panelHi px-3">
                      <div className="text-[10px] font-bold text-subtle uppercase tracking-widest pt-2">Обладнання</div>
                      <select
                        className="w-full h-10 bg-transparent text-sm text-text outline-none"
                        value={form.equipment}
                        onChange={e => setForm(f => ({ ...f, equipment: e.target.value }))}
                      >
                        {EQUIPMENT_OPTIONS.map(o => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <Input
                    placeholder="Основні мʼязи (через кому), напр: pectoralis_major, triceps"
                    value={form.musclesPrimary}
                    onChange={e => setForm(f => ({ ...f, musclesPrimary: e.target.value }))}
                  />
                  <Input
                    placeholder="Опис"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                  <Input
                    placeholder="Картинка URL 1 (опц.)"
                    value={form.imageUrl1}
                    onChange={e => setForm(f => ({ ...f, imageUrl1: e.target.value }))}
                  />
                  <Input
                    placeholder="Картинка URL 2 (опц.)"
                    value={form.imageUrl2}
                    onChange={e => setForm(f => ({ ...f, imageUrl2: e.target.value }))}
                  />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <Button
                    className="h-12"
                    onClick={() => {
                      const nameUk = (form.nameUk || "").trim();
                      if (!nameUk) return;
                      const id = `custom_${slugify(nameUk) || Date.now()}`;
                      const images = [form.imageUrl1, form.imageUrl2].map(s => (s || "").trim()).filter(Boolean);
                      addExercise({
                        id,
                        name: { uk: nameUk, en: (form.nameEn || "").trim() || nameUk },
                        primaryGroup: form.primaryGroup,
                        primaryGroupUk: primaryGroupsUk[form.primaryGroup] || form.primaryGroup,
                        muscles: { primary: parseCsv(form.musclesPrimary), secondary: [], stabilizers: [] },
                        equipment: [form.equipment],
                        equipmentUk: [EQUIPMENT_OPTIONS.find(x => x.id === form.equipment)?.label || form.equipment],
                        description: (form.description || "").trim(),
                        images,
                        source: "manual",
                      });
                      setAddOpen(false);
                      setForm({
                        nameUk: "",
                        nameEn: "",
                        primaryGroup: "chest",
                        musclesPrimary: "",
                        equipment: "bodyweight",
                        description: "",
                        imageUrl1: "",
                        imageUrl2: "",
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
      </div>
    </div>
  );
}
