# Sergeant Design System

Єдина візуальна мова для хаба з 4 модулями: **ФІНІК**, **ФІЗРУК**, **Рутина**,
**Харчування**. Документ — контракт між дизайном і кодом; будь-який новий
екран має користуватися цим набором токенів і примітивів.

> **TL;DR для контриб'ютора.** Якщо ти пишеш новий екран — імпорти все з
> `@shared/components/ui` і використовуй семантичні класи Tailwind
> (`bg-surface`, `text-fg`, `border-border`). Ніколи не додавай hex-коди в
> `className`, не створюй «ще одну кастомну картку», і не пиши
> `text-gray-500` / `bg-white`.

---

## 1. Принципи

1. **Семантичні токени → Tailwind-утиліти → примітиви.** Ніяких hex-кодів в
   `className`. Якщо потрібен новий колір — додай CSS-змінну в
   `src/index.css` і алиас у `tailwind.config.js`, не в компонент.
2. **Темна тема — first-class.** Всі токени живуть у CSS-змінних
   `:root` та `.dark`; теми перемикаються класом без перезапису стилів.
3. **Модулі діляться токенами, а не стилями.** `bg-finyk-surface`,
   `text-fizruk`, `border-routine/30` — це семантичні аксенти; вся базова
   типографіка, spacing, радіуси одні для всіх.
4. **Accessibility не опція.** Клавіатурний фокус завжди видимий
   (`focus-visible:ring-2 ring-brand-500/45`), touch-targets ≥44×44 px,
   контраст ≥4.5:1 для тексту, ≥3:1 для UI-елементів (WCAG AA).
5. **Мобільний first.** Базові пропси розраховані на 375px; планшет
   (768px) отримує додатковий breakpoint.

---

## 2. Кольорові токени

### 2.1 Семантичні поверхні

| Token            | Роль                                | Light     | Dark      |
| ---------------- | ----------------------------------- | --------- | --------- |
| `bg` / `bg-bg`   | Фон сторінки                        | `#fdf9f3` | `#171412` |
| `surface`        | Картки, панелі                      | `#ffffff` | `#201c19` |
| `surface-muted`  | Інпути, hover, допоміжні поверхні   | `#faf7f1` | `#292420` |
| `surface-strong` | Стек сторінки під модалкою          | = `bg`    | = `bg`    |
| `border`         | Розмежувачі, обводки картки         | `#ebe4da` | `#3a342e` |
| `border-strong`  | Сильніший дільник (інпути, таблиці) | `#ddd3c5` | `#4a423a` |

Back-compat: старі токени `panel` / `panelHi` / `line` продовжують працювати.

### 2.2 Текст

| Token    | Роль                                | Light               | Dark      |
| -------- | ----------------------------------- | ------------------- | --------- |
| `text`   | Заголовки, основний текст           | `#1c1917`           | `#faf7f1` |
| `muted`  | Секундарний текст, мітки            | `#57534e`           | `#a8a29e` |
| `subtle` | Третинний текст, плейсхолдери       | `#a8a29e`           | `#57534e` |
| `fg-*`   | Семантичні аліаси (prefer new code) | = text/muted/subtle |

### 2.3 Бренд і модулі

| Token                  | Hex       | Використання                    |
| ---------------------- | --------- | ------------------------------- |
| `accent` / `brand-500` | `#10b981` | Основний бренд, focus ring, CTA |
| `finyk`                | `#10b981` | ФІНІК — гроші, баланси          |
| `fizruk`               | `#14b8a6` | ФІЗРУК — тренування             |
| `routine`              | `#f97066` | Рутина — звички, коралові       |
| `nutrition`            | `#92cc17` | Харчування — ліма               |

Для кожного модуля доступні градаційні шкали `-50`…`-900` + hero-поверхні:
`bg-finyk-surface`, `bg-fizruk-surface`, `bg-routine-surface`,
`bg-nutrition-surface` (світла тінт поверхня під hero-картку модуля).

### 2.4 Статуси

