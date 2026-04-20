/**
 * Спільні типи, що використовуються і на клієнті, і на сервері.
 *
 * Більшість доменних типів виводимо з Zod-схем через `z.infer`; сюди йдуть
 * лише ті, що не мають прямого Zod-відповідника (utility, union, cross-
 * package контракти без валідації).
 */

/**
 * Універсальний контракт вхідного push-payload-а для `sendToUser(userId, payload)`
 * на сервері.
 *
 * Один shape для iOS/Android/Web — сервер сам мапить поля у APNs-aps /
 * FCM-notification / web-push JSON відповідно:
 *
 *   - `title`/`body` → APNs `aps.alert.{title,body}`, FCM `notification.{title,body}`,
 *     web-push JSON `{title, body}`.
 *   - `data`        → APNs custom root keys, FCM `data` (stringified values), web-push
 *                     JSON inline.
 *   - `badge`       → APNs `aps.badge` (iOS app-icon counter). Android не має аналогу.
 *   - `threadId`    → APNs `aps.thread-id` — групування нотифікацій у одну
 *                     «розмову» на iOS. На інших платформах ігнорується.
 *
 * Контракт винесено в `@sergeant/shared` (а не тримано лише на сервері), щоб
 * mobile/web handler-и могли типізувати свою сторону (payload.data у JS-коді
 * клієнта) без дублювання форми.
 */
export interface PushPayload {
  /** Заголовок нотифікації. Обов'язковий — всі три канали його вимагають. */
  title: string;
  /** Основний текст нотифікації. Порожній рядок — валідний. */
  body?: string;
  /** Додаткові дані клієнтського handler-а (серіалізуються у JSON). */
  data?: Record<string, unknown>;
  /** Бейдж iOS (число на іконці застосунку). Нуль скидає бейдж. */
  badge?: number;
  /** APNs `thread-id` — групує нотифікації у одному threadі на iOS. */
  threadId?: string;
}
