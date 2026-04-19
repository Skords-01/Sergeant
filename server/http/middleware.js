/**
 * DEPRECATED: вміст розбито по `requestId.js` і `requestLog.js`. Залишено
 * re-export як compatibility-shim; імпорти поступово мігрують у наступних
 * рефактор-хвилях, після чого файл буде видалено.
 */
export { withRequestContext } from "../obs/requestContext.js";
export { requestIdMiddleware } from "./requestId.js";
export { requestLogMiddleware } from "./requestLog.js";
