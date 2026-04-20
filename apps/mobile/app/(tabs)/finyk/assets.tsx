import { FinykPageStub } from "@/modules/finyk/pages/PageStub";

export default function FinykAssetsScreen() {
  return (
    <FinykPageStub
      title="Активи"
      description="Рахунки, підписки, борги та крива NetWorth."
      plannedFeatures={[
        "Картки банківських рахунків",
        "NetworthChart (Victory Native XL)",
        "Керування підписками (DEFAULT_SUBSCRIPTIONS)",
        "Борги та погашення",
        "Moto експорт JSON (expo-file-system + expo-sharing)",
      ]}
    />
  );
}
