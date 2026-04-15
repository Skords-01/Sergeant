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

registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new CacheFirst({
    cacheName: "google-fonts-css",
    plugins: [
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-woff",
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
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
let scheduledTimerId = null;

function normalizeReminderTimesSW(h) {
  if (Array.isArray(h.reminderTimes) && h.reminderTimes.length > 0) {
    return h.reminderTimes.filter((t) => typeof t === "string" && /^\d{2}:\d{2}$/.test(t));
  }
  const legacy = h.timeOfDay && String(h.timeOfDay).trim();
  if (legacy && /^\d{2}:\d{2}$/.test(legacy)) return [legacy];
  return [];
}

function checkReminders() {
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
    self.registration.showNotification(title, {
      body: "Нагадування про звичку",
      tag: storageKey,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      requireInteraction: false,
    }).catch(() => {});
  }
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

  if (type === "ROUTINE_NOTIFICATION_SENT") {
    if (data?.storageKey) notifiedKeys.add(data.storageKey);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.registration.scope)) {
          return client.focus();
        }
      }
      return self.clients.openWindow("/");
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
