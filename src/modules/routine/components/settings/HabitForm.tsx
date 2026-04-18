import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { cn } from "@shared/lib/cn";
import { Button } from "@shared/components/ui/Button";
import { Input } from "@shared/components/ui/Input";
import {
  ROUTINE_THEME as C,
  RECURRENCE_OPTIONS,
} from "../../lib/routineConstants.js";
import { ReminderPresets } from "./ReminderPresets.jsx";
import { WeekdayPicker } from "./WeekdayPicker.jsx";
import type { HabitDraft, RoutineState } from "../../lib/types";

export interface HabitFormProps {
  routine: RoutineState;
  habitDraft: HabitDraft;
  setHabitDraft: Dispatch<SetStateAction<HabitDraft>>;
  editingId: string | null;
  onSave: () => void;
  onCancel: () => void;
  /**
   * Monotonic tick bumped by the parent (`RoutineApp`) when the
   * `add_habit` PWA action or the FTUX first-action sheet wants us to
   * scroll into view and focus the name input. A tick — not a bool —
   * so repeated triggers keep re-firing without the parent having to
   * reset anything.
   */
  focusTick?: number;
}

export function HabitForm({
  routine,
  habitDraft,
  setHabitDraft,
  editingId,
  onSave,
  onCancel,
  focusTick,
}: HabitFormProps) {
  const fieldIds = useId();
  const startId = `${fieldIds}-start`;
  const endId = `${fieldIds}-end`;
  const advancedId = `${fieldIds}-advanced`;
  const sectionRef = useRef<HTMLElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  // Minimal-first UX: emoji + name + regularity are visible on first
  // render. Dates, reminders, tags and categories live behind a
  // "Більше опцій" disclosure. When editing an existing habit we open
  // the advanced block so the user doesn't lose track of values they
  // already set.
  const [showAdvanced, setShowAdvanced] = useState(() => Boolean(editingId));
  useEffect(() => {
    if (editingId) setShowAdvanced(true);
  }, [editingId]);

  useEffect(() => {
    if (!focusTick) return;
    const section = sectionRef.current;
    const name = nameRef.current;
    if (section && typeof section.scrollIntoView === "function") {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (name && typeof name.focus === "function") {
      // Defer to the next frame so the scroll-into-view doesn't steal
      // focus by re-rendering the parent tab panel.
      requestAnimationFrame(() => {
        try {
          name.focus({ preventScroll: true });
        } catch {
          name.focus();
        }
      });
    }
  }, [focusTick]);

  return (
    <section
      ref={sectionRef}
      className="bg-panel border border-line rounded-2xl p-4 shadow-card space-y-3"
    >
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
          ref={nameRef}
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

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        aria-expanded={showAdvanced}
        aria-controls={advancedId}
        className="flex items-center gap-1 text-xs text-muted hover:text-text transition-colors"
      >
        <span>{showAdvanced ? "Менше опцій" : "Більше опцій"}</span>
        <span aria-hidden className="text-2xs">
          {showAdvanced ? "▲" : "▼"}
        </span>
      </button>

      {showAdvanced && (
        <div id={advancedId} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs text-subtle" htmlFor={startId}>
              Початок (дата)
              <Input
                id={startId}
                type="date"
                className="routine-touch-field mt-1 w-full"
                value={habitDraft.startDate || ""}
                onChange={(e) =>
                  setHabitDraft((d) => ({ ...d, startDate: e.target.value }))
                }
              />
            </label>
            <label className="block text-xs text-subtle" htmlFor={endId}>
              Кінець (необовʼязково)
              <Input
                id={endId}
                type="date"
                className="routine-touch-field mt-1 w-full"
                value={habitDraft.endDate || ""}
                onChange={(e) =>
                  setHabitDraft((d) => ({ ...d, endDate: e.target.value }))
                }
              />
            </label>
          </div>

          <ReminderPresets
            habitDraft={habitDraft}
            setHabitDraft={setHabitDraft}
          />

          {habitDraft.recurrence === "weekly" && (
            <WeekdayPicker
              weekdays={habitDraft.weekdays}
              onChange={(next) =>
                setHabitDraft((d) => ({ ...d, weekdays: next }))
              }
            />
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
              <span className="block text-2xs text-subtle mt-1 leading-snug">
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
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          className={cn("w-full font-bold", C.primary)}
          onClick={onSave}
        >
          {editingId ? "Зберегти зміни" : "Додати звичку"}
        </Button>
        {editingId && (
          <Button
            type="button"
            variant="ghost"
            className="w-full border border-line"
            onClick={onCancel}
          >
            Скасувати
          </Button>
        )}
      </div>
    </section>
  );
}
