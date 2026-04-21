import { ModuleStub } from "@/components/ModuleStub";

export default function NutritionTab() {
  return (
    <ModuleStub
      title="Харчування"
      description="Лог їжі, AI-аналіз фото, сканер штрихкодів, денний план, вода."
      plannedFeatures={[
        "Щоденник їжі",
        "Фото → AI-аналіз макросів",
        "Сканер штрихкодів (OFF + USDA + UPCitemdb)",
        "Денний план і денний підрахунок",
        "Список покупок, комора, рецепти",
        "Трекер води",
      ]}
    />
  );
}
