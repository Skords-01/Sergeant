import { FinykPageStub } from "@/modules/finyk/pages/PageStub";

export default function FinykTransactionsScreen() {
  return (
    <FinykPageStub
      title="Операції"
      description="Перегляд і пошук транзакцій із банку та ручних витрат."
      plannedFeatures={[
        "FlashList-стрічка транзакцій",
        "Фільтр за категорією / рахунком / датою",
        "Свайп вліво → редагувати, вправо → категоризувати",
        "Ручна експенс-форма як modal-sheet",
        "Синхронізація з Monobank через @sergeant/api-client",
      ]}
    />
  );
}
