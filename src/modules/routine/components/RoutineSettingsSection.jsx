import { useRef, useState, useMemo } from "react";
import { cn } from "@shared/lib/cn";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import {
  loadRoutineState,
  createHabit,
  createTag,
  createCategory,
  setPref,
  deleteTag,
  deleteHabit,
  updateHabit,
  setHabitArchived,
  buildRoutineBackupPayload,
  applyRoutineBackupPayload,
  moveHabitInOrder,
  setHabitOrder,
} from "../lib/routineStorage.js";
import { dateKeyFromDate } from "../lib/hubCalendarAggregate.js";
import { sortHabitsByOrder } from "../lib/habitOrder.js";
import { requestRoutineNotificationPermission } from "../hooks/useRoutineReminders.js";
import {
  ROUTINE_THEME as C,
  RECURRENCE_OPTIONS,
  WEEKDAY_LABELS,
} from "../lib/routineConstants.js";
import {
  emptyHabitDraft,
  habitDraftToPatch,
  routineTodayDate,
} from "../lib/routineDraftUtils.js";

export function RoutineSettingsSection({
  routine,
  setRoutine,
  habitDraft,
  setHabitDraft,
  tagDraft,
  setTagDraft,
  catDraft,
  setCatDraft,
  onOpenCalendar,
  hidden: panelHidden,
}) {
  const [editingId, setEditingId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [habitListQuery, setHabitListQuery] = useState("");
  const backupRef = useRef(null);

  const q = habitListQuery.trim().toLowerCase();
  const filteredActiveHabits = useMemo(() => {
    const active = sortHabitsByOrder(
      routine.habits.filter((h) => !h.archived),
      routine.habitOrder || [],
    );
    if (!q) return active;
    return active.filter((h) =>
      `${h.emoji} ${h.name}`.toLowerCase().includes(q),
    );
  }, [routine.habits, routine.habitOrder, q]);

  const loadHabitIntoDraft = (h) => {
    setHabitDraft({
      name: h.name || "",
      emoji: h.emoji || "✓",
      tagIds: h.tagIds || [],
      categoryId: h.categoryId || null,
      recurrence: h.recurrence || "daily",
      startDate: h.startDate || dateKeyFromDate(routineTodayDate()),
      endDate: h.endDate || "",
      timeOfDay: h.timeOfDay || "",
      weekdays:
        Array.isArray(h.weekdays) && h.weekdays.length
          ? h.weekdays
          : [0, 1, 2, 3, 4, 5, 6],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setHabitDraft(emptyHabitDraft());
  };

  const saveHabit = () => {
    const patch = habitDraftToPatch(habitDraft);
    if (!patch.name) return;
    if (
      patch.recurrence === "weekly" &&
      (!patch.weekdays || patch.weekdays.length === 0)
    ) {
      window.alert("Обери хоча б один день тижня.");
      return;
    }
    if (editingId) {
      setRoutine((s) => updateHabit(s, editingId, patch));
      cancelEdit();
    } else {
      setRoutine((s) => createHabit(s, patch));
      setHabitDraft(emptyHabitDraft());
    }
  };

  return (
    <div
      role="tabpanel"
      id="routine-panel-settings"
      aria-labelledby="routine-tab-settings"
      hidden={panelHidden}
      className="space-y-4 pb-4"
    >
      <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-3">
        <h2 className="text-xs font-bold text-subtle uppercase tracking-widest">
          Календар
        </h2>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">Показувати тренування з Фізрука</span>
          <input
            type="checkbox"
            className="w-5 h-5 accent-[#e0786c]"
            checked={routine.prefs.showFizrukInCalendar !== false}
            onChange={(ev) =>
              setRoutine((s) =>
                setPref(s, "showFizrukInCalendar", ev.target.checked),
              )
            }
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">
            Показувати планові платежі підписок Фініка
          </span>
          <input
            type="checkbox"
            className="w-5 h-5 accent-[#e0786c]"
            checked={routine.prefs.showFinykSubscriptionsInCalendar !== false}
            onChange={(ev) =>
              setRoutine((s) =>
                setPref(
                  s,
                  "showFinykSubscriptionsInCalendar",
                  ev.target.checked,
                ),
              )
            }
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted">Нагадування в браузері</span>
          <input
            type="checkbox"
            className="w-5 h-5 accent-[#e0786c]"
            checked={routine.prefs.routineRemindersEnabled === true}
            onChange={async (ev) => {
              const on = ev.target.checked;
              if (on) {
                const p = await requestRoutineNotificationPermission();
                if (p !== "granted") {
                  window.alert(
                    "Без дозволу на сповіщення нагадування не надсилатимуться. Дозволь сповіщення для цього сайту в налаштуваннях браузера.",
                  );
                  return;
                }
              }
              setRoutine((s) => setPref(s, "routineRemindersEnabled", on));
            }}
          />
        </label>
        <p className="text-[10px] text-subtle leading-snug">
          У звичці вкажи «Час нагадування». Один раз на день о цій хвилині, якщо
          день запланований і ще немає відмітки. Працює, поки відкрита вкладка
          або дозволено тло (залежить від браузера). Надійної роботи повністю у
          фоні без відкритої вкладки браузер не гарантує.
        </p>
      </section>

      <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-3">
        <h2 className="text-xs font-bold text-subtle uppercase tracking-widest">
          Резервна копія
        </h2>
        <p className="text-[10px] text-subtle">
          Звички, відмітки, відтискання та нотатки — один JSON-файл.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className={cn("font-bold", C.primary)}
            onClick={() => {
              const blob = new Blob(
                [JSON.stringify(buildRoutineBackupPayload(), null, 2)],
                {
                  type: "application/json",
                },
              );
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `hub-routine-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1500);
            }}
          >
            Експорт JSON
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="border border-line/70"
            onClick={() => backupRef.current?.click()}
          >
            Імпорт
          </Button>
          <input
            ref={backupRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const text = await f.text();
                const parsed = JSON.parse(text);
                const ok = window.confirm(
                  "Імпорт замінить усі поточні дані Рутини (звички, відмітки, відтискання) даними з файлу. Продовжити?",
                );
                if (!ok) {
                  e.target.value = "";
                  return;
                }
                applyRoutineBackupPayload(parsed);
                setRoutine(loadRoutineState());
              } catch (err) {
                window.alert(err?.message || "Не вдалося імпортувати файл.");
              }
              e.target.value = "";
            }}
          />
        </div>
      </section>

      <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-3">
        <h2 className="text-xs font-bold text-subtle uppercase tracking-widest">
          {editingId ? "Редагувати звичку" : "Нова звичка"}
        </h2>
        <div className="flex gap-2 items-stretch">
          <Input
            className="routine-touch-field w-16 shrink-0 text-center"
            value={habitDraft.emoji}
            onChange={(e) =>
              setHabitDraft((d) => ({
                ...d,
                emoji: e.target.value.slice(0, 4),
              }))
            }
            aria-label="Емодзі"
          />
          <Input
            className="routine-touch-field min-w-0 flex-1"
            placeholder="Назва"
            value={habitDraft.name}
            onChange={(e) =>
              setHabitDraft((d) => ({ ...d, name: e.target.value }))
            }
          />
        </div>

        <label className="block text-xs text-subtle">
          Регулярність
          <select
            className="routine-touch-select mt-1"
            value={habitDraft.recurrence || "daily"}
            onChange={(e) =>
              setHabitDraft((d) => ({ ...d, recurrence: e.target.value }))
            }
          >
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs text-subtle">
            Початок (дата)
            <Input
              type="date"
              className="routine-touch-field mt-1 w-full"
              value={habitDraft.startDate || ""}
              onChange={(e) =>
                setHabitDraft((d) => ({ ...d, startDate: e.target.value }))
              }
            />
          </label>
          <label className="block text-xs text-subtle">
            Кінець (необовʼязково)
            <Input
              type="date"
              className="routine-touch-field mt-1 w-full"
              value={habitDraft.endDate || ""}
              onChange={(e) =>
                setHabitDraft((d) => ({ ...d, endDate: e.target.value }))
              }
            />
          </label>
        </div>

        <label className="block text-xs text-subtle">
          Час нагадування (необовʼязково)
          <Input
            type="time"
            className="routine-touch-field mt-1 w-full"
            value={habitDraft.timeOfDay || ""}
            onChange={(e) =>
              setHabitDraft((d) => ({ ...d, timeOfDay: e.target.value }))
            }
          />
        </label>

        {habitDraft.recurrence === "weekly" && (
          <div>
            <p className="text-xs text-subtle mb-2">Дні тижня</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((label, wd) => {
                const on = (habitDraft.weekdays || []).includes(wd);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setHabitDraft((d) => {
                        const cur = [...(d.weekdays || [])];
                        const i = cur.indexOf(wd);
                        if (i >= 0) {
                          if (cur.length <= 1) return d;
                          cur.splice(i, 1);
                        } else cur.push(wd);
                        cur.sort((a, b) => a - b);
                        return { ...d, weekdays: cur };
                      });
                    }}
                    className={cn(
                      "min-h-[40px] px-3 rounded-xl text-xs font-semibold border transition-colors",
                      on ? C.chipOn : C.chipOff,
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(habitDraft.recurrence === "once" ||
          habitDraft.recurrence === "monthly") && (
          <p className="text-[11px] text-subtle leading-snug">
            {habitDraft.recurrence === "once"
              ? "Подія зʼявиться лише в день «Початок». Кінець можна залишити порожнім."
              : "Орієнтир — день місяця з «Початок». У коротких місяцях (наприклад 31 → лютий) — останній день місяця."}
          </p>
        )}

        {routine.tags.length > 0 && (
          <label className="block text-xs text-subtle">
            Тег
            <select
              className="routine-touch-select mt-1"
              value={habitDraft.tagIds[0] || ""}
              onChange={(e) => {
                const id = e.target.value;
                setHabitDraft((d) => ({
                  ...d,
                  tagIds: id ? [id] : [],
                }));
              }}
            >
              <option value="">— без тегу —</option>
              {routine.tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <span className="block text-[10px] text-subtle mt-1 leading-snug">
              Один тег на звичку (поле tagIds у даних — масив для сумісності).
            </span>
          </label>
        )}
        {routine.categories.length > 0 && (
          <label className="block text-xs text-subtle">
            Категорія
            <select
              className="routine-touch-select mt-1"
              value={habitDraft.categoryId || ""}
              onChange={(e) => {
                const id = e.target.value;
                setHabitDraft((d) => ({ ...d, categoryId: id || null }));
              }}
            >
              <option value="">— без категорії —</option>
              {routine.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji ? `${c.emoji} ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className={cn("w-full font-bold", C.primary)}
            onClick={saveHabit}
          >
            {editingId ? "Зберегти зміни" : "Додати звичку"}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="ghost"
              className="w-full border border-line/70"
              onClick={cancelEdit}
            >
              Скасувати
            </Button>
          )}
        </div>
      </section>

      <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-3">
        <h2 className="text-xs font-bold text-subtle uppercase tracking-widest">
          Теги
        </h2>
        <div className="flex gap-2 items-stretch">
          <Input
            className="routine-touch-field min-w-0 flex-1"
            placeholder="Новий тег"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px] shrink-0 border border-line/70 px-4"
            onClick={() => {
              setRoutine((s) => createTag(s, tagDraft));
              setTagDraft("");
            }}
          >
            +
          </Button>
        </div>
        <ul className="flex flex-wrap gap-2">
          {routine.tags.map((t) => (
            <li
              key={t.id}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-panelHi text-xs border border-line/50 font-medium"
            >
              {t.name}
              <button
                type="button"
                className="text-subtle hover:text-danger min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg"
                onClick={() => setRoutine((s) => deleteTag(s, t.id))}
                aria-label={`Видалити ${t.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-3">
        <h2 className="text-xs font-bold text-subtle uppercase tracking-widest">
          Категорії
        </h2>
        <div className="flex flex-wrap gap-2 items-stretch">
          <Input
            className="routine-touch-field w-16 shrink-0"
            placeholder="🏠"
            value={catDraft.emoji}
            onChange={(e) =>
              setCatDraft((d) => ({ ...d, emoji: e.target.value }))
            }
          />
          <Input
            className="routine-touch-field min-w-0 flex-1 basis-[min(100%,14rem)]"
            placeholder="Назва категорії"
            value={catDraft.name}
            onChange={(e) =>
              setCatDraft((d) => ({ ...d, name: e.target.value }))
            }
          />
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px] w-full min-w-0 border border-line/70 sm:w-auto sm:min-w-[7rem]"
            onClick={() => {
              setRoutine((s) =>
                createCategory(s, catDraft.name, catDraft.emoji),
              );
              setCatDraft({ name: "", emoji: "" });
            }}
          >
            Додати
          </Button>
        </div>
      </section>

      <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-2">
        <h2 className="text-xs font-bold text-subtle uppercase tracking-widest">
          Активні звички
        </h2>
        <p className="text-[10px] text-subtle leading-snug">
          Порядок у списку = порядок у календарі. На десктопі можна перетягнути;
          на телефоні — кнопки ↑↓. Для клавіатури та скрінрідерів зручніші
          кнопки ↑↓.
        </p>
        <Input
          className="routine-touch-field w-full max-w-md"
          placeholder="Пошук у списку звичок…"
          value={habitListQuery}
          onChange={(e) => setHabitListQuery(e.target.value)}
          aria-label="Пошук звичок у списку"
        />
        <p className="sr-only" aria-live="polite">
          Порядок у списку можна змінити перетягуванням або кнопками вгору вниз.
        </p>
        {routine.habits.filter((h) => !h.archived).length === 0 && (
          <div className="rounded-xl border border-dashed border-line/70 bg-panelHi/50 p-4 text-center">
            <p className="text-sm text-muted">
              Поки порожньо — додай першу звичку формою вище.
            </p>
            {typeof onOpenCalendar === "function" && (
              <Button
                type="button"
                variant="ghost"
                className="mt-3 border border-line/70"
                onClick={onOpenCalendar}
              >
                Перейти до календаря
              </Button>
            )}
          </div>
        )}
        <ul className="space-y-2">
          {filteredActiveHabits.map((h) => {
            const recLabel =
              RECURRENCE_OPTIONS.find(
                (o) => o.value === (h.recurrence || "daily"),
              )?.label || "";
            return (
              <li
                key={h.id}
                draggable
                aria-grabbed={dragId === h.id}
                className={cn(
                  "flex flex-col gap-2 border-b border-line/40 pb-3 last:border-0 last:pb-0 cursor-grab active:cursor-grabbing",
                  editingId === h.id &&
                    "ring-2 ring-[#f0a090]/60 rounded-xl p-2 -mx-1",
                  dragId === h.id && "opacity-70",
                )}
                onDragStart={(e) => {
                  setDragId(h.id);
                  try {
                    e.dataTransfer.setData("text/plain", h.id);
                    e.dataTransfer.effectAllowed = "move";
                  } catch {
                    /* noop */
                  }
                }}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => {
                  e.preventDefault();
                  try {
                    e.dataTransfer.dropEffect = "move";
                  } catch {
                    /* noop */
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId = e.dataTransfer.getData("text/plain");
                  setDragId(null);
                  if (!fromId || fromId === h.id) return;
                  setRoutine((s) => {
                    const ordered = sortHabitsByOrder(
                      s.habits.filter((x) => !x.archived),
                      s.habitOrder || [],
                    ).map((x) => x.id);
                    const fi = ordered.indexOf(fromId);
                    const ti = ordered.indexOf(h.id);
                    if (fi < 0 || ti < 0) return s;
                    const next = [...ordered];
                    const [row] = next.splice(fi, 1);
                    next.splice(ti, 0, row);
                    return setHabitOrder(s, next);
                  });
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-medium">
                      {h.emoji} {h.name}
                    </span>
                    <p className="text-[10px] text-subtle mt-0.5">
                      {recLabel}
                      {h.timeOfDay ? ` · ${h.timeOfDay}` : ""}
                      {h.startDate ? ` · з ${h.startDate}` : ""}
                      {h.endDate ? ` до ${h.endDate}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-end shrink-0 max-w-[min(100%,12rem)] sm:max-w-none">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="min-w-[32px] min-h-[36px] rounded-lg border border-line/70 text-xs text-muted hover:text-text"
                        onClick={() =>
                          setRoutine((s) => moveHabitInOrder(s, h.id, -1))
                        }
                        aria-label="Вгору в списку"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="min-w-[32px] min-h-[36px] rounded-lg border border-line/70 text-xs text-muted hover:text-text"
                        onClick={() =>
                          setRoutine((s) => moveHabitInOrder(s, h.id, 1))
                        }
                        aria-label="Вниз в списку"
                      >
                        ↓
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="!h-9 !px-3 !text-xs border border-line/70"
                      onClick={() => {
                        setEditingId(h.id);
                        loadHabitIntoDraft(h);
                      }}
                    >
                      Змінити
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="!h-9 !px-3 !text-xs border border-line/70"
                      onClick={() => {
                        setRoutine((s) => setHabitArchived(s, h.id, true));
                        if (editingId === h.id) cancelEdit();
                      }}
                    >
                      В архів
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="!h-9 !px-3 !text-xs text-danger border border-danger/25"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Видалити звичку «${h.name}»? Відмітки по днях теж зникнуть.`,
                          )
                        ) {
                          setRoutine((s) => deleteHabit(s, h.id));
                          if (editingId === h.id) cancelEdit();
                        }
                      }}
                    >
                      Видалити
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {routine.habits.some((h) => h.archived) && (
        <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-2 opacity-95">
          <h2 className="text-xs font-bold text-subtle uppercase tracking-widest">
            Архів
          </h2>
          <p className="text-[10px] text-subtle">
            Не показуються в календарі; відмітки збережені.
          </p>
          <ul className="space-y-2">
            {routine.habits
              .filter((h) => h.archived)
              .map((h) => (
                <li
                  key={h.id}
                  className="flex flex-col gap-2 border-b border-line/40 pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm text-muted">
                    {h.emoji} {h.name}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="!h-9 !px-3 !text-xs border border-line/70"
                      onClick={() =>
                        setRoutine((s) => setHabitArchived(s, h.id, false))
                      }
                    >
                      Відновити
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="!h-9 !px-3 !text-xs text-danger border border-danger/25"
                      onClick={() => {
                        if (window.confirm(`Видалити «${h.name}» назавжди?`)) {
                          setRoutine((s) => deleteHabit(s, h.id));
                        }
                      }}
                    >
                      Видалити
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
