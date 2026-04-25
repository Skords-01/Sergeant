// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  QUICK_ACTIONS,
  isIncompletePrompt,
  sortQuickActionsForModule,
  pickTopQuickActions,
  type QuickAction,
} from "./hubChatQuickActions";

describe("isIncompletePrompt", () => {
  it("повертає true для prompt-а, що закінчується на ': '", () => {
    expect(isIncompletePrompt("Додай витрату: ")).toBe(true);
    expect(isIncompletePrompt("Додай підхід: ")).toBe(true);
  });

  it("повертає false для повного prompt-а", () => {
    expect(isIncompletePrompt("Що важливого на сьогодні?")).toBe(false);
    expect(isIncompletePrompt("Підсумуй мій день")).toBe(false);
  });

  it("не плутає двокрапку всередині речення з закінченням", () => {
    expect(isIncompletePrompt("Звіт: загальний по тижню")).toBe(false);
  });
});

describe("sortQuickActionsForModule", () => {
  it("ставить активний модуль першим, потім hub, потім решту", () => {
    const sorted = sortQuickActionsForModule(QUICK_ACTIONS, "fizruk");
    const modules = sorted.map((a) => a.module);
    const fizrukIdx = modules.indexOf("fizruk");
    const hubIdx = modules.indexOf("hub");
    const finykIdx = modules.indexOf("finyk");
    // fizruk (active) — на початку
    expect(fizrukIdx).toBe(0);
    // hub — після всіх fizruk-сценаріїв
    const lastFizrukIdx = modules.lastIndexOf("fizruk");
    expect(hubIdx).toBeGreaterThan(lastFizrukIdx);
    // решта (finyk) — після hub-блоку
    expect(finykIdx).toBeGreaterThan(hubIdx);
  });

  it("без активного модуля показує hub першим", () => {
    const sorted = sortQuickActionsForModule(QUICK_ACTIONS, null);
    expect(sorted[0]?.module).toBe("hub");
  });

  it("у межах одного модуля впорядковує за priority (зростаючим)", () => {
    const sorted = sortQuickActionsForModule(QUICK_ACTIONS, "finyk");
    const finykOnly = sorted.filter((a) => a.module === "finyk");
    for (let i = 1; i < finykOnly.length; i++) {
      const prev = finykOnly[i - 1];
      const curr = finykOnly[i];
      if (prev && curr) {
        expect(curr.priority).toBeGreaterThanOrEqual(prev.priority);
      }
    }
  });

  it("є stable для рівних priority", () => {
    const a: QuickAction = {
      id: "x1",
      module: "hub",
      label: "X1",
      shortLabel: "X1",
      icon: "sun",
      prompt: "x1",
      priority: 1,
      requiresOnline: true,
    };
    const b: QuickAction = { ...a, id: "x2", label: "X2", shortLabel: "X2" };
    const sorted = sortQuickActionsForModule([a, b], null);
    expect(sorted.map((q) => q.id)).toEqual(["x1", "x2"]);
  });
});

describe("pickTopQuickActions", () => {
  it("обмежує до limit штук", () => {
    const top = pickTopQuickActions(QUICK_ACTIONS, "hub", 4);
    expect(top).toHaveLength(4);
  });

  it("default limit = 6", () => {
    const top = pickTopQuickActions(QUICK_ACTIONS, "hub");
    expect(top).toHaveLength(6);
  });
});

describe("QUICK_ACTIONS registry", () => {
  it("має унікальні id", () => {
    const ids = QUICK_ACTIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("кожен сценарій має непустий prompt і label", () => {
    for (const a of QUICK_ACTIONS) {
      expect(a.prompt.trim().length).toBeGreaterThan(0);
      expect(a.label.trim().length).toBeGreaterThan(0);
      expect(a.shortLabel.trim().length).toBeGreaterThan(0);
    }
  });

  it("incomplete prompts не auto-send (по конвенції тільки для модульних дій)", () => {
    const incomplete = QUICK_ACTIONS.filter((a) =>
      isIncompletePrompt(a.prompt),
    );
    // Принаймні одна incomplete action на кожен з основних доменів
    expect(incomplete.some((a) => a.module === "finyk")).toBe(true);
    expect(incomplete.some((a) => a.module === "fizruk")).toBe(true);
    expect(incomplete.some((a) => a.module === "routine")).toBe(true);
    expect(incomplete.some((a) => a.module === "nutrition")).toBe(true);
  });

  it("має сценарії для всіх 5 модулів", () => {
    const modules = new Set(QUICK_ACTIONS.map((a) => a.module));
    expect(modules.has("hub")).toBe(true);
    expect(modules.has("finyk")).toBe(true);
    expect(modules.has("fizruk")).toBe(true);
    expect(modules.has("routine")).toBe(true);
    expect(modules.has("nutrition")).toBe(true);
  });
});
