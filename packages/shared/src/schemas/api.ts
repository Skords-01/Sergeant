import { z } from "zod";

/**
 * Централізовані zod-схеми для AI/публічних endpoint-ів.
 * Обрізаємо довгі поля на сервері, щоб не платити Anthropic за
 * безконтрольні payload-и і не давати prompt injection-у розростатись.
 */

/** Локаль — вільний рядок, але не надто довгий (наприклад 'uk-UA'). */
const Locale = z.string().trim().min(2).max(16).optional();

// ────────────────────── User / /api/me ──────────────────────
/**
 * Публічний профіль користувача — повертається з `/api/me` і описує
 * мінімум, що бачить клієнт (web cookie-сесія або мобільний bearer-токен).
 *
 * Форма навмисно обрізана: без internal timestamps, id сесії чи інших
 * полів, що не повинні потрапляти в UI. Це єдине джерело правди для
 * `@sergeant/shared`, `@sergeant/api-client` та `apps/server`.
 */
export const UserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  emailVerified: z.boolean(),
});
export type User = z.infer<typeof UserSchema>;

/** Response shape for `/api/me` (і `/api/v1/me`). */
export const MeResponseSchema = z.object({ user: UserSchema });
export type MeResponse = z.infer<typeof MeResponseSchema>;

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
  image_base64: z
    .string()
    .min(100, "Порожнє зображення")
    .max(7_000_000, "Зображення завелике"),
  mime_type: z
    .string()
    .regex(/^image\/[a-z+.-]+$/i)
    .max(64)
    .optional(),
  prior_result: z.unknown().optional(),
  portion_grams: z.number().finite().positive().optional().nullable(),
  qna: z
    .array(
      z.object({
        question: z.string().max(500).optional(),
        answer: z.string().max(500).optional(),
      }),
    )
    .max(8)
    .optional(),
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

/** /api/nutrition/backup-upload */
export const BackupUploadSchema = z.object({
  // Зашифровано на клієнті; сервер не заглядає всередину структуру. Обмежуємо
  // лише тип і загальний розмір (останнє — у handler-і, бо z.object не
  // міряє JSON.stringify-байти).
  blob: z.record(z.string(), z.unknown()),
});

/** Спільний формат елемента комори для nutrition-ендпойнтів. */
const PantryItem = z.union([
  z.string().max(200),
  z.object({
    name: z.string().max(120).optional(),
    qty: z
      .union([z.number().finite(), z.string().max(32)])
      .optional()
      .nullable(),
    unit: z.string().max(32).optional().nullable(),
    notes: z.string().max(200).optional().nullable(),
  }),
]);

/** /api/nutrition/recommend-recipes */
export const RecommendRecipesSchema = z.object({
  pantry: z.array(PantryItem).max(200).optional(),
  preferences: z
    .object({
      goal: z.string().max(40).optional(),
      servings: z.number().finite().positive().optional(),
      timeMinutes: z.number().finite().positive().optional(),
      exclude: z.string().max(500).optional(),
      locale: Locale,
    })
    .partial()
    .optional(),
  count: z.number().finite().int().positive().max(10).optional(),
  locale: Locale,
});

/** /api/nutrition/day-hint, day-plan, week-plan, shopping-list */
const Macros = z.object({
  kcal: z.number().finite().nonnegative().nullable().optional(),
  protein_g: z.number().finite().nonnegative().nullable().optional(),
  fat_g: z.number().finite().nonnegative().nullable().optional(),
  carbs_g: z.number().finite().nonnegative().nullable().optional(),
});

/**
 * Цілі КБЖВ у форматі, який реально шле клієнт у day-hint:
 * `dailyTargetKcal`, `dailyTargetProtein_g`, ... Приймаємо і короткі
 * `kcal/protein_g/...` (як у day-plan), і довгі — тому `passthrough()`.
 */
