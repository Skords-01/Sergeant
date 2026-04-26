# 04. Launch readiness: legal, ops, edge cases, метрики, чеклист

> Pre-MVP draft. Покриває все, що треба перевірити перед запуском платного продукту.
> Джерело: `sergeant-launch-checklist.md` (§1, §2, §5, §6, §10), `sergeant-monetization-plan.md` (ч.3–6).

---

## 1. Юридичне та compliance

### 1.1 Обов'язкові документи

| Документ                                       | Навіщо                                                                                                                                                                                 | Пріоритет         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| **Privacy Policy (Політика конфіденційності)** | Google Play, Stripe, GDPR, Apple — всі вимагають. Описати: які дані збираєш (фінанси, здоров'я, звички, харчування — sensitive data), навіщо, як зберігаєш, кому передаєш, як видалити | 🔴 Блокер запуску |
| **Terms of Service**                           | Юридичний захист для платних підписок. Правила використання, ліміти відповідальності, refund policy                                                                                    | 🔴 Блокер запуску |
| **Cookie Policy**                              | Якщо використовуєш cookies (Better Auth використовує) — банер + policy. Для EU юзерів — обов'язково                                                                                    | 🟡 До запуску     |
| **Публічна оферта**                            | Для UA-ринку. ФОП може оформити сам                                                                                                                                                    | 🟡 До запуску     |

### 1.2 Data classification

Sergeant збирає **чутливі дані**:

- **Фінансові** — транзакції, баланси, бюджети (Monobank sync).
- **Здоров'я** — вага, тренування, калорії, їжа.
- **Поведінкові** — звички, рутина, daily patterns.
- **AI-контекст** — Memory Bank зберігає факти про юзера.

**Що зробити:**

- [ ] Класифікувати всі поля даних по категоріях (PII, financial, health).
- [ ] Переконатися що sensitive data НЕ потрапляє в analytics (`analytics.ts` вже має коментар про це).
- [ ] Переконатися що Sentry не логує sensitive payload (вже є `delete event.request.cookies` — розширити).
- [ ] AI Memory Bank — додати опцію «Видалити всі мої дані з AI пам'яті».

### 1.3 Юридична форма

| Опція                                | Для чого               | Плюси                                            | Мінуси                                           |
| ------------------------------------ | ---------------------- | ------------------------------------------------ | ------------------------------------------------ |
| **ФОП (3 група)**                    | UA-ринок, до ₴7.8M/рік | Простий, 5 % податок                             | Не підходить для Stripe (треба валютний рахунок) |
| **ФОП (3 група) + валютний рахунок** | UA + intl              | Stripe працює                                    | Потрібна валютна ліцензія                        |
| **Paddle як MoR**                    | Міжнародний ринок      | Paddle = Merchant of Record, сам платить податки | 5 % + 50¢ комісія                                |
| **ТОВ (LLC)**                        | Масштаб, інвестори     | Серйозніше для B2B, інвесторів                   | Складніше адміністрування                        |

> **Рекомендація для старту:** ФОП 3 група + Stripe (або Paddle, якщо не хочеш морочитись з податками в різних юрисдикціях).

### 1.4 GDPR / Data rights

Better Auth вже має `deleteUser: enabled: true`. Для GDPR потрібно більше:

- [ ] **Right to access** — ендпоінт або кнопка «Завантажити мої дані» (JSON/ZIP).
- [ ] **Right to erasure** — `deleteUser` видаляє з БД, але чи видаляється з: Sentry? PostHog? Resend? Stripe? Логів?
- [ ] **Right to portability** — export у стандартному форматі (JSON).
- [ ] **Data retention policy** — скільки зберігаєш дані після видалення акаунту?

---

## 2. Технічні edge cases

### 2.1 Billing edge cases

| Кейс                                        | Як обробити                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Юзер платить, але сервер не отримав webhook | Polling: перевіряти статус підписки в Stripe при кожному login                                    |
| Юзер оплатив, потім зробив chargeback       | Stripe webhook `charge.disputed` → downgrade + email                                              |
| Юзер оплатив з двох акаунтів                | Прив'язка Stripe customer до user.id. Один customer = один user                                   |
| Юзер видалив акаунт з active subscription   | Cancel Stripe subscription перед delete. Better Auth `deleteUser` hook                            |
| Timezone billing                            | Stripe працює в UTC. Показувати period end у Kyiv timezone                                        |
| Currency                                    | Stripe автоматично конвертує. UI має показувати ціну в локальній валюті                           |
| Downgrade Pro → Free                        | Дані залишаються, sync вимикається. Юзер бачить дані на поточному пристрої, але не може sync-нути |
| Free юзер з >5 AI запитами (legacy)         | Grandfather: якщо реєструвався до paywall — grace period 30 днів                                  |

### 2.2 Offline + Billing

Sergeant — local-first. Що відбувається коли юзер офлайн?

- **Plan cache:** зберігати план в localStorage/MMKV. Якщо кеш каже «Pro» — дозволити Pro-фічі навіть офлайн.
- **Grace period:** якщо план expired, але юзер офлайн — дати 72 години grace.
- **Sync on reconnect:** при поверненні online — перевірити план на сервері, оновити кеш.

### 2.3 Multi-device billing

- Юзер оплатив на вебі → відкрив мобілку → мобілка повинна бачити Pro.
- Рішення: `usePlan()` → `GET /api/billing/plan` → сервер перевіряє `subscriptions` table → кеш.
- Push-нотифікація при зміні плану: «Ваш план оновлено до Pro на всіх пристроях».

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
- [ ] **Rollback plan** — Railway підтримує instant rollback. Тестувати заздалегідь.
- [ ] **DB backup verification** — раз на місяць перевіряти що backup відновлюється.

---

## 4. Метрики успіху

### 4.1 North Star Metrics

| Фаза              | North Star                | Target               |
| ----------------- | ------------------------- | -------------------- |
| Beta              | WAU (weekly active users) | 200                  |
| Launch (місяць 1) | MAU                       | 1,000–5,000          |
| Growth (місяць 3) | Paid subscribers          | 100–250              |
| Growth (місяць 6) | MRR                       | ₴15K–25K (~$375–625) |
| Scale (рік 1)     | MRR                       | ₴100K+ (~$2,500)     |

### 4.2 Funnel метрики

```
Visit landing page
  │ [conversion: 10–20%]
  ▼
Sign up (free)
  │ [activation: 40–60% додають дані в ≥2 модулі за 3 дні]
  ▼
Active user (WAU)
  │ [D7 retention: 20–30%]
  ▼
Hit paywall / see value
  │ [free→Pro conversion: 3–8%]
  ▼
Paid subscriber
  │ [monthly churn: <5%]
  ▼
Advocate (refers friends)
  │ [viral coefficient: >0.3]
```

### 4.3 Unit Economics Target

```
LTV (Pro subscriber)     = ₴99/міс × 8 міс (avg lifetime) = ₴792
CAC (blended)            = ₴20–40
LTV:CAC ratio            = 20:1 → 40:1 (>3:1 = здорово)

Breakeven:
  - Stripe fees:           ~3 %
  - Server (Railway):      ~$20/міс
  - AI API (Anthropic):    ~$50/міс при 500 active AI users
  - Total fixed:           ~$70/міс = ₴2,800/міс
  - Breakeven:             ~30 Pro subscribers
```

---

## 5. Ризики та мітигація

| Ризик                          | Ймовірність | Вплив     | Мітігація                                                         |
| ------------------------------ | ----------- | --------- | ----------------------------------------------------------------- |
| Низька конверсія free→Pro      | Висока      | Критичний | A/B тест paywall-ів, survey «чому не платиш», гнучкі тіри         |
| Високий churn                  | Середня     | Високий   | Onboarding wizard, push re-engagement, «ти пропустив 3 дні»       |
| AI API costs зростають         | Середня     | Середній  | Кешування, rate limits, локальні моделі (llama) для простих задач |
| Конкурент з'являється          | Низька      | Середній  | Швидкість ітерацій, community, Mono-lock-in                       |
| Apple блокує PWA               | Низька      | Критичний | Нативний додаток як fallback (Expo вже є)                         |
| Юзери не хочуть «все в одному» | Середня     | Високий   | Модульний підхід: можна юзати тільки 1–2 модулі                   |

---

## 6. Roadmap монетизації

```
Місяць 1:   ┌─ MVP paywall (Stripe або LiqPay)
            ├─ Free + Pro тіри
            ├─ Landing page + waitlist
            └─ Telegram channel

Місяць 2:   ┌─ Closed beta (100-200 юзерів)
            ├─ Referral system
            ├─ Onboarding optimization
            └─ Збір фідбеку + NPS

Місяць 3:   ┌─ Public launch (Product Hunt + DOU + AIN)
            ├─ Founder's Lifetime Deal
            ├─ Content marketing start
            └─ Вірусні share cards

Місяць 4-6: ┌─ Google Play (Capacitor або Expo)
            ├─ SEO articles
            ├─ Paid ads test (₴5K budget)
            ├─ B2B pilot (1-2 компанії)
            └─ Ітерація pricing за даними

Місяць 7-12:┌─ App Store
            ├─ Розширення на Польщу
            ├─ Партнерство з Mono
            ├─ Marketplace контенту (тренери, дієтологи)
            └─ Target: ₴100K MRR
```

---

## 7. Pre-launch чеклист

```
ЮРИДИЧНЕ:
  □ Privacy Policy сторінка
  □ Terms of Service сторінка
  □ Cookie consent (якщо EU)
  □ ФОП / юридична форма для прийому платежів

ПРОДУКТ:
  □ Paywall UI готовий і не дратує
  □ Pricing page / модалка
  □ Billing Settings секція
  □ Data export (GDPR)
  □ "Delete my account" працює зі Stripe cleanup
  □ FAQ / Help page

МАРКЕТИНГ:
  □ Landing page
  □ Store screenshots (якщо Play Store)
  □ Demo video (30-60с)
  □ Telegram канал
  □ Product Hunt page drafted
  □ DOU стаття drafted
  □ OG meta tags для social sharing

ТЕХНІЧНЕ:
  □ DB backups verified
  □ Stripe production keys
  □ Staging environment
  □ Rate limiting через Redis (не in-memory)
  □ Sentry alerts configured
  □ Status page (uptimerobot)
  □ Error rate monitoring

ОПЕРАЦІЙНЕ:
  □ Support email або Telegram
  □ Incident rollback tested
  □ Billing email templates
  □ Push notification strategy (не спамити)
  □ Analytics (PostHog) working
```

---

## Pointers

- Бізнес-модель, тіри, retention/churn UX → [01-monetization-and-pricing.md](./01-monetization-and-pricing.md).
- Launch фази, маркетинг, growth engine → [02-go-to-market.md](./02-go-to-market.md).
- Технічна імплементація (env vars, week-by-week, бюджети) → [03-services-and-toolstack.md](./03-services-and-toolstack.md).
