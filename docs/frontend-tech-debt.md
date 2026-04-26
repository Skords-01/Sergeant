# Frontend Tech Debt — Sergeant Web

Аналіз кодової бази `apps/web/src` (434 source файли, 87k рядків).

> **Оновлено 2026-04-26.** Базові cifri (allowlist size, file
> sizes, countи) переперевірені відносно поточного `eslint.config.js`
> і вмісту `apps/web/src/`.

> **Як читати:** позначки в стовпчику «Статус» оновлюються в момент злиття PR.
> Це жива сторінка — не «звіт», а контроль міграцій. Кожен запис стандартизує:
> в чому проблема, як ловити нові випадки в CI, і де вже стоїть guardrail.

---

## 🔴 Критичне

### 1. ~~Зламані тести~~ — Виконано

Раніше виглядало як «141 failed test file / 29 unresolved imports». Зараз
`apps/web/vitest.config.js` має повний alias-блок (`@shared`, `@finyk`,
`@fizruk`, `@routine`, `@nutrition`), що збігається з `tsconfig.json paths`.
`pnpm --filter @sergeant/web test` дає 80 test files / 722 теста, всі
зелені.

---

### 2. Прямі `localStorage` виклики — guardrail додано, міграція в процесі

**Раніше:** 71 файл напряму звертався до `localStorage.getItem/setItem` без
error handling — будь-який `JSON.parse(localStorage.getItem(...))` без
try/catch крашить на quota exceeded, corrupted storage або private browsing.

**Зараз:** додано власне ESLint-правило
[`sergeant-design/no-raw-local-storage`](../packages/eslint-plugin-sergeant-design/index.js)
зі scope `apps/web/src/**`. Воно блокує і `localStorage.foo`, і
`window.localStorage.foo` / `globalThis.localStorage.foo`. У
[`eslint.config.js`](../eslint.config.js) явний allowlist:

- **Тести** (`**/*.test.{ts,tsx,js,jsx}`, `**/__tests__/**`) — повний opt-out,
  бо виконують роль фікстур і ізольовані від production-ризиків.
- **Storage primitives** — самі обгортки (`safeReadLS`, `storageManager`,
  `storageQuota`, `typedStore`, `createModuleStorage`, `weeklyDigestStorage`,
  `useLocalStorageState`, `useDarkMode`, `usePushNotifications`,
  `useActiveFizrukWorkout`, `perf`).
- **Cloud-sync internals** — черга, патчер, state writer.
- **Module storage wrappers** — `modules/finyk/lib/storageManager`,
  `modules/finyk/hooks/useStorage`, `modules/nutrition/domain/nutritionBackup`.
- **TODO-список немігрованих файлів** — кожен файл, що ще
  читає/пише напряму, перерахований у `eslint.config.js` явно. Міграція
  файла = видалення рядка зі списку. На 2026-04-26 TODO-список
  містить 55 файлів (базовий рівень при введенні був 49; оновиться вниз
  після чергових міграцій).
  Фактичних raw `localStorage.*` call-сайтів у production файлах
  (включно з wrappers) — ~78 (`rg "\blocalStorage\." apps/web/src` = 118
  рядків разом з тестами).

**Що це дає:** новий код / нові файли НЕ зможуть додати прямий
`localStorage.*` без явного оновлення allowlist (видно в diff). Існуючі
call-сайти продовжують працювати, але зафіксовані як борг — список
greppable в одному місці.

**Fix recipes для міграції:**

- Прочитати JSON з безпечним fallback: `safeReadLS<T>(key, fallback)` з
  `@shared/lib/storage`.
- Записати JSON з обробкою quota: `safeWriteLS(key, value)`.
- Реактивне джерело істини в компоненті: хук
  `useLocalStorageState<T>(key, initial)` з `@shared/hooks/useLocalStorageState`.
- Цілий модуль зі своїм префіксом ключів: `createModuleStorage(prefix)`.

---

## 🟡 Бажане

### 3. ~~Import extensions (.js/.jsx) в TypeScript файлах~~ — Виконано

**Раніше:** 413 рядків з імпортами виду `from "./foo.js"` /
`from "./bar.jsx"` у `.ts`/`.tsx` файлах — працювало через Vite resolve, але
плутало IDE auto-imports і нових контриб'юторів.

**Зараз:** виконано codemod
[`scripts/strip-js-extensions.mjs`](../scripts/strip-js-extensions.mjs) —
видалив `.js`/`.jsx` з 436 first-party-імпортів у 180 файлах. Зачіпає тільки
шляхи, що починаються з `.`, `@shared/`, `@finyk/`, `@fizruk/`, `@routine/`,
`@nutrition/` або `@sergeant/`. Зовнішні пакети (`@zxing/...`) спеціально
не торкається — їхні subpath-імпорти можуть вимагати реальної `.js`.

Codemod ідемпотентний: повторний запуск дасть `would rewrite 0 import(s)`.

> **Не робилось:** ESLint-правило `import/extensions: never`. Воно б
> вимагало `eslint-plugin-import` (зараз не встановлено) і одразу б
> пофейлило зовнішній zxing-імпорт. Поки покладаємось на codemod +
> код-рев'ю; додамо правило окремим PR разом з імпорт-плагіном.

---

### 4. Великі файли (>600 рядків) — 25 файлів

