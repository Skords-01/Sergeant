import { safeReadLS } from "@shared/lib/storage";
import { INTERNAL_TRANSFER_ID } from "../constants";

// Збирає Set ID транзакцій, що виключаються зі статистики ФІНІК (та сама логіка, що
// в `useStorage` → `excludedTxIds`), читаючи безпосередньо з localStorage.
// Це дозволяє іншим сторінкам (Звіти, AI Digest) використовувати ту саму логіку
// без mounted-хука useStorage.
export function getFinykExcludedTxIdsFromStorage() {
  const hidden = safeReadLS("finyk_hidden_txs", []);
  const txCats = safeReadLS("finyk_tx_cats", {});
  const recv = safeReadLS("finyk_recv", []);
  const extra = safeReadLS("finyk_excluded_stat_txs", []);
  const transferIds = Object.entries(
    txCats && typeof txCats === "object" ? txCats : {},
  )
    .filter(([, v]) => v === INTERNAL_TRANSFER_ID)
    .map(([k]) => k);
  const recvIds = Array.isArray(recv)
    ? recv.flatMap((r) => (Array.isArray(r?.linkedTxIds) ? r.linkedTxIds : []))
    : [];
  return new Set([
    ...(Array.isArray(hidden) ? hidden : []),
    ...transferIds,
    ...recvIds,
    ...(Array.isArray(extra) ? extra : []),
  ]);
}

export function getFinykTxSplitsFromStorage() {
  const v = safeReadLS("finyk_tx_splits", {});
  return v && typeof v === "object" ? v : {};
}
