import { useEffect, useState } from "react";
import {
  parseNutritionHash,
  setNutritionHash,
} from "../lib/nutritionRouter.js";

export function useNutritionHashRoute() {
  const [activePage, setActivePage] = useState(() => parseNutritionHash().page);

  useEffect(() => {
    const onHash = () => {
      const p = parseNutritionHash();
      setActivePage(p.page);
      if (p.redirectFrom === "products") setNutritionHash("pantry");
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const setActivePageAndHash = (page) => {
    setActivePage(page);
    setNutritionHash(page);
  };

  return { activePage, setActivePage, setActivePageAndHash };
}
