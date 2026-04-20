# Mobile client — API contract

Референс для Expo/React Native клієнта Sergeant. Сервер уже підготовлений
(ця сесія: API v1, bearer-auth, push/register). Сам мобільний код —
наступна сесія.

## Auth

- Базовий URL: той самий, що й для web. Мобілка шле всі запити у `/api/v1/*`.
- Сесія: `Authorization: Bearer <token>`, де `<token>` отримується з
  відповіді `POST /api/auth/sign-in/email` (Better Auth віддає токен у
  `set-auth-token` header, клієнт `@better-auth/expo/client` збирає його
  в `expo-secure-store` автоматично).
- Cookie на мобілці НЕ використовуються — Better Auth bearer-плагін
  конвертує токен у in-memory "сесію" на сервері, тому усі хендлери, що
  історично покладаються на `getSessionUser`, працюють прозоро.
- Sign-out: `POST /api/auth/sign-out` з тим самим `Authorization` header;
  сервер інвалідує сесію, клієнт видаляє токен зі SecureStore.

## Deep links

Мобільний клієнт мусить підтримати наступні URL-схеми:

| Scheme                             | Куди веде                                        |
| ---------------------------------- | ------------------------------------------------ |
| `sergeant://`                      | Головний хаб (equivalent to tab root)            |
| `sergeant://workout/{id}`          | Екран конкретного тренування (fizruk)            |
| `sergeant://workout/new`           | Створення тренування                             |
| `sergeant://food/log`              | Щоденник їжі (nutrition, поточний день)          |
| `sergeant://food/scan`             | Barcode-сканер для nutrition                     |
| `sergeant://food/recipe/{id}`      | Детальна карточка рецепта                        |
| `sergeant://finance`               | Finyk — дашборд фінансів                         |
| `sergeant://finance/tx/{id}`       | Конкретна транзакція                             |
| `sergeant://routine`               | Routine — список звичок                          |
| `sergeant://routine/habit/{id}`    | Конкретна звичка                                 |
| `sergeant://settings`              | Налаштування (профіль, push, sync)               |
| `sergeant://auth/callback?token=…` | OAuth/password-reset callback (Better Auth Expo) |

Expo `scheme: "sergeant"` у `app.json`. Dev-клієнт додатково обробляє
`exp://` (Expo Go) і `http://localhost:8081` (Metro web) — обидва вже
в `trustedOrigins` сервера, щоб Better Auth не різав 403.

## Push notifications

### Register (клієнт → сервер)

```
POST /api/v1/push/register
Authorization: Bearer <token>
Content-Type: application/json

// Web (PWA, service worker):
{ "platform": "web",
  "token": "https://fcm.googleapis.com/wp/xxx",
  "keys": { "p256dh": "...", "auth": "..." } }

// iOS (APNs device token):
{ "platform": "ios", "token": "64-hex-chars" }

// Android (FCM registration token):
{ "platform": "android", "token": "FCM-token-up-to-4KB" }
```

Відповідь: `200 { ok: true, platform }`. Upsert ідемпотентний — повторна
реєстрація того самого токена просто оновлює `updated_at` (див.
`server/migrations/006_push_devices.sql`).

### Сервер → пристрій

- **Web** — існуючий flow `POST /api/push/send` через `web-push` + VAPID.
  Працює однаково для PWA та mobile Expo web-build.
- **iOS / Android** — **не реалізовано у цій сесії**. Токени лише
  зберігаються у `push_devices`. Реальна відправка (APNs через
  `apn`/`node-apn`, FCM через HTTP v1) — окрема сесія.

## Rate limiting

Усі мобільні запити мають `Authorization: Bearer`, тому:

- `server/aiQuota.ts` — ключ `u:{userId}` (не IP). Переключення з Wi-Fi на
  мобільну мережу НЕ скидує квоту.
- `server/http/rateLimit.ts` — теж `u:{userId}` за умови, що
  `requireSession()` відпрацював до rate-limit-middleware. Для публічних
  роутів (напр., `/api/push/vapid-public` — воно і так поза лімітером)
  ключ лишається `ip:{...}`.

## CORS

Production сервер читає `ALLOWED_ORIGINS` (comma-separated) і
`ALLOWED_ORIGIN_REGEX` з env. Hardcoded defaults:

- `http://localhost:5173/4173/5000/8081` — dev
- `https://sergeant.vercel.app`, `https://sergeant.2dmanager.com.ua` — prod

Нативні клієнти (Expo native build) Origin не шлють, тому CORS на них не
спрацьовує — але Expo web (`http://localhost:8081`) вже в allow-list.

## Що мобільний клієнт НЕ мусить робити

- Самому переписувати `/api/...` → `/api/v1/...`. Просто хардкодити v1 одразу.
- Відправляти `X-Api-Secret` — це внутрішній cron-header для
  `/api/push/send`, мобілка його ніколи не бачить.
- Дублювати push-реєстрацію — endpoint upsert-ом сам розбереться.
