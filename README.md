# Hub 

Персональна платформа з модулями: **ФІНІК** (фінанси), **ФІЗРУК** (спорт), **Рутина** (календар Hub, звички, план).

## Модулі

| Модуль | Опис                                                          | Статус     |
| ------ | ------------------------------------------------------------- | ---------- |
| ФІНІК  | Особисті фінанси, Monobank                                    | Готово     |
| ФІЗРУК | Тренування, прогрес, план                                     | У розробці |
| Рутина | Календар, звички, інтеграція плану Фізрука та підписок Фініка | Готово     |

## Структура

```
src/
├── core/App.jsx              # Хаб: вибір модуля
├── modules/
│   ├── finyk/                # Фінанси
│   ├── fizruk/               # Спорт
│   └── routine/              # Рутина та Hub-календар
├── shared/
│   ├── components/ui/        # Button, Card, Input, Skeleton
│   └── lib/cn.js
└── main.jsx

server/
├── railway.mjs               # Express-агрегатор API (Railway / npm start)
└── api/                      # хендлери /api/* (не в корені — щоб Vercel Hobby не рахував functions)
    ├── mono.js
    ├── chat.js
    └── nutrition/
```

Дорожня карта та ТЗ по модулях: [docs/hub-modules-roadmap.md](docs/hub-modules-roadmap.md).

## Запуск

```bash
npm install
npm run dev
```

## Змінні середовища (Vercel)

| Змінна              | Модуль     | Опис                                                                          |
| ------------------- | ---------- | ----------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Shared AI  | Ключ Anthropic                                                                |
| `NUTRITION_API_TOKEN` | Харчування API | Опційно: простий токен-гейт для `/api/nutrition/*` (перевіряється по `X-Token`) |
| `ALLOWED_ORIGINS`   | API (CORS) | Опційно: дозволені origin через кому (локально й прев’ю вже за замовчуванням) |
| `VITE_API_BASE_URL` | Фронт (Vite) | Опційно: якщо API винесено на Railway — базовий URL **без** завершального `/`, напр. `https://xxx.up.railway.app` |

> Важливо: токени типу `VITE_*` / `EXPO_PUBLIC_*` **не є секретами** (потрапляють у клієнт). Використовуй їх лише як “легкий гейт” для приватного деплою, а не як повноцінну безпеку.

## API на Railway (ліміт Vercel Hobby: ≤12 functions)

Якщо Vercel відмовляє в деплої через кількість serverless-функцій, можна винести **весь** Hub API в один контейнер:

1. У Railway: новий сервіс з цього репозиторію, білд через [`Dockerfile.api`](Dockerfile.api) (див. [`railway.toml`](railway.toml)).
2. У змінних сервісу Railway задати ті самі секрети, що й для Vercel API: `ANTHROPIC_API_KEY`, опційно `NUTRITION_API_TOKEN`, `ALLOWED_ORIGINS` (додай origin свого Vercel-домену).
3. У **Vercel** (Environment Variables для Production/Preview): `VITE_API_BASE_URL` = публічний URL Railway (HTTPS).
4. Каталог API перенесено в [`server/api/`](server/api/) — **у корені репо немає `api/`**, тож Vercel Hobby не створює десятки serverless-функцій. Запити з фронта йдуть на Railway, якщо задано `VITE_API_BASE_URL`.

Локально API: `npm start` (слухає `PORT`, за замовчуванням 3000). Фронт `npm run dev`: без `VITE_API_BASE_URL` запити йдуть на `/api/*` і **проксуються** на `VITE_API_PROXY_TARGET` (типово `http://127.0.0.1:3000`), див. `vite.config.js`.

## Деплой

Vercel — автоматично при пуші в `main`. У [`vercel.json`](vercel.json): rewrite на `index.html` для SPA, **без** перехоплення `/api/*` (щоб не підміняти відповіді на HTML). API — на **Railway** (`Dockerfile.api`). Дані модулів у **localStorage**; окрема БД лише для синхронізації/акаунтів.
