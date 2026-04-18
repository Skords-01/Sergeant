import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: "navigations",
      networkTimeoutSeconds: 3,
      plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
    }),
    { denylist: [/^\/api\//] },
  ),
);

// GET /api/* — NetworkFirst with a short timeout so the cache only kicks in
// when the network is actually unreachable or very slow. Non-GET requests
// (POST/PUT/DELETE) are NOT cached; they continue to go through the in-JS
// offline queue implemented in useCloudSync.js.
// Auth endpoints (`/api/auth/*`) are explicitly excluded: serving a stale
// cached session could make the app believe a user is still authenticated
// after logout or session expiry.
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/api/auth/") &&
    request.method === "GET",
  new NetworkFirst({
    cacheName: "api-cache",
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24, // 1 day
        purgeOnQuotaError: true,
      }),
    ],
  }),
  "GET",
);

registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new CacheFirst({
    cacheName: "google-fonts-css",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-woff",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

const ROUTINE_NOTIFY_PREFIX = "routine_notify_";

function todayKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function currentHm() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function habitScheduledOnDateSW(h, dk) {
  if (!h || h.archived) return false;
  if (h.startDate && dk < h.startDate) return false;
  if (h.endDate && dk > h.endDate) return false;
  const rec = h.recurrence || "daily";
  if (rec === "daily") return true;
  if (rec === "once") return dk === h.startDate;
  if (rec === "weekly") {
    const d = new Date(dk + "T12:00:00");
    const wd = (d.getDay() + 6) % 7;
    return Array.isArray(h.weekdays) && h.weekdays.includes(wd);
  }
  if (rec === "monthly") {
    const startDay = h.startDate ? parseInt(h.startDate.split("-")[2], 10) : 1;
    const dkDay = parseInt(dk.split("-")[2], 10);
    const [y, m] = dk.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return startDay > lastDay ? dkDay === lastDay : dkDay === startDay;
  }
  return true;
}

const notifiedKeys = new Set();
let routineData = null;
let fizrukData = null;
let nutritionData = null;
let scheduledTimerId = null;

function normalizeReminderTimesSW(h) {
  if (Array.isArray(h.reminderTimes) && h.reminderTimes.length > 0) {
    return h.reminderTimes.filter(
      (t) => typeof t === "string" && /^\d{2}:\d{2}$/.test(t),
    );
  }
  const legacy = h.timeOfDay && String(h.timeOfDay).trim();
  if (legacy && /^\d{2}:\d{2}$/.test(legacy)) return [legacy];
  return [];
}

function checkRoutineReminders() {
  if (!routineData) return;
  if (routineData.prefs?.routineRemindersEnabled !== true) return;

  const dk = todayKey();
  const hm = currentHm();
  const habits = routineData.habits || [];
  const completions = routineData.completions || {};

  for (const h of habits) {
    if (h.archived) continue;
    const times = normalizeReminderTimesSW(h);
    if (times.length === 0) continue;
    if (!times.includes(hm)) continue;
    if (!habitScheduledOnDateSW(h, dk)) continue;
    const hCompletions = completions[h.id] || [];
    if (hCompletions.includes(dk)) continue;

    const storageKey = `${ROUTINE_NOTIFY_PREFIX}${h.id}_${hm}_${dk}`;
    if (notifiedKeys.has(storageKey)) continue;
    notifiedKeys.add(storageKey);

    const title = `${h.emoji || "✓"} ${h.name}`;
    self.registration
      .showNotification(title, {
        body: "Нагадування про звичку",
        tag: storageKey,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        requireInteraction: false,
        data: { action: "open", module: "routine" },
      })
      .catch(() => {});
  }
}

function checkFizrukReminders() {
  if (!fizrukData) return;
  if (!fizrukData.reminderEnabled) return;

  const dk = todayKey();
  const hm = currentHm();
  const todayEntry = fizrukData.days?.[dk];
  if (!todayEntry?.templateId) return;

  const rh = Number.isFinite(fizrukData.reminderHour)
    ? fizrukData.reminderHour
    : 18;
  const rm = Number.isFinite(fizrukData.reminderMinute)
    ? fizrukData.reminderMinute
    : 0;
  const targetHm = `${String(rh).padStart(2, "0")}:${String(rm).padStart(2, "0")}`;
  if (hm !== targetHm) return;

  const storageKey = `fizruk_notify_${dk}`;
  if (notifiedKeys.has(storageKey)) return;
  notifiedKeys.add(storageKey);

  self.registration
    .showNotification("🏋️ Фізрук — тренування", {
      body: "Заплановане тренування на сьогодні. Відкрий застосунок, щоб стартувати.",
      tag: storageKey,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      requireInteraction: false,
      data: { action: "open", module: "fizruk" },
    })
    .catch(() => {});
}

function checkNutritionReminders() {
  if (!nutritionData) return;
  if (!nutritionData.reminderEnabled) return;

  const dk = todayKey();
  const hm = currentHm();
  const rh = Number.isFinite(nutritionData.reminderHour)
    ? nutritionData.reminderHour
    : 12;
  const targetHm = `${String(rh).padStart(2, "0")}:00`;
  if (hm !== targetHm) return;

  const storageKey = `nutrition_notify_${dk}`;
  if (notifiedKeys.has(storageKey)) return;
  notifiedKeys.add(storageKey);

  self.registration
    .showNotification("🥗 Харчування", {
      body: "Час відмітити прийом їжі! Відкрий застосунок.",
      tag: storageKey,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      requireInteraction: false,
      data: { action: "open", module: "nutrition" },
    })
    .catch(() => {});
}

function checkReminders() {
  checkRoutineReminders();
  checkFizrukReminders();
  checkNutritionReminders();
}

function scheduleNextCheck() {
  if (scheduledTimerId) clearTimeout(scheduledTimerId);
  const now = new Date();
  const msToNextMinute =
    (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 50;
  scheduledTimerId = setTimeout(() => {
    checkReminders();
    scheduleNextCheck();
  }, msToNextMinute);
}

function startReminderLoop() {
  checkReminders();
  scheduleNextCheck();
}

self.addEventListener("message", (event) => {
  const { type, data } = event.data || {};

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (type === "ROUTINE_STATE_UPDATE") {
    routineData = data;
    startReminderLoop();
    return;
  }

  if (type === "FIZRUK_STATE_UPDATE") {
    fizrukData = data;
    startReminderLoop();
    return;
  }

  if (type === "NUTRITION_STATE_UPDATE") {
    nutritionData = data;
    startReminderLoop();
    return;
  }

  if (type === "ROUTINE_NOTIFICATION_SENT") {
    if (data?.storageKey) notifiedKeys.add(data.storageKey);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const module = event.notification.data?.module;
  const url = module ? `/?module=${module}` : "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope)) {
            client.focus();
            if (module) {
              client.postMessage({ type: "OPEN_MODULE", module });
            }
            return;
          }
        }
        return self.clients.openWindow(url);
      }),
  );
});

self.addEventListener("notificationclose", (event) => {
  const tag = event.notification.tag;
  if (tag) notifiedKeys.add(tag);
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ── Web Push ─────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: event.data.text() };
  }

  const title = payload.title || "Мій простір";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || `push_${Date.now()}`,
    requireInteraction: false,
    data: { module: payload.module || null },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
