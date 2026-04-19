import { bankApi, isApiError } from "@shared/api";

/**
 * Одноразова міграція банківських credentials з `localStorage` у server-side
 * vault (PR #350). Викликається з `main.jsx` після hydration.
 *
 * Логіка:
 *   1) Якщо користувач не залогінений (запит 401) або vault недоступний
 *      (`vaultAvailable: false`) — тихо виходимо. Старий path-through-header
 *      шлях у `mono.ts`/`privat.ts` продовжує працювати.
 *   2) Якщо в localStorage лежить `finyk_token` і vault ще не має
 *      `mono === true` — POST-имо токен у vault. Успіх → видаляємо з
 *      localStorage. Помилка → лишаємо все як є (кориcтувач нічого не
 *      помітить, мігруємо при наступному запуску).
 *   3) Те саме для `finyk_privat_id` + `finyk_privat_token`.
 *
 * Ідемпотентність: якщо щось вже замігроване, повторний виклик безпечний
 * (ми скидаємо LS-ключ відразу після успішного POST, а наступний `status`
 * дасть `mono=true` і ми пропустимо цикл).
 *
 * Безпека: POST робиться тільки якщо відповідний localStorage-ключ є.
 * Перезаписувати vault своїм (можливо, застарілим) значенням із LS без
 * мітки статусу — не хочемо.
 */
export async function migrateBankTokensToVault(): Promise<void> {
  if (typeof window === "undefined") return;

  let status: { mono: boolean; privat: boolean; vaultAvailable: boolean };
  try {
    status = await bankApi.status();
  } catch (err) {
    // 401 — юзер не залогінений; 503 (vault недоступний) — сервер без
    // ключа. В обох випадках нічого не мігруємо і не логуємо помилку,
    // щоб не шуміти у проді.
    if (isApiError(err) && (err.kind === "http" || err.kind === "network")) {
      return;
    }
    return;
  }

  if (!status.vaultAvailable) return;

  // ── Monobank ──
  try {
    const legacy = safeReadLS("finyk_token");
    if (legacy && !status.mono) {
      await bankApi.saveMono(legacy);
      safeRemoveLS("finyk_token");
      safeRemoveLS("finyk_token_remembered");
    } else if (legacy && status.mono) {
      // Vault вже має токен — LS просто застарілий дубль. Очищаємо.
      safeRemoveLS("finyk_token");
      safeRemoveLS("finyk_token_remembered");
    }
  } catch {
    // Мовчазний best-effort: спробуємо знову при наступному старті.
  }

  // ── PrivatBank ──
  try {
    const id = safeReadLS("finyk_privat_id");
    const token = safeReadLS("finyk_privat_token");
    if (id && token && !status.privat) {
      await bankApi.savePrivat({ id, token });
      safeRemoveLS("finyk_privat_id");
      safeRemoveLS("finyk_privat_token");
    } else if (id && token && status.privat) {
      safeRemoveLS("finyk_privat_id");
      safeRemoveLS("finyk_privat_token");
    }
  } catch {
    /* best-effort */
  }
}

function safeReadLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemoveLS(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage may be disabled */
  }
}