| Token     | Solid     | Soft (bg)      | Використання       |
| --------- | --------- | -------------- | ------------------ |
| `success` | `#10b981` | `success-soft` | Успіх, виконано    |
| `warning` | `#f59e0b` | `warning-soft` | Попередження       |
| `danger`  | `#ef4444` | `danger-soft`  | Помилки, видалення |
| `info`    | `#0ea5e9` | `info-soft`    | Нейтральний статус |

`-soft` токени адаптуються під темну тему автоматично — не пиши
`bg-red-50 dark:bg-danger/15`, пиши `bg-danger-soft`.

### 2.5 Data-viz (графіки)

Канонічний набір у `src/shared/charts/chartTheme.ts`:

- `chartSeries.finyk / .fizruk / .routine / .nutrition` — бренд-акценти
  серій для модуля (primary + secondary + surface).
- `chartPaletteList` — 8-кольорова гармонійна палітра для pie/категорій.
- `chartAxis` / `chartGrid` / `chartTick` / `chartTooltip` — спільні
  Tailwind-класи для осей, сітки, тіків, тултіпів.
- `chartGradients.finyk` тощо — пари stop'ів для area-fill градієнтів.

> Не імпортуй hex із chartPalette.js напряму в компонент — бери через
> `chartTheme.ts`, аби міграція палітри в майбутньому вимагала одного
> файлу.

---

## 3. Типографічна шкала

Всі розміри — в `tailwind.config.js` під `fontSize`:

| Клас        | Size / line-height | Використання                 |
| ----------- | ------------------ | ---------------------------- |
| `text-3xs`  | 10 / 14            | Підписи під мітрами          |
| `text-2xs`  | 11 / 16            | Eyebrow-лейбли, tag-и        |
| `text-xs`   | 12 / 16            | Метадата, timestamp          |
| `text-sm`   | 14 / 20            | Вторинний текст, кнопки `sm` |
| `text-base` | 16 / 24            | Базовий body                 |
| `text-lg`   | 18 / 28            | Заголовок картки             |
| `text-xl`   | 20 / 28            | Section heading `md`         |
| `text-2xl`  | 24 / 32            | Page heading mobile          |
| `text-3xl`  | 30 / 36            | Hero heading                 |
| `text-4xl`  | 36 / 40            | Landing hero                 |
| `text-5xl`  | 48 / 1             | Рідкісні великі промо-цифри  |

Вага:

- `font-medium` (500) — секундарний акцент
- `font-semibold` (600) — дефолт заголовків
- `font-bold` (700) — hero, promo, large stat values
- `font-black` (900) — лише для великих цифр / промо

Числа завжди з `tabular-nums` у таблицях / статистиках.

---

## 4. Spacing, радіуси, тіні

### Spacing scale

Tailwind `spacing` (базова шкала 4px) + кастомні:
`p-4.5` (18px), `h-13` (52px), `h-15` (60px), `h-18` (72px), `h-22` (88px).
Гайдлайн: padding карток ≥16px (`p-4`), гутер між картками ≥12px
(`gap-3`), в hero — `p-6`.

### Радіуси

| Клас           | Значення | Використання                   |
| -------------- | -------- | ------------------------------ |
| `rounded-md`   | 6 px     | Дрібні бейджі, pill            |
| `rounded-lg`   | 8 px     | Маленькі кнопки `xs`           |
| `rounded-xl`   | 12 px    | Кнопки, інпути `sm`            |
| `rounded-2xl`  | 16 px    | Інпути `md/lg`, картки дефолт  |
| `rounded-3xl`  | 24 px    | Картки hero, панелі модулів    |
| `rounded-4xl`  | 32 px    | Великі модалки, bottom-sheets  |
| `rounded-full` | —        | Кружечки, pill-бейджі, аватари |

Правило: **одна картка — один радіус**. Не змішуй `rounded-xl`
header + `rounded-2xl` body.

### Тіні

