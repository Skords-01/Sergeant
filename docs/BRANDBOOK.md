# Sergeant Brandbook & Design System

> **Version:** 2.0
> **Last Updated:** April 2026
> **Design Philosophy:** Soft & Organic with Emerald/Teal accent

---

## Brand Identity

### Name & Voice

- **Name:** Sergeant (Сержант)
- **Tagline:** "Твій персональний хаб життя"
- **Voice:** Friendly, motivating, supportive — like a helpful friend, not a drill sergeant
- **Tone:** Warm, encouraging, clear, Ukrainian-first

### Brand Personality

- **Approachable:** Not intimidating, welcoming to beginners
- **Supportive:** Celebrates small wins, doesn't shame for missed goals
- **Smart:** Provides insights without overwhelming
- **Playful:** Gamification elements inspired by Duolingo

---

## Color System

### Primary Brand Colors

#### Emerald (Primary Accent)

The main brand color representing growth, health, and financial prosperity.

```
Emerald 50:  #ecfdf5  (Lightest surfaces)
Emerald 100: #d1fae5
Emerald 200: #a7f3d0  (Rings, borders)
Emerald 300: #6ee7b7
Emerald 400: #34d399  (Light accent)
Emerald 500: #10b981  (PRIMARY - buttons, icons)
Emerald 600: #059669  (Hover states)
Emerald 700: #047857  (Dark accent)
Emerald 800: #065f46
Emerald 900: #064e3b  (Darkest)
```

#### Teal (Secondary Accent)

Used for Fizruk module and complementary accents.

```
Teal 50:  #f0fdfa
Teal 100: #ccfbf1
Teal 200: #99f6e4
Teal 300: #5eead4
Teal 400: #2dd4bf
Teal 500: #14b8a6  (Fizruk primary)
Teal 600: #0d9488
Teal 700: #0f766e
```

### Module Colors

| Module    | Primary | Surface | Use Case         |
| --------- | ------- | ------- | ---------------- |
| Finyk     | #10b981 | #ecfdf5 | Finance tracking |
| Fizruk    | #14b8a6 | #f0fdfa | Fitness tracking |
| Routine   | #f97066 | #fff5f3 | Habit tracking   |
| Nutrition | #92cc17 | #f8fee7 | Food tracking    |

### Semantic Colors

```
Success:  #10b981 (Emerald 500)
Warning:  #f59e0b (Amber 500)
Danger:   #ef4444 (Red 500)
Info:     #0ea5e9 (Sky 500)
```

### WCAG-AA `-strong` Tier

The saturated `-500` shades above are correct for **brand identity**
(logos, marketing assets, dark-mode rendering, App Store screenshots,
solid module surfaces) but do **not** clear WCAG 2.1 AA 4.5 : 1
against the cream `bg-bg` (`#fdf9f3`) or pure white `bg-panel`
(`#ffffff`) at body sizes. Each saturated brand colour ships with a
`-strong` companion that does. **Use the strong tier whenever the
colour is rendered as text or as the fill behind `text-white`.**

| Family    | Saturated (`-500`) | Strong (Tailwind utility)                                  | Hex       | Contrast vs `bg-bg` | Contrast vs `text-white` |
| --------- | ------------------ | ---------------------------------------------------------- | --------- | ------------------- | ------------------------ |
| brand     | `#10b981`          | `bg-brand-strong` / `text-brand-strong` (= emerald-700)    | `#047857` | 5.23 : 1            | 5.48 : 1                 |
| success   | `#10b981`          | `bg-success-strong` / `text-success-strong` (emerald-700)  | `#047857` | 5.23 : 1            | 5.48 : 1                 |
| warning   | `#f59e0b`          | `bg-warning-strong` / `text-warning-strong` (amber-700)    | `#b45309` | 4.83 : 1            | 5.02 : 1                 |
| danger    | `#ef4444`          | `bg-danger-strong` / `text-danger-strong` (red-700)        | `#b91c1c` | 6.17 : 1            | 6.47 : 1                 |
| info      | `#0ea5e9`          | `bg-info-strong` / `text-info-strong` (sky-700)            | `#0369a1` | 5.66 : 1            | 5.93 : 1                 |
| finyk     | `#10b981`          | `bg-finyk-strong` / `text-finyk-strong` (emerald-700)      | `#047857` | 5.23 : 1            | 5.48 : 1                 |
| fizruk    | `#14b8a6`          | `bg-fizruk-strong` / `text-fizruk-strong` (teal-700)       | `#0f766e` | 5.22 : 1            | 5.47 : 1                 |
| routine   | `#f97066`          | `bg-routine-strong` / `text-routine-strong` (coral-700)    | `#c23a3a` | 5.06 : 1            | 5.30 : 1                 |
| nutrition | `#92cc17`          | `bg-nutrition-strong` / `text-nutrition-strong` (lime-800) | `#466212` | 6.64 : 1            | 6.96 : 1                 |

