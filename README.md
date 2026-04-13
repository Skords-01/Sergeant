# ФІЗРУК

Персональна платформа з модулями. Зараз: **ФІНІК** (фінанси) + **ФІЗРУК** (спорт).

## Модулі

| Модуль | Опис | Статус |
|--------|------|--------|
| ФІНІК | Особисті фінанси, Monobank | ✅ Готово |
| ФІЗРУК | Тренування, прогрес, план | 🚧 В розробці |

## Структура

```
src/
├── core/App.jsx              # Головний екран вибору модуля
├── modules/
│   ├── finyk/                # Фінансовий модуль
│   └── fizruk/               # Спортивний модуль
├── shared/
│   ├── components/ui/        # Button, Card, Input, Skeleton
│   └── lib/cn.js
└── main.jsx

api/
├── mono.js                   # Monobank proxy
└── chat.js                   # Anthropic Claude proxy
```

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
