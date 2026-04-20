import { ModuleStub } from "@/components/ModuleStub";

export default function RoutineTab() {
  return (
    <ModuleStub
      title="Рутина"
      description="Hub-календар, звички зі стріками, хітмеп, ремайндери."
      plannedFeatures={[
        "Календар зі звичками та плани на день",
        "Створення/редагування звички",
        "Хітмеп і стріки",
        "Статистика: лідери/аутсайдери",
        "Push-ремайндери",
      ]}
    />
  );
}
