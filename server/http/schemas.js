import { z } from "zod";

/**
 * Централізовані zod-схеми для AI/публічних endpoint-ів.
 * Обрізаємо довгі поля на сервері, щоб не платити Anthropic за
 * безконтрольні payload-и і не давати prompt injection-у розростатись.
 */

/** Локаль — вільний рядок, але не надто довгий (наприклад 'uk-UA'). */
const Locale = z.string().trim().min(2).max(16).optional();

/** Модерація: чат-повідомлення. */
export const ChatMessage = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

/** Результат виконання tool call-а на клієнті (повертається в chat). */
export const ToolResult = z.object({
  tool_use_id: z.string().min(1).max(200),
  content: z.union([z.string().max(8000), z.number(), z.boolean()]).optional(),
});

/** /api/chat */
export const ChatRequestSchema = z.object({
  context: z.string().max(40_000).optional().default(""),
  messages: z.array(ChatMessage).max(50).optional().default([]),
  tool_results: z.array(ToolResult).max(20).optional(),
  // tool_calls_raw — сирий вміст від Anthropic, не валідуємо глибоко,
  // лише гарантуємо, що це масив розумного розміру.
  tool_calls_raw: z.array(z.unknown()).max(20).optional(),
  stream: z.boolean().optional(),
});

/** /api/nutrition/analyze-photo */
export const AnalyzePhotoSchema = z.object({
  image_base64: z
    .string()
    .min(100, "Порожнє зображення")
    .max(7_000_000, "Зображення завелике"),
  mime_type: z
    .string()
    .regex(/^image\/[a-z+.-]+$/i)
    .max(64)
    .optional(),
  locale: Locale,
});

/** /api/nutrition/refine-photo */
export const RefinePhotoSchema = z.object({
  previous: z.unknown(),
  answers: z.record(z.string().max(200), z.string().max(500)).optional(),
  note: z.string().max(2000).optional(),
  locale: Locale,
});

/** /api/nutrition/parse-pantry */
export const ParsePantrySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "text is required")
    .max(10_000, "Text too large"),
  locale: Locale,
});

/** /api/nutrition/recommend-recipes */
export const RecommendRecipesSchema = z.object({
  pantry: z
    .array(
      z.object({
        name: z.string().max(120),
        qty: z.number().finite().optional().nullable(),
        unit: z.string().max(16).optional().nullable(),
        notes: z.string().max(200).optional().nullable(),
      }),
    )
    .max(200)
    .optional(),
  preferences: z.string().max(1000).optional(),
  exclude: z.array(z.string().max(120)).max(50).optional(),
  count: z.number().int().min(1).max(10).optional(),
  locale: Locale,
});

/** /api/nutrition/day-hint, day-plan, week-plan, shopping-list */
const Macros = z.object({
  kcal: z.number().finite().nonnegative().nullable().optional(),
  protein_g: z.number().finite().nonnegative().nullable().optional(),
  fat_g: z.number().finite().nonnegative().nullable().optional(),
  carbs_g: z.number().finite().nonnegative().nullable().optional(),
});

export const DayHintSchema = z.object({
  macros: Macros.optional(),
  targets: Macros.optional(),
  hasMeals: z.boolean().optional(),
  hasAnyMacros: z.boolean().optional(),
  macroSources: z.array(z.string().max(50)).max(20).optional(),
  locale: Locale,
});

export const DayPlanSchema = z.object({
  targets: Macros.optional(),
  preferences: z.string().max(1000).optional(),
  exclude: z.array(z.string().max(120)).max(50).optional(),
  locale: Locale,
});

export const WeekPlanSchema = z.object({
  targets: Macros.optional(),
  preferences: z.string().max(1000).optional(),
  exclude: z.array(z.string().max(120)).max(50).optional(),
  locale: Locale,
});

export const ShoppingListSchema = z.object({
  plan: z.unknown().optional(),
  pantry: z.array(z.unknown()).max(300).optional(),
  locale: Locale,
});

export { z };
