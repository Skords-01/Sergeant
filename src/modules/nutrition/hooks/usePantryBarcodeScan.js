import { useCallback } from "react";
import { barcodeApi, isApiError } from "@shared/api";

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
      let data;
      try {
        data = await barcodeApi.lookup(code);
      } catch (e) {
        if (isApiError(e) && e.status === 404) {
          setPantryScanStatus("Продукт не знайдено в базі. Додай вручну.");
          return;
        }
        if (isApiError(e) && e.kind === "http") {
          setPantryScanStatus(e.serverMessage || "Помилка пошуку.");
          return;
        }
        setPantryScanStatus("Помилка пошуку. Перевір з\u2019єднання.");
        return;
      }
      try {
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
      } catch {
        setPantryScanStatus("Помилка пошуку. Перевір з\u2019єднання.");
      }
    },
    [pantry, setPantryScanStatus, setPantryScannerOpen],
  );
}
