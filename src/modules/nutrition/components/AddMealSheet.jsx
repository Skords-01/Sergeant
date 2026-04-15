import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@shared/components/ui/Input";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/lib/cn";
import { useDialogFocusTrap } from "@shared/hooks/useDialogFocusTrap";
import { MEAL_TYPES } from "../lib/mealTypes.js";
import { VoiceMicButton } from "@shared/components/ui/VoiceMicButton.jsx";
import { parseMealSpeech } from "../../../core/lib/speechParsers.js";
import {
  ensureSeedFoods,
  macrosForGrams,
  exportFoodDbJson,
  importFoodDbJson,
  lookupFoodByBarcode,
  bindBarcodeToFood,
  searchFoods,
  upsertFood,
} from "../lib/foodDb/foodDb.js";
import { downloadBlob } from "../lib/nutritionLogExport.js";

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
    protein_g:
      macros.protein_g != null ? String(Math.round(macros.protein_g)) : "",
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
  mealTemplates = [],
  setPrefs,
}) {
  const ref = useRef(null);
  const [form, setForm] = useState(() => emptyForm(null));
  const [foodQuery, setFoodQuery] = useState("");
  const [foodHits, setFoodHits] = useState([]);
  const [foodBusy, setFoodBusy] = useState(false);
  const [pickedFood, setPickedFood] = useState(null);
  const [pickedGrams, setPickedGrams] = useState("100");
  const [foodErr, setFoodErr] = useState("");
  const [barcode, setBarcode] = useState("");
  const [barcodeStatus, setBarcodeStatus] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const foodImportRef = useRef(null);

  useDialogFocusTrap(open, ref, { onEscape: onClose });

  useEffect(() => {
    if (open) {
      setForm(emptyForm(photoResult));
      setFoodQuery("");
      setFoodHits([]);
      setPickedFood(null);
      setPickedGrams("100");
      setFoodErr("");
      setBarcode("");
      setBarcodeStatus("");
      setScannerOpen(false);
      void ensureSeedFoods();
    }
  }, [open, photoResult]);

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
    const mealLabel =
      MEAL_TYPES.find((m) => m.id === form.mealType)?.label || "Прийом їжі";
    const source = photoResult ? "photo" : "manual";
    const macroSource = photoResult
      ? "photoAI"
      : pickedFood
        ? "productDb"
        : "manual";
    onSave({
      id: `meal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      time: form.time || currentTime(),
      mealType: form.mealType,
      label: mealLabel,
      name,
      macros: { kcal, protein_g, fat_g, carbs_g },
      source,
      macroSource,
    });
  }

  useEffect(() => {
    const q = foodQuery.trim();
    if (!q) {
      setFoodHits([]);
      setFoodErr("");
      return;
    }
    let cancelled = false;
    setFoodBusy(true);
    setFoodErr("");
    const id = window.setTimeout(() => {
      (async () => {
        const hits = await searchFoods(q, 12);
        if (!cancelled) setFoodHits(hits);
        if (!cancelled && hits.length === 0)
          setFoodErr("Нічого не знайдено в базі продуктів.");
      })()
        .catch(() => {
          if (!cancelled) setFoodErr("Не вдалося виконати пошук.");
        })
        .finally(() => {
          if (!cancelled) setFoodBusy(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [foodQuery]);

  const applyPickedFood = useCallback((p, gramsRaw) => {
    const g = Number(
      String(gramsRaw || "")
        .trim()
        .replace(",", "."),
    );
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

  const handleBarcodeLookup = useCallback(
    async (codeRaw) => {
      const code = String(codeRaw || "").trim();
      if (!code) return;
      setBarcodeStatus("Шукаю…");
      const found = await lookupFoodByBarcode(code);
      if (!found) {
        setBarcodeStatus("Не знайдено. Можна прив’язати до продукту.");
        return;
      }
      setBarcodeStatus("Знайдено ✔");
      setPickedFood(found);
      setPickedGrams(String(Math.round(found.defaultGrams || 100)));
      applyPickedFood(found, String(found.defaultGrams || 100));
    },
    [applyPickedFood],
  );

  async function handleBarcodeBind(codeRaw) {
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
    setBarcodeStatus(ok ? "Прив’язано ✔" : "Не вдалося прив’язати");
  }

  useEffect(() => {
    if (!scannerOpen) return;
    let stopped = false;
    let raf = 0;

    const stop = () => {
      try {
        const s = streamRef.current;
        if (s) for (const t of s.getTracks()) t.stop();
      } catch {
        /* ignore */
      }
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const run = async () => {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          setBarcodeStatus("Камера недоступна в цьому браузері.");
          setScannerOpen(false);
          return;
        }
        const Detector = window.BarcodeDetector;
        if (!Detector) {
          setBarcodeStatus("Сканер не підтримується (BarcodeDetector).");
          setScannerOpen(false);
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (stopped) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new Detector({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"],
        });

        const tick = async () => {
          if (stopped) return;
          try {
            const v = videoRef.current;
            if (v && v.readyState >= 2) {
              const codes = await detector.detect(v);
              const raw = codes?.[0]?.rawValue;
              if (raw) {
                setBarcode(String(raw));
                setScannerOpen(false);
                stop();
                await handleBarcodeLookup(raw);
                return;
              }
            }
          } catch {
            /* ignore */
          }
          raf = window.requestAnimationFrame(tick);
        };
        raf = window.requestAnimationFrame(tick);
      } catch {
        setBarcodeStatus("Не вдалося відкрити камеру.");
        setScannerOpen(false);
      }
    };

    void run();
    return () => {
      stopped = true;
      if (raf) window.cancelAnimationFrame(raf);
      stop();
    };
  }, [scannerOpen, handleBarcodeLookup]);

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
        <div className="absolute inset-0 z-[130] flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-3xl border border-line bg-panel shadow-soft overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-line/50">
              <div className="text-sm font-extrabold text-text">
                Сканер штрихкоду
              </div>
              <button
                type="button"
                onClick={() => setScannerOpen(false)}
                className="w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
                aria-label="Закрити сканер"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-2">
              <div className="rounded-2xl overflow-hidden border border-line/50 bg-black">
                <video
                  ref={videoRef}
                  className="w-full aspect-[3/4] object-cover"
                  muted
                  playsInline
                />
              </div>
              <div className="text-[11px] text-subtle">
                Наведи камеру на штрихкод. Якщо нічого не зчитує — введи код
                вручну.
              </div>
            </div>
          </div>
        </div>
      )}
      <div
        ref={ref}
        className="relative w-full bg-panel border-t border-line rounded-t-3xl shadow-soft max-h-[90dvh] overflow-y-auto"
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
            <div
              id="add-meal-sheet-title"
              className="text-lg font-extrabold text-text"
            >
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
                        kcal:
                          t.macros?.kcal != null
                            ? String(Math.round(t.macros.kcal))
                            : "",
                        protein_g:
                          t.macros?.protein_g != null
                            ? String(Math.round(t.macros.protein_g))
                            : "",
                        fat_g:
                          t.macros?.fat_g != null
                            ? String(Math.round(t.macros.fat_g))
                            : "",
                        carbs_g:
                          t.macros?.carbs_g != null
                            ? String(Math.round(t.macros.carbs_g))
                            : "",
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

          {/* Мілі */}
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

          {/* База продуктів */}
          <div className="mb-4 rounded-2xl border border-line/50 bg-panel/40 px-3 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">
                База продуктів (локально)
              </div>
              <span className="text-[10px] text-subtle">
                {foodBusy ? "пошук…" : ""}
              </span>
            </div>
            <Input
              value={foodQuery}
              onChange={(e) => setFoodQuery(e.target.value)}
              placeholder="Пошук: курка, вівсянка, йогурт…"
              aria-label="Пошук у базі продуктів"
            />
            {pickedFood && (
              <div className="flex flex-wrap gap-2 items-center">
                <div className="text-xs text-text font-semibold min-w-0 truncate">
                  Обрано:{" "}
                  {[pickedFood.name, pickedFood.brand]
                    .filter(Boolean)
                    .join(" ")}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={pickedGrams}
                    onChange={(e) => setPickedGrams(e.target.value)}
                    inputMode="decimal"
                    aria-label="Грами"
                    className="w-[92px]"
                    placeholder="г"
                  />
                  <span className="text-xs text-subtle">г</span>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 text-xs"
                    onClick={() => applyPickedFood(pickedFood, pickedGrams)}
                  >
                    Підставити КБЖВ
                  </Button>
                </div>
              </div>
            )}
            {foodErr && <div className="text-[11px] text-muted">{foodErr}</div>}
            {!pickedFood && foodHits.length > 0 && (
              <div className="max-h-44 overflow-y-auto rounded-xl border border-line/40 bg-bg/40">
                <ul className="divide-y divide-line/30">
                  {foodHits.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-panelHi/60 transition-colors"
                        onClick={() => {
                          setPickedFood(p);
                          setPickedGrams(
                            String(Math.round(p.defaultGrams || 100)),
                          );
                          applyPickedFood(p, String(p.defaultGrams || 100));
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm text-text font-semibold truncate">
                            {[p.name, p.brand].filter(Boolean).join(" ")}
                          </div>
                          <div className="text-[11px] text-subtle shrink-0">
                            {Math.round(p.per100?.kcal || 0)} ккал/100г
                          </div>
                        </div>
                        <div className="text-[11px] text-subtle mt-0.5">
                          Б {Math.round(p.per100?.protein_g || 0)} • Ж{" "}
                          {Math.round(p.per100?.fat_g || 0)} • В{" "}
                          {Math.round(p.per100?.carbs_g || 0)}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-9 text-xs"
                onClick={async () => {
                  const name = String(form.name || "").trim();
                  if (!name) {
                    setForm((s) => ({
                      ...s,
                      err: "Введіть назву, щоб зберегти продукт.",
                    }));
                    return;
                  }
                  const kcal = form.kcal === "" ? 0 : Number(form.kcal);
                  const protein_g =
                    form.protein_g === "" ? 0 : Number(form.protein_g);
                  const fat_g = form.fat_g === "" ? 0 : Number(form.fat_g);
                  const carbs_g =
                    form.carbs_g === "" ? 0 : Number(form.carbs_g);
                  if (
                    [kcal, protein_g, fat_g, carbs_g].some(
                      (n) => !Number.isFinite(n) || n < 0,
                    )
                  ) {
                    setForm((s) => ({
                      ...s,
                      err: "КБЖВ має бути числами (без від’ємних значень).",
                    }));
                    return;
                  }
                  const res = await upsertFood({
                    name,
                    per100: { kcal, protein_g, fat_g, carbs_g },
                    defaultGrams: 100,
                  });
                  if (!res.ok) {
                    setFoodErr(res.error || "Не вдалося зберегти продукт.");
                    return;
                  }
                  setPickedFood(res.product);
                  setPickedGrams("100");
                  setFoodQuery(name);
                  setFoodErr("");
                }}
              >
                + Зберегти як продукт (на 100г)
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 text-xs"
                onClick={async () => {
                  const payload = await exportFoodDbJson();
                  if (!payload) {
                    setFoodErr("Не вдалося експортувати базу продуктів.");
                    return;
                  }
                  downloadBlob(
                    `nutrition-fooddb-${new Date().toISOString().slice(0, 10)}.json`,
                    "application/json",
                    JSON.stringify(payload, null, 2),
                  );
                }}
              >
                Експорт JSON
              </Button>
              <input
                ref={foodImportRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = async () => {
                    try {
                      const text = String(reader.result || "");
                      const parsed = JSON.parse(text);
                      const res = await importFoodDbJson(parsed, "merge");
                      setFoodErr(
                        res.ok
                          ? `Імпортовано: +${res.added}`
                          : res.error || "Помилка імпорту",
                      );
                    } catch {
                      setFoodErr("Некоректний файл імпорту.");
                    } finally {
                      e.target.value = "";
                    }
                  };
                  reader.readAsText(f);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                className="h-9 text-xs"
                onClick={() => foodImportRef.current?.click()}
              >
                Імпорт (merge)
              </Button>
            </div>

            <div className="pt-1 border-t border-line/30">
              <div className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-2">
                Штрихкод (опційно)
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Input
                  value={barcode}
                  onChange={(e) => {
                    setBarcode(e.target.value.replace(/\s+/g, ""));
                    setBarcodeStatus("");
                  }}
                  inputMode="numeric"
                  placeholder="EAN/UPC…"
                  aria-label="Штрихкод"
                  className="w-[180px]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 text-xs"
                  onClick={() => handleBarcodeLookup(barcode)}
                >
                  Знайти
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 text-xs"
                  onClick={() => handleBarcodeBind(barcode)}
                >
                  Прив’язати до обраного
                </Button>
                {"BarcodeDetector" in window &&
                  navigator?.mediaDevices?.getUserMedia && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 text-xs"
                      onClick={() => {
                        setBarcodeStatus("");
                        setScannerOpen(true);
                      }}
                    >
                      Сканувати
                    </Button>
                  )}
              </div>
              {barcodeStatus && (
                <div className="text-[11px] text-subtle mt-1">
                  {barcodeStatus}
                </div>
              )}
            </div>
          </div>

          {/* КБЖВ */}
          <div className="mb-1">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-bold text-subtle uppercase tracking-widest">
                КБЖВ
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
                    onChange={(e) => field(key)(e.target.value)}
                    inputMode="decimal"
                    placeholder={placeholder}
                    aria-label={label}
                  />
                </div>
              ))}
            </div>
          </div>

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
                    setForm((s) => ({
                      ...s,
                      err: "Спочатку введіть назву для шаблону.",
                    }));
                    return;
                  }
                  const kcal = form.kcal === "" ? 0 : Number(form.kcal);
                  const protein_g =
                    form.protein_g === "" ? 0 : Number(form.protein_g);
                  const fat_g = form.fat_g === "" ? 0 : Number(form.fat_g);
                  const carbs_g =
                    form.carbs_g === "" ? 0 : Number(form.carbs_g);
                  if (
                    [kcal, protein_g, fat_g, carbs_g].some(
                      (n) => !Number.isFinite(n),
                    )
                  ) {
                    setForm((s) => ({
                      ...s,
                      err: "Некоректне КБЖВ для шаблону.",
                    }));
                    return;
                  }
                  setPrefs((p) => ({
                    ...p,
                    mealTemplates: [
                      ...(Array.isArray(p.mealTemplates)
                        ? p.mealTemplates
                        : []),
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
