# План рефакторингу структури проекту

> Дата: 2026-04-25
>
> Поточний стан: проект організовано на ~8/10. Монорепо, domain-пакети,
> модульна архітектура — все на високому рівні. Нижче — конкретні кроки
> для покращення, згруповані за пріоритетом.

---

## Пріоритет 1 — Чистка (швидкі зміни, великий ефект)

### 1.1 Видалити Replit-артефакти з кореня

Файли `main.py`, `pyproject.toml` та `replit.md` — автогенерований Replit
boilerplate, який не використовується проектом.

**Дії:**

- Видалити `main.py`
- Видалити `pyproject.toml`
- Видалити `replit.md`
- `.replit` та `.npmrc` залишити, якщо деплой через Replit актуальний

### 1.2 Прибрати бінарні файли з git (`attached_assets/`)

36 скриншотів (`.heic`, `.png`, `.jpg`) трекаються у git і роздмухують
розмір репозиторію (~28 MB clone).

**Дії:**

- Перенести скриншоти у зовнішнє сховище (Notion, Figma, Google Drive)
- Додати `attached_assets/` до `.gitignore`
- Опціонально — почистити історію через `git filter-repo` або BFG Repo-Cleaner

### 1.3 Видалити або ізолювати `artifacts/mockup-sandbox/`

72-файловий прототипний Vite-проект зі своїм `package.json`, який не є
частиною монорепо-воркспейсу.

**Дії:**

- Видалити папку `artifacts/` повністю, або
- Перенести в окремий репозиторій, якщо пісочниця ще потрібна
- Як мінімум — додати `artifacts/` до `.gitignore`

### 1.4 Перенести `MOBILE.md` у `docs/`

Великий документ (17K символів) про мобільний додаток лежить у корені.
У `docs/` вже є `mobile.md`.

**Дії:**

- Об'єднати `MOBILE.md` з `docs/mobile.md` або замінити
- Видалити `MOBILE.md` з кореня

---

## Пріоритет 2 — Реорганізація `core/` (web)

### 2.1 Розгрупувати 39 файлів з кореня `apps/web/src/core/`

Зараз у корені `core/` змішані авторизація, хаб-фічі, дайджест, аналітика,
синхронізація. Підпапки вже існують (`app/`, `settings/`, `cloudSync/`,
`onboarding/`, `stories/`, `profile/`), але більшість файлів — нерозсортовані.

**Дії — створити підпапки:**

```
core/
├── auth/                    # Перенести сюди:
│   ├── AuthContext.tsx
│   ├── AuthContext.test.tsx
│   ├── AuthPage.tsx
│   ├── authClient.ts
│   └── ResetPasswordPage.tsx
│
├── hub/                     # Перенести сюди:
│   ├── HubDashboard.tsx
│   ├── HubChat.tsx
│   ├── HubSearch.tsx
│   ├── hubSearchEngine.ts
│   ├── HubReports.tsx
│   ├── HubBackupPanel.tsx
│   ├── hubBackup.ts
│   ├── hubBackup.test.ts
│   ├── HubInsightsPanel.tsx
│   └── HubSettingsPage.tsx
│
├── insights/                # Перенести сюди:
│   ├── useCoachInsight.ts
│   ├── AssistantAdviceCard.tsx
│   ├── TodayFocusCard.tsx
│   ├── WeeklyDigestCard.tsx
│   ├── WeeklyDigestCard.collapse.test.tsx
│   ├── WeeklyDigestStories.tsx
│   ├── useWeeklyDigest.ts
│   └── hasLiveWeeklyDigest.test.ts
│
├── sync/                    # Перенести сюди (доповнити cloudSync/):
│   ├── useCloudSync.ts
│   ├── useCloudSync.behavior.test.ts
│   ├── useCloudSync.hardening.test.ts
│   └── cloudSyncHelpers.test.ts
│
├── observability/           # Перенести сюди:
│   ├── analytics.ts
│   ├── sentry.ts
│   ├── sentry.test.ts
│   ├── webVitals.ts
│   └── webVitals.test.ts
│
├── app/                     # Вже існує — залишити як є
├── cloudSync/               # Вже існує — об'єднати з sync/ або залишити
├── components/              # Вже існує
├── hooks/                   # Вже існує
├── lib/                     # Вже існує
├── onboarding/              # Вже існує
├── profile/                 # Вже існує
├── settings/                # Вже існує
├── stories/                 # Вже існує
├── hints/                   # Вже існує
│
├── App.tsx                  # Залишити в корені (entry point)
├── DesignShowcase.tsx       # Залишити або перенести в app/
├── ErrorBoundary.tsx        # Залишити в корені (глобальний)
└── ModuleErrorBoundary.tsx  # Залишити в корені (глобальний)
```

**Після переносу:** оновити імпорти по всьому `apps/web/src/`. Path aliases
(`@shared/*`) не зачіпаються, бо `core/` не має аліасу — імпорти відносні.

