import { FinykPageStub } from "@/modules/finyk/pages/PageStub";

export default function FinykBudgetsScreen() {
  return (
    <FinykPageStub
      title="Планування"
      description="Бюджети, ліміти, цілі та місячний план."
      plannedFeatures={[
        "Картка місячного плану з прогрес-барами",
        "Ліміти та цілі за категоріями",
        "BudgetTrendChart (Victory Native XL)",
        "BudgetForecastCard",
        "Категоризація підозрілих транзакцій",
      ]}
    />
  );
}
