import { useCallback, useId, useMemo, useState } from "react";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { Button } from "@shared/components/ui/Button";
import { recoveryConflictsForWorkoutItem } from "@sergeant/fizruk-domain";
import {
  useRestSettings,
  getRestCategory,
  REST_CATEGORY_LABELS,
} from "../../hooks/useRestSettings";
import { VoiceMicButton } from "@shared/components/ui/VoiceMicButton.jsx";
import { parseWorkoutSetSpeech } from "@sergeant/shared";
import {
  makeDefaultWarmup,
  makeDefaultCooldown,
} from "../../hooks/useWorkouts";
import { Card } from "@shared/components/ui/Card";

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

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

function calcCardioMetrics(distanceM, durationSec) {
  const dist = Number(distanceM) || 0;
  const dur = Number(durationSec) || 0;
  if (dist <= 0 || dur <= 0) return null;
  const distKm = dist / 1000;
  const durMin = dur / 60;
  const paceMinKm = durMin / distKm;
  const speedKmh = distKm / (dur / 3600);
  let paceMin = Math.floor(paceMinKm);
  let paceSec = Math.round((paceMinKm - paceMin) * 60);
  if (paceSec >= 60) {
    paceMin += 1;
    paceSec = 0;
  }
  return {
    pace: `${paceMin}:${String(paceSec).padStart(2, "0")} хв/км`,
    speed: `${speedKmh.toFixed(1)} км/год`,
  };
}

