import { FinykPageStub } from "@/modules/finyk/pages/PageStub";

export default function FinykAnalyticsScreen() {
  return (
    <FinykPageStub
      title="Аналітика"
      description="Розбивка витрат за категоріями, мерчантами та місяцями."
      plannedFeatures={[
        "CategoryPieChart (Victory Native XL)",
        "Список топ-мерчантів",
        "Ретро-порівняння місяць-до-місяця",
        "Recurring-детектор підписок",
        "Фільтр за періодом (тиждень / місяць / рік)",
      ]}
    />
  );
}
