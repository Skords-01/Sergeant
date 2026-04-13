import { useMemo, useState } from "react";
import { Input } from "@shared/components/ui/Input";
import { Button } from "@shared/components/ui/Button";
export function WorkoutTemplatesSection({
  exercises,
  search,
  templates,
  addTemplate,
  updateTemplate,
  removeTemplate,
  onStartTemplate,
}) {
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [orderIds, setOrderIds] = useState([]);

  const pickList = useMemo(() => search(q).slice(0, 40), [search, q]);

  const byId = useMemo(() => {
    const m = new Map();
    for (const ex of exercises || []) {
      if (ex?.id) m.set(ex.id, ex);
    }
    return m;
  }, [exercises]);

  const startNew = () => {
    setEditingId("new");
    setName("");
    setOrderIds([]);
    setQ("");
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setName(t.name || "");
    setOrderIds([...(t.exerciseIds || [])]);
    setQ("");
  };

  const save = () => {
    if (orderIds.length === 0) return;
    const n = name.trim() || "Мій шаблон";
    if (editingId === "new") {
      addTemplate(n, orderIds);
    } else if (editingId) {
      updateTemplate(editingId, { name: n, exerciseIds: orderIds });
    }
    setEditingId(null);
    setName("");
    setOrderIds([]);
  };

  const addEx = (ex) => {
    if (!ex?.id) return;
    if (orderIds.includes(ex.id)) return;
    setOrderIds((o) => [...o, ex.id]);
  };

  const move = (idx, dir) => {
    setOrderIds((o) => {
      const j = idx + dir;
      if (j < 0 || j >= o.length) return o;
      const next = [...o];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const removeAt = (idx) => {
    setOrderIds((o) => o.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="text-xs text-subtle leading-relaxed">
        Шаблони — лише твої: додай назву й послідовність вправ з каталогу. План
        на головній будується з цих шаблонів. Щоб стартувати тренування зі
        списку нижче — натисни «Почати» біля шаблону (відкриється журнал з
        активним тренуванням).
      </div>

      {!editingId && (
        <Button className="w-full h-12 min-h-[44px]" onClick={startNew}>
          + Новий шаблон
        </Button>
      )}

      {editingId && (
        <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-3">
          <Input
            placeholder="Назва (за замовчуванням — «Мій шаблон»)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Назва шаблону"
          />
          <div>
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2">
              Додати вправу з каталогу
            </div>
            <Input
              placeholder="Пошук…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Пошук вправи для шаблону"
            />
            <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-line divide-y divide-line">
              {pickList.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  className="w-full text-left px-3 py-2.5 min-h-[44px] text-sm hover:bg-panelHi transition-colors"
                  onClick={() => addEx(ex)}
                >
                  {ex?.name?.uk || ex?.name?.en}
                </button>
              ))}
              {pickList.length === 0 && (
                <div className="p-3 text-xs text-subtle text-center">
                  Нічого не знайдено
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2">
              Порядок ({orderIds.length})
            </div>
            {orderIds.length === 0 ? (
              <div className="text-sm text-subtle text-center py-4">
                Додай хоча б одну вправу
              </div>
            ) : (
              <ul className="space-y-1">
                {orderIds.map((id, idx) => {
                  const ex = byId.get(id);
                  return (
                    <li
                      key={`${id}_${idx}`}
                      className="flex items-center gap-2 rounded-xl border border-line bg-bg px-2 py-1.5"
                    >
                      <span className="text-xs text-subtle w-5 text-center">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-sm truncate min-w-0">
                        {ex?.name?.uk || ex?.name?.en || id}
                      </span>
                      <button
                        type="button"
                        className="min-w-[44px] min-h-[44px] text-subtle hover:text-text"
                        aria-label="Вище"
                        onClick={() => move(idx, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="min-w-[44px] min-h-[44px] text-subtle hover:text-text"
                        aria-label="Нижче"
                        onClick={() => move(idx, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="min-w-[44px] min-h-[44px] text-danger/80"
                        aria-label="Прибрати з шаблону"
                        onClick={() => removeAt(idx)}
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 h-12 min-h-[44px]"
              onClick={save}
              disabled={!orderIds.length}
            >
              Зберегти
            </Button>
            <Button
              variant="ghost"
              className="flex-1 h-12 min-h-[44px]"
              onClick={() => {
                setEditingId(null);
                setOrderIds([]);
                setName("");
              }}
            >
              Скасувати
            </Button>
          </div>
        </div>
      )}

      <div className="bg-panel border border-line/60 rounded-2xl shadow-card overflow-hidden">
        <div className="px-4 py-3 bg-panelHi/60 border-b border-line">
          <div className="text-xs font-bold text-subtle uppercase tracking-widest">
            Збережені шаблони
          </div>
        </div>
        {(templates || []).length === 0 ? (
          <div className="p-6 text-center text-sm text-subtle">
            Поки немає шаблонів
          </div>
        ) : (
          (templates || []).map((t) => (
            <div
              key={t.id}
              className="px-4 py-3 border-b border-line last:border-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-text truncate">
                  {t.name}
                </div>
                <div className="text-xs text-subtle">
                  {(t.exerciseIds || []).length} вправ
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 shrink-0 justify-end">
                {typeof onStartTemplate === "function" && (
                  <Button
                    size="sm"
                    className="h-10 min-h-[44px] px-3 bg-forest text-white border-forest hover:bg-forest/90"
                    onClick={() => onStartTemplate(t)}
                    disabled={!(t.exerciseIds || []).length}
                  >
                    Почати
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-10 min-w-[44px] px-3"
                  onClick={() => startEdit(t)}
                >
                  Змінити
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  className="h-10 min-w-[44px] px-3"
                  onClick={() => {
                    if (confirm("Видалити шаблон?")) removeTemplate(t.id);
                  }}
                >
                  ✕
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
