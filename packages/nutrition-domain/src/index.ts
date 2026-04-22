// Публічна поверхня пакета `@sergeant/nutrition-domain` — DOM-free
// бізнес-логіка Харчування, яку споживають `apps/web` і `apps/mobile`
// без платформних залежностей (`localStorage`, `window`, `document`).
//
// Phase 7 / PR 1: перший зріз pure-логіки модуля Харчування —
// meal-types, pantry-text-parser, merge-items, recipe-ids, food-categories,
// nutrition-format. Решта шарів (storage, cloud-backup, IndexedDB-recipe-book,
// stats/day-summary який зараз тісно зв'язаний з localStorage) приходить
// наступними PR-ами після того, як витягнемо platform-IO за `KVStore`-
// абстракцію.
export * from "./mealTypes.js";
export * from "./pantryTextParser.js";
export * from "./mergeItems.js";
export * from "./recipeIds.js";
export * from "./foodCategories.js";
export * from "./nutritionFormat.js";
