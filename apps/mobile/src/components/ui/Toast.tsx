/**
 * Sergeant Design System — Toast (React Native)
 *
 * Mobile port of the web `Toast` primitive + its `useToast` hook. We
 * ship both halves in one file because they're tightly coupled — the
 * provider owns the queue / timers, and the container reads from the
 * same context to render the stack.
 *
 * @see apps/web/src/shared/components/ui/Toast.tsx — visual container
 * @see apps/web/src/shared/hooks/useToast.tsx — state + API hook
 *
 * ## Approach choice — why not a third-party library?
 *
 * The Phase 1 plan called out two alternatives for mobile toasts:
 *
 * 1. `react-native-toast-message` — a popular library, but it ships its
 *    own imperative singleton API (`Toast.show(...)`, `Toast.hide(...)`)
 *    with a fixed prop shape (`text1` / `text2` / `type`) that does not
 *    match the web hook contract (`useToast().show(msg, type, duration,
 *    action)` returning a numeric id, plus `.success / .error / .info /
 *    .warning / .dismiss` helpers and a `toasts` array). Adopting the
 *    library would force screens to branch on platform — exactly what
 *    cross-platform hub screens should NOT do. Hard no.
 * 2. Reanimated + Gesture Handler custom animation — full control, but
 *    overkill for the current design (simple top-slide + fade + 3.5s
 *    auto-dismiss, no swipe-to-dismiss). Pulling Reanimated into the
 *    jest transform pipeline also caused the `react-native-worklets/plugin`
 *    friction that PR #413 had to work around.
 *
 * **Picked:** a self-contained port of the existing `useToast` hook +
 * `ToastContainer`, powered by React state and the built-in
 * `react-native` `Animated` API for the entrance / exit transition.
 * Zero new dependencies, drop-in API parity with web, and it keeps the
 * test env clean.
 *
 * When we need swipe-to-dismiss later we can upgrade the container to
 * Reanimated without touching the provider or the call sites.
 *
 * Parity notes:
 * - Same `ToastType` enum (`success` / `error` / `info` / `warning`).
 * - Same `useToast` context API: `show(msg, type?, duration?, action?)
 *   => id`, `success / error / info / warning`, `dismiss(id)`, plus the
 *   `toasts` array.
 * - Same default durations (3500ms, 5000ms for error/warning).
 * - Same queue cap (last 5 toasts rendered — `slice(-4)` like web).
 * - Same variant → colour mapping, dismiss button, optional action
 *   button, aria-live-ish semantics via `accessibilityLiveRegion`.
 *
 * Differences from web (intentional):
 * - Animations use `react-native`'s built-in `Animated` (native driver,
 *   `fade-in + translateY`) instead of Tailwind's `animate-in` utilities.
 * - Position: `absolute top` with `paddingTop` that respects
 *   `useSafeAreaInsets()` on iOS notch / Android status bar via the
 *   host layout (caller wraps `ToastContainer` in a `SafeAreaView` or
 *   sets the top inset). The container itself doesn't pull in
 *   `react-native-safe-area-context` to keep the bundle small — it's
 *   already set up at the app shell level in `apps/mobile/app/_layout.tsx`.
 * - SVG icons from the web version become unicode-ish text glyphs for
 *   now; `react-native-svg` isn't wired at the `components/ui` layer
 *   yet and all four variant icons are trivial shapes. TODO: swap to
 *   `react-native-svg` once the dependency lands in a later phase.
 * - Semantic colour tokens (`bg-brand-700`, `bg-danger`, `bg-warning`,
 *   `bg-primary`) fall back to concrete `brand-*` / `red-*` /
 *   `amber-*` / `cream-*` classes until mobile CSS-variable wiring
 *   lands. Same caveat as every other phase-1 primitive.
 *   TODO: align with design-tokens once mobile semantic variables land.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Animated,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastItem {
  id: number;
  msg: ReactNode;
  type: ToastType;
  action: ToastAction | null;
}

export interface ToastApi {
  show: (
    msg: ReactNode,
    type?: ToastType,
    duration?: number,
    action?: ToastAction,
  ) => number;
  success: (msg: ReactNode, duration?: number, action?: ToastAction) => number;
  error: (msg: ReactNode, duration?: number, action?: ToastAction) => number;
  info: (msg: ReactNode, duration?: number, action?: ToastAction) => number;
  warning: (msg: ReactNode, duration?: number, action?: ToastAction) => number;
  dismiss: (id: number) => void;
}

export interface ToastContextValue extends ToastApi {
  toasts: ToastItem[];
}

const ToastContext = createContext<ToastContextValue | null>(null);

let idCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
      timersRef.current = {};
    };
  }, []);

  const dismiss = useCallback<ToastApi["dismiss"]>((id) => {
    const timer = timersRef.current[id];
    if (timer) clearTimeout(timer);
    delete timersRef.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastApi["show"]>(
    (msg, type = "success", duration = 3500, action) => {
      const id = ++idCounter;
      const safeAction: ToastAction | null =
        action &&
        typeof action === "object" &&
        typeof action.onPress === "function"
          ? { label: String(action.label || "Дія"), onPress: action.onPress }
          : null;
      setToasts((prev) => [
        ...prev.slice(-4),
        { id, msg, type, action: safeAction },
      ]);
      timersRef.current[id] = setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss],
  );

  const success = useCallback<ToastApi["success"]>(
    (msg, duration, action) => show(msg, "success", duration, action),
    [show],
  );
  const error = useCallback<ToastApi["error"]>(
    (msg, duration, action) => show(msg, "error", duration ?? 5000, action),
    [show],
  );
  const info = useCallback<ToastApi["info"]>(
    (msg, duration, action) => show(msg, "info", duration, action),
    [show],
  );
  const warning = useCallback<ToastApi["warning"]>(
    (msg, duration, action) => show(msg, "warning", duration ?? 5000, action),
    [show],
  );

  const value = useMemo<ToastContextValue>(
    () => ({ show, success, error, info, warning, dismiss, toasts }),
    [show, success, error, info, warning, dismiss, toasts],
  );

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const VARIANT_BG: Record<ToastType, string> = {
  success: "bg-brand-600",
  error: "bg-red-600",
  warning: "bg-amber-500",
  info: "bg-brand-500",
};

// Unicode glyph placeholders until `react-native-svg` is wired in at
// the `components/ui` layer. Shapes match the web SVG icons.
const VARIANT_GLYPH: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  warning: "!",
  info: "i",
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

interface ToastRowProps {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}

function ToastRow({ toast, onDismiss }: ToastRowProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const animatedStyle = useMemo<
    Animated.WithAnimatedValue<StyleProp<ViewStyle>>
  >(
    () => ({
      opacity: progress,
      transform: [
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [-8, 0],
          }),
        },
      ],
    }),
    [progress],
  );

  return (
    <Animated.View
      accessibilityRole="alert"
      style={animatedStyle}
      className={cx(
        "w-full flex-row items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg",
        VARIANT_BG[toast.type] ?? VARIANT_BG.info,
      )}
    >
      <Text className="text-white text-base font-bold">
        {VARIANT_GLYPH[toast.type] ?? VARIANT_GLYPH.info}
      </Text>
      <View className="flex-1">
        {typeof toast.msg === "string" ? (
          <Text className="text-white text-sm font-semibold">{toast.msg}</Text>
        ) : (
          toast.msg
        )}
      </View>
      {toast.action ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            try {
              toast.action?.onPress();
            } finally {
              onDismiss(toast.id);
            }
          }}
          className="px-2.5 py-1 rounded-xl bg-white/20 active:bg-white/30"
        >
          <Text className="text-white text-sm font-semibold">
            {toast.action.label}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Закрити"
        onPress={() => onDismiss(toast.id)}
        className="px-1.5 py-1 opacity-70 active:opacity-100"
      >
        <Text className="text-white text-base font-bold">✕</Text>
      </Pressable>
    </Animated.View>
  );
}

export interface ToastContainerProps {
  /** Extra classes applied to the outer stack wrapper. */
  className?: string;
}

export function ToastContainer({ className }: ToastContainerProps) {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      pointerEvents="box-none"
      className={cx(
        "absolute top-0 left-0 right-0 z-50 items-center px-4 pt-4",
        className,
      )}
    >
      <View className="w-full max-w-sm gap-2">
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </View>
    </View>
  );
}
