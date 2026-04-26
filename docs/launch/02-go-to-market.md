# 02. Go-to-market: запуск, промоутинг, growth

> Pre-MVP draft. Цифри trafic/CPA/reach — оцінкові, для брейнштормінгу.
> Джерело: `sergeant-monetization-plan.md` (ч.2), `sergeant-launch-checklist.md` (§7–§9), `sergeant-toolstack.md` (§5–§7, §11).

---

## 1. Стратегія запуску: фази

```
ФАЗА 0: Pre-launch (2-4 тижні до запуску)
  │
ФАЗА 1: Soft launch / Closed beta (2-4 тижні)
  │
ФАЗА 2: Public launch (тиждень запуску)
  │
ФАЗА 3: Growth (ongoing)
  │
ФАЗА 4: Expansion (3-6 місяців після)
```

---

## 2. ФАЗА 0 — Pre-launch

**Мета:** зібрати waitlist 500–1000 людей до запуску.

### Landing page

- Окремий лендінг: «Sergeant — один додаток замість п'яти».
- Email-збір: «Отримай ранній доступ + пожиттєву знижку».
- Таймер зворотного відліку.
- **Інструменти:** сам Sergeant web (Vite), або Carrd/Framer/Astro для швидкості.

### Build in Public

- **Twitter/X:** щоденні/щотижневі апдейти, скрін нових фіч, цифри («AI-розпізнавання їжі — точність 87 %»), behind-the-scenes.
- **Threads:** для UA-аудиторії (зростаюча платформа).
- **DOU.ua:** «Як я будую all-in-one life tracker на React».
- **Indie Hackers:** journey + revenue goals.

### Збір фідбеку

- Tally / Typeform: «Які модулі вам найважливіші?»
- Telegram-канал/група для ранніх адоптерів.
- 10–15 інтерв'ю з потенційними юзерами.

---

## 3. ФАЗА 1 — Soft launch / Closed beta

**Мета:** 100–200 активних тестерів, сигнали Product-Market Fit.

### Інвайт-система

- Кожен бета-юзер отримує 3–5 інвайтів.
- «Приведи друга — отримай +1 місяць Pro безкоштовно».
- Створює exclusivity + word-of-mouth.

### Фідбек-лупи

- In-app feedback widget («Є ідея / Знайшов баг»).
- Щотижневий email-дайджест: «Що ми зробили цього тижня за вашим фідбеком».
- NPS опитування після 7 днів використання.

### Ключові метрики бети

- **D1 retention:** >40 % (хороший), >60 % (відмінний).
- **D7 retention:** >20 %.
- **WAU/MAU:** >50 % (sticky product).
- **Activation rate:** % юзерів, які додали запис у 2+ модулях за 3 дні.

---

## 4. ФАЗА 2 — Public launch

**Мета:** 1000–5000 юзерів за перший тиждень.

### Product Hunt

- **Коли:** вівторок або середа (найкращі дні).
- Підготувати: демо-відео 2 хв, скріншоти, description.
- Заголовок: «Sergeant — Personal life hub: finance + fitness + habits + nutrition with AI».
- Попросити бета-юзерів upvote + залишити review.
- **Target:** Top-5 Product of the Day.

### Українські канали

| Канал                                    | Формат                     | Очікуваний reach |
| ---------------------------------------- | -------------------------- | ---------------- |
| **DOU.ua**                               | Стаття «Як я побудував…»   | 5K–20K читачів   |
| **AIN.ua**                               | Прес-реліз / стаття        | 10K–50K          |
| **Telegram: «Українські стартапи»**      | Пост + лінк                | 5K–15K           |
| **Telegram: фін-канали** (Mono, фінанси) | Пост про Фінік             | 10K–30K          |
| **Telegram: фітнес-канали**              | Пост про Фізрук+Харчування | 5K–20K           |
| **Threads UA**                           | Серія постів               | 1K–10K           |
| **Reddit: r/ukraine, r/productivity**    | Пост                       | 2K–10K           |
| **Instagram Reels / TikTok**             | Демо-відео 30–60 с         | 5K–100K (вірус)  |

### Запускова акція

- **«Founder's Deal»:** перші 100 підписників — Lifetime Pro за ₴999 (замість ₴799/рік).
- **«Перший місяць безкоштовно»** для всіх, хто зареєструється на launch-week.
- **Referral:** «Приведи 3 друзів → Pro на 3 місяці».

---

## 5. ФАЗА 3 — Growth (ongoing)

### 5.1 Контент-маркетинг (SEO)

