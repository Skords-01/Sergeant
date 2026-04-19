import { useState, type Dispatch, type SetStateAction } from "react";
import { cn } from "@shared/lib/cn";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { Button } from "@shared/components/ui/Button";
import { Card } from "@shared/components/ui/Card";
import { Input } from "@shared/components/ui/Input";
import { ConfirmDialog } from "@shared/components/ui/ConfirmDialog";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "../../lib/routineStorage.js";
import type {
  CategoryDraft,
  PendingCategoryDeletion,
  RoutineState,
} from "../../lib/types";

export interface CategoriesSectionProps {
  routine: RoutineState;
  setRoutine: Dispatch<SetStateAction<RoutineState>>;
  catDraft: CategoryDraft;
  setCatDraft: Dispatch<SetStateAction<CategoryDraft>>;
}

export function CategoriesSection({
  routine,
  setRoutine,
  catDraft,
  setCatDraft,
}: CategoriesSectionProps) {
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [deleteCatPending, setDeleteCatPending] =
    useState<PendingCategoryDeletion | null>(null);

  return (
    <>
      <Card as="section" radius="lg" padding="md" className="space-y-3">
        <SectionHeading as="h2" size="sm">
          {editingCatId ? "Редагувати категорію" : "Категорії"}
        </SectionHeading>
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
          {editingCatId ? (
            <>
              <Button
                type="button"
                variant="ghost"
                className="min-h-[44px] min-w-0 border border-line sm:min-w-[7rem]"
                onClick={() => {
                  setRoutine((s) =>
                    updateCategory(s, editingCatId, {
                      name: catDraft.name,
                      emoji: catDraft.emoji,
                    }),
                  );
                  setEditingCatId(null);
                  setCatDraft({ name: "", emoji: "" });
                }}
              >
                Зберегти
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-[44px] min-w-0 border border-line"
                onClick={() => {
                  setEditingCatId(null);
                  setCatDraft({ name: "", emoji: "" });
                }}
              >
                Скасувати
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className="min-h-[44px] w-full min-w-0 border border-line sm:w-auto sm:min-w-[7rem]"
              onClick={() => {
                setRoutine((s) =>
                  createCategory(s, catDraft.name, catDraft.emoji),
                );
                setCatDraft({ name: "", emoji: "" });
              }}
            >
              Додати
            </Button>
          )}
        </div>
        {routine.categories.length > 0 && (
          <ul className="space-y-2 mt-2">
            {routine.categories.map((c) => {
              const habitCount = routine.habits.filter(
                (h) => h.categoryId === c.id,
              ).length;
              return (
                <li
                  key={c.id}
                  className={cn(
                    "flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-panelHi border border-line",
                    editingCatId === c.id &&
                      "ring-2 ring-routine-ring/60 dark:ring-routine/40",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {c.emoji ? `${c.emoji} ` : ""}
                      {c.name}
                    </span>
                    <span className="shrink-0 text-2xs text-subtle bg-panel border border-line rounded-full px-2 py-0.5">
                      {habitCount}{" "}
                      {habitCount === 1
                        ? "звичка"
                        : habitCount >= 2 && habitCount <= 4
                          ? "звички"
                          : "звичок"}
                    </span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      className="text-subtle hover:text-text min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-xs"
                      onClick={() => {
                        setEditingCatId(c.id);
                        setCatDraft({ name: c.name, emoji: c.emoji || "" });
                      }}
                      aria-label={`Змінити ${c.name}`}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="text-subtle hover:text-danger min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-xs"
                      onClick={() =>
                        setDeleteCatPending({
                          id: c.id,
                          name: c.name,
                          habitCount,
                        })
                      }
                      aria-label={`Видалити ${c.name}`}
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteCatPending}
        title={`Видалити категорію «${deleteCatPending?.name}»?`}
        description={
          deleteCatPending?.habitCount > 0
            ? `${deleteCatPending.habitCount} ${deleteCatPending.habitCount === 1 ? "звичка втратить" : "звичок втратять"} прив'язку до цієї категорії.`
            : "Категорія буде видалена."
        }
        confirmLabel="Видалити"
        onConfirm={() => {
          if (deleteCatPending) {
            setRoutine((s) => deleteCategory(s, deleteCatPending.id));
            if (editingCatId === deleteCatPending.id) {
              setEditingCatId(null);
              setCatDraft({ name: "", emoji: "" });
            }
          }
          setDeleteCatPending(null);
        }}
        onCancel={() => setDeleteCatPending(null)}
      />
    </>
  );
}
