# `@sergeant/mobile-shell` — Capacitor PoC

Тонкий native-shell навколо `@sergeant/web`. Призначення — **PoC-перевірка**:
чи запускається поточний веб-код у WebView і скільки зусиль треба до шторів.
Це **не канонічний мобільний клієнт** — повноцінна мобільна апка живе в
`apps/mobile` (React Native + Expo).

## Швидкий старт (Android)

### Варіант А — скачати готовий APK з CI (без Android SDK локально)

> **TODO (окремо)**: GitHub Actions workflow для автоматичної збірки APK
> готовий, але його треба додати вручну — Devin OAuth app не має
> `workflow` scope, тож файл `.github/workflows/mobile-shell-android.yml`
> має закомітити мейнтейнер. Текст воркфлоу прикріплений у PR-описі.
> Після додавання кожен push у PR, що чіпає `apps/mobile-shell/**` або
> `apps/web/**`, буде білдити debug-APK і виливати як GitHub Actions
> artifact.

### Варіант Б — локальна збірка

Потрібен Android SDK (через Android Studio або `sdkmanager`).

```bash
# 1. Зібрати веб-бандл (йде в apps/server/dist — див. vite.config.js)
pnpm build:web

# 2. Скопіювати бандл у нативний проєкт
pnpm --filter @sergeant/mobile-shell copy

# 3. Відкрити Android Studio для збірки APK/AAB
pnpm --filter @sergeant/mobile-shell open:android
```

`pnpm --filter @sergeant/mobile-shell build:android` робить кроки 1+2 разом.

`android/` вже закомічено (згенеровано `cap add android`). Якщо знадобиться
перегенерувати з нуля — спочатку видалити директорію, потім
`pnpm --filter @sergeant/mobile-shell add:android`.

## iOS

Потрібен Mac з Xcode + CocoaPods. Після першого `pnpm --filter
@sergeant/mobile-shell add:ios` далі так само: `build:web` → `sync ios` →
`open:ios`.

## Що (навмисно) НЕ зроблено у PoC

- **Push notifications.** `usePushNotifications` у веб-коді використовує
  Web Push через Service Worker (`PushManager` + VAPID). У native WebView
  воно не працює на iOS і кульгаво працює на Android. Треба окремий PR з
  `@capacitor/push-notifications` (FCM + APNs) + розширенням
  `createPushEndpoints.register` на `platform: "android" | "ios"`.
- **Auth.** Better Auth зараз через cookie. У native WebView cross-origin
  cookie крихкі (особливо iOS ITP). Треба окремий PR з bearer-plugin
  Better Auth + збереженням токена в `@capacitor/preferences` / Keychain.
- **Barcode scanner.** `BarcodeScanner.tsx` на `getUserMedia`+zxing.
  Працює у WebView, але UX гірший. Окремим PR — feature-detect і
  переключення на `@capacitor-community/barcode-scanner`.
- **Deep links, status bar, splash, safe-area, keyboard avoidance.**
  Кожне — тонкий плагін `@capacitor/*`, робимо коли підуть реальні фічі.

## Чому окрема директорія, а не окреме репо

`apps/*` вже є workspace, `@sergeant/mobile-shell` автоматично бачить
`@sergeant/shared`, `@sergeant/api-client` і підʼєднується до turbo/CI
без кросрепного клею. Видалити експеримент — 1 коміт. Деталі та
альтернативи — у коментарях PR.
