# Дорожня карта Hub ("Сержант")

Ціль: тримати короткий, практичний список пріоритетів по модулях і спільному ядру Hub. Кожен розділ має дві секції: що **реалізовано** і що **далі**.

---

## Hub (ядро)

### Реалізовано

- [x] Навігація між 4 модулями (Фінік, Фізрук, Рутина, Харчування)
- [x] Спільна UI-бібліотека (Banner, Button, Card, ConfirmDialog, EmptyState, Input, InputDialog, Select, Skeleton, SwipeToAction, Toast, VoiceMicButton)
- [x] Спільні хуки (useDarkMode, useDialogFocusTrap, useOnlineStatus, useToast)
- [x] AI-чат (HubChat, Anthropic)
- [x] Hub-бекап/відновлення (HubBackupPanel)
- [x] ModuleErrorBoundary — ізоляція помилок модулів
- [x] PWA: Service Worker, офлайн-кеш, встановлення на пристрій, push-нагадування у фоні
- [x] PWA shortcuts: 3 ярлики на головному екрані з deep-link роутингом
- [x] API-сервер: Railway / Replit (Express-агрегатор), CORS, rate-limit
- [x] Авторизація: email/password (Better Auth), сесійні cookie, PostgreSQL
- [x] Хмарна синхронізація між пристроями (useCloudSync, /api/sync/push, /api/sync/pull)
- [x] Офлайн-черга: push-операції у localStorage при відсутності мережі, replay при reconnect
- [x] Версійний трекінг синхронізації (LWW conflict resolution per module)
- [x] Міграційний UX: пропозиція завантажити локальні дані при першому вході
- [x] Глобальний пошук по Hub (HubSearch — їжа / тренування / транзакції / звички)
- [x] Онбординг для нових користувачів (OnboardingWizard)
- [x] Щотижневий AI-дайджест (WeeklyDigestCard, useWeeklyDigest, /api/weekly-digest)
- [x] Рекомендаційний рушій (HubRecommendations, recommendationEngine — без AI API)
- [x] Голосовий ввід (VoiceMicButton, speechParsers — UK/EN, у Харчуванні, Фізруку, Фінікові)
- [x] Hub-налаштування (HubSettingsPage) — централізована сторінка для всіх модулів
- [x] Hub-звіти (HubReports) — зведені звіти по всіх модулях
- [x] Сторінка входу/реєстрації (AuthPage), AuthContext/useAuth, authClient

### Наступні кроки

1. Уніфікований експорт даних усіх модулів в один архів
2. Push-нотифікації через Web Push API (зараз — тільки SW showNotification без підписки)
3. Спільна сторінка «Щоденник» — агрегований лог активностей усіх модулів за день
4. Email-нотифікації (тижневий дайджест, нагадування)

---

## ФІНІК (фінанси)

### Реалізовано

- [x] Синхронізація з Monobank (імпорт транзакцій, useMonobank, /api/mono)
- [x] Огляд, список транзакцій, фільтри (Overview, Transactions)
- [x] Категорії витрат із графіком (CategoryChart)
- [x] Бюджети (Budgets)
- [x] Активи та чиста вартість (Assets, NetworthChart)
- [x] Борги (DebtCard, debtEngine)
- [x] Підписки (SubCard, subscriptionUtils, інтеграція з календарем Рутини)
- [x] AI-чат по фінансах (Chat)
- [x] Бекап/відновлення даних Фініка (finykBackup)
- [x] Тренди бюджету (BudgetTrendChart)
- [x] Ручне додавання витрат/боргів (ManualExpenseSheet)
- [x] Прогноз витрат (forecastEngine)
- [x] SyncStatusBadge — стан хмарної синхронізації на Overview
- [x] PrivatBank business API (usePrivatbank, /api/privat) — реалізовано, вимкнено прапором `PRIVAT_ENABLED`
- [x] Інтеграція з календарем Рутини (hubRoutineSync)

