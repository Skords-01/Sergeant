import { useEffect, useRef, useState } from "react";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { useToast } from "@shared/hooks/useToast";
import { cn } from "@shared/lib/cn";
import { createHabit } from "../lib/routineStorage.js";
import {
  emptyHabitDraft,
  habitDraftToPatch,
} from "../lib/routineDraftUtils.js";
import { HabitForm } from "./settings/HabitForm";
import type { HabitDraft, RoutineState } from "../lib/types";
import type { Dispatch, SetStateAction } from "react";

export interface HabitQuickCreateDialogProps {
  open: boolean;
  routine: RoutineState;
  setRoutine: Dispatch<SetStateAction<RoutineState>>;
  onClose: () => void;
  /**
   * Bumped by the parent every time the dialog is opened via an external
   * trigger (PWA `add_habit` action, FTUX hero CTA, etc.) so the habit
   * form re-focuses its name input even if the user reopens the dialog
   * after closing it.
   */
  focusTick?: number;
}

/**
 * Lightweight "quick-create" sheet for a habit. Rendered on top of the
 * current Routine view (usually the Calendar) so that hitting the
 * `add_habit` PWA shortcut no longer yanks the user into the Settings
 * tab — see audit note S0.2.
 *
 * The dialog owns its own draft state; when the user saves we hand the
 * patch off to `createHabit` and close. Editing an existing habit is
 * still done inside the Settings tab's richer `HabitForm` host.
 */
export function HabitQuickCreateDialog({
  open,
  routine,
  setRoutine,
  onClose,
  focusTick,
}: HabitQuickCreateDialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocusTrap(open, ref, { onEscape: onClose });
  const toast = useToast();
  const [draft, setDraft] = useState<HabitDraft>(() => emptyHabitDraft());
  const [internalFocusTick, setInternalFocusTick] = useState(0);

  // Reset the draft and re-fire the focus tick each time the dialog
  // opens. Keeps reopens feeling like a fresh entry point instead of
  // carrying stale input.
  useEffect(() => {
    if (!open) return;
    setDraft(emptyHabitDraft());
    setInternalFocusTick((t) => t + 1);
  }, [open, focusTick]);

  if (!open) return null;

  const handleSave = () => {
    const patch = habitDraftToPatch(draft);
    if (!patch.name) {
      toast.warning("Додай назву звички.");
      return;
    }
    if (
      patch.recurrence === "weekly" &&
      (!patch.weekdays || patch.weekdays.length === 0)
    ) {
      toast.warning("Обери хоча б один день тижня.");
      return;
    }
    setRoutine((s) => createHabit(s, patch));
    toast.success("Звичку створено.");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-text/40 backdrop-blur-sm motion-safe:animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="habit-quick-create-title"
        className={cn(
          "relative z-10 w-full max-w-md mx-0 sm:mx-4",
          "bg-bg rounded-t-3xl sm:rounded-3xl shadow-float border border-line",
          "max-h-[92dvh] overflow-hidden flex flex-col",
          "animate-in slide-in-from-bottom-4 duration-200",
        )}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2
            id="habit-quick-create-title"
            className="text-base font-bold text-text"
          >
            Нова звичка
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-text hover:bg-panelHi transition-colors"
            aria-label="Закрити"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <HabitForm
            routine={routine}
            habitDraft={draft}
            setHabitDraft={setDraft}
            editingId={null}
            onSave={handleSave}
            onCancel={onClose}
            focusTick={internalFocusTick}
          />
        </div>
      </div>
    </div>
  );
}
