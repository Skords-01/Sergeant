import { useEffect, useState } from "react";

/** Піднімає bottom sheet над віртуальною клавіатурою (iOS/Android Chrome). */
export function useVisualKeyboardInset(active) {
  const [insetPx, setInsetPx] = useState(0);

  useEffect(() => {
    if (!active) {
      setInsetPx(0);
      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const ih = window.innerHeight;
      const gap = ih - vv.height - vv.offsetTop;
      setInsetPx(gap > 56 ? Math.round(gap) : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);

  return insetPx;
}
