# `@sergeant/mobile-shell` — Capacitor shell

Тонкий native-shell навколо `@sergeant/web`. Спочатку задумувався як PoC
(«чи запуститься поточний веб-код у WebView»), але зараз доріс до MVP:
bearer-auth, нативний barcode-сканер і UX-поліш (status bar, splash,
keyboard, deep links) вже закомічені і перевірені у білдах.

Канонічний мобільний клієнт усе ще живе в `apps/mobile` (Expo +
React Native). Співіснують навмисно: `applicationId` у shell —
`com.sergeant.shell`, у RN-апці — `com.sergeant.app`.

Короткий статус-репорт по всіх трьох поверхнях — `docs/platforms.md`.

## Що готово

| Функція                                       | Плагін / PR                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Bearer-auth (Keychain / EncryptedSharedPrefs) | `@capacitor/preferences` — [#505](https://github.com/Skords-01/Sergeant/pull/505)                             |
| Native barcode scanner                        | `@capacitor-mlkit/barcode-scanning` — [#504](https://github.com/Skords-01/Sergeant/pull/504)                  |
| Status bar + splash + keyboard + deep links   | `@capacitor/{status-bar,splash-screen,keyboard,app}` — [#506](https://github.com/Skords-01/Sergeant/pull/506) |
| Android native проєкт (закомічено)            | `android/` (з `cap add android`)                                                                              |

Точка входу native-side — `src/index.ts → initNativeShell()`. Вона
ідемпотентна (повторні виклики безпечні під HMR / LiveReload) і
кожен плагін огорнутий try/catch, щоб помилка в одному не заблокувала
інші.

Web-side інтеграції:

- `apps/web/src/shared/lib/platform.ts` → `isCapacitor()` — runtime-guard
  **без compile-time залежності** від `@capacitor/core`. Всі native-import-и
  у web йдуть за цим guard-ом через dynamic `import()`.
- `apps/web/src/shared/lib/bearerToken.ts` — єдина точка читання/запису
  bearer-токена з `@sergeant/mobile-shell/auth-storage`.
- `apps/web/vite.config.js#manualChunks` навмисно виключає
  `/node_modules/@capacitor/` з `vendor`, щоб Capacitor-плагіни їхали
  тільки в async-чанки, що підвантажуються динамічним імпортом. При
  додаванні нового `@capacitor/*` плагіна — оновлювати коментар, але
  сам виняток уже покриває майбутні пакети без змін.

## Швидкий старт (Android)

### Варіант А — скачати готовий APK з CI

> **TODO (окремо):** GitHub Actions workflow для автоматичної збірки
> debug-APK ще треба додати. Devin OAuth app не має `workflow` scope,
> тож файл `.github/workflows/mobile-shell-android.yml` має закомітити
> мейнтейнер вручну (або людський акаунт з репо-admin). Після цього
> кожен push у PR, що чіпає `apps/mobile-shell/**` або `apps/web/**`,
> буде білдити debug-APK і виливати як GitHub Actions artifact.

### Варіант Б — локальна збірка

Потрібен Android SDK (через Android Studio або `sdkmanager`).

```bash
# 1. Зібрати веб-бандл (йде в apps/server/dist — див. vite.config.js).
pnpm build:web

# 2. Скопіювати бандл у нативний проєкт.
pnpm --filter @sergeant/mobile-shell copy

# 3. Відкрити Android Studio для збірки APK/AAB.
pnpm --filter @sergeant/mobile-shell open:android
```

`pnpm --filter @sergeant/mobile-shell build:android` робить кроки 1+2
разом.

`android/` уже закомічено (згенеровано `cap add android`). Якщо
потрібно перегенерувати з нуля — спочатку видалити директорію, потім
`pnpm --filter @sergeant/mobile-shell add:android`.

## iOS

`ios/` **не** закомічено — потрібен Mac з Xcode + CocoaPods для
першого `pnpm --filter @sergeant/mobile-shell add:ios`. Після цього —
`build:web` → `pnpm --filter @sergeant/mobile-shell sync ios` →
`open:ios`. Release pipeline на iOS (TestFlight) ще не
налаштований — блокує відсутність macOS runner-а у CI.

## Що НЕ зроблено

- **GitHub Actions APK workflow** (див. TODO вище).
- **iOS native project** — `cap add ios` чекає на Mac.
- **Native push notifications.** `usePushNotifications` у web тримає
  Web Push через Service Worker + VAPID. На iOS у WebView воно
  працює лише з 16.4+ і тільки якщо web уже установлено як PWA на
  home-screen; на Android працює, але «крихко». Power-move —
  окремий PR з `@capacitor/push-notifications` (FCM + APNs) і
  розширенням `createPushEndpoints.register` на нові
  `platform: "android" | "ios"`.
- **Deep-link навігація у React Router.** `parseDeepLink()` у
  `src/index.ts` готовий і `App.addListener('appUrlOpen', ...)`
  викликає callback, але коннект з `useNavigate()` з
  `@sergeant/web` ще не прокинутий — `options.navigate` наразі
  падає в fallback `window.location.assign`.
- **iOS safe-area + splash race.** CSS `env(safe-area-inset-*)` з
  web-side покриває 99% кейсів, але якщо splash візьметься
  триматись довше 3с (дивись `SplashScreen.hide({ fadeOutDuration })`
  у `initNativeShell`), користувач може побачити блимання статус-бару.
  Кандидат на тюнінг у debug-білді.

## Чому окрема директорія, а не окреме репо

`apps/*` — це вже pnpm workspace, тож `@sergeant/mobile-shell`
автоматично бачить `@sergeant/shared`, `@sergeant/api-client`,
`@sergeant/mobile-shell/auth-storage` і підключений до turbo/CI без
кросрепного клею. Видалити експеримент — один коміт. Деталі та
альтернативи — у обговореннях [PR #503](https://github.com/Skords-01/Sergeant/pull/503)
(перший скафолд shell-а).
