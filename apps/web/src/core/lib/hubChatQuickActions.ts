// Швидкі сценарії для HubChat — registry за специфікацією
// `docs/superpowers/specs/2026-04-24-assistant-quick-actions-v1-design.md`.
//
// Registry лише описує сценарії і генерує prompt; виконання іде через
// існуючий `send` у HubChat → Anthropic tool-use → `executeAction`.
// Жодних побічних ефектів тут бути не повинно — тримаємо файл pure,
// щоб тести були тривіальні.

export type QuickActionModule =
  | "hub"
  | "finyk"
  | "fizruk"
  | "routine"
  | "nutrition";

export interface QuickAction {
  /** Унікальний id (kebab-case) — стабільний ключ для React і аналітики. */
  id: string;
  /** Модуль, до якого належить сценарій. `hub` — крос-модульні дії. */
  module: QuickActionModule;
  /** Повний текст кнопки (desktop, modal "Ще"). */
  label: string;
  /** Короткий текст для chip-ів на mobile, де місця обмаль. */
  shortLabel: string;
  /** Назва іконки з `@shared/components/ui/Icon`. */
  icon: string;
  /**
   * Prompt, що передається в `send`. Якщо закінчується на `: ` —
   * сценарій неповний: треба вставити в input і дати юзеру дописати,
   * а не одразу відправляти.
   */
  prompt: string;
  /** Описова підказка для tooltip / "Ще" sheet. */
  description?: string;
  /**
   * Сортувальний пріоритет (нижче = вище у списку). Між модулями
   * сортуємо спершу по `module`-приналежності, потім по `priority`.
   */
  priority: number;
  /** Якщо true — кнопка disabled у offline-режимі. */
  requiresOnline: boolean;
  /** Ключові слова для майбутнього search/usage ranking. */
  keywords?: readonly string[];
}

/**
 * Базовий набір сценаріїв v1 (точно за таблицею у спеці §1).
 * Усі require online — без AI ці сценарії безглузді.
 */
export const QUICK_ACTIONS: readonly QuickAction[] = [
  // Hub — крос-модульні
  {
    id: "morning-briefing",
    module: "hub",
    label: "Ранковий брифінг",
    shortLabel: "Брифінг",
    icon: "sun",
    prompt: "Що важливого на сьогодні? Дай короткий ранковий брифінг.",
    description: "Підсумок з усіх 4 модулів за сьогодні.",
    priority: 10,
    requiresOnline: true,
    keywords: ["день", "сьогодні", "огляд"],
  },
  {
    id: "daily-summary",
    module: "hub",
    label: "Підсумок дня",
    shortLabel: "Підсумок",
    icon: "bar-chart",
    prompt: "Підсумуй мій день по фінансах, тренуваннях, звичках і харчуванню.",
    description: "Звіт по всіх 4 модулях за день.",
    priority: 20,
    requiresOnline: true,
    keywords: ["підсумок", "звіт", "вечір"],
  },

  // Фінік
  {
    id: "add-expense",
    module: "finyk",
    label: "Додати витрату",
    shortLabel: "Витрата",
    icon: "credit-card",
    prompt: "Додай витрату: ",
    description: "Швидко записати витрату — допиши суму і опис.",
    priority: 10,
    requiresOnline: true,
    keywords: ["expense", "транзакція"],
  },
  {
    id: "budget-risks",
    module: "finyk",
    label: "Ліміт бюджету",
    shortLabel: "Бюджет",
    icon: "target",
    prompt: "Покажи ризики по бюджетах і що варто змінити.",
    description: "Аналіз поточних лімітів і відхилень.",
    priority: 20,
    requiresOnline: true,
    keywords: ["budget", "ліміт"],
  },

  // Фізрук
  {
    id: "start-workout",
    module: "fizruk",
    label: "Почати тренування",
    shortLabel: "Тренування",
    icon: "dumbbell",
    prompt: "Почни тренування на сьогодні.",
    description: "Стартує сесію за програмою на сьогодні.",
    priority: 10,
    requiresOnline: true,
    keywords: ["workout", "gym"],
  },
  {
    id: "log-set",
    module: "fizruk",
    label: "Додати підхід",
    shortLabel: "Підхід",
    icon: "plus",
    prompt: "Додай підхід: ",
    description: "Допиши вправу, вагу і повторення.",
    priority: 20,
    requiresOnline: true,
    keywords: ["set", "підхід", "вправа"],
  },

  // Рутина
  {
    id: "mark-habit-done",
    module: "routine",
    label: "Позначити звичку",
    shortLabel: "Звичка",
    icon: "check",
    prompt: "Познач звичку виконаною: ",
    description: "Допиши назву звички, яку зробив сьогодні.",
    priority: 10,
    requiresOnline: true,
    keywords: ["habit", "звичка"],
  },
  {
    id: "missed-this-week",
    module: "routine",
    label: "Що пропущено",
    shortLabel: "Пропущено",
    icon: "calendar",
    prompt: "Що я пропустив у рутині цього тижня?",
    description: "Аналіз пропущених звичок за тиждень.",
    priority: 20,
    requiresOnline: true,
    keywords: ["streak", "тиждень"],
  },

  // Харчування
  {
    id: "log-meal",
    module: "nutrition",
    label: "Залогати їжу",
    shortLabel: "Їжа",
    icon: "utensils",
    prompt: "Залогай їжу: ",
    description: "Допиши страву і кількість.",
    priority: 10,
    requiresOnline: true,
    keywords: ["meal", "їжа"],
  },
  {
    id: "protein-target",
    module: "nutrition",
    label: "Добити білок",
    shortLabel: "Білок",
    icon: "target",
    prompt: "Що з'їсти сьогодні, щоб добити білок без перебору калорій?",
    description: "Підказка по їжі під поточний macro-баланс.",
    priority: 20,
    requiresOnline: true,
    keywords: ["protein", "macro"],
  },
];

/**
 * Чи закінчується prompt на `: ` — ознака неповного сценарію (треба
 * вставити в input, а не одразу відправляти). Спираємось на конвенцію
 * зі спеки §1.
 */
export function isIncompletePrompt(prompt: string): boolean {
  return /:\s$/.test(prompt);
}

/**
 * Сортує сценарії так, щоб першими були дії активного модуля, далі —
 * крос-модульні `hub`, далі — все інше. У межах однієї групи —
 * за `priority` (зростаюче). Stable: для рівних `priority` зберігаємо
 * порядок з `actions`.
 */
export function sortQuickActionsForModule(
  actions: readonly QuickAction[],
  activeModule: QuickActionModule | null,
): QuickAction[] {
  const groupRank = (m: QuickActionModule): number => {
    if (activeModule && m === activeModule) return 0;
    if (m === "hub") return 1;
    return 2;
  };
  return actions
    .map((a, idx) => ({ a, idx }))
    .sort((x, y) => {
      const dg = groupRank(x.a.module) - groupRank(y.a.module);
      if (dg !== 0) return dg;
      const dp = x.a.priority - y.a.priority;
      if (dp !== 0) return dp;
      return x.idx - y.idx;
    })
    .map(({ a }) => a);
}

/**
 * Готує впорядкований топ для chips. Обмежуємо до `limit` (default 6),
 * решта йде під кнопку «Ще» у викликаючому компоненті.
 */
export function pickTopQuickActions(
  actions: readonly QuickAction[],
  activeModule: QuickActionModule | null,
  limit = 6,
): QuickAction[] {
  return sortQuickActionsForModule(actions, activeModule).slice(0, limit);
}