### Наступні кроки

1. Цілі накопичення (savings goals) з прогрес-баром
2. Детекція регулярних витрат (автоматичне розпізнавання підписок з транзакцій)
3. Експорт CSV
4. Спліт транзакцій (розбиття однієї транзакції на кілька категорій)
5. Увімкнення PrivatBank у UI (зняти прапор `PRIVAT_ENABLED`)

---

## ФІЗРУК (спорт)

### Реалізовано

- [x] Каталог вправ (Atlas, Exercise) з групами м'язів (BodyAtlas)
- [x] Шаблони тренувань (WorkoutTemplatesSection, useWorkoutTemplates)
- [x] Активне тренування з таймером відпочинку (ActiveWorkoutPanel, RestTimerOverlay)
- [x] Журнал та каталог вправ у тренуванні (WorkoutJournalSection, WorkoutCatalogSection)
- [x] Додавання вправ та детальна картка (AddExerciseSheet, ExerciseDetailSheet)
- [x] Історія тренувань та статистика (Workouts, WeeklyVolumeChart)
- [x] Прогрес по вправах: 1RM та об'єм (Progress, MiniLineChart)
- [x] Виміри тіла (Measurements, useMeasurements)
- [x] Місячний план тренувань (PlanCalendar, useMonthlyPlan)
- [x] Відновлення: оцінка/прогноз з урахуванням сну та енергії (recoveryCompute, recoveryForecast, recoveryConflict)
- [x] Щоденний лог самопочуття: вага/сон/енергія/настрій з трендами (Body, useDailyLog)
- [x] Фото прогресу тіла (PhotoProgress, useBodyPhotos)
- [x] Програми тренувань: PPL, Upper/Lower, Full Body, Linear Progression (Programs, useTrainingProgram, trainingPrograms)
- [x] Бекап тренувань (WorkoutBackupBar)
- [x] Нагадування про тренування (useFizrukWorkoutReminder)
- [x] Налаштування таймера відпочинку per-категорія (useRestSettings)
- [x] Активність відтискань (usePushupActivity)

### Наступні кроки

- [x] Повноцінна PR board у Progress: всі вправи без ліміту, фільтр по групах м'язів, медалі (🥇🥈🥉), бейджи груп м'язів

1. Суперсети / кругові тренування
2. Підказки прогресивного навантаження (auto-progression)
3. Шеринг / експорт тренувань
4. Блок розминки / заминки в тренуванні

---

## Рутина

### Реалізовано

- [x] Hub-календар із агрегацією подій Фізрука та Фініка (hubCalendarAggregate)
- [x] Звички зі стріками та щоденним відмічанням (streaks)
- [x] Порядок звичок (habitOrder), drag & drop
- [x] Тижнева стрічка (WeekDayStrip)
- [x] Нотатки до виконання звичок (completionNoteKey)
- [x] Ремайндери/нагадування: декілька часів на звичку, presets (useRoutineReminders)
- [x] Віджет відтискань (PushupsWidget, routinePushupsRead)
- [x] Інтеграція підписок Фініка в календар (finykSubscriptionCalendar)
- [x] Налаштування (RoutineSettingsSection)
- [x] Хітмеп звичок (HabitHeatmap) — візуалізація виконання за місяць/рік
- [x] Панель статистики рутини (RoutineStatsPanel) — тижнева/місячна статистика виконання
- [x] Лідери та аутсайдери (HabitLeadersBlock) — кращі/гірші звички за 30 днів
- [x] Деталізація звички (HabitDetailSheet) — статистика, міні-календар, нотатки
- [x] Денний звіт (DayReportSheet) — повний список звичок за день з перемиканням
- [x] Прогрес-кільце дня (DayProgressRing) — SVG-кільце виконання на hero-секції
- [x] Чернетки звичок (routineDraftUtils)

### Наступні кроки

