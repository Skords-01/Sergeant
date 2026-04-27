# 02. Go-to-market: запуск, промоутинг, growth

> Pre-MVP draft. Цифри traffic/CPA/reach — оцінкові, для брейнштормінгу.
> Джерело: `sergeant-monetization-plan.md` (ч.2), `sergeant-launch-checklist.md` (§7–§9),
> `sergeant-toolstack.md` (§5–§7, §11).

---

## 1. Стратегія запуску: фази

```
ФАЗА 0: Pre-launch (T-4 … T-2 тижні)
  │
ФАЗА 1: Soft launch / Closed beta (2–4 тижні)
  │
ФАЗА 2: Public launch (тиждень запуску)
  │
ФАЗА 3: Growth (ongoing)
  │
ФАЗА 4: Expansion (3–6 місяців після)
```

---

## 2. ФАЗА 0 — Pre-launch

**Мета:** зібрати waitlist 500–1 000 людей до запуску.

### 2.1 Pre-launch checklist

| #   | Дія                                                      | Дедлайн   | Відповідальний |
| --- | -------------------------------------------------------- | --------- | -------------- |
| 1   | Зареєструвати домен `sergeant.com.ua`                    | T-28 днів | Засновник      |
| 2   | Задеплоїти landing page (Astro або Vite static build)    | T-26 днів | Засновник      |
| 3   | Підключити email-збір (Loops або ConvertKit free tier)   | T-24 дні  | Засновник      |
| 4   | Створити Telegram-канал «Sergeant 🎖️» + бот для підписки | T-22 дні  | Засновник      |
| 5   | Опублікувати перший Build-in-Public пост (Twitter/X)     | T-20 днів | Засновник      |
| 6   | Написати founder's story для DOU.ua (див. §4.3 нижче)    | T-18 днів | Засновник      |
| 7   | Запустити опитування «Які модулі найважливіші?» (Tally)  | T-16 днів | Засновник      |
| 8   | Провести 10–15 custdev-інтерв'ю з target-юзерами         | T-14 днів | Засновник      |
| 9   | Підготувати Product Hunt assets (демо-відео, скріни)     | T-11 днів | Засновник      |
| 10  | Зібрати 20+ PH-хантерів / early supporters               | T-8 днів  | Засновник      |
| 11  | Фіналізувати share-card генератор (OG images)            | T-5 днів  | Засновник      |
| 12  | Dry-run launch day: перевірити всі лінки, CTA, analytics | T-2 дні   | Засновник      |

> **T** = дата public launch (ФАЗА 2). Всі дедлайни — від цієї дати назад.

### 2.2 Landing page

- Окремий лендінг: «Sergeant — один додаток замість п'яти».
- Email-збір: «Отримай ранній доступ + пожиттєву знижку».
- Таймер зворотного відліку.
- **Інструменти:** Sergeant web (Vite SSG build) або Astro/Framer для швидкості.
- **URL-стратегія:**

```
sergeant.com.ua                → Landing page (маркетинг)
app.sergeant.com.ua            → PWA-додаток
sergeant.com.ua/blog           → SEO-блог (Astro SSG)
```

### 2.3 Build in Public

- **Twitter/X:** щоденні/щотижневі апдейти, скріни фіч, цифри
  («AI-розпізнавання їжі — точність 87 %»), behind-the-scenes.
- **Threads:** для UA-аудиторії (зростаюча платформа).
- **DOU.ua:** «Як я будую all-in-one life tracker на React» (див. §4.3).
- **Indie Hackers:** journey + revenue goals.

### 2.4 Збір фідбеку

- Tally / Typeform: «Які модулі вам найважливіші?»
- Telegram-канал/група для ранніх адоптерів.
- 10–15 інтерв'ю з потенційними юзерами (Calendly + Google Meet).

---

## 3. ФАЗА 1 — Soft launch / Closed beta

**Мета:** 100–200 активних тестерів, сигнали Product-Market Fit.

### 3.1 Інвайт-система

- Кожен бета-юзер отримує 3–5 інвайтів.
- «Приведи друга — отримай +1 місяць Pro безкоштовно».
- Створює exclusivity + word-of-mouth.

### 3.2 Фідбек-лупи

