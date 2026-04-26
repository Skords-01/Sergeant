# 03. Services & Toolstack

> Технічна картина: що є зараз, що додати під монетизацію, що змінити, повний каталог інструментів за категоріями (з цінами і статусом), env-змінні, бюджети, week-by-week roadmap.
> Джерело: `sergeant-services-audit.md` + `sergeant-toolstack.md`.
> Позначки в таблицях: 🟢 Безкоштовно · 🟡 Free tier / дешево · 🔴 Платно · ✅ Вже є · ⬜ Потрібен/опціонально · 🆕 Додати під монетизацію.

---

## 1. Поточний стек (що вже є)

```
                    ┌──────────────────────────────────────────────┐
                    │               FRONTEND                        │
                    │  apps/web (Vite + React 18 SPA + PWA)         │
                    │  Хостинг: Vercel (CDN + static)              │
                    │  ─────────────────────────────────────        │
                    │  ✅ PWA (vite-plugin-pwa, Service Worker)     │
                    │  ✅ Sentry (@sentry/react, lazy-load)         │
                    │  ✅ Analytics sink (console-only, stub)        │
                    │  ✅ Bundle size guard (size-limit в CI)        │
                    │  ✅ A11y (axe-core в CI)                      │
                    │  ✅ Caching headers (immutable assets)         │
                    │  ✅ .well-known/assetlinks.json                │
                    └────────────────┬─────────────────────────────┘
                                     │ HTTPS API calls
                    ┌────────────────▼─────────────────────────────┐
                    │               BACKEND                          │
                    │  apps/server (Express + Node 20)               │
                    │  Хостинг: Railway (Dockerfile.api)            │
                    │  ─────────────────────────────────────        │
                    │  ✅ Better Auth (email+pwd, bearer, expo)      │
                    │  ✅ Resend (transactional email)               │
                    │  ✅ AI quota (ai_usage_daily, per-user/IP)     │
                    │  ✅ CloudSync (module_data push/pull)           │
                    │  ✅ Monobank webhook integration                │
                    │  ✅ Push: Web Push (VAPID), APNs, FCM           │
                    │  ✅ Prometheus metrics (/metrics)               │
                    │  ✅ Sentry (@sentry/node)                       │
                    │  ✅ Pino structured logging                     │
                    │  ✅ Rate limiting (Redis / in-memory fallback)  │
                    │  ✅ Helmet (security headers)                   │
                    │  ✅ CSP (configurable)                          │
                    │  ✅ Graceful shutdown (SIGTERM)                  │
                    └────────────────┬─────────────────────────────┘
                                     │
                    ┌────────────────▼─────────────────────────────┐
                    │               DATABASE                         │
                    │  PostgreSQL (Railway managed)                  │
                    │  ─────────────────────────────────────        │
                    │  ✅ Міграції 001-008 (sequential)              │
                    │  ✅ Таблиці: user, session, account,           │
                    │     verification, module_data,                  │
                    │     push_subscriptions, push_devices,           │
                    │     ai_usage_daily, mono_integrations           │
                    │  ✅ pg Pool (configurable PG_POOL_MAX)          │
                    │  ✅ Slow query logging (DB_SLOW_MS)             │
                    └──────────────────────────────────────────────┘

                    ┌──────────────────────────────────────────────┐
                    │               CACHE / QUEUE                    │
                    │  Redis (Railway, optional)                     │
                    │  ─────────────────────────────────────        │
                    │  ✅ Global rate limiting                        │
                    │  ⚠️ Fallback: in-memory per-process            │
                    └──────────────────────────────────────────────┘

                    ┌──────────────────────────────────────────────┐
                    │               EXTERNAL APIs                    │
                    │  ─────────────────────────────────────        │
                    │  ✅ Anthropic Claude (AI chat/coach/nutrition)  │
                    │  ✅ Monobank API (банк-синк)                    │
                    │  ✅ USDA FoodData Central (barcode/nutrition)   │
                    │  ✅ OpenFoodFacts (barcode)                     │
                    │  ✅ Firebase/FCM (Android push)                 │
                    │  ✅ APNs (iOS push)                             │
                    │  ✅ Resend (email)                              │
                    └──────────────────────────────────────────────┘

                    ┌──────────────────────────────────────────────┐
                    │               CI / CD                          │
                    │  GitHub Actions                                │
                    │  ─────────────────────────────────────        │
                    │  ✅ ci.yml: lint, test, build, typecheck        │
                    │  ✅ Coverage (vitest + upload artifacts)        │
                    │  ✅ A11y (axe-core + Playwright)               │
                    │  ✅ Bundle size guard (size-limit)              │
                    │  ✅ License policy check                        │
                    │  ✅ Security audit (pnpm audit)                 │
                    │  ✅ Turborepo remote cache                      │
                    │  ✅ Detox E2E (Android + iOS, separate YMLs)    │
                    │  ✅ Mobile Shell release workflows              │
                    │  ✅ Supply-chain hardening (SHA-pinned actions)  │
                    └──────────────────────────────────────────────┘
```

---

## 2. Що додати (нові сервіси)

### 2.1 💳 Платіжний провайдер — Stripe

