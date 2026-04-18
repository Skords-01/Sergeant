// Zod-схеми доменних сутностей модуля ФІНІК.
// Використовуються typedStore та валідацією finykStorage.getBudget(), щоб
// ловити биті дані на read-time замість crash'у пізніше по ланцюжку.

import { z } from "zod";

export const BudgetTypeSchema = z.enum(["limit", "goal"]);

// Goal-бюджети не мають ліміту (у формі `limit` лишається "" після spread
// з initial-state у Budgets.jsx), тому `limit` опціональний. Preprocess
// нормалізує "" / null / NaN до undefined — без цього legacy goal-записи
// мовчки відфільтровувалися б у `getBudget()`.
const optionalNumberSchema = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return v;
}, z.number().finite().optional());

export const BudgetSchema = z
  .object({
    id: z.string().min(1),
    type: BudgetTypeSchema.optional(),
    limit: optionalNumberSchema,
    categoryId: z.string().optional(),
    label: z.string().optional(),
    target: optionalNumberSchema,
    current: optionalNumberSchema,
  })
  .passthrough();

export const BudgetsSchema = z.array(BudgetSchema);

export type BudgetParsed = z.infer<typeof BudgetSchema>;
