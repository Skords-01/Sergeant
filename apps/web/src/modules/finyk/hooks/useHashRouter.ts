import { useCallback, useEffect, useState } from "react";
import { PAGES } from "../constants";

const ALL_PAGE_IDS = PAGES.map((p) => p.id);

/**
 * Hash-based router for the Finyk module. Page id lives in the URL hash so
 * deep-links from other modules (e.g. Hub recommendations) can target a
 * specific Finyk page directly.
 *
 * Accepted shapes:
 *   - `#overview`
 *   - `#budgets?cat=smoking`            (query handled by `useHashQueryParam`)
 *   - `#/budgets`                        (legacy slash form)
 *
 * Unknown ids fall back to `defaultPage`. Legacy `payments` is rewritten to
 * `budgets` on read for back-compat with old recommendations.
 */
export function useHashRouter(
  defaultPage = "overview",
): [string, (p: string) => void] {
  const getPage = useCallback(() => {
    let p =
      window.location.hash.replace(/^#\/?/, "").split(/[/?]/)[0] || defaultPage;
    if (p === "payments") p = "budgets";
    return p;
  }, [defaultPage]);
  const [page, setPageState] = useState(getPage);
  useEffect(() => {
    const handler = () => setPageState(getPage());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [getPage]);
  const navigate = (p: string) => {
    window.location.hash = p;
  };
  return [ALL_PAGE_IDS.includes(page) ? page : defaultPage, navigate];
}

/**
 * Reads a single query param from the URL hash (`#budgets?cat=smoking`
 * → `useHashQueryParam("cat") === "smoking"`). Used by deep-links from
 * Hub insights so a "Відкрити" tap can scroll the Budgets page to the
 * exact limit the recommendation is about.
 */
export function useHashQueryParam(name: string): string | null {
  const read = useCallback(() => {
    const m = window.location.hash.match(/\?(.+)$/);
    if (!m) return null;
    try {
      return new URLSearchParams(m[1]).get(name);
    } catch {
      return null;
    }
  }, [name]);
  const [value, setValue] = useState<string | null>(read);
  useEffect(() => {
    const handler = () => setValue(read());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [read]);
  return value;
}
