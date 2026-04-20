import { useCallback, useEffect, useId, useRef, useState } from "react";
import { SectionHeading } from "@shared/components/ui/SectionHeading";
import { Label } from "@shared/components/ui/FormField";
import { Card } from "@shared/components/ui/Card";
import { cn } from "@shared/lib/cn";
import { useBodyPhotos } from "../hooks/useBodyPhotos";

function CameraIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
    </svg>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function CompareSlider({ beforeSrc, afterSrc }) {
  const containerRef = useRef(null);
  const [sliderPct, setSliderPct] = useState(50);
  const [containerWidth, setContainerWidth] = useState(0);
  const dragging = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const updateFromClientX = useCallback((clientX) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(
      0,
      Math.min(100, ((clientX - rect.left) / rect.width) * 100),
    );
    setSliderPct(pct);
  }, []);

  const onMouseDown = (e) => {
    dragging.current = true;
    updateFromClientX(e.clientX);
  };
  const onMouseMove = (e) => {
    if (!dragging.current) return;
    updateFromClientX(e.clientX);
  };
  const onMouseUp = () => {
    dragging.current = false;
  };

  const onTouchStart = (e) => {
    dragging.current = true;
    updateFromClientX(e.touches[0].clientX);
  };
  const onTouchMove = (e) => {
    if (!dragging.current) return;
    e.preventDefault();
    updateFromClientX(e.touches[0].clientX);
  };
  const onTouchEnd = () => {
    dragging.current = false;
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      setSliderPct((p) => Math.max(0, p - 5));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      setSliderPct((p) => Math.min(100, p + 5));
    }
  };

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={0}
      aria-label="Порівняння до і після"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(sliderPct)}
      className="relative w-full overflow-hidden rounded-xl select-none touch-none"
      style={{ aspectRatio: "3/4" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onKeyDown={onKeyDown}
    >
      <img
        src={afterSrc}
        alt="Після"
        loading="lazy"
        decoding="async"
        width="600"
        height="800"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPct}%` }}
      >
        <img
          src={beforeSrc}
          alt="До"
          loading="lazy"
          decoding="async"
          width="600"
          height="800"
          className="absolute inset-0 h-full object-cover"
          style={{ width: containerWidth > 0 ? containerWidth : "100%" }}
          draggable={false}
        />
      </div>
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg cursor-ew-resize"
        style={{ left: `${sliderPct}%`, transform: "translateX(-50%)" }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <polyline points="15 18 9 12 15 6" />
            <polyline
              points="9 18 3 12 9 6"
              transform="translate(12 0) scale(-1 1)"
            />
          </svg>
        </div>
      </div>
      <div className="absolute top-2 left-2 text-2xs font-bold text-white bg-black/50 rounded px-1.5 py-0.5">
        ДО
      </div>
      <div className="absolute top-2 right-2 text-2xs font-bold text-white bg-black/50 rounded px-1.5 py-0.5">
        ПІСЛЯ
      </div>
    </div>
  );
}

export function PhotoProgress() {
  const formId = useId();
  const compareBeforeId = `${formId}-compare-before`;
  const compareAfterId = `${formId}-compare-after`;
  const addDateId = `${formId}-add-date`;
  const addNoteId = `${formId}-add-note`;
  const { photos, ready, addPhoto, deletePhoto } = useBodyPhotos();
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [addMode, setAddMode] = useState(false);
  const [dateStr, setDateStr] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setPreview(dataUrl);
    setAddMode(true);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!preview) return;
    setSaving(true);
    await addPhoto(preview, dateStr, note);
    setSaving(false);
    setPreview(null);
    setNote("");
    setDateStr(new Date().toISOString().slice(0, 10));
    setAddMode(false);
  };

  const handleCancel = () => {
    setPreview(null);
    setNote("");
    setAddMode(false);
  };

  const sortedPhotos = photos;
  const beforePhoto = sortedPhotos.find((p) => p.id === beforeId);
  const afterPhoto = sortedPhotos.find((p) => p.id === afterId);

  if (!ready) {
    return (
      <Card as="section" radius="lg" padding="md">
        <div className="text-xs text-subtle text-center py-4">
          Завантаження…
        </div>
      </Card>
    );
  }

  return (
    <section
      className="bg-panel border border-line rounded-2xl p-4 shadow-card"
      aria-label="Фото-прогрес"
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <SectionHeading as="h2" size="sm">
          Фото-прогрес
        </SectionHeading>
        {photos.length >= 2 && (
          <button
            type="button"
            onClick={() => setCompareMode((v) => !v)}
            className={cn(
              "text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors",
              compareMode
                ? "bg-success text-white border-success"
                : "border-line text-subtle hover:border-success/50 hover:text-text",
            )}
          >
            {compareMode ? "Ховати порівняння" : "До/Після"}
          </button>
        )}
      </div>

      {compareMode && photos.length >= 2 && (
        <div className="mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor={compareBeforeId}>До</Label>
              <select
                id={compareBeforeId}
                value={beforeId}
                onChange={(e) => setBeforeId(e.target.value)}
                className="input-focus-fizruk w-full h-9 rounded-lg border border-line bg-panelHi px-2 text-xs text-text"
              >
                <option value="">Обери фото</option>
                {sortedPhotos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.date}
                    {p.note ? ` — ${p.note.slice(0, 20)}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor={compareAfterId}>Після</Label>
              <select
                id={compareAfterId}
                value={afterId}
                onChange={(e) => setAfterId(e.target.value)}
                className="input-focus-fizruk w-full h-9 rounded-lg border border-line bg-panelHi px-2 text-xs text-text"
              >
                <option value="">Обери фото</option>
                {sortedPhotos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.date}
                    {p.note ? ` — ${p.note.slice(0, 20)}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {beforePhoto && afterPhoto && beforePhoto.id !== afterPhoto.id && (
            <CompareSlider
              beforeSrc={beforePhoto.dataUrl}
              afterSrc={afterPhoto.dataUrl}
            />
          )}
          {(!beforePhoto ||
            !afterPhoto ||
            beforePhoto.id === afterPhoto.id) && (
            <div className="rounded-xl border border-dashed border-line bg-panelHi/50 py-6 text-center text-xs text-subtle">
              Обери два різні фото для порівняння
            </div>
          )}
        </div>
      )}

      {addMode && preview ? (
        <div className="space-y-3">
          <img
            src={preview}
            alt="Попередній перегляд"
            loading="lazy"
            decoding="async"
            width="600"
            height="800"
            className="w-full rounded-xl object-cover max-h-72"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor={addDateId}>Дата</Label>
              <input
                id={addDateId}
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="input-focus-fizruk w-full h-9 rounded-lg border border-line bg-panelHi px-2 text-xs text-text"
              />
            </div>
            <div>
              <Label htmlFor={addNoteId}>Нотатка</Label>
              <input
                id={addNoteId}
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={60}
                placeholder={"Необов'язково"}
                className="input-focus-fizruk w-full h-9 rounded-lg border border-line bg-panelHi px-2 text-xs text-text"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-2.5 rounded-xl border border-line text-sm font-semibold text-subtle hover:text-text transition-colors"
            >
              Скасувати
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-success text-white text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {saving ? "Зберігаємо…" : "Зберегти"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-4">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleFileSelected}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelected}
            />
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-line text-sm font-semibold text-subtle hover:border-success/50 hover:text-text transition-colors"
            >
              <CameraIcon />
              Камера
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-line text-sm font-semibold text-subtle hover:border-success/50 hover:text-text transition-colors"
            >
              <GalleryIcon />
              Галерея
            </button>
          </div>

          {photos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-panelHi/50 py-8 text-center text-xs text-subtle">
              Додай перше фото прогресу
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {sortedPhotos.slice(0, 12).map((p) => (
                <div
                  key={p.id}
                  className="relative group rounded-xl overflow-hidden aspect-[3/4] bg-panelHi"
                >
                  <img
                    src={p.dataUrl}
                    alt={p.date}
                    loading="lazy"
                    decoding="async"
                    width="240"
                    height="320"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                  <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1 pt-3 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-3xs text-white font-semibold leading-tight">
                      {p.date}
                    </p>
                    {p.note && (
                      <p className="text-[8px] text-white/70 leading-tight truncate">
                        {p.note}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => deletePhoto(p.id)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-danger/80"
                    aria-label="Видалити фото"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
