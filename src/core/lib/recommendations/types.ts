// Типи для реєстру правил рекомендацій.
//
// Замінюють «довгі buildFooRecs() з десятком if'ів», даючи тестованість
// per-rule і декларативний пріоритет. Натхненно json-rules-engine, але без
// DSL — правило це звичайна функція `evaluate(ctx)`.

export type Module = "finyk" | "fizruk" | "routine" | "nutrition" | "hub";

export interface Rec {
  id: string;
  module: Module;
  priority: number;
  icon: string;
  title: string;
  body: string;
  action: string;
}

export interface Rule<Ctx> {
  /** Унікальний ключ для логів/трейсингу (не плутати з id конкретного Rec). */
  id: string;
  module: Module;
  /**
   * Запускає правило. Повертає 0..N рекомендацій. Не мутує контекст.
   * Помилки правила мають бути оброблені — див. `runRules`.
   */
  evaluate(ctx: Ctx): Rec[];
}
