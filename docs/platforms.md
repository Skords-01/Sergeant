# Статус трьох поверхонь — web / native / capacitor-shell

Короткий репорт «що готово до запуску, що треба доробити» по трьох
варіантах Sergeant-а. Живе поруч з `docs/mobile.md` (API-контракт) і
`docs/react-native-migration.md` (роадмап порту web → RN).

| Поверхня                       | Де живе             | Технології                 | Реліз-готовність                             |
| ------------------------------ | ------------------- | -------------------------- | -------------------------------------------- |
| **Web / PWA** (канонічна апка) | `apps/web`          | React 19 + Vite + PWA      | **Production** (live)                        |
| **Native RN** (iOS / Android)  | `apps/mobile`       | Expo SDK 52 + Expo Router  | **Internal dev-client**                      |
| **Capacitor shell** (WebView)  | `apps/mobile-shell` | Capacitor 7 + Android Java | **MVP** (Android closer, iOS blocked on Mac) |

Сервер (`apps/server`) — спільний для всіх трьох, деплой на Railway,
`/api/v1/*` з Better Auth (cookies для web, bearer для native/shell).
Конкретний статус сервера тримати тут не будемо — він просто `Production`,
деталі у `docs/api-v1.md` і `docs/backend-tech-debt.md`.

---

## 1. Web / PWA — `apps/web`

**Що є:** всі чотири модулі (Фінік, Фізрук, Рутина, Харчування) і весь
Hub-функціонал (AuthContext, HubSearch, HubChat, HubReports,
OnboardingWizard, WeeklyDigestCard, CoachInsight, VoiceMicButton,
HubRecommendations, HubSettingsPage), PWA з SW + Web Push через VAPID,
офлайн-черга через `useCloudSync`. Build artefact — `apps/server/dist`,
деплой Vercel (статика) → Railway (`/api/*`). Це **головна продакшн-точка**
Sergeant-а.

