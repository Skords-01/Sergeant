import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@shared/components/ui/Card";
import { Input } from "@shared/components/ui/Input";
import { cn } from "@shared/lib/cn";

function friendlyApiError(status, message) {
  const m = message || "";
  if (status === 500 && /ANTHROPIC|not set|key/i.test(m)) {
    return "Сервер харчування не налаштовано (немає ключа AI).";
  }
  if (status === 413) return "Занадто велике фото. Стисни/обріж і спробуй ще раз.";
  if (status === 429) return "Забагато запитів. Спробуй через хвилину.";
  if (status === 401 || status === 403) return "Доступ заборонено.";
  return m || `Помилка ${status}`;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const raw = await res.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error: raw || "Некоректна відповідь сервера" };
  }
  if (!res.ok) throw new Error(friendlyApiError(res.status, data?.error));
  return data;
}

function fmtMacro(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Math.round(Number(n));
}

export default function NutritionApp() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [statusText, setStatusText] = useState("");

  const [pantryText, setPantryText] = useState("");
  const [pantryItems, setPantryItems] = useState([]);

  const [prefs, setPrefs] = useState({
    goal: "balanced",
    servings: 1,
    timeMinutes: 25,
    exclude: "",
  });

  const fileRef = useRef(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [photoResult, setPhotoResult] = useState(null);
  const [lastPhotoPayload, setLastPhotoPayload] = useState(null);
  const [answers, setAnswers] = useState({});
  const [portionGrams, setPortionGrams] = useState("");

  const [recipes, setRecipes] = useState([]);
  const [recipesTried, setRecipesTried] = useState(false);

  const pantrySummary = useMemo(() => {
    if (!Array.isArray(pantryItems) || pantryItems.length === 0) return "—";
    return pantryItems
      .slice(0, 12)
      .map((x) => x.name)
      .filter(Boolean)
      .join(", ");
  }, [pantryItems]);

  const onPickPhoto = async (file) => {
    setErr("");
    setPhotoResult(null);
    if (!file) return;
    if (!/^image\//.test(file.type || "")) {
      setErr("Обери файл зображення (jpg/png/heic).");
      return;
    }
    if (file.size > 4.5 * 1024 * 1024) {
      setErr("Фото завелике для швидкого аналізу. Обріж або стисни (≈ до 4 МБ).");
      return;
    }
    try {
      const url = URL.createObjectURL(file);
      setPhotoPreviewUrl(url);
    } catch {
      /* ignore */
    }
  };

  const analyzePhoto = async () => {
    setBusy(true);
    setErr("");
    setStatusText("Аналізую фото…");
    setPhotoResult(null);
    setAnswers({});
    setPortionGrams("");
    try {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("Спочатку обери фото.");
      const b64 = await fileToBase64(file);
      const payload = {
        image_base64: b64,
        mime_type: file.type || "image/jpeg",
        locale: "uk-UA",
      };
      setLastPhotoPayload(payload);
      const data = await postJson("/api/nutrition/analyze-photo", payload);
      setPhotoResult(data?.result || null);
    } catch (e) {
      setErr(e?.message || "Помилка аналізу фото");
    } finally {
      setStatusText("");
      setBusy(false);
    }
  };

  const refinePhoto = async () => {
    setBusy(true);
    setErr("");
    setStatusText("Уточнюю порцію та перераховую…");
    try {
      if (!lastPhotoPayload) throw new Error("Немає вихідного фото. Спочатку зроби аналіз.");
      const questions = Array.isArray(photoResult?.questions)
        ? photoResult.questions.slice(0, 6)
        : [];
      const qna = questions
        .map((q) => ({ question: q, answer: String(answers[q] || "").trim() }))
        .filter((x) => x.answer);
      const grams = Number(String(portionGrams).replace(",", "."));
      const data = await postJson("/api/nutrition/refine-photo", {
        ...lastPhotoPayload,
        prior_result: photoResult,
        portion_grams: Number.isFinite(grams) && grams > 0 ? grams : null,
        qna,
        locale: "uk-UA",
      });
      setPhotoResult(data?.result || null);
    } catch (e) {
      setErr(e?.message || "Помилка уточнення");
    } finally {
      setStatusText("");
      setBusy(false);
    }
  };

  const parsePantry = async () => {
    setBusy(true);
    setErr("");
    setStatusText("Розбираю список…");
    try {
      if (!pantryText.trim()) throw new Error("Надиктуй/впиши список продуктів.");
      const data = await postJson("/api/nutrition/parse-pantry", {
        text: pantryText.trim(),
        locale: "uk-UA",
      });
      setPantryItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      setErr(e?.message || "Помилка розбору списку");
    } finally {
      setStatusText("");
      setBusy(false);
    }
  };

  const recommendRecipes = async () => {
    setBusy(true);
    setErr("");
    setRecipes([]);
    setRecipesTried(true);
    setStatusText("Генерую рецепти…");
    try {
      const items =
        pantryItems.length > 0
          ? pantryItems
          : pantryText.trim()
            ? [{ name: pantryText.trim() }]
            : [];
      if (items.length === 0) throw new Error("Дай хоча б 2–3 продукти для рецептів.");
      const data = await postJson("/api/nutrition/recommend-recipes", {
        items,
        preferences: {
          goal: prefs.goal,
          servings: Number(prefs.servings) || 1,
          timeMinutes: Number(prefs.timeMinutes) || 25,
          exclude: String(prefs.exclude || ""),
          locale: "uk-UA",
        },
      });
      setRecipes(Array.isArray(data?.recipes) ? data.recipes : []);
    } catch (e) {
      setErr(e?.message || "Помилка рекомендацій");
    } finally {
      setStatusText("");
      setBusy(false);
    }
  };

  const speech = useSpeech((t) => {
    if (!t) return;
    setPantryText((cur) => (cur ? `${cur}${cur.endsWith(",") ? " " : ", "}${t}` : t));
  });

  useEffect(() => {
    if (photoResult && Array.isArray(photoResult.questions)) {
      setAnswers((cur) => {
        const next = { ...cur };
        photoResult.questions.slice(0, 6).forEach((q) => {
          if (next[q] == null) next[q] = "";
        });
        return next;
      });
    }
  }, [photoResult]);

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-6 pb-24 max-w-2xl mx-auto w-full">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-text tracking-tight">
          Харчування
        </h1>
        <p className="text-sm text-subtle mt-1">
          Фото → приблизне КБЖВ · голос/текст → інгредієнти · рецепти з порадами
        </p>
      </div>

      {(err || statusText) && (
        <div className="mb-4 rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {err || statusText}
        </div>
      )}

      <div className="grid gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text">
                Аналіз фото страви
              </div>
              <div className="text-xs text-subtle mt-0.5">
                Повертає оцінку КБЖВ і питання для уточнення порції.
              </div>
            </div>
            <button
              type="button"
              onClick={analyzePhoto}
              disabled={busy}
              className={cn(
                "shrink-0 px-4 h-10 rounded-xl text-sm font-medium",
                "bg-primary text-white hover:brightness-110 disabled:opacity-50",
              )}
            >
              Аналізувати
            </button>
          </div>

          <div className="mt-3 grid gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => onPickPhoto(e.target.files?.[0])}
              className="block w-full text-sm text-subtle file:mr-3 file:rounded-xl file:border file:border-line file:bg-panel file:px-3 file:py-2 file:text-sm file:font-medium file:text-text hover:file:border-muted"
              aria-label="Обрати фото страви"
              disabled={busy}
            />

            {photoPreviewUrl && (
              <div className="rounded-2xl border border-line overflow-hidden bg-panel">
                <img
                  src={photoPreviewUrl}
                  alt="Обране фото"
                  className="w-full max-h-[320px] object-cover"
                />
              </div>
            )}

            {photoResult && (
              <div className="rounded-2xl border border-line bg-panel p-4">
                <div className="text-sm font-semibold text-text">
                  {photoResult.dishName || "Результат"}
                </div>
                <div className="text-xs text-subtle mt-1">
                  Впевненість:{" "}
                  {photoResult.confidence != null
                    ? `${Math.round(photoResult.confidence * 100)}%`
                    : "—"}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl border border-line bg-bg px-3 py-2">
                    <div className="text-[11px] text-subtle">Ккал</div>
                    <div className="font-semibold">
                      {fmtMacro(photoResult.macros?.kcal)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-line bg-bg px-3 py-2">
                    <div className="text-[11px] text-subtle">Б/Ж/В (г)</div>
                    <div className="font-semibold">
                      {fmtMacro(photoResult.macros?.protein_g)}/
                      {fmtMacro(photoResult.macros?.fat_g)}/
                      {fmtMacro(photoResult.macros?.carbs_g)}
                    </div>
                  </div>
                </div>

                {Array.isArray(photoResult.ingredients) &&
                  photoResult.ingredients.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs text-subtle mb-1">Інгредієнти</div>
                      <div className="text-sm text-text">
                        {photoResult.ingredients
                          .map((x) => x.name)
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    </div>
                  )}

                {Array.isArray(photoResult.questions) &&
                  photoResult.questions.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs text-subtle mb-1">
                        Уточнення (щоб точніше порахувати)
                      </div>
                      <ul className="list-disc pl-5 text-sm text-text space-y-1">
                        {photoResult.questions.slice(0, 3).map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>

                      <div className="mt-3 grid gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <div className="text-[11px] text-subtle mb-1">
                              Порція (г) якщо знаєш
                            </div>
                            <Input
                              value={portionGrams}
                              onChange={(e) => setPortionGrams(e.target.value)}
                              inputMode="decimal"
                              placeholder="напр. 320"
                              disabled={busy}
                            />
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={refinePhoto}
                              disabled={busy}
                              className={cn(
                                "w-full h-11 rounded-2xl text-sm font-semibold",
                                "bg-panel border border-line text-text hover:border-muted disabled:opacity-50",
                              )}
                            >
                              Перерахувати
                            </button>
                          </div>
                        </div>

                        {photoResult.questions.slice(0, 3).map((q) => (
                          <div key={q}>
                            <div className="text-[11px] text-subtle mb-1">{q}</div>
                            <Input
                              value={answers[q] || ""}
                              onChange={(e) =>
                                setAnswers((a) => ({ ...a, [q]: e.target.value }))
                              }
                              placeholder="твоя відповідь…"
                              disabled={busy}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text">
                Продукти вдома (голос/текст)
              </div>
              <div className="text-xs text-subtle mt-0.5">
                Впиши або надиктуй, потім натисни “Розібрати”.
              </div>
            </div>
            <button
              type="button"
              onClick={parsePantry}
              disabled={busy}
              className={cn(
                "shrink-0 px-4 h-10 rounded-xl text-sm font-medium",
                "bg-panel border border-line text-text hover:border-muted disabled:opacity-50",
              )}
            >
              Розібрати
            </button>
          </div>

          <div className="mt-3 grid gap-3">
            <div className="flex gap-2 items-start">
              <textarea
                value={pantryText}
                onChange={(e) => setPantryText(e.target.value)}
                placeholder={'Напр.: \"2 яйця, курка, рис, огірки, сир, йогурт\"'}
                className="flex-1 min-h-[96px] rounded-2xl bg-panel border border-line px-4 py-3 text-sm text-text outline-none focus:border-primary/60 placeholder:text-subtle transition-colors"
                disabled={busy}
              />
              {speech.supported && (
                <button
                  type="button"
                  onClick={speech.toggle}
                  disabled={busy}
                  className={cn(
                    "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all border",
                    speech.listening
                      ? "bg-danger text-white border-danger animate-pulse"
                      : "bg-panel border-line text-muted hover:text-text hover:border-muted",
                  )}
                  title={speech.listening ? "Зупинити запис" : "Голосовий ввід"}
                  aria-label={speech.listening ? "Зупинити запис" : "Голосовий ввід"}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill={speech.listening ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>
              )}
            </div>
            <div className="text-xs text-subtle">
              Розібрано:{" "}
              <span className="text-text">
                {pantryItems.length ? `${pantryItems.length} позицій` : "—"}
              </span>
              {pantryItems.length > 0 && (
                <>
                  {" "}
                  · <span className="text-text">{pantrySummary}</span>
                </>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold text-text">Рецепти</div>
          <div className="text-xs text-subtle mt-0.5">
            Рекомендації на базі продуктів. Можна вказати час, порції та “не хочу”.
          </div>

          <div className="mt-3 grid gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-subtle mb-1">Ціль</div>
                <select
                  value={prefs.goal}
                  onChange={(e) => setPrefs((p) => ({ ...p, goal: e.target.value }))}
                  className="w-full h-11 rounded-2xl bg-panel border border-line px-4 text-sm text-text outline-none focus:border-primary/60"
                  disabled={busy}
                >
                  <option value="balanced">Збалансовано</option>
                  <option value="high_protein">Більше білка</option>
                  <option value="low_cal">Менше калорій</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] text-subtle mb-1">Порції</div>
                  <Input
                    value={String(prefs.servings)}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, servings: e.target.value }))
                    }
                    inputMode="numeric"
                    disabled={busy}
                  />
                </div>
                <div>
                  <div className="text-[11px] text-subtle mb-1">Хвилин</div>
                  <Input
                    value={String(prefs.timeMinutes)}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, timeMinutes: e.target.value }))
                    }
                    inputMode="numeric"
                    disabled={busy}
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-subtle mb-1">
                Не використовувати / алергени
              </div>
              <Input
                value={prefs.exclude}
                onChange={(e) => setPrefs((p) => ({ ...p, exclude: e.target.value }))}
                placeholder="напр. арахіс, гриби"
                disabled={busy}
              />
            </div>

            <button
              type="button"
              onClick={recommendRecipes}
              disabled={busy}
              className={cn(
                "w-full h-11 rounded-2xl text-sm font-semibold",
                "bg-primary text-white hover:brightness-110 disabled:opacity-50",
              )}
            >
              Запропонувати рецепти
            </button>

            {recipes.length > 0 && (
              <div className="grid gap-3">
                {recipes.map((r, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-line bg-panel p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-text">
                          {r.title || `Рецепт ${idx + 1}`}
                        </div>
                        <div className="text-xs text-subtle mt-1">
                          {r.timeMinutes ? `${r.timeMinutes} хв` : "—"} ·{" "}
                          {r.servings ? `${r.servings} порц.` : "—"}
                        </div>
                      </div>
                      {r.macros?.kcal != null && (
                        <div className="shrink-0 rounded-xl border border-line bg-bg px-3 py-2 text-xs text-subtle">
                          <div className="text-[10px] text-subtle">≈ ккал</div>
                          <div className="text-sm font-semibold text-text">
                            {fmtMacro(r.macros.kcal)}
                          </div>
                        </div>
                      )}
                    </div>

                    {Array.isArray(r.ingredients) && r.ingredients.length > 0 && (
                      <div className="mt-3 text-sm text-text">
                        <div className="text-xs text-subtle mb-1">
                          Інгредієнти
                        </div>
                        {r.ingredients.join(", ")}
                      </div>
                    )}

                    {Array.isArray(r.steps) && r.steps.length > 0 && (
                      <div className="mt-3 text-sm text-text">
                        <div className="text-xs text-subtle mb-1">Кроки</div>
                        <ol className="list-decimal pl-5 space-y-1">
                          {r.steps.slice(0, 10).map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {Array.isArray(r.tips) && r.tips.length > 0 && (
                      <div className="mt-3 text-sm text-text">
                        <div className="text-xs text-subtle mb-1">Поради</div>
                        <ul className="list-disc pl-5 space-y-1">
                          {r.tips.slice(0, 6).map((t, i) => (
                            <li key={i}>{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {recipesTried && !busy && recipes.length === 0 && !err && (
              <div className="rounded-2xl border border-line bg-panel p-4 text-sm text-subtle">
                Рецептів не повернулося. Спробуй уточнити список продуктів або зняти обмеження.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function useSpeech(onResult) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const cbRef = useRef(onResult);
  cbRef.current = onResult;

  const supported =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const toggle = () => {
    if (!supported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (listening) {
      recRef.current?.abort();
      setListening(false);
      return;
    }
    const rec = new SR();
    recRef.current = rec;
    rec.lang = "uk-UA";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript;
      if (transcript) cbRef.current(transcript.trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  };

  return { listening, toggle, supported };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не вдалося прочитати файл"));
    reader.onload = () => {
      const s = String(reader.result || "");
      const idx = s.indexOf("base64,");
      resolve(idx >= 0 ? s.slice(idx + 7) : s);
    };
    reader.readAsDataURL(file);
  });
}