> **Note on nutrition.** Lime is exceptionally light at every step;
> `lime-700` (`#567c0f`) clears 4.67 : 1 — only a 0.17 margin over the
> threshold. The nutrition `-strong` companion is therefore bumped one
> step further to `lime-800` (`#466212`) for a 6.64 : 1 ratio. Other
> families stay at `-700`.

#### Decision matrix — which tier per primitive

| Primitive           | Variant / tone                                              | Background                     | Text                   | Tier rule                                    |
| ------------------- | ----------------------------------------------------------- | ------------------------------ | ---------------------- | -------------------------------------------- |
| `Button`            | `primary`, `destructive`                                    | `bg-{brand,danger}-strong`     | `text-white`           | **strong** for fill + `text-white`           |
| `Button`            | `secondary`, `ghost`                                        | `bg-panel` / transparent       | `text-text`            | no brand colour involved                     |
| `Button`            | module solid (`finyk` / `fizruk` / `routine` / `nutrition`) | `bg-{module}-strong`           | `text-white`           | **strong**                                   |
| `Button`            | module soft (`*-soft`)                                      | `bg-{module}-soft`             | `text-{module}-strong` | **strong** for text                          |
| `Badge`             | solid (any tone)                                            | `bg-{tone}-strong`             | `text-white`           | **strong**                                   |
| `Badge`             | soft (any tone)                                             | `bg-{tone}-soft`               | `text-{tone}-strong`   | **strong** for text                          |
| `Badge`             | outline (any tone)                                          | transparent                    | `text-{tone}-strong`   | **strong** for text; border keeps `*-500/60` |
| `Tabs`              | active label                                                | page bg                        | `text-{c}-strong`      | **strong** for text                          |
| `Segmented`         | active solid                                                | `bg-{c}-strong`                | `text-white`           | **strong**                                   |
| `Stat`              | coloured value                                              | inherited                      | `text-{c}-strong`      | **strong** for text                          |
| `SectionHeading`    | `accent` variant                                            | inherited                      | `text-brand-strong`    | **strong**                                   |
| `FormField`         | error message                                               | inherited                      | `text-danger-strong`   | **strong**                                   |
| `Banner`            | success / warning / danger / info                           | tinted soft surface            | `text-{tone}-strong`   | **strong** for text                          |
| `ProgressRing` SVG  | stroke colour                                               | n/a (decorative stroke ≠ text) | inherited              | saturated `-500` is fine; stroke isn't text  |
| Icons (decorative)  | any                                                         | n/a                            | n/a                    | saturated `-500` is fine                     |
| Marketing / hero    | logo, illustration                                          | n/a                            | n/a                    | **always** saturated `-500`                  |
| Dark-mode (`.dark`) | any                                                         | dark surface                   | brand `-300/400/500`   | **never** `-strong` (would regress contrast) |

Cross-platform: the `-strong` Tailwind utilities are exposed by
`packages/design-tokens/tailwind-preset.js` so both `apps/web`
(Tailwind) and `apps/mobile` (NativeWind) get them automatically. For
RN consumers that style via `StyleSheet.create({ color: ... })`,
`@sergeant/design-tokens/mobile` exposes `accentStrong` /
`successStrong` / `warningStrong` / `dangerStrong` / `infoStrong` with
the same hex values (see `packages/design-tokens/mobile.js`).