1. Категорії / групи звичок
2. Архівування звичок (приховати без видалення)
3. Лог настрою / енергії безпосередньо у Рутині (не через Фізрук)
4. Шаблони звичок (готові набори для початку)

---

## Харчування

### Реалізовано

- [x] Фото → AI-аналіз макросів (Anthropic Vision: analyze-photo, refine-photo)
- [x] Лог їжі по днях із підсумком калорій/макросів (LogCard, nutritionStorage)
- [x] Комора продуктів із AI-парсингом (PantryCard, PantryManagerSheet, parse-pantry)
- [x] Рецепти з наявних продуктів (RecipesCard, recommend-recipes)
- [x] Тижневий план харчування (week-plan)
- [x] Підказка по денному раціону (day-hint)
- [x] Ручне додавання їжі (AddMealSheet, ItemEditSheet)
- [x] Локальна база продуктів (foodDb, seedFoodsUk)
- [x] Фото-мініатюри страв (mealPhotoStorage)
- [x] Хмарний бекап із шифруванням (nutritionCloudBackup, backup-upload, backup-download)
- [x] Експорт логу (nutritionLogExport)
- [x] Цілі по макросах із пресетами Схуднення/Підтримка/Набір маси (goalPresets)
- [x] Сканер штрихкодів (BarcodeScanner, /api/barcode) — каскадний пошук: Open Food Facts → USDA FoodData Central → UPCitemdb (partial fallback)
- [x] Денний план харчування (DailyPlanCard, /api/nutrition/day-plan) — AI-генерація з урахуванням цілей
- [x] Список покупок (ShoppingListCard, /api/nutrition/shopping-list, shoppingListStorage) — AI-генерація з рецептів, мінус комора, групування по категоріях, позначення + додавання до комори
- [x] Дешборд харчування (NutritionDashboard) — зведена статистика
- [x] Пошук по логу з повторним додаванням страв (LogCard search)

### Наступні кроки

- [x] Трекер води (WaterTrackerCard, useWaterTracker, waterStorage — кнопки +200/300/500/750, прогрес-бар, ціль waterGoalMl у prefs)

1. Обрані страви (швидке повторне додавання)
2. Стріки харчування (послідовність днів з логуванням)
3. Мікронутрієнти (вітаміни, мінерали)

---

## Інфраструктура

### Реалізовано

- [x] PWA: Service Worker (src/sw.js) із vite-plugin-pwa (injectManifest), офлайн-кеш, Google Fonts offline, install banner
- [x] Express API-сервер із CORS, rate-limit, JSON-safe middleware
- [x] Деплой: Vercel (фронт) + Railway (API), Dockerfile.api; Replit unified server
- [x] localStorage як основне сховище даних модулів
- [x] PostgreSQL (Replit built-in) — users, sessions, module_data (JSONB + version)
- [x] Better Auth: email/password, cookie sessions, session caching
- [x] Хмарна синхронізація всіх модулів (push/pull/push-all/pull-all)
- [x] Офлайн-черга синхронізації з replay при reconnect
- [x] Хмарний бекап Харчування (шифрування); локальний бекап Фінік, Фізрук, Hub
- [x] CORS з підтримкою Replit-доменів (REPLIT_DOMAINS env var)
- [x] storageManager — централізований менеджер localStorage
- [x] storageQuota.js (`safeJsonSet` / `safeSetItem`) — захист від QuotaExceededError у всіх модулях
- [x] date.js (`toLocalISODate`) — уніфікований UTC-незалежний форматер дат
- [x] Barcode multi-DB cascade (`lookupOFF` / `lookupUSDA` / `lookupUPCitemdb`)

### Наступні кроки

1. Резервне копіювання PostgreSQL (scheduled snapshots)
2. Тести інтеграції для sync endpoints
3. Rate-limiting per-user для auth endpoints
4. CI/CD pipeline (GitHub Actions або Vercel checks)
