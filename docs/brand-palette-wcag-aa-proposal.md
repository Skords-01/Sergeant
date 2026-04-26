# Brand palette → WCAG AA — proposal

> **Status:** Proposal. No tokens are changed by this PR — this document
> is the design contract that the implementation PR will follow.
>
> **Last reviewed:** 2026-04-26. Reviewer: @Skords-01
>
> **Driver:** PR [#851](https://github.com/Skords-01/Sergeant/pull/851)
> dropped `/design` (DesignShowcase) from the axe-core SURFACES list; PR
> [#852](https://github.com/Skords-01/Sergeant/pull/852) cleaned up four of
> the five rule families that were tripping. The remaining
> `color-contrast` (60 nodes, serious) is intrinsic to the brand palette
> and is the subject of this proposal. Fixing it re-enables `/design` in
> the axe-core gate.
>
> **Out of scope:** chart palettes, typography, motion, dark-mode work
> (the dark theme already passed an audit in late 2025 — see
> [`docs/BRANDBOOK.md`](./BRANDBOOK.md#dark-mode)).

---

## TL;DR

The Sergeant brand palette uses mid-saturation greens (`emerald-500`,
`teal-500`, `lime-500`), warm coral (`coral-500`), and amber (`amber-500`)
as **both** background-fill colours **and** text colours. All of these
fail WCAG 2.1 AA at 14 px regular / 18 px bold:

| Token                         | Hex       |    On `text-white` | On `bg-bg` (`#fdf9f3`) |
| ----------------------------- | --------- | -----------------: | ---------------------: |
| `brand` / `success` / `finyk` | `#10b981` |     **2.54 : 1** ✗ |         **2.42 : 1** ✗ |
| `fizruk`                      | `#14b8a6` |     **2.49 : 1** ✗ |         **2.37 : 1** ✗ |
| `nutrition`                   | `#92cc17` |     **1.93 : 1** ✗ |         **1.84 : 1** ✗ |
| `routine`                     | `#f97066` |     **2.79 : 1** ✗ |         **2.66 : 1** ✗ |
| `warning`                     | `#f59e0b` |         2.15 : 1 ✗ |                      — |
| `info`                        | `#0ea5e9` |         2.77 : 1 ✗ |         **2.64 : 1** ✗ |
| `danger`                      | `#ef4444` |     **3.76 : 1** ✗ |             3.59 : 1 ✗ |
|                               |           | **req: ≥ 4.5 : 1** |                        |

(All ratios computed with the WCAG 2.1 § 1.4.3 luminance formula — the
same one axe-core uses. Cross-checked against the
[WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/).)

The proposal is **not** to retune the brand palette itself — that would
break visual identity and a year of marketing assets. Instead, formalize
a two-token tier per brand colour:

- **The brand colour** (what it is today) — `bg-{brand}`, decorative
  fills, icons, large-text headlines (≥ 18 px bold).
- **A `-strong` companion** — `text-{brand}-strong`, `bg-{brand}-strong`,
  the WCAG-AA pair used wherever the brand colour appears as
  _body-sized text_ or pair with `text-white` on a saturated solid.

A scaffolding for `-strong` already exists for the four module colours
(`text-finyk-strong`, `text-fizruk-strong`, `text-routine-strong`,
`text-nutrition-strong` — see
[`packages/design-tokens/tailwind-preset.js`](../packages/design-tokens/tailwind-preset.js)).
This proposal extends the same convention to `brand` / `success` /
`warning` / `danger` / `info` / `accent`, codifies _when_ to use which,
and lints violations with a new ESLint rule.

---

## 1. Problem statement

### 1.1 What axe is flagging on `/design`

After PR #852, `/design` reports exactly one axe rule:

```
[serious] color-contrast: 60 node(s)
TOTAL: 1 unique rule
```

Categorizing those 60 nodes:

| Pattern                                                            | Example token combo          | Nodes |
| ------------------------------------------------------------------ | ---------------------------- | ----: |
| Saturated solid + `text-white` (Buttons, solid Badges, solid Tabs) | `bg-brand text-white`        |   ~24 |
| Brand-coloured _text_ on the page surface (`bg-bg` cream)          | `text-finyk` on `#fdf9f3`    |   ~22 |
| Soft pill: tinted bg + brand fg (`bg-{c}-soft text-{c}`)           | `bg-danger-soft text-danger` |   ~10 |
| Statistic numerals in module colour                                | `text-success` 24 px bold    |    ~4 |

These four patterns map 1:1 onto the four primitives that compose
nearly every screen: **Button (solid)**, **Badge (solid + soft)**,
**Tabs (pill style)**, **Stat / numeric callouts**.

### 1.2 Why the gap exists

The palette in
[`packages/design-tokens/tokens.js`](../packages/design-tokens/tokens.js)
was tuned for visual harmony, inspired by Duolingo / Yazio / Monobank —
those products lean on the `-500` step the same way Sergeant does, but
they consistently pair it with **bold ≥ 18 px** copy or with a darker
text-on-color pair we don't currently expose as a Tailwind utility.

[`docs/BRANDBOOK.md` § Color Contrast](./BRANDBOOK.md#color-contrast)
already states the rule (`Text on backgrounds: Minimum 4.5:1 ratio`) —
but the _tokens_ don't carry it. There is no lint or test that ties the
written rule to the emitted utilities. So the rule has drifted in
practice for ~12 months.

### 1.3 What "fix the palette" must NOT break

- **Visual identity.** The emerald / teal / coral / lime brand pairing
  is on the splash screen, App Store screenshots, the marketing site,
  the Capacitor shell icon, and weekly digest emails. Changing the
  `-500` hex breaks all of that.
- **Snapshot tests.** [`packages/design-tokens/tokens.test.js`](../packages/design-tokens/tokens.test.js)
  pins `brandColors` and `statusColors` shape via Jest snapshots; mobile
  consumes the same flat hex map. Any change to `tokens.js` ripples
  through `apps/mobile`, `apps/mobile-shell` and the canonical web SPA.
- **Existing dark-mode work.** Dark theme passed an audit (see the note
  in BRANDBOOK). We must not regress it while raising light-mode
  contrast.

The constraint shape is therefore **add tokens, do not mutate**.

---

## 2. Proposal

### 2.1 Add a `-strong` text/fill tier to every brand colour

The four module colours already have a `strong` field on the
`semanticVariants` block in
[`tailwind-preset.js`](../packages/design-tokens/tailwind-preset.js)
(lines 119–124 for `finyk`, identical pattern for the rest). Today
those are populated with `brandColors.{family}[700]` for `finyk` /
`fizruk` / `routine` and `brandColors.lime[800]` for `nutrition`
(lime-700 was too thin a margin against the cream `bg-bg`, see
§ 2.1 below), and exposed as `text-finyk-strong`, etc. They are used
by soft Badge variants (`bg-finyk-soft text-finyk-strong
border-finyk-ring/50`) and in `StatCard` headlines.

Extend the convention to the other six tokens:

```js
// packages/design-tokens/tailwind-preset.js — proposed addition
brand: {
  DEFAULT: brandColors.emerald[500], //   #10b981
  strong:  brandColors.emerald[700], //   #047857   — text on cream
  light:   brandColors.emerald[400],
  dark:    brandColors.emerald[600],
  subtle:  brandColors.emerald[50],
  soft:    "rgb(var(--c-success-soft) / <alpha-value>)", // #d1fae5
  ...brandColors.emerald,
},

success:        statusColors.success,           // unchanged: #10b981
"success-strong": brandColors.emerald[700],     // NEW: #047857
"success-soft":   "rgb(var(--c-success-soft) / <alpha-value>)",
"success-on":     "#ffffff",                    // NEW: paired text-on-fill

warning:        statusColors.warning,           // unchanged: #f59e0b
"warning-strong": "#b45309",                    // NEW: amber-700
"warning-soft":   "rgb(var(--c-warning-soft) / <alpha-value>)",
"warning-on":     "#ffffff",                    // text-on-fill paired with -strong

// danger / info / accent: same shape
```

Computed contrast at 14 px regular against the cream `--c-bg`
(`#fdf9f3`):

| Token                   | Hex                     | Ratio on `bg-bg` | WCAG AA 14 px |
| ----------------------- | ----------------------- | ---------------: | ------------- |
| `text-success-strong`   | `#047857` (emerald-700) |     **5.23 : 1** | ✓ Pass        |
| `text-fizruk-strong`    | `#0f766e` (teal-700)    |     **5.22 : 1** | ✓ Pass        |
| `text-routine-strong`   | `#c23a3a` (coral-700)   |     **5.06 : 1** | ✓ Pass        |
| `text-nutrition-strong` | `#466212` (lime-800)    |     **6.64 : 1** | ✓ Pass        |
| `text-warning-strong`   | `#b45309` (amber-700)   |     **4.83 : 1** | ✓ Pass        |
| `text-danger-strong`    | `#b91c1c` (red-700)     |     **6.17 : 1** | ✓ Pass        |
| `text-info-strong`      | `#0369a1` (sky-700)     |     **5.66 : 1** | ✓ Pass        |

And `text-white` against the corresponding `bg-{c}-strong` solid — the
other half of the symmetric pair, used by `Button` / `Badge` solid
tones:

| Pair                                              |        Ratio | WCAG AA 14 px |
| ------------------------------------------------- | -----------: | ------------- |
| `text-white` on `bg-success-strong` (emerald-700) | **5.48 : 1** | ✓ Pass        |
| `text-white` on `bg-fizruk-strong` (teal-700)     | **5.47 : 1** | ✓ Pass        |
| `text-white` on `bg-routine-strong` (coral-700)   | **5.30 : 1** | ✓ Pass        |
| `text-white` on `bg-nutrition-strong` (lime-800)  | **6.96 : 1** | ✓ Pass        |
| `text-white` on `bg-warning-strong` (amber-700)   | **5.02 : 1** | ✓ Pass        |
| `text-white` on `bg-danger-strong` (red-700)      | **6.47 : 1** | ✓ Pass        |
| `text-white` on `bg-info-strong` (sky-700)        | **5.93 : 1** | ✓ Pass        |

All seven `-strong` tokens land comfortably above the 4.5 : 1 floor.
`nutrition-strong` is the only family that _isn't_ `[700]` — the
existing preset already bumped it to `lime-800` (`#466212`) because
`lime-700` (`#567c0f`) only clears 4.67 : 1 on cream, well below the
5–6 : 1 headroom the other modules enjoy. The implementation PR
_keeps_ the lime-800 choice as-is. The other six tokens (success /
warning / danger / info / brand / accent) follow the `[700]`
convention. Numeric callouts (≥24 px bold) clear the WCAG AA 3 : 1
large-text rule at any of these tiers.

### 2.2 Component-level usage rules

| Component               | Tone                                | Today                                                                           | Proposed                              |
| ----------------------- | ----------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------- |
| `Button`                | `solid`                             | `bg-{c} text-white`                                                             | `bg-{c}-strong text-white` (≥4.5:1)   |
| `Button`                | `soft`                              | already `bg-{c}-soft text-{c}` ✗                                                | `bg-{c}-soft text-{c}-strong` ✓       |
| `Button`                | `outline`                           | `border-{c} text-{c}` ✗                                                         | `border-{c} text-{c}-strong` ✓        |
| `Badge`                 | `solid`                             | `bg-{c} text-white` ✗                                                           | `bg-{c}-strong text-white` ✓          |
| `Badge`                 | `soft`                              | already `text-{c}-strong` for module variants; `text-{c}` for status variants ✗ | unify on `text-{c}-strong` ✓          |
| `Badge`                 | `outline`                           | `border-{c}/60 text-{c}` ✗                                                      | `border-{c}/60 text-{c}-strong` ✓     |
| `Tabs`                  | `pill` active                       | `bg-{c} text-white` ✗                                                           | `bg-{c}-strong text-white` ✓          |
| `Tabs`                  | `pill` active text-only (underline) | `text-{c}` ✗                                                                    | `text-{c}-strong` ✓                   |
| `Banner`                | `success` / `warning` / `danger`    | (fixed in #852)                                                                 | unchanged                             |
| `StatCard`              | numeric headline (≥ 18 px **bold**) | `text-{c}`                                                                      | **keep** — passes 3:1 large-text rule |
| `Icon` glyphs (≥ 24 px) | decorative                          | `text-{c}`                                                                      | **keep** — non-text element           |

The "keep" rows matter: the WCAG **non-text-element** clause (3:1) and
the **large-text** clause (3:1 at 24 px / 18.66 px bold) admit the
brand colour at full saturation. The proposal preserves the brand
colour wherever it visually wins and the contrast spec allows it; it
introduces `-strong` only at _body-text_ sizes where AA fails.

### 2.3 Migration plan (one PR each, in order)

1. **`design-tokens` PR** — add `*-strong` and `*-soft` keys to
   `tailwind-preset.js`, register the new utility names in
   `packages/eslint-plugin-sergeant-design`'s allow-list, regenerate the
   `tokens.test.js.snap`, document in `BRANDBOOK.md`. **No consumer
   changes.** Visual diff: zero, because nothing uses the new tokens
   yet.
2. **`web` PR — primitives** — flip `Button`, `Badge`, `Tabs`
   solid/soft/outline variants to use `-strong`. `pnpm vitest` in
   `apps/web/src/shared/components/ui` is the regression net.
3. **`web` PR — `/design` re-add** — add `/design` back to
   `apps/web/tests/a11y/axe.spec.ts` `SURFACES`. Drop the multi-line
   "intentionally NOT in this list" doc comment in favour of a one-line
   note (`/design` again gates primitives at the showcase level — same
   intent as commit `8e9d8833`).
4. **`mobile` PR** — mirror the same `-strong` pairs in the NativeWind
   preset (mobile.js consumes the same `brandColors`; needs an
   equivalent flat-hex export). Run `apps/mobile` snapshot tests.
5. **`docs` PR** — extend `BRANDBOOK.md § Color Contrast` with the table
   above and a "when to use `-strong` vs `-DEFAULT`" decision matrix.

Steps 1–3 are mergeable independently of 4–5 and unblock the `/design`
axe gate immediately. Steps 4–5 close the loop on cross-platform
parity.

### 2.4 The `warning` edge case (and why it stays symmetric)

First-pass instinct on `warning` was to break the `bg-{c}-strong
text-white` symmetry and use a _dark text on amber-500_ pair (Apple /
Material pattern). Measured numbers say no — amber-500 is the wrong
base to put body text on:

- `bg-warning text-white` (`#f59e0b` + white) → **2.15 : 1** ✗
- `bg-warning text-amber-900` (`#f59e0b` + `#78350f`) → **4.22 : 1** ✗ (still under AA body)
- `bg-warning text-amber-950` (`#f59e0b` + `#451a03`) → 6.97 : 1 ✓ but
  visually almost-black-on-amber, looks broken

Vs. the symmetric `-strong` solid:

- `bg-warning-strong text-white` (`#b45309` + white) → **5.02 : 1** ✓

So the proposal _keeps_ the symmetric pattern: `warning` solids are
`bg-warning-strong text-white` (amber-700 + white), same shape as the
other six tokens. Where the _amber-500_ fill is essential (e.g. a
decorative tag block, an iOS-style status indicator), restrict it to
large text (≥18.66 px bold) where the 3 : 1 large-text rule kicks in
— same exception that already governs `StatCard` numeric callouts.

### 2.5 Lint enforcement

Add a `sergeant-design/no-low-contrast-text-on-fill` ESLint rule (or
extend `valid-tailwind-opacity`) that flags any class string matching
`bg-{c} text-white` where `{c}` is one of the seven brand /
status keys, suggesting `bg-{c}-strong text-white` (or
`text-{c}-strong` for the warning case). The rule is `warn` for the
cross-PR migration, then promoted to `error` after step 3 lands.

A complementary lint or visual-regression check can be added in
`apps/web/src/shared/components/ui/*.test.tsx` so primitive snapshots
fail if a saturated `bg-{c}` reappears with body-sized text.

---

## 3. Why not alternative X?

**Re-tune the brand palette itself.** Considered and rejected — see
§ 1.3. The visual identity is too widely distributed and a year of
marketing assets would need to follow.

**Add a `forcedColors` / `prefers-contrast: more` override only.**
Solves WCAG AA only for users who _opt in_ via OS-level high-contrast
preference. Doesn't fix the default rendering, doesn't satisfy axe in
CI, and doesn't help the median user.

**Increase font-weight to `bold` on every saturated solid.** WCAG AA
relaxes to 3 : 1 only at ≥ 18.66 px bold. Buttons / badges are
typically 12–14 px — bumping to bold raises baseline contrast slightly
but doesn't clear AA, and visually shouts on small pills.

**Drop saturation across the palette ("muted" rebrand).** This _is_
the alternative if the design team wants to revisit the brand. It's a
larger conversation; this proposal is the minimum-disruption path that
reconciles WCAG AA with the existing identity.

---

## 4. Open questions

1. **Should `text-white` on `bg-{c}-strong` become the default for the
   `solid` Button tone, or should we expose both `solid` (mid-sat,
   visually punchy, large-text only) and `solid-strong` (AA-safe, body
   text)?** Recommendation: just one — `solid = bg-strong + text-white`,
   matching how the rest of the design system maps "solid" to
   "high-emphasis". Body designers who specifically want the punchier
   shade can fall back to `bg-{c}` directly with a code comment.
2. **`accent` token.** `accent = #10b981` today (alias of `success`).
   Should it move to a distinct hue (e.g. `violet-500`) to recover the
   pre-#833 tonal contrast in modules where Finyk + accent appear
   together? Outside the WCAG scope — flag for design review separately.
3. **Mobile parity timeline.** Mobile is currently in beta; can step 4
   slip to the next mobile release window without violating any
   in-flight a11y commitment? Recommendation: yes; web is the AA gate
   that ships first.

---

## 5. References

- [`packages/design-tokens/tokens.js`](../packages/design-tokens/tokens.js)
  — raw palette source.
- [`packages/design-tokens/tailwind-preset.js`](../packages/design-tokens/tailwind-preset.js)
  — `*-strong` precedent at `finyk` / `fizruk` / `routine` / `nutrition`.
- [`docs/BRANDBOOK.md` § Color Contrast](./BRANDBOOK.md#color-contrast).
- [`apps/web/tests/a11y/axe.spec.ts`](../apps/web/tests/a11y/axe.spec.ts)
  — gate that this proposal lets us re-arm.
- WCAG 2.1 § 1.4.3 Contrast (Minimum) — AA: 4.5 : 1 body / 3 : 1 large.
- PR [#851](https://github.com/Skords-01/Sergeant/pull/851) — drop
  `/design` from SURFACES.
- PR [#852](https://github.com/Skords-01/Sergeant/pull/852) — Tabs /
  Banner / Select primitive a11y polish.
