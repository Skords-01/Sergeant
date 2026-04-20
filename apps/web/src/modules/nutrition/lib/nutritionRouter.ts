// Five-tab structure after UX audit: start / pantry / log / menu
// (merge of plan+recipes). Shopping now lives as an internal tab inside
// pantry, so `#shop` redirects to `#pantry`. Legacy `#plan` and `#recipes`
// both redirect to `#menu`.
export type NutritionPage = "start" | "pantry" | "log" | "menu";

const VALID_NUTRITION_PAGES: readonly NutritionPage[] = [
  "start",
  "pantry",
  "log",
  "menu",
];

const LEGACY_REDIRECTS: Record<string, NutritionPage> = {
  products: "pantry",
  plan: "menu",
  recipes: "menu",
  shop: "pantry",
};

export interface ParsedNutritionHash {
  page: NutritionPage;
  redirectFrom?: string;
}

export function parseNutritionHash(): ParsedNutritionHash {
  const raw = (window.location.hash || "").replace(/^#/, "").trim();
  if (!raw || raw.startsWith("/")) return { page: "start" };
  const [page] = raw.split("/").filter(Boolean);
  const redirect = LEGACY_REDIRECTS[page];
  if (redirect) return { page: redirect, redirectFrom: page };
  if (!VALID_NUTRITION_PAGES.includes(page as NutritionPage))
    return { page: "start" };
  return { page: page as NutritionPage };
}

export function setNutritionHash(next: NutritionPage | null | undefined): void {
  const h = next ? `#${next}` : "#start";
  if (window.location.hash === h) return;
  window.location.hash = h;
}
