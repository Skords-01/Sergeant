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

// ────────────────────── Weekly digest / coach ──────────────────────
// Верхня межа рядків на аналітичних полях — захист від безконтрольного
// prompt-injection payload-у в Anthropic. Числа тримаємо скінченними, щоб
// Infinity/NaN не просочились у промт.
const Num = z.number().finite().optional().nullable();

const FinykDigestSchema = z
  .object({
    totalSpent: Num,
    totalIncome: Num,
    monthlyBudget: Num,
    txCount: Num,
    topCategories: z
      .array(z.object({ name: z.string().max(120), amount: Num }))
      .max(20)
      .optional(),
  })
  .partial();

const FizrukDigestSchema = z
  .object({
    workoutsCount: Num,
    totalVolume: Num,
    recoveryLabel: z.string().max(120).optional().nullable(),
    topExercises: z
      .array(z.object({ name: z.string().max(120), totalVolume: Num }))
      .max(20)
      .optional(),
  })
  .partial();

const NutritionDigestSchema = z
  .object({
    avgKcal: Num,
    targetKcal: Num,
    avgProtein: Num,
    avgFat: Num,
    avgCarbs: Num,
    daysLogged: Num,
  })
  .partial();

const RoutineDigestSchema = z
  .object({
    overallRate: Num,
    habitCount: Num,
    habits: z
      .array(
        z.object({
          name: z.string().max(120),
          completionRate: Num,
          done: Num,
          total: Num,
        }),
      )
      .max(50)
      .optional(),
  })
  .partial();

export const WeeklyDigestSchema = z.object({
  weekRange: z.string().max(80).optional(),
  finyk: FinykDigestSchema.optional(),
  fizruk: FizrukDigestSchema.optional(),
  nutrition: NutritionDigestSchema.optional(),
  routine: RoutineDigestSchema.optional(),
});

const CoachSnapshotSchema = z
  .object({
    finyk: FinykDigestSchema.optional(),
    fizruk: FizrukDigestSchema.optional(),
    nutrition: NutritionDigestSchema.optional(),
    routine: RoutineDigestSchema.optional(),
  })
  .partial();

// Пам'ять coach-а зберігається сервером і повертається назад клієнтом —
// не валідуємо глибоко, лише обмежуємо кількість digest-ів.
const CoachMemoryEchoSchema = z
  .object({
    weeklyDigests: z.array(z.unknown()).max(24).optional(),
    lastInsightDate: z.string().max(80).optional().nullable(),
    lastInsightText: z.string().max(4000).optional().nullable(),
  })
  .partial();

export const CoachInsightSchema = z.object({
  snapshot: CoachSnapshotSchema.optional(),
  memory: CoachMemoryEchoSchema.optional(),
});

// Розмірні ліміти на окремі поля не застосовуємо — загальний
// blob-size check у `coachMemoryPost` (через `MAX_BLOB_SIZE`) слугує єдиним
// джерелом правди про розмір payload-у. Тут лише структура.
export const CoachMemoryPostSchema = z.object({
  weeklyDigest: z
    .object({
      weekKey: z.string(),
      weekRange: z.string().optional(),
      generatedAt: z.string().optional(),
      finyk: z.unknown().optional(),
      fizruk: z.unknown().optional(),
      nutrition: z.unknown().optional(),
      routine: z.unknown().optional(),
      overallRecommendations: z.array(z.string()).optional(),
    })
    .optional(),
});

// ────────────────────── Web-push ──────────────────────
// PushSubscription.endpoint — URL, але браузери видають доволі довгі
// (FCM/Apple > 300 символів), тому лише розумна верхня межа.
const PushKeys = z.object({
  p256dh: z.string().min(1).max(256),
  auth: z.string().min(1).max(256),
});

export const PushSubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: PushKeys,
});

export const PushUnsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});

export const PushSendSchema = z.object({
  userId: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  body: z.string().max(2000).optional(),
  module: z.string().max(40).optional().nullable(),
  tag: z.string().max(120).optional().nullable(),
});

// ────────────────────── Food-search / barcode ──────────────────────
export const FoodSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
});

export const BarcodeQuerySchema = z.object({
  // клієнт може присилати з пробілами/знаками — нормалізуємо у handler-і,
  // тут лише обмежуємо довжину й склад.
  barcode: z.string().trim().max(32),
});

export { z };
