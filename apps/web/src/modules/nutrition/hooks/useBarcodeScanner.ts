/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { isCapacitor } from "@sergeant/shared";

/**
 * Normalized barcode payload returned by both the native ML Kit plugin
 * and the browser zxing / BarcodeDetector flow. Consumers of the hook
 * should never need to branch on platform: `code` is always a string,
 * `format` is a best-effort format tag (may be empty on web when the
 * underlying detector did not report one), and `rawBytes` is present
 * only when the native plugin returned raw bytes (iso-15438 etc.).
 */
export interface BarcodeResult {
  code: string;
  format: string;
  rawBytes?: Uint8Array;
}

/**
 * Imperative native scan. Dynamic-imports the Capacitor ML Kit adapter
 * from `@sergeant/mobile-shell` so browsers never pull the plugin into
 * their main chunk — Vite code-splits the import into an async chunk
 * that only loads inside the Capacitor WebView.
 *
 * Exported for callers that already know they are native (e.g. future
 * background scanning surfaces). Most UI should use the
 * `useBarcodeScanner` hook below.
 */
export async function scanBarcodeNative(): Promise<BarcodeResult | null> {
  const mod = await import("@sergeant/mobile-shell/barcodeNative");
  return mod.scanBarcodeNative();
}

export interface UseBarcodeScannerResult {
  /** True when running inside a Capacitor WebView (Android/iOS). */
  isNative: boolean;
  /**
   * Trigger a scan.
   *
   * - Native: opens the ML Kit modal scanner and resolves to a
   *   `BarcodeResult` (or `null` if the user cancelled).
   * - Web: throws — consumers should render the `<BarcodeScanner />`
   *   overlay component instead. This asymmetry is intentional; the
   *   browser flow is inherently tied to a live `<video>` element and
   *   cannot be reduced to a one-shot async call without rendering UI.
   */
  scan: () => Promise<BarcodeResult | null>;
}

/**
 * Feature-detect hook. Components that only need to know whether we are
 * native (e.g. to hide a "scan barcode" action on browsers that can't
 * reach the camera) can read `isNative`; imperative callers on native
 * can call `scan()` directly.
 */
export function useBarcodeScanner(): UseBarcodeScannerResult {
  const [isNative] = useState(() => isCapacitor());
  const scan = useCallback(async () => {
    if (!isNative) {
      throw new Error(
        "Browser scanning is UI-driven; render <BarcodeScanner /> instead of calling scan()",
      );
    }
    return scanBarcodeNative();
  }, [isNative]);
  return { isNative, scan };
}

export interface UseWebScannerOptions {
  /** Called once a barcode has been decoded. The hook stops the camera after this fires. */
  onDetected: (result: BarcodeResult) => void;
  /** Whether the camera session should be running. Toggle to `false` to release the stream. */
  active: boolean;
}

export interface UseWebScannerState {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  status: string;
}

async function startZxingScanner(
  videoEl: HTMLVideoElement | null,
  stream: MediaStream | null,
  onDetected: (result: BarcodeResult) => void,
  cancelRef: MutableRefObject<boolean>,
  zxingStopRef: MutableRefObject<(() => void) | null>,
) {
  const { BrowserMultiFormatReader } = await import("@zxing/browser");
  if (cancelRef.current) return;

  const reader = new BrowserMultiFormatReader();

  const controls = await reader.decodeFromStream(
    stream!,
    videoEl!,
    (result) => {
      if (cancelRef.current) return;
      if (result) {
        const raw = result.getText();
        if (raw) {
          const format = (() => {
            try {
              const f = result.getBarcodeFormat?.();
              return f != null ? String(f) : "";
            } catch {
              return "";
            }
          })();
          onDetected({ code: raw, format });
        }
      }
    },
  );

  zxingStopRef.current = () => {
    try {
      controls?.stop?.();
    } catch {
      /* ignore */
    }
    try {
      (reader as any).reset?.();
    } catch {
      /* ignore */
    }
  };
}

/**
 * `useWebScanner` owns the browser camera session: it requests
 * `getUserMedia`, prefers the native `BarcodeDetector` when available,
 * and falls back to zxing. Returns refs the caller attaches to a
 * `<video>` element plus a human-readable `status` for error surfaces.
 */
export function useWebScanner({
  onDetected,
  active,
}: UseWebScannerOptions): UseWebScannerState {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelRef = useRef(false);
  const zxingStopRef = useRef<(() => void) | null>(null);
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

  const handleDetected = useCallback(
    (result: BarcodeResult) => {
      stopAll();
      onDetected(result);
    },
    [stopAll, onDetected],
  );

  useEffect(() => {
    if (!active) return;
    cancelRef.current = false;

    const run = async () => {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setStatus("Камера недоступна в цьому браузері.");
        return;
      }

      let stream: MediaStream;
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
        let detector: any = null;
        try {
          detector = new (window as any).BarcodeDetector({
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
                const first = codes?.[0];
                const raw = first?.rawValue;
                if (raw) {
                  handleDetected({
                    code: String(raw),
                    format: String(first?.format ?? ""),
                  });
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
  }, [active, handleDetected, stopAll]);

  return { videoRef, status };
}
