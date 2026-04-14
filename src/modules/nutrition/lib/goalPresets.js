/** Швидкі пресети денних цілей (КБЖВ). Користувач може підкоригувати вручну. */
export const GOAL_PRESETS = [
  {
    id: "cut",
    label: "Схуднення",
    dailyTargetKcal: 1800,
    dailyTargetProtein_g: 130,
    dailyTargetFat_g: 55,
    dailyTargetCarbs_g: 170,
  },
  {
    id: "maintain",
    label: "Підтримка",
    dailyTargetKcal: 2200,
    dailyTargetProtein_g: 100,
    dailyTargetFat_g: 70,
    dailyTargetCarbs_g: 230,
  },
  {
    id: "gain",
    label: "Набір",
    dailyTargetKcal: 2800,
    dailyTargetProtein_g: 160,
    dailyTargetFat_g: 85,
    dailyTargetCarbs_g: 300,
  },
];
