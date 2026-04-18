import { useCallback } from "react";
import { ApiError } from "@shared/api/client.js";
import { barcodeLookup } from "@shared/api/nutritionApi.js";

export function usePantryBarcodeScan({
  pantry,
  setPantryScannerOpen,
  setPantryScanStatus,
}) {
  return useCallback(
    async (raw) => {
      setPantryScannerOpen(false);
      setPantryScanStatus("Шукаю продукт\u2026");
      const code = String(raw || "")
        .trim()
        .replace(/\D/g, "");
      if (!code) {
        setPantryScanStatus("Некоректний штрих-код.");
        return;
      }
      if (!navigator.onLine) {
        setPantryScanStatus("Немає підключення до інтернету.");
        return;
      }
      try {
        const data = await barcodeLookup(code);
        const p = data?.product;
        if (!p?.name) {
          setPantryScanStatus(
            "Продукт знайдено, але назва відсутня. Додай вручну.",
          );
          return;
        }
        const label = [p.name, p.brand].filter(Boolean).join(" ").trim();
        pantry.upsertItem(label);
        if (p.partial) {
          setPantryScanStatus(
            `Знайдено: ${label}. КБЖВ відсутнє в базі — за потреби додай вручну. \u2714`,
          );
        } else {
          setPantryScanStatus(`Додано: ${label} \u2714`);
        }
        setTimeout(() => setPantryScanStatus(""), 4000);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          setPantryScanStatus("Продукт не знайдено в базі. Додай вручну.");
          return;
        }
        setPantryScanStatus(error?.message || "Помилка пошуку. Перевір з\u2019єднання.");
      }
    },
    [pantry, setPantryScanStatus, setPantryScannerOpen],
  );
}
