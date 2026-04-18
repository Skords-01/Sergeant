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

- Background: Brand emerald (#10b981)
- Text: White
- Hover: Darker shade + subtle glow
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

Pill-shaped status indicators:

- Success: Emerald background
- Warning: Amber background
- Danger: Red background
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

- Text on backgrounds: Minimum 4.5:1 ratio
- Large text (>18px): Minimum 3:1 ratio

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
  --c-bg: 23 20 18; /* Warm dark */
  --c-panel: 32 28 25; /* Elevated surface */
  --c-panel-hi: 41 36 32; /* Hover state */
  --c-line: 58 52 46; /* Borders */
  --c-text: 250 247 241; /* Warm white */
  --c-muted: 168 162 158; /* Medium gray */
  --c-subtle: 87 83 78; /* Dimmed */
}
```

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

- **Tailwind Config**: `/tailwind.config.js`
- **Global CSS**: `/src/index.css`
- **Color Palette**: `/src/modules/finyk/constants/chartPalette.js`
- **Module Themes**: `/src/shared/lib/moduleThemes.js`
- **UI Components**: `/src/shared/components/ui/`

### Key Components

- `Button` - All button variants
- `Card` - Card containers with variants
- `ProgressRing` - Circular progress indicators
- `Badge` - Status pills and tags
- `Input` - Form inputs with states

---

_This brandbook is a living document. Update as the design system evolves._
