import { AsyncLocalStorage } from "async_hooks";

/**
 * AsyncLocalStorage-контекст запиту. Заповнюється в `withRequestContext`
 * (після `requestIdMiddleware`). Будь-який код, що виконується у межах
 * запиту — включно з db-wrapperами, AI-викликами, webhook-handler-ами —
 * автоматично бачить `requestId`/`userId`, не приймаючи `req` як параметр.
 *
 * Usage:
 *   import { als, setUserId } from "./obs/requestContext.js";
 *   const ctx = als.getStore();          // { requestId, userId, module }
 *   setUserId("usr_123");                // коли сесія отримана
 *   setRequestModule("nutrition");       // коли відомий модуль
 */
export const als = new AsyncLocalStorage();

export function withRequestContext(req, _res, next) {
  const store = {
    requestId: req.requestId,
    userId: null,
    module: null,
  };
  als.run(store, () => next());
}

export function getRequestContext() {
  return als.getStore() ?? null;
}

export function setUserId(userId) {
  const store = als.getStore();
  if (store) store.userId = userId;
}

export function setRequestModule(mod) {
  const store = als.getStore();
  if (store) store.module = mod;
}
