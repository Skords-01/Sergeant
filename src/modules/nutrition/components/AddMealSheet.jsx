import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@shared/components/ui/Input";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { useVisualKeyboardInset } from "@shared/hooks/useVisualKeyboardInset";
import { MEAL_TYPES } from "../lib/mealTypes.js";
import { VoiceMicButton } from "@shared/components/ui/VoiceMicButton.jsx";
import { parseMealSpeech } from "../../../core/lib/speechParsers.js";
import {
  ensureSeedFoods,
  macrosForGrams,
  lookupFoodByBarcode,
  bindBarcodeToFood,
  searchFoods,
  upsertFood,
} from "../lib/foodDb/foodDb.js";
import { apiUrl } from "@shared/lib/apiUrl.js";
import { BarcodeScanner } from "./BarcodeScanner.jsx";

function FoodHitRow({ p, badge, onPick }) {
  return (
    <li>
      <button
        type="button"
        className="w-full text-left px-3 py-2.5 hover:bg-panelHi/60 active:bg-panelHi transition-colors"
        onClick={onPick}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-text font-semibold truncate">
            {[p.name, p.brand].filter(Boolean).join(" · ")}
            {badge && <span className="ml-1 text-[10px] text-subtle">{badge}</span>}
          </div>
          <div className="text-xs font-semibold text-nutrition shrink-0">
            {Math.round(p.per100?.kcal || 0)} ккал
          </div>
        </div>
        <div className="text-[11px] text-subtle mt-0.5">
          Б {Math.round(p.per100?.protein_g || 0)}г · Ж{" "}
          {Math.round(p.per100?.fat_g || 0)}г · В{" "}
          {Math.round(p.per100?.carbs_g || 0)}г{" "}
          <span className="opacity-60">на 100г</span>
        </div>
      </button>
    </li>
  );
}

function MacroChip({ label, value, unit = "г", color }) {
  return (
    <div className={cn("flex flex-col items-center px-3 py-2 min-w-0", color)}>
      <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">{label}</span>
      <span className="text-base font-extrabold leading-tight">
        {value != null ? Math.round(value) : "—"}
      </span>
      <span className="text-[10px] opacity-60">{unit}</span>
    </div>
  );
}

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function emptyForm(photoResult) {
  const macros = photoResult?.macros || {};
  return {
    name: photoResult?.dishName || "",
    mealType: "breakfast",
    time: currentTime(),
    kcal: macros.kcal != null ? String(Math.round(macros.kcal)) : "",
    protein_g: macros.protein_g != null ? String(Math.round(macros.protein_g)) : "",
    fat_g: macros.fat_g != null ? String(Math.round(macros.fat_g)) : "",
    carbs_g: macros.carbs_g != null ? String(Math.round(macros.carbs_g)) : "",
    err: "",
  };
}