| Що               | Деталі                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| **Навіщо**       | Підписки Pro, Checkout, Customer Portal, webhook-и                                                        |
| **Тип**          | Зовнішній SaaS                                                                                            |
| **Вартість**     | 2.9 % + 30¢ per transaction, безкоштовний акаунт                                                          |
| **Що створити**  | Stripe Account → Product → Price (monthly + yearly)                                                       |
| **Env-змінні**   | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO_MONTHLY`, `STRIPE_PRICE_ID_PRO_YEARLY` |
| **Зміни в коді** | Новий роутер `routes/stripe-webhook.ts`, модуль `modules/billing.ts`, ендпоінти checkout/portal           |
| **Альтернатива** | LiqPay/Fondy для MVP (дешевше, швидше); Stripe — для масштабу                                             |

### 2.2 📊 Product Analytics — PostHog

| Що               | Деталі                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Навіщо**       | Зараз analytics — `console.log` в localStorage. Для монетизації потрібно: funnel conversion, retention, feature usage, paywall hits                               |
| **Зараз**        | `analytics.ts` — stub, пише в localStorage, max 200 events                                                                                                        |
| **Варіанти**     | **PostHog** (1M events/міс free, feature flags, session replay, funnels — рекомендовано), Plausible (€9/міс, без funnels), Mixpanel (20M events free, складніший) |
| **Зміни в коді** | Замінити transport в `analytics.ts` (~20 рядків). Код вже готовий до swap.                                                                                        |
| **Env**          | `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`                                                                                                                           |

### 2.3 📧 Transactional Email (розширити)

| Що               | Деталі                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Навіщо**       | Зараз Resend — тільки auth (password reset, email verify). Для білінгу: welcome, payment confirmation, payment failed, subscription canceled, weekly digest |
| **Що додати**    | Billing email templates (можливо React Email для красивих шаблонів)                                                                                         |
| **Зміни**        | Розширити `authTransactionalMail.ts` або створити `billingMail.ts`                                                                                          |
| **Альтернатива** | Resend вже є — не потрібен новий сервіс                                                                                                                     |

### 2.4 ⏰ Cron / Scheduled Jobs

| Що               | Деталі                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| **Навіщо**       | Subscription lifecycle (expire past-due), daily AI briefing push, weekly digest email, cleanup сесій |
| **Зараз**        | Немає                                                                                                |
| **Варіанти**     | Railway Cron · `node-cron` (in-process, не reliable) · **BullMQ + Redis** · Inngest                  |
| **Рекомендація** | **BullMQ** — Redis вже підключений, потрібен тільки `bullmq` пакет                                   |
| **Зміни**        | Новий модуль `modules/jobs/`, worker process або in-process scheduler                                |

### 2.5 📁 File Storage (опціонально, Phase 2+)

| Що               | Деталі                                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| **Навіщо**       | AI-фото їжі (для зберігання, зараз base64 → Anthropic), аватарки, CSV/PDF експорт, backup-и                     |
| **Варіанти**     | **Cloudflare R2** (S3-compatible, 0 egress, $0.015/GB) · Supabase Storage (1GB free) · Railway Volume (без CDN) |
| **Рекомендація** | **R2** — дешево, швидко, S3 API                                                                                 |
| **Коли**         | Не MVP. Потрібен при експорті PDF/CSV або коли фото зберігаються поза Anthropic                                 |

---

## 3. Що змінити в існуючому

### 3.1 🗄️ Database (PostgreSQL)

| Зміна                              | Пріоритет   | Деталі                                                                                            |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| **Додати таблицю `subscriptions`** | 🔴 Критично | Міграція `009_subscriptions.sql` — основа paywall                                                 |
| **Railway backups**                | 🔴 Критично | Перевірити що automated daily backups увімкнені. Для production з платежами — ОБОВ'ЯЗКОВО         |
| **Connection pooling**             | 🟡 Середній | Зараз `pg Pool` direct. При >50 юзерів — додати PgBouncer / Supabase Pooler. У Railway вбудований |
| **Read replicas**                  | ⚪ Пізніше  | Не потрібно до ~10K MAU                                                                           |

### 3.2 🖥️ Backend (Express / Railway)

| Зміна                          | Пріоритет     | Деталі                                                                                                      |
| ------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------- |
| **Billing routes**             | 🔴 Критично   | `/api/billing/*` — checkout, portal, plan. `/api/webhooks/stripe` — webhook handler                         |
| **`requirePlan()` middleware** | 🔴 Критично   | Gate по фічах (cloudSync, aiBriefing тощо)                                                                  |
| **Динамічні AI-ліміти**        | 🔴 Критично   | `aiQuota.ts` → `effectiveLimits()` читає план. Зараз hardcoded: user=120, anon=40 → Free: 5, Pro: unlimited |
| **Webhook security**           | 🔴 Критично   | Stripe signature verification. Endpoint без auth, але з `stripe.webhooks.constructEvent()`                  |
| **Railway scaling**            | 🟡 Середній   | Зараз 1 instance. При >1K MAU — horizontal scaling. Перевірити що rate-limit через Redis                    |
| **Health check розширити**     | 🟡 Середній   | Додати в `/health` перевірку Redis, Stripe connectivity                                                     |
| **Structured billing logs**    | 🟡 Середній   | Pino вже є — додати structured events (subscription_created, payment_failed, …)                             |
| **CORS**                       | ⚪ Перевірити | Якщо Stripe Checkout redirect → перевірити `ALLOWED_ORIGINS`                                                |

### 3.3 🌐 Frontend (Vite / React / Vercel)

| Зміна                | Пріоритет   | Деталі                                                                                               |
| -------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| **`usePlan()` hook** | 🔴 Критично | React Query hook для GET /api/billing/plan                                                           |
| **`<PaywallGate>`**  | 🔴 Критично | Обгортка: children для Pro, paywall card для Free                                                    |
| **BillingSection**   | 🔴 Критично | Нова секція в Settings: план, upgrade, manage, cancel                                                |
| **Analytics swap**   | 🟡 Середній | `analytics.ts` → PostHog/Plausible. Особливо для tracking: paywall_hit, plan_upgraded, plan_canceled |
| **Lock icons**       | 🟡 Середній | Quick actions у `assistantCatalogue` — 🔒 для Pro-only                                               |
| **Pricing page**     | 🟡 Середній | Landing-like сторінка або модалка з порівнянням Free vs Pro                                          |
| **Upgrade banner**   | 🟡 Середній | Soft CTA після N днів або при натисканні Pro-фічі                                                    |
| **Custom domain**    | ⚪ Пізніше  | `sergeant.2dmanager.com.ua` → Vercel custom domain (вже в assetlinks.json)                           |

### 3.4 📱 Mobile (Expo / Capacitor)

| Зміна                    | Пріоритет   | Деталі                                          |
| ------------------------ | ----------- | ----------------------------------------------- |
| **Plan check в нативці** | 🟡 Середній | Expo: `usePlan()` → той самий API endpoint      |
| **PaywallGate (RN)**     | 🟡 Середній | RN-версія компонента                            |
| **Play Store billing**   | ⚪ Пізніше  | Google Play Billing API — якщо вимагатимуть IAP |
| **google-services.json** | 🟡 Середній | Для FCM push. Створити Firebase project         |

### 3.5 🔄 CI / CD

| Зміна                       | Пріоритет   | Деталі                                                                             |
| --------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| **Stripe test keys в CI**   | 🟡 Середній | Для integration tests billing. GitHub Secrets: `STRIPE_SECRET_KEY_TEST`            |
| **E2E billing test**        | ⚪ Пізніше  | Playwright: free user → paywall → Stripe test checkout → verify Pro                |
| **CD: staging environment** | 🟡 Середній | Зараз тільки production Railway. Для billing краще мати staging (Stripe test mode) |

### 3.6 🔐 Security

| Зміна                           | Пріоритет      | Деталі                                                                    |
| ------------------------------- | -------------- | ------------------------------------------------------------------------- |
| **Stripe webhook verification** | 🔴 Критично    | `stripe.webhooks.constructEvent(body, sig, secret)` — захист від спуфінгу |
| **PCI compliance**              | ✅ Не потрібно | Stripe Checkout = Stripe обробляє картки. PCI DSS scope = SAQ A           |
| **Privacy Policy page**         | 🔴 Критично    | Потрібна для Google Play + Stripe + GDPR                                  |
| **Terms of Service**            | 🔴 Критично    | Потрібні для платних підписок                                             |
| **GDPR data export**            | 🟡 Середній    | `User.deleteUser` вже є в Better Auth. Додати data export endpoint        |

---

## 4. Повна карта сервісів (AFTER)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ЗОВНІШНІ СЕРВІСИ                             │
│                                                                      │
│  ✅ Anthropic (AI)          ✅ Monobank (банк)                       │
│  ✅ USDA/OFF (food)         ✅ Resend (email)                        │
│  ✅ FCM + APNs (push)       🆕 Stripe (payments)                    │
│  🆕 PostHog (analytics)    📁 R2 (files, Phase 2)                  │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  FRONTEND (Vercel)           BACKEND (Railway)                       │
│  ┌───────────────────┐       ┌───────────────────────────┐          │
│  │ apps/web           │       │ apps/server                │          │
│  │                    │──────>│                            │          │
│  │ ✅ React SPA + PWA │ API  │ ✅ Express + Better Auth   │          │
│  │ ✅ Sentry          │       │ ✅ AI Quota                │          │
│  │ 🆕 PostHog        │       │ ✅ CloudSync               │          │
│  │ 🆕 usePlan()      │       │ ✅ Mono webhook            │          │
│  │ 🆕 PaywallGate    │       │ ✅ Push (web+native)       │          │
│  │ 🆕 BillingSection │       │ ✅ Prometheus metrics       │          │
│  │ 🆕 Pricing page   │       │ 🆕 Billing module          │          │
│  └───────────────────┘       │ 🆕 requirePlan()           │          │
│                               │ 🆕 Stripe webhook          │          │
│                               │ 🆕 BullMQ jobs             │          │
│                               └──────────┬────────────────┘          │
│                                           │                           │
│                               ┌──────────▼────────────────┐          │
│                               │ PostgreSQL (Railway)       │          │
│                               │ ✅ user, session, account  │          │
│                               │ ✅ module_data, push_*     │          │
│                               │ ✅ ai_usage_daily          │          │
│                               │ ✅ mono_integrations       │          │
│                               │ 🆕 subscriptions           │          │
│                               └──────────┬────────────────┘          │
│                                           │                           │
│                               ┌──────────▼────────────────┐          │
│                               │ Redis (Railway)            │          │
│                               │ ✅ Rate limiting            │          │
│                               │ 🆕 BullMQ job queue        │          │
│                               │ 🆕 Plan cache              │          │
│                               └───────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Env-змінні — повний список для production

### Вже є (перевірити що всі заповнені)

```env
# Core
DATABASE_URL=                    # ✅ Railway Postgres
REDIS_URL=                       # ✅ Railway Redis
NODE_ENV=production              # ✅
PORT=3000                        # ✅ Railway auto

# Auth
BETTER_AUTH_URL=                 # ✅ Railway API URL
BETTER_AUTH_SECRET=              # ✅ 32+ char random
ALLOWED_ORIGINS=                 # ✅ Vercel domain(s)

# AI
ANTHROPIC_API_KEY=               # ✅ Claude API
AI_DAILY_USER_LIMIT=120          # ⚠️ Стане динамічним (plan-based)
AI_DAILY_ANON_LIMIT=40           # ⚠️ Стане динамічним

# Push
VAPID_PUBLIC_KEY=                # ✅ Web Push
VAPID_PRIVATE_KEY=               # ✅
VAPID_EMAIL=                     # ✅
FCM_SERVICE_ACCOUNT_JSON=        # ✅ Android push
APNS_P8_KEY=                     # ✅ iOS push (якщо є)

# Email
RESEND_API_KEY=                  # ✅ Transactional email

# Mono
MONO_WEBHOOK_ENABLED=            # ✅
MONO_TOKEN_ENC_KEY=              # ✅ 32-byte hex
PUBLIC_API_BASE_URL=             # ✅ Railway public URL

# Observability
SENTRY_DSN=                      # ✅
METRICS_TOKEN=                   # ✅ Bearer for /metrics
```

### Додати під монетизацію

```env
# Payments (Stripe)
STRIPE_SECRET_KEY=               # 🆕 sk_live_...
STRIPE_WEBHOOK_SECRET=           # 🆕 whsec_...
STRIPE_PRICE_ID_PRO_MONTHLY=     # 🆕 price_...
STRIPE_PRICE_ID_PRO_YEARLY=      # 🆕 price_...

# Analytics (обрати один)
VITE_POSTHOG_KEY=                # 🆕 phc_... (frontend)
VITE_POSTHOG_HOST=               # 🆕 https://app.posthog.com або self-hosted

# Google Play (коли публікуватимеш)
GOOGLE_PLAY_SERVICE_ACCOUNT=     # 🆕 JSON credentials для EAS Submit
```

---

## 6. Каталог інструментів за категоріями

### 6.1 Розробка та інфраструктура

#### Хостинг і деплой

| Інструмент                                                 | Навіщо                                           | Ціна                         | Фаза           | Статус      |
| ---------------------------------------------------------- | ------------------------------------------------ | ---------------------------- | -------------- | ----------- |
| **[Vercel](https://vercel.com)**                           | Frontend (PWA), CDN, preview deploys             | 🟢 Hobby free, Pro $20/міс   | Зараз          | ✅ Вже є    |
| **[Railway](https://railway.app)**                         | Backend + Postgres + Redis, auto-deploy з GitHub | 🟡 ~$5–20/міс по usage       | Зараз          | ✅ Вже є    |
| **[EAS Build](https://expo.dev/eas)**                      | Нативні Android/iOS білди в хмарі                | 🟡 30 білдів/міс free        | Запуск мобілки | ⬜ Потрібен |
| **[Cloudflare R2](https://developers.cloudflare.com/r2/)** | File storage (фото, PDF)                         | 🟢 10GB free, далі $0.015/GB | Phase 2        | ⬜ Пізніше  |

#### CI / CD

| Інструмент         | Навіщо                                               | Ціна              | Фаза  | Статус   |
| ------------------ | ---------------------------------------------------- | ----------------- | ----- | -------- |
| **GitHub Actions** | CI: lint, test, build, coverage, a11y, license check | 🟢 2K хв/міс free | Зараз | ✅ Вже є |
| **Turborepo**      | Monorepo task orchestration, remote cache            | 🟢                | Зараз | ✅ Вже є |

#### Моніторинг / observability

| Інструмент                     | Навіщо                                     | Ціна                  | Фаза   | Статус           |
| ------------------------------ | ------------------------------------------ | --------------------- | ------ | ---------------- |
| **Sentry**                     | Error tracking (фронт+бек), session replay | 🟡 5K errors/міс free | Зараз  | ✅ Вже є         |
| **Prometheus** + `prom-client` | HTTP RED, DB USE, AI quota                 | 🟢 Вбудовано          | Зараз  | ✅ Вже є         |
| **Grafana Cloud**              | Дашборди для Prometheus метрик             | 🟢 10K metrics free   | Запуск | ⬜ Рекомендовано |
| **UptimeRobot**                | Status page + uptime + алерти              | 🟢 50 моніторів free  | Запуск | ⬜ Потрібен      |
| **BetterStack**                | Uptime + logs + status (all-in-one)        | 🟡 Free tier          | Запуск | ⬜ Альтернатива  |
| **Pino**                       | Structured JSON logging                    | 🟢                    | Зараз  | ✅ Вже є         |

#### Тестування

| Інструмент         | Навіщо                               | Ціна | Фаза  | Статус   |
| ------------------ | ------------------------------------ | ---- | ----- | -------- |
| **Vitest**         | Unit + integration                   | 🟢   | Зараз | ✅ Вже є |
| **Testcontainers** | Integration tests з real Postgres    | 🟢   | Зараз | ✅ Вже є |
| **Playwright**     | A11y (axe-core), E2E web             | 🟢   | Зараз | ✅ Вже є |
| **Detox**          | E2E для React Native (Android + iOS) | 🟢   | Зараз | ✅ Вже є |
| **MSW**            | API mocking у тестах                 | 🟢   | Зараз | ✅ Вже є |

### 6.2 Платежі та білінг

| Інструмент              | Навіщо                                        | Ціна              | Фаза         | Статус      |
| ----------------------- | --------------------------------------------- | ----------------- | ------------ | ----------- |
| **Stripe**              | Підписки, Checkout, Customer Portal, invoices | 🔴 2.9 % + 30¢    | Монетизація  | ⬜ Потрібен |
| **Stripe Dashboard**    | Адмінка: юзери, платежі, рефанди, disputes    | 🟢 Включено       | Монетизація  | ⬜ Потрібен |
| **Stripe Tax**          | VAT/податки автоматом                         | 🔴 0.5 % per tx   | Масштаб      | ⬜ Пізніше  |
| **Paddle** (альт.)      | Merchant of Record — податки за тебе          | 🔴 5 % + 50¢      | Альтернатива | ⬜ Опція    |
| **LiqPay** (альт.)      | UA-native, ПриватБанк                         | 🔴 2.75 %         | Альтернатива | ⬜ Опція    |
| **Google Play Console** | Публікація Android-додатку                    | 🔴 $25 одноразово | Мобілка      | ⬜ Потрібен |
| **Apple Developer**     | Публікація iOS-додатку                        | 🔴 $99/рік        | iOS          | ⬜ Пізніше  |

### 6.3 Аналітика продукту

| Інструмент                | Навіщо                                                       | Ціна              | Фаза   | Статус           |
| ------------------------- | ------------------------------------------------------------ | ----------------- | ------ | ---------------- |
| **PostHog**               | Funnels, retention, feature flags, session replay, A/B-tests | 🟢 1M events/міс  | Запуск | ⬜ Рекомендовано |
| **Plausible**             | Privacy-first web analytics (pageviews, referrers)           | 🔴 €9/міс         | Альт.  | ⬜ Опція         |
| **Mixpanel**              | Event analytics, funnels, cohorts                            | 🟢 20M events/міс | Альт.  | ⬜ Опція         |
| **Google Search Console** | SEO: позиції, clicks, impressions, indexing                  | 🟢                | Запуск | ⬜ Потрібен      |
| **Google Analytics 4**    | Web traffic, referrals, user flow                            | 🟢                | Запуск | ⬜ Опціонально   |

> **Рекомендація:** PostHog — одна платформа замість 3–4. Funnels + feature flags + A/B + session replay.

### 6.4 Email

| Інструмент      | Навіщо                                                    | Ціна                    | Фаза        | Статус           |
| --------------- | --------------------------------------------------------- | ----------------------- | ----------- | ---------------- |
| **Resend**      | Transactional email (auth, billing)                       | 🟢 3K emails/міс free   | Зараз       | ✅ Вже є         |
| **React Email** | Красиві шаблони (JSX → HTML)                              | 🟢                      | Монетизація | ⬜ Рекомендовано |
| **Loops**       | Email drip campaigns (onboarding, re-engagement, winback) | 🟡 Free до 1K контактів | Запуск      | ⬜ Рекомендовано |
| **Brevo**       | Email automation + CRM                                    | 🟢 300 emails/день      | Альт.       | ⬜ Опція         |
| **Mailerlite**  | Email marketing, landing pages                            | 🟢 1K subscribers free  | Альт.       | ⬜ Опція         |

> **Зв'язка:** Resend (transactional) + Loops (marketing).

### 6.5 Маркетинг та соцмережі

#### Платформи для присутності

| Платформа          | Навіщо                                        | Тип контенту          | Фаза        |
| ------------------ | --------------------------------------------- | --------------------- | ----------- |
| **Telegram канал** | Основна UA-аудиторія, анонси, фідбек          | Пости, опитування     | Pre-launch  |
| **Telegram група** | Спільнота, підтримка, челенджі                | Дискусії              | Запуск      |
| **Twitter / X**    | Build in public, tech-аудиторія, Product Hunt | Скріншоти, метрики    | Pre-launch  |
| **Threads**        | UA-аудиторія, зростаюча платформа             | Короткі пости         | Pre-launch  |
| **Instagram**      | Візуал, Reels, Stories                        | Відео, графіка        | Запуск      |
| **TikTok**         | Вірусний потенціал, молода аудиторія          | Короткі відео 15–60 с | Запуск      |
| **LinkedIn**       | B2B, корпоративний wellness                   | Статті, пости         | Phase 2     |
| **Reddit**         | r/productivity, r/ukraine, r/selfimprovement  | Довгі пости, AMA      | Запуск      |
| **DOU.ua**         | UA tech-спільнота                             | Лонгріди              | Запуск      |
| **AIN.ua**         | UA tech-медіа, PR                             | Прес-релізи           | Запуск      |
| **Product Hunt**   | Глобальний лaнч                               | Product page + відео  | Запуск      |
| **Indie Hackers**  | Indie dev спільнота                           | Revenue reports       | Post-launch |

#### Інструменти для SMM

| Інструмент     | Навіщо                                          | Ціна                | Фаза       |
| -------------- | ----------------------------------------------- | ------------------- | ---------- |
| **Buffer**     | Планування постів (X, Insta, LinkedIn, Threads) | 🟢 3 канали free    | Pre-launch |
| **Typefully**  | Twitter/X threads, scheduling, analytics        | 🟡 Free tier        | Pre-launch |
| **Canva**      | Графіка: банери, Store screenshots, OG images   | 🟡 Free tier        | Pre-launch |
| **Figma**      | UI/UX дизайн, Store screenshots з device frames | 🟢 Free для 1 юзера | Pre-launch |
| **CapCut**     | Відеоредактор для Reels/TikTok/demo             | 🟢                  | Запуск     |
| **OBS Studio** | Запис скрінкастів для demo                      | 🟢                  | Запуск     |
| **Loom**       | Швидкі скрінкасти для Product Hunt, support     | 🟡 25 відео free    | Запуск     |

### 6.6 Контент і SEO

| Інструмент                | Навіщо                                | Ціна                                      | Фаза     |
| ------------------------- | ------------------------------------- | ----------------------------------------- | -------- |
| **Ghost / Astro**         | Блог (SEO) на sergeant.com.ua/blog    | 🟢 Self-hosted Ghost / Astro SSG          | Запуск   |
| **Mintlify / GitBook**    | Документація / Help Center / FAQ      | 🟢 Free tier                              | Запуск   |
| **Google Search Console** | SEO: індексація, позиції, кліки       | 🟢                                        | Запуск   |
| **Ahrefs / Ubersuggest**  | Keyword research, конкурентний аналіз | 🔴 Ahrefs $99/міс; 🟡 Ubersuggest $12/міс | Growth   |
| **Surfer SEO**            | Content optimization                  | 🔴 $49/міс                                | Growth   |
| **Claude / ChatGPT**      | Драфти статей, копірайт, переклади    | 🟡 ~$20/міс                               | Всі фази |

> **Мінімальний стек для старту:** Astro блог (free, SSG) + Google Search Console + Claude для драфтів.

### 6.7 Реклама (paid acquisition)

| Платформа                  | Навіщо                                     | Мін. бюджет | CPA estimate     | Фаза       |
| -------------------------- | ------------------------------------------ | ----------- | ---------------- | ---------- |
| **Facebook/Instagram Ads** | UA-аудиторія, точний таргетинг             | ₴3K/міс     | ₴15–30           | Growth     |
| **Google Ads**             | Пошук: «трекер витрат», «рахувати калорії» | ₴3K/міс     | ₴20–40           | Growth     |
| **Telegram Ads**           | UA Telegram канали                         | ₴2K/міс     | ₴10–25           | Growth     |
| **TikTok Ads**             | UGC-стиль реклама                          | ₴3K/міс     | ₴5–15            | Growth     |
| **Apple Search Ads**       | App Store пошук (якщо iOS)                 | $50/міс     | $1–3 per install | iOS launch |

> **Підхід:** не запускати рекламу до Product-Market Fit. Спочатку organic (Telegram, DOU, Product Hunt), потім paid.

### 6.8 Підтримка юзерів

| Інструмент           | Навіщо                                          | Ціна                  | Фаза       |
| -------------------- | ----------------------------------------------- | --------------------- | ---------- |
| **Crisp**            | In-app live chat + knowledge base + chatbot     | 🟢 2 оператори free   | Запуск     |
| **Intercom** (альт.) | Live chat + help center + email automation      | 🔴 $39/міс            | Масштаб    |
| **Telegram бот**     | Підтримка через Telegram (звична для UA юзерів) | 🟢                    | Pre-launch |
| **Canny**            | Feature requests + voting                       | 🟢 Free до 100 постів | Запуск     |
| **Nolt** (альт.)     | Feature voting board                            | 🟡 $25/міс            | Запуск     |
| **Email** (support@) | Базова підтримка                                | 🟢                    | Pre-launch |

> **Мінімальний стек:** Telegram бот + Crisp + email.

### 6.9 Юридичне

| Інструмент         | Навіщо                                 | Ціна                      | Фаза       |
| ------------------ | -------------------------------------- | ------------------------- | ---------- |
| **Iubenda**        | Privacy Policy + Cookie Policy + Terms | 🟡 Free tier (basic)      | Запуск     |
| **Termly** (альт.) | Privacy Policy + Terms generator       | 🟢 Free tier              | Запуск     |
| **CookieYes**      | Cookie consent banner (GDPR)           | 🟢 100 pageviews/міс free | Запуск     |
| **Юрист / ФОП**    | Публічна оферта, реєстрація ФОП        | 🔴 ~₴3K–5K одноразово     | Pre-launch |

### 6.10 Фідбек та дослідження

| Інструмент          | Навіщо                                   | Ціна                     | Фаза       |
| ------------------- | ---------------------------------------- | ------------------------ | ---------- |
| **Typeform**        | Опитування (NPS, CSAT, «чому скасував?») | 🟡 10 відп./міс free     | Запуск     |
| **Tally** (альт.)   | Форми і опитування                       | 🟢 Безлімітно            | Pre-launch |
| **Hotjar**          | Heatmaps, session recordings             | 🟢 35 sessions/день free | Запуск     |
| **PostHog**         | Session replay (вже в аналітиці)         | 🟢 включено              | Запуск     |
| **Telegram poll**   | Швидкі опитування у каналі               | 🟢                       | Всі фази   |
| **User interviews** | Глибинні інтерв'ю (Zoom/Meet)            | 🟢                       | Всі фази   |

### 6.11 Project Management

| Інструмент                   | Навіщо                                   | Ціна             | Фаза     |
| ---------------------------- | ---------------------------------------- | ---------------- | -------- |
| **GitHub Issues + Projects** | Tasks, roadmap, bug tracking             | 🟢               | Зараз ✅ |
| **Linear** (альт.)           | Швидший task tracking                    | 🟢 до 250 issues | Опція    |
| **Notion**                   | Документація, planning, content calendar | 🟢 Free 1 юзер   | Всі фази |

### 6.12 Домен та DNS

| Інструмент                     | Навіщо                            | Ціна           | Фаза       |
| ------------------------------ | --------------------------------- | -------------- | ---------- |
| **Cloudflare**                 | DNS, DDoS, CDN (для landing/blog) | 🟢 Free plan   | Запуск     |
| **Домен** (nic.ua / Namecheap) | sergeant.com.ua або sergeant.ua   | 🔴 ~$10–20/рік | Pre-launch |
| **Vercel Domains**             | Custom domain для фронтенду       | 🟢 Включено    | Запуск     |

---

## 7. Порядок дій (week-by-week)

```
ТИЖДЕНЬ 1:
  ├─ Stripe акаунт + Product/Price створити
  ├─ Міграція 009_subscriptions.sql
  ├─ shared: PlanId, PLAN_GATES, hasAccess()
  └─ server: billing.ts module + routes

ТИЖДЕНЬ 2:
  ├─ server: Stripe webhook handler
  ├─ server: requirePlan() middleware
  ├─ server: aiQuota → динамічні ліміти
  └─ web: usePlan(), PaywallGate, BillingSection

ТИЖДЕНЬ 3:
  ├─ web: підключити PaywallGate до UI
  ├─ web: lock icons на Pro-фічах
  ├─ web: Pricing модалка / сторінка
  └─ PostHog інтеграція (analytics.ts swap)

ТИЖДЕНЬ 4:
  ├─ Privacy Policy + Terms of Service сторінки
  ├─ Billing email templates (Resend)
  ├─ Staging environment на Railway
  └─ E2E тестування повного flow
```

---

## 8. Зведена таблиця: фаза → інструменти

### Pre-launch (за 2–4 тижні до запуску)

| Категорія    | Інструмент               | Вартість       |
| ------------ | ------------------------ | -------------- |
| Домен        | Cloudflare + nic.ua      | ~$15           |
| Landing page | Astro або Framer         | 🟢             |
| Waitlist     | Tally form               | 🟢             |
| Telegram     | Канал + група            | 🟢             |
| Twitter/X    | Акаунт, Typefully        | 🟢             |
| Дизайн       | Canva + Figma            | 🟢             |
| Email        | Resend (вже є)           | 🟢             |
| Юридичне     | Termly (Privacy + Terms) | 🟢             |
| ФОП          | Юрист                    | ~₴3–5K         |
| **Subtotal** |                          | **~₴5K + $15** |

### Запуск (launch week + перший місяць)

| Категорія       | Інструмент            | Вартість/міс           |
| --------------- | --------------------- | ---------------------- |
| Payments        | Stripe (акаунт)       | 🟢 (% per tx)          |
| Analytics       | PostHog               | 🟢                     |
| Email marketing | Loops                 | 🟢 (до 1K)             |
| Status page     | UptimeRobot           | 🟢                     |
| Support         | Crisp + Telegram      | 🟢                     |
| Feature voting  | Canny                 | 🟢                     |
| SEO             | Google Search Console | 🟢                     |
| Cookie          | CookieYes             | 🟢                     |
| Dashboards      | Grafana Cloud         | 🟢                     |
| SMM             | Buffer                | 🟢                     |
| Demo video      | CapCut + OBS          | 🟢                     |
| Product Hunt    | Акаунт                | 🟢                     |
| Google Play     | Developer акаунт      | $25 одноразово         |
| React Email     | Шаблони для billing   | 🟢                     |
| **Subtotal**    |                       | **~$25 once + $0/міс** |

### Growth (місяці 2–6)

| Категорія    | Інструмент                   | Вартість/міс       |
| ------------ | ---------------------------- | ------------------ |
| Paid ads     | Facebook + Google + Telegram | ₴5K–15K            |
| SEO tools    | Ubersuggest                  | $12                |
| Blog         | Ghost / Astro (self-hosted)  | 🟢                 |
| Content AI   | Claude Pro                   | $20                |
| Hotjar       | Heatmaps                     | 🟢                 |
| Email scale  | Loops paid (якщо >1K)        | $49                |
| **Subtotal** |                              | **₴5K–15K + ~$80** |

### Масштаб (6–12 місяців)

| Категорія       | Інструмент         | Вартість/міс         |
| --------------- | ------------------ | -------------------- |
| Support scale   | Intercom           | $39                  |
| Ads scale       | All platforms      | ₴15K–50K             |
| Apple Developer | iOS launch         | $99/рік              |
| Stripe Tax      | Автоподатки        | 0.5 % per tx         |
| File storage    | R2                 | ~$1–5                |
| Railway scale   | Horizontal scaling | $30–50               |
| **Subtotal**    |                    | **₴15K–50K + ~$150** |

---

## 9. Повна Monthly Cost Projection

```
                    Pre-launch    Launch      Growth      Scale
                    (month -1)    (month 1)   (month 3)   (month 12)
────────────────    ──────────    ─────────   ─────────   ──────────
Infrastructure      $15/міс       $25/міс     $35/міс     $80/міс
External APIs       $10–50        $30–100     $50–200     $100–400
Paid tools          $0            $0          ~$80        ~$190
Marketing           ₴0            ₴0          ₴5–15K      ₴15–50K
Legal (one-time)    ₴5K           —           —           —
────────────────    ──────────    ─────────   ─────────   ──────────
TOTAL               ~$75 +        ~$125 +     ~$315 +     ~$770 +
                    ₴5K once      ₴0          ₴10K        ₴30K

Revenue target      ₴0            ₴0–3K       ₴10–25K     ₴100K+
Breakeven subs      —             ~30         ~100        profitable
```

### Вартість поточних сервісів (зараз vs після монетизації)

| Сервіс                 | Зараз       | Після монетизації | Примітки                 |
| ---------------------- | ----------- | ----------------- | ------------------------ |
| **Vercel** (frontend)  | Free        | Free              | Hobby до 100GB bandwidth |
| **Railway** (backend)  | ~$5/міс     | ~$10–20/міс       | Залежить від CPU/memory  |
| **Railway** (Postgres) | ~$5/міс     | ~$5–10/міс        | По usage                 |
| **Railway** (Redis)    | ~$3/міс     | ~$5/міс           | Якщо BullMQ              |
| **Anthropic** (AI)     | ~$10–50/міс | ~$50–200/міс      | Залежить від MAU         |
| **Resend** (email)     | Free        | Free              | До 3K emails/міс         |
| **Sentry**             | Free        | Free              | До 5K errors/міс         |
| **Stripe**             | Free        | 2.9 % + 30¢       | Per transaction          |
| **PostHog**            | —           | Free              | До 1M events/міс         |
| **Firebase / FCM**     | Free        | Free              | Push                     |
| **TOTAL**              | ~$15–60/міс | ~$70–235/міс      | Breakeven ≈ 30 Pro subs  |

---

## 10. Рекомендований мінімальний стек

Все безкоштовне або максимально дешеве, покриває всі потреби:

```
DEV:         Vercel + Railway + GitHub Actions (вже є)
PAYMENTS:    Stripe (тільки % комісія)
ANALYTICS:   PostHog free tier
EMAIL:       Resend (вже є) + Loops free
MARKETING:   Telegram + Twitter + Buffer free
CONTENT:     Astro blog + Claude + Canva free
SUPPORT:     Crisp free + Telegram бот
MONITORING:  Sentry (вже є) + UptimeRobot free + Grafana free
LEGAL:       Termly free + ФОП
FEEDBACK:    Tally + PostHog session replay
SEO:         Google Search Console
─────────────────────────────────────────
TOTAL:       ~$15–60/міс (інфраструктура — вже платиш)
             + Stripe % від транзакцій
             + ₴5K одноразово (ФОП)
             = Практично $0 додаткових fixed costs
```

---

## Pointers

- Бізнес-модель, тіри, payment provider порівняння → [01-monetization-and-pricing.md](./01-monetization-and-pricing.md).
- Маркетингові канали, growth engine, partnerships → [02-go-to-market.md](./02-go-to-market.md).
- Legal, GDPR, billing edge cases, метрики, чеклист → [04-launch-readiness.md](./04-launch-readiness.md).
