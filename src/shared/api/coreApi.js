import { httpRequest } from "./client.js";

export function getPushVapidPublic() {
  return httpRequest("/api/push/vapid-public");
}

export function subscribePush(payload) {
  return httpRequest("/api/push/subscribe", {
    method: "POST",
    body: payload,
  });
}

export function unsubscribePush(endpoint) {
  return httpRequest("/api/push/subscribe", {
    method: "DELETE",
    body: { endpoint },
  });
}

export function getCoachMemory() {
  return httpRequest("/api/coach/memory", { method: "GET" });
}

export function saveCoachMemory(payload) {
  return httpRequest("/api/coach/memory", {
    method: "POST",
    body: payload,
  });
}

export function getCoachInsight(payload) {
  return httpRequest("/api/coach/insight", {
    method: "POST",
    body: payload,
  });
}

export function generateWeeklyDigest(payload) {
  return httpRequest("/api/weekly-digest", {
    method: "POST",
    body: payload,
  });
}