See [`docs/brand-palette-wcag-aa-proposal.md`](./brand-palette-wcag-aa-proposal.md)
for the full rationale, contrast measurements, and the migration
history (PR #851 → PR #855).

### Background Colors (Light Mode)

```
Page Background:    #fdf9f3 (Warm cream)
Panel/Card:         #ffffff (Pure white)
Panel Hover:        #faf7f1 (Warm hover)
Border:             #ebe4da (Warm gray)
```

### Text Colors (Light Mode)

```
Primary Text:   #1c1917 (Warm black - Stone 900)
Muted Text:     #57534e (Stone 600)
Subtle Text:    #a8a29e (Stone 400)
```

---

## Typography

### Font Family

**DM Sans** — A geometric sans-serif that's friendly yet professional.

```css
font-family:
  "DM Sans",
  system-ui,
  -apple-system,
  "Segoe UI",
  sans-serif;
```

### Type Scale

| Name | Size | Line Height | Weight   | Use Case            |
| ---- | ---- | ----------- | -------- | ------------------- |
| 2xs  | 10px | 14px        | Medium   | Tiny labels         |
| xs   | 12px | 16px        | Medium   | Captions, badges    |
| sm   | 14px | 20px        | Regular  | Body small, buttons |
| base | 16px | 24px        | Regular  | Body text           |
| lg   | 18px | 28px        | Medium   | Large body          |
| xl   | 20px | 28px        | Semibold | Card titles         |
| 2xl  | 24px | 32px        | Bold     | Section headers     |
| 3xl  | 30px | 36px        | Bold     | Page titles         |
| 4xl  | 36px | 40px        | Bold     | Hero headlines      |

### Font Weights

- Regular (400): Body text
- Medium (500): Labels, captions
- Semibold (600): Buttons, card titles
- Bold (700): Headlines, important numbers

---

## Spacing System

Based on 4px grid with Tailwind defaults:

```
0.5: 2px    (Micro gaps)
1:   4px    (Tight spacing)
1.5: 6px
2:   8px    (Small gaps)
3:   12px   (Medium gaps)
4:   16px   (Standard spacing)
5:   20px   (Card padding)
6:   24px   (Large spacing)
8:   32px   (Section spacing)
10:  40px
12:  48px   (Page margins)
```

---

## Border Radius

Soft, organic, friendly shapes:

```
xl:   12px  (Small buttons, chips)
2xl:  16px  (Buttons, inputs)
3xl:  24px  (Cards, panels)
4xl:  32px  (Large cards, modals)
5xl:  40px  (Hero sections)
full: 9999px (Pills, avatars)
```

---

## Shadows

Layered, soft shadows for depth without harshness:

### Card Shadow

```css
box-shadow:
  0 1px 3px rgba(28, 25, 23, 0.04),
  0 4px 16px rgba(28, 25, 23, 0.08),
  inset 0 1px 0 rgba(255, 255, 255, 0.9);
```

### Float Shadow (Elevated/Hover)

```css
box-shadow:
  0 2px 8px rgba(28, 25, 23, 0.06),
  0 12px 40px rgba(28, 25, 23, 0.12),
  inset 0 1px 0 rgba(255, 255, 255, 0.85);
```

### Glow (Focus states)

```css
box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
```

---

## Components

### Buttons

#### Primary Button

- Background: `bg-brand-strong` (= emerald-700, `#047857`) — clears
  WCAG AA 5.48 : 1 against `text-white`. The saturated `bg-brand`
  (`#10b981`) only cleared ~2.5 : 1 and was retired from CTAs in
  PR #855; see _WCAG-AA `-strong` Tier_ above.
- Text: `text-white`
- Hover: Darker shade (`bg-brand-800`) + subtle glow
- Active: Scale down to 98%

#### Secondary Button

- Background: White panel
- Border: Line color
- Hover: Slight background, border color change

#### Ghost Button

- Background: Transparent
- Text: Muted color
- Hover: Subtle background fill

### Cards

#### Default Card

```css
.card {
  background: white;
  border: 1px solid #ebe4da;
  border-radius: 24px;
  box-shadow: /* card shadow */;
  padding: 16px;
}
```

#### Interactive Card

Same as default + hover lift animation:

- Transform: translateY(-2px)
- Shadow: float shadow
- Transition: 200ms ease-smooth

#### Hero Card (Module-branded)

Gradient background matching module color.

### Progress Ring

Duolingo-inspired circular progress indicator:

- Animated fill on mount
- Centered percentage/value display
- Module-colored variants

### Badges

Pill-shaped status indicators. All solid tones use the `-strong` fill
so labels remain legible at body sizes (see _WCAG-AA `-strong` Tier_).

- Success: `bg-success-strong` (emerald-700) + `text-white`
- Warning: `bg-warning-strong` (amber-700) + `text-white`
- Danger: `bg-danger-strong` (red-700) + `text-white`
- Outline / soft variants: `text-{tone}-strong` against the tinted or
  transparent surface
- Sizes: xs, sm, md, lg

---

## Animations

### Timing Functions

```css
ease-smooth: cubic-bezier(0.25, 0.46, 0.45, 0.94)
ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1)
```

### Duration

- Fast: 150ms (hover states)
- Default: 200ms (most transitions)
- Slow: 300ms (complex animations)

### Key Animations

#### Page Enter

Fade in + slide up from 8px.

#### Module Slide

Slide in from right (32px) when entering module.

#### Check Pop (Duolingo-style)

Scale 0 → 1.2 → 1 with bounce easing.

#### Success Pulse

Expanding ring glow from center.

#### Hover Lift

translateY(-2px) + shadow upgrade.

#### Stagger Enter

Children animate in sequence with 50ms delay each.

---

## Gradients

### Hero Gradients (Light backgrounds)

```css
/* Emerald (Finyk) */
background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%);

/* Teal (Fizruk) */
background: linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 50%, #99f6e4 100%);

/* Coral (Routine) */
background: linear-gradient(135deg, #fff5f3 0%, #ffe8e3 50%, #ffd4cb 100%);

/* Lime (Nutrition) */
background: linear-gradient(135deg, #f8fee7 0%, #effccb 50%, #dff99d 100%);
```

### Hub Hero

```css
background: linear-gradient(150deg, #fdf9f3 0%, #fefdfb 50%, #f0fdfa 100%);
```

---

## Icons

### Style Guidelines

- Stroke width: 1.6-2px
- Line cap: Round
- Line join: Round
- Size: 16px, 18px, 20px, 22px, 24px

### Recommended Sources

- Lucide Icons (primary)
- Heroicons (alternative)

---

## Accessibility

### Touch Targets

- Minimum: 44x44px for all interactive elements
- Input fields: Minimum 44px height

### Focus States

- Visible ring: 2px brand color at 50% opacity
- Offset: 2px from element

### Color Contrast

- Text on backgrounds: Minimum 4.5 : 1 ratio (WCAG 2.1 AA, § 1.4.3)
- Large text (≥18 px regular **or** ≥14 px bold): Minimum 3 : 1 ratio
- All saturated brand colours (`brand` / `success` / `warning` /
  `danger` / `info` / `finyk` / `fizruk` / `routine` / `nutrition`)
  ship with a `-strong` companion that clears the 4.5 : 1 threshold
  at body sizes. Reach for it whenever the colour appears as text or
  as the fill behind `text-white`. The full mapping lives in
  _Color System → WCAG-AA `-strong` Tier_. A companion ESLint rule
  (`sergeant-design/no-low-contrast-text-on-fill`) is being introduced
  alongside this guide to flag the saturated-tier mistakes statically.
- The `/design` showcase route is gated by axe-core in CI (see
  `apps/web/tests/a11y/axe.spec.ts`) so any primitive that drifts
  back to a saturated `-500` fill behind `text-white` fails the
  pipeline before merge.

### Motion

- Respect prefers-reduced-motion
- No auto-playing animations longer than 5 seconds

---

## Mobile-First Principles

1. **Design for mobile first**, enhance for desktop
2. **Touch-friendly**: Large tap targets, swipe gestures
3. **iOS Safari optimized**: No zoom on inputs (min 16px font)
4. **Safe areas**: Respect notches and home indicators
5. **Performance**: Minimize layout shifts, optimize images

---

## Dark Mode

Full dark mode support with warm undertones:

```css
.dark {
  --c-bg: 23 20 18; /* #171412 — warm dark */
  --c-panel: 32 28 25; /* #201c19 — elevated surface */
  --c-panel-hi: 48 42 37; /* #302a25 — hover / input */
  --c-line: 82 74 65; /* #524a41 — warm border */
  --c-border-strong: 112 102 90; /* #70665a — prominent divider */
  --c-text: 250 247 241; /* #faf7f1 — warm white */
  --c-muted: 180 174 169; /* #b4aea9 — medium warm gray */
  --c-subtle: 135 128 121; /* #878079 — readable tertiary */
}
```

> Contrast intent: `muted` / `subtle` / `line` були підняті після WCAG-аудиту
> (див. PR-серію підняття контрасту темної теми). Dark-mode border тепер
> читається на `--c-panel` ≥3:1, а `--c-subtle` забезпечує ≥4.5:1 на всіх
> поверхнях.

---

## References & Inspiration

### Primary References

- **Duolingo**: Gamification, friendly characters, celebratory animations
- **Yazio**: Clean health data visualization, macro tracking UI
- **Monobank**: Smooth animations, swipe gestures, minimalist fintech

### Design Principles Borrowed

- Duolingo's streak celebrations and progress rings
- Yazio's macro circle visualizations
- Monobank's card interactions and transaction lists

---

## Implementation Notes

### File Locations

- **Tailwind preset (web + mobile)**: `packages/design-tokens/tailwind-preset.js`
- **Raw visual tokens**: `packages/design-tokens/tokens.js`
- **Mobile-only tokens (NativeWind)**: `packages/design-tokens/mobile.js`
- **Global CSS (semantic variables)**: `apps/web/src/index.css`
- **Chart theme (series, palette, gradients)**: `apps/web/src/shared/charts/chartTheme.ts`
- **UI primitives (web)**: `apps/web/src/shared/components/ui/`
- **UI primitives (mobile)**: `apps/mobile/src/components/ui/`

### Key Components

- `Button` - All button variants
- `Card` - Card containers with variants
- `ProgressRing` - Circular progress indicators
- `Badge` - Status pills and tags
- `Input` - Form inputs with states

---

## Native Patterns (iOS / Android)

> Scope: `apps/mobile` only. This section **extends** the existing brand
> identity with native-specific guidance; web look & feel is unchanged —
> same tokens, same palette, same voice. See
> [`react-native-migration.md` §13, Q9](./react-native-migration.md#13-прийняті-рішення-q1q10)
> for the decision that produced this section.

### Safe area & layout

Use `react-native-safe-area-context` (`useSafeAreaInsets()` /
`SafeAreaView`) on every screen. Never hardcode status-bar or home-indicator
paddings.

- **Top inset:** respect on all content screens. Hero gradients and
  full-bleed media may extend under the status bar, but interactive
  content must start below `insets.top`.
- **Bottom inset:** always respect on scroll containers, modals, bottom
  sheets, and sticky CTAs. Primary actions stay above the home indicator.
- **Side insets:** apply on landscape / notched devices; standard page
  padding otherwise.
- **Tab bar / keyboard:** combine `insets.bottom` with the active tab-bar
  height; use `KeyboardAvoidingView` (`padding` on iOS, `height` on Android)
  for forms.

### Native gestures

Gestures are the mobile equivalent of web hover — they are the main way
users signal intent. Enable them deliberately, document them when they
carry destructive meaning.

| Gesture          | Where                                              | Notes                                                              |
| ---------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| Swipe-back (iOS) | All stack screens by default                       | Disable only on destructive flows (delete wizard, unsaved edits).  |
| Pull-to-refresh  | Finyk `Transactions`, Routine calendar, Hub feed   | Use native `RefreshControl`; tie to the module's React Query sync. |
| Long-press       | Transaction row, habit cell, workout item          | Opens contextual menu (edit / duplicate / delete).                 |
| Swipe-to-delete  | Finyk `Transactions`, Routine habits, pantry items | Requires confirm step for items older than today.                  |

See [`hub-modules-roadmap.md`](./hub-modules-roadmap.md) for the per-module
screen list these map onto.

### Haptics

Use `expo-haptics`. Haptics fire on **intent**, not on every touch — no
haptic spam, no haptic on scroll, no haptic on hover-equivalents.

| Feedback                     | When                                                |
| ---------------------------- | --------------------------------------------------- |
| `ImpactFeedbackStyle.Light`  | Selection, toggle, tab switch, segmented control    |
| `ImpactFeedbackStyle.Medium` | Successful save / submit / sync                     |
| `ImpactFeedbackStyle.Heavy`  | Destructive confirm (delete, reset, disconnect)     |
| `NotificationFeedbackType.*` | Toast with semantic meaning (success/warning/error) |

```tsx
// On a save button press handler:
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
await saveTransaction();
```

### Platform-adaptive typography

Mobile inherits the type scale from `@sergeant/design-tokens` (same DM Sans,
same sizes). Platform differences stay at the OS-accessibility layer:

- Respect OS `Dynamic Type` (iOS) and `Font scale` (Android) **up to 1.3×**.
  Above that we clamp to preserve layout of cards, rings, and tables.
- Set `maxFontSizeMultiplier={1.3}` on `Text` primitives; expose it as the
  default on the mobile `Text` component.
- Do **not** branch font sizes by `Platform.OS`. Web typography is unchanged.

### Dark mode

Palette from the [Dark Mode](#dark-mode) section above is canonical.
Mobile simply resolves it from the OS theme:

- Read `useColorScheme()` from React Native; follow system by default.
- Same token names as web (`--c-bg`, `--c-panel`, `--c-text`, …) — only the
  resolved values differ, handled inside `@sergeant/design-tokens`.
- Allow a per-user override in `HubSettings` (system / light / dark), stored
  in MMKV.

### Motion

Use `react-native-reanimated` v3 for all non-trivial animation. Keep
durations aligned with the web scale:

- **150 ms** — micro (toggle, press-in, tab switch). Matches web "fast".
- **250 ms** — page / screen transitions. Matches web "default".
- **400 ms** — modals and bottom sheets (enter); dismiss is ~250 ms.
- Default easing is `easeOutQuad`-like (`Easing.out(Easing.quad)`); the
  Duolingo-style "bounce" pop stays reserved for celebratory moments.
- Respect OS **Reduce Motion** via `useReducedMotion()` — disable
  non-essential animation (parallax, stagger, success pulse), keep only
  functional transitions (e.g. sheet open/close) at reduced amplitude.

### Icons

- **Navigation & tabs:** platform-idiomatic set via `@expo/vector-icons`
  (Apple HIG on iOS, Material on Android) so tab bars feel native.
- **Content icons:** Lucide (matches web) to keep module surfaces visually
  consistent across platforms.
- Keep the stroke/size rules from the [Icons](#icons) section above.

### Forbidden on mobile

Web patterns that don't translate — do not port them to `apps/mobile`:

- **Hover states** — use press-in / focus states instead.
- **Desktop keyboard shortcuts** — no `⌘K`, no global hotkeys.
- **Right-click / context menus** — replace with long-press contextual menu.
- **`position: fixed` floating panels** — replace with bottom sheets
  (`@gorhom/bottom-sheet` or native `Modal`).
- **Tooltips on hover** — if the info is important, make it a tap-target
  with an inline hint; otherwise drop it.

---

_This brandbook is a living document. Update as the design system evolves._
