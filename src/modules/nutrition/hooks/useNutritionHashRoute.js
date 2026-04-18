import { useEffect, useState } from "react";
import {
  parseNutritionHash,
  setNutritionHash,
} from "../lib/nutritionRouter.js";

export function useNutritionHashRoute() {
  const [activePage, setActivePage] = useState(() => parseNutritionHash().page);

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

  const setActivePageAndHash = (page) => {
    setActivePage(page);
    setNutritionHash(page);
  };

  return { activePage, setActivePage, setActivePageAndHash };
}