| Клас           | Джерело                   | Коли                     |
| -------------- | ------------------------- | ------------------------ |
| `shadow-soft`  | `--shadow-soft`           | Фонова підсвітка блоку   |
| `shadow-card`  | `--shadow-card`           | Дефолт для `Card`        |
| `shadow-float` | `--shadow-float`          | Hover, плаваючі елементи |
| `shadow-glow`  | Tailwind (брендовий blur) | CTA, акценти, фокуси     |

Темна тема має власні значення змінних — не додавай `dark:shadow-*`.

---

## 5. Примітиви UI

Імпорт:

```ts
import {
  Badge,
  Banner,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  FormField,
  IconButton,
  Icon,
  Input,
  SectionHeader,
  Segmented,
  Select,
  Skeleton,
  Spinner,
  Stat,
  Tabs,
  Textarea,
} from "@shared/components/ui";
```

### Button

Базовий контракт для всіх кнопок.

- **Variants**: `primary` · `secondary` · `ghost` · `danger` · `success`
  - модульні (`finyk` / `fizruk` / `routine` / `nutrition` з soft-версіями).
- **Sizes**: `xs` (h-8) · `sm` (h-9) · `md` (h-11) · `lg` (h-12) · `xl` (h-14).
  Усі `md+` задовольняють touch-target 44×44.
- **States**:
  - `loading` — автоматично додає `Spinner`, ставить `aria-busy`.
  - `disabled` — `opacity-50 cursor-not-allowed`, блокує pointer-events.
  - `focus-visible` — `ring-2 ring-brand-500/45 ring-offset-2`.
  - `active:scale-[0.98]` для press feedback.
- **`iconOnly`** — прибирає px-padding і робить квадратну геометрію.
  Альтернатива: `IconButton` (див. нижче).

### IconButton

Обгортка над `Button` з `iconOnly` і **обов'язковим** `aria-label`.

```tsx
<IconButton aria-label="Відкрити меню" variant="ghost" onClick={openMenu}>
  <Icon name="menu" />
</IconButton>
```

Не використовуй голий `<button>` для іконок — порушиш focus-contract.

### Card

- **Variants**: `default` · `interactive` · `flat` · `elevated` · `ghost`
  - модульні (`finyk`/`fizruk`/`routine`/`nutrition` + soft-версії).
- **Radius**: `md` / `lg` / `xl` (дефолт 2xl для плоских, 3xl для hero).
- **Padding**: `none` / `sm` / `md` / `lg` / `xl`.
- **Subcomponents**: `CardHeader`, `CardTitle`, `CardDescription`,
  `CardContent`, `CardFooter`. Використовуй їх замість ручного
  `<div className="p-4 flex items-center justify-between">`.
- `interactive` — hover-lift + active scale, правильний focus ring для
  клік-карток.

### Input / Textarea / Select

- **Sizes**: `sm` (h-9) · `md` (h-11) · `lg` (h-12).
- **Variants**: `default` · `filled` · `ghost`.
- **States**: `error` (з `aria-invalid`), `success`, `disabled`.
- Focus — `focus-visible:ring-brand-500/30`, а не `focus:`, аби
  pointer-клік не блимав кільцем.

### Badge

- **Variants**: `neutral` · `accent` · `success` · `warning` · `danger` ·
  `info` + модульні.
- **Tones**: `soft` (фон + колір + border) · `solid` (фільд) · `outline`.
- **Sizes**: `xs` / `sm` / `md`. Опційно `dot` (кольорова крапка-статус).

### Stat

Пара «мітка + значення» з опційним субтитром та іконкою.

- **Tones**: `default` · `success` · `warning` · `danger` + модульні.
- **Sizes**: `sm` · `md` · `lg`.
- Вирівнювання: `left` / `center` / `right`.
- Цифри автоматично отримують `tabular-nums`.

### Tabs / Segmented

