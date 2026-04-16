# Hub — Replit Setup

## Overview
A personal hub app with React + Vite frontend and an Express API backend, running as a single unified process on Replit. Includes email/password authentication (Better Auth) and cloud sync via PostgreSQL.

## Architecture
- **Frontend**: React 18 + Vite, built to `dist/`
- **Backend**: Express.js serving API routes under `/api/*`
- **Database**: PostgreSQL (Replit built-in) — stores users, sessions, and per-module JSON data blobs
- **Auth**: Better Auth with email/password, session cookies, cookie caching
- **Unified server**: `server/replit.mjs` serves both the built frontend and the API on port 5000

## Running the App
The workflow `Start application` runs `npm run start:replit` which executes `server/replit.mjs`.

For production build the frontend first:
```
npm run build
npm run start:replit
```

For local Vite dev server (with proxy to Express):
```
npm run start         # Express API on port 3000 (railway.mjs)
npm run dev           # Vite dev server on port 5173 (proxies /api to 3000)
```

## Key Files
- `server/replit.mjs` — Unified server for Replit (frontend + API, port 5000)
- `server/railway.mjs` — API-only server for Railway deployment (port 3000)
- `server/auth.js` — Better Auth configuration (email/password, PostgreSQL adapter, session settings)
- `server/db.js` — PostgreSQL connection pool
- `server/api/sync.js` — Cloud sync endpoints (push/pull per-module data)
- `server/api/` — API route handlers
- `server/api/lib/cors.js` — CORS config (includes Replit domains via REPLIT_DOMAINS env var)
- `vite.config.js` — Frontend build config with /api proxy
- `src/core/authClient.js` — Better Auth React client
- `src/core/AuthContext.jsx` — AuthProvider + useAuth hook
- `src/core/useCloudSync.js` — Cloud sync hook (auto-push on data changes, manual pull)
- `src/core/AuthPage.jsx` — Login/Register UI

## Environment Variables / Secrets
| Key | Required | Description |
|-----|----------|-------------|
| `DATABASE_URL` | Yes (auto) | PostgreSQL connection string (auto-set by Replit) |
| `BETTER_AUTH_SECRET` | Yes | Auth encryption secret (32+ chars) |
| `ANTHROPIC_API_KEY` | Yes | Claude AI API key for chat features |
| `NUTRITION_API_TOKEN` | No | Nutritionix API token |
| `ALLOWED_ORIGINS` | No | Extra CORS origins (comma-separated) |
| `VITE_API_BASE_URL` | No | Frontend API base URL (leave empty for relative paths) |
| `VITE_NUTRITION_API_TOKEN` | No | Nutritionix token for direct frontend requests |

## Auth & Sync System
- **Better Auth** handles email/password registration and login at `/api/auth/*`
- Session cookies with 30-day expiry, daily refresh, 5-minute cookie cache
- `module_data` table stores JSON blobs per user per module with version tracking
- Sync endpoints: `POST /api/sync/push`, `POST /api/sync/pull`, `POST /api/sync/push-all`, `POST /api/sync/pull-all`
- All auth/sync client calls routed through `apiUrl()` for cross-origin Railway/Vercel deployment support
- Client-side `useCloudSync` hook features:
  - Auto-pushes localStorage data on storage changes (5s debounce) and 2-minute periodic interval
  - **First-login migration UX**: prompts user to upload local data or skip when logging in for the first time with existing local data
  - **Offline sync queue**: queues push operations in localStorage when offline, replays on reconnect (`online` event)
  - **Per-module version tracking**: each module blob has an incrementing `version` column; client tracks per-user/per-module versions for deterministic LWW conflict resolution
  - Migration state persisted per-user in `hub_sync_migrated_users` localStorage key
  - Cross-account safety: resets initial sync state when user identity changes
- Auth is optional — app works without login, but logged-in users get cloud backup and cross-device sync
- User account menu in hub header shows sync status, manual push/pull buttons, and logout

## Database Schema
- `user` — Better Auth user table (id, email, name, etc.)
- `session` — Better Auth session table
- `account` — Better Auth account/credentials table
- `verification` — Better Auth email verification table
- `module_data` — Per-user per-module JSON data (user_id, module, data JSONB, version INTEGER, timestamps)

## Shared UI System (`src/shared/`)
- **ToastProvider + useToast** (`src/shared/hooks/useToast.jsx`) — Global toast notification context with `success`, `error`, `info`, `warning` methods
- **ToastContainer** (`src/shared/components/ui/Toast.jsx`) — Animated toast renderer, mounted in App.jsx
- **InputDialog** (`src/shared/components/ui/InputDialog.jsx`) — Bottom-sheet style text input dialog (replaces `window.prompt`)
- **ConfirmDialog** (`src/shared/components/ui/ConfirmDialog.jsx`) — Bottom-sheet confirmation dialog (replaces `window.confirm`)
- All `window.alert/prompt/confirm` calls removed across all modules (Finyk, Fizruk, Routine, Nutrition)
- Page crossfade animation (`page-enter` CSS class) applied on module transitions in App.jsx

