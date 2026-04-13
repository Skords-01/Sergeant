import { Button } from "@shared/components/ui/Button";
import { recoveryConflictsForWorkoutItem } from "../../lib/recoveryConflict";

function isoToDatetimeLocalValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalValueToIso(value) {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function ActiveWorkoutPanel({
  activeWorkout,
  activeDuration,
  lastByExerciseId,
  musclesUk,
  recBy,
  removeItem,
  updateItem,
  updateWorkout,
  setRestTimer,
  onFinishClick,
  onDeleteWorkout,
}) {
  if (!activeWorkout) return null;
  return (
    <div className="bg-panel border border-line/60 rounded-2xl p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-text">Активне тренування</div>
          <div className="text-xs text-subtle mt-0.5">
            {new Date(activeWorkout.startedAt).toLocaleString("uk-UA", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {activeDuration ? (
              <span className="ml-2">· {activeDuration}</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!activeWorkout.endedAt ? (
            <Button
              size="sm"
              className="h-9 px-4"
              type="button"
              onClick={onFinishClick}
            >
              Завершити
            </Button>
          ) : (
            <span className="text-xs text-subtle">Завершено</span>
          )}
          <Button
            variant="danger"
            size="sm"
            className="h-9 px-4"
            type="button"
            onClick={onDeleteWorkout}
          >
            Видалити
          </Button>
        </div>
      </div>

      <details className="mt-3 rounded-xl border border-line/60 bg-panelHi/50 px-3 py-2">
        <summary className="text-xs font-semibold text-subtle cursor-pointer select-none">
          Час тренування
        </summary>
        <div className="mt-2 space-y-2">
          <label className="block text-[10px] text-subtle">Початок</label>
          <input
            type="datetime-local"
            className="w-full h-11 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
            value={isoToDatetimeLocalValue(activeWorkout.startedAt)}
            onChange={(e) => {
              const iso = datetimeLocalValueToIso(e.target.value);
              if (iso) updateWorkout(activeWorkout.id, { startedAt: iso });
            }}
          />
          {activeWorkout.endedAt ? (
            <>
              <label className="block text-[10px] text-subtle">
                Завершення (можна виправити після занесення)
              </label>
              <input
                type="datetime-local"
                className="w-full h-11 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                value={isoToDatetimeLocalValue(activeWorkout.endedAt)}
                onChange={(e) => {
                  const iso = datetimeLocalValueToIso(e.target.value);
                  updateWorkout(activeWorkout.id, { endedAt: iso || null });
                }}
              />
            </>
          ) : null}
        </div>
      </details>

      <div className="mt-3 space-y-2">
        {(activeWorkout.items || []).length === 0 ? (
          <div className="text-sm text-subtle text-center py-6">
            Додай вправи, щоб почати логувати
          </div>
        ) : (
          (activeWorkout.items || []).map((it) => (
            <div
              key={it.id}
              className="border border-line rounded-2xl p-3 bg-bg"
            >
              {it.exerciseId && lastByExerciseId[it.exerciseId] && (
                <div className="text-[11px] text-subtle/70 mb-1">
                  Минулого разу{" "}
                  {lastByExerciseId[it.exerciseId]._startedAt
                    ? `(${new Date(lastByExerciseId[it.exerciseId]._startedAt).toLocaleDateString("uk-UA", { month: "short", day: "numeric" })})`
                    : ""}
                  :{" "}
                  {lastByExerciseId[it.exerciseId].type === "strength"
                    ? (lastByExerciseId[it.exerciseId].sets || [])
                        .map((s) => `${s.weightKg ?? 0}×${s.reps ?? 0}`)
                        .slice(0, 3)
                        .join(", ")
                    : lastByExerciseId[it.exerciseId].type === "distance"
                      ? `${lastByExerciseId[it.exerciseId].distanceM ?? 0}м за ${lastByExerciseId[it.exerciseId].durationSec ?? 0}с`
                      : `${lastByExerciseId[it.exerciseId].durationSec ?? 0}с`}
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    className="text-sm font-semibold text-text truncate text-left hover:underline"
                    onClick={() => {
                      if (it.exerciseId)
                        window.location.hash = `#exercise/${it.exerciseId}`;
                    }}
                  >
                    {it.nameUk}
                  </button>
                  <div className="text-xs text-subtle mt-0.5">
                    Мʼязи:{" "}
                    <span className="font-semibold text-muted">
                      {(it.musclesPrimary || [])
                        .map((id) => musclesUk?.[id] || id)
                        .join(", ") || "—"}
                    </span>
                  </div>
                  {(() => {
                    const cf = recoveryConflictsForWorkoutItem(it, recBy);
                    if (!cf.hasWarning) return null;
                    const redL = cf.red.map((x) => x.label).join(", ");
                    const yelL = cf.yellow.map((x) => x.label).join(", ");
                    return (
                      <div className="text-[11px] mt-1.5 rounded-xl border border-warning/40 bg-warning/10 px-2 py-1.5 text-warning leading-snug">
                        {cf.red.length ? (
                          <>
                            Рано навантажувати:{" "}
                            <span className="font-semibold">{redL}</span>.{" "}
                          </>
                        ) : null}
                        {cf.yellow.length ? (
                          <>
                            Краще почекати:{" "}
                            <span className="font-semibold">{yelL}</span>.
                          </>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
                <button
                  type="button"
                  className="text-xs text-danger/80 hover:text-danger"
                  onClick={() => removeItem(activeWorkout.id, it.id)}
                >
                  ✕
                </button>
              </div>

              <div className="mt-2">
                <div className="rounded-2xl border border-line bg-panelHi px-3">
                  <div className="text-[10px] font-bold text-subtle uppercase tracking-widest pt-2">
                    Тип
                  </div>
                  <select
                    className="w-full h-10 bg-transparent text-sm text-text outline-none"
                    value={it.type || "strength"}
                    onChange={(e) => {
                      const t = e.target.value;
                      if (t === "strength")
                        updateItem(activeWorkout.id, it.id, {
                          type: t,
                          sets: it.sets?.length
                            ? it.sets
                            : [{ weightKg: 0, reps: 0 }],
                          durationSec: undefined,
                          distanceM: undefined,
                        });
                      if (t === "time")
                        updateItem(activeWorkout.id, it.id, {
                          type: t,
                          durationSec: it.durationSec ?? 0,
                          sets: undefined,
                          distanceM: undefined,
                        });
                      if (t === "distance")
                        updateItem(activeWorkout.id, it.id, {
                          type: t,
                          distanceM: it.distanceM ?? 0,
                          durationSec: it.durationSec ?? 0,
                          sets: undefined,
                        });
                    }}
                  >
                    <option value="strength">
                      Силова (кг × повтори × підходи)
                    </option>
                    <option value="time">Час (секунди)</option>
                    <option value="distance">Дистанція (метри) + час</option>
                  </select>
                </div>
              </div>

              {it.type === "strength" && (
                <div className="mt-2 space-y-2">
                  {(it.sets || []).map((s, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2">
                      <input
                        className="h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                        type="number"
                        inputMode="decimal"
                        placeholder="кг"
                        value={s.weightKg || ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const next = [...(it.sets || [])];
                          next[idx] = {
                            ...next[idx],
                            weightKg:
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value),
                          };
                          updateItem(activeWorkout.id, it.id, { sets: next });
                        }}
                      />
                      <input
                        className="h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                        type="number"
                        inputMode="numeric"
                        placeholder="повт."
                        value={s.reps || ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const next = [...(it.sets || [])];
                          next[idx] = {
                            ...next[idx],
                            reps:
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value),
                          };
                          updateItem(activeWorkout.id, it.id, { sets: next });
                        }}
                      />
                      <button
                        type="button"
                        className="h-10 rounded-xl border border-line text-xs text-subtle hover:text-danger hover:border-danger/40 transition-colors"
                        onClick={() => {
                          const next = (it.sets || []).filter(
                            (_, i) => i !== idx,
                          );
                          updateItem(activeWorkout.id, it.id, { sets: next });
                        }}
                      >
                        Видалити
                      </button>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    className="w-full h-10 min-h-[44px]"
                    type="button"
                    onClick={() =>
                      updateItem(activeWorkout.id, it.id, {
                        sets: [...(it.sets || []), { weightKg: 0, reps: 0 }],
                      })
                    }
                  >
                    + Підхід
                  </Button>
                  {!activeWorkout.endedAt && (
                    <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-line/60">
                      <span className="text-[10px] font-bold text-subtle uppercase tracking-widest w-full">
                        Таймер відпочинку
                      </span>
                      {[60, 90, 120].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          className="min-h-[44px] px-4 rounded-xl border border-line bg-panelHi text-sm text-text hover:bg-panel transition-colors"
                          onClick={() =>
                            setRestTimer({ remaining: sec, total: sec })
                          }
                        >
                          {sec} с
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {it.type === "time" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    className="h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                    type="number"
                    inputMode="numeric"
                    placeholder="сек"
                    value={it.durationSec || ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      updateItem(activeWorkout.id, it.id, {
                        durationSec:
                          e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                  />
                  <div className="h-10 rounded-xl border border-line bg-bg px-3 text-xs text-subtle flex items-center">
                    Напр: планка, ізометрія
                  </div>
                </div>
              )}

              {it.type === "distance" && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    className="h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                    type="number"
                    inputMode="numeric"
                    placeholder="метри"
                    value={it.distanceM || ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      updateItem(activeWorkout.id, it.id, {
                        distanceM:
                          e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                  />
                  <input
                    className="h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text outline-none"
                    type="number"
                    inputMode="numeric"
                    placeholder="сек"
                    value={it.durationSec || ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) =>
                      updateItem(activeWorkout.id, it.id, {
                        durationSec:
                          e.target.value === "" ? 0 : Number(e.target.value),
                      })
                    }
                  />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {!activeWorkout.endedAt && (
        <div className="mt-3">
          <textarea
            className="w-full min-h-[72px] rounded-2xl border border-line bg-bg px-3 py-2.5 text-sm text-text placeholder:text-subtle outline-none focus:border-muted transition-colors resize-none"
            placeholder="Нотатки до тренування (необов'язково)…"
            value={activeWorkout.note || ""}
            onChange={(e) =>
              updateWorkout(activeWorkout.id, { note: e.target.value })
            }
          />
        </div>
      )}
    </div>
  );
}
