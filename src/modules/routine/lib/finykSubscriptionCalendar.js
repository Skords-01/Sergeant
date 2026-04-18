import { safeReadLS } from "@shared/lib/storage.js";
import { STORAGE_KEYS } from "@shared/lib/storageKeys.js";
import { DEFAULT_SUBSCRIPTIONS } from "../../finyk/constants.js";
import { getSubscriptionAmountMeta } from "../../finyk/domain/subscriptionUtils.js";
import { enumerateDateKeys, parseDateKey } from "./hubCalendarAggregate.js";

export const FINYK_SUB_GROUP_LABEL = "Фінік · підписки";

const SUBS_KEY = STORAGE_KEYS.FINYK_SUBS;
const TX_CACHE_KEY = STORAGE_KEYS.FINYK_TX_CACHE;
const TX_LAST_GOOD_KEY = STORAGE_KEYS.FINYK_TX_CACHE_LAST_GOOD;

export function loadFinykSubscriptionsFromStorage() {
  const arr = safeReadLS(SUBS_KEY, null);
  if (arr === null) return [...DEFAULT_SUBSCRIPTIONS];
  return Array.isArray(arr) && arr.length ? arr : [...DEFAULT_SUBSCRIPTIONS];
}

/** Транзакції з кешу Monobank (для сум і прив’язок). */
export function loadFinykTransactionsFromStorage() {
  const primary = safeReadLS(TX_CACHE_KEY, null);
  if (primary?.txs?.length) return primary.txs;
  const fallback = safeReadLS(TX_LAST_GOOD_KEY, null);
  if (fallback?.txs?.length) return fallback.txs;
  return [];
}

function scheduledBillingDom(year, monthIndex, billingDay) {
  const dim = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(Number(billingDay) || 1, dim);
}

function isBillingDateKey(dateKey, billingDay) {
  const d = parseDateKey(dateKey);
  const dom = scheduledBillingDom(d.getFullYear(), d.getMonth(), billingDay);
  return d.getDate() === dom;
}

/**
 * Події календаря для підписок Фініка (планове списання раз на місяць).
 */
export function buildFinykSubscriptionEvents(range) {
  const { startKey, endKey } = range;
  const subs = loadFinykSubscriptionsFromStorage();
  const txs = loadFinykTransactionsFromStorage();
  const days = enumerateDateKeys(startKey, endKey);
  const out = [];

  for (const sub of subs) {
    const bd = Number(sub.billingDay);
    if (!Number.isFinite(bd) || bd < 1 || bd > 31) continue;
    const { amount, currency } = getSubscriptionAmountMeta(sub, txs);
    const subTitle = `${sub.emoji || "📱"} ${sub.name || "Підписка"}`;
    for (const date of days) {
      if (!isBillingDateKey(date, bd)) continue;
      const amtStr =
        amount != null
          ? `~${amount.toLocaleString("uk-UA", { maximumFractionDigits: 2 })} ${currency}`
          : "сума з транзакції або вручну у Фініку";
      out.push({
        id: `finyk_sub_${sub.id}_${date}`,
        source: "finyk_subscription",
        date,
        title: subTitle,
        subtitle: `Планове списання · ${amtStr}`,
        tagLabels: [FINYK_SUB_GROUP_LABEL],
        sortKey: `${date} 0b finyk_${sub.id}`,
        fizruk: false,
        finykSub: true,
        sourceKind: "finyk_sub",
      });
    }
  }

  return out;
}
