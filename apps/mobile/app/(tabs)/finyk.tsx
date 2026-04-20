import { ModuleStub } from "@/components/ModuleStub";

export default function FinykTab() {
  return (
    <ModuleStub
      title="ФІНІК"
      description="Особисті фінанси, Monobank-синхронізація, бюджети, борги, активи, тренди."
      plannedFeatures={[
        "Дашборд: баланс, витрати місяця, тренди",
        "Список транзакцій з пошуком та фільтрами",
        "Додавання ручної транзакції",
        "Бюджети та ліміти",
        "Борги / активи",
        "Інтеграція з Monobank (OAuth)",
      ]}
    />
  );
}