const NutritionTargets = z
  .object({
    kcal: z.number().finite().nonnegative().nullable().optional(),
    protein_g: z.number().finite().nonnegative().nullable().optional(),
    fat_g: z.number().finite().nonnegative().nullable().optional(),
    carbs_g: z.number().finite().nonnegative().nullable().optional(),
    dailyTargetKcal: z.number().finite().nonnegative().nullable().optional(),
    dailyTargetProtein_g: z
      .number()
      .finite()
      .nonnegative()
      .nullable()
      .optional(),
    dailyTargetFat_g: z.number().finite().nonnegative().nullable().optional(),
    dailyTargetCarbs_g: z.number().finite().nonnegative().nullable().optional(),
  })
  .passthrough();

export const DayHintSchema = z.object({
  macros: Macros.optional(),
  targets: NutritionTargets.optional(),
  hasMeals: z.boolean().optional(),
  hasAnyMacros: z.boolean().optional(),
  macroSources: z
    .union([
      z.record(z.string().max(50), z.number().finite()),
      z.array(z.string().max(50)).max(20),
    ])
    .optional(),
  locale: Locale,
});

export const DayPlanSchema = z.object({
  pantry: z.array(PantryItem).max(200).optional(),
  targets: NutritionTargets.optional(),
  regenerateMealType: z
    .enum(["breakfast", "lunch", "dinner", "snack"])
    .optional(),
  locale: Locale,
});

export const WeekPlanSchema = z.object({
  pantry: z.array(PantryItem).max(200).optional(),
  preferences: z
    .object({
      goal: z.string().max(40).optional(),
    })
    .partial()
    .optional(),
  locale: Locale,
});

/** Рецепт для shopping-list — довільна форма з клієнта, обмежуємо розміри. */
const ShoppingListRecipe = z.object({
  title: z.string().max(200).optional(),
  ingredients: z.array(z.string().max(200)).max(50).optional(),
});

const ShoppingListWeekPlan = z
  .object({
    days: z
      .array(
        z.object({
          label: z.string().max(80).optional(),
          meals: z.array(z.string().max(500)).max(10).optional(),
        }),
      )
      .max(7)
      .optional(),
  })
  .partial();

