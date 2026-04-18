import { useCallback, useState } from "react";
import { barcodeApi, isApiError } from "@shared/api";
import {
  bindBarcodeToFood,
  lookupFoodByBarcode,
} from "../../lib/foodDb/foodDb.js";

export function useBarcodeLookup({
  pickedFood,
  setPickedFood,
  setPickedGrams,
  setForm,
}) {
  const [barcode, setBarcode] = useState("");
  const [barcodeStatus, setBarcodeStatus] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleBarcodeLookup = useCallback(
    async (codeRaw) => {
      const code = String(codeRaw || "").trim();
      if (!code) return;
      setBarcodeStatus("Шукаю…");

      const localFound = await lookupFoodByBarcode(code);
      if (localFound) {
        setBarcodeStatus("Знайдено ✔");
        setPickedFood(localFound);
        setPickedGrams(String(Math.round(localFound.defaultGrams || 100)));
        return;
      }

      if (!navigator.onLine) {
        setBarcodeStatus(
          "Немає підключення. Перевір інтернет і спробуй знову.",
        );
        return;
      }

      let data;
      try {
        data = await barcodeApi.lookup(code);
      } catch (e) {
        if (isApiError(e) && e.status === 404) {
          setBarcodeStatus("Продукт не знайдено. Можна ввести дані вручну.");
          return;
        }
        if (isApiError(e) && e.kind === "http") {
          setBarcodeStatus(
            e.serverMessage || "Помилка пошуку. Спробуй пізніше.",
          );
          return;
        }
        setBarcodeStatus(
          "Помилка пошуку. Перевір з'єднання і спробуй пізніше.",
        );
        return;
      }
      try {
        const p = data?.product;
        if (!p?.name) {
          setBarcodeStatus("Продукт знайдено, але дані неповні. Введи вручну.");
          return;
        }
        const grams = p.servingGrams || 100;
        const gramsStr = String(Math.round(grams));
        const factor = grams / 100;
        const fakeFood = {
          id: `barcode_${code}`,
          name: p.name,
          brand: p.brand || "",
          defaultGrams: grams,
          per100: {
            kcal: p.kcal_100g || 0,
            protein_g: p.protein_100g || 0,
            fat_g: p.fat_100g || 0,
            carbs_g: p.carbs_100g || 0,
          },
          source: "barcode",
        };
        setPickedFood(fakeFood);
        setPickedGrams(gramsStr);
        setForm((s) => ({
          ...s,
          name: [p.name, p.brand].filter(Boolean).join(" ").trim() || s.name,
          kcal:
            p.kcal_100g != null
              ? String(Math.round(p.kcal_100g * factor))
              : s.kcal,
          protein_g:
            p.protein_100g != null
              ? String(Math.round(p.protein_100g * factor))
              : s.protein_g,
          fat_g:
            p.fat_100g != null
              ? String(Math.round(p.fat_100g * factor))
              : s.fat_g,
          carbs_g:
            p.carbs_100g != null
              ? String(Math.round(p.carbs_100g * factor))
              : s.carbs_g,
          err: "",
        }));
        // partial = UPCitemdb found name/brand but has no nutrition data
        if (p.partial) {
          setBarcodeStatus(
            `Знайдено: ${[p.name, p.brand].filter(Boolean).join(" — ")} — введи КБЖВ вручну.`,
          );
        } else {
          setBarcodeStatus(
            `Знайдено: ${[p.name, p.brand].filter(Boolean).join(" — ")} ✔`,
          );
        }
      } catch {
        setBarcodeStatus(
          "Помилка пошуку. Перевір з'єднання і спробуй пізніше.",
        );
      }
    },
    [setPickedFood, setPickedGrams, setForm],
  );

  const handleBarcodeBind = useCallback(
    async (codeRaw) => {
      const code = String(codeRaw || "").trim();
      if (!/^\d{8,14}$/.test(code)) {
        setBarcodeStatus("Некоректний штрихкод (очікую 8–14 цифр).");
        return;
      }
      if (!pickedFood?.id) {
        setBarcodeStatus(
          "Спочатку обери продукт (або збережи поточний як продукт).",
        );
        return;
      }
      const ok = await bindBarcodeToFood(code, pickedFood.id);
      setBarcodeStatus(ok ? "Прив'язано ✔" : "Не вдалося прив'язати");
    },
    [pickedFood],
  );

  return {
    barcode,
    setBarcode,
    barcodeStatus,
    setBarcodeStatus,
    scannerOpen,
    setScannerOpen,
    handleBarcodeLookup,
    handleBarcodeBind,
  };
}