## PWA & Service Worker
- **vite-plugin-pwa** with `injectManifest` strategy and custom SW source (`src/sw.js`)
- All build assets are precached; `NavigationRoute` with network-first fallback to `/index.html`; `/api/*` denied
- Google Fonts cached with `CacheFirst` strategy for offline use
- **Manifest**: `public/manifest.json` with 3 PWA shortcuts (add expense, start workout, add meal)
- SW registration in `src/main.jsx` using `virtual:pwa-register` with `prompt` registerType
- Update detection: `pwa-update-ready` custom event → "new version" banner in Hub view
- Offline-ready notification via `pwa-offline-ready` custom event → toast
- Install banner (`usePwaInstall` in `App.jsx`) delays until 2+ sessions AND 30s engagement; dismiss persisted
- **Routine reminders in SW**: Client sends `ROUTINE_STATE_UPDATE` messages to SW; SW runs its own 30s `setInterval` to check habits and fire `showNotification()` even when tab is backgrounded
- SW also handles `notificationclick` to focus/reopen the app
- **PWA Shortcuts deep-link routing**: `?module=X&action=Y` URL params route to the correct module and trigger the relevant entry action (add_expense → Finyk Assets, start_workout → Fizruk workouts, add_meal → Nutrition add meal sheet)

## Smart Features (Task 9)
- **Recommendation Engine** (`src/core/lib/recommendationEngine.js`) — Rule-based cross-module recommendations: budget overruns, muscle group rest gaps, habit streaks, post-workout protein reminders, etc. No AI API required.
- **HubRecommendations** (`src/core/HubRecommendations.jsx`) — Dismissable recommendation feed shown on the hub dashboard above the module cards. Shows top 3 initially, expandable.
- **Voice Input** (`src/shared/components/ui/VoiceMicButton.jsx`) — Shared microphone button using Web Speech API. Gracefully hidden when unsupported. Integrated in:
  - `AddMealSheet` (Nutrition): parses "гречка 200 грам 180 ккал" → fills name, kcal, protein fields
  - `ActiveWorkoutPanel` (Fizruk): parses "bench press 80 кг 8 повторень" → adds a new set
  - `Assets` (Finyk): parses "кредит 5000 гривень" → fills debt name + amount
- **Speech parsers** (`src/core/lib/speechParsers.js`) — Dedicated parsers for expense, workout set, and meal speech input in Ukrainian and English.

## Hub Settings Page (`src/core/HubSettingsPage.jsx`)
A centralized "Налаштування" tab on the hub page (third tab alongside "Головна" and "Звіти") consolidating all module settings:
- **Загальні**: dark mode toggle, cloud sync push/pull (when logged in), hub backup (export/import JSON)
- **Рутина**: browser reminders toggle, show Fizruk workouts in calendar toggle, show Finyk subscriptions in calendar toggle
- **Фізрук**: workout reminder time picker + notification permission, rest timer defaults per exercise category (Compound, Isolation, Cardio)
- **Харчування**: reminder toggle + reminder hour, notification permission
- **Фінік**: custom expense categories, account visibility toggles, Monobank profile display, sync between devices, data export/import, cache clearing, disconnect
- Settings are removed from their original module locations to avoid duplication
- HubBackupPanel moved from dashboard to General section in hub settings
- Finyk Settings page removed from Finyk module nav (all settings now in Hub)

## Modules
- **Finyk** — Finance tracker with Monobank integration; SyncStatusBadge on Overview shows sync state (loading/success/partial/error), last-sync timestamp, and manual retry button; Settings page moved to centralized Hub settings
- **Fizruk** — Workout / exercise tracker; features: Rest Timer with Web Audio API beep + vibration on completion and circular progress ring; Training Programs (4 built-in: PPL, Upper/Lower, Full Body, Linear Progression) with activate/deactivate, today's session on Dashboard; per-exercise 1RM and volume progress charts in Exercise detail view; Body page (Тіло tab) for logging weight/sleep/energy/mood with trend line charts; recovery compute uses daily wellbeing (sleep hours + energy level) as multipliers — poor sleep/energy increases fatigue, good metrics speed recovery
- **Routine** — Routine/habit tracker; habits support multiple `reminderTimes` (array) with morning/afternoon/evening presets; backward-compatible with legacy `timeOfDay` field via `normalizeReminderTimes()`; hero section shows SVG progress ring (day completed/scheduled), completion rate %, current streak; "Leaders & Outsiders" block shows best/worst habits by 30-day rate; Day Report bottom-sheet shows full habit list (done/missed) with toggle; streaks.js exports `completionRateForRange`, `habitCompletionRate`, `currentMaxStreak`; **HabitDetailSheet** bottom-sheet for viewing habit details (stats, mini-calendar, notes) — opened from calendar card tap or "Деталі" button in settings
- **Nutrition** — Nutrition tracking with AI photo analysis; LogCard search shows macro details and allows re-adding previously logged meals; now includes **Daily Plan** page (AI-generated day plan with breakfast/lunch/dinner/snack matching calorie/macro targets or presets — Схуднення/Підтримка/Набір маси) and **Shopping List** page (AI-generated from recipes or weekly plan, auto-subtracts pantry items, grouped by category, check-off with add-to-pantry)
  - New pages: `plan` (DailyPlanCard.jsx) and `shop` (ShoppingListCard.jsx) in the bottom nav (now 6 tabs)
  - New server endpoints: `POST /api/nutrition/day-plan`, `POST /api/nutrition/shopping-list`
  - New storage: `shoppingListStorage.js` with localStorage key `nutrition_shopping_list_v1`
  - New hook: `useShoppingList.js`
- **Hub Chat** — AI chat interface (Claude)