| Рядків | Файл                                                |
| ------ | --------------------------------------------------- |
| 1614   | `nutrition/lib/foodDb/seedFoodsUk.ts`               |
| 1147   | `finyk/pages/Assets.tsx`                            |
| 1064   | `core/DesignShowcase.tsx`                           |
| 1060   | `core/ProfilePage.tsx`                              |
| 949    | `fizruk/components/workouts/ActiveWorkoutPanel.tsx` |
| 907    | `core/onboarding/seedDemoData.ts`                   |
| 902    | `core/hub/HubDashboard.tsx`                         |
| 894    | `fizruk/pages/Workouts.tsx`                         |
| 827    | `finyk/pages/Transactions.tsx`                      |
| 824    | `routine/components/RoutineCalendarPanel.tsx`       |
| 824    | `finyk/FinykApp.tsx`                                |
| 694    | `core/OnboardingWizard.tsx`                         |
| 692    | `fizruk/pages/Progress.tsx`                         |
| 688    | `core/lib/chatActions/fizrukActions.ts`             |
| 686    | `core/lib/hubChatContext.ts`                        |
| 671    | `routine/RoutineApp.tsx`                            |
| 669    | `nutrition/components/LogCard.tsx`                  |
| 662    | `core/hub/HubChat.tsx`                              |
| 642    | `sw.js`                                             |
| 638    | `core/hub/HubReports.tsx`                           |
| 637    | `fizruk/pages/Exercise.tsx`                         |
| 631    | `fizruk/pages/Body.tsx`                             |
| 610    | `nutrition/NutritionApp.tsx`                        |
| 610    | `core/hub/HubSearch.tsx`                            |

**Імпакт:** повільніший code review, важче тестувати окремі частини, можливі
circular deps.

**Fix:** поступовий split — витягувати sub-components, hooks, utils. Окремі
PR на кожен файл; великі data-файли (`seedFoodsUk.ts`) — кандидати на
розбиття за категоріями.

---

### 5. ~~`eslint-disable react-hooks/exhaustive-deps`~~ — Виконано (документація)

21 disable-сайт залишається, але тепер кожен має явне обґрунтування поряд
(intentional ref-based callback, mount-only effect, навмисне виключення
залежності щоб не зациклитись тощо). Див. зведений каталог
[`docs/apps-web-exhaustive-deps.md`](apps-web-exhaustive-deps.md). Якщо
з'являється новий disable без коментаря — рев'ю має його блокувати.

---

### 6. Тестове покриття — 80 test файлів на 434 source

~18% файлів мають тести. Критичні модулі без тестів (актуально):

- `HubReports.tsx` (638 рядків, складна агрегація)
- `TodayFocusCard.tsx` (recommendation engine інтеграція)
- `HubDashboard.tsx` (902 рядки)
- `ProfilePage.tsx` (1060 рядків)

**Fix:** пріоритетно додати тести на recommendation engine, reports
aggregation, cloud sync flows.

---

## 🟢 Nice-to-have

### 7. `console.log/debug` у production коді — 9 рядків

```
core/settings/GeneralSection.tsx:193  console.log("[sw] snapshot", snap)
core/settings/GeneralSection.tsx:215  console.log("[sw] caches cleared", res)
core/observability/analytics.ts:58                  console.log("[analytics]", event)
core/cloudSync/logger.ts:39-41        console.debug("[cloud-sync]")
core/cloudSync/hook/useCloudSyncDebug.ts:15  (docstring reference)
shared/lib/perf.ts:28                 console.debug("[perf]")
sw.js:491                             console.log("[sw] debug enabled", …)
```

Усі 9 — навмисні. `cloud-sync` / `perf` / `analytics` — debug-mode logger,
що пишеться через `console.debug` і не відображається в default-консолі.
`GeneralSection` — кнопки «Діагностика SW», що цілеспрямовано виводять
снапшот у консоль (toast: «SW-діагностика виведена в консоль»). `sw.js` —
service worker власний debug toggle. Виправлень не потрібно.

---

### 8. `eslint-disable no-eyebrow-drift` — 25 рядків

Custom DS-rule пригнічується 25 разів. Усі з обґрунтуваннями в коментарях
(кастомні hero kickers, calendar headers). Не критично; колись варто
розширити `SectionHeading` API, щоб ці випадки відпали.

---

### 9. `any` типи — 7 рядків (тільки в тестах)

| Файл                                               | Рядки                             |
| -------------------------------------------------- | --------------------------------- |
| `nutrition/hooks/usePhotoAnalysis.test.tsx`        | 1                                 |
| `nutrition/hooks/useNutritionCloudBackup.test.tsx` | 1                                 |
| `nutrition/hooks/useNutritionPantries.test.tsx`    | 4                                 |
| `nutrition/components/PantryCard.tsx`              | 1 (коментар про історичний `any`) |

Production код чистий. Тестові `any` — фабрики фіктур / промісів.

---

### 10. `@ts-expect-error` — 2 рядки (тільки в тестах)

`hubNav.test.ts:28,59` — тестування runtime guard з навмисно невалідним
вводом. Обґрунтоване.

---

## Recently completed

- ✅ Vitest path aliases — 80/80 файлів зелені
- ✅ Codemod `.js`/`.jsx` extensions — 436 імпортів очищено
- ✅ ESLint guardrail для прямих `localStorage.*` (нові виклики блокуються)
- ✅ `react-hooks/exhaustive-deps` disable-сайти — задокументовано

## Recommended next steps

1. **Міграція TODO-списку `no-raw-local-storage`** — пріоритетно файли з
   найбільшою кількістю викликів (`core/settings/FinykSection.tsx` — 20,
   `core/lib/chatActions/fizrukActions.ts` — 7, `core/hub/HubDashboard.tsx` — 5).
2. **File splitting** — Assets, ProfilePage, ActiveWorkoutPanel.
3. **Test coverage** — recommendation engine, reports aggregation, cloud
   sync flows.
4. Опційно — `eslint-plugin-import` + `import/extensions: never`, щоб
   codemod #3 був самозабезпечений правилом.
