/**
 * Sergeant Design System — Skeleton (React Native)
 *
 * Mobile port of the web `Skeleton` / `SkeletonText` placeholders.
 * Used while async data is in flight — a soft, pulsing panel that
 * reserves layout space without shifting the page.
 *
 * @see apps/web/src/shared/components/ui/Skeleton.tsx — canonical source of truth
 *
 * Parity notes:
 * - Same `SkeletonProps` shape (`className`).
 * - Both `Skeleton` (block) and `SkeletonText` (inline-line) are
 *   exported with the same roles as on web.
 * - Same WCAG 2.3.3 / Apple HIG reduced-motion contract: users with
 *   "Reduce Motion" enabled see a static panel instead of the pulse.
 * - Same default visuals: `bg-panelHi`, `rounded-2xl` for the block,
 *   `rounded-lg h-3` for the text line.
 *
 * Differences from web (intentional):
 * - `motion-safe:animate-pulse` → an `Animated.loop` on `opacity`.
 *   NativeWind v4 supports Tailwind's `animate-pulse` utility on RN
 *   via CSS interop, but it ignores `motion-safe:` prefixes. Driving
 *   the pulse manually via `Animated` + `AccessibilityInfo.
 *   isReduceMotionEnabled()` gives us the same reduced-motion
 *   behaviour without sniffing media queries in RN.
 * - `aria-hidden="true"` → `accessibilityElementsHidden` + an
 *   `importantForAccessibility="no-hide-descendants"` pair so both
 *   iOS and Android screen-readers skip the placeholder.
 * - Semantic token (`bg-panelHi`) falls back to the concrete
 *   `cream-*` class until mobile CSS-variable wiring lands — same
 *   caveat as every other phase-1 primitive.
 *   TODO: align with design-tokens once mobile semantic variables land.
 */

import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated } from "react-native";

export interface SkeletonProps {
  className?: string;
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function usePulse(): Animated.AnimatedInterpolation<number> | 1 {
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        // Ignore — default to motion-enabled on platforms / versions
        // that don't expose the API.
      });

    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => setReduceMotion(enabled),
    );

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      progress.stopAnimation();
      progress.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion]);

  if (reduceMotion) return 1;
  return progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.6],
  });
}

export function Skeleton({ className }: SkeletonProps) {
  const opacity = usePulse();
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ opacity }}
      className={cx("bg-cream-200 rounded-2xl", className)}
    />
  );
}

export function SkeletonText({ className }: SkeletonProps) {
  const opacity = usePulse();
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ opacity }}
      className={cx("bg-cream-200 rounded-lg h-3", className)}
    />
  );
}
