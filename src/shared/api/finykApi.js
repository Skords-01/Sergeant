import { httpRequest, httpRequestRaw } from "./client.js";

export function fetchMonobank(path, token) {
  return httpRequest(`/api/mono?path=${encodeURIComponent(path)}`, {
    headers: { "X-Token": token },
  });
}

export function fetchPrivat(path, merchantId, merchantToken, queryParams = {}) {
  const params = new URLSearchParams({ path, ...queryParams });
  return httpRequest(`/api/privat?${params.toString()}`, {
    headers: {
      "X-Privat-Id": merchantId,
      "X-Privat-Token": merchantToken,
    },
  });
}

export function sendChat(payload) {
  return httpRequest("/api/chat", {
    method: "POST",
    body: payload,
  });
}

export function sendChatRaw(payload) {
  return httpRequestRaw("/api/chat", {
    method: "POST",
    body: payload,
  });
}
