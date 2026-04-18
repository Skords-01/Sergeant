import { useCallback } from "react";
import { isApiError } from "@shared/api";
import { useBarcodeProductLookup } from "./useBarcodeProduct.js";

export function usePantryBarcodeScan({
  pantry,
  setPantryScannerOpen,
  setPantryScanStatus,
}) {
  const lookupProduct = useBarcodeProductLookup();

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

      let p;
      try {
        p = await lookupProduct(code);
      } catch (err) {
        if (isApiError(err) && err.isOffline) {
          setPantryScanStatus("Немає підключення до інтернету.");
          return;
        }
        if (isApiError(err) && err.kind === "http") {
          setPantryScanStatus(err.serverMessage || "Помилка пошуку.");
          return;
        }
        setPantryScanStatus("Помилка пошуку. Перевір з\u2019єднання.");
        return;
      }

      if (!p) {
        setPantryScanStatus("Продукт не знайдено в базі. Додай вручну.");
        return;
      }
      if (!p.name) {
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
    },
    [lookupProduct, pantry, setPantryScanStatus, setPantryScannerOpen],
  );
}
