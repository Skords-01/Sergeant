# Hub (ФІЗРУК)

Персональна платформа з модулями: **ФІНІК** (фінанси), **ФІЗРУК** (спорт), **Рутина** (календар Hub, звички, план).

## Модулі

| Модуль | Опис | Статус |
|--------|------|--------|
| ФІНІК | Особисті фінанси, Monobank | Готово |
| ФІЗРУК | Тренування, прогрес, план | У розробці |
| Рутина | Календар, звички, інтеграція плану Фізрука та підписок Фініка | Готово |

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

api/
├── mono.js                   # Monobank proxy
└── chat.js                   # Anthropic Claude proxy
```

Дорожня карта та ТЗ по модулях: [docs/hub-modules-roadmap.md](docs/hub-modules-roadmap.md).

## Запуск

```bash
npm install
npm run dev
```

## Змінні середовища (Vercel)

| Змінна | Модуль | Опис |
|--------|--------|------|
| `ANTHROPIC_API_KEY` | Shared AI | Ключ Anthropic |
| `ALLOWED_ORIGINS` | API (CORS) | Опційно: дозволені origin через кому (локально й прев’ю вже за замовчуванням) |

## Деплой

Vercel — автоматично при пуші в `main`.