export const ShoppingListSchema = z.object({
  recipes: z.array(ShoppingListRecipe).max(20).optional(),
  weekPlan: ShoppingListWeekPlan.optional(),
  pantryItems: z.array(PantryItem).max(300).optional(),
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

// Клієнтські агрегатори повертають `null`, коли у модулі немає даних за
// тиждень (див. `aggregateFizruk`/`aggregateNutrition`/`aggregateRoutine` у
// `src/core/useWeeklyDigest.ts`). `.nullish()` приймає і `null`, і
// `undefined`, тож запит проходить валідацію незалежно від того, чи
// клієнт пропускає поле, чи надсилає його як `null`.
export const WeeklyDigestSchema = z.object({
  weekRange: z.string().max(80).optional(),
  finyk: FinykDigestSchema.nullish(),
  fizruk: FizrukDigestSchema.nullish(),
  nutrition: NutritionDigestSchema.nullish(),
  routine: RoutineDigestSchema.nullish(),
});

const CoachSnapshotSchema = z
  .object({
    finyk: FinykDigestSchema.nullish(),
    fizruk: FizrukDigestSchema.nullish(),
    nutrition: NutritionDigestSchema.nullish(),
    routine: RoutineDigestSchema.nullish(),
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

// `snapshot` і `memory` можуть надходити як `null` (нема даних / перший
// сеанс без збереженої пам'яті), тому приймаємо `nullish`, а handler уже
// коректно обробляє обидва випадки через `snapshot?.finyk` / `memory || null`.
export const CoachInsightSchema = z.object({
  snapshot: CoachSnapshotSchema.nullish(),
  memory: CoachMemoryEchoSchema.nullish(),
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

// ────────────────────── Sync ──────────────────────
// Повторюємо константу `VALID_MODULES` з `server/modules/sync.js` у zod-enum:
// єдина SSOT — той Set; тут лише back-compat перелік для 400 з деталями поля.
const SyncModuleEnum = z.enum(["finyk", "fizruk", "routine", "nutrition"]);

// `clientUpdatedAt` — обов'язковий last-write-wins guard. Без нього
// `module_data.client_updated_at <= $4` зі сторожовою умовою у
// `syncPush`/`syncPushAll` завжди матчить (handler підставляв `new Date()`),
// тому push старого клієнта мовчки перезаписував свіжіший запис з іншого
// пристрою. Тепер клієнт, що не надсилає поле, отримує 400 замість
// тихої втрати даних.
//
// `.min(1)` / `.finite()` + refine на валідність `new Date(v)` — потрібні,
// бо інакше `""`, `NaN`, `"garbage"` проходили zod і ставали `Invalid Date`
// у хендлері: `pg` при серіалізації викидав `RangeError: Invalid time
// value`, і замість чистого 400 клієнт отримував 500 з внутрішнім стектрейсом.
const ClientUpdatedAtSchema = z
  .union([z.string().min(1), z.number().finite(), z.date()])
  .refine((v) => !Number.isNaN(new Date(v).getTime()), {
    message: "Invalid date",
  });

export const SyncPushSchema = z.object({
  module: SyncModuleEnum,
  // Клієнт може слати будь-який JSON всередині `data` (зашифрований blob),
  // тому глибоко не валідуємо — розмір обмежується у handler-і (5 MB).
  data: z.unknown().refine((v) => v !== undefined && v !== null, {
    message: "Missing data",
  }),
  clientUpdatedAt: ClientUpdatedAtSchema,
});

export const SyncPullSchema = z.object({
  module: SyncModuleEnum,
});

export const SyncPushAllSchema = z.object({
  modules: z.record(
    z.string(),
    z.object({
      data: z.unknown(),
      clientUpdatedAt: ClientUpdatedAtSchema,
    }),
  ),
});

// ────────────────────── Bank proxies (query validation) ──────────────────────
// `path` перевіряється ще raw-regex-ом в handler-ах (whitelist), тут тільки
// формат: починається з `/`, без CRLF і розумна довжина.
const BankApiPath = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .regex(/^\/[A-Za-z0-9\-_/]+$/, "Некоректний шлях API");

export const MonoQuerySchema = z
  .object({
    path: BankApiPath.optional(),
  })
  .passthrough();

export const PrivatQuerySchema = z
  .object({
    path: BankApiPath.optional(),
  })
  .passthrough();

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

/**
 * `/api/v1/push/register` — уніфікована реєстрація push-пристрою.
 *
 * `platform: "web"` — web-push: `token` несемо як endpoint URL, `keys`
 * обов'язкові (див. RFC 8030). `platform: "ios"|"android"` — native push:
 * `token` — opaque APNs/FCM device token, `endpoint`/`keys` відсутні.
 *
 * Валідатор нижче приймає обидва shape-и; handler сам маршрутизує у
 * правильну таблицю (`push_subscriptions` для web vs `push_devices` для
 * native). Довжини полів підібрані під реальні ліміти: FCM registration
 * token — до ~4KB, APNs — 64 hex (32 bytes), endpoint URL — до 2KB.
 */
export const PushRegisterSchema = z.discriminatedUnion("platform", [
  z.object({
    platform: z.literal("web"),
    token: z.string().url().max(2048),
    keys: PushKeys,
  }),
  z.object({
    platform: z.enum(["ios", "android"]),
    token: z.string().min(1).max(4096),
  }),
]);

/**
 * `/api/v1/push/unregister` — уніфіковане видалення push-пристрою.
 *
 * Web — знімаємо підписку за `endpoint` (запис у `push_subscriptions`
 * soft-delete-иться). Для native (ios/android) — soft-delete у
 * `push_devices` за opaque `token`. Форма поля — дзеркало
 * `PushRegisterSchema`, але для web ідентифікатор іменується `endpoint`
 * (як у `PushSubscription.endpoint`), а не `token`, щоб бек/фронт
 * не плутали payload реєстрації та анрегу при читанні логів.
 */
export const PushUnregisterSchema = z.discriminatedUnion("platform", [
  z.object({
    platform: z.literal("web"),
    endpoint: z.string().url().max(2048),
  }),
  z.object({
    platform: z.enum(["ios", "android"]),
    token: z.string().min(1).max(4096),
  }),
]);

// `.nullable()` на необов'язкових полях — для back-compat із воркерами, які
// історично слали `null` замість відсутнього поля.
export const PushSendSchema = z.object({
  userId: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  body: z.string().max(2000).optional().nullable(),
  module: z.string().max(40).optional().nullable(),
  tag: z.string().max(120).optional().nullable(),
});

/**
 * `POST /api/v1/push/test` — ручка для відправки тестового пуша на всі
 * зареєстровані пристрої поточного користувача. Auth обов'язкова; сервер
 * пропускає body через `sendToUser` (див. `apps/server/src/push/send.ts`)
 * і повертає агрегований summary.
 *
 * `data` — довільні key/value-рядки, що APNs/FCM передадуть у payload
 * без інтерпретації (дозволяє debug-payload без зміни schema).
 */
export const PushTestRequestSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  data: z.record(z.string().max(200), z.string().max(2000)).optional(),
  /**
   * Deep-link, що клієнт відкриє по тапу. Сервер прокине у `data.url` для
   * всіх трьох каналів; native/web handler читають з одного ключа.
   * URL-валідацію навмисно робимо м'якою (`.url()` без `.startsWith`), щоб
   * поза-HTTPS кастом-схеми (`sergeant://finyk/tx/123`) теж проходили.
   */
  url: z.string().trim().min(1).max(2048).optional(),
  /**
   * Background/silent push. `true` → iOS `content-available=1` без banner,
   * Android/FCM data-only. Web-push гілка ігнорує (див. `PushPayload`).
   */
  silent: z.boolean().optional(),
});

/**
 * Уніфікований summary-результат `sendToUser`. `delivered` — скільки
 * пристроїв по кожній платформі отримали push; `cleaned` — скільки dead
 * tokens сервер soft-deleted у цьому ж виклику; `errors` — список
 * платформо-специфічних помилок (per-device, не per-виклик).
 */
export const PushSendPlatformSchema = z.enum(["ios", "android", "web"]);
export const PushSendErrorSchema = z.object({
  platform: PushSendPlatformSchema,
  reason: z.string(),
});
export const PushSendSummarySchema = z.object({
  delivered: z.object({
    ios: z.number().int().nonnegative(),
    android: z.number().int().nonnegative(),
    web: z.number().int().nonnegative(),
  }),
  cleaned: z.number().int().nonnegative(),
  errors: z.array(PushSendErrorSchema),
});

export const PushTestResponseSchema = PushSendSummarySchema;

// ────────────────────── Pagination ──────────────────────
// Переused у будь-якому endpoint-і, що повертає список. Query-params завжди
// приходять рядками — `z.coerce.number()` конвертує "8" → 8 автоматично.
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ────────────────────── Food-search / barcode ──────────────────────
export const FoodSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  // `limit` — скільки результатів повернути (1–20, default 8). Query-param
  // приходить рядком — coerce конвертує автоматично.
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const BarcodeQuerySchema = z.object({
  // клієнт може присилати з пробілами/знаками — нормалізуємо у handler-і,
  // тут лише обмежуємо довжину й склад.
  barcode: z.string().trim().min(1, "Штрихкод не може бути порожнім").max(32),
});

export { z };
