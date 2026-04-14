/** Експорт журналу в CSV / JSON (клієнт). */

export function downloadBlob(filename, mime, text) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function weekMacrosToCsv(rows) {
  const header = "date,kcal,protein_g,fat_g,carbs_g";
  const lines = rows.map(
    (r) =>
      `${r.date},${Math.round(r.kcal)},${Math.round(r.protein_g)},${Math.round(r.fat_g)},${Math.round(r.carbs_g)}`,
  );
  return [header, ...lines].join("\n");
}

export function formatDayAsText(log, date) {
  const day = log[date];
  const meals = Array.isArray(day?.meals) ? day.meals : [];
  if (meals.length === 0) return `${date}: (порожньо)`;
  const lines = meals.map((m) => {
    const mac = m.macros || {};
    return `- ${m.time || "?"} ${m.name} — ${Math.round(mac.kcal || 0)} ккал (Б${Math.round(mac.protein_g || 0)} Ж${Math.round(mac.fat_g || 0)} В${Math.round(mac.carbs_g || 0)})`;
  });
  return [`${date}`, ...lines].join("\n");
}
