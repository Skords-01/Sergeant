import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@shared/lib/apiUrl.js";
import { searchFoods } from "../../lib/foodDb/foodDb.js";

const LOCAL_DEBOUNCE_MS = 180;
const OFF_DEBOUNCE_MS = 600;
const OFF_MIN_LEN = 2;

// react-query is a useful fit here: repeated searches for the same query
// return from cache instantly (important for UX when users backspace and
// retype), requests for stale queries are auto-cancelled via `signal`, and
// the built-in retry policy from the shared QueryClient handles flaky
// mobile networks without the component having to know.
async function fetchOpenFoodFacts(query, signal) {
  const res = await fetch(
    apiUrl(`/api/food-search?q=${encodeURIComponent(query)}`),
    { signal },
  );
  if (!res.ok) {
    const err = new Error(`food-search failed with ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return Array.isArray(data?.products) ? data.products : [];
}

// Debounce user input separately from the queries themselves. We don't want
// react-query to see every keystroke — otherwise it would spin up (and
// cancel) one request per character.
function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useFoodSearch(foodQuery) {
  const trimmed = foodQuery.trim();
  const localQuery = useDebouncedValue(trimmed, LOCAL_DEBOUNCE_MS);
  const offQuery = useDebouncedValue(trimmed, OFF_DEBOUNCE_MS);

  const local = useQuery({
    queryKey: ["nutrition", "food-search", "local", localQuery],
    queryFn: () => searchFoods(localQuery, 8),
    enabled: localQuery.length > 0,
    staleTime: 5 * 60_000,
  });

  const off = useQuery({
    queryKey: ["nutrition", "food-search", "off", offQuery],
    queryFn: ({ signal }) => fetchOpenFoodFacts(offQuery, signal),
    enabled: offQuery.length >= OFF_MIN_LEN,
    staleTime: 5 * 60_000,
  });

  // `foodErr` is not owned by the search queries — it's used by
  // `SaveAsFood` to report "save food" errors into the shared UI area.
  // Keep it local state here so the public API of this hook stays stable
  // and consumers don't have to track where it lives.
  const [foodErr, setFoodErr] = useState("");

  // Any pending save-food error is stale the moment the user starts typing
  // a new search. The pre-react-query implementation did this implicitly on
  // the fetch-effect; restore it explicitly here.
  useEffect(() => {
    if (foodErr) setFoodErr("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trimmed]);

  return {
    foodHits: trimmed && localQuery === trimmed ? (local.data ?? []) : [],
    offHits: trimmed && offQuery === trimmed ? (off.data ?? []) : [],
    foodBusy: local.isFetching && localQuery.length > 0,
    offBusy: off.isFetching && offQuery.length >= OFF_MIN_LEN,
    foodErr,
    setFoodErr,
  };
}
