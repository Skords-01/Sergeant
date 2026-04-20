import { useEffect, useState } from "react";
import {
  parseNutritionHash,
  setNutritionHash,
  type NutritionPage,
} from "../lib/nutritionRouter.js";

export interface UseNutritionHashRouteResult {
  activePage: NutritionPage;
  setActivePage: (page: NutritionPage) => void;
  setActivePageAndHash: (page: NutritionPage) => void;
}

export function useNutritionHashRoute(): UseNutritionHashRouteResult {
  const [activePage, setActivePage] = useState<NutritionPage>(
    () => parseNutritionHash().page,
  );

  useEffect(() => {
    // One-time normalization on mount: handle legacy routes
    // (`#products`, `#plan`, `#recipes`, `#shop`) by rewriting the URL in
    // place. The state already holds the correct page because
    // parseNutritionHash resolves the redirect.
    const initial = parseNutritionHash();
    if (initial.redirectFrom) setNutritionHash(initial.page);

    const onHash = () => {
      const p = parseNutritionHash();
      setActivePage(p.page);
      if (p.redirectFrom) setNutritionHash(p.page);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const setActivePageAndHash = (page: NutritionPage) => {
    setActivePage(page);
    setNutritionHash(page);
  };

  return { activePage, setActivePage, setActivePageAndHash };
}
