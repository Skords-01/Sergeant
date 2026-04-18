import { useEffect, useState } from "react";
import { foodSearch } from "@shared/api/nutritionApi.js";
import { searchFoods } from "../../lib/foodDb/foodDb.js";

export function useFoodSearch(foodQuery) {
  const [foodHits, setFoodHits] = useState([]);
  const [offHits, setOffHits] = useState([]);
  const [foodBusy, setFoodBusy] = useState(false);
  const [offBusy, setOffBusy] = useState(false);
  const [foodErr, setFoodErr] = useState("");

  useEffect(() => {
    const q = foodQuery.trim();
    if (!q) {
      setFoodHits([]);
      setOffHits([]);
      setFoodErr("");
      return;
    }
    let cancelled = false;
    setFoodBusy(true);
    setFoodErr("");

    const localTimer = window.setTimeout(() => {
      searchFoods(q, 8)
        .then((hits) => {
          if (!cancelled) setFoodHits(hits);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setFoodBusy(false);
        });
    }, 180);

    if (q.length >= 2) {
      setOffBusy(true);
      setOffHits([]);
      const offTimer = window.setTimeout(() => {
        foodSearch(q)
          .then((data) => {
            if (!cancelled) setOffHits(data?.products || []);
          })
          .catch(() => {})
          .finally(() => {
            if (!cancelled) setOffBusy(false);
          });
      }, 600);
      return () => {
        cancelled = true;
        window.clearTimeout(localTimer);
        window.clearTimeout(offTimer);
      };
    }

    return () => {
      cancelled = true;
      window.clearTimeout(localTimer);
    };
  }, [foodQuery]);

  return { foodHits, offHits, foodBusy, offBusy, foodErr, setFoodErr };
}
