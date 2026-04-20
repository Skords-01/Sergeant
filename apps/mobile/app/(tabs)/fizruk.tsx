import { ModuleStub } from "@/components/ModuleStub";

export default function FizrukTab() {
  return (
    <ModuleStub
      title="ФІЗРУК"
      description="Тренування, таймери відпочинку, програми, прогрес та виміри."
      plannedFeatures={[
        "Активне тренування з таймером відпочинку",
        "Бібліотека програм тренувань",
        "Прогрес (графіки 1RM, об'єм)",
        "Виміри тіла і фото",
        "Щоденник самопочуття",
      ]}
    />
  );
}
