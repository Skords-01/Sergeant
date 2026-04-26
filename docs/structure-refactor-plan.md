# План рефакторингу структури проекту

> Дата: 2026-04-25. Останнє оновлення статусу: 2026-04-26.
>
> Поточний стан: проект організовано на ~8/10. Монорепо, domain-пакети,
> модульна архітектура — все на високому рівні. Нижче — конкретні кроки
> для покращення, згруповані за пріоритетом.
>
> **Status (2026-04-26):** Пріоритет 1 (1.1–1.4) і Пріоритет 2 (2.1)
> повністю виконані; Пріоритет 3 (3.1–3.2) виконаний; з Пріоритету 4
> виконано 4.2, 4.3, 4.4; залишається 4.1 (workspace-deps уніфікація)
> та Пріоритет 5 (довгостроковий список великих файлів і barrel
> exports). Деталі — у відповідних секціях нижче (✅ означає `git`-стан
> підтверджує виконання).

---

## Пріоритет 1 — Чистка (швидкі зміни, великий ефект)

### 1.1 Видалити Replit-артефакти з кореня ✅ done

Файли `main.py`, `pyproject.toml` та `replit.md` — автогенерований Replit
boilerplate, який не використовується проектом.

**Статус (2026-04-26):** Виконано — `main.py`, `pyproject.toml`,
`replit.md` видалені з кореня репо. `.replit` залишений (досі
потрібний як deploy-runtime для Replit-сценарію — `pnpm start:replit`).

### 1.2 Прибрати бінарні файли з git (`attached_assets/`) ✅ done

36 скриншотів (`.heic`, `.png`, `.jpg`) трекаються у git і роздмухують
розмір репозиторію (~28 MB clone).

**Статус (2026-04-26):** Папка `attached_assets/` видалена з робочого
дерева. Очистка історії git (`git filter-repo` / BFG) — окрема
opt-in задача мейнтейнера, бо переписує SHA-и.

### 1.3 Видалити або ізолювати `artifacts/mockup-sandbox/` ✅ done

72-файловий прототипний Vite-проект зі своїм `package.json`, який не є
частиною монорепо-воркспейсу.

**Статус (2026-04-26):** Папка `artifacts/` повністю видалена з
репо.

### 1.4 Перенести `MOBILE.md` у `docs/` ✅ done

Великий документ (17K символів) про мобільний додаток лежить у корені.
У `docs/` вже є `mobile.md`.

**Статус (2026-04-26):** `MOBILE.md` видалено з кореня; актуальний
документ — `docs/mobile.md`.

---

## Пріоритет 2 — Реорганізація `core/` (web) ✅ done

### 2.1 Розгрупувати 39 файлів з кореня `apps/web/src/core/` ✅ done

**Статус (2026-04-26):** Виконано. Підпапки `auth/`, `hub/`,
`insights/`, `observability/` створено і файли перенесені; «sync/»
не виокремлювали як окрему папку — cloud-sync залишився у
`core/cloudSync/` (логіка очікувано там і не потребує другого
префіксу). Поточне дерево `apps/web/src/core/` (на момент
оновлення): `App.tsx`, `AssistantCataloguePage.tsx`,
`DesignShowcase.tsx`, `ErrorBoundary.tsx`, `ModuleErrorBoundary.tsx`,
`app/`, `auth/`, `cloudSync/`, `components/`, `hints/`, `hooks/`,
`hub/`, `insights/`, `lib/`, `observability/`, `onboarding/`,
`profile/`, `settings/`, `stories/`.

_Опис нижче залишений як історичний референс — конкретний
файловий розклад збігся з фактичним результатом, плюс міграція
`cloudSync/` лишилася як standalone-папка._

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

## Пріоритет 3 — Серверні покращення ✅ done

### 3.1 Перенести `aiQuota.ts` у `modules/` ✅ done

**Статус (2026-04-26):** Виконано — `aiQuota.ts` живе у
`apps/server/src/modules/aiQuota.ts`, тести поряд. `routes/` та
`http/requireAiQuota.ts` імпортують з `modules/aiQuota.js`.

### 3.2 Перенести `middleware.ts` до `apps/web/` ✅ done

**Статус (2026-04-26):** Виконано — Vercel Edge Middleware живе у
`apps/web/middleware.ts`; кореня монорепо більше не торкається.

---

## Пріоритет 4 — Консистентність і якість коду

### 4.1 Уніфікувати workspace-залежності

`@sergeant/finyk-domain` підключається як `workspace:^` у mobile, але
`workspace:*` у web.

**Дії:**

- Замінити всі `workspace:^` на `workspace:*` (або навпаки, але єдино)
- Перевірити інші пакети на аналогічні розбіжності

### 4.2 Мігрувати .js → .ts у web 🟡 частково

**Статус (2026-04-26):**

- `chartPalette` ✅ переведено на `.ts`
  (`apps/web/src/modules/finyk/constants/chartPalette.ts`).
- `setup.js` — більше не існує у `apps/web/src/`.
- Залишаються лише `apps/web/src/sw.js` (service worker;
  використовує Workbox API без білд-кроку) і `apps/web/src/main.jsx`
  (Vite entry). Strict TS — окремий пункт у `dev-stack-roadmap.md` §3.1.

### 4.3 Перенести `eslint-plugins/` у `packages/` ✅ done

**Статус (2026-04-26):** Custom ESLint-плагін живе як
workspace-пакет `packages/eslint-plugin-sergeant-design/` (з власним
`package.json`, `index.js`, `__tests__/`). `eslint.config.js` в корені
вже підвантажує його як `sergeant-design`.

### 4.4 Перенести `skills-lock.json` у `.agents/` ✅ done

**Статус (2026-04-26):** Файл лежить у `.agents/skills-lock.json`.

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