- In-app feedback widget («Є ідея / Знайшов баг»).
- Щотижневий email-дайджест: «Що ми зробили цього тижня за вашим фідбеком».
- NPS опитування після 7 днів використання.

### 3.3 Ключові метрики бети

| Метрика             | Прийнятно | Добре  | Відмінно |
| ------------------- | --------- | ------ | -------- |
| **D1 retention**    | > 30 %    | > 40 % | > 60 %   |
| **D7 retention**    | > 15 %    | > 20 % | > 30 %   |
| **WAU/MAU**         | > 40 %    | > 50 % | > 65 %   |
| **Activation rate** | > 25 %    | > 40 % | > 60 %   |

> **Activation** = юзер додав запис у 2+ модулях за перші 3 дні.
> Джерело retention/activation бенчмарків: [01-monetization-and-pricing.md §7](./01-monetization-and-pricing.md#7-activation-і-конверсія-у-платників).

---

## 4. ФАЗА 2 — Public launch

**Мета:** 1 000–5 000 юзерів за перший тиждень.

### 4.1 Product Hunt playbook

#### Таймлайн

| Коли            | Дія                                                               |
| --------------- | ----------------------------------------------------------------- |
| T-14 днів       | Створити PH draft, завантажити логотип, скріни, short description |
| T-10 днів       | Записати демо-відео (2 хв макс., див. сценарій нижче)             |
| T-7 днів        | Знайти Hunter (топ-хантер або @chrismessina рівня)                |
| T-3 дні         | Написати 20+ людям у LinkedIn/Twitter з проханням підтримати      |
| T-1 день        | Фіналізувати description, перший коментар, перевірити лінки       |
| **Launch day**  | Опублікувати о 00:01 PST (10:01 Київ). Моніторити коментарі       |
| Launch + 1 день | Подякувати всім, хто upvote. Шерити результат у Telegram/Twitter  |

#### Headline-формули (обрати одну)

```
Формула А: "[Назва] — [What] for [Who]"
→ "Sergeant — All-in-one life hub for finance, fitness, habits & nutrition"

Формула Б: "[Action verb] your [outcome] with [differentiator]"
→ "Track your money, workouts, habits & meals — one app, AI-powered"

Формула В: "[Number] apps replaced by one"
→ "Replace 5 apps with one — finance, fitness, habits, nutrition + AI coach"
```

> Заголовок ≤ 60 символів. Перший рядок — найважливіший.

#### Демо-відео сценарій (≤ 90 с)

```
[0:00–0:05]  Hook: «Скільки додатків ви використовуєте щодня для фінансів,
              фітнесу, звичок і їжі? А якщо все це — в одному?»
[0:05–0:15]  Огляд Dashboard: 4 модулі на одному екрані.
[0:15–0:28]  Фінік: додати транзакцію → Mono sync → AI-інсайт.
[0:28–0:40]  Фізрук: почати тренування → логування сетів → AI workout summary.
[0:40–0:50]  Рутина: чекнути 3 звички → стрік 14 днів → heatmap.
[0:50–1:02]  Харчування: сфотографувати їжу → AI-розпізнавання → калорії.
[1:02–1:12]  AI-чат: «Сержанте, що мені порадиш?» → крос-модульний інсайт.
[1:12–1:22]  CTA: «Спробуй безкоштовно — sergeant.com.ua».
[1:22–1:25]  Логотип + посилання.
```

> **Хронометраж:** 85 с (≤ 90 с). Voiceover ≈ 60 слів → 24 с наратива @150 wpm;
> решта — екранна демонстрація без голосу.
>
> Записувати: OBS Studio (безкоштовно) або Loom.
> Формат: 1920×1080, .mp4, субтитри вшити (для autoplay без звуку).

#### Hunter strategy

1. **Ідеальний hunter** — людина з 1 000+ followers на PH, яка вже хантила
   productivity/finance/health продукти.
2. **Де шукати:** [producthunt.com/directory/upcoming](https://producthunt.com/directory/upcoming),
   Twitter-пошук `"product hunt" "looking for products"`.
3. **Як підійти:** коротке DM (LinkedIn або Twitter) з demo-лінком + одне речення
   чому це релевантно їхній аудиторії.
4. **Якщо не знайшли hunter:** self-launch — це ОК. Фокус на якості першого
   коментаря важливіший за ім'я hunter.

#### Перший коментар (maker comment template)

```
👋 Привіт, Product Hunt! Я [Ім'я], засновник Sergeant.

Sergeant — це один додаток замість п'яти: фінанси, фітнес, звички,
харчування + AI-асистент, що бачить повну картину твого дня.

Чому я це побудував:
- Я використовував 5 різних додатків і жоден не знав про інші.
- Мій фітнес-трекер не знав, що я на дієті. Мій бюджет-додаток
  не знав, що я витратив ₴2K на спортзал.
- Sergeant це виправляє: AI бачить все і дає розумні поради.

🇺🇦 Зроблений в Україні. Працює офлайн. Дані на пристрої.

Буду радий фідбеку — що додати першим?
```

### 4.2 Українські канали

#### Telegram-канали (конкретні, з оцінкою аудиторії)

| Канал (Telegram handle)                | Тематика              | Підписники (орієнтовно)   | Формат посту                 |
| -------------------------------------- | --------------------- | ------------------------- | ---------------------------- |
| **@monobankukraine**                   | Фінанси, monobank     | ~600K (snapshot: 2026-04) | Пост про інтеграцію Фініка   |
| **@oaboronov** (Олег Гороховський)     | Фінтех, бізнес        | ~700K (snapshot: 2026-04) | Колаборація, згадка продукту |
| **@investory_ua**                      | Інвестиції, фінанси   | ~120K (snapshot: 2026-04) | Огляд фін-модуля             |
| **@groshi_ua**                         | Фінансова грамотність | ~80K (snapshot: 2026-04)  | Спонсорський пост            |
| **@startupukraine**                    | Стартапи              | ~25K (snapshot: 2026-04)  | Founder's story              |
| **@ain_ua**                            | Технології, стартапи  | ~90K (snapshot: 2026-04)  | Прес-реліз / огляд           |
| **@daboronov** (Моно фінансові поради) | Особисті фінанси      | ~150K (snapshot: 2026-04) | Пост про бюджетування        |
| **@fitness_ua_channel**                | Фітнес                | ~45K (snapshot: 2026-04)  | Пост про Фізрук-модуль       |
| **@zozh_ukraine**                      | ЗОЖ, здоров'я         | ~60K (snapshot: 2026-04)  | Огляд харчування + фітнес    |
| **@productivity_ua**                   | Продуктивність        | ~35K (snapshot: 2026-04)  | Огляд all-in-one трекера     |
| **@digitalnomad_ua**                   | Фріланс, IT           | ~40K (snapshot: 2026-04)  | Build in public story        |

> Підписники — оцінка на базі [TGStat](https://uk.tgstat.com) (snapshot: квітень 2026).
> Стратегія: почати з безкоштовних згадок (DOU, стартапи), потім бартер
> (Pro за пост), потім платна реклама у великих каналах (₴2K–5K за пост).

#### Інші українські платформи

| Канал                                 | Формат                   | Очікуваний reach |
| ------------------------------------- | ------------------------ | ---------------- |
| **DOU.ua**                            | Стаття «Як я побудував…» | 5K–20K читачів   |
| **AIN.ua**                            | Прес-реліз / стаття      | 10K–50K          |
| **Threads UA**                        | Серія постів             | 1K–10K           |
| **Reddit: r/ukraine, r/productivity** | Пост                     | 2K–10K           |
| **Instagram Reels / TikTok**          | Демо-відео 30–60 с       | 5K–100K (вірус)  |

### 4.3 DOU.ua / AIN.ua — founder's story template

Структура статті для DOU.ua (лонгрід 1 500–2 500 слів):

```
Заголовок-формула: «Як я побудував [що] — [результат] за [час]»
→ «Як я побудував all-in-one life tracker на React — від ідеї до 200 бета-юзерів за 3 місяці»

Секції:

1. HOOK (100 слів)
   Проблема → біль → «я використовував 5 додатків і збожеволів».
   → «Щоранку я відкривав Monobank, потім MyFitnessPal, потім Streaks,
      потім нотатки для списку продуктів. Четвертий додаток — і я ще
      не встав з ліжка. Мені набридло.»

2. РІШЕННЯ (200 слів)
   Що таке Sergeant, одне речення positioning. Скріншот dashboard.
   → «Sergeant — єдиний додаток, що об'єднує фінанси, тренування,
      звички і їжу з AI-асистентом. Один екран — замість п'яти іконок.»

3. ТЕХНОЛОГІЯ (400 слів)
   Стек: React 19, Vite, Express, PostgreSQL, Expo, Capacitor.
   Чому PWA, чому offline-first, чому AI (Anthropic Claude).
   Код-фрагмент або архітектурна діаграма (developers = аудиторія DOU).
   → «Ми обрали PWA, щоб юзер міг користуватись без App Store.
      Offline-first через MMKV + LWW-sync — метро без інтернету не проблема.»

4. ВИКЛИКИ (300 слів)
   3 найбільші проблеми: sync conflicts, AI cost, mono-інтеграція.
   Чесно — що не вийшло з першого разу.
   → «Перший sync-двигун втрачав дані при конфлікті. Ми переписали його
      на Last-Write-Wins з version-vector і провели 200 fuzz-тестів.»

5. МЕТРИКИ (200 слів)
   Beta-результати: D1/D7 retention, NPS, кількість тестерів.
   Скріншот PostHog або графіка.
   → «За 3 тижні бети: 180 тестерів, D1 retention 44 %, NPS 62.
      Найпопулярніший модуль — Фінік (73 % активацій).»

6. МОНЕТИЗАЦІЯ (200 слів)
   Freemium модель, ціни, чому ₴99/міс — конкурентно.
   Посилання на 01-monetization-and-pricing.md (внутрішнє).
   → «Базова версія безкоштовна назавжди. Pro за ₴99/міс відкриває
      AI-коуча і крос-модульні інсайти — дешевше, ніж MyFitnessPal + YNAB.»

7. CTA (100 слів)
   «Спробуй безкоштовно» + лінк + QR-код + Telegram-канал.
   → «Скануй QR або переходь на sergeant.com.ua — перший місяць Pro
      безкоштовно. Приєднуйся до Telegram t.me/sergeant_ua.»
```

> **Для AIN.ua:** коротша версія (600–800 слів), фокус на продукт + ринок,
> менше коду. Формат прес-релізу: «Український розробник запустив…».

### 4.4 Запускова акція

- **«Founder's Deal»:** перші 100 підписників — Lifetime Pro за ₴999
  (замість ₴799/рік).
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
| «Sergeant vs MyFitnessPal: порівняння»   | sergeant vs mfp          | BOFU        |
| «Як я скинув 10 кг з трекером»           | user story               | TOFU        |

> Блог на `sergeant.com.ua/blog` (Astro SSG) — дає SEO juice основному домену.
> Інструменти для контенту/SEO → [03-services-and-toolstack.md §6.5–§6.6](./03-services-and-toolstack.md#65-маркетинг-та-соцмережі).

### 5.2 Реферальна програма

#### Тарифна сітка

| Рівень    | Нагорода referrer | Нагорода referee  |
| --------- | ----------------- | ----------------- |
| 1 друг    | +1 тиждень Pro    | +7 днів Pro trial |
| 3 друзі   | +1 місяць Pro     | +7 днів Pro trial |
| 5 друзів  | +3 місяці Pro     | +7 днів Pro trial |
| 10 друзів | Lifetime Pro      | +7 днів Pro trial |

**Cap:** максимум 12 місяців Pro через referrals (крім рівня Lifetime).

#### Unit economics рефералу

```
Вхідні дані:
  Pro ARPU             = ₴99/міс
  Avg. lifetime        = 6 міс
  LTV                  = ARPU × lifetime = ₴99 × 6 = ₴594
  Free → Pro conv.     = 5 %
  LTV per install      = LTV × conv. = ₴594 × 0.05 = ₴29.70

Вартість рефералу для маркетингу:
  Денна вартість Pro = ₴99 ÷ 30 = ₴3.30/день
  Referrer reward      = 7 днів Pro = ₴3.30 × 7 ≈ ₴23.10
  Referee reward       = 7 днів Pro trial = ₴0 (trial, не revenue loss)
  Ефективний CAC       = ₴23 за реферала

Висновок:
  ROI реферала       = (LTV/install − CAC) / CAC
                       = (₴29.70 − ₴23) / ₴23 ≈ 29 %
  CAC (₴23) < LTV per install (₴29.70) → юніт-економіка позитивна.
  Маркетинг готовий «платити» до ₴25 за рефералового юзера.
  При 10 друзів (Lifetime Pro = ₴799 value) → CAC/реферал = ₴799 ÷ 10 = ₴79.90.
  Окупається якщо 3+ з 10 рефералів конвертнуться в Pro
  (3 × ₴594 = ₴1 782 LTV > ₴799 CAC).
```

#### Механіка

- Унікальне посилання для кожного юзера.
- In-app таблиця лідерів (gamification).
- Push-нотифікація: «Твій друг Олена приєдналась!»

#### Технічна імплементація

```
Потрібно:
  1. Таблиця referrals (referrer_id, referee_id, status, reward_applied)
  2. Унікальний referral code per user (8-char alphanumeric)
  3. GET  /api/referral/code     → повертає код юзера
  4. POST /api/referral/apply    → при реєстрації (з ?ref=ABC123)
  5. Landing: sergeant.com.ua/?ref=ABC123 → cookie → при signup apply
```

### 5.3 Share cards

#### Формати та розміри

| Платформа                  | Розмір (px)   | Aspect ratio | Де використовується     |
| -------------------------- | ------------- | ------------ | ----------------------- |
| Open Graph (Facebook, X)   | 1 200 × 630   | 1.91:1       | Посилання у соцмережах  |
| Instagram / Telegram Story | 1 080 × 1 920 | 9:16         | Stories, прямий шерінг  |
| Telegram-пост preview      | 1 200 × 630   | 1.91:1       | Preview у чатах/каналах |
| Twitter card (summary)     | 800 × 418     | 1.91:1       | Twitter link preview    |

#### Ескізи (ASCII)

**OG-карточка (1 200 × 630, aspect ratio 1.91 : 1):**

```
┌────────────────────────────────────────────────┐  ← 1200 px
│  [Sergeant Logo]          sergeant.com.ua       │
│                                                │
│  🔥 14-денний стрік у Sergeant!                  │
│                                                │
│  ┌──┬──┬──┬──┬──┬──┬──┐                         │
│  │░░│░░│██│██│██│██│██│  ← heatmap              │
│  │░░│██│██│██│██│██│██│    (green squares)       │
│  └──┴──┴──┴──┴──┴──┴──┘                         │
│                                                │
│  [QR-code]  «Приєднуйся → sergeant.com.ua»      │
│                                                │
│                                                │  ← 630 px
└────────────────────────────────────────────────┘
```

> Пропорції вайрфрейму: 48 символів × 14 рядків ≈ 48 / (14 × 2) ≈ 1.71 : 1
> (моноширинний символ ≈ 1 : 2, тому візуально близько до 1.91 : 1).

**Story-карточка (1 080 × 1 920, aspect ratio 9 : 16):**

```
┌────────────────────┐  ← 1080 px
│  [Sergeant Logo]    │
│                    │
│                    │
│  Тренування        │
│  завершено! 💪     │
│                    │
│  ┌────────────────┐│
│  │ Chest Day      ││
│  │ 45 хв · 12 впр. ││
│  │ Tonnage: 4.2T  ││
│  └────────────────┘│
│                    │
│  ┌────────────────┐│
│  │  [QR-CODE]    ││
│  │              ││
│  └────────────────┘│
│                    │
│                    │
│                    │
│                    │
│ sergeant.com.ua    │
│                    │
│                    │  ← 1920 px
└────────────────────┘
```

> Пропорції вайрфрейму: 22 символи × 25 рядків ≈ 22 / (25 × 2) ≈ 0.44 : 1
> (моноширинний символ ≈ 1 : 2, тому візуально близько до 9 : 16 = 0.5625 : 1).

#### Бібліотеки для генерації

| Бібліотека       | Підхід                 | Плюси                                | Мінуси                         |
| ---------------- | ---------------------- | ------------------------------------ | ------------------------------ |
| **@vercel/og**   | Edge runtime + Satori  | JSX-шаблони, zero config на Vercel   | Тільки Vercel Edge             |
| **Satori**       | JSX → SVG → PNG        | Standalone, будь-який Node.js сервер | Потрібен resvg для PNG         |
| **node-canvas**  | Canvas API на сервері  | Повний контроль, шрифти, градієнти   | Нативна залежність (C++ build) |
| **Puppeteer/PW** | Headless Chrome render | Pixel-perfect HTML → PNG             | Важкий, повільний, не для Edge |
| **Sharp**        | Image compositing      | Швидкий, composite з шарів           | Не підтримує text layout       |

> **Рекомендація:** `@vercel/og` (Satori) для OG-images на Vercel Edge,
> `node-canvas` для server-side share cards на Railway.
> Детальніше про інструменти → [03-services-and-toolstack.md §6.5](./03-services-and-toolstack.md#65-маркетинг-та-соцмережі).

#### Модулі для share cards

| Модуль        | Контент карточки                                         |
| ------------- | -------------------------------------------------------- |
| **Routine**   | Стрік + heatmap calendar (green squares)                 |
| **Fizruk**    | «Тренування завершено: chest day, 45 хв, 12 вправ, 4.2T» |
| **Finyk**     | «Цього місяця зекономив ₴2 400» (без sensitive деталей)  |
| **Nutrition** | «7 днів підряд < 2 000 kcal — ціль досягнута!»           |
| **Weekly AI** | AI-згенерована інфографіка тижня (всі модулі)            |

### 5.4 Вірусні петлі (viral loops)

1. **Порівняння тижнів** — генерує красиву карточку → Share в соцмережі.
2. **Стрік-бейджі** — «30 днів без пропуску рутини 🔥» → Share.
3. **Workout complete** — «Тренування завершено: 45 хв, 12 вправ» → Share card.
4. **Фінансовий звіт** — «Цього місяця зекономив ₴2 400» → Share (анонімізовано).
5. **AI-інсайт** — щотижневі інсайти, які хочеться показати друзям.

### 5.5 Community-led growth

- **Telegram-спільнота** «Sergeant Community 🎖️»:
  - Щоденні челенджі: «Сьогодні ходимо 10K кроків».
  - Weekly digest від засновника.
  - Канал ідей + голосування за наступні фічі.
  - Ексклюзивні бета-фічі для активних учасників.
- **Discord** (для tech-аудиторії).

### 5.6 Партнерства

| Партнер                    | Формат                                   | Взаємна вигода               |
| -------------------------- | ---------------------------------------- | ---------------------------- |
| **Monobank**               | Інтеграція в маркетплейс Mono            | Трафік від 7M+ юзерів Mono   |
| **Фітнес-зали (UA)**       | «Тренуйся з Sergeant — отримай знижку»   | Залучення аудиторії залу     |
| **Дієтологи/тренери**      | Контент у додатку (meal plans, програми) | Їм — клієнтів, нам — контент |
| **Telegram-блогери**       | Реклама / бартер (Pro за пост)           | Reach                        |
| **Корпоративний wellness** | B2B-пакет для компаній                   | Великі контракти             |

> Деталі legal/ops для партнерств → [04-launch-readiness.md §1](./04-launch-readiness.md#1-юридичне-та-compliance).

### 5.7 Paid acquisition (якщо є бюджет)

#### Benchmark CPA: UA-ринок productivity/health/finance apps (2025–2026)

| Категорія         | Глобальний CPI (Android) | Глобальний CPI (iOS) | UA-ринок (оцінка, Android) | Джерело                            |
| ----------------- | ------------------------ | -------------------- | -------------------------- | ---------------------------------- |
| Health & Fitness  | $1.20–2.50               | $3.00–5.00           | ₴15–40 (≈ $0.35–0.95)      | Sensor Tower, State of Mobile 2026 |
| Finance / Fintech | $2.00–4.00               | $4.50–8.00           | ₴25–60 (≈ $0.60–1.45)      | AppFillip, CPI Benchmark Q1 2025   |
| Productivity      | $1.50–3.00               | $3.50–6.00           | ₴20–50 (≈ $0.48–1.20)      | Adjust, State of App Growth 2026   |

> UA-ринок — Tier 2 регіон, CPI на 60–80 % нижче за US.

#### Конкуренти: benchmark CPI

| Додаток (категорія)       | Платформа   | CPI орієнтовний (US)    | Примітка                    |
| ------------------------- | ----------- | ----------------------- | --------------------------- |
| **MyFitnessPal** (health) | iOS         | $3.50–5.00              | Категорія H&F, висока конк. |
| **YNAB** (finance)        | iOS         | $5.00–8.00              | Premium фін-аудиторія       |
| **Fealthy** (finance, UA) | Android     | ~₴15–25 (organic-first) | UA-ринок, менша конкуренція |
| **Fabulous** (habits)     | Android     | $1.50–2.50              | Subscription H&F            |
| **Sergeant** (all-in-one) | PWA/Android | **Target: ₴15–30**      | Cross-category, UA-first    |

#### Канали та бюджети

| Канал                       | Бюджет/міс | CPA target          |
| --------------------------- | ---------- | ------------------- |
| Facebook/Instagram Ads (UA) | ₴5K–15K    | ₴15–30 за установку |
| Google Ads (пошук)          | ₴3K–10K    | ₴20–40              |
| Telegram Ads                | ₴2K–5K     | ₴10–25              |
| TikTok (UGC-стиль)          | ₴3K–8K     | ₴5–15               |

> **Unit economics check:** Pro = ₴99/міс, avg. lifetime ≈ 6 міс → LTV = ₴594.
> При конверсії free → Pro 5 % → LTV per install = ₴29.70.
> CPA повинен бути < ₴25 для здорової юніт-економіки (LTV/CPA ≥ 3:1 ідеально).

> **Підхід:** не запускати рекламу до Product-Market Fit. Спочатку organic
> (Telegram, DOU, Product Hunt), потім paid.
> Інструменти реклами → [03-services-and-toolstack.md §6.7](./03-services-and-toolstack.md#67-реклама-paid-acquisition).

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
- [ ] **Open Graph images** — для шерінгу лінків (sergeant.com.ua).
- [ ] **Favicon / PWA icons** — перевірити всі розміри (192, 512, maskable).

### 7.3 Landing page

Зараз web app = landing (юзер одразу бачить додаток). Для маркетингу краще мати
**окремий лендінг**:

```
sergeant.com.ua                → Landing page (маркетинг)
app.sergeant.com.ua            → Додаток (PWA)
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

- [ ] **Pre-rendering** для landing (Vite SSG або Astro site).
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

### 8.1 Підготовка зараз

- [ ] Не hardcode-ити українські рядки в UI. Виносити у constants / копі-файли.
- [ ] Для AI prompts — додати `language` param для multi-lang.
- [ ] `assistantCatalogue.ts` — рядки готові до externalization (архітектурно).

### 8.2 i18n-ready checklist для `apps/web`

Нижче — конкретний checklist, що потрібно переробити в кодовій базі `apps/web`,
щоб рядки були vendor-agnostic і готові до підключення бібліотеки i18n
(react-intl, i18next або lingui):

| #   | Файл / Патерн                                  | Що зробити                                                       | Пріоритет | Статус кодової бази                               |
| --- | ---------------------------------------------- | ---------------------------------------------------------------- | --------- | ------------------------------------------------- |
| 1   | `apps/web/src/**/*.tsx` — inline strings       | Витягнути всі user-facing рядки (label, placeholder, title,      | 🔴 High   | ~110 зхардкоджених `₴`; `messages/` немає         |
|     |                                                | toast, error message) у централізований файл `messages/uk.ts`    |           |                                                   |
| 2   | `apps/web/src/core/AssistantCataloguePage.tsx` | Замінити hardcoded UA-промпти на шаблони з `{locale}` параметром | 🔴 High   | Файл існує; UA-рядки вшиті                        |
| 3   | `apps/web/src/modules/*/constants.ts`          | Перевірити: назви модулів, label, units — винести у messages     | 🟡 Medium | `finyk/constants.ts`, `core/stories/constants.ts` |
| 4   | `packages/shared/src/**`                       | Zod error messages — зробити locale-aware або залишити EN-only   | 🟡 Medium |                                                   |
| 5   | `apps/web/src/modules/finyk/**`                | Перевірити hardcoded `"₴"` → використовувати `Intl.NumberFormat` | 🟡 Medium | 5 файлів з хардкодженим `"₴"`                     |
| 6   | PWA manifest                                   | Створити `manifest.json` з `name`, `short_name`, `description`   | 🟢 Low    | **Файл відсутній** у `apps/web/public/`           |
| 7   | `apps/web/index.html`                          | `<html lang="uk">` → динамічний `lang` атрибут                   | 🟢 Low    | Зараз хардкод `lang="uk"`                         |
| 8   | Дати / числа / валюта                          | Використовувати `Intl.DateTimeFormat`, `Intl.NumberFormat`       | 🟡 Medium | `Intl.*` використовується в 3 файлах              |
|     |                                                | замість hardcoded форматів                                       |           |                                                   |

> **Крок 1 (мінімум для запуску):** винести рядки у `messages/uk.ts` +
> зробити `useTranslation()` wrapper. Можна без бібліотеки — простий
> `Record<string, string>` map + React context.
>
> **Крок 2 (Phase 2):** підключити `react-intl` або `i18next`, додати `en.ts`.
>
> **Крок 3 (Phase 3):** додати `pl.ts`, language switcher в Settings.

---

## Appendix A: SEO — meta title / description для top keyword pages

| Сторінка (URL path)              | Meta title                                        | Chars | Meta description                                                                                     | Chars |
| -------------------------------- | ------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------- | ----- |
| `/`                              | Sergeant — фінанси, фітнес, звички, їжа в одному  | 48    | Безкоштовний трекер фінансів, тренувань, звичок і харчування з AI. Працює офлайн. Зроблений в 🇺🇦.    | 95    |
| `/blog/kontrol-vytrat`           | Як контролювати витрати в Україні 2026 · Sergeant | 49    | Покроковий гайд по контролю витрат: Monobank sync, бюджети, AI-поради. Безкоштовний додаток.         | 91    |
| `/blog/treker-zvychok`           | Найкращі трекери звичок українською · Sergeant    | 46    | Порівняння трекерів звичок: Streaks, Fabulous, Sergeant. Стріки, heatmap, нагадування — українською. | 100   |
| `/blog/rahuvaty-kalorii`         | Як рахувати калорії без зусиль · Sergeant         | 41    | AI розпізнає їжу з фото, сканер штрих-кодів, база 500K+ продуктів. Спробуй безкоштовно.              | 89    |
| `/blog/monobank-analityka`       | Monobank аналітика: як бачити більше · Sergeant   | 47    | Підключи Mono до Sergeant — автоматичні категорії, бюджети, тренди витрат. Безкоштовно.              | 87    |
| `/blog/trenuvannya-vdoma`        | Програма тренувань вдома безкоштовно · Sergeant   | 47    | Готові програми тренувань + логування сетів + AI-рекомендації. Без абонементу в зал.                 | 84    |
| `/blog/sergeant-vs-myfitnesspal` | Sergeant vs MyFitnessPal: порівняння 2026         | 41    | Sergeant = фітнес + фінанси + звички + їжа. MFP = тільки їжа і фітнес. Повне порівняння.             | 89    |

> **Формула:** `{Primary keyword} · Sergeant` для title, value prop + CTA для description.
> Всі title ≤ 60 символів, всі description ≤ 155 символів (перевірено вручну, див. стовпець Chars).
> OG-image: автогенерація через `@vercel/og` з title + branding (див. §5.3).
> Structured data: `SoftwareApplication` JSON-LD на `/`, `BlogPosting` на `/blog/*`.

---

## Pointers

- Бізнес-модель і paywall → [01-monetization-and-pricing.md](./01-monetization-and-pricing.md).
- Інструменти SMM/SEO/контенту/реклами зі статусом і цінами →
  [03-services-and-toolstack.md](./03-services-and-toolstack.md) (§6.5 SMM, §6.6 SEO, §6.7 ADS).
- Метрики успіху, unit economics, ризики, повний pre-launch чеклист →
  [04-launch-readiness.md](./04-launch-readiness.md).
