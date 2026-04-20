# Міграція на React Native (Expo)

> Документ-"source of truth" по перенесенню Sergeant із PWA-клієнта
> (`apps/web`, Vite + React + Tailwind + Workbox) на нативний iOS/Android
> клієнт (`apps/mobile`, Expo + React Native + Expo Router). Пишеться
> і оновлюється в міру виконання робіт — розглядайте це як живий
> roadmap, а не як одноразову проектну специфікацію.

## 1. Мета міграції

- Один нативний клієнт для iOS і Android, встановлюваний через App Store
  / Play Store (наразі "встановлення" доступне лише як PWA через
  Add-to-Home-Screen).
- Рідний UX на мобільних: haptics, native tab-bar, native gesture stack,
  push-нотифікації через APNs/FCM без обмежень Safari Web Push,
  background-таски (нагадування, sync), камера без `getUserMedia`
  capricious режимів iOS, native barcode-scanner.
- Максимальний реюз коду з `apps/web` через спільні workspace-пакети
  (`@sergeant/shared`, `@sergeant/api-client`, `@sergeant/finyk-domain`,
  `@sergeant/config`).
- Нуль регресій для існуючих web-користувачів на час міграції:
  `apps/web` (PWA) залишається повноцінним до моменту, поки `apps/mobile`
  не покриє 100% функціоналу.

## 2. Поточний стан (станом на цей документ)

### 2.1 Фаза 0 — скафолд `apps/mobile`. **Зроблено.**

Комміт піднімає окремий workspace `apps/mobile`:

- Expo 52 (`"expo": "~52.0.0"`), React Native 0.76, New Architecture
  (`newArchEnabled: true`).
- `expo-router` v4 з file-based navigation:
  - `app/(auth)/{sign-in,sign-up}.tsx` — модальна auth-група.
  - `app/(tabs)/{index,finyk,fizruk,routine,nutrition}.tsx` — основна
    таб-навігація з auth-guard через `useUser()` (redirect на sign-in).
  - `+not-found.tsx` — fallback.
- Інтеграція з Better Auth Expo: `@better-auth/expo`, токен у
  `expo-secure-store`, bearer-заголовок `Authorization: Bearer <token>`.
- Push: `expo-notifications` + `PushRegistrar` компонент, який після
  логіну отримує native APNs/FCM токен і реєструє його через
  `POST /api/v1/push/register` (див. `docs/mobile.md`).
- Monorepo-resolver у `metro.config.js` (watchFolders + nodeModulesPaths +
  `unstable_enablePackageExports`), щоб RN бачив `@sergeant/*` пакети
  напряму з TS-сорсів.
- Динамічний `app.config.ts` (читає `EXPO_PUBLIC_API_BASE_URL`,
  `EAS_PROJECT_ID`). `eas.json` з дефолтним build-profile.
- Провайдери в `app/_layout.tsx`:
  `GestureHandlerRootView → SafeAreaProvider → QueryProvider →
ApiClientProvider`. `QueryProvider` дзеркалить `apps/web/src/main.tsx`.
- 4 заглушки модулів (`ModuleStub`) — `finyk`, `fizruk`, `routine`,
  `nutrition`. Hub-екран показує ім'я юзера, sign-out,
  dev-only `usePushTest` для перевірки push-ланцюга.

### 2.2 Backend-передумови. **Зроблено.**

