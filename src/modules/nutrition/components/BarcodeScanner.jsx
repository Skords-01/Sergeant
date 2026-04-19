import { useCallback, useEffect, useRef, useState } from "react";

async function startZxingScanner(
  videoEl,
  stream,
  onDetected,
  cancelRef,
  zxingStopRef,
) {
  const { BrowserMultiFormatReader } = await import("@zxing/browser");
  if (cancelRef.current) return;

  const reader = new BrowserMultiFormatReader();

  const controls = await reader.decodeFromStream(stream, videoEl, (result) => {
    if (cancelRef.current) return;
    if (result) {
      const raw = result.getText();
      if (raw) onDetected(raw);
    }
  });

  zxingStopRef.current = () => {
    try {
      controls?.stop?.();
    } catch {
      /* ignore */
    }
    try {
      reader.reset();
    } catch {
      /* ignore */
    }
  };
}

export function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cancelRef = useRef(false);
  const zxingStopRef = useRef(null);
  const rafRef = useRef(0);
  const [status, setStatus] = useState("");

  const stopAll = useCallback(() => {
    cancelRef.current = true;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (typeof zxingStopRef.current === "function") {
      zxingStopRef.current();
      zxingStopRef.current = null;
    }
    try {
      const s = streamRef.current;
      if (s) for (const t of s.getTracks()) t.stop();
    } catch {
      /* ignore */
    }
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const handleClose = useCallback(() => {
    stopAll();
    onClose();
  }, [stopAll, onClose]);

  const handleDetected = useCallback(
    (raw) => {
      stopAll();
      onDetected(raw);
    },
    [stopAll, onDetected],
  );

  useEffect(() => {
    cancelRef.current = false;

    const run = async () => {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setStatus("Камера недоступна в цьому браузері.");
        return;
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        setStatus("Не вдалося відкрити камеру. Перевір дозволи.");
        return;
      }

      if (cancelRef.current) {
        for (const t of stream.getTracks()) t.stop();
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }

      if (cancelRef.current) return;

      const usedBarcodeDetector =
        typeof window !== "undefined" && "BarcodeDetector" in window;

      if (usedBarcodeDetector) {
        let detector;
        try {
          detector = new window.BarcodeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"],
          });
        } catch {
          detector = null;
        }

        if (detector) {
          let consecutiveErrors = 0;
          let lastTickTime = 0;
          const tick = async () => {
            if (cancelRef.current) return;
            const now = performance.now();
            if (now - lastTickTime < 150) {
              rafRef.current = requestAnimationFrame(tick);
              return;
            }
            lastTickTime = now;
            try {
              const v = videoRef.current;
              if (v && v.readyState >= 2 && v.videoWidth > 0) {
                const codes = await detector.detect(v);
                consecutiveErrors = 0;
                const raw = codes?.[0]?.rawValue;
                if (raw) {
                  handleDetected(raw);
                  return;
                }
              }
            } catch {
              consecutiveErrors++;
              if (consecutiveErrors >= 5) {
                if (!cancelRef.current) {
                  startZxingScanner(
                    videoRef.current,
                    streamRef.current,
                    handleDetected,
                    cancelRef,
                    zxingStopRef,
                  ).catch(() =>
                    setStatus("Сканер не підтримується. Введи код вручну."),
                  );
                }
                return;
              }
            }
            if (!cancelRef.current) {
              rafRef.current = requestAnimationFrame(tick);
            }
          };
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
      }

      try {
        await startZxingScanner(
          videoRef.current,
          streamRef.current,
          handleDetected,
          cancelRef,
          zxingStopRef,
        );
      } catch {
        setStatus(
          "Сканер не підтримується в цьому браузері. Введи код вручну.",
        );
      }
    };

    void run();

    return () => {
      stopAll();
    };
  }, [handleDetected, stopAll]);

  return (
    <div className="fixed inset-0 z-[130] flex items-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Закрити сканер"
        onClick={handleClose}
      />
      <div className="relative w-full bg-panel rounded-t-3xl border-t border-line shadow-soft">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-line rounded-full" aria-hidden />
        </div>
        <div className="px-4 pb-2 flex items-center justify-between">
          <div className="text-sm font-extrabold text-text">
            Сканер штрих-коду
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-10 h-10 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-panelHi text-muted hover:text-text text-lg transition-colors"
            aria-label="Закрити сканер"
          >
            ✕
          </button>
        </div>
        <div className="px-4 pb-8 space-y-3">
          <div className="rounded-2xl overflow-hidden border border-line bg-black relative">
            <video
              ref={videoRef}
              className="w-full aspect-video object-cover"
              muted
              playsInline
              autoPlay
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-1/2 border-2 border-nutrition/80 rounded-xl" />
            </div>
          </div>
          {status ? (
            <p className="text-xs text-danger">{status}</p>
          ) : (
            <p className="text-xs text-subtle text-center">
              Наведи камеру на штрих-код. Якщо не зчитує — введи код вручну.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