export function AddMealSheet({
  open,
  onClose,
  onSave,
  photoResult,
  initialMeal,
  mealTemplates = [],
  setPrefs,
  pantryItems = [],
  onConsumePantryItem,
}) {
  const ref = useRef(null);
  const kbInsetPx = useVisualKeyboardInset(open);
  const [form, setForm] = useState(() => emptyForm(null));
  const [foodQuery, setFoodQuery] = useState("");
  const [foodHits, setFoodHits] = useState([]);
  const [offHits, setOffHits] = useState([]);
  const [foodBusy, setFoodBusy] = useState(false);
  const [offBusy, setOffBusy] = useState(false);
  const [pickedFood, setPickedFood] = useState(null);
  const [pickedGrams, setPickedGrams] = useState("100");
  const [foodErr, setFoodErr] = useState("");
  const [barcode, setBarcode] = useState("");
  const [barcodeStatus, setBarcodeStatus] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [fromPantryItem, setFromPantryItem] = useState(null);

  useDialogFocusTrap(open, ref, { onEscape: onClose });

  useEffect(() => {
    if (open) {
      if (initialMeal?.id) {
        const mac = initialMeal.macros || {};
        setForm({
          name: String(initialMeal.name || ""),
          mealType: initialMeal.mealType || "breakfast",
          time: initialMeal.time || currentTime(),
          kcal: mac.kcal != null ? String(Math.round(mac.kcal)) : "",
          protein_g: mac.protein_g != null ? String(Math.round(mac.protein_g)) : "",
          fat_g: mac.fat_g != null ? String(Math.round(mac.fat_g)) : "",
          carbs_g: mac.carbs_g != null ? String(Math.round(mac.carbs_g)) : "",
          err: "",
        });
      } else {
        setForm(emptyForm(photoResult));
      }
      setFoodQuery("");
      setFoodHits([]);
      setOffHits([]);
      setPickedFood(null);
      setPickedGrams(
        initialMeal?.amount_g != null ? String(Math.round(Number(initialMeal.amount_g) || 100)) : "100",
      );
      setFoodErr("");
      setBarcode("");
      setBarcodeStatus("");
      setScannerOpen(false);
      setFromPantryItem(null);
      void ensureSeedFoods();
    }
  }, [open, photoResult, initialMeal]);

  function field(key) {
    return (v) => setForm((s) => ({ ...s, [key]: v, err: "" }));
  }

  const handleVoiceMeal = useCallback((transcript) => {
    const parsed = parseMealSpeech(transcript);
    if (!parsed) return;
    setForm((s) => ({
      ...s,
      name: parsed.name || s.name,
      kcal: parsed.kcal != null ? String(Math.round(parsed.kcal)) : s.kcal,
      protein_g: parsed.protein != null ? String(Math.round(parsed.protein)) : s.protein_g,
      err: "",
    }));
  }, []);

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      setForm((s) => ({ ...s, err: "Введіть назву страви." }));
      return;
    }
    const kcal = form.kcal === "" ? null : Number(form.kcal);
    const protein_g = form.protein_g === "" ? null : Number(form.protein_g);
    const fat_g = form.fat_g === "" ? null : Number(form.fat_g);
    const carbs_g = form.carbs_g === "" ? null : Number(form.carbs_g);
    if (
      [kcal, protein_g, fat_g, carbs_g].some(
        (n) => n != null && (!Number.isFinite(n) || n < 0),
      )
    ) {
      setForm((s) => ({ ...s, err: "Некоректне значення КБЖВ." }));
      return;
    }
    if (fromPantryItem && onConsumePantryItem) {
      const grams = Number(pickedGrams) || 100;
      onConsumePantryItem(fromPantryItem, grams);
    }
    const mealLabel =
      MEAL_TYPES.find((m) => m.id === form.mealType)?.label || "Прийом їжі";
    const source = photoResult ? "photo" : "manual";
    const macroSource = photoResult
      ? "photoAI"
      : pickedFood
        ? "productDb"
        : "manual";
    onSave({
      id: initialMeal?.id || `meal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      time: form.time || currentTime(),
      mealType: form.mealType,
      label: mealLabel,
      name,
      macros: { kcal, protein_g, fat_g, carbs_g },
      source,
      macroSource,
      ...(pickedFood
        ? { amount_g: Number(pickedGrams) || 100, foodId: pickedFood.id }
        : {}),
    });
  }

  useEffect(() => {
    const q = foodQuery.trim();
    if (!q) {
      setFoodHits([]);
      setOffHits([]);
      setFoodErr("");
      return;
    }
    let cancelled = false;
    setFoodBusy(true);
    setFoodErr("");

    const localTimer = window.setTimeout(() => {
      searchFoods(q, 8)
        .then((hits) => { if (!cancelled) setFoodHits(hits); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setFoodBusy(false); });
    }, 180);

    if (q.length >= 2) {
      setOffBusy(true);
      setOffHits([]);
      const offTimer = window.setTimeout(() => {
        fetch(apiUrl(`/api/food-search?q=${encodeURIComponent(q)}`))
          .then((r) => r.ok ? r.json() : Promise.reject())
          .then((data) => { if (!cancelled) setOffHits(data?.products || []); })
          .catch(() => {})
          .finally(() => { if (!cancelled) setOffBusy(false); });
      }, 600);
      return () => {
        cancelled = true;
        window.clearTimeout(localTimer);
        window.clearTimeout(offTimer);
      };
    }

    return () => {
      cancelled = true;
      window.clearTimeout(localTimer);
    };
  }, [foodQuery]);

  const applyPickedFood = useCallback((p, gramsRaw) => {
    const g = Number(String(gramsRaw || "").trim().replace(",", "."));
    const grams = Number.isFinite(g) && g > 0 ? g : p?.defaultGrams || 100;
    const mac = macrosForGrams(p?.per100, grams);
    setForm((s) => ({
      ...s,
      name: [p?.name, p?.brand].filter(Boolean).join(" ").trim() || s.name,
      kcal: String(Math.round(Number(mac.kcal) || 0)),
      protein_g: String(Math.round(Number(mac.protein_g) || 0)),
      fat_g: String(Math.round(Number(mac.fat_g) || 0)),
      carbs_g: String(Math.round(Number(mac.carbs_g) || 0)),
      err: "",
    }));
  }, []);

  // Live-recalculation при зміні кількості грамів
  useEffect(() => {
    if (!pickedFood) return;
    applyPickedFood(pickedFood, pickedGrams);
  }, [pickedGrams, pickedFood, applyPickedFood]);

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
        setBarcodeStatus("Немає підключення. Перевір інтернет і спробуй знову.");
        return;
      }

      try {
        const res = await fetch(apiUrl(`/api/barcode?barcode=${encodeURIComponent(code)}`));
        if (res.status === 404) {
          setBarcodeStatus("Продукт не знайдено. Можна ввести дані вручну.");
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setBarcodeStatus(err?.error || "Помилка пошуку. Спробуй пізніше.");
          return;
        }
        const data = await res.json();
        const p = data?.product;
        if (!p?.name) {
          setBarcodeStatus("Продукт знайдено, але дані неповні. Введи вручну.");
          return;
        }
        setBarcodeStatus(`Знайдено: ${[p.name, p.brand].filter(Boolean).join(" — ")} ✔`);
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
        // fallback fields for barcode products with no per100
        setForm((s) => ({
          ...s,
          name: [p.name, p.brand].filter(Boolean).join(" ").trim() || s.name,
          kcal: p.kcal_100g != null ? String(Math.round(p.kcal_100g * factor)) : s.kcal,
          protein_g: p.protein_100g != null ? String(Math.round(p.protein_100g * factor)) : s.protein_g,
          fat_g: p.fat_100g != null ? String(Math.round(p.fat_100g * factor)) : s.fat_g,
          carbs_g: p.carbs_100g != null ? String(Math.round(p.carbs_100g * factor)) : s.carbs_g,
          err: "",
        }));
      } catch {
        setBarcodeStatus("Помилка пошуку. Перевір з'єднання і спробуй пізніше.");
      }
    },
    [],
  );

  async function handleBarcodeBind(codeRaw) {
    const code = String(codeRaw || "").trim();
    if (!/^\d{8,14}$/.test(code)) {
      setBarcodeStatus("Некоректний штрихкод (очікую 8–14 цифр).");
      return;
    }
    if (!pickedFood?.id) {
      setBarcodeStatus("Спочатку обери продукт (або збережи поточний як продукт).");
      return;
    }
    const ok = await bindBarcodeToFood(code, pickedFood.id);
    setBarcodeStatus(ok ? "Прив'язано ✔" : "Не вдалося прив'язати");
  }

  const hasPhotoMacros =
    photoResult?.macros &&
    Object.values(photoResult.macros).some((v) => v != null && v !== 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-end z-[120]">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-label="Закрити"
        onClick={onClose}
      />
      {scannerOpen && (
        <BarcodeScanner
          onDetected={async (raw) => {
            setScannerOpen(false);
            setBarcode(String(raw));
            await handleBarcodeLookup(raw);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
      <div
        ref={ref}
        className="relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft max-h-[90dvh] overflow-y-auto"
        style={{ marginBottom: kbInsetPx }}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-meal-sheet-title"
      >
        <div className="flex justify-center pt-3 pb-1 sticky top-0 bg-panel z-10">
          <div className="w-10 h-1 bg-line rounded-full" aria-hidden />
        </div>

        <div className="px-5 pb-8 pt-2">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div id="add-meal-sheet-title" className="text-lg font-extrabold text-text">
              Додати прийом їжі
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
              aria-label="Закрити"
            >
              ✕
            </button>
          </div>

          {/* Шаблони */}
          {Array.isArray(mealTemplates) && mealTemplates.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2">
                Шаблони
              </div>
              <div className="flex flex-wrap gap-2">
                {mealTemplates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setForm((s) => ({
                        ...s,
                        name: t.name,
                        mealType: t.mealType || "snack",
                        kcal: t.macros?.kcal != null ? String(Math.round(t.macros.kcal)) : "",
                        protein_g: t.macros?.protein_g != null ? String(Math.round(t.macros.protein_g)) : "",
                        fat_g: t.macros?.fat_g != null ? String(Math.round(t.macros.fat_g)) : "",
                        carbs_g: t.macros?.carbs_g != null ? String(Math.round(t.macros.carbs_g)) : "",
                        err: "",
                      }))
                    }
                    className="px-2 py-1 rounded-lg text-xs border border-line bg-panelHi hover:border-nutrition/50"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Тип прийому */}
          <div className="mb-4">
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2">
              Мілі
            </div>
            <div className="flex gap-2 flex-wrap">
              {MEAL_TYPES.map((mt) => (
                <button
                  key={mt.id}
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, mealType: mt.id }))}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all",
                    form.mealType === mt.id
                      ? "bg-nutrition text-white border-nutrition"
                      : "bg-panelHi text-muted border-line hover:border-nutrition/50",
                  )}
                >
                  {mt.emoji} {mt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Назва + час */}
          <div className="grid grid-cols-[1fr_auto] gap-3 mb-4">
            <div>
              <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-1 flex items-center gap-2">
                Назва страви
                <VoiceMicButton
                  size="sm"
                  onResult={handleVoiceMeal}
                  onError={(e) => setForm((s) => ({ ...s, err: e }))}
                  label="Голосовий ввід страви"
                />
              </div>
              <Input
                value={form.name}
                onChange={(e) => field("name")(e.target.value)}
                placeholder="Вівсянка з бананом"
                aria-label="Назва страви"
              />
            </div>
            <div>
              <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-1">
                Час
              </div>
              <Input
                type="time"
                value={form.time}
                onChange={(e) => field("time")(e.target.value)}
                aria-label="Час"
                className="w-[100px]"
              />
            </div>
          </div>

          {/* Зі складу */}
          {pantryItems.length > 0 && (
            <div className="mb-4 rounded-2xl border border-line/50 bg-panel/40 px-3 py-3">
              <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2">
                Зі складу
                {fromPantryItem && (
                  <span className="ml-2 text-nutrition font-semibold normal-case tracking-normal">
                    · {fromPantryItem}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pantryItems.slice(0, 20).map((item) => {
                  const isActive = fromPantryItem === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        if (isActive) {
                          setFromPantryItem(null);
                          setForm((s) => ({ ...s, name: s.name === item.name ? "" : s.name }));
                        } else {
                          setFromPantryItem(item.name);
                          setForm((s) => ({ ...s, name: item.name, err: "" }));
                          setFoodQuery(item.name);
                        }
                      }}
                      className={cn(
                        "px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                        isActive
                          ? "bg-nutrition text-white border-nutrition"
                          : "bg-panelHi text-text border-line hover:border-nutrition/50",
                      )}
                    >
                      {item.name}
                      {item.qty != null && (
                        <span className="ml-1 text-[10px] opacity-70">
                          {item.qty}{item.unit || "г"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ПРОДУКТ (Yazio-стиль) ── */}
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">
                Продукт
              </div>
              {(foodBusy || offBusy) && (
                <span className="text-[10px] text-subtle flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 border border-nutrition/40 border-t-nutrition rounded-full animate-spin" />
                  пошук…
                </span>
              )}
            </div>

            {!pickedFood ? (
              /* Режим пошуку */
              <>
                <Input
                  value={foodQuery}
                  onChange={(e) => setFoodQuery(e.target.value)}
                  placeholder="Курка, Activia, вівсянка, Lays…"
                  aria-label="Пошук продукту"
                />
                {foodErr && <div className="text-[11px] text-muted">{foodErr}</div>}
                {(foodHits.length > 0 || offHits.length > 0) && (
                  <div className="max-h-56 overflow-y-auto rounded-2xl border border-line/60 bg-bg shadow-sm">
                    <ul className="divide-y divide-line/20">
                      {foodHits.map((p) => (
                        <FoodHitRow
                          key={p.id}
                          p={p}
                          onPick={() => {
                            setPickedFood(p);
                            setPickedGrams(String(Math.round(p.defaultGrams || 100)));
                            setFoodQuery("");
                          }}
                        />
                      ))}
                      {offHits.length > 0 && (
                        <>
                          {foodHits.length > 0 && (
                            <li className="px-3 py-1.5 text-[10px] text-subtle bg-panelHi/50 font-semibold uppercase tracking-widest">
                              🌍 Open Food Facts
                            </li>
                          )}
                          {offHits.map((p) => (
                            <FoodHitRow
                              key={p.id}
                              p={p}
                              badge="🌍"
                              onPick={() => {
                                setPickedFood(p);
                                setPickedGrams(String(Math.round(p.defaultGrams || 100)));
                                setFoodQuery("");
                              }}
                            />
                          ))}
                        </>
                      )}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              /* Продукт вибраний — картка з live КБЖВ */
              <div className="rounded-2xl border border-nutrition/30 bg-nutrition/5 overflow-hidden">
                {/* Назва + скинути */}
                <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-text truncate">
                      {[pickedFood.name, pickedFood.brand].filter(Boolean).join(" · ")}
                      {pickedFood.source === "off" && (
                        <span className="ml-1 text-[10px] text-subtle">🌍</span>
                      )}
                    </div>
                    <div className="text-[11px] text-subtle mt-0.5">
                      {Math.round(pickedFood.per100?.kcal || 0)} ккал ·{" "}
                      Б {Math.round(pickedFood.per100?.protein_g || 0)}г ·{" "}
                      Ж {Math.round(pickedFood.per100?.fat_g || 0)}г ·{" "}
                      В {Math.round(pickedFood.per100?.carbs_g || 0)}г{" "}
                      <span className="opacity-60">/ 100г</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setPickedFood(null); setPickedGrams("100"); setFoodQuery(""); }}
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-line/50 text-muted hover:text-text hover:bg-line transition-colors text-sm"
                    aria-label="Скинути продукт"
                  >
                    ✕
                  </button>
                </div>

                {/* Порція з кроками */}
                <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
                  <div className="text-xs text-subtle font-semibold shrink-0">Порція</div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label="Зменшити"
                      onClick={() => {
                        const cur = Number(pickedGrams) || 100;
                        setPickedGrams(String(Math.max(1, cur - (cur > 50 ? 10 : 5))));
                      }}
                      className="w-8 h-8 rounded-full bg-panelHi text-text font-bold text-lg hover:bg-line transition-colors flex items-center justify-center"
                    >−</button>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={pickedGrams}
                        min={1}
                        onChange={(e) => setPickedGrams(e.target.value)}
                        aria-label="Грами"
                        className="w-[76px] text-center bg-panel border border-line rounded-xl px-2 py-2 text-sm font-bold text-text outline-none focus:border-nutrition/60 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-subtle pointer-events-none">г</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Збільшити"
                      onClick={() => {
                        const cur = Number(pickedGrams) || 100;
                        setPickedGrams(String(cur + (cur >= 50 ? 10 : 5)));
                      }}
                      className="w-8 h-8 rounded-full bg-panelHi text-text font-bold text-lg hover:bg-line transition-colors flex items-center justify-center"
                    >+</button>
                  </div>
                  {/* Швидкі порції */}
                  <div className="flex gap-1 flex-wrap">
                    {[50, 100, 150, 200].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setPickedGrams(String(g))}
                        className={cn(
                          "px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition-all",
                          Number(pickedGrams) === g
                            ? "bg-nutrition text-white border-nutrition"
                            : "bg-panelHi text-subtle border-line hover:border-nutrition/40",
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live КБЖВ плашки */}
                <div className="grid grid-cols-4 border-t border-line/20 divide-x divide-line/20">
                  <MacroChip
                    label="Ккал"
                    value={form.kcal !== "" ? Number(form.kcal) : null}
                    unit="ккал"
                    color="bg-nutrition/8 text-nutrition"
                  />
                  <MacroChip
                    label="Білки"
                    value={form.protein_g !== "" ? Number(form.protein_g) : null}
                    color="bg-panel text-text"
                  />
                  <MacroChip
                    label="Жири"
                    value={form.fat_g !== "" ? Number(form.fat_g) : null}
                    color="bg-panel text-text"
                  />
                  <MacroChip
                    label="Вуглев."
                    value={form.carbs_g !== "" ? Number(form.carbs_g) : null}
                    color="bg-panel text-text"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Штрихкод */}
          <div className="mb-4 rounded-2xl border border-line/50 bg-panel/40 px-3 py-3">
            <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2">
              Штрихкод
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Input
                value={barcode}
                onChange={(e) => { setBarcode(e.target.value.replace(/\s+/g, "")); setBarcodeStatus(""); }}
                inputMode="numeric"
                placeholder="EAN/UPC…"
                aria-label="Штрихкод"
                className="w-[160px]"
              />
              <Button type="button" variant="ghost" className="h-9 text-xs" onClick={() => handleBarcodeLookup(barcode)}>
                Знайти
              </Button>
              <Button type="button" variant="ghost" className="h-9 text-xs" onClick={() => handleBarcodeBind(barcode)}>
                Прив'язати
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 text-xs"
                onClick={() => { setBarcodeStatus(""); setScannerOpen(true); }}
              >
                📷 Сканувати
              </Button>
            </div>
            {barcodeStatus && <div className="text-[11px] text-subtle mt-1">{barcodeStatus}</div>}
          </div>

          {/* КБЖВ — ручне редагування */}
          <div className="mb-1">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">
                {pickedFood ? "КБЖВ (редагувати вручну)" : "КБЖВ"}
              </div>
              {hasPhotoMacros && (
                <button
                  type="button"
                  onClick={() =>
                    setForm((s) => ({
                      ...s,
                      ...emptyForm(photoResult),
                      mealType: s.mealType,
                      time: s.time,
                      name: s.name,
                      err: "",
                    }))
                  }
                  className="text-[11px] text-nutrition font-semibold hover:underline"
                >
                  ← З результату фото
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: "kcal", label: "Ккал", placeholder: "350" },
                { key: "protein_g", label: "Білки г", placeholder: "12" },
                { key: "fat_g", label: "Жири г", placeholder: "6" },
                { key: "carbs_g", label: "Вуглев. г", placeholder: "60" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-1">
                    {label}
                  </div>
                  <Input
                    value={form[key]}
                    onChange={(e) => {
                      if (pickedFood) setPickedFood(null);
                      field(key)(e.target.value);
                    }}
                    inputMode="decimal"
                    placeholder={placeholder}
                    aria-label={label}
                  />
                </div>
              ))}
            </div>
            {pickedFood && (
              <div className="text-[11px] text-subtle mt-1.5">
                Редагування вручну відʼєднає від продукту
              </div>
            )}
          </div>

          {/* Зберегти як продукт */}
          {!pickedFood && (
            <div className="mt-3 mb-1">
              <Button
                type="button"
                variant="ghost"
                className="h-9 text-xs"
                onClick={async () => {
                  const name = String(form.name || "").trim();
                  if (!name) {
                    setForm((s) => ({ ...s, err: "Введіть назву, щоб зберегти продукт." }));
                    return;
                  }
                  const kcal = form.kcal === "" ? 0 : Number(form.kcal);
                  const protein_g = form.protein_g === "" ? 0 : Number(form.protein_g);
                  const fat_g = form.fat_g === "" ? 0 : Number(form.fat_g);
                  const carbs_g = form.carbs_g === "" ? 0 : Number(form.carbs_g);
                  if ([kcal, protein_g, fat_g, carbs_g].some((n) => !Number.isFinite(n) || n < 0)) {
                    setForm((s) => ({ ...s, err: "КБЖВ має бути числами (без від'ємних значень)." }));
                    return;
                  }
                  const res = await upsertFood({
                    name,
                    per100: { kcal, protein_g, fat_g, carbs_g },
                    defaultGrams: 100,
                  });
                  if (!res.ok) { setFoodErr(res.error || "Не вдалося зберегти продукт."); return; }
                  setPickedFood(res.product);
                  setPickedGrams("100");
                  setFoodQuery(name);
                  setFoodErr("");
                }}
              >
                + Зберегти як продукт (на 100г)
              </Button>
            </div>
          )}

          {form.err && (
            <div className="text-xs text-danger mt-2">{form.err}</div>
          )}

          {typeof setPrefs === "function" && (
            <div className="mt-3">
              <button
                type="button"
                className="text-xs text-nutrition font-semibold hover:underline"
                onClick={() => {
                  const name = form.name.trim();
                  if (!name) {
                    setForm((s) => ({ ...s, err: "Спочатку введіть назву для шаблону." }));
                    return;
                  }
                  const kcal = form.kcal === "" ? 0 : Number(form.kcal);
                  const protein_g = form.protein_g === "" ? 0 : Number(form.protein_g);
                  const fat_g = form.fat_g === "" ? 0 : Number(form.fat_g);
                  const carbs_g = form.carbs_g === "" ? 0 : Number(form.carbs_g);
                  if ([kcal, protein_g, fat_g, carbs_g].some((n) => !Number.isFinite(n))) {
                    setForm((s) => ({ ...s, err: "Некоректне КБЖВ для шаблону." }));
                    return;
                  }
                  setPrefs((p) => ({
                    ...p,
                    mealTemplates: [
                      ...(Array.isArray(p.mealTemplates) ? p.mealTemplates : []),
                      {
                        id: `tpl_${Date.now()}`,
                        name,
                        mealType: form.mealType,
                        macros: { kcal, protein_g, fat_g, carbs_g },
                      },
                    ].slice(0, 40),
                  }));
                }}
              >
                + Зберегти як шаблон
              </button>
            </div>
          )}

          {/* Кнопки */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              type="button"
              className="h-12 min-h-[44px] bg-nutrition text-white hover:bg-nutrition-hover"
              onClick={handleSave}
            >
              Зберегти
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-12 min-h-[44px]"
              onClick={onClose}
            >
              Скасувати
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
