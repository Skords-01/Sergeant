# Sergeant — Launch & Monetization Docs

> Консолідація чотирьох робочих документів (монетизація, лонч-чекліст, аудит сервісів, тулстек) у єдиний набір, згрупований за логікою. Всі цифри/ціни — попередні, для брейнштормінгу.

## Як читати

| Хочеш…                                                                                | Дивись                                                             |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Зрозуміти бізнес-модель і ціни                                                        | [01-monetization-and-pricing.md](./01-monetization-and-pricing.md) |
| Спланувати запуск і просування                                                        | [02-go-to-market.md](./02-go-to-market.md)                         |
| Побачити повну картину сервісів і тулів (що є, що додати, що змінити, скільки коштує) | [03-services-and-toolstack.md](./03-services-and-toolstack.md)     |
| Перевірити готовність до запуску (legal, edge cases, ops, чеклист)                    | [04-launch-readiness.md](./04-launch-readiness.md)                 |

## Високорівнева ідея

```
Sergeant = один додаток замість п'яти (фінанси · фітнес · звички · харчування + AI)
              ▲                                                                 ▲
              │                                                                 │
        local-first PWA + native                                       AI бачить весь день
```

**Бізнес-модель:** Freemium + підписка Pro (₴99/міс або ₴799/рік). MVP-paywall на Stripe / LiqPay. Пейволл — soft + metered: всі 4 модулі базово безкоштовно, ліміти на AI / sync / звіти.

**Ринок:** Україна → Польща → англомовний → Польща/Туреччина/Бразилія.

**North Star roadmap:**

| Місяць | Ціль                                                                               |
| ------ | ---------------------------------------------------------------------------------- |
| 1      | MVP paywall (Stripe), Free + Pro, landing, Telegram-канал                          |
| 2      | Closed beta (100–200 юзерів), референтна система, NPS                              |
| 3      | Public launch (Product Hunt + DOU + AIN), Founder's Lifetime Deal                  |
| 4–6    | Google Play, SEO, paid ads тест, B2B-пілот                                         |
| 7–12   | App Store, розширення на Польщу, партнерство з Mono, marketplace, target ₴100K MRR |

## Що було оригіналом

| Оригінал (drafts)               | Куди увійшло                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `sergeant-monetization-plan.md` | 01 (ч.1: монетизація), 02 (ч.2: промоутинг), 04 (метрики, ризики)                          |
| `sergeant-launch-checklist.md`  | 01 (retention/churn, paywall UX), 02 (growth engine), 04 (legal, edge cases, ops, чеклист) |
| `sergeant-services-audit.md`    | 03 (повністю)                                                                              |
| `sergeant-toolstack.md`         | 03 (повністю)                                                                              |

## Quick Wins (можна робити вже зараз)

1. **Share-карточки** — красиві OG-зображення з результатами тижня (Routine/Fizruk/Finyk/Nutrition) → шерінг у Telegram/Instagram.
2. **Telegram-канал** — почати збирати аудиторію до запуску.
3. **Founder's story на DOU** — безкоштовний PR.
4. **Paywall skeleton** — `subscriptions` таблиця + `requirePlan()` middleware (без платежів — щоб архітектура була готова).
5. **Waitlist landing** — збір email-ів.
6. **PWA install prompt optimization** — піднімати % установок PWA.

Деталі по кожному — у відповідному документі.
