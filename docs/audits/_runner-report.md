# Audit runner report

> **Last validated:** 2026-06-04 by audits-runner workflow. **Next review:** 2026-09-02.
> **Status:** Reference

Mode: **triage** · Audits triaged: 21 (input payload truncated after audit #11 — Fizruk Part 2; this report synthesizes the 11 fully-delivered triages plus the truncated Fizruk Part 2 tail. See [Blocked](#5-blocked) for the coverage gap.)

## 1. TL;DR

- **Security/correctness first.** The two highest-impact open clusters are the consolidated-audit Theme 7 bug list (health-PII validation, missing internal-API auth, raw-error leak, Sentry-Replay PII, PricingPage open-redirect) and chat F20 PII-bearing backup export. These are `plan-first` / `high` — scope one fix-PR per bug, do not batch.
- **Cheap wins to clear now.** Flip the `2026-05-07` full-app audit Status header to Closed (all 10 items shipped), and apply the autoSafe Fizruk docs items (F1 lifecycle markers, F25 AI-DANGER markers, F41/F48/F49 comment cleanup) — pure docs/comments, zero behavior change.
- **Unblock the UX-roast spine.** PR-0 telemetry shipped, so PR-1a base PIN, PR-2/3/6/7 are unblocked — but PR-7 (permissions overview) gates PR-8/PR-9, and PR-3 gates PR-20/PR-22. Land PR-7 + PR-3 to free the chain.

## 2. Execute now

autoSafe + low-risk, mechanical. None require design.

**2026-05-07 full-app regression UX audit** (recommendation: close-as-stale)
- [ ] full-app#status — `docs/audits/2026-05-07-full-app-regression-ux-audit.md:4` — all 10 follow-ups verified closed in main; flip Status header Active → Closed/Archived (autoSafe, only remaining action).

**page-audit-06 Fizruk Part 1**
- [ ] f06#F1 — `apps/web/src/modules/fizruk/` (FizrukApp.tsx, route.tsx, pages/*, shell/*) — add Hard Rule #10 lifecycle markers (`@lastValidated`/`@status`); pure JSDoc headers, mechanical across ~13 files (autoSafe).
- [ ] f06#F25 — `apps/web/src/modules/fizruk/` (zones near F3/F11/F19/F17) — add AI-DANGER markers on rest-timer / retro-tz / uid / voice-commit zones; pure comments (autoSafe). Caveat: re-locate anchor lines first (closures moved cited code).

**page-audit-07 Fizruk Part 2**
- [ ] f07#F41 — `apps/web/src/modules/fizruk/hooks/useDailyLog.ts` — add `@deprecated` marker on legacy LS journal path (autoSafe). Conditional on the migration actually being planned.
- [ ] f07#F48 — `apps/web/src/modules/fizruk/pages/Body.tsx:20-39` — rewrite/remove the 18-line JSDoc PR-history block (describes history, not code); pure comment (autoSafe).
- [ ] f07#F49 — `apps/web/src/modules/fizruk/pages/Progress.tsx:223-227` — remove orphan diff-history comment block; pure comment (autoSafe).

Note: the remaining ~35 Fizruk Part 2 items (F5-F47 a11y/visual/refactor) are real but **not** autoSafe (markup, className, focus, type-narrowing, refactor) — they belong in batched UI/a11y PRs under [Plan first](#3-plan-first), not here.

## 3. Plan first

Medium/high-risk items needing design, ADR, or a playbook. Sorted by impact (security/correctness → unblockers → polish).

### Security / correctness (high impact)
1. **consolidated#Theme7 — high** — `apps/web` auth/fizruk/routine/strategy/nutrition + Sentry + PricingPage — per-bug fixes: CelebrationModal Enter/Space hijack, forgot-pw prefill, HubReports stale chart, rest-timer end-cue, Measurements health-PII range validation, Strategy missing internalFetch/bearer auth + raw error.message leak, useRoutineReminders empty catch, Sentry Replay no `maskAllText`, PricingPage open-redirect on `checkout.url`. One PR per bug, each verified.
2. **chat03#F20 — high** — `apps/web/src/core/hub/hubBackup.ts`, `HubBackupPanel.tsx` — export ships Better-Auth opaque user IDs + free-form manual-debt PII without redaction/disclosure. Product call: redact userId-shaped fields + "safe export" variant, OR explicit PII disclosure. Touches backup payload contract.
3. **f07#F29 — high** — `useMeasurements.ts`, `useDailyLog.ts:86-88` — dual source-of-truth for weight (Measurements doesn't mirror to Profile biometrics). Domain-invariant violation; audit defers to a separate ADR. **Needs ADR before code.**

### Unblockers (UX-roast spine — PR-0 telemetry now shipped)
4. **uxroast#PR-7 — medium** — `PrivacySection.tsx`, `NotificationsSection.tsx`, fizruk/nutrition reminder storage — permissions overview + dedupe permission toasts + default reminder times. **Blocks PR-8 and PR-9** — highest unblock value.
5. **uxroast#PR-3 — low** — `HubDashboard.tsx`, `ModuleBentoCard.tsx`, i18n — bento empty-only subtitles. **Prereq for PR-20 and PR-22.**
6. **uxroast#PR-2 — low** — 4 module headers + `ModuleHeader.tsx` — settings gear-icon deep-link shortcut. UI wiring + snapshot updates.
7. **uxroast#PR-6 — low** — `HubReports.tsx` + new `EmptyStateIllustrations` — Reports EmptyState with illustration + CTA across 4 cards.
8. **uxroast#PR-8 — medium** — `NotificationsSection.tsx`, `hubPrefs.schema.ts/.ts` — Hub notifications sub-group (digest/nudge/re-engagement). Depends on PR-7; gates server-side push delivery.
9. **uxroast#PR-9 — medium** — new `TimeInput.tsx`, nutrition `hh:mm` migration — reminder-time unification + stored-prefs schema migration. Depends on PR-7.
10. **uxroast#PR-1b — high** — new `BiometricAdapter.ts` (+.web/.capacitor), AppLock, capacitor.config — biometric add-on. Security-sensitive (auth/unlock + native plugin + WebAuthn). Base PIN (PR-1a) already shipped.

### CI-gate / lint expansions (consolidated + page audits — design-gated)
11. **consolidated#Theme2 — medium** — touch-target enforcement: global Button as only path + codemod `<button class="w-6 h-6">` + ESLint sub-floor rule (6 high + ~12 medium a11y).
12. **consolidated#Theme3 — medium** — Tailwind token violations: `text-error`→`text-danger` (renders no color), kill raw -400/-500 + foreign accents + eslint rejection + CI map gate.
13. **consolidated#Theme5 — low** — Hard Rule #2: inline queryKey arrays + raw LS strings → factories + `no-inline-query-key`/`no-raw-storage-key` rules + codemod. Changes cache identity / LS migration.
14. **consolidated#Theme6 — medium** — Hard Rule #19: `no-non-null-assertion: error` + replace `!` sites with guards. Will fail repo-wide until all sites resolved.
15. **consolidated#Theme4 — low** — promote `lint:lifecycle-markers` advisory → required gate + one-time bulk header backfill (mutates hundreds of files).
16. **uxroast#PR-X1 — medium** — new `no-english-toast-string` ESLint rule. False-positive risk; needs fixture testing before CI enable.
17. **f01#F1-followup / f02#F1 — low/medium** — `sergeant-design/known-color-tokens` rule + sweep remaining hardcoded LS keys (ExpensesCard/NutritionCard/RoutineCard `:201`, searchSources) onto STORAGE_KEYS + `no-restricted-syntax` guard. LS-migration path.

### Perf / observability
18. **chat03#F16 — medium** — `searchSources.ts`, `searchCache.ts` — LRU(query→ScoredHits) to stop full re-score per keystroke (Android typing lag). Needs snapshot/version key decision.
19. **uxroast#PR-22 — medium** — `HubDashboard.tsx`, finyk `Overview.tsx`, new `useInViewport.ts` — lazy Insights/Digest + sub-card split (LCP/bundle). Must not double-wrap lazy boundaries. Depends on PR-3, PR-20.
20. **uxroast#PR-25 — medium** — `sentry.ts`, `analytics.ts`, App boot — defer PostHog/Sentry via dynamic import after `window.load`. Risk of dropped early events.
21. **f06#F20 — medium** — `FizrukApp.tsx:7`, `useExerciseCatalog.ts` — defer eager catalog payload off Dashboard mount. Validate vs Lighthouse gate.
22. **uxroast#PR-42 — medium** — chat usage counter + `GET /api/chat/usage`. Money/plan-gating path (Free 5/day vs Pro); ADR-0051 2-tier drift noted.

### a11y / phishing / UX (chat03 + page audits)
23. **chat03#F21 — medium** — `InlineAiRail.tsx`, `AssistantMessageBody.tsx` — route user-sourced text through plain-text escaper (markdown-spoof phishing surface; not XSS).
24. **chat03#F17/F19/F23/F24/F25 — low** — initial-message re-fire guard, aria-live status sibling + aria-busy, ChatEmpty stale modules, InlineAiRail focus-theft, TypingIndicator reduced-motion. Small behavior changes, each needs targeted QA.
25. **f02#F4/F7 — low** — HubReports Prev/Next 32x32 < 44x44 touch target; insights missing period chip.
26. **f06#F5/F13/F17/F26 — low/medium** — load-bearing eslint-disable removal, HeroCard visibilitychange tick, voice-input two-step draft confirm (highest-frequency mutation surface), per-page Suspense + startTransition.
27. **f07 a11y/visual batch — low/medium** — F8/F9/F10/F12/F13/F14/F15/F17/F27/F34/F35/F37/F39/F42/F43/F44/F45/F46/F47 (touch targets, chart tokens, labels, radiogroup semantics, focus rings, plural, aria). Batch by surface (Measurements / Progress / Body / Programs).
28. **f07 refactor batch — medium** — F20 (Progress 591/600 LOC decompose), F21 (Body 514 LOC extract form), F26/F30/F32/F33 type/sort/deps cleanup. Hard Rule #18 module-size; design-first.

### Finyk
29. **f05#F19 — medium** — `AssetsForm.tsx` — Asset/Debt/Receivable required-field validation + useApiForm+zod. **Decision-gated on the useApiForm+zod rollout** (its closure note). Money/data-persistence path.
30. **f05#F21 — medium** — `budgets/Budgets.tsx:226-250` — StrictMode-fragile deep-link highlight-scroll; merge 3 effects + ref-guard + aria-live + parent-clear contract.

### Tests (large, test-only, not autoSafe)
31. **chat03#F22, f02#F23, f05#F20, f06#F6, f07#F5, f07#F31 — low/medium** — coverage gaps on highest-regression-prone files (chat sessions/undo/migration, HubReports UI, finyk shells+hooks, fizruk pages, BUILTIN_PROGRAMS integrity). Recommend a standalone test-initiative ticket; needs MSW/fake-timer harness.
32. **uxroast#PR-X2 — medium** — Playwright FTUX visual-regression (8 goldens). Flaky risk; depends on PR-3/6/20.

### IA / structural / tooling
33. **uxroast#PR-16 — medium** — Memory Bank → Settings·Асистент + Profile teaser + hash deep-link backward-compat (`#settings-memory`).
34. **uxroast#PR-14 — low** — extract shared `requestId.ts` + copy-ID UI in ModuleErrorBoundary.
35. **uxroast#PR-19/PR-24/PR-35 — low** — aria-live conflict ordering, mobile 100dvh + safe-area (needs iOS Safari QA), move SW diagnostics into Experimental.
36. **deadcode#P1.1 / #P1.3 — medium** — knip residual (`@capacitor/ios` in mobile-shell, 10 unused devDeps each needing per-workspace verify; 38 hoisted false-positives) + 77 unused exports / 51 duplicates (>30 files, deep-import-caller verify). Batch into 3-4 PRs by surface.
37. **doc-hygiene#scripts / #ci-alias / #hard-rules.md — low** — resolve `scripts/vitest.mjs` orphan (prove external use or delete), add `scripts/ci/test` alias in package.json, decide whether `docs/governance/hard-rules.md` full-text deliverable is still wanted (premise largely stale — AGENTS.md already trimmed; may close instead).
38. **f04 (Hub Settings/Profile/Assistant Catalogue) — medium** — entire page surface has **zero audit coverage** (VM infra failure blocked the child session). Re-run the static analysis as a fresh audit (see Blocked).
39. **uxroast#PR-X4 — low** — PostHog UX-roast dashboard-as-code JSONL artifact (config-as-code, so not pure docs).

## 4. Close as stale

- **`2026-05-07-full-app-regression-ux-audit.md`** — recommendation `close-as-stale`. All 10 follow-up queue items verified closed in main; the only action is the autoSafe Status flip (see [Execute now](#2-execute-now)). Residual `/_vercel/insights/script.js` MIME noise is local-tooling console noise only (CSRF half verified exempt at `requireCsrfHeader.ts:73`); may already be resolved — verify opportunistically, do not block.
- **`2026-05-13-dead-code-hard-rules-roast.md`** — not formally close-as-stale (recommendation `plan-first`) but nearly drained: only P1.1 + P1.3 remain (item 36 above); the rest shipped. Treat the audit body as mostly closed.

## 5. Blocked

- **Input payload truncated.** The triage JSON cut off mid Fizruk Part 2 (audit #11 of the stated 21). Audits #12-21 (likely page-audit-08-nutrition, -09-routine-strategy, -10-errors-pwa-marketing, and the remaining roasts present on disk) were **not** in this run's input, so their open items are not represented above. Re-run the runner with the full payload to cover them.
- **f04 audit gap (consolidated#Scope04).** Hub Settings / Profile / Assistant Catalogue surface has zero findings — hard-blocked by a Devin VM infra failure (missing `/opt/.devin/.realproxy-addr`). Needs an audit **re-run** before its open items can be triaged (item 38).
- **f01#F4 deletion is time-gated.** `PermissionsPrompt.tsx` + `.test.tsx` carry `@deprecated` with a hard removal date of **2026-07-15**; today is 2026-06-04, so the ~6-week window has NOT elapsed. Deletion is safe only after 2026-07-15.
- **uxroast#PR-11 (CSV export) + #PR-28 (avatar upload) — paused on S3/R2 credentials.** New server modules + DB migrations (045/046) + object storage. Skeletons possible but not shippable until object-storage creds exist.
- **f05#F19 — decision-gated** on the useApiForm+zod rollout direction (its own closure note).
- **consolidated#Theme7 status fidelity** — GitHub fetch was disallowed during triage; per-bug shipped/open status was inferred from in-tree repo state, not the cross-referenced PRs #2744-#2799. Re-confirm each bug against live code before opening a fix-PR.