- `Tabs` — верхній роутер секцій. Tones: `underline` (мінімал) / `pill`
  (м'який таб). Акценти підхоплюються з модуля (`brand`/`finyk`/…).
- `Segmented` — перемикач з 2-4 опціями (напр. період «день/тиждень/місяць»).

Обидва примітиви мають повну клавіатурну навігацію: ArrowLeft/Right,
Home/End, `role="tablist"`.

### SectionHeader

Єдиний стиль для eyebrow-лейблів («ПРОГРЕС», «ВИТРАТИ»). Замінює
розкидані `text-2xs font-bold text-subtle uppercase tracking-widest`.

```tsx
<SectionHeader size="xs" action={<Button size="xs">Всі</Button>}>
  Нещодавні витрати
</SectionHeader>
```

**Розмір (`size`) vs колір (`tone`)** — окремі осі:

| size | type-scale                                     | коли                    |
| ---- | ---------------------------------------------- | ----------------------- |
| `xs` | `text-2xs font-bold uppercase tracking-widest` | compact in-card eyebrow |
| `sm` | `text-xs  font-bold uppercase tracking-widest` | standard section title  |
| `md` | `text-sm font-semibold`                        | inline group heading    |
| `lg` | `text-lg font-extrabold leading-tight`         | page sub-section        |
| `xl` | `text-xl font-extrabold leading-tight`         | page/route title        |

| tone        | клас                | коли                                  |
| ----------- | ------------------- | ------------------------------------- |
| `subtle` \* | `text-subtle`       | eyebrow по замовчуванню для `xs`/`sm` |
| `muted`     | `text-muted`        | послаблений підпис                    |
| `text` \*   | `text-text`         | за замовчуванням для `md`/`lg`/`xl`   |
| `accent`    | `text-accent`       | глобальний фокус/лінк (emerald)       |
| `finyk`     | `text-finyk/70`     | brand-tint у модулі ФІНІК             |
| `fizruk`    | `text-fizruk/70`    | brand-tint у модулі ФІЗРУК            |
| `routine`   | `text-routine/70`   | brand-tint у модулі Рутина            |
| `nutrition` | `text-nutrition/70` | brand-tint у модулі Харчування        |

Зірочкою (\*) — це значення за замовчуванням; їх можна не передавати.

**Branded eyebrow** (напр. KJВЖ-картки в Харчуванні):

```tsx
<SectionHeading as="div" size="xs" tone="nutrition">
  Білки
</SectionHeading>
```

Перед `tone` уникай `text-nutrition/70` / `text-nutrition/80` /
`text-nutrition/90` драфту — усі branded eyebrow'и нормалізовані до
`/70`.

### EmptyState

- `icon` · `title` · `description` · `action`.
- `compact` режим для in-card плейсхолдерів.
- Використовуй для всіх «немає даних» станів — не роби ad-hoc.

### Spinner

Канонічний індикатор завантаження (4 розміри). Використовується всередині
`Button loading`, інлайн-фетчі, skeleton overlay.

---

## 6. Focus, disabled, loading — єдиний контракт

| Стан             | Поведінка                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `:focus-visible` | `ring-2 ring-brand-500/45 ring-offset-2 ring-offset-surface` на кнопках, `ring-brand-500/30` на інпутах         |
| `:disabled`      | `opacity-50`, `cursor-not-allowed`, `pointer-events-none`                                                       |
| `loading`        | Показує `Spinner`, встановлює `aria-busy="true"`, disables pointer events                                       |
| `:active`        | `active:scale-[0.98]` для прес-feedback                                                                         |
| `:hover`         | Тільки там, де `hover:` реально працює (не-touch); на `interactive` картках — `translate-y-[-2px] shadow-float` |

---

## 7. Мобільні брейкпоінти

Перевіряй кожен екран на:

- **375 px** — iPhone SE / 12 mini (дефолтний mobile)
- **414 px** — iPhone 14 Pro Max / Pro
- **768 px** — iPad / планшет (вмикає `md:` префікси)

Правила:

1. Touch targets ≥44×44 (розмір `Button md`+, `IconButton md`+).
2. `min-h-[44px]` для інпутів навіть коли контент коротший.
3. Текст в інпутах ≥16 px — інакше iOS зумить екран при фокусі.
4. Safe-area insets (notch / home indicator) — через `page-tabbar-pad`,
   `routine-main-pad`, `fizruk-above-tabbar` (див. `src/index.css`).

---

## 8. Темна тема

Увімкнення — клас `dark` на `<html>`. Всі кольори резолвяться через CSS-
змінні `--c-*`, тож додавати `dark:bg-...` більшості разів **НЕ треба**:

```tsx
// ❌ НЕ пиши
<div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700">

// ✅ Пиши
<div className="bg-surface border border-border">
```

Dark-override потрібен тільки коли ефект несиметричний між темами
(напр. градієнти hero-картки). У таких випадках документуй у комменті.

---

## 9. WCAG AA контраст

| Пара                          | Ratio    | Статус       |
| ----------------------------- | -------- | ------------ |
| `text` on `surface` (light)   | 14.2 : 1 | AAA ✓        |
| `muted` on `surface` (light)  | 5.8 : 1  | AA ✓         |
| `subtle` on `surface` (light) | 2.9 : 1  | < AA (декор) |
| `text` on `surface` (dark)    | 14.0 : 1 | AAA ✓        |
| `muted` on `surface` (dark)   | 5.5 : 1  | AA ✓         |
| `brand-500` white text        | 3.9 : 1  | AA large ✓   |
| `finyk` white text            | 3.9 : 1  | AA large ✓   |
| `fizruk` white text           | 3.3 : 1  | AA large ✓   |
| `routine` white text          | 3.5 : 1  | AA large ✓   |
| `nutrition` white text        | 3.1 : 1  | AA large ✓   |
| `danger` white text           | 4.2 : 1  | AA ✓         |

Виводи:

1. `subtle` — тільки для декоративних / disabled станів, ніколи не для
   інформативного тексту.
2. Модульні кольори (fizruk/routine/nutrition) як background для білого
   тексту — **тільки у large-text режимі** (≥18 px / ≥14 px bold) або
   для іконок ≥24 px. Для body-тексту — використовуй `text-text` на
   surface, а модульний колір — для акценту (border/stroke/stat-value).

---

## 10. Coding rules

- `npm run check-imports` блокує імпорт `./components/ui/*` всередині
  модулів — використовуй `@shared/components/ui`.
- `eslint no-restricted-syntax` блокує retired-палітри `forest-*` і
  `accent-NNN` (табличні варіанти). Використовуй `accent`, `brand-500`,
  `fizruk`, `routine`, `nutrition`, `finyk`.
- Не створюй кастомних кнопок / картки поза `@shared/components/ui`.
  Якщо потрібен новий паттерн — додай варіант у примітив, а не пиши
  inline `<button className="h-11 px-5 bg-teal-500 text-white ...">`.
- Не пиши hex-кольори в `className`. Додай CSS-змінну + Tailwind alias.
- Hover-ефекти не повинні ламати touch-скрол; завжди враховуй
  `@media (hover: hover)` або використовуй `active:` для touch.

---

## 11. Міграційні патерни

Якщо рефакториш існуючий екран:

| Знайди                                                                | Заміни на                                            |
| --------------------------------------------------------------------- | ---------------------------------------------------- |
| `text-2xs font-bold text-subtle uppercase tracking-widest`            | `<SectionHeader size="xs">`                          |
| `<button className="h-9 w-9 rounded-full ...">...</button>`           | `<IconButton aria-label="…">...</IconButton>`        |
| `bg-white dark:bg-stone-900 border border-stone-200`                  | `bg-surface border border-border`                    |
| `bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 ...` | `bg-danger-soft text-danger border border-danger/30` |
| Ad-hoc `<svg className="animate-spin ...">`                           | `<Spinner size="sm" />`                              |
| `text-gray-500` / `text-stone-500`                                    | `text-muted`                                         |
| `focus:ring-*`                                                        | `focus-visible:ring-*`                               |

---

## 12. Що далі

- Догнати всі модулі (ФІНІК / ФІЗРУК / Рутина / Харчування) під єдині
  примітиви — окремими PR'ами, по модулю.
- Додати Storybook-подібну сторінку `/design` з живими прикладами.
- Розширити WCAG-audit автотестом (axe) у CI.
