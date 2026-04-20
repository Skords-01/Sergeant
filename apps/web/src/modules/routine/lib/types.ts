/**
 * Core domain types for the Routine module.
 */

export type Recurrence = "daily" | "weekdays" | "weekly" | "monthly" | "once";

export interface Habit {
  id: string;
  name: string;
  emoji?: string;
  tagIds?: string[];
  categoryId?: string | null;
  createdAt?: string;
  archived?: boolean;
  recurrence?: Recurrence | string;
  startDate?: string | null;
  endDate?: string | null;
  timeOfDay?: string;
  reminderTimes?: string[];
  weekdays?: number[];
}

export interface Tag {
  id: string;
  name: string;
  scope?: string;
}

export interface Category {
  id: string;
  name: string;
  emoji?: string;
}

export interface RoutinePrefs {
  showFizrukInCalendar?: boolean;
  showFinykSubscriptionsInCalendar?: boolean;
  routineRemindersEnabled?: boolean;
  [k: string]: unknown;
}

export interface RoutineState {
  schemaVersion: number;
  prefs: RoutinePrefs;
  tags: Tag[];
  categories: Category[];
  habits: Habit[];
  completions: Record<string, string[]>;
  pushupsByDate: Record<string, number>;
  habitOrder: string[];
  completionNotes: Record<string, string>;
}

export interface HabitDraftPatch {
  name?: string;
  emoji?: string;
  tagIds?: string[];
  categoryId?: string | null;
  recurrence?: Recurrence | string;
  startDate?: string | null;
  endDate?: string | null;
  timeOfDay?: string;
  reminderTimes?: string[];
  weekdays?: number[];
}

/**
 * Full habit draft used by HabitForm. All fields are defined (possibly
 * empty strings / empty arrays) so inputs are always controlled.
 */
export interface HabitDraft {
  name: string;
  emoji: string;
  tagIds: string[];
  categoryId: string | null;
  recurrence: Recurrence | string;
  startDate: string;
  endDate: string;
  timeOfDay: string;
  reminderTimes: string[];
  weekdays: number[];
}

export interface ReminderPreset {
  id: string;
  label: string;
  times: string[];
}

export interface CategoryDraft {
  name: string;
  emoji: string;
}

export interface PendingHabitDeletion {
  id: string;
  name: string;
  archived: boolean;
}

export interface PendingCategoryDeletion {
  id: string;
  name: string;
  habitCount: number;
}

export interface CreateHabitOptions extends HabitDraftPatch {
  name: string;
}

export interface CalendarRange {
  startKey: string;
  endKey: string;
}

export interface HubCalendarEvent {
  id: string;
  source: string;
  date: string;
  title: string;
  subtitle: string;
  tagLabels: string[];
  sortKey: string;
  fizruk?: boolean;
  finykSub?: boolean;
  sourceKind: string;
  habitId?: string;
  completed?: boolean;
  note?: string;
  timeOfDay?: string;
}

export interface RoutineBackupPayload {
  kind: "hub-routine-backup";
  schemaVersion: number;
  exportedAt: string;
  data: RoutineState;
}
