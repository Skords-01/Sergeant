import { Button } from "@shared/components/ui/Button";
import { setHabitArchived } from "../../lib/routineStorage.js";

export function ArchivedHabitsSection({
  routine,
  setRoutine,
  onRequestDelete,
}) {
  const archived = routine.habits.filter((h) => h.archived);
  if (archived.length === 0) return null;

  return (
    <section className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card space-y-2 opacity-95">
      <h2 className="text-xs font-bold text-subtle uppercase tracking-widest">
        Архів
      </h2>
      <p className="text-[10px] text-subtle">
        Не показуються в календарі; відмітки збережені.
      </p>
      <ul className="space-y-2">
        {archived.map((h) => (
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
                onClick={() =>
                  onRequestDelete({ id: h.id, name: h.name, archived: true })
                }
              >
                Видалити
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
