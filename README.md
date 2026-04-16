# Hub

Персональна платформа-хаб із модулями: **ФІНІК** (фінанси), **ФІЗРУК** (спорт), **Рутина** (календар, звички, план) та **Харчування** (лог їжі, AI-аналіз фото, рецепти). PWA — встановлюється на телефон, працює офлайн. Акаунти та хмарна синхронізація між пристроями через Better Auth + PostgreSQL.

## Модулі

| Модуль      | Опис                                                                                                            | Статус |
| ----------- | --------------------------------------------------------------------------------------------------------------- | ------ |
| ФІНІК       | Особисті фінанси, синхронізація з Monobank, бюджети, борги, активи, тренди витрат, ручне додавання             | Готово |
| ФІЗРУК      | Тренування (активне, таймер відпочинку), програми тренувань, прогрес, виміри, фото тіла, щоденник самопочуття  | Готово |
| Рутина      | Hub-календар, звички зі стріками, хітмеп, статистика, лідери/аутсайдери, деталізація, ремайндери               | Готово |
| Харчування  | Фото → AI-аналіз макросів, лог їжі, сканер штрихкодів, денний план, список покупок, комора, рецепти            | Готово |

## Hub-ядро (спільні фічі)

- **Авторизація**: реєстрація/вхід email+пароль (Better Auth), сесійні cookie, хмарна синхронізація між пристроями
- **Глобальний пошук** (`HubSearch`) — пошук по транзакціях, тренуваннях, їжі та звичках
- **Онбординг** (`OnboardingWizard`) — покроковий wizard для нових користувачів
- **Щотижневий дайджест** (`WeeklyDigestCard`, `useWeeklyDigest`) — AI-зведення тижня по всіх модулях
- **Рекомендаційний рушій** (`HubRecommendations`, `recommendationEngine`) — крос-модульні підказки без AI API
- **Голосовий ввід** (`VoiceMicButton`, `speechParsers`) — Web Speech API в Харчуванні, Фізруку та Фінікові
- **PWA shortcuts** — 3 ярлики на головному екрані (нова витрата, почати тренування, додати їжу)
- **Hub-налаштування** (`HubSettingsPage`) — централізована сторінка налаштувань усіх модулів
- **Hub-звіти** (`HubReports`) — зведені звіти по всіх модулях
- **Офлайн-черга** (`useCloudSync`) — синхронізація з чергою при відновленні з'єднання

## Структура