**CI:** `ci.yml` (lint + typecheck + vitest + web build),
`detox-android.yml` / `detox-ios.yml` — це для `apps/mobile`, не для web.
Preview-деплої на Vercel тепер працюють коректно після fix
`vercel.json#outputDirectory → apps/server/dist` ([#508](https://github.com/Skords-01/Sergeant/pull/508)).

**Що варто покращити:**

- Ранні routine-store flake-и у `apps/mobile/src/modules/routine/lib/__tests__/routineStore.test.ts`
  пофіксено у [#513](https://github.com/Skords-01/Sergeant/pull/513) (hard-coded date-key
  → динамічний `dateKeyFromDate(new Date())`, щоб `habitScheduledOnDate`
  не no-op-ив reducer після 2026-04-22). `check` job зеленіший.
- Bundle artefact: `vendor-zxing` (411kB) і `vendor` (345kB). **ZXing
  вже lazy** — `NutritionApp` загорнутий у `React.lazy` у
  `src/core/App.tsx:64`, а всередині `useBarcodeScanner.ts:94` йде
  `await import("@zxing/browser")`. У `apps/server/dist/index.html`
  chunk не preload-иться. На Chrome/Edge/Android Chrome спрацьовує
  нативний `BarcodeDetector` (`useBarcodeScanner.ts:219-282`), zxing-chunk
  не завантажується взагалі. 411 kB платять тільки Safari/Firefox
  користувачі і тільки якщо реально відкривають сканер штрихкоду.
  `vendor` (345kB) — react-runtime + основні бібліотеки, preload-иться
  навмисно.
- Web push тримає VAPID-keys і `webpush.sendNotification`; APNs/FCM для
  RN/shell — окремо (див. native секцію).
- `THIRD_PARTY_LICENSES.md` регенерується через `pnpm licenses:gen`
  (`scripts/generate-licenses.mjs`). Сканує prod-дерева `@sergeant/web`
  і `@sergeant/server`, фільтрує build/test-тулінг (babel, metro,
  react-native, jest, vitest, eslint тощо), що pnpm матеріалізує
  через peer-deps `@better-auth/expo → expo-constants → expo`, але
  які не ship-аться у Vercel-бандл і не викликаються на Railway.

**Blocking для релізу:** немає. Запускається як є.

---

## 2. Native RN — `apps/mobile`

**Що є:** Expo Router скафолд (tabs + (auth) модалка), Better Auth
bearer на SecureStore, `PushRegistrar` з native APNs/FCM токеном,
CloudSync + MMKV-офлайн-черга + React Query warm-start, і **три з
чотирьох** модулів портовані повністю з `apps/web`:

- `src/modules/finyk/*` — pages (Overview, Transactions, Analytics,
  Budgets, Assets), components, hooks, lib + `__tests__`.
- `src/modules/fizruk/*` — pages, components (workouts, programs, body,
  progress, measurements, exercise, dashboard), hooks + `__tests__`.
- `src/modules/routine/*` — pages (Habits, Heatmap), components,
  hooks, lib + `__tests__`.

**Не зроблено:**

- **Nutrition (Phase 7)** — лише `ModuleStub` + deep-link
  `DeepLinkPlaceholder` на `scan.tsx` / `recipe/[id].tsx`. Потрібно
  портувати ~30 компонентів з `apps/web/src/modules/nutrition`,
  замінити ZXing на `expo-camera` для сканера, AsyncStorage замість
  `localStorage` для комори/списку покупок.
- **iOS/Android native push-send path** — сервер зараз тільки реєструє
  токени у `push_devices`, реальна відправка через APNs (node-apn) / FCM
  HTTP v1 — окрема задача (див. `docs/mobile.md#push-notifications`).
- **Voice / Speech** — web використовує Web Speech API; для RN треба
  `expo-speech` + платформний STT (iOS Speech framework / Android
  `SpeechRecognizer`). Не початок.
- **App Store / Play метадані** — `app.config.ts` тримає bundle id
  `com.sergeant.app`, але store-listing + іконки + privacy manifest
  (iOS) + data safety form (Android) ще не зібрано.
- Два Detox конфіги в CI (`detox-ios.yml`, `detox-android.yml`) — наразі
  тільки smoke-build; реальні e2e-сценарії (login → hub → module) не
  дописані.

**Що варто покращити:**

- `react-native-worklets` знято з deps ([#509](https://github.com/Skords-01/Sergeant/pull/509)) —
  був ^0.8.1 несумісний з RN 0.76 і ламав iOS `pod install`. Після
  апгрейду RN (0.76 → 0.78+) можна повернути пакет за compatibility-таблицею
  Software Mansion ([docs](https://docs.swmansion.com/react-native-worklets/docs/guides/compatibility/)).
- Не забути згенерувати `google-services.json` для FCM і покласти
  його як EAS secret (`GOOGLE_SERVICES_JSON`, type: `file`). Без нього
  Android-push не стартує (`docs/mobile.md`).
- На фізичному iOS-девайсі потрібен `development-device` EAS-профіль
  без `ios.simulator: true` — зараз є тільки simulator-build у
  `development`.

**Blocking для релізу:** Nutrition-порт (фундамент value prop),
реальний push-send pipeline, store-listing. До цього — тільки
internal dev-client.

---

## 3. Capacitor shell — `apps/mobile-shell`

**Що є:** тонкий WebView-обгортка над `apps/web` build. `webDir`
вказує напряму в `apps/server/dist`, тому жодного копіювання — sync
бере готовий Vite-артефакт. Закомічені native-плагіни:

- `@capacitor/preferences` — bearer-token storage (Keychain / EncryptedSharedPreferences) [#505](https://github.com/Skords-01/Sergeant/pull/505)
- `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/keyboard`, `@capacitor/app` — native UX polish [#506](https://github.com/Skords-01/Sergeant/pull/506)
- `@capacitor-mlkit/barcode-scanning` — заміна ZXing у WebView [#504](https://github.com/Skords-01/Sergeant/pull/504)

`apps/mobile-shell/src/index.ts` → `initNativeShell()` налаштовує
status-bar / splash / keyboard / deep-links ідемпотентно. Auth через
bearer у `auth-storage.ts`, barcode через `barcodeNative.ts` — обидва
підключаються у `apps/web` динамічним `import()` за guard-ом
`isCapacitor()` (див. `apps/web/src/shared/lib/platform.ts`).

Android-частина (`android/`) закомічена, `applicationId`
= `com.sergeant.shell` (навмисно різний з `com.sergeant.app` RN-апки,
щоби могли співіснувати на одному девайсі).

**Не зроблено:**

- **GitHub Actions workflow для debug-APK.** `apps/mobile-shell/README.md`
  має TODO: `.github/workflows/mobile-shell-android.yml` треба
  закомітити мейнтейнеру вручну (Devin OAuth app не має `workflow`
  scope). Без нього — локальний Android SDK обовʼязковий.
- **iOS.** `ios/` НЕ закомічено — потрібен Mac + Xcode + CocoaPods для
  `pnpm --filter @sergeant/mobile-shell add:ios`. Release pipeline на iOS
  зараз немає.
- **Native push.** `usePushNotifications` у web користується Service
  Worker-ом + VAPID — у WebView це працює кульгаво (iOS тільки 16.4+,
  Android — лише якщо PWA установлено). Повний fix — окремий PR з
  `@capacitor/push-notifications` (FCM + APNs) і розширенням
  `createPushEndpoints.register` на `platform: "android" | "ios"`.
- ~~**Deep links.** `parseDeepLink()` в `src/index.ts` є, але
  `App.addListener('appUrlOpen', ...)` ще не звʼязаний з React Router
  всередині `apps/web` — треба exported `navigate()` прокинути.~~ Готово:
  shell диспатчить parsed path через namespaced
  `window.__sergeantShellNavigate` (встановлюється
  `<ShellDeepLinkBridge/>` у `apps/web/src/core/App.tsx` після маунту
  роутера) з буфером `window.__sergeantShellDeepLinkQueue` для cold-start
  сценарію (native-подія прилетіла ДО готовності React-шару).
- **Safe-area / keyboard avoidance** на iOS усе ще покладаються на
  CSS `env(safe-area-inset-*)` — працює, але не 100% якщо splash
  тримається довше за `hide()`.

**Що варто покращити:**

- Bundle size у WebView: сам `apps/web` build важить ~1.2MB gzipped,
  і перший cold-start через asset-extract довгий. Можна додати
  `capacitor.config.ts → server.cleartext: false` + виключити service
  worker з shell-бандла (зараз `sw.js` реєструється намарно — native
  layer його ігнорує, але код все одно вантажиться).
- `vite.config.js#manualChunks` вже виключає `/node_modules/@capacitor/`
  з `vendor` (див. коментар у конфігу) — це навмисно, бо інакше
  Capacitor-plugin-код їхав би до кожного web-юзера. Підʼєднувати нові
  plugin-и — оновлювати той коментар ([пр. #505](https://github.com/Skords-01/Sergeant/pull/505)).
- Split-brain з `apps/mobile`: якщо RN-апка реліз-готова раніше за shell
  (або навпаки), треба визначитись з product-side, яку постити на store.
  Жити обидві на одному акаунті Google Play дозволяє (`applicationId`
  різні), але Apple одне й те саме bundle-prefix обмежує.

**Blocking для релізу:** GitHub Actions workflow для APK (інакше без
Android SDK локально білд неможливий), native push, iOS `cap add ios` з
Mac.

---

## Пріоритетна черга (суб'єктивно)

1. **Web + мобільний shell (Android)** — найшвидший шлях до «в руках
   користувача»: web уже live, shell потребує тільки workflow-файл і
   підпис APK. **2–3 PR-и.**
2. **Native RN Nutrition-порт** — найдорожчий шматок (Phase 7),
   блокує справжній App Store / Play реліз. **4–6 PR-ів.**
3. **Native push-send (APNs + FCM)** — потрібно для будь-якого з двох
   native-шляхів. **1–2 PR-и на сервер + 1 клієнт.**
4. **iOS shell** — потрібен Mac у CI (EAS / GitHub Actions macOS
   runner), досі заблоковано відсутністю Xcode-env.
5. **Detox e2e coverage** — зараз білди-smoke; треба реальні сценарії
   sign-in → module → sign-out, інакше `detox-*` job-и дають false
   confidence.
