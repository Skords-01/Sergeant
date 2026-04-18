// Zod-схеми доменних сутностей модуля ФІНІК.
// Використовуються typedStore та валідацією finykStorage.getBudget(), щоб
// ловити биті дані на read-time замість crash'у пізніше по ланцюжку.

import { z } from "zod";

export const BudgetTypeSchema = z.enum(["limit", "goal"]);

export const BudgetSchema = z
  .object({
    id: z.string().min(1),
    type: BudgetTypeSchema.optional(),
    limit: z.number().finite(),
    categoryId: z.string().optional(),
    label: z.string().optional(),
    target: z.number().finite().optional(),
    current: z.number().finite().optional(),
  })
  .passthrough();

export const BudgetsSchema = z.array(BudgetSchema);

export type BudgetParsed = z.infer<typeof BudgetSchema>;
