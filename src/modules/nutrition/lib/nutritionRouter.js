const VALID_NUTRITION_PAGES = [
  "start",
  "pantry",
  "log",
  "plan",
  "recipes",
  "shop",
];

export function parseNutritionHash() {
  const raw = (window.location.hash || "").replace(/^#/, "").trim();
  if (!raw || raw.startsWith("/")) return { page: "start" };
  const [page] = raw.split("/").filter(Boolean);
  if (page === "products") return { page: "pantry", redirectFrom: "products" };
  if (!VALID_NUTRITION_PAGES.includes(page)) return { page: "start" };
  return { page };
}

export function setNutritionHash(next) {
  const h = next ? `#${next}` : "#start";
  if (window.location.hash === h) return;
  window.location.hash = h;
}