```
src/
├── core/
│   ├── App.jsx                   # Хаб: навігація між модулями, PWA install banner
│   ├── AuthContext.jsx            # AuthProvider + useAuth hook
│   ├── AuthPage.jsx               # Вхід / реєстрація
│   ├── authClient.js              # Better Auth React client
│   ├── HubBackupPanel.jsx         # Спільний бекап/відновлення
│   ├── HubChat.jsx                # AI-чат (Anthropic)
│   ├── HubDashboard.jsx           # Головна сторінка хабу
│   ├── HubRecommendations.jsx     # Крос-модульні рекомендації
│   ├── HubReports.jsx             # Зведені звіти
│   ├── HubSearch.jsx              # Глобальний пошук по всіх модулях
│   ├── HubSettingsPage.jsx        # Централізовані налаштування
│   ├── hubBackup.js               # Логіка бекапу/відновлення
│   ├── ModuleErrorBoundary.jsx    # Ізоляція помилок модулів
│   ├── OnboardingWizard.jsx       # Онбординг для нових користувачів
│   ├── useCloudSync.js            # Хмарна синхронізація + офлайн-черга
│   ├── useWeeklyDigest.js         # Щотижневий дайджест (логіка)
│   ├── WeeklyDigestCard.jsx       # Щотижневий дайджест (UI)
│   └── lib/
│       ├── insightsEngine.js      # Аналітика та зведення по модулях
│       ├── recommendationEngine.js# Правило-орієнтований рушій рекомендацій
│       └── speechParsers.js       # Парсери голосового вводу (UK/EN)
├── modules/
│   ├── finyk/                     # Фінанси
│   │   ├── pages/                 # Overview, Transactions, Budgets, Assets, Chat
│   │   ├── components/            # BudgetTrendChart, CategoryChart, DebtCard, ManualExpenseSheet,
│   │   │                          # NetworthChart, SubCard, SyncModal, SyncStatusBadge, TxRow
│   │   ├── hooks/                 # useMonobank, usePrivatbank, useStorage
│   │   ├── domain/                # debtEngine, subscriptionUtils
│   │   ├── lib/                   # finykBackup, forecastEngine
│   │   └── hubRoutineSync.js      # Синхронізація Фінік → Рутина (підписки в календар)
│   ├── fizruk/                    # Спорт
│   │   ├── pages/                 # Dashboard, Atlas, Exercise, Workouts, Progress,
│   │   │                          # Measurements, PlanCalendar, Body, Programs
│   │   ├── components/            # BodyAtlas, MiniLineChart, PhotoProgress,
│   │   │                          # WeeklyVolumeChart, WellbeingChart, WorkoutTemplatesSection
│   │   ├── components/workouts/   # ActiveWorkoutPanel, AddExerciseSheet, ExerciseDetailSheet,
│   │   │                          # ExercisePickerSheet, RestTimerOverlay, WorkoutBackupBar,
│   │   │                          # WorkoutCatalogSection, WorkoutFinishSheets, WorkoutJournalSection
│   │   ├── hooks/                 # useBodyPhotos, useDailyLog, useExerciseCatalog,
│   │   │                          # useFizrukWorkoutReminder, useMeasurements, useMonthlyPlan,
│   │   │                          # usePushupActivity, useRecovery, useRestSettings, useTrainingProgram,
│   │   │                          # useWorkouts, useWorkoutTemplates
│   │   └── lib/                   # fizrukStorage, recoveryCompute, recoveryConflict,
│   │                              # recoveryForecast, trainingPrograms, workoutStats, workoutUi
│   ├── routine/                   # Рутина та Hub-календар
│   │   ├── components/            # DayProgressRing, DayReportSheet, HabitDetailSheet,
│   │   │                          # HabitHeatmap, HabitLeadersBlock, PushupsWidget,
│   │   │                          # RoutineBottomNav, RoutineCalendarPanel, RoutineSettingsSection,
│   │   │                          # RoutineStatsPanel, WeekDayStrip
│   │   ├── hooks/                 # useRoutinePushups, useRoutineReminders, useVisualKeyboardInset
│   │   └── lib/                   # completionNoteKey, finykSubscriptionCalendar, habitOrder,
│   │                              # hubCalendarAggregate, routineConstants, routineDraftUtils,
│   │                              # routinePushupsRead, routineStorage, streaks, weekUtils
│   └── nutrition/                 # Харчування
│       ├── components/            # AddMealSheet, BarcodeScanner, ConfirmDeleteSheet,
│       │                          # DailyPlanCard, ItemEditSheet, LogCard, NutritionBottomNav,
│       │                          # NutritionDashboard, NutritionHeader, PantryCard,
│       │                          # PantryManagerSheet, PhotoAnalyzeCard, RecipesCard, ShoppingListCard
│       ├── hooks/                 # useNutritionLog, useNutritionPantries, usePhotoAnalysis,
│       │                          # useShoppingList
│       ├── domain/                # nutritionBackup
│       └── lib/                   # fileToBase64, foodCategories, foodDb, goalPresets, macros,
│                                  # mealPhotoStorage, mealTypes, mergeItems, nutritionApi,
│                                  # nutritionCloudBackup, nutritionErrors, nutritionLogExport,
│                                  # nutritionStats, nutritionStorage, pantryTextParser,
│                                  # recipeBook, recipeCache, recipeIds, shoppingListStorage
├── shared/
│   ├── components/ui/             # Banner, Button, Card, ConfirmDialog, EmptyState, Input,
│   │                              # InputDialog, Select, Skeleton, SwipeToAction, Toast, VoiceMicButton
│   ├── hooks/                     # useDarkMode, useDialogFocusTrap, useOnlineStatus, useToast
│   └── lib/                       # apiUrl, cn, perf, storageKeys, storageManager, themeHex
├── sw.js                          # Service Worker (PWA, офлайн-кеш, push-нагадування)
└── main.jsx                       # Точка входу, реєстрація SW

server/
├── railway.mjs                    # Express-агрегатор API (Railway / npm start)
├── replit.mjs                     # Entrypoint для Replit (фронт + API, порт 5000)
├── auth.js                        # Better Auth конфігурація (email/password, PostgreSQL adapter)
├── db.js                          # PostgreSQL connection pool
└── api/
    ├── barcode.js                 # Пошук продукту за штрихкодом
    ├── chat.js                    # AI-чат (Anthropic)
    ├── mono.js                    # Proxy до Monobank API
    ├── privat.js                  # PrivatBank business API proxy (вимкнено прапором)
    ├── sync.js                    # Хмарна синхронізація (push/pull по модулях)
    ├── weekly-digest.js           # Щотижневий AI-дайджест
    ├── lib/                       # cors, jsonSafe, rateLimit
    └── nutrition/                 # AI-ендпоінти харчування
        ├── analyze-photo.js       # Фото → макроси (Anthropic Vision)
        ├── backup-download.js     # Хмарний бекап (відновлення)
        ├── backup-upload.js       # Хмарний бекап (завантаження)
        ├── day-hint.js            # Підказка по денному раціону
        ├── day-plan.js            # AI-денний план харчування
        ├── parse-pantry.js        # Парсинг тексту комори
        ├── recommend-recipes.js   # Рецепти з наявних продуктів
        ├── refine-photo.js        # Уточнення результату аналізу фото
        ├── shopping-list.js       # AI-генерація списку покупок
        ├── week-plan.js           # Тижневий план харчування
        └── lib/                   # anthropicFetch, nutritionResponse, nutritionSecurity
```

Дорожня карта та ТЗ по модулях: [docs/hub-modules-roadmap.md](docs/hub-modules-roadmap.md).

## PWA

Hub — повноцінний Progressive Web App:

- **Встановлення**: на Android/iOS браузер запропонує «Додати на головний екран» або натисніть іконку в адресному рядку. Install banner з'являється після 2+ сесій і 30 секунд взаємодії.
- **Офлайн**: Service Worker кешує статику та shell — базовий інтерфейс доступний без мережі. Дані модулів зберігаються в localStorage.
- **Оновлення**: при виході нової версії SW автоматично оновлюється у фоні; з'являється банер «нова версія».
- **Shortcuts**: 3 ярлики на головному екрані — «Нова витрата», «Почати тренування», «Додати їжу» (deep-link через `?module=X&action=Y`).
- **Push-нагадування**: SW перевіряє звички кожну хвилину (setTimeout до наступної хвилинної межі) і відправляє `showNotification()` навіть у фоні.

## Запуск

Локально потрібні **два окремі процеси** у різних терміналах:

```bash
npm install
npm run start      # 1) Express API (railway.mjs, порт 3000)
npm run dev        # 2) Vite dev server (фронт, порт 5173) — проксує /api → 3000
```

На Replit: `npm run start:replit` — єдиний unified-процес (фронт + API, порт 5000).

## Змінні середовища

| Змінна                    | Обов'язково | Опис                                                                                                              |
| ------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | Так (авто)  | PostgreSQL connection string — авто-надається Replit; для Railway/Vercel задати вручну                            |
| `BETTER_AUTH_SECRET`      | Так         | Секрет шифрування сесій Better Auth (32+ символи) — задати вручну як secret                                       |
| `ANTHROPIC_API_KEY`       | Так         | Ключ Anthropic (чат, аналіз фото, рецепти, дайджест, підказки)                                                    |
| `NUTRITION_API_TOKEN`     | Ні          | Простий токен-гейт для `/api/nutrition/*` (перевіряється по `X-Token`)                                            |
| `ALLOWED_ORIGINS`         | Ні          | Додаткові CORS origin через кому (локальне та preview вже дозволені)                                              |
| `VITE_API_BASE_URL`       | Ні          | Базовий URL API **без** завершального `/`, напр. `https://xxx.up.railway.app` (порожньо → відносні шляхи)        |
| `VITE_API_PROXY_TARGET`   | Ні          | Тільки для `vite dev`: куди проксувати `/api/*` (типово `http://127.0.0.1:3000`)                                  |
| `VITE_NUTRITION_API_TOKEN`| Ні          | Токен Nutritionix для прямих запитів з фронту                                                                     |
| `PORT`                    | Ні          | Порт Express-сервера (типово `3000`)                                                                              |

> `DATABASE_URL` і `BETTER_AUTH_SECRET` не входять до `.env.example` (вони є секретами, а не публічними налаштуваннями). На Replit `DATABASE_URL` надається автоматично при підключенні бази даних. `BETTER_AUTH_SECRET` задається вручну через Secrets.

> Важливо: токени типу `VITE_*` потрапляють у клієнтський бандл — не використовуй їх як повноцінний захист.

## Авторизація та синхронізація

- **Better Auth** — email/password реєстрація/вхід на `/api/auth/*`, сесійні cookie (30 днів, daily refresh).
- **PostgreSQL** (`module_data` table) — JSON blobs per user per module з версійним трекінгом (LWW conflict resolution).
- **Sync endpoints**: `POST /api/sync/push`, `POST /api/sync/pull`, `POST /api/sync/push-all`, `POST /api/sync/pull-all`.
- **useCloudSync**: авто-push при змінах localStorage (debounce 5с) + 2-хв інтервал; офлайн-черга з replay при reconnect.
- **Міграційний UX**: при першому вході з наявними локальними даними — пропонує завантажити або пропустити.
- Auth є опціональною — застосунок повністю працює без входу, але вхід додає хмарний бекап і синхронізацію.

## API на Railway (ліміт Vercel Hobby: ≤12 functions)

Якщо Vercel відмовляє в деплої через кількість serverless-функцій, можна винести **весь** Hub API в один контейнер:

1. У Railway: новий сервіс з цього репозиторію, білд через [`Dockerfile.api`](Dockerfile.api) (див. [`railway.toml`](railway.toml)).
2. У змінних сервісу Railway задати секрети: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, опційно `NUTRITION_API_TOKEN`, `ALLOWED_ORIGINS`.
3. У **Vercel** (Environment Variables для Production/Preview): `VITE_API_BASE_URL` = публічний URL Railway (HTTPS).
4. Каталог API — у [`server/api/`](server/api/), у корені репо немає `api/`, тож Vercel Hobby не створює десятки serverless-функцій.

Локально: `npm start` (Express, порт 3000). Фронт `npm run dev`: без `VITE_API_BASE_URL` запити йдуть на `/api/*` і проксуються на `VITE_API_PROXY_TARGET`.

## Деплой

Vercel — автоматично при пуші в `main`. У [`vercel.json`](vercel.json): rewrite на `index.html` для SPA, без перехоплення `/api/*`. API — на **Railway** (`Dockerfile.api`). На **Replit**: єдиний unified-сервер `server/replit.mjs` (порт 5000). Дані модулів у **localStorage**; PostgreSQL — тільки для auth та cloud sync.