---

## Пріоритет 3 — Серверні покращення

### 3.1 Перенести `aiQuota.ts` у `modules/`

`apps/server/src/aiQuota.ts` — це доменна логіка (квоти AI-викликів),
але лежить у корені `src/` поруч з інфраструктурними файлами
(`app.ts`, `db.ts`, `config.ts`, `sentry.ts`).

**Дії:**

- Перенести `aiQuota.ts` та `aiQuota.test.ts` у `apps/server/src/modules/`
- Оновити імпорти у `routes/` та `http/requireAiQuota.ts`

### 3.2 Перенести `middleware.ts` до `apps/web/`

Vercel Edge Middleware для проксі `/api/*` лежить у корені монорепо, хоча
обслуговує виключно фронтенд-деплой.

**Дії:**

- Перенести `middleware.ts` → `apps/web/middleware.ts`
- Перевірити/оновити `vercel.json`, щоб Vercel знаходив middleware

---

## Пріоритет 4 — Консистентність і якість коду

### 4.1 Уніфікувати workspace-залежності

`@sergeant/finyk-domain` підключається як `workspace:^` у mobile, але
`workspace:*` у web.

**Дії:**

- Замінити всі `workspace:^` на `workspace:*` (або навпаки, але єдино)
- Перевірити інші пакети на аналогічні розбіжності

### 4.2 Мігрувати .js → .ts у web

3 файли `.js` серед 217 `.ts`:

- `src/sw.js` — service worker
- `src/test/setup.js` — test setup
- `src/modules/finyk/constants/chartPalette.js` — константи

**Дії:**

- Перейменувати на `.ts` і додати мінімальну типізацію
- Довгостроково — увімкнути `strict: true` у `tsconfig.json`

### 4.3 Перенести `eslint-plugins/` у `packages/`

`eslint-plugins/sergeant-design/` — повноцінний пакет зі своїм
`package.json`. Логічно мав би жити як workspace-пакет.

**Дії:**

- Перенести в `packages/eslint-plugin-sergeant/`
- Додати у `pnpm-workspace.yaml` (вже покритий `packages/*`)
- Оновити `eslint.config.js` для нового шляху

### 4.4 Перенести `skills-lock.json` у `.agents/`

Файл відноситься до `.agents/skills/`, а не до проекту в цілому.

---

## Пріоритет 5 — Довгострокові покращення

### 5.1 Почистити нерелевантні `.agents/skills/`

20 скілів, з яких ~10 не мають відношення до стеку проекту
(Next.js, Remotion, SEO, copywriting, PPTX, PDF).

**Залишити:** `better-auth-best-practices`, `brainstorming`,
`frontend-design`, `vercel-react-best-practices`,
`vercel-composition-patterns`, `supabase-postgres-best-practices`,
`ui-ux-pro-max`, `vercel-react-native-skills`, `browser-use`,
`find-skills`, `skill-creator`.

**Видалити:** `next-best-practices`, `remotion-best-practices`,
`seo-audit`, `copywriting`, `pptx`, `pdf`, `agent-tools`,
`audit-website`, `web-design-guidelines`.

### 5.2 Розбити великі компоненти (800+ рядків)

| Файл                                   | Рядків | Що винести                                |
| -------------------------------------- | ------ | ----------------------------------------- |
| `finyk/pages/Assets.tsx`               | 1207   | Секції (AssetCard, AssetForm, AssetChart) |
| `core/HubDashboard.tsx`                | 957    | Модульні карточки, layout                 |
| `fizruk/.../ActiveWorkoutPanel.tsx`    | 949    | Timer, SetLogger, ExerciseList            |
| `finyk/FinykApp.tsx`                   | 864    | Nav, routing logic                        |
| `finyk/pages/Transactions.tsx`         | 827    | Filters, TxList, TxDetails                |
| `routine/.../RoutineCalendarPanel.tsx` | 824    | Calendar grid, event list                 |

### 5.3 Додати barrel exports (index.ts) для модулів

Зараз лише 5 barrel-файлів у web. Модулі не мають `index.ts`, тому
імпорти вказують на внутрішні шляхи файлів.

**Дії:**

- Додати `index.ts` у `shared/hooks/`, `shared/lib/`, кожен модуль
- Це спростить імпорти та дасть єдину точку входу

---

## Порядок виконання

| Етап | Задачі                    | Оцінка часу |
| ---- | ------------------------- | ----------- |
| 1    | Чистка (1.1–1.4)          | 30 хв       |
| 2    | Реорганізація core/ (2.1) | 2–3 год     |
| 3    | Серверні зміни (3.1–3.2)  | 30 хв       |
| 4    | Консистентність (4.1–4.4) | 1 год       |
| 5    | Довгострокове (5.1–5.3)   | поступово   |