function WarmupCooldownChecklist({ title, items, onToggle, onInit, color }) {
  if (!items) {
    return (
      <div
        className={`rounded-xl border border-dashed ${color.border} px-3 py-2.5 flex items-center justify-between gap-2`}
      >
        <span className={`text-xs font-semibold ${color.text}`}>{title}</span>
        <button
          type="button"
          className={`text-xs px-3 py-1.5 rounded-lg border ${color.border} ${color.text} hover:opacity-80 transition-opacity`}
          onClick={onInit}
        >
          Додати
        </button>
      </div>
    );
  }

  const doneCount = (items || []).filter((x) => x.done).length;
  const total = (items || []).length;

  return (
    <details
      className={`rounded-xl border ${color.border} bg-panelHi/50 px-3 py-2`}
      open={doneCount < total}
    >
      <summary
        className={`text-xs font-semibold ${color.text} cursor-pointer select-none flex items-center justify-between`}
      >
        <span>{title}</span>
        <span
          className={`ml-2 text-2xs font-bold tabular-nums ${doneCount === total ? "text-success" : color.text}`}
        >
          {doneCount}/{total}
        </span>
      </summary>
      <ul className="mt-2 space-y-1.5">
        {(items || []).map((item) => (
          <li key={item.id} className="flex items-center gap-2">
            <button
              type="button"
              className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${item.done ? "bg-success border-success text-white" : "border-line bg-bg"}`}
              onClick={() => onToggle(item.id)}
              aria-label={
                item.done
                  ? "Позначити як незавершене"
                  : "Позначити як завершене"
              }
            >
              {item.done && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 5l2.5 2.5L8 3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <span
              className={`text-xs ${item.done ? "line-through text-subtle" : "text-text"}`}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function SupersetBadge({ type }) {
  return (
    <span
      // eslint-disable-next-line sergeant-design/no-eyebrow-drift -- Superset/circuit indicator pill at text-3xs with dynamic module tint; defer Badge migration.
      className={`text-3xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${type === "circuit" ? "bg-fizruk/15 text-fizruk border border-fizruk/30" : "bg-success/15 text-success border border-success/30"}`}
    >
      {type === "circuit" ? "Коло" : "Суперсет"}
    </span>
  );
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
  onCollapse,
}) {
  const dtFieldsId = useId();
  const workoutStartId = `${dtFieldsId}-started`;
  const workoutEndId = `${dtFieldsId}-ended`;
  const { getDefaultForGroup } = useRestSettings();
  const [groupSelectMode, setGroupSelectMode] = useState(false);
  const [groupSelected, setGroupSelected] = useState(new Set());
  const isReadOnly = Boolean(activeWorkout?.endedAt);

  const groups = useMemo(
    () => activeWorkout?.groups || [],
    [activeWorkout?.groups],
  );
  const items = useMemo(
    () => activeWorkout?.items || [],
    [activeWorkout?.items],
  );
  const itemIdToGroup = useMemo(() => {
    const m = new Map();
    for (const g of groups) {
      for (const id of g.itemIds || []) m.set(id, g);
    }
    return m;
  }, [groups]);

  const handleToggleGroupSelect = useCallback((itemId) => {
    setGroupSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const handleCreateSuperset = useCallback(
    (type) => {
      if (!activeWorkout) return;
      if (groupSelected.size < 2 || groupSelected.size > 3) return;
      const itemIds = [...groupSelected];
      const newGroup = { id: uid("g"), type, itemIds, restSec: 60 };
      const newGroups = [
        ...groups.filter((g) => !g.itemIds.some((id) => groupSelected.has(id))),
        newGroup,
      ];
      updateWorkout(activeWorkout.id, { groups: newGroups });
      setGroupSelected(new Set());
      setGroupSelectMode(false);
    },
    [activeWorkout, groupSelected, groups, updateWorkout],
  );

  const handleRemoveGroup = useCallback(
    (groupId) => {
      if (!activeWorkout) return;
      updateWorkout(activeWorkout.id, {
        groups: groups.filter((g) => g.id !== groupId),
      });
    },
    [activeWorkout, groups, updateWorkout],
  );

  const handleGroupRestSec = useCallback(
    (groupId, sec) => {
      if (!activeWorkout) return;
      updateWorkout(activeWorkout.id, {
        groups: groups.map((g) =>
          g.id === groupId ? { ...g, restSec: sec } : g,
        ),
      });
    },
    [activeWorkout, groups, updateWorkout],
  );

  const handleWarmupToggle = useCallback(
    (field, itemId) => {
      if (!activeWorkout) return;
      const arr = (activeWorkout[field] || []).map((x) =>
        x.id === itemId ? { ...x, done: !x.done } : x,
      );
      updateWorkout(activeWorkout.id, { [field]: arr });
    },
    [activeWorkout, updateWorkout],
  );

  const handleInitWarmup = useCallback(() => {
    if (!activeWorkout) return;
    updateWorkout(activeWorkout.id, { warmup: makeDefaultWarmup() });
  }, [activeWorkout, updateWorkout]);

  const handleInitCooldown = useCallback(() => {
    if (!activeWorkout) return;
    updateWorkout(activeWorkout.id, { cooldown: makeDefaultCooldown() });
  }, [activeWorkout, updateWorkout]);

  const renderItem = useCallback(
    (it) => {
      const group = itemIdToGroup.get(it.id);
      const isSelected = groupSelected.has(it.id);

      const cardioMetrics =
        it.type === "distance"
          ? calcCardioMetrics(it.distanceM, it.durationSec)
          : null;

      const defSec = getDefaultForGroup(it.primaryGroup);
      const cat = getRestCategory(it.primaryGroup);
      const catLabel = REST_CATEGORY_LABELS[cat] || "";
      const quickOptions = [60, 90, 120, 180].filter((s) => s !== defSec);

      return (
        <div
          key={it.id}
          className={`border rounded-2xl p-3 bg-bg transition-colors ${groupSelectMode && isSelected ? "border-success bg-success/5" : "border-line"}`}
        >
          {it.exerciseId && lastByExerciseId[it.exerciseId] && (
            <div className="text-xs text-subtle/70 mb-1">
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
                  ? (() => {
                      const prev = lastByExerciseId[it.exerciseId];
                      const m = calcCardioMetrics(
                        prev.distanceM,
                        prev.durationSec,
                      );
                      return m
                        ? `${prev.distanceM ?? 0}м · ${m.pace}`
                        : `${prev.distanceM ?? 0}м за ${prev.durationSec ?? 0}с`;
                    })()
                  : `${lastByExerciseId[it.exerciseId].durationSec ?? 0}с`}
            </div>
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {groupSelectMode && (
                  <button
                    type="button"
                    className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? "bg-success border-success text-white" : "border-line bg-bg"}`}
                    onClick={() => handleToggleGroupSelect(it.id)}
                  >
                    {isSelected && (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                      >
                        <path
                          d="M2 5l2.5 2.5L8 3"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                )}
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
                {group && !groupSelectMode && (
                  <SupersetBadge type={group.type} />
                )}
              </div>
              <div className="text-xs text-subtle mt-0.5">
                М{"'"}язи:{" "}
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
                  <div className="text-xs mt-1.5 rounded-xl border border-warning/40 bg-warning/10 px-2 py-1.5 text-warning leading-snug">
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
            {!isReadOnly && (
              <button
                type="button"
                className="text-xs text-danger/80 hover:text-danger"
                onClick={() => removeItem(activeWorkout.id, it.id)}
                aria-label="Видалити вправу з тренування"
              >
                ✕
              </button>
            )}
          </div>

          <div className="mt-2">
            <div className="rounded-2xl border border-line bg-panelHi px-3">
              <SectionHeading as="div" size="xs" className="pt-2">
                Тип
              </SectionHeading>
              <select
                className="input-focus-fizruk w-full h-10 bg-transparent text-sm text-text disabled:opacity-70 rounded-xl"
                value={it.type || "strength"}
                disabled={isReadOnly}
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
                    className="input-focus-fizruk h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text read-only:opacity-70 read-only:cursor-not-allowed"
                    type="number"
                    inputMode="decimal"
                    placeholder="кг"
                    aria-label="Вага в кілограмах"
                    value={s.weightKg || ""}
                    readOnly={isReadOnly}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const next = [...(it.sets || [])];
                      next[idx] = {
                        ...next[idx],
                        weightKg:
                          e.target.value === "" ? 0 : Number(e.target.value),
                      };
                      updateItem(activeWorkout.id, it.id, { sets: next });
                    }}
                  />
                  <input
                    className="input-focus-fizruk h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text read-only:opacity-70 read-only:cursor-not-allowed"
                    type="number"
                    inputMode="numeric"
                    placeholder="повт."
                    aria-label="Кількість повторень"
                    value={s.reps || ""}
                    readOnly={isReadOnly}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      // UX: як у більшості трекерів — Enter на повторах = "залоговано" → запускаємо таймер
                      if (activeWorkout.endedAt) return;
                      if (group) return;
                      const reps = Number(s.reps) || 0;
                      const w = Number(s.weightKg) || 0;
                      if (reps <= 0 && w <= 0) return;
                      setRestTimer({ remaining: defSec, total: defSec });
                    }}
                    onChange={(e) => {
                      const next = [...(it.sets || [])];
                      next[idx] = {
                        ...next[idx],
                        reps:
                          e.target.value === "" ? 0 : Number(e.target.value),
                      };
                      updateItem(activeWorkout.id, it.id, { sets: next });
                    }}
                  />
                  <button
                    type="button"
                    className="h-10 rounded-xl border border-line text-xs text-subtle hover:text-danger hover:border-danger/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-subtle disabled:hover:border-line"
                    disabled={isReadOnly}
                    onClick={() => {
                      const next = (it.sets || []).filter((_, i) => i !== idx);
                      updateItem(activeWorkout.id, it.id, { sets: next });
                    }}
                  >
                    Видалити
                  </button>
                </div>
              ))}
              {!isReadOnly && (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    className="flex-1 h-10 min-h-[44px]"
                    type="button"
                    onClick={() =>
                      updateItem(activeWorkout.id, it.id, {
                        sets: [...(it.sets || []), { weightKg: 0, reps: 0 }],
                      })
                    }
                  >
                    + Підхід
                  </Button>
                  <VoiceMicButton
                    size="md"
                    label="Голосовий ввід підходу"
                    onResult={(transcript) => {
                      const parsed = parseWorkoutSetSpeech(transcript);
                      if (!parsed) return;
                      const newSet = {
                        weightKg: parsed.weight ?? 0,
                        reps: parsed.reps ?? 0,
                      };
                      updateItem(activeWorkout.id, it.id, {
                        sets: [...(it.sets || []), newSet],
                      });
                      if (!activeWorkout.endedAt && !group) {
                        setRestTimer({ remaining: defSec, total: defSec });
                      }
                    }}
                  />
                </div>
              )}
              {!activeWorkout.endedAt && !group && (
                <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-line">
                  <div className="flex items-center justify-between w-full gap-1">
                    <SectionHeading as="span" size="xs">
                      Таймер відпочинку
                    </SectionHeading>
                    <span className="text-3xs text-muted">
                      {catLabel} · реком. {defSec}с
                    </span>
                  </div>
                  <button
                    type="button"
                    className="min-h-[44px] px-4 rounded-xl border-2 border-success bg-success/10 text-sm font-semibold text-success hover:bg-success/20 transition-colors"
                    onClick={() =>
                      setRestTimer({ remaining: defSec, total: defSec })
                    }
                    title={`Рекомендований час для ${catLabel.toLowerCase()}`}
                  >
                    {defSec} с ★
                  </button>
                  {quickOptions.map((sec) => (
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
                className="input-focus-fizruk h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text read-only:opacity-70 read-only:cursor-not-allowed"
                type="number"
                inputMode="numeric"
                placeholder="сек"
                aria-label="Тривалість у секундах"
                value={it.durationSec || ""}
                readOnly={isReadOnly}
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
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input-focus-fizruk h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text read-only:opacity-70 read-only:cursor-not-allowed"
                  type="number"
                  inputMode="numeric"
                  placeholder="метри"
                  aria-label="Дистанція в метрах"
                  value={it.distanceM || ""}
                  readOnly={isReadOnly}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    updateItem(activeWorkout.id, it.id, {
                      distanceM:
                        e.target.value === "" ? 0 : Number(e.target.value),
                    })
                  }
                />
                <input
                  className="input-focus-fizruk h-10 rounded-xl border border-line bg-panelHi px-3 text-sm text-text read-only:opacity-70 read-only:cursor-not-allowed"
                  type="number"
                  inputMode="numeric"
                  placeholder="сек"
                  aria-label="Тривалість у секундах"
                  value={it.durationSec || ""}
                  readOnly={isReadOnly}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    updateItem(activeWorkout.id, it.id, {
                      durationSec:
                        e.target.value === "" ? 0 : Number(e.target.value),
                    })
                  }
                />
              </div>
              {cardioMetrics && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-line bg-bg px-3 py-2 text-center">
                    {/* eslint-disable-next-line sergeant-design/no-eyebrow-drift --
                        Cardio metric caption at text-3xs (smaller than
                        SectionHeading xs's text-2xs) inside a compact stat
                        tile; intentional microtype. */}
                    <div className="text-3xs font-bold text-subtle uppercase tracking-widest">
                      Темп
                    </div>
                    <div className="text-sm font-bold text-text tabular-nums">
                      {cardioMetrics.pace}
                    </div>
                  </div>
                  <div className="rounded-xl border border-line bg-bg px-3 py-2 text-center">
                    {/* eslint-disable-next-line sergeant-design/no-eyebrow-drift --
                        Matching caption on the speed tile; see sibling above. */}
                    <div className="text-3xs font-bold text-subtle uppercase tracking-widest">
                      Швидкість
                    </div>
                    <div className="text-sm font-bold text-text tabular-nums">
                      {cardioMetrics.speed}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    },
    [
      activeWorkout,
      getDefaultForGroup,
      groupSelectMode,
      groupSelected,
      handleToggleGroupSelect,
      isReadOnly,
      itemIdToGroup,
      lastByExerciseId,
      musclesUk,
      recBy,
      removeItem,
      setRestTimer,
      updateItem,
    ],
  );

  const renderedItemsList = useMemo(() => {
    if (items.length === 0) {
      return (
        <div className="text-sm text-subtle text-center py-6">
          Додай вправи, щоб почати логувати
        </div>
      );
    }

    const rendered = [];
    const visitedGroups = new Set();

    for (const it of items) {
      const group = itemIdToGroup.get(it.id);
      if (!group) {
        rendered.push(renderItem(it));
        continue;
      }
      if (visitedGroups.has(group.id)) continue;
      visitedGroups.add(group.id);

      const groupItems = items.filter((x) =>
        (group.itemIds || []).includes(x.id),
      );
      const qOpts = [60, 90, 120, 180].filter((s) => s !== group.restSec);

      rendered.push(
        <div
          key={group.id}
          className="rounded-2xl border-2 border-success/40 bg-success/5 p-2 space-y-2"
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <SupersetBadge type={group.type} />
            <div className="flex items-center gap-1.5">
              <span className="text-2xs text-subtle">
                {groupItems.length} вправи разом
              </span>
              <button
                type="button"
                className="text-2xs text-danger/70 hover:text-danger px-1"
                onClick={() => handleRemoveGroup(group.id)}
                title="Розгрупувати"
              >
                Розгрупувати
              </button>
            </div>
          </div>
          {groupItems.map((gIt) => renderItem(gIt))}
          {!activeWorkout?.endedAt && (
            <div className="flex flex-wrap items-center gap-2 px-1 pt-1 border-t border-success/20">
              <SectionHeading as="span" size="xs" className="w-full">
                Спільний таймер відпочинку між колами
              </SectionHeading>
              <button
                type="button"
                className="min-h-[40px] px-3 rounded-xl border-2 border-success bg-success/10 text-sm font-semibold text-success hover:bg-success/20 transition-colors"
                onClick={() =>
                  setRestTimer({
                    remaining: group.restSec || 60,
                    total: group.restSec || 60,
                  })
                }
              >
                {group.restSec || 60} с ★
              </button>
              {qOpts.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className="min-h-[40px] px-3 rounded-xl border border-line bg-panelHi text-sm text-text hover:bg-panel transition-colors"
                  onClick={() => {
                    handleGroupRestSec(group.id, sec);
                    setRestTimer({ remaining: sec, total: sec });
                  }}
                >
                  {sec} с
                </button>
              ))}
            </div>
          )}
        </div>,
      );
    }

    return rendered;
  }, [
    activeWorkout,
    handleGroupRestSec,
    handleRemoveGroup,
    itemIdToGroup,
    items,
    renderItem,
    setRestTimer,
  ]);

  if (!activeWorkout) return null;

  return (
    <Card radius="lg">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-text">
            {activeWorkout.endedAt
              ? "Завершене тренування"
              : "Активне тренування"}
          </div>
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
          ) : onCollapse ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-4"
              type="button"
              onClick={onCollapse}
              aria-label="Згорнути завершене тренування"
            >
              Згорнути
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

      <details className="mt-3 rounded-xl border border-line bg-panelHi/50 px-3 py-2">
        <summary className="text-xs font-semibold text-subtle cursor-pointer select-none">
          Час тренування
        </summary>
        <div className="mt-2 space-y-2">
          <label
            className="block text-2xs text-subtle"
            htmlFor={workoutStartId}
          >
            Початок
          </label>
          <input
            id={workoutStartId}
            type="datetime-local"
            className="input-focus-fizruk w-full h-11 rounded-xl border border-line bg-panelHi px-3 text-sm text-text"
            value={isoToDatetimeLocalValue(activeWorkout.startedAt)}
            onChange={(e) => {
              const iso = datetimeLocalValueToIso(e.target.value);
              if (iso) updateWorkout(activeWorkout.id, { startedAt: iso });
            }}
          />
          {activeWorkout.endedAt ? (
            <>
              <label
                className="block text-2xs text-subtle"
                htmlFor={workoutEndId}
              >
                Завершення (можна виправити після занесення)
              </label>
              <input
                id={workoutEndId}
                type="datetime-local"
                className="input-focus-fizruk w-full h-11 rounded-xl border border-line bg-panelHi px-3 text-sm text-text"
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
        <WarmupCooldownChecklist
          title="Розминка"
          items={activeWorkout.warmup}
          onToggle={(id) => handleWarmupToggle("warmup", id)}
          onInit={handleInitWarmup}
          color={{ border: "border-orange-400/40", text: "text-orange-500" }}
        />
      </div>

      <div className="mt-3 space-y-2">
        {!activeWorkout.endedAt && (activeWorkout.items || []).length >= 2 && (
          <div className="flex items-center gap-2">
            {!groupSelectMode ? (
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded-lg border border-line text-subtle hover:text-text hover:bg-panelHi transition-colors"
                onClick={() => {
                  setGroupSelectMode(true);
                  setGroupSelected(new Set());
                }}
              >
                ⊕ Об{"'"}єднати в суперсет
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-lg border border-success/40 text-success bg-success/10 hover:bg-success/20 transition-colors disabled:opacity-40"
                  disabled={groupSelected.size < 2 || groupSelected.size > 3}
                  onClick={() => handleCreateSuperset("superset")}
                  title="Виберіть 2-3 вправи"
                >
                  Суперсет ({groupSelected.size}/3)
                </button>
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-lg border border-fizruk/40 text-fizruk bg-fizruk/10 hover:bg-fizruk/20 transition-colors disabled:opacity-40"
                  disabled={groupSelected.size < 2 || groupSelected.size > 3}
                  onClick={() => handleCreateSuperset("circuit")}
                  title="Виберіть 2-3 вправи"
                >
                  Коло ({groupSelected.size}/3)
                </button>
                <button
                  type="button"
                  className="text-xs px-3 py-1.5 rounded-lg border border-line text-subtle hover:text-text transition-colors"
                  onClick={() => {
                    setGroupSelectMode(false);
                    setGroupSelected(new Set());
                  }}
                >
                  Скасувати
                </button>
              </>
            )}
          </div>
        )}
        {renderedItemsList}
      </div>

      <div className="mt-3 space-y-2">
        <WarmupCooldownChecklist
          title="Заминка / розтяжка"
          items={activeWorkout.cooldown}
          onToggle={(id) => handleWarmupToggle("cooldown", id)}
          onInit={handleInitCooldown}
          color={{ border: "border-blue-400/40", text: "text-blue-500" }}
        />
      </div>

      {!activeWorkout.endedAt && (
        <div className="mt-3">
          <textarea
            className="input-focus-fizruk w-full min-h-[72px] rounded-2xl border border-line bg-bg px-3 py-2.5 text-sm text-text placeholder:text-subtle resize-none"
            placeholder={`Нотатки до тренування (необов${"'"}язково)…`}
            value={activeWorkout.note || ""}
            onChange={(e) =>
              updateWorkout(activeWorkout.id, { note: e.target.value })
            }
          />
        </div>
      )}
    </Card>
  );
}
