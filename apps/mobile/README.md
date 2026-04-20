# @sergeant/mobile

Нативний клієнт Sergeant (iOS/Android) на Expo + React Native. Для web-апки
див. `apps/web` — вони живуть у тому самому монорепо і ділять пакети
`@sergeant/shared` та `@sergeant/api-client`.

## Статус

**Фаза 0 (цей PR) — скафолд.** Піднятий Expo-проєкт з:

- Expo Router (tabs + (auth) модалка);
- Better Auth Expo-клієнт (bearer токен у `expo-secure-store`, див.
  `docs/mobile.md`);
- спільні пакети підключені через `metro.config.js` (monorepo-resolver);
- заглушкові екрани для 4 модулів: Фінік, Фізрук, Рутина, Харчування.

**Далі:** окремими PR-ами порт модулів з `apps/web` на нативні екрани
(View/Text/FlashList, AsyncStorage/SecureStore, expo-speech замість Web
Speech, expo-barcode-scanner замість ZXing тощо).

## Запуск

```sh
# з кореня монорепо
pnpm install

# створи .env з URL твого бекенду
cp apps/mobile/.env.example apps/mobile/.env
# за замовчуванням EXPO_PUBLIC_API_BASE_URL=http://localhost:5000
# для фізичного пристрою — заміни на IP хост-машини (напр. http://192.168.1.5:5000)

# підняти локальний API (в іншому тердміналі)
pnpm dev:server

# запустити Expo
pnpm --filter @sergeant/mobile start
# далі:
#   - натисни `i` для iOS-симулятора,
#   - `a` для Android-емулятора,
#   - скануй QR у Expo Go на телефоні.
```

> Фізичний пристрій не бачить `localhost` хост-машини — вкажи IP у
> `.env` або прокинь тунель (ngrok / `expo start --tunnel`).

## Архітектура

```
apps/mobile
├── app/                          # expo-router (file-based)
│   ├── _layout.tsx               # root Stack + провайдери
│   ├── +not-found.tsx
│   ├── (auth)/                   # модальна група: sign-in, sign-up
│   │   ├── _layout.tsx
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   └── (tabs)/                   # основна таб-навігація (auth-guard)
│       ├── _layout.tsx
│       ├── index.tsx             # Хаб
│       ├── finyk.tsx             # stub → порт apps/web/src/modules/finyk
│       ├── fizruk.tsx            # stub → порт apps/web/src/modules/fizruk
│       ├── routine.tsx           # stub → порт apps/web/src/modules/routine
│       └── nutrition.tsx         # stub → порт apps/web/src/modules/nutrition
├── src/
│   ├── api/apiUrl.ts             # /api/v1/* префіксатор (дзеркало web)
│   ├── api/apiClient.ts          # createApiClient + bearer getToken (SecureStore)
│   ├── auth/authClient.ts        # Better Auth Expo actions (signIn/signUp/signOut)
│   ├── components/ModuleStub.tsx
│   ├── features/push/            # registerPush + PushRegistrar (no-UI)
│   ├── providers/QueryProvider.tsx
│   └── theme.ts
├── app.json                      # scheme=sergeant, plugins
├── babel.config.js               # babel-preset-expo + reanimated
├── metro.config.js               # monorepo watchFolders + node_modules
└── tsconfig.json                 # extends expo/tsconfig.base + @/*  paths
```

## Deep links

Схема `sergeant://`, повний перелік маршрутів — у `docs/mobile.md`
(`sergeant://workout/{id}`, `sergeant://finance/tx/{id}`, тощо). Наразі
закомітено лише tab-роути; глибокі посилання на конкретні сутності
зроблю разом з портом відповідних модулів.

## API

Усі запити — у `/api/v1/*`, як описано в `docs/api-v1.md`. У
продакшн-коді ходи у сервер через `@sergeant/api-client`:

- `useApiClient()` + хуки з `@sergeant/api-client/react` (`useUser`,
  `usePushRegister` тощо) — для React-екранів;
- `apiClient` з `src/api/apiClient.ts` — для імперативних викликів
  (напр. `src/features/push/registerPush.ts`).

`authClient.ts` залишено лише для actions-ендпоінтів Better Auth
(`signIn.email`, `signUp.email`, `signOut`). Ідентичність
користувача читай через `useUser()` (GET `/api/v1/me`), а НЕ
`useSession()` — ці дані джерелом правди — сервер, а не локальне
SecureStore.

## Push notifications

Push-флоу на mobile закриває `PushRegistrar`
(`src/features/push/PushRegistrar.tsx`). Після логіну він:

1. запитує дозвіл через `expo-notifications`;
2. бере native APNs/FCM токен (`getDevicePushTokenAsync`) у dev-client
   / standalone-білді;
3. шле `api.push.register({ platform, token })` →
   `POST /api/v1/push/register`;
4. зберігає токен у `AsyncStorage` під ключем
   `push:lastToken:<userId>`, щоб не шарашити сервер повторно, і
   водночас гарантовано перереєструвати пристрій на іншого юзера
   (native push-токени пер-девайс, а не пер-акаунт).

> **Expo Go не підтримує native APNs/FCM.** У Go ми падаємо на
> `getExpoPushTokenAsync()` тільки для dev-дебагу — продакшн-пуші
> через APNs/FCM потребують dev-client (`eas build --profile
development`) або standalone збірку.

Тестування з dev-build:

```sh
pnpm --filter @sergeant/mobile start --dev-client
# на фізичному пристрої або симуляторі залогінься
# перевір у Network logs POST /api/v1/push/register один раз
# повторний запуск з тим самим токеном не шле запит
```

Серверний контракт і приклади payload-ів — у `docs/mobile.md`
(секція «Push notifications»).

## Монорепо-правила

- Нативні залежності (expo, react-native, expo-_) живуть **тільки** тут,
  не в корені й не в інших пакетах — інакше Metro знайде два React-и.
  Див. `.agents/skills/vercel-react-native-skills/rules/monorepo-_.md`.
- Версії спільних пакетів (react, zod, @tanstack/react-query) мусять
  збігатися з `apps/web` — pnpm-workspace не ізолює їх автоматично на
  runtime.
- `@sergeant/shared` і `@sergeant/api-client` — DOM-free і працюють у
  Node/web/RN без змін. Якщо у майбутньому доведеться додати
  browser-only код (напр. `window.fetch`-специфічний), винеси його в
  окремий пакет або за exports-гейтом.