| Тема статті                              | Target keyword           | Фаза funnel |
| ---------------------------------------- | ------------------------ | ----------- |
| «Як контролювати витрати в Україні 2026» | контроль витрат додаток  | TOFU        |
| «Найкращі трекери звичок українською»    | трекер звичок            | MOFU        |
| «Як рахувати калорії без зусиль»         | рахувати калорії додаток | TOFU        |
| «Monobank аналітика: як бачити більше»   | monobank аналітика       | MOFU        |
| «Програма тренувань вдома безкоштовно»   | тренування вдома         | TOFU        |
| «Sergeant vs MyFitnessPal: порівняння»   | сержант vs               | BOFU        |
| «Як я скинув 10 кг з трекером»           | user story               | TOFU        |

> Блог на `sergeant.2dmanager.com.ua/blog` — дає SEO juice основному домену.

### 5.2 Реферальна програма

```
Рівні:
  1 друг   → +1 тиждень Pro
  3 друзі  → +1 місяць Pro
  5 друзів → +3 місяці Pro
  10 друзів → Lifetime Pro

Механіка:
  - Унікальне посилання для кожного юзера
  - In-app таблиця лідерів (gamification)
  - Push-нотифікація: «Твій друг Олена приєдналась!»
```

### Технічна імплементація

```
Потрібно:
  1. Таблиця referrals (referrer_id, referee_id, status, reward_applied)
  2. Унікальний referral code per user (8-char alphanumeric)
  3. /api/referral/code → GET свій код
  4. /api/referral/apply → POST при реєстрації (з query param ?ref=ABC123)
  5. Landing: sergeant.com.ua/?ref=ABC123 → cookie → при signup apply

Rewards:
  Referrer: +7 днів Pro за кожного реферала
  Referee:  +7 днів Pro trial
  Cap: max 12 місяців Pro через referrals
```

### 5.3 Вірусні петлі (viral loops)

1. **Порівняння тижнів** — генерує красиву карточку → Share в соцмережі.
2. **Стрік-бейджі** — «30 днів без пропуску рутини 🔥» → Share.
3. **Workout complete** — «Тренування завершено: 45 хв, 12 вправ» → Share card.
4. **Фінансовий звіт** — «Цього місяця зекономив ₴2,400» → Share (анонімізовано).
5. **AI-інсайт** — щотижневі інсайти, які хочеться показати друзям.

**Share cards (найшвидший quick win):**

```
Генерувати OG-image (canvas або server-side) з результатами:

"🔥 14-денний стрік у Sergeant!"
[Heatmap календар з green squares]
[QR-code або лінк на landing]

Юзер шерить у Stories/Telegram → друг бачить → лінк на landing → registers
```

Модулі для share cards:

- **Routine:** стрік + heatmap.
- **Fizruk:** «Тренування завершено: chest day, 45 хв, 12 вправ».
- **Finyk:** «Цього місяця зекономив ₴2,400» (без sensitive деталей).
- **Nutrition:** «7 днів підряд < 2000 kcal».
- **Weekly digest:** AI-згенерована інфографіка тижня.

### 5.4 Community-led growth

- **Telegram-спільнота** «Sergeant Community 🎖️»:
  - Щоденні челенджі: «Сьогодні ходимо 10K кроків».
  - Weekly digest від засновника.
  - Канал ідей + голосування за наступні фічі.
  - Ексклюзивні бета-фічі для активних учасників.
- **Discord** (для tech-аудиторії).

### 5.5 Партнерства

| Партнер                    | Формат                                   | Взаємна вигода               |
| -------------------------- | ---------------------------------------- | ---------------------------- |
| **Monobank**               | Інтеграція в маркетплейс Mono            | Трафік від 7M+ юзерів Mono   |
| **Фітнес-зали (UA)**       | «Тренуйся з Sergeant — отримай знижку»   | Залучення аудиторії залу     |
| **Дієтологи/тренери**      | Контент у додатку (meal plans, програми) | Їм — клієнтів, нам — контент |
| **Telegram-блогери**       | Реклама / бартер (Pro за пост)           | Reach                        |
| **Корпоративний wellness** | B2B-пакет для компаній                   | Великі контракти             |

### 5.6 Paid acquisition (якщо є бюджет)

| Канал                       | Бюджет/міс | CPA target          |
| --------------------------- | ---------- | ------------------- |
| Facebook/Instagram Ads (UA) | ₴5K–15K    | ₴15–30 за установку |
| Google Ads (пошук)          | ₴3K–10K    | ₴20–40              |
| Telegram Ads                | ₴2K–5K     | ₴10–25              |
| TikTok (UGC-стиль)          | ₴3K–8K     | ₴5–15               |

> **Unit economics check:** Pro = ₴99/міс, lifetime ~6 міс → LTV = ₴594. При конверсії free→Pro 5 % → LTV per install = ₴30. CPA повинен бути < ₴30.

> **Підхід:** не запускати рекламу до Product-Market Fit. Спочатку organic (Telegram, DOU, Product Hunt), потім paid.

---

## 6. ФАЗА 4 — Expansion

### 6.1 Географічна