Сервер уже готовий до нативного клієнта (виконано в попередніх сесіях,
без пов'язаних мобільних змін):

- API v1 (`/api/v1/*`) — уніфікований префікс.
- Bearer-auth плагін Better Auth (токен у `set-auth-token` header на
  sign-in, далі йде в `Authorization`), cookies не обов'язкові.
- `POST /api/v1/push/register` з валідацією platform/token
  (`server/migrations/006_push_devices.sql`).
- Scheme `sergeant://` і `exp://` / `localhost:8081` у
  `trustedOrigins` Better Auth.
- Daily AI-quota (`server/aiQuota.js`, таблиця `ai_usage_daily`) —
  спільна з web.

### 2.3 Контракти і документи, що вже існують

- `apps/mobile/README.md` — запуск, архітектура, deep links, push.
- `docs/mobile.md` / `apps/mobile/docs/mobile.md` — API-контракт для
  мобілки: auth, deep links, push register, troubleshooting.
- `docs/api-v1.md` — опис `/api/v1/*` ендпоінтів.
- `docs/hub-modules-roadmap.md` — функціональний roadmap по модулях
  (не прив'язаний до RN, але джерело правди, ЩО треба перенести).
- `packages/api-client/` — HTTP-клієнт і React-хуки (`useUser`,
  `usePushRegister`, …), працюють в обох середовищах.
- `packages/shared/` і `packages/finyk-domain/` — чиста доменна логіка
  без DOM-залежностей (schemas, utils).

## 3. Цільова архітектура

```
sergeant/
├── apps/
│   ├── web/         ← PWA (Vite, React, Tailwind, Workbox)      [поточний клієнт]
│   ├── mobile/      ← Expo / React Native / Expo Router          [цільовий клієнт]
│   └── server/      ← Express, Better Auth, Postgres, Anthropic  [спільний]
└── packages/
    ├── api-client/      ← HTTP + React Query хуки (web + mobile)
    ├── shared/          ← domain types, schemas (Zod), pure utils
    ├── finyk-domain/    ← чиста доменна логіка фінансів
    └── config/          ← ESLint, TS, Prettier базові конфіги
```

Ключові принципи:

1. **Без зламу контрактів `@sergeant/*`.** Якщо мобільна імплементація
   потребує іншої API-форми (наприклад, інший шейп storage), розширюємо
   пакет абстракцією/стратегією, а не робимо mobile-only форк.
2. **Нуль DOM-залежностей у спільних пакетах.** Якщо зустрічаємо
   `window.*` / `localStorage` / `document` у `packages/*` — це баг
   для мобілки, закриваємо окремим PR. Наразі перевірено:
   `packages/shared/src/utils` і `packages/finyk-domain/src/*`
   чисті; `packages/api-client` залежить лише від `fetch` (є в RN).
3. **Дві точки входу — один бекенд.** Увесь state-синк через
   `/api/v1/*`; локальна персистенція — опційний кеш, не source of
   truth (див. секцію 6 про sync-модель).

## 4. Фазований план

Кожна фаза — окремий PR (або серія малих PR-ів), зелене CI, нуль
регресій на web. Порядок може перетасовуватись по ходу, але залежності
позначені.

| #   | Фаза                                           | Статус  | Залежить від | Опис                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------- | ------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | Скафолд `apps/mobile`                          | ✅ Done | —            | Expo + Expo Router + Better Auth + metro monorepo (секція 2.1).                                                                                                                                                                                  |
| 1   | Спільна UI-основа для RN                       | ⏳ Next | 0            | Theme tokens, базові компоненти (`Button`, `Card`, `Input`, `Banner`, `Toast`, `Skeleton`, `ConfirmDialog`, `Sheet`) у RN варіанті, дзеркалять `apps/web/src/shared/components/ui`. Design-tokens централізовано (див. `docs/design-system.md`). |
| 2   | Hub-ядро                                       | ⏸       | 1            | Dashboard, OnboardingWizard, HubSettings, SyncStatusIndicator, ErrorBoundary, ModuleErrorBoundary. Поки без HubChat / HubSearch / HubReports.                                                                                                    |
| 3   | CloudSync + офлайн-черга                       | ⏸       | 2            | Нативний аналог `core/useCloudSync.ts`: AsyncStorage + NetInfo + React Query persist; LWW-резолвер незмінний (живе в server).                                                                                                                    |
| 4   | Порт модуля Фінік                              | ⏸       | 1, 3         | `FinykApp.tsx` (792 LOC), всі сторінки (`Overview`, `Transactions`, `Budgets`, `Analytics`, `Assets`) і компоненти. Monobank API — без змін (server-side).                                                                                       |
| 5   | Порт модуля Рутина                             | ⏸       | 1, 3         | `RoutineApp.tsx` (728 LOC): календар, звички, heatmap, reminders. Reminders → `expo-notifications` scheduled.                                                                                                                                    |
| 6   | Порт модуля Фізрук                             | ⏸       | 1, 3         | `FizrukApp.tsx` + сторінки. `BodyAtlas` (`body-highlighter`) — див. секцію 7.8.                                                                                                                                                                  |
| 7   | Порт модуля Харчування                         | ⏸       | 1, 3, 6      | `NutritionApp.tsx` + фото-аналіз (reuse server) + barcode scanner (`expo-camera` + `expo-barcode-scanner`) + water tracker.                                                                                                                      |
| 8   | AI-шар (HubChat / CoachInsight / WeeklyDigest) | ⏸       | 2, 4-7       | `react-native`-сумісний стримінг (fetch ReadableStream у RN 0.76 працює). Speech-ввід → `expo-speech-recognition` або fallback на server-side transcription.                                                                                     |
| 9   | Hub-пошук + звіти                              | ⏸       | 2, 4-7       | `HubSearch` + `HubReports` (агрегації мають бути pure — живуть у `packages/*`, див. п.11).                                                                                                                                                       |
| 10  | Deep links + PWA shortcuts                     | ⏸       | 4-7          | Реалізувати всі `sergeant://...` маршрути з `docs/mobile.md`. Android-shortcuts через `app.config.ts → shortcuts`.                                                                                                                               |
| 11  | EAS build + App Store / Play Store             | ⏸       | 4-7 (MVP)    | EAS profiles (dev/preview/prod), App Store Connect + Google Play Console setup, signing, privacy labels, first TestFlight/Internal Testing.                                                                                                      |
| 12  | Monitoring + Analytics                         | ⏸       | 11           | `@sentry/react-native` замість `@sentry/react`, Web Vitals aналоги не потрібні (нативні метрики через Sentry + expo-perf).                                                                                                                       |
| 13  | Sunset-план для `apps/web`                     | ⏸       | 11           | Рішення: чи залишаємо PWA назавжди (реюз через `react-native-web`), чи консервуємо. Див. відкрите питання **Q1**.                                                                                                                                |

## 5. Мапування фіч web → mobile

Per module, які файли `apps/web` переносяться і в що саме.

### 5.1 `core/` (Hub)

| web                                             | mobile ціль                                           | нотатки                                                                             |
| ----------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `core/App.tsx` (router, shell)                  | `apps/mobile/app/_layout.tsx` + `(tabs)/_layout.tsx`  | expo-router замість `react-router-dom`.                                             |
| `core/AuthContext.tsx`                          | викид — сервером правди стає `useUser()` з api-client | Для мобілки контекст не потрібен; `authClient` already in `src/auth/authClient.ts`. |
| `core/AuthPage.tsx`                             | `apps/mobile/app/(auth)/{sign-in,sign-up}.tsx`        | Уже є scaffold; треба підключити validation з `@sergeant/shared/schemas`.           |
| `core/HubDashboard.tsx`                         | `apps/mobile/app/(tabs)/index.tsx` + `src/hub/*`      | RN-компоненти, FlashList для стрічок.                                               |
| `core/OnboardingWizard.tsx`                     | `apps/mobile/src/onboarding/*` + модальний route      | VibePicks/AhaMoment на RN.                                                          |
| `core/HubSearch.tsx`                            | `apps/mobile/src/hub/HubSearch.tsx`                   | `hubSearchEngine.ts` — pure, переїжджає as-is.                                      |
| `core/HubReports.tsx`                           | окрема screen-route, reuse агрегаторів                | Див. п.11.                                                                          |
| `core/HubChat.tsx` + `core/lib/hubChat*.ts`     | `apps/mobile/src/hub/chat/*`                          | Speech → `expo-speech-recognition`; streaming ReadableStream.                       |
| `core/WeeklyDigestCard.tsx` + `useWeeklyDigest` | дзеркало                                              | Серверний ендпоінт незмінний.                                                       |
| `core/TodayFocusCard.tsx`, `CoachInsightCard`   | дзеркало                                              | —                                                                                   |
| `core/ModuleErrorBoundary.tsx`                  | дзеркало (RN-friendly fallback UI)                    | —                                                                                   |
| `core/useCloudSync.ts`                          | `apps/mobile/src/sync/useCloudSync.ts`                | AsyncStorage + NetInfo + React Query persister.                                     |
| `core/sentry.ts`                                | `apps/mobile/src/monitoring/sentry.ts`                | `@sentry/react-native`.                                                             |
| `core/webVitals.ts`                             | — (викидаємо на мобілці)                              | Для native Sentry Performance даремно.                                              |
| `core/authClient.ts`                            | `apps/mobile/src/auth/authClient.ts` (вже є)          | —                                                                                   |

### 5.2 `modules/finyk`

- `FinykApp.tsx` (792 LOC) — shell, переносимо як RN-root екран модуля:
  `apps/mobile/src/modules/finyk/FinykApp.tsx`.
- Всі 5 сторінок (`Overview`, `Transactions`, `Budgets`, `Analytics`,
  `Assets`) — native screens у stack-навігаторі всередині табу Finyk.
- Компоненти `components/*` — дзеркалимо 1-в-1, але:
  - Графіки (`BudgetTrendChart`, `CategoryChart`, `NetworthChart`) —
    див. секцію 7.6.
  - `ManualExpenseSheet` → `@gorhom/bottom-sheet` або expo-router
    modal presentation.
  - `TxRow`, `TxListItem` — без DOM, просто View/Text/Pressable.
  - `SwipeToAction` (з `shared/components/ui`) — переписуємо на
    `react-native-gesture-handler` + Reanimated.
- `constants.ts`, `utils.ts`, `domain/*`, `lib/*` — pure, переносимо
  у `@sergeant/finyk-domain` (якщо ще не там) і реюзаємо.
- `hooks/*` — переглядаємо кожен на DOM-залежності; більшість чисті.
- `hubRoutineSync.ts` — pure, as-is.

### 5.3 `modules/fizruk`

- `FizrukApp.tsx` + сторінки (`Dashboard`, `Workouts`, `Exercise`,
  `Programs`, `Progress`, `Measurements`, `Body`, `Atlas`,
  `PlanCalendar`) — stack усередині табу Fizruk.
- `components/BodyAtlas.tsx` (`body-highlighter`) — **web-only
  SVG-бібліотека**; на мобілці або реалізуємо через
  `react-native-svg` з аналогічним SVG-body asset-ом, або через
  готові RN-бібліотеки (див. секцію 7.8).
- `data/*`, `domain/*`, `lib/*` — pure.
- Active-workout таймер (`useActiveFizrukWorkout`) — перевірити
  BackgroundTimer / KeepAwake (`expo-keep-awake`).

### 5.4 `modules/routine`

- `RoutineApp.tsx` + хаб-календар + heatmap.
- Heatmap — RN-рендер через FlashList/Grid + SVG; `react-native-svg`.
- Reminders (`useRoutineReminders`) — `expo-notifications`
  scheduled notifications замість Web Push scheduled.
- `context/*`, `hooks/*`, `lib/*` — в більшості pure.

### 5.5 `modules/nutrition`

- `NutritionApp.tsx` + всі компоненти.
- `BarcodeScanner.tsx` (ZXing) → `expo-camera` +
  `expo-barcode-scanner` (або new `CameraView` з `barcodeScanner`
  prop у Expo 52).
- `PhotoAnalyzeCard` — AI-аналіз залишається server-side, клієнт
  надсилає фото через `expo-image-picker` / `expo-camera` →
  `multipart/form-data` → той самий ендпоінт.
- `WaterTrackerCard`, `PantryCard`, `DailyPlanCard`, `MealSheet`,
  `ShoppingListCard` — чисті UI, прямий порт.
- `domain/*`, `lib/*`, `hooks/*` — pure.

## 6. Cross-cutting concerns

### 6.1 Локальне сховище і sync

Web використовує `localStorage` + `indexedDB` + офлайн-чергу у
`useCloudSync.ts`. На мобілці:

- **Малі значення** (токени, прапорці, user-prefs) →
  `expo-secure-store` / `AsyncStorage`.
- **Великі JSON-блоби** (module-data) — або `AsyncStorage` з batching,
  або перехід на `react-native-mmkv` (sync + швидко) / `expo-sqlite`.
  Потребує замір розміру payload-ів (див. відкрите питання **Q3**).
- **Офлайн-черга** — `NetInfo` + AsyncStorage-backed queue, дзеркалить
  web-чергу у `useCloudSync.ts`. LWW-резолвер живе на сервері,
  не змінюється.
- **React Query persister** — `@tanstack/query-async-storage-persister`
  для теплого старту. Опційно.

Ключі сховища мають префіксуватись `mobile:` щоб уникнути колізій із
shared tests, і бути задокументовані в
`apps/web/src/shared/lib/storageKeys.ts` (перенести у
`@sergeant/shared` — див. **TODO-refactor R1**).

### 6.2 Стилі й тема

Web: Tailwind + tokens у `apps/web/src/index.css` + `docs/BRANDBOOK.md`.

Мобільні варіанти:

- **StyleSheet + theme-object** (поточний `apps/mobile/src/theme.ts`) —
  мінімум залежностей, але багатослівний.
- **NativeWind** — класова Tailwind-like API, ближче до web,
  але додає compile-time обробку і пайплайн. Дає 80% реюзу класів.
- **Tamagui / Gluestack** — design-system-first, багато готових
  компонентів, але інвазивний.

Потрібне рішення **Q5**. До прийняття — продовжуємо на StyleSheet.

### 6.3 Навігація

Web: `react-router-dom` v7.
Mobile: `expo-router` v4 (file-based, зверху React Navigation).

Мапування URL-ів на deep links — у `docs/mobile.md`. Shell-рівень
вже піднятий (auth-модалка + tabs). Всередині кожного табу —
Stack-навігатор, файли під `app/(tabs)/<module>/*`.

### 6.4 Push-нотифікації

- Web: Web Push + VAPID, `usePushNotifications`, service worker.
- Mobile: `expo-notifications` → native APNs/FCM; `PushRegistrar`
  уже реєструє токен через `POST /api/v1/push/register`.
- Scheduled reminders (routine, fizruk):
  - web: `setTimeout` + service worker.
  - mobile: `Notifications.scheduleNotificationAsync` (native,
    працює у фоні без запущеного процесу).
- Payload має бути платформо-агностичний. Перевірити
  `server/api/push/*` — чи воно інакше серіалізує для web/native
  (наразі, судячи з коду, single-sink).

### 6.5 Голосовий ввід і speech

- Web: Web Speech API (`SpeechRecognition` в Chrome).
- Mobile: немає вбудованої RN-альтернативи, опції:
  - `@react-native-voice/voice` (bare-only),
  - `expo-speech-recognition` (community, але працює з Expo Go),
  - server-side transcription (Whisper) — вантажити аудіо через
    `expo-av` і транскрибувати серверно.
- `speechParsers` — pure, переносимо as-is.

Вибір — питання **Q6**.

### 6.6 Камера / штрихкод / фото-аналіз

- Barcode: `expo-camera` з `CameraView` + `barcodeScanner` prop
  (Expo 52) або `expo-barcode-scanner`. Підтримка EAN-13, UPC-A, QR.
- Фото-їжа: `expo-image-picker` (галерея) + `expo-camera`
  (shot на льоту) → `ImageManipulator` для resize → send to server.

### 6.7 Графіки

Web використовує кастомні компоненти + canvas/SVG.

Варіанти для RN:

- `victory-native` + `react-native-svg` — зрілий, багато типів.
- `react-native-gifted-charts` — швидкий.
- `react-native-reanimated-charts` — якщо хочемо жести/анімації.

Вибір — питання **Q7**. Для MVP ймовірно беремо `victory-native`.

### 6.8 Body Atlas

`body-highlighter` (web-only) → варіанти:

- Ручна SVG-модель у `react-native-svg` з тап-обробкою по path-ах
  (найгнучкіше, ~1 день роботи).
- `react-native-body-highlighter` (якщо існує у потрібному стані).

### 6.9 Безпека й ключі

- Токени: `expo-secure-store` (вже підключено).
- API base URL: `EXPO_PUBLIC_API_BASE_URL` (build-time).
- Не зберігати API-секрети на клієнті. AI-виклики йдуть лише через
  `apps/server`.

### 6.10 Background tasks

- Web-PWA виконує deferred roboti через service worker.
- Mobile: `expo-background-fetch` / `expo-task-manager` для синк-пулу.
  Поки не в MVP.

## 7. Web-only API → RN заміни (чеклист)

| web API                                   | зустрічається в                                        | RN-заміна                                                                   |
| ----------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- |
| `localStorage` / `sessionStorage`         | всюди, через `shared/lib/storage.ts`                   | `AsyncStorage` / `expo-secure-store` / `react-native-mmkv` (через адаптер). |
| `window.navigator.onLine`                 | `shared/hooks/useOnlineStatus.ts`                      | `@react-native-community/netinfo`.                                          |
| `document.visibilityState`                | (треба відсканувати)                                   | `AppState` з `react-native`.                                                |
| `Notification`, `navigator.serviceWorker` | `shared/hooks/usePushNotifications.ts`                 | `expo-notifications`.                                                       |
| `SpeechRecognition`, `speechSynthesis`    | `core/hooks/useSpeech.ts`, `HubChat`, `VoiceMicButton` | Секція 6.5.                                                                 |
| `getUserMedia`, `MediaStream`             | `nutrition/components/BarcodeScanner.tsx`              | `expo-camera`.                                                              |
| `@zxing/browser` + `@zxing/library`       | `nutrition/components/BarcodeScanner.tsx`              | `expo-camera` barcode scanner.                                              |
| `BarcodeDetector`                         | те саме                                                | те саме.                                                                    |
| `vite-plugin-pwa` / Workbox               | `apps/web` build                                       | **не мігруємо**, залишається тільки на web.                                 |
| `react-router-dom`                        | `apps/web/src/core/App.tsx`                            | `expo-router`.                                                              |
| Tailwind class-names                      | скрізь                                                 | StyleSheet або NativeWind (питання **Q5**).                                 |
| `body-highlighter`                        | `fizruk/components/BodyAtlas.tsx`                      | Секція 6.8.                                                                 |

## 8. Тестування

- `packages/*` — той самий Jest/Vitest, зелене CI = зелено для обох клієнтів.
- `apps/mobile` — Jest (`jest-expo`) + React Native Testing Library для
  unit/component. E2E — `maestro` або `detox` (питання **Q8**).
- Ручне smoke-тестування — Expo Go на фізичному пристрої (iOS + Android)
  перед кожним merge у master після Фази 4.

## 9. CI/CD

- Наявний CI (`turbo run lint | typecheck | test`) вже покриває
  `@sergeant/mobile` (`lint` + `typecheck` скрипти в `package.json`
  є). Треба додати:
  - `apps/mobile` до `turbo.json` pipeline-ів (перевірити, уже в).
  - Перевірку `app.config.ts` (`check-build-config` скрипт
    вже існує).
- EAS builds — окремий workflow (fire-on-tag, не на кожному PR).
- Preview-builds через **EAS Update** для internal testing без
  повного rebuild.

## 10. App Store / Play Store

Потрібно ще зробити:

- iOS: Apple Developer account, App Store Connect app record,
  privacy manifest (`PrivacyInfo.xcprivacy`), App Tracking Transparency
  (ймовірно NO — ми не треки), push-сертифікати APNs.
- Android: Google Play Console, internal testing track, Data Safety
  form, notification channel declarations.
- Legal: Privacy Policy URL (є у `apps/web`? треба перевірити),
  Terms of Use.
- Assets: іконка, splash, screenshots (5.5"/6.5" iOS, Android
  phone/tablet).

## 11. Технічний борг, який мігрує разом з RN

Під час порту ми змушені будемо винести pure-частини з `apps/web/src`
у пакети. План рефакторингів-супутників:

- **R1.** `apps/web/src/shared/lib/storageKeys.ts` → `@sergeant/shared`.
- **R2.** `hubSearchEngine.ts` + `recommendationEngine.ts` → pure
  package (наприклад `@sergeant/insights` або розширення
  `@sergeant/shared`).
- **R3.** `modules/finyk/lib/*`, `domain/*` — вже частково у
  `@sergeant/finyk-domain`; довести до 100% реюзу.
- **R4.** `modules/fizruk/data/*` (exercise library) — винести у
  доменний пакет `@sergeant/fizruk-domain` (новий).
- **R5.** Централізувати Zod-schemas `shared/schemas` → уже у
  `@sergeant/shared/schemas`, перевірити, щоб `apps/mobile` тягнув
  звідти, а не дублював.

Кожен R-пункт робиться окремим PR перед відповідною Фазою (щоб
mobile PR був маленький і тільки про UI).

## 12. Ризики

- **Expo SDK upgrade cadence** — ми на SDK 52 (остання LTS на
  момент написання), далі треба планувати підйоми SDK, кожен
  ламає щось у нативних плагінах.
- **Реюз `apps/web` компонентів через `react-native-web`** — можливо,
  але не ціль: PWA і native мають різні UX. Розглядаємо лише як
  запасний сценарій для Hub-чату або DesignShowcase.
- **Розмір бандла** — усі `@sergeant/*` тягнуться сирим TS у
  Metro; треба стежити за tree-shake-ом, особливо `@sergeant/finyk-domain`.
- **iOS background quota** — scheduled notifications + offline queue
  можуть впертись в iOS-обмеження фонових тасків. MVP — через
  push-пінг від сервера, не клієнт-сайд cron.
- **Apple App Review** — "personal finance" + AI чат = підвищена увага.
  Потрібен чіткий privacy policy і пояснення, що дані Monobank
  користувача ніколи не виходять за межі його сесії.

## 13. Відкриті питання (треба рішення юзера)

> Ці питання не блокують роботу над скафолдом/core, але блокують
> рішення по конкретних фазах. Позначені номером для зручних
> посилань у issue-трекері.

- **Q1. Доля `apps/web` після міграції.**
  Варіанти: (a) залишити як окремий продуктивний PWA назавжди,
  (b) заморозити після досягнення feature-parity з mobile,
  (c) реалізувати через `react-native-web` зі спільною code-base.
  Рекомендація: **(a)** — PWA закриває desktop use-case, де мобілки
  немає.

- **Q2. Публікація в магазинах як MVP-ціль.**
  Чи ми хочемо після Фази 4-5 уже мати Internal Testing у TestFlight /
  Google Play, чи публікуємось лише після повного порту всіх модулів?
  Рекомендація: **Internal Testing після Фази 4** (Фінік), щоб
  обкатати EAS-pipeline рано.

- **Q3. Sync-стек на мобілці: AsyncStorage чи MMKV/SQLite?**
  Залежить від розміру JSON-блобів модулів. Треба заміряти.
  Пропозиція — почати з AsyncStorage, якщо >200 KB на модуль —
  перейти на MMKV.

- **Q4. Чи мігруємо на Expo Dev Client одразу?**
  Так → треба EAS Build ранній setup, але повна свобода нативних
  модулів. Ні → Expo Go до Фази 11, але обмеженість у виборі
  нативних залежностей (наприклад, `@react-native-voice/voice`
  не працює в Expo Go).

- **Q5. Стильова система.**
  StyleSheet (що зараз) / NativeWind (Tailwind-like) / Tamagui /
  Gluestack. Рекомендація: **NativeWind** — 1:1 з web-Tailwind,
  найменший cognitive overhead при порту.

- **Q6. Speech-to-text на мобілці.**
  `@react-native-voice/voice` (потребує Dev Client) /
  `expo-speech-recognition` (community, Expo Go OK) / server-side
  Whisper. Рекомендація: **`expo-speech-recognition`** як MVP,
  потім сервер-сайд Whisper як uniform fallback.

- **Q7. Бібліотека графіків.**
  `victory-native` / `react-native-gifted-charts` /
  `react-native-reanimated-charts`. Рекомендація: **`victory-native`**
  (найближче до існуючих web-компонентів).

- **Q8. E2E тестування.**
  `maestro` (простий YAML) / `detox` (більше можливостей, складніший
  setup). Рекомендація: **`maestro`** для MVP.

- **Q9. Brand / design consistency.**
  Чи треба апдейтити BRANDBOOK.md під native patterns (haptics,
  platform-specific adjustments), чи тримаємо ідентичний look?

- **Q10. Monobank OAuth на мобілці.**
  На web Monobank зв'язується через token paste; перевірити, чи нічого
  не зломане на мобілці (має працювати, бо токен іде серверно).

## 14. Як читати цей документ

- **Якщо питаєш "а що я можу вже зараз робити?"** → переходь у
  `apps/mobile`, запускай `pnpm --filter @sergeant/mobile start`.
- **"Який наступний крок?"** → Фаза 1 (секція 4).
- **"Що саме перенести з модуля X?"** → Секція 5.X.
- **"Чим замінити `getUserMedia` / `localStorage` / ...?"** →
  Секція 7.
- **"Що блокує роботу над чимось?"** → Секція 13 (Відкриті питання).

---

_Документ живий. Редагуй у місці, де з'являється новий факт —
не додавай секції-зміни "Що нового з 12.04". PR-опис в історії
git закриває цю потребу._
