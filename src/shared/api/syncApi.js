import { httpRequest } from "./client.js";

export function pushAll(modules) {
  return httpRequest("/api/sync/push-all", {
    method: "POST",
    body: { modules },
  });
}

export function pullAll() {
  return httpRequest("/api/sync/pull-all", {
    method: "POST",
  });
}

export function syncPush(mod, payload) {
  return pushAll({ [mod]: payload });
}

export async function syncPull(mod) {
  const data = await pullAll();
  return data?.modules?.[mod] ?? null;
}