1. **Україна** — основний ринок. Гривневі ціни, Mono, українська мова.
2. **Польща** — 1M+ українців, знайомі з Mono.
3. **Англомовний ринок** — pricing $4.99/міс. Product Hunt + Reddit + Twitter.
4. **Туреччина, Бразилія** — ринки з high mobile penetration і price-sensitive юзерами.

### 6.2 Платформна

1. **PWA** (зараз) → основний канал.
2. **Google Play** (Capacitor / Expo) → discovery через Store.
3. **App Store** → Apple-юзери платять більше.
4. **Apple Watch / Wear OS** → quick-log тренувань і їжі.
5. **Telegram Mini App** → лайтовий трекер прямо в Telegram.

### 6.3 Фічі для Growth

- **Челенджі** між друзями: «Хто більше заощадить цього місяця?».
- **Командні цілі** — пари/сім'ї, спільний бюджет, спільні тренування.
- **Інтеграція з Strava, Google Fit, Apple Health**.
- **Widgets** (iOS 14+, Android) — швидкий доступ до даних.
- **AI-коуч рівень 2** — проактивно пише: «Ти вже 3 дні не тренувався».

---

## 7. Контент і брендинг

### 7.1 Messaging / positioning

```
Sergeant — НЕ "ще один трекер".

Positioning statement:
"Sergeant — єдиний додаток, який об'єднує фінанси, тренування,
звички і харчування з AI-асистентом, що бачить повну картину
твого дня. Працює офлайн. Зроблений в Україні."

Ключові меседжі:
1. "Один додаток замість п'яти" (value prop)
2. "AI бачить все — і знає що порадити" (differentiation)
3. "Працює без інтернету" (trust / reliability)
4. "Зроблений в Україні" (emotional / patriotic)
5. "Твої дані — на твоєму пристрої" (privacy / trust)
```

### 7.2 Visual identity checklist

- [ ] **App icon** — є (`assets/icon.png`), перевірити впізнаваність для Store.
- [ ] **Splash screen** — є (dark bg). Для Store потрібні скріншоти з device frames.
- [ ] **Store screenshots** — 5–8 штук для Play Store (кожен модуль + AI chat + dashboard).
- [ ] **Feature graphic** — 1024×500 банер для Play Store.
- [ ] **Demo video** — 30–60 с для Store + landing.
- [ ] **Open Graph images** — для шерінгу лінків (sergeant.2dmanager.com.ua).
- [ ] **Favicon / PWA icons** — перевірити всі розміри (192, 512, maskable).

### 7.3 Landing page

Зараз web app = landing (юзер одразу бачить додаток). Для маркетингу краще мати **окремий лендінг**:

```
sergeant.2dmanager.com.ua/         → Landing page (маркетинг)
sergeant.2dmanager.com.ua/app      → Додаток (PWA)
```

або:

```
sergeant.com.ua                    → Landing page
app.sergeant.com.ua                → Додаток
```

Landing має містити:

- [ ] Hero з демо-скріншотом / анімацією.
- [ ] 4 модулі (фінанси, фітнес, звички, їжа) з іконками.
- [ ] Секція «AI бачить все».
- [ ] Pricing table (Free vs Pro).
- [ ] Social proof / testimonials.
- [ ] CTA: «Спробувати безкоштовно».
- [ ] FAQ.

### 7.4 SEO checklist

PWA SEO складніший (SPA = один HTML), але можна:

- [ ] **Pre-rendering** для landing (Vite SSG або окремий Next.js / Astro site).
- [ ] **Meta tags** — title, description, OG image для кожної маркетингової сторінки.
- [ ] **Structured data** — JSON-LD для SoftwareApplication (schema.org).
- [ ] **Sitemap.xml** — для landing і блогу.
- [ ] **robots.txt** — перевірити.
- [ ] **Blog** — SEO-контент (як рахувати калорії, як вести бюджет, etc.).

---

## 8. Локалізація

| Фаза    | Мова          | Навіщо                     |
| ------- | ------------- | -------------------------- |
| Запуск  | 🇺🇦 Українська | Основний ринок             |
| Phase 2 | 🇬🇧 Англійська | Product Hunt, Reddit, intl |
| Phase 3 | 🇵🇱 Польська   | 1M+ українців у Польщі     |

**Підготовка зараз:**

- [ ] Не hardcode-ити українські рядки в UI. Виносити у constants/копі-файли.
- [ ] Для AI prompts — додати language param для multi-lang.
- [ ] `assistantCatalogue.ts` — рядки готові до externalization (архітектурно).

---

## Pointers

- Бізнес-модель і paywall → [01-monetization-and-pricing.md](./01-monetization-and-pricing.md).
- Інструменти SMM/SEO/контенту/реклами зі статусом і цінами → [03-services-and-toolstack.md](./03-services-and-toolstack.md) (§5 SMM, §6 SEO, §7 ADS).
- Метрики успіху, unit economics, ризики, повний pre-launch чеклист → [04-launch-readiness.md](./04-launch-readiness.md).
