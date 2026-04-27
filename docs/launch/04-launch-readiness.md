# 04. Launch readiness: legal, ops, edge cases, метрики, чеклист

> Pre-MVP draft. Покриває все, що треба перевірити перед запуском платного продукту.
> Джерело: `sergeant-launch-checklist.md` (§1, §2, §5, §6, §10),
> `sergeant-monetization-plan.md` (ч.3–6).

---

## 1. Юридичне та compliance

### 1.1 Обов'язкові документи

| Документ                                       | Навіщо                                                                | Пріоритет         | Template provider                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------- |
| **Privacy Policy (Політика конфіденційності)** | Google Play, Stripe, GDPR, Apple — всі вимагають. Health + financial. | 🔴 Блокер запуску | [Termly](https://termly.io/products/privacy-policy-generator/)       |
| **Terms of Service**                           | Юридичний захист для платних підписок. Refund policy.                 | 🔴 Блокер запуску | [Termly](https://termly.io/products/terms-and-conditions-generator/) |
| **Cookie Policy**                              | Better Auth використовує cookies. Для EU — обов'язково.               | 🟡 До запуску     | [Iubenda](https://www.iubenda.com/en/cookie-solution)                |
| **Публічна оферта**                            | Для UA-ринку. ФОП може оформити сам.                                  | 🟡 До запуску     | Юрист / шаблон від [Дія.Бізнес](https://business.diia.gov.ua/)       |

**Мінімальний чеклист для Privacy Policy (health + financial app, UA + EU):**

- [ ] Перелік категорій даних: PII, фінансові, здоров'я, поведінкові, AI-контекст.
- [ ] Правова підстава обробки (GDPR Art. 6): consent для health-даних,
      legitimate interest для аналітики.
- [ ] Спеціальні категорії даних (GDPR Art. 9): health data потребує
      explicit consent.
- [ ] Треті сторони та sub-processors: Stripe, Anthropic, Sentry, PostHog,
      Resend, Monobank, Railway, Vercel, Firebase/APNs.
- [ ] Права суб'єкта даних: access, rectification, erasure, portability,
      restriction, objection (Art. 15–22).
- [ ] Міжнародні трансфери: дані передаються до US-серверів (Anthropic,
      Stripe, Sentry) — потрібен механізм (SCCs або адекватність).
- [ ] Data retention periods: скільки зберігаються дані після видалення акаунту.
- [ ] Контактні дані DPO або відповідальної особи.
- [ ] Cookie disclosure: перелік cookies, їх призначення, тривалість.
- [ ] Вік користувачів: заборона для осіб < 16 років (GDPR) або < 18
      (UA закон «Про захист персональних даних»).
- [ ] Процедура повідомлення про breach (72 години, GDPR Art. 33).
- [ ] Посилання на Cookie Policy та Terms of Service.

### 1.2 Data classification

Sergeant збирає **чутливі дані**. Класифікація по полях:

| Поле / група даних          | Категорія            | Де зберігається                 | Коли видаляється                          |
| --------------------------- | -------------------- | ------------------------------- | ----------------------------------------- |
| email, name, image          | PII                  | PostgreSQL `user`               | При `DELETE /api/me` (Better Auth)        |
| password hash               | PII (credential)     | PostgreSQL `user`               | При видаленні акаунту                     |
| session tokens              | PII (credential)     | PostgreSQL `session`            | TTL / при видаленні акаунту               |
| транзакції, баланси         | Financial            | PostgreSQL `module_data` (sync) | При видаленні акаунту + 30 днів retention |
| бюджети / ліміти            | Financial            | localStorage / MMKV (local)     | При видаленні акаунту (sync cleanup)      |
| Monobank token              | Financial credential | PostgreSQL `mono_integrations`  | При відключенні Mono / видаленні акаунту  |
| вага, тренування, tonnage   | Health               | localStorage / MMKV → sync      | При видаленні акаунту + 30 днів retention |
| калорії, їжа, meal log      | Health               | localStorage / MMKV → sync      | При видаленні акаунту + 30 днів retention |
| звички, streak, heatmap     | Behavioral           | localStorage / MMKV → sync      | При видаленні акаунту + 30 днів retention |
| AI Memory Bank (user facts) | AI-context (PII)     | PostgreSQL (chat context)       | `DELETE /api/me` + Anthropic cache purge  |
| push subscription endpoint  | PII (device)         | PostgreSQL `push_subscriptions` | При видаленні акаунту                     |
| analytics events            | Behavioral           | PostHog (зовнішній)             | PostHog retention policy (90 днів)        |
| error reports               | PII (leaked in logs) | Sentry (зовнішній)              | Sentry retention policy (30 днів)         |

**Що зробити:**

- [ ] Класифікувати всі поля даних по категоріях (PII, financial, health) —
      таблиця вище є стартом, звірити з реальними міграціями `001`–`008`.
- [ ] Переконатися що sensitive data НЕ потрапляє в analytics
      (`analytics.ts` вже має коментар про це).
- [ ] Переконатися що Sentry не логує sensitive payload (вже є
      `delete event.request.cookies` — розширити на body/headers).
- [ ] AI Memory Bank — додати опцію «Видалити всі мої дані з AI пам'яті».

### 1.3 Юридична форма

| Опція                                | Для чого               | Плюси                                            | Мінуси                                           |
| ------------------------------------ | ---------------------- | ------------------------------------------------ | ------------------------------------------------ |
| **ФОП (3 група)**                    | UA-ринок, до ₴7.8M/рік | Простий, 5 % податок                             | Не підходить для Stripe (треба валютний рахунок) |
| **ФОП (3 група) + валютний рахунок** | UA + intl              | Stripe працює                                    | Потрібна валютна ліцензія                        |
| **Paddle як MoR**                    | Міжнародний ринок      | Paddle = Merchant of Record, сам платить податки | 5 % + 50¢ комісія                                |
| **ТОВ (LLC)**                        | Масштаб, інвестори     | Серйозніше для B2B, інвесторів                   | Складніше адміністрування                        |

> **Рекомендація для старту:** ФОП 3 група + Stripe (або Paddle, якщо не
> хочеш морочитись з податками в різних юрисдикціях).

**Реєстрація ФОП — посилання та оцінки:**

| Крок                                   | Де                                                                                    | Час            | Вартість    |
| -------------------------------------- | ------------------------------------------------------------------------------------- | -------------- | ----------- |
| Реєстрація ФОП                         | [Дія](https://diia.gov.ua/) або [ДПС кабінет](https://cabinet.tax.gov.ua/)            | 1–3 робочі дні | Безкоштовно |
| Вибір групи оподаткування (3 група)    | [ДПС кабінет](https://cabinet.tax.gov.ua/) → заява про застосування спрощеної системи | 1 день         | Безкоштовно |
| Відкриття банківського рахунку (UAH)   | Monobank / Приватбанк                                                                 | 1 день         | Безкоштовно |
| Відкриття валютного рахунку (USD/EUR)  | Приватбанк / ПУМБ / Укрсиббанк                                                        | 3–5 днів       | Безкоштовно |
| Реєстрація платника ЄСВ                | Автоматично при реєстрації ФОП                                                        | —              | ~₴1,760/міс |
| Підключення РРО / ПРРО (якщо потрібен) | [Дія](https://diia.gov.ua/) або [checkbox.ua](https://checkbox.ua/)                   | 1 день         | Від ₴0–300  |
| **Загалом**                            |                                                                                       | **5–10 днів**  | **~₴2,000** |

> ЄСВ (єдиний соціальний внесок) — мінімум 22 % від мінімальної зарплати.
> Станом на 2026 рік ~₴1,760/міс. 5 % єдиний податок — від обороту.

### 1.4 GDPR / Data rights

Better Auth вже має `deleteUser: enabled: true`
(`apps/server/src/auth.ts:65`). Для повного GDPR потрібно більше:

- [ ] **Right to access (Art. 15)** — `GET /api/me/export` → JSON/ZIP
      з усіма даними юзера.
- [ ] **Right to erasure (Art. 17)** — `DELETE /api/me` → cascade delete
      з БД + cleanup у зовнішніх сервісах.
- [ ] **Right to portability (Art. 20)** — `GET /api/me/export` повертає
      машиночитний JSON.
- [ ] **Consent management** — `GET /api/me/preferences` → поточні
      consent-и; `PATCH /api/me/preferences` → оновлення.
- [ ] **Data retention policy** — скільки зберігаються дані після видалення
      акаунту? Рекомендація: 30 днів (grace для undo), потім hard delete.

**API endpoints що треба реалізувати:**

```
GET  /api/me/export
  Auth: requireSession()
  Response: 200 → application/json або application/zip
  Логіка:
    1. SELECT * FROM user WHERE id = :userId
    2. SELECT * FROM module_data WHERE user_id = :userId
    3. SELECT * FROM mono_integrations WHERE user_id = :userId
    4. SELECT * FROM push_subscriptions WHERE user_id = :userId
    5. SELECT * FROM ai_usage_daily WHERE user_id = :userId
    6. Зібрати в JSON, опціонально ZIP
  Handler: apps/server/src/routes/me.ts → додати export handler
  Файл: apps/server/src/modules/gdpr/export.ts (новий)

DELETE /api/me
  Auth: requireSession()
  Response: 204 No Content
  Логіка:
    1. Cancel Stripe subscription (якщо active)
    2. Видалити push subscriptions (PostgreSQL)
    3. Видалити mono_integrations (PostgreSQL)
    4. Видалити module_data (PostgreSQL)
    5. Видалити ai_usage_daily (PostgreSQL)
    6. auth.api.deleteUser(userId) — Better Auth cascade
    7. Запланувати async cleanup:
       - Sentry: delete user data (API)
       - PostHog: delete person (API)
       - Resend: delete contact (API)
       - Stripe: delete customer (API)
    8. Логувати deletion event для audit trail
  Handler: apps/server/src/auth.ts → deleteUser hook (вже enabled)
  Файл: apps/server/src/modules/gdpr/delete.ts (новий)

GET  /api/me/preferences
  Auth: requireSession()
  Response: 200 → { analytics: bool, aiMemory: bool, pushNotifications: bool }
  Handler: apps/server/src/routes/me.ts → додати preferences handler
  Файл: apps/server/src/modules/gdpr/preferences.ts (новий)

PATCH /api/me/preferences
  Auth: requireSession()
  Body: { analytics?: bool, aiMemory?: bool, pushNotifications?: bool }
  Response: 200 → оновлені preferences
  Файл: apps/server/src/modules/gdpr/preferences.ts (новий)
```

> Потрібна нова міграція `009_user_preferences.sql` для таблиці
> `user_preferences (user_id, analytics, ai_memory, push_notifications)`.

---

## 2. Технічні edge cases

### 2.1 Billing edge cases

| Кейс                                        | Stripe webhook event                                                                                                  | Handler (створити)                                       | Як обробити                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Юзер платить, але сервер не отримав webhook | —                                                                                                                     | `apps/server/src/modules/billing/pollPlan.ts`            | Polling: перевіряти статус підписки в Stripe при кожному login                       |
| Юзер оплатив, потім зробив chargeback       | [`charge.disputed`](https://docs.stripe.com/api/events/types#event_types-charge.disputed)                             | `apps/server/src/modules/billing/handleDispute.ts`       | Downgrade → Free + email юзеру з поясненням                                          |
| Юзер оплатив з двох акаунтів                | —                                                                                                                     | `apps/server/src/modules/billing/ensureOneCustomer.ts`   | Прив'язка Stripe customer до `user.id`. Один customer = один user                    |
| Юзер видалив акаунт з active subscription   | [`customer.subscription.deleted`](https://docs.stripe.com/api/events/types#event_types-customer.subscription.deleted) | `apps/server/src/modules/billing/handleSubDeleted.ts`    | Cancel Stripe subscription перед delete. Better Auth `deleteUser` hook               |
| Timezone billing                            | —                                                                                                                     | —                                                        | Stripe працює в UTC. UI показує `period_end` у Kyiv timezone                         |
| Currency                                    | —                                                                                                                     | —                                                        | Stripe автоматично конвертує. UI показує ціну в локальній валюті                     |
| Downgrade Pro → Free                        | [`customer.subscription.updated`](https://docs.stripe.com/api/events/types#event_types-customer.subscription.updated) | `apps/server/src/modules/billing/handleSubUpdated.ts`    | Дані залишаються, sync вимикається. Юзер бачить дані локально, але не може sync-нути |
| Free юзер з >5 AI запитами (legacy)         | —                                                                                                                     | `apps/server/src/http/requireAiQuota.ts` (вже існує)     | Grandfather: якщо реєструвався до paywall — grace period 30 днів                     |
| Payment failed (карта declined)             | [`invoice.payment_failed`](https://docs.stripe.com/api/events/types#event_types-invoice.payment_failed)               | `apps/server/src/modules/billing/handlePaymentFailed.ts` | Stripe retry (3 спроби за 3 тижні). Після фінального fail → downgrade + email        |
| Subscription renewed                        | [`invoice.paid`](https://docs.stripe.com/api/events/types#event_types-invoice.paid)                                   | `apps/server/src/modules/billing/handleInvoicePaid.ts`   | Оновити `subscriptions.current_period_end`, confirm Pro status                       |

> **Webhook entry point (створити):**
> `apps/server/src/routes/stripe-webhook.ts` → `POST /api/stripe/webhook`
> з `express.raw()` middleware для Stripe signature verification.

### 2.2 Offline + Billing

Sergeant — local-first. Що відбувається коли юзер офлайн?

- **Plan cache:** зберігати план в localStorage/MMKV. Якщо кеш каже
  «Pro» — дозволити Pro-фічі навіть офлайн.
- **Grace period:** якщо план expired, але юзер офлайн — дати 72 години
  grace.
- **Sync on reconnect:** при поверненні online — перевірити план на
  сервері, оновити кеш.

**Grace period flow:**

```
Юзер відкриває додаток (офлайн)
  │
  ▼
Читаємо plan cache (localStorage / MMKV)
  │
  ├─ cache.plan === "pro" AND cache.expiresAt > now()
  │    → Дозволити Pro-фічі. Нормальна робота.
  │
  ├─ cache.plan === "pro" AND cache.expiresAt <= now()
  │    │
  │    ▼
  │  Перевіряємо grace:
  │  now() - cache.expiresAt < 72 години?
  │    │
  │    ├─ ТАК → Grace mode: Pro-фічі працюють.
  │    │         UI показує банер: "Підписка потребує перевірки.
  │    │         Підключіться до інтернету."
  │    │
  │    └─ НІ  → Downgrade до Free локально.
  │              UI: "Підписка закінчилась. Підключіться для оновлення."
  │              Дані залишаються, sync/AI/звіти заблоковані.
  │
  └─ cache.plan === "free"
       → Free mode. Без змін.

Юзер повертається online
  │
  ▼
GET /api/billing/plan
  │
  ├─ Сервер: перевіряє subscriptions table + Stripe API
  │
  ▼
Оновлюємо cache: { plan, expiresAt, checkedAt }
  │
  ├─ Якщо plan змінився → UI toast: "Ваш план: Pro / Free"
  └─ Якщо був grace → логуємо grace_resolved event
```

### 2.3 Multi-device billing

Юзер оплатив на вебі → відкрив мобілку → мобілка повинна бачити Pro.

**Рішення:** `usePlan()` → `GET /api/billing/plan` → сервер перевіряє
`subscriptions` table → кеш.

Push-нотифікація при зміні плану: «Ваш план оновлено до Pro на всіх
пристроях».

**Sequence diagram (plan sync між пристроями):**

```
Web Browser              Server                    Mobile App
    │                       │                          │
    │  POST /api/stripe     │                          │
    │  /create-checkout     │                          │
    │ ─────────────────────>│                          │
    │                       │                          │
    │  ← redirect to        │                          │
    │    Stripe Checkout     │                          │
    │<─────────────────────-│                          │
    │                       │                          │
    │         ...юзер оплачує на Stripe...              │
    │                       │                          │
    │                       │  Stripe webhook:         │
    │                       │  invoice.paid            │
    │                       │<======================== │
    │                       │                          │
    │                       │  1. UPDATE subscriptions │
    │                       │     SET plan='pro',      │
    │                       │     period_end=...       │
    │                       │                          │
    │                       │  2. Push notification    │
    │                       │     to ALL user devices  │
    │                       │ ─────────────────────────>│
    │                       │                          │
    │                       │                          │  onPush: "План
    │                       │                          │  оновлено до Pro"
    │                       │                          │
    │  GET /api/billing     │                          │  GET /api/billing
    │  /plan                │                          │  /plan
    │ ─────────────────────>│<─────────────────────────│
    │                       │                          │
    │  ← { plan: "pro",    │  → { plan: "pro",        │
    │    expiresAt: ... }   │    expiresAt: ... }      │
    │<─────────────────────-│─────────────────────────>│
    │                       │                          │
    │  Update localStorage  │             Update MMKV  │
    │  plan cache           │             plan cache   │
    │                       │                          │
```

---

## 3. Operations: support, monitoring, incidents

### 3.1 Support

| Що                    | Рішення                                                         | Коли          |
| --------------------- | --------------------------------------------------------------- | ------------- |
| **FAQ / Help center** | Сторінка в додатку або окремий сайт (Notion, GitBook, Mintlify) | До запуску    |
| **Email support**     | support@sergeant.com або Telegram-бот                           | До запуску    |
| **In-app feedback**   | Кнопка «Є ідея / Знайшов баг» → email або Telegram              | До запуску    |
| **Bug reporting**     | Sentry вже є. Додати «Надіслати звіт про помилку» кнопку        | Після запуску |
| **Community**         | Telegram канал/група                                            | До запуску    |

### 3.2 Monitoring та alerting для платного продукту

Sentry + Prometheus вже є. Потрібно додати **бізнес-алерти**:

| Алерт                               | Тригер                                   | Канал                |
| ----------------------------------- | ---------------------------------------- | -------------------- |
| Payment failed rate >10 %           | Stripe webhook `invoice.payment_failed`  | Telegram bot / email |
| Signup rate drop >50 % vs yesterday | PostHog                                  | Email                |
| Error rate >5 % на API              | Prometheus + Grafana або Railway metrics | Telegram             |
| DB approaching storage limit        | Railway metrics                          | Email                |
| AI API budget exceeded              | Anthropic dashboard                      | Email                |
| Churn spike (>3 cancellations/day)  | Custom metric                            | Telegram             |

### 3.3 Incident response

Для платного продукту потрібен мінімальний incident plan:

- [ ] **Status page** — uptimerobot.com (безкоштовно) або Instatus.
- [ ] **On-call** — ти один, але потрібен Telegram alert channel.
- [ ] **Rollback plan** — Railway підтримує instant rollback. Тестувати
      заздалегідь.
- [ ] **DB backup verification** — раз на місяць перевіряти що backup
      відновлюється.

**Runbook template (1 інцидент = 1 заповнений runbook):**

```
============================================================
RUNBOOK: [Назва інциденту]
============================================================
Severity:     SEV-1 / SEV-2 / SEV-3
Date/time:    YYYY-MM-DD HH:MM UTC
Duration:     ____ хв
Reporter:     ____
On-call:      ____

------------------------------------------------------------
1. DETECTION
------------------------------------------------------------
Як виявлено:  [ ] Алерт (який?)  [ ] Юзер-репорт  [ ] Моніторинг
Час виявлення: HH:MM UTC
Час початку:   HH:MM UTC (якщо відрізняється)

------------------------------------------------------------
2. IMPACT
------------------------------------------------------------
Affected users:    ____ (кількість або %)
Affected modules:  [ ] Finyk  [ ] Fizruk  [ ] Routine  [ ] Nutrition
                   [ ] Auth   [ ] Sync    [ ] AI       [ ] Billing
Revenue impact:    ₴____ (оцінка)
Data loss:         [ ] Так  [ ] Ні

------------------------------------------------------------
3. TIMELINE
------------------------------------------------------------
HH:MM  — Виявлено проблему
HH:MM  — Почато діагностику
HH:MM  — Визначено root cause
HH:MM  — Застосовано fix / rollback
HH:MM  — Підтверджено відновлення
HH:MM  — Опубліковано postmortem

------------------------------------------------------------
4. ROOT CAUSE
------------------------------------------------------------
[Опис root cause. Чому це сталося? Чому не було виявлено раніше?]

------------------------------------------------------------
5. RESOLUTION
------------------------------------------------------------
Що зроблено:
  - [ ] Rollback (Railway instant rollback)
  - [ ] Hotfix (PR #____)
  - [ ] DB fix (migration #____)
  - [ ] Config change (env var: ____)
  - [ ] External provider fix (Stripe / Anthropic / ...)

------------------------------------------------------------
6. ACTION ITEMS (prevent recurrence)
------------------------------------------------------------
| # | Action                        | Owner | Deadline   | Status  |
|---|-------------------------------|-------|------------|---------|
| 1 |                               |       | YYYY-MM-DD | [ ] Done|
| 2 |                               |       | YYYY-MM-DD | [ ] Done|
| 3 |                               |       | YYYY-MM-DD | [ ] Done|

------------------------------------------------------------
7. LESSONS LEARNED
------------------------------------------------------------
What went well:
  -

What went wrong:
  -

What was lucky:
  -
============================================================
```

---

## 4. Метрики успіху

### 4.1 North Star Metrics

| Фаза              | North Star                | Target               | Формула / визначення                                       | Де трекати                                      | Ринковий benchmark               |
| ----------------- | ------------------------- | -------------------- | ---------------------------------------------------------- | ----------------------------------------------- | -------------------------------- |
| Beta              | WAU (weekly active users) | 200                  | COUNT(DISTINCT user_id) WHERE last_active >= now() - 7d    | PostHog: `$active_event` weekly unique users    | B2C beta: 100–500 WAU            |
| Launch (місяць 1) | MAU                       | 1,000–5,000          | COUNT(DISTINCT user_id) WHERE last_active >= now() - 30d   | PostHog: monthly active users cohort            | Indie launch: 1K–10K MAU         |
| Growth (місяць 3) | Paid subscribers          | 100–250              | COUNT(\*) FROM subscriptions WHERE status = 'active'       | SQL query на `subscriptions` + Stripe Dashboard | 2–5 % free→paid conversion       |
| Growth (місяць 6) | MRR                       | ₴15K–25K (~$375–625) | SUM(plan_price) FROM subscriptions WHERE status = 'active' | Stripe Dashboard MRR + SQL view                 | Indie SaaS: $500–2K MRR за 6 міс |
| Scale (рік 1)     | MRR                       | ₴100K+ (~$2,500)     | SUM(plan_price) FROM subscriptions WHERE status = 'active' | Stripe Dashboard MRR                            | Top indie: $5K–10K MRR за рік 1  |

### 4.2 Funnel метрики

| Етап funnel            | Метрика                 | Формула                                                        | Де трекати                                                       | Target  | Ринковий benchmark        |
| ---------------------- | ----------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- | ------- | ------------------------- |
| Visit → Sign up        | Landing conversion      | signups / unique_visitors × 100 %                              | PostHog: `$pageview` (landing) → `user_signed_up` funnel         | 10–20 % | SaaS landing: 2–10 %      |
| Sign up → Active       | Activation rate         | users_with_2plus_modules_in_3d / signups × 100 %               | PostHog: `module_data_created` funnel (≥2 distinct modules, ≤3d) | 40–60 % | B2C activation: 20–40 %   |
| Active → Retained      | D7 retention            | users_active_on_day7 / activated_users × 100 %                 | PostHog: retention cohort (D7)                                   | 20–30 % | B2C app D7: 10–25 %       |
| Retained → Paywall hit | Paywall impression rate | users_who_saw_paywall / WAU × 100 %                            | PostHog: `paywall_hit` event / WAU                               | 50–80 % | Metered paywall: 40–70 %  |
| Paywall → Paid         | Free→Pro conversion     | new_subscribers / paywall_impressions × 100 %                  | PostHog: `paywall_hit` → `subscription_created` funnel           | 3–8 %   | B2C freemium: 2–5 %       |
| Paid → Retained        | Monthly churn           | churned_subscribers / total_subscribers_start_of_month × 100 % | SQL: `subscriptions` WHERE `canceled_at` in month / total        | < 5 %   | B2C SaaS churn: 3–8 %/міс |
| Retained → Advocate    | Viral coefficient       | referrals_who_signed_up / active_referrers                     | SQL: `referrals` WHERE status = 'converted' / distinct referrers | > 0.3   | B2C viral coeff: 0.1–0.5  |

### 4.3 Unit Economics Target

| Метрика                     | Формула                                 | Target              | Де трекати                     | Benchmark             |
| --------------------------- | --------------------------------------- | ------------------- | ------------------------------ | --------------------- |
| LTV (Pro subscriber)        | ARPU × avg_lifetime_months = ₴99 × 8    | ₴792                | SQL + Stripe                   | B2C SaaS LTV: $50–200 |
| CAC (blended)               | total_marketing_spend / new_subscribers | ₴20–40              | Ads dashboard + SQL            | Indie B2C CAC: $5–30  |
| LTV:CAC ratio               | LTV / CAC                               | 20:1 → 40:1         | Розрахунок                     | Здорово: > 3:1        |
| Gross margin                | (revenue - COGS) / revenue × 100 %      | > 80 %              | Stripe revenue - infra costs   | SaaS: 70–85 %         |
| Breakeven point             | fixed_costs / ARPU = ₴2,800 / ₴99       | ~30 Pro subscribers | Розрахунок                     | —                     |
| ARPU (avg revenue per user) | MRR / total_active_subscribers          | ₴99                 | Stripe MRR / subscribers count | —                     |

```
Breakeven деталізація:
  - Stripe fees:           ~3 % від revenue
  - Server (Railway):      ~$20/міс = ~₴800/міс
  - AI API (Anthropic):    ~$50/міс = ~₴2,000/міс при 500 active AI users
  - Total fixed:           ~$70/міс = ~₴2,800/міс
  - Breakeven:             ~30 Pro subscribers (₴99 × 30 = ₴2,970)
```

---

## 5. Ризики та мітигація

### Likelihood × Impact матриця

```
                    │ Low Impact     │ Medium Impact    │ High Impact      │ Critical Impact
────────────────────┼────────────────┼──────────────────┼──────────────────┼──────────────────
High Likelihood     │                │                  │ [R6] Юзери не   │ [R1] Низька
                    │                │                  │ хочуть all-in-1  │ конверсія free→Pro
────────────────────┼────────────────┼──────────────────┼──────────────────┼──────────────────
Medium Likelihood   │                │ [R3] AI API      │ [R2] Високий    │
                    │                │ costs зростають  │ churn            │
────────────────────┼────────────────┼──────────────────┼──────────────────┼──────────────────
Low Likelihood      │                │ [R4] Конкурент   │                  │ [R5] Apple
                    │                │ з'являється      │                  │ блокує PWA
────────────────────┼────────────────┼──────────────────┼──────────────────┼──────────────────
```

### Деталізація ризиків

| ID  | Ризик                          | Likelihood | Impact   | Pre-mortem flag                                                                 | Мітигація                                                                 |
| --- | ------------------------------ | ---------- | -------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| R1  | Низька конверсія free→Pro      | High       | Critical | Якщо через 30 днів після launch conversion < 1 % — paywall занадто м'який       | A/B тест paywall-ів, survey «чому не платиш», гнучкі тіри                 |
| R2  | Високий churn                  | Medium     | High     | Якщо monthly churn > 10 % протягом 2 місяців — onboarding не створює звичку     | Onboarding wizard, push re-engagement, «ти пропустив 3 дні»               |
| R3  | AI API costs зростають         | Medium     | Medium   | Якщо AI cost per user > ₴10/міс — unit economics від'ємна                       | Кешування, rate limits, локальні моделі (llama) для простих задач         |
| R4  | Конкурент з'являється          | Low        | Medium   | Якщо з'являється UA all-in-one трекер з AI — потрібна швидша ітерація           | Швидкість ітерацій, community, Mono-lock-in                               |
| R5  | Apple блокує PWA               | Low        | Critical | Якщо Apple обмежує PWA API (push, install) — втрата iOS юзерів                  | Нативний додаток як fallback (Expo вже є)                                 |
| R6  | Юзери не хочуть «все в одному» | High       | High     | Якщо > 60 % юзерів використовують тільки 1 модуль — pivot до модульного pricing | Модульний підхід: можна юзати тільки 1–2 модулі, pay-per-feature (Вар. В) |

> **Trigger для перегляду ризиків:** щомісячний review перших 3 місяців
> після launch. Якщо pre-mortem flag спрацював — ескалація до зміни
> стратегії протягом 1 тижня.

---

## 6. Roadmap монетизації

```
Місяць 1:   ┌─ MVP paywall (Stripe)
            ├─ Free + Pro тіри
            ├─ Landing page + waitlist
            ├─ Telegram channel
            ├─ Privacy Policy + ToS сторінки (§1.1) ← блокер
            └─ ФОП реєстрація (§1.3) ← блокер

Місяць 2:   ┌─ Closed beta (100–200 юзерів)
            ├─ Referral system
            ├─ Onboarding optimization
            ├─ GDPR endpoints (§1.4): export, delete, preferences
            ├─ Збір фідбеку + NPS
            └─ Stripe webhook handlers (§2.1)

Місяць 3:   ┌─ Public launch (Product Hunt + DOU + AIN)
            ├─ Founder's Lifetime Deal
            ├─ Content marketing start
            ├─ Вірусні share cards
            ├─ Status page + incident runbook (§3.3)
            └─ Метрики dashboards (§4)

Місяць 4–6: ┌─ Google Play (Capacitor або Expo)
            ├─ SEO articles
            ├─ Paid ads test (₴5K budget)
            ├─ B2B pilot (1–2 компанії)
            ├─ Risk review: R1–R6 pre-mortem check (§5)
            └─ Ітерація pricing за даними

Місяць 7–12:┌─ App Store
            ├─ Розширення на Польщу
            ├─ Партнерство з Mono
            ├─ Marketplace контенту (тренери, дієтологи)
            └─ Target: ₴100K MRR
```

> Cross-reference з §7 (Pre-launch checklist): всі items з міток
> «Блокер» та «До запуску» мають бути завершені до кінця Місяця 1.
> GDPR endpoints та Stripe webhook handlers — до кінця Місяця 2
> (перед public launch).

---

## 7. Pre-launch чеклист

| #   | Категорія  | Задача                                                      | Owner   | Deadline    | Статус |
| --- | ---------- | ----------------------------------------------------------- | ------- | ----------- | ------ |
| 1   | Юридичне   | Privacy Policy сторінка (§1.1)                              | Founder | Місяць 1 W1 | [ ]    |
| 2   | Юридичне   | Terms of Service сторінка (§1.1)                            | Founder | Місяць 1 W1 | [ ]    |
| 3   | Юридичне   | Cookie consent banner (EU) (§1.1)                           | Dev     | Місяць 1 W2 | [ ]    |
| 4   | Юридичне   | ФОП реєстрація + банківський рахунок (§1.3)                 | Founder | Місяць 1 W2 | [ ]    |
| 5   | Юридичне   | Data classification audit (§1.2)                            | Dev     | Місяць 1 W3 | [ ]    |
| 6   | Продукт    | Paywall UI (не дратує, soft + metered)                      | Dev     | Місяць 1 W2 | [ ]    |
| 7   | Продукт    | Pricing page / модалка                                      | Dev     | Місяць 1 W2 | [ ]    |
| 8   | Продукт    | Billing Settings секція                                     | Dev     | Місяць 1 W3 | [ ]    |
| 9   | Продукт    | `GET /api/me/export` — Data export (GDPR) (§1.4)            | Dev     | Місяць 2 W1 | [ ]    |
| 10  | Продукт    | `DELETE /api/me` — повний cascade + external cleanup (§1.4) | Dev     | Місяць 2 W1 | [ ]    |
| 11  | Продукт    | `GET/PATCH /api/me/preferences` (§1.4)                      | Dev     | Місяць 2 W2 | [ ]    |
| 12  | Продукт    | FAQ / Help page                                             | Founder | Місяць 1 W4 | [ ]    |
| 13  | Маркетинг  | Landing page                                                | Dev     | Місяць 1 W1 | [ ]    |
| 14  | Маркетинг  | Store screenshots (якщо Play Store)                         | Founder | Місяць 4    | [ ]    |
| 15  | Маркетинг  | Demo video (30–60 с)                                        | Founder | Місяць 1 W3 | [ ]    |
| 16  | Маркетинг  | Telegram канал                                              | Founder | Місяць 1 W1 | [ ]    |
| 17  | Маркетинг  | Product Hunt page drafted                                   | Founder | Місяць 2 W4 | [ ]    |
| 18  | Маркетинг  | DOU стаття drafted                                          | Founder | Місяць 2 W4 | [ ]    |
| 19  | Маркетинг  | OG meta tags для social sharing                             | Dev     | Місяць 1 W3 | [ ]    |
| 20  | Технічне   | DB backups verified                                         | Dev     | Місяць 1 W3 | [ ]    |
| 21  | Технічне   | Stripe production keys + webhook endpoint (§2.1)            | Dev     | Місяць 1 W2 | [ ]    |
| 22  | Технічне   | Staging environment                                         | Dev     | Місяць 1 W1 | [ ]    |
| 23  | Технічне   | Rate limiting через Redis (не in-memory) (§2.1)             | Dev     | Місяць 1 W3 | [ ]    |
| 24  | Технічне   | Sentry alerts configured                                    | Dev     | Місяць 1 W2 | [ ]    |
| 25  | Технічне   | Status page — uptimerobot.com (§3.3)                        | Dev     | Місяць 1 W4 | [ ]    |
| 26  | Технічне   | Error rate monitoring (Prometheus + Grafana) (§3.2)         | Dev     | Місяць 1 W3 | [ ]    |
| 27  | Технічне   | Stripe webhook handlers: all events (§2.1)                  | Dev     | Місяць 2 W2 | [ ]    |
| 28  | Технічне   | Offline grace period flow (§2.2)                            | Dev     | Місяць 2 W3 | [ ]    |
| 29  | Технічне   | Multi-device plan sync + push (§2.3)                        | Dev     | Місяць 2 W3 | [ ]    |
| 30  | Операційне | Support email або Telegram                                  | Founder | Місяць 1 W1 | [ ]    |
| 31  | Операційне | Incident rollback tested (Railway) (§3.3)                   | Dev     | Місяць 1 W4 | [ ]    |
| 32  | Операційне | Billing email templates (Resend)                            | Dev     | Місяць 1 W3 | [ ]    |
| 33  | Операційне | Push notification strategy (не спамити)                     | Founder | Місяць 1 W4 | [ ]    |
| 34  | Операційне | Analytics (PostHog) working + dashboards (§4)               | Dev     | Місяць 1 W3 | [ ]    |
| 35  | Операційне | Метрики: NSM + funnel + unit economics dashboards (§4)      | Dev     | Місяць 2 W4 | [ ]    |
| 36  | Операційне | Incident runbook template ready (§3.3)                      | Dev     | Місяць 1 W4 | [ ]    |

---

## Pointers

- Бізнес-модель, тіри, retention/churn UX →
  [01-monetization-and-pricing.md](./01-monetization-and-pricing.md).
- Launch фази, маркетинг, growth engine →
  [02-go-to-market.md](./02-go-to-market.md).
- Технічна імплементація (env vars, week-by-week, бюджети) →
  [03-services-and-toolstack.md](./03-services-and-toolstack.md).
- Operations: 6 зон, n8n + OpenClaw, daily/weekly ритуал →
  [05-operations-and-automation.md](./05-operations-and-automation.md).
