// @vitest-environment jsdom
/**
 * Extended tests for routineStorage: covers creation/update/delete/toggle/move/order
 * logic (previously only load/save were tested).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadRoutineState,
  createHabit,
  updateHabit,
  deleteHabit,
  toggleHabitCompletion,
  markAllScheduledHabitsComplete,
  setHabitArchived,
  addPushupReps,
  moveHabitInOrder,
  setHabitOrder,
  setCompletionNote,
  createTag,
  createCategory,
  updateTag,
  updateCategory,
  deleteTag,
  deleteCategory,
  buildRoutineBackupPayload,
  applyRoutineBackupPayload,
  ROUTINE_STORAGE_KEY,
} from "./routineStorage.js";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
});
afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

function fresh() {
  return loadRoutineState();
}

describe("createHabit", () => {
  it("додає нову звичку і habit_order", () => {
    const s1 = fresh();
    const s2 = createHabit(s1, { name: "Читати" });
    expect(s2.habits).toHaveLength(1);
    expect(s2.habits[0].name).toBe("Читати");
    expect(s2.habitOrder).toContain(s2.habits[0].id);
  });
  it("повертає оригінальний state коли name пустий", () => {
    const s1 = fresh();
    const s2 = createHabit(s1, { name: "   " });
    expect(s2).toBe(s1);
  });
  it("нормалізує weekdays — унікальні й відсортовані", () => {
    const s = createHabit(fresh(), {
      name: "Спорт",
      weekdays: [3, 1, 3, 5, 1],
    });
    expect(s.habits[0].weekdays).toEqual([1, 3, 5]);
  });
  it("персистить state у localStorage", () => {
    createHabit(fresh(), { name: "X" });
    const raw = localStorage.getItem(ROUTINE_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw).habits).toHaveLength(1);
  });
});

describe("updateHabit", () => {
  it("застосовує patch до потрібної звички", () => {
    const s1 = createHabit(fresh(), { name: "Old" });
    const id = s1.habits[0].id;
    const s2 = updateHabit(s1, id, { name: "New" });
    expect(s2.habits[0].name).toBe("New");
  });
  it("ігнорує неіснуючий id", () => {
    const s1 = createHabit(fresh(), { name: "A" });
    const s2 = updateHabit(s1, "ghost", { name: "Z" });
    expect(s2.habits[0].name).toBe("A");
  });
});

describe("deleteHabit", () => {
  it("видаляє звичку, completions та order запис", () => {
    let s = createHabit(fresh(), { name: "A" });
    const id = s.habits[0].id;
    s = toggleHabitCompletion(s, id, "2024-06-15");
    expect(s.completions[id]).toContain("2024-06-15");
    s = deleteHabit(s, id);
    expect(s.habits).toHaveLength(0);
    expect(s.completions[id]).toBeUndefined();
    expect(s.habitOrder).not.toContain(id);
  });
});

describe("toggleHabitCompletion", () => {
  it("позначає і знімає відмітку на запланованій даті", () => {
    let s = createHabit(fresh(), { name: "A" });
    const id = s.habits[0].id;
    s = toggleHabitCompletion(s, id, "2024-06-15");
    expect(s.completions[id]).toContain("2024-06-15");
    s = toggleHabitCompletion(s, id, "2024-06-15");
    expect(s.completions[id]).not.toContain("2024-06-15");
  });
  it("не додає відмітку на незаплановану дату (weekly recurrence)", () => {
    // weekdays = [0] (Mon ISO) для weekly-habit; 2024-06-15 — субота
    const s1 = createHabit(fresh(), {
      name: "Mon only",
      recurrence: "weekly",
      weekdays: [0],
    });
    const id = s1.habits[0].id;
    const s2 = toggleHabitCompletion(s1, id, "2024-06-15");
    expect(s2).toBe(s1);
  });
  it("дозволяє зняти попередньо збережену відмітку навіть якщо дата не запланована", () => {
    let s = createHabit(fresh(), { name: "A" });
    const id = s.habits[0].id;
    s = toggleHabitCompletion(s, id, "2024-06-15");
    s = updateHabit(s, id, { recurrence: "weekly", weekdays: [0] });
    s = toggleHabitCompletion(s, id, "2024-06-15");
    expect(s.completions[id] || []).not.toContain("2024-06-15");
  });
  it("нічого не робить для неіснуючої звички", () => {
    const s1 = fresh();
    const s2 = toggleHabitCompletion(s1, "ghost", "2024-06-15");
    expect(s2).toBe(s1);
  });
});

describe("markAllScheduledHabitsComplete", () => {
  it("відмічає всі активні заплановані, ігноруючи архівовані", () => {
    let s = fresh();
    s = createHabit(s, { name: "A" });
    s = createHabit(s, { name: "B" });
    s = createHabit(s, { name: "C" });
    const [a, b, c] = s.habits.map((h) => h.id);
    s = setHabitArchived(s, c, true);
    s = markAllScheduledHabitsComplete(s, "2024-06-15");
    expect(s.completions[a]).toContain("2024-06-15");
    expect(s.completions[b]).toContain("2024-06-15");
    expect(s.completions[c] || []).not.toContain("2024-06-15");
  });
  it("повертає same state коли нічого нового", () => {
    const s1 = fresh();
    const s2 = markAllScheduledHabitsComplete(s1, "2024-06-15");
    expect(s2).toBe(s1);
  });
});

describe("addPushupReps", () => {
  it("додає до лічильника за сьогодні", () => {
    let s = addPushupReps(fresh(), 10);
    expect(s.pushupsByDate["2024-06-15"]).toBe(10);
    s = addPushupReps(s, 5);
    expect(s.pushupsByDate["2024-06-15"]).toBe(15);
  });
  it("ігнорує невалідні reps", () => {
    const s1 = fresh();
    expect(addPushupReps(s1, 0)).toBe(s1);
    expect(addPushupReps(s1, -3)).toBe(s1);
    expect(addPushupReps(s1, "abc")).toBe(s1);
  });
});

describe("moveHabitInOrder", () => {
  it("міняє місцями сусідні елементи", () => {
    let s = fresh();
    s = createHabit(s, { name: "A" });
    s = createHabit(s, { name: "B" });
    s = createHabit(s, { name: "C" });
    const [a, b, _c] = s.habits.map((h) => h.id);
    s = moveHabitInOrder(s, b, -1);
    expect(s.habitOrder[0]).toBe(b);
    expect(s.habitOrder[1]).toBe(a);
  });
  it("no-op за межами масиву", () => {
    let s = fresh();
    s = createHabit(s, { name: "A" });
    s = createHabit(s, { name: "B" });
    const [a] = s.habits.map((h) => h.id);
    const s2 = moveHabitInOrder(s, a, -1);
    expect(s2.habitOrder).toEqual(s.habitOrder);
  });
});

describe("setHabitOrder", () => {
  it("застосовує порядок, залишаючи відсутні id у кінці", () => {
    let s = fresh();
    s = createHabit(s, { name: "A" });
    s = createHabit(s, { name: "B" });
    s = createHabit(s, { name: "C" });
    const [a, b, c] = s.habits.map((h) => h.id);
    s = setHabitOrder(s, [c, a]);
    expect(s.habitOrder[0]).toBe(c);
    expect(s.habitOrder[1]).toBe(a);
    expect(s.habitOrder).toContain(b);
  });
});

describe("setCompletionNote", () => {
  it("зберігає та очищує нотатку", () => {
    let s = createHabit(fresh(), { name: "A" });
    const id = s.habits[0].id;
    s = setCompletionNote(s, id, "2024-06-15", "Добре");
    const key = Object.keys(s.completionNotes)[0];
    expect(s.completionNotes[key]).toBe("Добре");
    s = setCompletionNote(s, id, "2024-06-15", "  ");
    expect(Object.keys(s.completionNotes)).toHaveLength(0);
  });
  it("обрізає нотатку до 500 символів", () => {
    const long = "a".repeat(600);
    let s = createHabit(fresh(), { name: "A" });
    const id = s.habits[0].id;
    s = setCompletionNote(s, id, "2024-06-15", long);
    const key = Object.keys(s.completionNotes)[0];
    expect(s.completionNotes[key].length).toBe(500);
  });
});

describe("tags and categories", () => {
  it("створення й оновлення тега", () => {
    let s = createTag(fresh(), "work");
    const t = s.tags[0];
    expect(t.name).toBe("work");
    s = updateTag(s, t.id, "home");
    expect(s.tags[0].name).toBe("home");
  });
  it("видалення тега видаляє посилання в habits", () => {
    let s = createTag(fresh(), "t1");
    const tid = s.tags[0].id;
    s = createHabit(s, { name: "A", tagIds: [tid] });
    s = deleteTag(s, tid);
    expect(s.tags).toHaveLength(0);
    expect(s.habits[0].tagIds).not.toContain(tid);
  });
  it("створення й оновлення категорії з емодзі", () => {
    let s = createCategory(fresh(), "Health", "💪");
    const c = s.categories[0];
    expect(c.emoji).toBe("💪");
    s = updateCategory(s, c.id, { name: "Wellness" });
    expect(s.categories[0].name).toBe("Wellness");
  });
  it("видалення категорії скидає categoryId в habits", () => {
    let s = createCategory(fresh(), "A");
    const cid = s.categories[0].id;
    s = createHabit(s, { name: "Habit A", categoryId: cid });
    s = deleteCategory(s, cid);
    expect(s.categories).toHaveLength(0);
    expect(s.habits[0].categoryId).toBeNull();
  });
});

describe("backup roundtrip", () => {
  it("build → apply повертає такий самий state", () => {
    const s1 = createHabit(fresh(), { name: "A" });
    toggleHabitCompletion(s1, s1.habits[0].id, "2024-06-15");
    const payload = buildRoutineBackupPayload();
    expect(payload.kind).toBe("hub-routine-backup");
    localStorage.clear();
    applyRoutineBackupPayload(payload);
    const restored = loadRoutineState();
    expect(restored.habits).toHaveLength(1);
    expect(Object.keys(restored.completions)).toHaveLength(1);
  });
  it("applyRoutineBackupPayload кидає на невалідному payload", () => {
    expect(() => applyRoutineBackupPayload(null)).toThrow();
    expect(() => applyRoutineBackupPayload({ kind: "wrong" })).toThrow();
    expect(() =>
      applyRoutineBackupPayload({ kind: "hub-routine-backup", data: null }),
    ).toThrow();
  });
});
